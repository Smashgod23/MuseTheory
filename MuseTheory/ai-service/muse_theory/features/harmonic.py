"""Harmonic feature: departure from the expected harmonic / tonal context.

Without a per-performance reference score we estimate the key from the chroma,
then measure how much pitch-class energy falls outside that key's diatonic set.

`harmonic_deviation` — 0..1. Near 0 = squarely in key; higher = more out-of-key
  energy (chromaticism, modulation, or intonation drift).

When a harmonic_tension_map is supplied we also compare a measured tension proxy
(chroma "dissonance") against the expected curve, stored as `tension_alignment`
evidence for tension/release coaching.
"""

from __future__ import annotations

import numpy as np

from muse_theory.context.maps import PieceContext
from muse_theory.features.signals import SignalCache
from muse_theory.features.types import Analysis
from muse_theory.structure.grid import TimeGrid

# Krumhansl-Kessler major/minor key profiles (relative weights per pitch class).
_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
_DIATONIC_MAJOR = {0, 2, 4, 5, 7, 9, 11}
_DIATONIC_MINOR = {0, 2, 3, 5, 7, 8, 10}


def _estimate_key(chroma_mean: np.ndarray) -> tuple[int, bool]:
    """Return (tonic_pitch_class, is_major) by best Krumhansl correlation."""
    best_corr, best = -2.0, (0, True)
    cm = chroma_mean - chroma_mean.mean()
    for tonic in range(12):
        for profile, is_major in ((_MAJOR, True), (_MINOR, False)):
            rolled = np.roll(profile, tonic)
            rolled = rolled - rolled.mean()
            denom = np.linalg.norm(cm) * np.linalg.norm(rolled) + 1e-8
            corr = float(np.dot(cm, rolled) / denom)
            if corr > best_corr:
                best_corr, best = corr, (tonic, is_major)
    return best


def extract_harmonic(
    cache: SignalCache, grid: TimeGrid, context: PieceContext, analysis: Analysis, cfg
) -> None:
    import librosa

    chroma = librosa.feature.chroma_cqt(y=cache.samples, sr=cache.sr)
    if chroma.size == 0:
        return
    chroma_mean = chroma.mean(axis=1)

    tonic, is_major = _estimate_key(chroma_mean)
    diatonic = _DIATONIC_MAJOR if is_major else _DIATONIC_MINOR
    in_key_pcs = {(tonic + d) % 12 for d in diatonic}

    total = float(chroma_mean.sum()) + 1e-8
    out_of_key = float(sum(chroma_mean[pc] for pc in range(12) if pc not in in_key_pcs))
    analysis.harmonic_deviation = float(np.clip(out_of_key / total, 0.0, 1.0))

    # Tension alignment vs. supplied curve (evidence only).
    if context.tension.present and grid.n_measures >= 2:
        # Chroma "dissonance" proxy: normalized entropy of the chroma per measure.
        for m in range(1, grid.n_measures + 1):
            t0, t1 = grid.measure_span(m, m)
            mask = (librosa.times_like(chroma, sr=cache.sr) >= t0) & (
                librosa.times_like(chroma, sr=cache.sr) < t1
            )
            if not np.any(mask):
                continue
            c = chroma[:, mask].mean(axis=1)
            c = c / (c.sum() + 1e-8)
            entropy = float(-np.sum(c * np.log(c + 1e-8)) / np.log(12))
            expected = context.tension.tension_at(m)
            if expected is not None:
                analysis.tension_alignment.append(
                    {"measure": m, "measured": round(entropy, 3), "expected": round(expected, 3)}
                )
