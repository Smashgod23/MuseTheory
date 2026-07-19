"""Articulation features.

`onset_density`      — note onsets per second (how busy the line is).
`articulation_style` — 0..1 on a legato<->staccato axis. 0 = fully connected
  (energy stays up between notes), 1 = very detached (silent gaps between notes).

We estimate detachment from how much of the "active" span (first to last onset)
sits below a relative silence floor: lots of inter-note silence => staccato.
"""

from __future__ import annotations

import numpy as np

from muse_theory.features.signals import SignalCache
from muse_theory.features.types import Analysis

_EPS = 1e-8


def extract_articulation(cache: SignalCache, analysis: Analysis, cfg) -> None:
    duration = cache.duration
    n_onsets = int(cache.onset_times.size)
    if duration > 0:
        analysis.onset_density = float(n_onsets / duration)

    rms = cache.rms
    if rms.size < 4 or n_onsets < 2:
        return

    rms_db = 20.0 * np.log10(rms + _EPS)
    rel_floor = np.percentile(rms_db, 95) + float(cfg.phrasing.silence_rel_db)

    # Active span between first and last onset.
    t0, t1 = float(cache.onset_times[0]), float(cache.onset_times[-1])
    mask = (cache.rms_times >= t0) & (cache.rms_times <= t1)
    span_db = rms_db[mask]
    if span_db.size < 2:
        return
    detached_fraction = float(np.mean(span_db < rel_floor))
    analysis.articulation_style = float(np.clip(detached_fraction, 0.0, 1.0))
