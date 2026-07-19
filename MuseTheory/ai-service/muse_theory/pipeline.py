"""End-to-end analysis pipeline.

    audio_url -> ingest -> (conditional) vocal separation -> feature extraction
    -> (optional) expressiveness model -> coaching suggestions -> AnalysisResponse

The whole thing is defensive: any stage may fail or be skipped, and the worst
case is a contract-valid response with null features and no suggestions rather
than a 500. The expressiveness model and the on-device LLM are both optional;
when absent the pipeline still returns real signal features and template-based
coaching.
"""

from __future__ import annotations

import logging
import os

from muse_theory.coaching.realize import generate_suggestions
from muse_theory.config import Config, load_config, seed_everything
from muse_theory.context.maps import build_piece_context
from muse_theory.features.extract import analyze_audio
from muse_theory.ingest.audio import AudioIngestError, load_audio
from muse_theory.schema import AnalysisRequest, AnalysisResponse, FeatureVector
from muse_theory.separation.separator import separate_vocals

log = logging.getLogger("muse_theory.pipeline")


class Pipeline:
    def __init__(self, config: Config | None = None):
        self.cfg = config or load_config()
        self._model = None
        self._model_loaded = False
        self._diagnosis = None
        self._diagnosis_loaded = False
        # Optional host allowlist for audio fetches (SSRF defense-in-depth).
        raw_hosts = os.environ.get("MUSE_ALLOWED_AUDIO_HOSTS", "").strip()
        self._allowed_hosts = (
            {h.strip() for h in raw_hosts.split(",") if h.strip()} or None
        )

    # -- expressiveness model (optional, lazily loaded) --------------------
    def _get_model(self):
        if self._model_loaded:
            return self._model
        self._model_loaded = True
        if not self.cfg.model.enabled:
            return None
        try:
            from muse_theory.model.expressiveness import ExpressivenessModel

            self._model = ExpressivenessModel.load_if_available(self.cfg)
            if self._model is not None:
                log.info("Expressiveness model loaded.")
        except Exception as exc:  # noqa: BLE001 - model is optional
            log.info("Expressiveness model unavailable (%s)", exc)
            self._model = None
        return self._model

    # -- learned diagnosis model (optional, lazily loaded) -----------------
    def _get_diagnosis(self):
        if self._diagnosis_loaded:
            return self._diagnosis
        self._diagnosis_loaded = True
        if not bool(self.cfg.get_path("diagnosis.enabled", False)):
            return None
        try:
            from muse_theory.diagnosis.model import DiagnosisModel

            path = self.cfg.get_path("diagnosis.model_path", "artifacts/diagnosis_model.joblib")
            self._diagnosis = DiagnosisModel.load_if_available(path)
            if self._diagnosis is not None:
                log.info("Diagnosis model loaded.")
        except Exception as exc:  # noqa: BLE001 - optional
            log.info("Diagnosis model unavailable (%s)", exc)
            self._diagnosis = None
        return self._diagnosis

    def warmup(self) -> None:
        """Run a tiny synthetic clip through feature extraction to pay the numba
        JIT compilation cost once, at startup, instead of on the first real
        request. Safe to call repeatedly; failures are swallowed."""
        try:
            import numpy as np

            sr = int(self.cfg.audio.working_sr)
            t = np.arange(int(1.5 * sr)) / sr
            tone = (0.2 * np.sin(2 * np.pi * 220.0 * t)).astype(np.float32)
            context = build_piece_context(None, None, None, None)
            analyze_audio(tone, sr, context, self.cfg)
            log.info("Pipeline warmup complete.")
        except Exception as exc:  # noqa: BLE001
            log.info("Pipeline warmup skipped: %s", exc)

    def analyze(self, request: AnalysisRequest) -> AnalysisResponse:
        seed_everything(int(self.cfg.seed))
        empty = AnalysisResponse(feature_vector=FeatureVector(), suggestions=[])

        # 1. Ingest
        try:
            clip = load_audio(
                request.audio_url,
                target_sr=int(self.cfg.audio.working_sr),
                mono=bool(self.cfg.audio.mono),
                max_seconds=float(self.cfg.audio.max_seconds),
                max_download_mb=float(self.cfg.get_path("ingest.max_download_mb", 80.0)),
                allowed_hosts=self._allowed_hosts,
                block_link_local=bool(self.cfg.get_path("ingest.block_link_local_ips", True)),
            )
        except AudioIngestError as exc:
            log.warning("Ingest failed for %s: %s", request.performance_id, exc)
            return empty

        if clip.duration < float(self.cfg.audio.min_seconds):
            log.info("Clip %s too short (%.2fs); returning nulls", request.performance_id, clip.duration)
            return empty

        context = build_piece_context(
            request.repetition_map,
            request.harmonic_tension_map,
            request.text_stress_map,
            request.director_notes,
        )

        # 2. Conditional vocal separation
        sep = separate_vocals(clip.samples, clip.sr, self.cfg)
        log.info(
            "Performance %s: separation applied=%s (accompaniment_ratio=%.2f, %s)",
            request.performance_id, sep.applied, sep.accompaniment_ratio, sep.note,
        )

        # 3. Feature extraction
        analysis = analyze_audio(sep.vocals, sep.sr, context, self.cfg)
        analysis.separation_applied = sep.applied

        # 4. Optional expressiveness model -> dimension scores
        dimension_scores = None
        model = self._get_model()
        if model is not None:
            try:
                dimension_scores = model.predict(sep.vocals, sep.sr)
            except Exception as exc:  # noqa: BLE001
                log.warning("Expressiveness inference failed: %s", exc)

        # 5. Learned expressive-deficit diagnosis (optional) -> drives coaching
        deficit_severities = None
        diagnosis = self._get_diagnosis()
        if diagnosis is not None:
            try:
                preds = diagnosis.predict(analysis)
                # Only let deficits the model detects reliably drive coaching.
                reliable = diagnosis.reliable_deficits()
                deficit_severities = {k: v for k, v in preds.items() if k in reliable}
            except Exception as exc:  # noqa: BLE001
                log.warning("Diagnosis inference failed: %s", exc)

        # 5b. Determine the singer's voice part: explicit from the request when the
        # backend sends it, otherwise estimated from the recording's pitch range.
        voice_part = None
        if bool(self.cfg.get_path("coaching.personalize_voice_part", True)):
            from muse_theory.voice.parts import infer_part, part_from_name

            voice_part = part_from_name(request.voice_part)
            if voice_part is None:
                voice_part = infer_part(
                    analysis.pitch_mean, analysis.pitch_low_hz, analysis.pitch_high_hz
                )
            if voice_part is not None:
                log.info("Voice part: %s (%s)", voice_part.display,
                         "inferred" if voice_part.inferred else "from request")

        # 6. Coaching
        try:
            suggestions = generate_suggestions(
                analysis, context, dimension_scores, self.cfg,
                deficit_severities=deficit_severities, voice_part=voice_part,
                user_baseline=request.user_baseline, baseline_takes=request.baseline_takes or 0,
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("Suggestion generation failed: %s", exc)
            suggestions = []

        return AnalysisResponse(
            feature_vector=analysis.to_feature_vector(),
            suggestions=suggestions,
        )
