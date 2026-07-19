"""Timbre features: brightness, MFCC character, and voice-quality evidence.

`spectral_centroid_mean` — mean spectral centroid (Hz); higher = brighter tone.
`mfcc_summary`           — per-coefficient mean+variance of the MFCCs (JSON).

Voice-quality extras (jitter, shimmer, HNR via Parselmouth/Praat, plus a
singer's-formant energy ratio) are internal evidence for timbral-color coaching;
they are not part of the §3.2 contract.
"""

from __future__ import annotations

import logging

import numpy as np

from muse_theory.features.signals import SignalCache
from muse_theory.features.types import Analysis

log = logging.getLogger("muse_theory.features.timbre")


def extract_timbre(cache: SignalCache, analysis: Analysis, cfg) -> None:
    import librosa

    samples, sr = cache.samples, cache.sr

    centroid = librosa.feature.spectral_centroid(y=samples, sr=sr)[0]
    if centroid.size:
        analysis.spectral_centroid_mean = float(np.mean(centroid))

    n_mfcc = int(cfg.timbre.n_mfcc)
    mfcc = librosa.feature.mfcc(y=samples, sr=sr, n_mfcc=n_mfcc)
    analysis.mfcc_summary = {
        "mean": [round(float(v), 4) for v in mfcc.mean(axis=1)],
        "var": [round(float(v), 4) for v in mfcc.var(axis=1)],
    }

    # Singer's-formant / brightness ratio: energy in 2-4 kHz vs 0-2 kHz.
    stft = np.abs(librosa.stft(samples))
    freqs = librosa.fft_frequencies(sr=sr)
    low = (freqs >= 0) & (freqs < 2000)
    ring = (freqs >= 2000) & (freqs < 4000)
    low_e = float(stft[low].sum()) + 1e-8
    ring_e = float(stft[ring].sum())
    analysis.voice_quality["singer_formant_ratio"] = round(ring_e / low_e, 4)

    _parselmouth_voice_quality(cache, analysis, cfg)


def _parselmouth_voice_quality(cache: SignalCache, analysis: Analysis, cfg) -> None:
    """Jitter / shimmer / HNR via Praat. Best-effort; failures are non-fatal."""
    try:
        import parselmouth
        from parselmouth.praat import call

        fmin = float(cfg.pitch.fmin_hz)
        fmax = float(cfg.pitch.fmax_hz)
        snd = parselmouth.Sound(cache.samples.astype(np.float64), sampling_frequency=cache.sr)

        point_process = call(snd, "To PointProcess (periodic, cc)", fmin, fmax)
        jitter = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
        shimmer = call(
            [snd, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6
        )
        harmonicity = call(snd, "To Harmonicity (cc)", 0.01, fmin, 0.1, 1.0)
        hnr = call(harmonicity, "Get mean", 0, 0)

        for name, val in (("jitter_local", jitter), ("shimmer_local", shimmer), ("hnr_db", hnr)):
            if val is not None and np.isfinite(val):
                analysis.voice_quality[name] = round(float(val), 5)
    except Exception as exc:  # noqa: BLE001 - Praat is finicky on short/noisy clips
        log.debug("Parselmouth voice-quality extraction skipped: %s", exc)
