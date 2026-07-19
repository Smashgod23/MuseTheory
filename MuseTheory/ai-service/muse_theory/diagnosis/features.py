"""Flatten an `Analysis` into a fixed-length numeric vector for the diagnosis head.

The diagnosis model consumes the SAME interpretable features the production
pipeline already computes (so nothing extra runs at inference). Missing values
become NaN and are imputed by the model. Keeping the input interpretable is
deliberate: the learned model replaces hand-tuned thresholds with a calibrated
mapping, while staying explainable (you can see which features drive a diagnosis).
"""

from __future__ import annotations

import numpy as np

from muse_theory.features.types import Analysis

# Scalar features pulled directly off the Analysis (order is fixed + canonical).
_SCALARS = (
    "tempo_mean", "tempo_variance", "dynamic_range", "pitch_mean", "pitch_stability",
    "vibrato_rate", "vibrato_extent", "spectral_centroid_mean", "onset_density",
    "articulation_style", "phrase_length_variance", "harmonic_deviation",
    "voiced_ratio", "dynamic_range_db", "vibrato_note_count", "grid_confidence",
)
_VOICE_QUALITY = ("jitter_local", "shimmer_local", "hnr_db", "singer_formant_ratio")
_N_MFCC = 13

FEATURE_NAMES: tuple[str, ...] = (
    _SCALARS
    + tuple(f"vq_{k}" for k in _VOICE_QUALITY)
    + tuple(f"mfcc_mean_{i}" for i in range(_N_MFCC))
)


def analysis_to_vector(analysis: Analysis) -> np.ndarray:
    """Return a fixed-length float vector (NaN where a feature is unavailable)."""
    vals: list[float] = []
    for name in _SCALARS:
        v = getattr(analysis, name, None)
        vals.append(float(v) if v is not None else np.nan)
    for k in _VOICE_QUALITY:
        v = analysis.voice_quality.get(k)
        vals.append(float(v) if v is not None else np.nan)
    means = (analysis.mfcc_summary or {}).get("mean") if analysis.mfcc_summary else None
    for i in range(_N_MFCC):
        vals.append(float(means[i]) if means and i < len(means) else np.nan)
    return np.asarray(vals, dtype=np.float32)
