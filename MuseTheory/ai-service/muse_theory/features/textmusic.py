"""Text-music relationship: does musical emphasis land where the words want it?

This is a deliberate differentiator (brief §4): we treat the alignment between
linguistic stress and musical stress as a first-class feature. Using the
text_stress_map, we look at each stressed word's location and measure the local
musical emphasis (energy prominence + pitch prominence), then flag mismatches:
a strong word sitting on a weak musical moment, or vice versa.

Output is recorded as `stress_alignment` evidence consumed by the coaching layer.
It does not have its own §3.2 contract field.
"""

from __future__ import annotations

import numpy as np

from muse_theory.context.maps import PieceContext
from muse_theory.features.signals import SignalCache
from muse_theory.features.types import Analysis
from muse_theory.structure.grid import TimeGrid

_EPS = 1e-8


def _musical_emphasis_at(cache: SignalCache, t0: float, t1: float, rms_db_ref: float) -> float:
    """0..1 emphasis from energy prominence over a short window [t0, t1]."""
    mask = (cache.rms_times >= t0) & (cache.rms_times < t1)
    if not np.any(mask):
        return 0.0
    local_db = 20.0 * np.log10(cache.rms[mask] + _EPS)
    prominence = float(np.max(local_db)) - rms_db_ref  # dB above the median level
    # Map ~ -6..+12 dB prominence to 0..1.
    return float(np.clip((prominence + 6.0) / 18.0, 0.0, 1.0))


def extract_text_music(
    cache: SignalCache, grid: TimeGrid, context: PieceContext, analysis: Analysis, cfg
) -> None:
    if not context.text_stress.present or cache.rms.size < 4:
        return

    rms_db_ref = float(np.median(20.0 * np.log10(cache.rms + _EPS)))
    beat_period = grid.beat_period

    for mark in context.text_stress.stresses:
        measure_start = grid.time_of_measure(mark.measure)
        if mark.beat is not None:
            center = measure_start + (mark.beat - 1.0) * beat_period
        else:
            center = measure_start + 0.5 * beat_period
        emphasis = _musical_emphasis_at(cache, center - 0.15, center + 0.35, rms_db_ref)
        # Misalignment: strong word, weak music (under-stressed) or the reverse.
        gap = emphasis - mark.stress
        analysis.stress_alignment.append(
            {
                "measure": mark.measure,
                "word": mark.word,
                "text_stress": round(mark.stress, 3),
                "musical_emphasis": round(emphasis, 3),
                "gap": round(gap, 3),  # negative = under-emphasized word
            }
        )
