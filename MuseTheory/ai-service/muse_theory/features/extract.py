"""Feature extraction orchestrator.

Builds the shared signal cache and time grid once, then runs every feature
family, accumulating results into a single `Analysis`. Each family is wrapped so
that one failing extractor degrades to nulls for its fields without taking down
the rest of the analysis (brief §4: robust to bad input, return nulls not crashes).
"""

from __future__ import annotations

import logging

import numpy as np

from muse_theory.context.maps import PieceContext
from muse_theory.features.articulation import extract_articulation
from muse_theory.features.contrast import extract_contrast
from muse_theory.features.dynamics import extract_dynamics
from muse_theory.features.harmonic import extract_harmonic
from muse_theory.features.phrasing import extract_phrasing
from muse_theory.features.pitch import extract_pitch
from muse_theory.features.signals import build_signal_cache
from muse_theory.features.textmusic import extract_text_music
from muse_theory.features.timbre import extract_timbre
from muse_theory.features.types import Analysis
from muse_theory.features.vibrato import extract_vibrato
from muse_theory.structure.grid import build_time_grid

log = logging.getLogger("muse_theory.features")


def _safe(name: str, fn) -> None:
    try:
        fn()
    except Exception as exc:  # noqa: BLE001 - isolate per-family failures
        log.warning("Feature family '%s' failed: %s", name, exc)


def analyze_audio(
    samples: np.ndarray, sr: int, context: PieceContext, cfg
) -> Analysis:
    analysis = Analysis()
    analysis.duration = len(samples) / sr if sr else 0.0

    grid = build_time_grid(samples, sr, time_signature=context.time_signature)
    analysis.tempo_mean = grid.tempo
    analysis.tempo_variance = grid.tempo_variance
    analysis.grid_confidence = grid.confidence

    cache = build_signal_cache(samples, sr, cfg)

    _safe("pitch", lambda: extract_pitch(cache, analysis, cfg))
    _safe("vibrato", lambda: extract_vibrato(cache, analysis, cfg))
    _safe("dynamics", lambda: extract_dynamics(cache, grid, analysis, cfg))
    _safe("timbre", lambda: extract_timbre(cache, analysis, cfg))
    _safe("articulation", lambda: extract_articulation(cache, analysis, cfg))
    _safe("phrasing", lambda: extract_phrasing(cache, grid, analysis, cfg))
    _safe("contrast", lambda: extract_contrast(cache, grid, context, analysis, cfg))
    _safe("harmonic", lambda: extract_harmonic(cache, grid, context, analysis, cfg))
    _safe("text_music", lambda: extract_text_music(cache, grid, context, analysis, cfg))

    return analysis
