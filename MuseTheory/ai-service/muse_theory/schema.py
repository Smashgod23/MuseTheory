"""
Wire contract for the Muse Theory AI service.

These models are the single source of truth for the HTTP boundary between the
Spring Boot backend and this service. They mirror, field-for-field, the LOCKED
§3.1 contract and the production database (`feature_vectors` and
`performances_feedback`, see V1 migration in the backend repo).

Two deliberate naming decisions, both required to be a true drop-in replacement
for the stub:

1. **Output is snake_case.** The §3.1 contract and the original stub
   (`ai-service/app/models.py`) use snake_case, and those names map 1:1 to the
   Postgres columns. We never rename them. `AnalysisResponse` therefore serializes
   as snake_case.

2. **Input tolerates BOTH snake_case and camelCase.** The backend's Jackson
   DTOs (`AIAnalysisRequest`) are camelCase with no snake_case naming strategy,
   so today Spring actually sends `performanceId`, `audioUrl`, ... while §3.1 and
   curl-based callers send `performance_id`, `audio_url`, .... We accept either by
   giving the request model a camelCase `alias_generator` plus
   `populate_by_name=True`. This makes the service work against the *current*
   backend with zero backend changes, while still honoring the documented
   snake_case contract.

See docs/INTEGRATION.md for the (optional, one-line) backend change that also
lets Spring deserialize the snake_case *response* into its camelCase DTOs.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# Canonical, ordered list of the 16 feature-vector fields. Kept here so tests can
# assert exact parity against the backend migration columns, and so the pipeline
# has one authoritative place to enumerate features.
FEATURE_FIELDS: tuple[str, ...] = (
    "tempo_mean",
    "tempo_variance",
    "dynamic_range",
    "rms_energy_contour",
    "pitch_mean",
    "pitch_stability",
    "vibrato_rate",
    "vibrato_extent",
    "spectral_centroid_mean",
    "mfcc_summary",
    "onset_density",
    "articulation_style",
    "contrast_score",
    "phrase_length_variance",
    "breath_placement",
    "harmonic_deviation",
)

# The three feature fields that the database stores as TEXT (JSON-encoded
# strings) rather than DOUBLE PRECISION.
JSON_FEATURE_FIELDS: frozenset[str] = frozenset(
    {"rms_energy_contour", "mfcc_summary", "breath_placement"}
)


class AnalysisRequest(BaseModel):
    """POST /analyze request body.

    Accepts camelCase (what Spring currently sends) or snake_case (what §3.1 and
    other callers send). All piece-context fields are optional; the pipeline
    degrades gracefully when they are absent.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",  # tolerate extra keys rather than 422-ing the backend
    )

    performance_id: str
    audio_url: str
    piece_id: str
    instrument_id: str
    repetition_map: Optional[str] = None
    harmonic_tension_map: Optional[str] = None
    text_stress_map: Optional[str] = None
    director_notes: Optional[str] = None
    # Optional, additive, backward-compatible: the singer's voice part (e.g.
    # "Bass 2", "Soprano 1"). When the backend sends it, coaching is phrased for
    # that part; otherwise the part is estimated from the recording's pitch range.
    # Not part of the §3.1 feature_vector response, so no DB/schema change.
    voice_part: Optional[str] = None


class FeatureVector(BaseModel):
    """The 16 §3.2 fields. Every field is individually optional: the pipeline
    returns real values for what it can compute and `null` for the rest, so
    partial output is always valid against the contract."""

    tempo_mean: Optional[float] = None
    tempo_variance: Optional[float] = None
    dynamic_range: Optional[float] = None
    rms_energy_contour: Optional[str] = None
    pitch_mean: Optional[float] = None
    pitch_stability: Optional[float] = None
    vibrato_rate: Optional[float] = None
    vibrato_extent: Optional[float] = None
    spectral_centroid_mean: Optional[float] = None
    mfcc_summary: Optional[str] = None
    onset_density: Optional[float] = None
    articulation_style: Optional[float] = None
    contrast_score: Optional[float] = None
    phrase_length_variance: Optional[float] = None
    breath_placement: Optional[str] = None
    harmonic_deviation: Optional[float] = None


class Suggestion(BaseModel):
    """One piece of coaching advice, optionally anchored to a measure range and a
    targeted expressive feature. `musicality_score` is an internal 1-10 confidence
    /salience signal; the product coaches, it does not grade, so the UI need not
    surface it."""

    suggestion_text: str
    musicality_score: Optional[float] = None
    measure_start: Optional[int] = None
    measure_end: Optional[int] = None
    feature_targeted: Optional[str] = None


class AnalysisResponse(BaseModel):
    feature_vector: FeatureVector
    suggestions: list[Suggestion]
