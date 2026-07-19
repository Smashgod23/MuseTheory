"""Pitch features: central tendency and stability of the sung pitch.

`pitch_mean`  — median F0 over voiced frames, in Hz.
`pitch_stability` — 0..1, steadiness vs. drift WITHIN sustained notes (intonation
  micro-jitter), separated from intentional note-to-note motion. 1.0 = rock
  steady, lower = wavering/sliding pitch.
"""

from __future__ import annotations

import numpy as np

from muse_theory.features.signals import SignalCache
from muse_theory.features.types import Analysis

# A frame-to-frame jump larger than this (cents) is a note change, not intonation
# drift, so we exclude it from the stability measure.
_NOTE_CHANGE_CENTS = 100.0


def extract_pitch(cache: SignalCache, analysis: Analysis, cfg) -> None:
    f0 = cache.f0
    voiced = cache.voiced_flag & np.isfinite(f0) & (f0 > 0)
    analysis.voiced_ratio = cache.voiced_ratio

    if voiced.sum() < 3:
        analysis.notes.append("Too little voiced signal to estimate pitch.")
        return

    voiced_f0 = f0[voiced]
    analysis.pitch_mean = float(np.median(voiced_f0))
    analysis.pitch_low_hz = float(np.percentile(voiced_f0, 10))
    analysis.pitch_high_hz = float(np.percentile(voiced_f0, 90))

    # Work in cents relative to the median so the measure is key-independent.
    cents = 1200.0 * np.log2(np.clip(voiced_f0, 1e-6, None) / analysis.pitch_mean)
    deltas = np.abs(np.diff(cents))
    intra_note = deltas[deltas < _NOTE_CHANGE_CENTS]  # exclude note transitions
    if intra_note.size == 0:
        analysis.pitch_stability = 1.0
        return
    mean_dev = float(np.mean(intra_note))
    # Map mean intra-note deviation (cents) to 0..1; ~25 cents dev -> ~0.5.
    analysis.pitch_stability = float(np.clip(1.0 - mean_dev / 50.0, 0.0, 1.0))
