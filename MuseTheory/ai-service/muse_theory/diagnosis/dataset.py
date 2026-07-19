"""Generate the self-supervised diagnosis dataset.

For each source recording we cut a few windows, and for each window we emit:
  - one CLEAN example (all deficit severities = 0), and
  - several PERTURBED examples, each with a random 1-2 deficits at random severity.

The features come from the real pipeline analyzer; the labels are exactly the
severities we injected. Held-out evaluation is grouped by source clip, so the
model is tested on singers it never saw.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from muse_theory.context.maps import build_piece_context
from muse_theory.diagnosis import perturb
from muse_theory.diagnosis.features import FEATURE_NAMES, analysis_to_vector
from muse_theory.features.extract import analyze_audio

log = logging.getLogger("muse_theory.diagnosis.dataset")

_EMPTY_CTX = build_piece_context(None, None, None, None)


@dataclass
class DatasetConfig:
    window_seconds: float = 6.0
    hop_seconds: float = 4.0
    max_windows: int = 4
    perturbed_per_window: int = 4
    max_combo: int = 2          # up to this many deficits at once
    min_severity: float = 0.35
    max_severity: float = 1.0


@dataclass
class Built:
    X: np.ndarray = field(default_factory=lambda: np.empty((0,)))
    Y: np.ndarray = field(default_factory=lambda: np.empty((0,)))
    groups: list[str] = field(default_factory=list)


def _windows(y: np.ndarray, sr: int, dc: DatasetConfig) -> list[np.ndarray]:
    win = int(dc.window_seconds * sr)
    hop = int(dc.hop_seconds * sr)
    if len(y) <= win:
        return [y]
    starts = list(range(0, len(y) - win + 1, hop))[: dc.max_windows]
    return [y[s : s + win] for s in starts]


def _feature_vector(sig: np.ndarray, sr: int, cfg) -> np.ndarray:
    analysis = analyze_audio(sig.astype(np.float32), sr, _EMPTY_CTX, cfg)
    return analysis_to_vector(analysis)


def _random_severities(rng, dc: DatasetConfig) -> dict[str, float]:
    k = int(rng.integers(1, dc.max_combo + 1))
    chosen = rng.choice(perturb.DEFICITS, size=k, replace=False)
    return {d: float(rng.uniform(dc.min_severity, dc.max_severity)) for d in chosen}


def build(audio_paths: list[Path], cfg, dc: DatasetConfig, seed: int = 1729) -> Built:
    import librosa

    rng = np.random.default_rng(seed)
    X_rows: list[np.ndarray] = []
    Y_rows: list[np.ndarray] = []
    groups: list[str] = []
    n_fail = 0

    for idx, path in enumerate(audio_paths, 1):
        try:
            y, sr = librosa.load(str(path), sr=int(cfg.audio.working_sr), mono=True)
        except Exception as exc:  # noqa: BLE001
            log.warning("skip %s: %s", path.name, exc)
            continue
        y = y / (np.max(np.abs(y)) + 1e-9) * 0.97
        for win in _windows(y, sr, dc):
            if win.size < int(2.0 * sr):
                continue
            # clean
            X_rows.append(_feature_vector(win, sr, cfg))
            Y_rows.append(np.zeros(len(perturb.DEFICITS), dtype=np.float32))
            groups.append(path.stem)
            # perturbed
            for _ in range(dc.perturbed_per_window):
                sev = _random_severities(rng, dc)
                try:
                    bad = perturb.apply(win, sr, sev, rng)
                except perturb.PerturbationError:
                    n_fail += 1
                    continue
                X_rows.append(_feature_vector(bad, sr, cfg))
                Y_rows.append(
                    np.array([sev.get(d, 0.0) for d in perturb.DEFICITS], dtype=np.float32)
                )
                groups.append(path.stem)
        if idx % 5 == 0:
            log.info("processed %d/%d clips, %d examples", idx, len(audio_paths), len(X_rows))

    log.info("Built %d examples (%d perturbation failures skipped)", len(X_rows), n_fail)
    return Built(
        X=np.vstack(X_rows) if X_rows else np.empty((0, len(FEATURE_NAMES))),
        Y=np.vstack(Y_rows) if Y_rows else np.empty((0, len(perturb.DEFICITS))),
        groups=groups,
    )
