"""Expressiveness model: MERT embedding -> 5 SongEval aesthetic dimensions.

A lightweight scikit-learn regressor on top of frozen MERT embeddings. Keeping
the head small and the backbone frozen is a deliberate choice (decision record):
it trains in seconds on Apple Silicon, is reproducible, needs little data, and —
because the input embedding and the regressor coefficients are inspectable — keeps
the system explainable rather than a black box.

The model is OPTIONAL. `load_if_available` returns None when artifacts are absent,
and the pipeline then runs on signal features + template coaching alone. When
present, `predict` returns each dimension scaled to roughly [1, 5]; the coaching
layer uses the weak dimensions (esp. naturalness, musicality) to prioritize and
score suggestions.
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from muse_theory.model.datasource import DIMENSIONS

log = logging.getLogger("muse_theory.model")


class ExpressivenessModel:
    def __init__(self, regressor, scaler, embedder, dimensions=DIMENSIONS):
        self.regressor = regressor
        self.scaler = scaler
        self.embedder = embedder
        self.dimensions = tuple(dimensions)

    @classmethod
    def load_if_available(cls, cfg) -> "ExpressivenessModel | None":
        import joblib

        reg_path = Path(cfg.model.regressor_path)
        scaler_path = Path(cfg.model.scaler_path)
        if not reg_path.exists() or not scaler_path.exists():
            log.info("No trained expressiveness regressor at %s; skipping model.", reg_path)
            return None
        try:
            bundle = joblib.load(reg_path)
            scaler = joblib.load(scaler_path)
            from muse_theory.model.mert import MERTEmbedder

            embedder = MERTEmbedder(cfg.model.mert_id)
            return cls(
                regressor=bundle["regressor"],
                scaler=scaler,
                embedder=embedder,
                dimensions=bundle.get("dimensions", DIMENSIONS),
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("Failed to load expressiveness model (%s); skipping.", exc)
            return None

    def predict(self, samples: np.ndarray, sr: int) -> dict[str, float]:
        emb = self.embedder.embed(samples, sr).reshape(1, -1)
        emb = self.scaler.transform(emb)
        pred = self.regressor.predict(emb)[0]
        return {
            dim: float(np.clip(val, 1.0, 5.0))
            for dim, val in zip(self.dimensions, pred)
        }
