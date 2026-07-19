"""The learned diagnosis head.

Multi-output gradient-boosted regressor: features -> per-deficit severity in
[0, 1]. Gradient boosting handles the NaN-where-unavailable features natively and
captures the feature interactions that let it disentangle overlapping deficits
(e.g. intonation jitter also inflates measured vibrato). This is the model that
replaces the hand-tuned coaching thresholds with something calibrated on
thousands of known examples.
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from muse_theory.diagnosis.features import FEATURE_NAMES, analysis_to_vector
from muse_theory.diagnosis.perturb import DEFICITS

log = logging.getLogger("muse_theory.diagnosis.model")


class DiagnosisModel:
    def __init__(self, regressor, feature_names=FEATURE_NAMES, deficits=DEFICITS, metrics=None):
        self.regressor = regressor
        self.feature_names = tuple(feature_names)
        self.deficits = tuple(deficits)
        # Per-deficit held-out metrics, e.g. {"flat_dynamics": {"auc": 0.95, ...}}.
        self.metrics = metrics or {}

    def reliable_deficits(self, auc_bar: float = 0.75) -> set[str]:
        """Deficits the model detects well enough to drive coaching. If no metrics
        were stored, trust all (caller's risk)."""
        if not self.metrics:
            return set(self.deficits)
        return {d for d in self.deficits
                if self.metrics.get(d, {}).get("auc", 1.0) >= auc_bar}

    @classmethod
    def fit(cls, X: np.ndarray, Y: np.ndarray, seed: int = 1729) -> "DiagnosisModel":
        from sklearn.ensemble import HistGradientBoostingRegressor
        from sklearn.multioutput import MultiOutputRegressor

        base = HistGradientBoostingRegressor(
            max_depth=3, learning_rate=0.08, max_iter=300,
            l2_regularization=1.0, random_state=seed,
        )
        reg = MultiOutputRegressor(base)
        reg.fit(X, Y)
        return cls(reg)

    def predict_vector(self, vec: np.ndarray) -> dict[str, float]:
        pred = self.regressor.predict(vec.reshape(1, -1))[0]
        return {d: float(np.clip(p, 0.0, 1.0)) for d, p in zip(self.deficits, pred)}

    def predict(self, analysis) -> dict[str, float]:
        """Diagnose expressive deficits straight from an Analysis object."""
        return self.predict_vector(analysis_to_vector(analysis))

    def save(self, path: str | Path) -> None:
        import joblib

        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {"regressor": self.regressor, "feature_names": self.feature_names,
             "deficits": self.deficits, "metrics": self.metrics}, path,
        )

    @classmethod
    def load_if_available(cls, path: str | Path) -> "DiagnosisModel | None":
        import joblib

        p = Path(path)
        if not p.exists():
            return None
        try:
            b = joblib.load(p)
            return cls(b["regressor"], b["feature_names"], b["deficits"], b.get("metrics"))
        except Exception as exc:  # noqa: BLE001
            log.warning("Could not load diagnosis model (%s)", exc)
            return None
