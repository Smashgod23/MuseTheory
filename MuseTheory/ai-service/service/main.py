"""Muse Theory AI microservice (production drop-in replacement for the stub).

Internal-only FastAPI service. Spring Boot is the sole caller; this service never
faces the public internet. It mirrors the stub's request/response shapes exactly
(snake_case output per §3.1) and additionally accepts camelCase input so it works
against the current backend with no backend changes (see docs/INTEGRATION.md).

Endpoints:
    GET  /health   -> {"status": "ok", ...}
    POST /analyze  -> AnalysisResponse (feature_vector + suggestions)
"""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI

from muse_theory.config import load_config, resolve_device
from muse_theory.pipeline import Pipeline
from muse_theory.schema import AnalysisRequest, AnalysisResponse, FeatureVector

logging.basicConfig(
    level=os.environ.get("MUSE_LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
log = logging.getLogger("ai-service")

app = FastAPI(
    title="Muse Theory AI Service",
    description="Explainable on-device expressiveness analysis + vocal coaching.",
    version="1.0.0",
)

# Build the pipeline once at import; model/LLM load lazily on first request.
_config = load_config(os.environ.get("MUSE_CONFIG"))
_pipeline = Pipeline(_config)


@app.on_event("startup")
def _warmup() -> None:
    # Pay numba JIT + model/LLM load at startup so the first real request is fast.
    if os.environ.get("MUSE_SKIP_WARMUP") != "1":
        _pipeline.warmup()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": app.version,
        "device": resolve_device(_config.separation.device),
    }


@app.post("/analyze", response_model=AnalysisResponse)
def analyze(request: AnalysisRequest) -> AnalysisResponse:
    """Analyze one performance. Never raises on bad audio: on failure it returns
    a contract-valid response with null features and no suggestions."""
    log.info("Analyzing performance %s from %s", request.performance_id, request.audio_url)
    try:
        response = _pipeline.analyze(request)
    except Exception as exc:  # noqa: BLE001 - last-resort guard; keep the 200 contract
        log.exception("Unhandled analysis error for %s: %s", request.performance_id, exc)
        return AnalysisResponse(feature_vector=FeatureVector(), suggestions=[])

    log.info(
        "Done %s: %d/16 features populated, %d suggestions",
        request.performance_id,
        sum(1 for v in response.feature_vector.model_dump().values() if v is not None),
        len(response.suggestions),
    )
    return response
