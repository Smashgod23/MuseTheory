"""Vibrato features.

We isolate sustained voiced notes, remove slow pitch drift, and look for a
periodic oscillation in the 4-8 Hz band (the trained-singer vibrato range).

`vibrato_rate`   — mean oscillation rate (Hz) across notes that show vibrato.
`vibrato_extent` — mean peak-to-peak depth (semitones) of that oscillation.
"""

from __future__ import annotations

import numpy as np

from muse_theory.features.signals import SignalCache
from muse_theory.features.types import Analysis


def _voiced_runs(voiced: np.ndarray, min_len: int) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start = None
    for i, v in enumerate(voiced):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_len:
                runs.append((start, i))
            start = None
    if start is not None and len(voiced) - start >= min_len:
        runs.append((start, len(voiced)))
    return runs


def extract_vibrato(cache: SignalCache, analysis: Analysis, cfg) -> None:
    f0 = cache.f0
    voiced = cache.voiced_flag & np.isfinite(f0) & (f0 > 0)
    frame_rate = cache.sr / cache.hop_length  # F0 frames per second
    min_len = int(cfg.vibrato.min_voiced_seconds * frame_rate)
    if min_len < 4:
        min_len = 4

    rate_min = float(cfg.vibrato.rate_min_hz)
    rate_max = float(cfg.vibrato.rate_max_hz)

    rates: list[float] = []
    extents: list[float] = []

    for start, end in _voiced_runs(voiced, min_len):
        segment = f0[start:end]
        if np.any(~np.isfinite(segment)):
            segment = np.interp(
                np.arange(len(segment)),
                np.flatnonzero(np.isfinite(segment)),
                segment[np.isfinite(segment)],
            )
        cents = 1200.0 * np.log2(segment / np.mean(segment))
        # Detrend slow drift (portamento, intonation slope) with a low-order fit.
        t = np.arange(len(cents))
        trend = np.polyval(np.polyfit(t, cents, min(3, len(cents) - 1)), t)
        residual = cents - trend

        # Spectrum of the residual; find the dominant peak in the vibrato band.
        spec = np.abs(np.fft.rfft(residual * np.hanning(len(residual))))
        freqs = np.fft.rfftfreq(len(residual), d=1.0 / frame_rate)
        band = (freqs >= rate_min) & (freqs <= rate_max)
        if not np.any(band) or spec[band].max() <= 0:
            continue
        # Vibrato must dominate the residual, not just exist.
        peak_idx = np.flatnonzero(band)[np.argmax(spec[band])]
        if spec[peak_idx] < 0.25 * spec.max():
            continue
        rate = float(freqs[peak_idx])
        # Extent in semitones: peak-to-peak of the residual (cents) -> semitones.
        extent_semitones = float((np.percentile(residual, 95) - np.percentile(residual, 5)) / 100.0)
        if extent_semitones < 0.05:  # negligible wobble, not real vibrato
            continue
        rates.append(rate)
        extents.append(extent_semitones)

    analysis.vibrato_note_count = len(rates)
    if rates:
        analysis.vibrato_rate = float(np.mean(rates))
        analysis.vibrato_extent = float(np.mean(extents))
    else:
        analysis.notes.append("No clear vibrato detected on sustained notes.")
