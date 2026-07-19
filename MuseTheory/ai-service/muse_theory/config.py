"""Configuration loading + global seeding.

A single `Config` object (a thin dict wrapper with dotted access) is threaded
through the pipeline. `load_config()` reads configs/default.yaml unless an
override path is given. `seed_everything()` makes a run reproducible.
"""

from __future__ import annotations

import os
import random
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = REPO_ROOT / "configs" / "default.yaml"


class Config(dict):
    """Dict with attribute access and a dotted `.get_path('a.b.c')` helper."""

    def __getattr__(self, name: str) -> Any:
        try:
            value = self[name]
        except KeyError as exc:  # pragma: no cover - defensive
            raise AttributeError(name) from exc
        if isinstance(value, dict) and not isinstance(value, Config):
            value = Config(value)
            self[name] = value
        return value

    def get_path(self, dotted: str, default: Any = None) -> Any:
        node: Any = self
        for part in dotted.split("."):
            if not isinstance(node, dict) or part not in node:
                return default
            node = node[part]
        return node


def load_config(path: str | os.PathLike[str] | None = None) -> Config:
    cfg_path = Path(path) if path else DEFAULT_CONFIG_PATH
    with open(cfg_path, "r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}
    return Config(raw)


def seed_everything(seed: int) -> None:
    """Seed every RNG we might touch. torch is seeded lazily if installed."""
    random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    try:
        import numpy as np

        np.random.seed(seed)
    except Exception:  # pragma: no cover
        pass
    try:
        import torch

        torch.manual_seed(seed)
        if torch.backends.mps.is_available():
            torch.mps.manual_seed(seed)
    except Exception:  # pragma: no cover - torch optional at import time
        pass


def resolve_device(preference: str = "auto") -> str:
    """Resolve a torch device string for Apple Silicon. Never returns cuda."""
    if preference and preference != "auto":
        return preference
    try:
        import torch

        if torch.backends.mps.is_available():
            return "mps"
    except Exception:  # pragma: no cover
        pass
    return "cpu"
