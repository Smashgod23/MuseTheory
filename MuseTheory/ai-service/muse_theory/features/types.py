"""Shared types for feature extraction.

`Analysis` is the rich, internal result of analyzing one recording. It carries
both the 16 contract feature values AND the supporting evidence the coaching
layer needs to write specific, grounded suggestions (per-section energy, breath
times, vibrato per note, stress alignment, etc.). `to_feature_vector()` projects
it down to the locked §3.2 contract object.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional

from muse_theory.schema import FeatureVector


def _round(x: Optional[float], ndigits: int = 4) -> Optional[float]:
    if x is None:
        return None
    try:
        if x != x:  # NaN
            return None
        return round(float(x), ndigits)
    except (TypeError, ValueError):
        return None


@dataclass
class Analysis:
    # --- §3.2 contract scalars (None until computed) ---
    tempo_mean: Optional[float] = None
    tempo_variance: Optional[float] = None
    dynamic_range: Optional[float] = None
    rms_energy_contour: Optional[list[float]] = None  # JSON-encoded on projection
    pitch_mean: Optional[float] = None
    pitch_stability: Optional[float] = None
    vibrato_rate: Optional[float] = None
    vibrato_extent: Optional[float] = None
    spectral_centroid_mean: Optional[float] = None
    mfcc_summary: Optional[dict[str, list[float]]] = None  # JSON-encoded on projection
    onset_density: Optional[float] = None
    articulation_style: Optional[float] = None
    contrast_score: Optional[float] = None
    phrase_length_variance: Optional[float] = None
    breath_placement: Optional[list[int]] = None  # measure indices; JSON-encoded
    harmonic_deviation: Optional[float] = None

    # --- supporting evidence for coaching (not in the contract) ---
    duration: float = 0.0
    separation_applied: bool = False
    grid_confidence: float = 0.0
    voiced_ratio: Optional[float] = None
    # voiced-pitch spread (Hz), used to estimate the singer's voice part
    pitch_low_hz: Optional[float] = None
    pitch_high_hz: Optional[float] = None
    # dynamics evidence
    dynamic_range_db: Optional[float] = None
    loud_measures: list[int] = field(default_factory=list)
    soft_measures: list[int] = field(default_factory=list)
    # phrasing evidence
    breath_times: list[float] = field(default_factory=list)
    phrase_lengths: list[float] = field(default_factory=list)
    # contrast evidence: label -> per-instance summary dicts
    section_instances: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    contrast_source: str = "none"  # "repetition_map" | "self_similar" | "none"
    # vibrato evidence
    vibrato_note_count: int = 0
    # timbre / voice-quality evidence
    voice_quality: dict[str, float] = field(default_factory=dict)
    # harmonic / tension evidence
    tension_alignment: list[dict[str, Any]] = field(default_factory=list)
    # text-music evidence
    stress_alignment: list[dict[str, Any]] = field(default_factory=list)
    # free-form notes / warnings surfaced during analysis
    notes: list[str] = field(default_factory=list)

    def to_feature_vector(self) -> FeatureVector:
        """Project to the locked contract object, JSON-encoding the three TEXT
        fields and rounding floats. Anything still None stays null."""
        rms = (
            json.dumps([round(v, 5) for v in self.rms_energy_contour])
            if self.rms_energy_contour is not None
            else None
        )
        mfcc = json.dumps(self.mfcc_summary) if self.mfcc_summary is not None else None
        breaths = (
            json.dumps(self.breath_placement)
            if self.breath_placement is not None
            else None
        )
        return FeatureVector(
            tempo_mean=_round(self.tempo_mean, 2),
            tempo_variance=_round(self.tempo_variance, 3),
            dynamic_range=_round(self.dynamic_range, 4),
            rms_energy_contour=rms,
            pitch_mean=_round(self.pitch_mean, 2),
            pitch_stability=_round(self.pitch_stability, 4),
            vibrato_rate=_round(self.vibrato_rate, 3),
            vibrato_extent=_round(self.vibrato_extent, 4),
            spectral_centroid_mean=_round(self.spectral_centroid_mean, 2),
            mfcc_summary=mfcc,
            onset_density=_round(self.onset_density, 3),
            articulation_style=_round(self.articulation_style, 4),
            contrast_score=_round(self.contrast_score, 4),
            phrase_length_variance=_round(self.phrase_length_variance, 4),
            breath_placement=breaths,
            harmonic_deviation=_round(self.harmonic_deviation, 4),
        )
