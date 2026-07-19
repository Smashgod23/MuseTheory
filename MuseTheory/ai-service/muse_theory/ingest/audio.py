"""Audio ingestion: fetch from a URL (or local path) and decode to mono float32.

The backend hands us `audio_url` — an S3 (prod) or MinIO (dev) URL, typically
presigned, that the service must download. For tests and local runs we also
accept plain filesystem paths and file:// URLs.

Decoding goes through libsndfile (soundfile) first, which handles wav/flac/ogg
and modern mp3, and falls back to audioread/ffmpeg for anything else. Everything
here raises AudioIngestError on failure so the pipeline can convert that into a
null-but-valid response rather than a 500.
"""

from __future__ import annotations

import ipaddress
import logging
import os
import socket
import tempfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import numpy as np

log = logging.getLogger("muse_theory.ingest")


class AudioIngestError(Exception):
    """Raised when audio cannot be fetched or decoded."""


def _host_resolves_to_link_local(host: str) -> bool:
    """True if the host resolves to a link-local address (e.g. the cloud-metadata
    endpoint 169.254.169.254 / fe80::). These are never a legitimate audio source,
    so we block them as a baseline SSRF guard. Loopback/private addresses are
    intentionally NOT blocked, because MinIO in dev runs on localhost."""
    try:
        for info in socket.getaddrinfo(host, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_link_local:
                return True
    except (socket.gaierror, ValueError):
        return False  # let the actual request surface the resolution error
    return False


@dataclass
class AudioClip:
    samples: np.ndarray  # float32, mono, shape (n,)
    sr: int
    source: str

    @property
    def duration(self) -> float:
        return float(len(self.samples)) / float(self.sr) if self.sr else 0.0


def _is_url(source: str) -> bool:
    scheme = urlparse(source).scheme
    return scheme in ("http", "https", "s3")


def _download(
    url: str,
    max_bytes: int,
    allowed_hosts: set[str] | None = None,
    block_link_local: bool = True,
    timeout: float = 60.0,
) -> str:
    """Download an http(s) URL to a temp file and return its path.

    Safety guards (defense-in-depth; the service is internal-only):
      - reject raw s3:// (the backend presigns to http(s));
      - optionally restrict to an explicit host allowlist (`allowed_hosts`,
        wired from MUSE_ALLOWED_AUDIO_HOSTS);
      - block hosts that resolve to link-local / cloud-metadata addresses;
      - cap the number of bytes written so a huge/endless URL can't fill disk.
    """
    import requests

    parsed = urlparse(url)
    if parsed.scheme == "s3":
        # The backend normally presigns to http(s); a raw s3:// URL would need
        # boto3 + credentials, which we deliberately don't bake in here.
        raise AudioIngestError(
            "Raw s3:// URLs are not supported; the backend should pass a "
            "presigned http(s) URL. Got: " + url
        )

    host = parsed.hostname or ""
    if allowed_hosts and host not in allowed_hosts:
        raise AudioIngestError(f"Host '{host}' is not in the allowed audio-host list")
    if block_link_local and _host_resolves_to_link_local(host):
        raise AudioIngestError(f"Refusing to fetch link-local/metadata host: {host}")

    suffix = Path(parsed.path).suffix or ".audio"
    fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="muse_audio_")
    try:
        with requests.get(url, stream=True, timeout=timeout) as resp:
            resp.raise_for_status()
            # Reject obviously-too-large bodies up front when advertised.
            advertised = resp.headers.get("Content-Length")
            if advertised and advertised.isdigit() and int(advertised) > max_bytes:
                raise AudioIngestError(
                    f"Audio exceeds size limit ({advertised} > {max_bytes} bytes)"
                )
            written = 0
            with os.fdopen(fd, "wb") as fh:
                for chunk in resp.iter_content(chunk_size=1 << 16):
                    if not chunk:
                        continue
                    written += len(chunk)
                    if written > max_bytes:
                        raise AudioIngestError(
                            f"Audio exceeds size limit ({max_bytes} bytes) while streaming"
                        )
                    fh.write(chunk)
    except AudioIngestError:
        _safe_remove(tmp_path)
        raise
    except Exception as exc:  # network, HTTP, disk
        _safe_remove(tmp_path)
        raise AudioIngestError(f"Failed to download audio from {url}: {exc}") from exc
    return tmp_path


def _safe_remove(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass


def _decode(path: str, target_sr: int, mono: bool) -> tuple[np.ndarray, int]:
    """Decode a local audio file to float32 at target_sr. soundfile first,
    librosa/audioread fallback."""
    import librosa

    try:
        import soundfile as sf

        data, sr = sf.read(path, dtype="float32", always_2d=True)
        samples = data.mean(axis=1) if mono else data[:, 0]
        if target_sr and sr != target_sr:
            samples = librosa.resample(samples, orig_sr=sr, target_sr=target_sr)
            sr = target_sr
        return np.ascontiguousarray(samples, dtype=np.float32), sr
    except Exception as sf_exc:  # noqa: BLE001 - fall back deliberately
        log.debug("soundfile decode failed (%s); falling back to librosa/audioread", sf_exc)
        try:
            samples, sr = librosa.load(path, sr=target_sr, mono=mono)
            return np.ascontiguousarray(samples, dtype=np.float32), sr
        except Exception as exc:  # noqa: BLE001
            raise AudioIngestError(f"Failed to decode audio {path}: {exc}") from exc


def load_audio(
    source: str,
    target_sr: int,
    mono: bool = True,
    max_seconds: float | None = None,
    max_download_mb: float = 80.0,
    allowed_hosts: set[str] | None = None,
    block_link_local: bool = True,
) -> AudioClip:
    """Fetch (if URL) and decode `source` into an AudioClip at `target_sr`.

    Long inputs are truncated to `max_seconds` (with a log) to bound compute and
    stay inside the backend's 120s read timeout. URL fetches are size-capped at
    `max_download_mb` and pass the SSRF guards in `_download`.
    """
    tmp_to_clean: str | None = None
    try:
        if _is_url(source):
            local_path = _download(
                source,
                max_bytes=int(max_download_mb * 1024 * 1024),
                allowed_hosts=allowed_hosts,
                block_link_local=block_link_local,
            )
            tmp_to_clean = local_path
        else:
            local_path = source[7:] if source.startswith("file://") else source
            if not os.path.exists(local_path):
                raise AudioIngestError(f"Audio path does not exist: {local_path}")

        samples, sr = _decode(local_path, target_sr=target_sr, mono=mono)

        if samples.size == 0:
            raise AudioIngestError("Decoded audio is empty")

        if max_seconds is not None:
            max_samples = int(max_seconds * sr)
            if samples.shape[0] > max_samples:
                log.info(
                    "Truncating audio from %.1fs to %.1fs",
                    samples.shape[0] / sr,
                    max_seconds,
                )
                samples = samples[:max_samples]

        return AudioClip(samples=samples, sr=sr, source=source)
    finally:
        if tmp_to_clean and os.path.exists(tmp_to_clean):
            try:
                os.remove(tmp_to_clean)
            except OSError:  # pragma: no cover
                pass
