"""
Request/response models for the AI analysis microservice.
These must stay in sync with the Spring Boot DTOs in:
  com.musetheory.api.dto.ai.AIAnalysisRequest
  com.musetheory.api.dto.ai.AIAnalysisResponse
"""

from pydantic import BaseModel
from typing import Optional


class AnalysisRequest(BaseModel):
    performance_id: str
    audio_url: str
    piece_id: str
    instrument_id: str
    repetition_map: Optional[str] = None
    harmonic_tension_map: Optional[str] = None
    text_stress_map: Optional[str] = None
    director_notes: Optional[str] = None


class FeatureVector(BaseModel):
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
    suggestion_text: str
    musicality_score: Optional[float] = None
    measure_start: Optional[int] = None
    measure_end: Optional[int] = None
    feature_targeted: Optional[str] = None


class AnalysisResponse(BaseModel):
    feature_vector: FeatureVector
    suggestions: list[Suggestion]
