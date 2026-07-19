"""Phrasing & breath features.

We find breath/phrase boundaries as low-energy gaps between voiced regions, then:

`breath_placement`      — measure indices where breaths fall (JSON list).
`phrase_length_variance`— spread (std, in seconds) of phrase durations; how much
  the singer varies phrase shaping vs. breathing in uniform chunks.

`breath_times` and `phrase_lengths` are kept as evidence for phrasing coaching.
"""

from __future__ import annotations

import numpy as np

from muse_theory.features.signals import SignalCache
from muse_theory.features.types import Analysis
from muse_theory.structure.grid import TimeGrid

_EPS = 1e-8


def extract_phrasing(cache: SignalCache, grid: TimeGrid, analysis: Analysis, cfg) -> None:
    rms = cache.rms
    times = cache.rms_times
    if rms.size < 4:
        return

    rms_db = 20.0 * np.log10(rms + _EPS)
    silence_floor = np.percentile(rms_db, 95) + float(cfg.phrasing.silence_rel_db)
    is_silent = rms_db < silence_floor

    frame_dt = float(np.median(np.diff(times))) if times.size > 1 else 0.0
    if frame_dt <= 0:
        return
    min_gap_frames = max(1, int(cfg.phrasing.min_breath_gap_seconds / frame_dt))

    # Find silent runs long enough to be breaths, but only those flanked by sound
    # (i.e. internal breaths, not leading/trailing silence).
    breath_times: list[float] = []
    i = 0
    n = len(is_silent)
    first_sound = int(np.argmax(~is_silent)) if np.any(~is_silent) else 0
    last_sound = n - 1 - int(np.argmax(~is_silent[::-1])) if np.any(~is_silent) else n - 1
    while i < n:
        if is_silent[i]:
            j = i
            while j < n and is_silent[j]:
                j += 1
            if (j - i) >= min_gap_frames and i > first_sound and j <= last_sound + 1:
                center = times[(i + j) // 2]
                breath_times.append(float(center))
            i = j
        else:
            i += 1

    analysis.breath_times = breath_times
    analysis.breath_placement = [grid.measure_of_time(t) for t in breath_times]

    # Phrase lengths = spans between consecutive boundaries (incl. start/end of sound).
    boundaries = [float(times[first_sound])] + breath_times + [float(times[last_sound])]
    boundaries = sorted(set(boundaries))
    phrase_lengths = [b - a for a, b in zip(boundaries, boundaries[1:]) if b - a > 0]
    analysis.phrase_lengths = phrase_lengths
    if len(phrase_lengths) >= 2:
        analysis.phrase_length_variance = float(np.std(phrase_lengths))
    elif phrase_lengths:
        analysis.phrase_length_variance = 0.0
