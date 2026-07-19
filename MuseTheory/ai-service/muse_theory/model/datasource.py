"""Training data sources for the expressiveness model.

This is the deliberate license-isolation boundary (brief §6). The training code
depends only on the abstract `RatingDataSource` interface, so swapping SongEval
(CC-BY-NC-SA, research only) for a commercial-safe source (the CC-BY choir
datasets + the owner's own recordings) is a one-class change with no edits to
extract_features.py / train_regressor.py.

A source yields (audio_path, ratings) where ratings maps each of the five
SongEval dimensions to a mean score in [1, 5].
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

# Canonical dimension order shared by the data sources, the regressor, and the
# config. SongEval's JSON keys are capitalized; we normalize to these slugs.
DIMENSIONS = ("coherence", "musicality", "memorability", "clarity", "naturalness")
_SONGEVAL_KEYS = {
    "coherence": "Coherence",
    "musicality": "Musicality",
    "memorability": "Memorability",
    "clarity": "Clarity",
    "naturalness": "Naturalness",
}


@dataclass
class RatedSample:
    audio_path: Path
    ratings: dict[str, float]  # dimension slug -> mean score in [1, 5]


class RatingDataSource:
    """Interface every training data source implements."""

    def __iter__(self) -> Iterator[RatedSample]:  # pragma: no cover - interface
        raise NotImplementedError

    def __len__(self) -> int:  # pragma: no cover - interface
        raise NotImplementedError


class SongEvalDataSource(RatingDataSource):
    """Reads the SongEval download (metadata.jsonl + mp3/). Averages annotators."""

    def __init__(self, root: str | Path, limit: int | None = None):
        self.root = Path(root)
        self.meta_path = self.root / "metadata.jsonl"
        if not self.meta_path.exists():
            raise FileNotFoundError(
                f"SongEval metadata not found at {self.meta_path}. "
                f"Run: python -m training.download_songeval --dest {self.root}"
            )
        rows = [json.loads(ln) for ln in self.meta_path.read_text().splitlines() if ln.strip()]
        self._samples: list[RatedSample] = []
        for row in rows:
            audio = self.root / row["file_name"]
            if not audio.exists():
                continue
            ratings = self._mean_ratings(row.get("annotation", []))
            if ratings:
                self._samples.append(RatedSample(audio_path=audio, ratings=ratings))
        if limit is not None:
            self._samples = self._samples[:limit]

    @staticmethod
    def _mean_ratings(annotations: list[dict]) -> dict[str, float]:
        out: dict[str, float] = {}
        for slug, key in _SONGEVAL_KEYS.items():
            vals = [a[key] for a in annotations if key in a and a[key] is not None]
            if vals:
                out[slug] = float(sum(vals) / len(vals))
        return out if len(out) == len(DIMENSIONS) else {}

    def __iter__(self) -> Iterator[RatedSample]:
        return iter(self._samples)

    def __len__(self) -> int:
        return len(self._samples)
