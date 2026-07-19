"""Conditional vocal extraction.

Some inputs (and some training data) carry accompaniment; some are already
isolated voice. Per brief §4 we must obtain a clean vocal signal when needed and
NOT waste effort separating audio that is already a cappella.

`estimate_accompaniment_ratio` is a fast gate built from harmonic-percussive
separation (drums/comping show up as percussive energy) plus sub-bass energy
(bass lines / piano left hand). If the ratio is below the configured threshold we
treat the clip as already-isolated voice and skip Demucs entirely.

`separate_vocals` runs Demucs (htdemucs_ft, MPS when available) and returns the
vocals stem. Any failure falls back to the original signal so the request still
completes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from muse_theory.config import resolve_device

log = logging.getLogger("muse_theory.separation")


@dataclass
class SeparationResult:
    vocals: np.ndarray
    sr: int
    applied: bool
    accompaniment_ratio: float
    note: str = ""


def estimate_accompaniment_ratio(samples: np.ndarray, sr: int) -> float:
    """0..1 proxy for how much accompaniment is present. Low => a cappella."""
    import librosa

    if samples.size < sr // 2:
        return 0.0
    try:
        harmonic, percussive = librosa.effects.hpss(samples)
        p_energy = float(np.mean(percussive**2))
        h_energy = float(np.mean(harmonic**2)) + 1e-9
        percussive_frac = p_energy / (p_energy + h_energy)

        # Sub-bass energy fraction (< 150 Hz): vocals rarely live here, bands do.
        stft = np.abs(librosa.stft(samples))
        freqs = librosa.fft_frequencies(sr=sr)
        sub = stft[freqs < 150].sum()
        total = stft.sum() + 1e-9
        sub_frac = float(sub / total)

        ratio = float(np.clip(1.6 * percussive_frac + 1.2 * sub_frac, 0.0, 1.0))
        return ratio
    except Exception as exc:  # noqa: BLE001
        log.warning("Accompaniment estimation failed (%s); assuming a cappella", exc)
        return 0.0


def separate_vocals(samples: np.ndarray, sr: int, cfg) -> SeparationResult:
    ratio = estimate_accompaniment_ratio(samples, sr)
    threshold = float(cfg.separation.accompaniment_ratio_threshold)

    if not cfg.separation.enabled or ratio < threshold:
        return SeparationResult(
            vocals=samples,
            sr=sr,
            applied=False,
            accompaniment_ratio=ratio,
            note="skipped (already isolated voice)" if ratio < threshold else "disabled",
        )

    try:
        import torch
        import librosa
        from demucs.apply import apply_model
        from demucs.pretrained import get_model

        device = resolve_device(cfg.separation.device)
        try:
            model = get_model(cfg.separation.model)
        except Exception as exc:  # noqa: BLE001 - fall back to base checkpoint
            log.warning("Could not load %s (%s); using htdemucs", cfg.separation.model, exc)
            model = get_model("htdemucs")
        model.to(device).eval()

        # Demucs wants stereo at its own sample rate.
        model_sr = model.samplerate
        wav = librosa.resample(samples, orig_sr=sr, target_sr=model_sr) if sr != model_sr else samples
        wav_t = torch.tensor(wav, dtype=torch.float32).unsqueeze(0).repeat(2, 1)  # (2, n)
        ref = wav_t.mean(0)
        wav_t = (wav_t - ref.mean()) / (ref.std() + 1e-8)

        # htdemucs rejects a segment longer than its training length (~7.8s), so
        # clamp to the model's own max to avoid an assertion error.
        seg = float(cfg.separation.segment_seconds)
        submodels = getattr(model, "models", None)
        seg_limits = [float(s.segment) for s in (submodels or []) if getattr(s, "segment", None)]
        if not seg_limits and getattr(model, "segment", None):
            seg_limits = [float(model.segment)]
        if seg_limits:
            seg = min(seg, min(seg_limits))

        with torch.no_grad():
            sources = apply_model(
                model,
                wav_t.unsqueeze(0).to(device),
                device=device,
                segment=seg,
                overlap=0.1,
                progress=False,
            )[0]
        sources = sources * ref.std() + ref.mean()

        vocals_idx = model.sources.index("vocals")
        vocals = sources[vocals_idx].mean(0).cpu().numpy()  # downmix to mono
        vocals = librosa.resample(vocals, orig_sr=model_sr, target_sr=sr) if sr != model_sr else vocals
        return SeparationResult(
            vocals=np.ascontiguousarray(vocals, dtype=np.float32),
            sr=sr,
            applied=True,
            accompaniment_ratio=ratio,
            note=f"demucs {cfg.separation.model} on {device}",
        )
    except Exception as exc:  # noqa: BLE001 - never fail the request on separation
        log.warning("Vocal separation failed (%s); analyzing original mix", exc)
        return SeparationResult(
            vocals=samples, sr=sr, applied=False, accompaniment_ratio=ratio, note=f"failed: {exc}"
        )
