"""Dynamics features: loudness shape and spread.

`dynamic_range`      — spread (dB) between the soft (5th pct) and loud (95th pct)
  active frames.
`rms_energy_contour` — the loudness shape over time, downsampled to a fixed
  number of points and normalized 0..1 (relative shape, not absolute level).

Also records which measures are loudest/softest as evidence for contrast and
dynamic-shaping coaching.
"""

from __future__ import annotations

import numpy as np

from muse_theory.features.signals import SignalCache
from muse_theory.features.types import Analysis
from muse_theory.structure.grid import TimeGrid

_EPS = 1e-8


def extract_dynamics(cache: SignalCache, grid: TimeGrid, analysis: Analysis, cfg) -> None:
    rms = cache.rms
    if rms.size == 0:
        analysis.notes.append("No energy envelope; dynamics unavailable.")
        return

    rms_db = 20.0 * np.log10(rms + _EPS)
    # Restrict the spread to "active" frames (above the noise floor) so silence
    # between phrases doesn't inflate the range.
    floor = np.percentile(rms_db, 20)
    active = rms_db[rms_db > floor]
    if active.size < 2:
        active = rms_db
    dyn_db = float(np.percentile(active, 95) - np.percentile(active, 5))
    analysis.dynamic_range = dyn_db
    analysis.dynamic_range_db = dyn_db

    # Normalized loudness shape, resampled to a fixed number of points.
    n_points = int(cfg.dynamics.contour_points)
    norm = (rms - rms.min()) / (rms.max() - rms.min() + _EPS)
    idx = np.linspace(0, len(norm) - 1, n_points)
    contour = np.interp(idx, np.arange(len(norm)), norm)
    analysis.rms_energy_contour = [float(v) for v in contour]

    # Per-measure mean energy -> loudest / softest measures (top/bottom 20%).
    n_meas = grid.n_measures
    if n_meas >= 2:
        meas_energy: list[tuple[int, float]] = []
        for m in range(1, n_meas + 1):
            t0, t1 = grid.measure_span(m, m)
            mask = (cache.rms_times >= t0) & (cache.rms_times < t1)
            if np.any(mask):
                meas_energy.append((m, float(np.mean(rms_db[mask]))))
        if len(meas_energy) >= 3:
            vals = np.array([e for _, e in meas_energy])
            hi = np.percentile(vals, 80)
            lo = np.percentile(vals, 20)
            analysis.loud_measures = [m for m, e in meas_energy if e >= hi]
            analysis.soft_measures = [m for m, e in meas_energy if e <= lo]
