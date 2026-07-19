"""Shared low-level signals computed once per recording.

Several feature families need the same building blocks (the F0 contour, the RMS
energy envelope, the onset envelope). Computing them once here and passing the
cache around keeps the pipeline fast enough to stay well inside the backend's
120s budget and keeps every feature consistent with the same underlying signals.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

log = logging.getLogger("muse_theory.features.signals")


@dataclass
class SignalCache:
    samples: np.ndarray
    sr: int
    # F0 (Hz), NaN where unvoiced; aligned to f0_times
    f0: np.ndarray
    voiced_flag: np.ndarray
    voiced_prob: np.ndarray
    f0_times: np.ndarray
    hop_length: int
    # RMS energy envelope aligned to rms_times
    rms: np.ndarray
    rms_times: np.ndarray
    rms_hop: int
    # onset strength envelope + detected onset times
    onset_env: np.ndarray
    onset_times: np.ndarray

    @property
    def duration(self) -> float:
        return len(self.samples) / self.sr if self.sr else 0.0

    @property
    def voiced_ratio(self) -> float:
        if self.voiced_flag.size == 0:
            return 0.0
        return float(np.mean(self.voiced_flag.astype(np.float32)))


def build_signal_cache(samples: np.ndarray, sr: int, cfg) -> SignalCache:
    import librosa

    pitch_cfg = cfg.pitch
    hop = int(pitch_cfg.hop_length)
    frame_length = int(pitch_cfg.frame_length)

    # --- F0 via probabilistic YIN (no extra model, good on sustained voice) ---
    try:
        f0, voiced_flag, voiced_prob = librosa.pyin(
            samples,
            sr=sr,
            fmin=float(pitch_cfg.fmin_hz),
            fmax=float(pitch_cfg.fmax_hz),
            frame_length=frame_length,
            hop_length=hop,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("pyin failed (%s); F0 unavailable", exc)
        n = 1 + len(samples) // hop
        f0 = np.full(n, np.nan)
        voiced_flag = np.zeros(n, dtype=bool)
        voiced_prob = np.zeros(n)
    f0_times = librosa.times_like(f0, sr=sr, hop_length=hop)

    # --- RMS energy envelope ---
    rms_hop = int(cfg.dynamics.rms_hop_length)
    rms_frame = int(cfg.dynamics.rms_frame_length)
    rms = librosa.feature.rms(y=samples, frame_length=rms_frame, hop_length=rms_hop)[0]
    rms_times = librosa.times_like(rms, sr=sr, hop_length=rms_hop)

    # --- onset envelope + onsets ---
    onset_env = librosa.onset.onset_strength(y=samples, sr=sr)
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        backtrack=bool(cfg.articulation.onset_backtrack),
    )
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)

    return SignalCache(
        samples=samples,
        sr=sr,
        f0=f0,
        voiced_flag=np.nan_to_num(voiced_flag, nan=0.0).astype(bool),
        voiced_prob=np.nan_to_num(voiced_prob, nan=0.0),
        f0_times=f0_times,
        hop_length=hop,
        rms=rms,
        rms_times=rms_times,
        rms_hop=rms_hop,
        onset_env=onset_env,
        onset_times=onset_times,
    )
