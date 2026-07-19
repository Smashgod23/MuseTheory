"""Parsers for the three optional piece-context maps.

The backend passes these as JSON-encoded strings in the /analyze request. They
are NOT seeded anywhere in the production database, so this module defines their
schemas and is the authoritative documentation for them (also mirrored in
docs/INTEGRATION.md). Every parser is tolerant: malformed or missing input yields
an empty, well-formed object so the pipeline degrades gracefully instead of
failing the request.

----------------------------------------------------------------------------
repetition_map  — repeated / parallel material in the piece.
    {
      "time_signature": [4, 4],            # optional, defaults to 4/4
      "sections": [
        {"label": "A", "start_measure": 1,  "end_measure": 8},
        {"label": "A", "start_measure": 9,  "end_measure": 16},   # a repeat of A
        {"label": "B", "start_measure": 17, "end_measure": 24}
      ]
    }
  Sections that share a `label` are treated as repeated/parallel material and are
  compared against each other for expressive contrast.

harmonic_tension_map — harmonic tension over the piece, 0 (rest) .. 1 (max).
    {"points": [{"measure": 1, "tension": 0.1}, {"measure": 8, "tension": 0.8}]}
  Tension between listed measures is linearly interpolated.

text_stress_map — where linguistic / textual stress falls.
    {"stresses": [{"measure": 4, "beat": 1.0, "word": "when", "stress": 1.0}]}
  `beat` and `word` are optional; `stress` is 0..1 (defaults to 1.0).
----------------------------------------------------------------------------
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

log = logging.getLogger("muse_theory.context")


@dataclass
class Section:
    label: str
    start_measure: int
    end_measure: int


@dataclass
class RepetitionMap:
    sections: list[Section] = field(default_factory=list)
    time_signature: tuple[int, int] = (4, 4)

    @property
    def present(self) -> bool:
        return len(self.sections) > 0

    def repeated_groups(self) -> dict[str, list[Section]]:
        """Group sections by label, keeping only labels that occur more than once
        (i.e. genuinely repeated material)."""
        groups: dict[str, list[Section]] = {}
        for s in self.sections:
            groups.setdefault(s.label, []).append(s)
        return {k: v for k, v in groups.items() if len(v) > 1}


@dataclass
class TensionPoint:
    measure: float
    tension: float


@dataclass
class HarmonicTensionMap:
    points: list[TensionPoint] = field(default_factory=list)

    @property
    def present(self) -> bool:
        return len(self.points) > 0

    def tension_at(self, measure: float) -> float | None:
        """Linearly interpolate tension at a (possibly fractional) measure."""
        if not self.points:
            return None
        pts = sorted(self.points, key=lambda p: p.measure)
        if measure <= pts[0].measure:
            return pts[0].tension
        if measure >= pts[-1].measure:
            return pts[-1].tension
        for a, b in zip(pts, pts[1:]):
            if a.measure <= measure <= b.measure:
                span = b.measure - a.measure
                if span <= 0:
                    return a.tension
                t = (measure - a.measure) / span
                return a.tension + t * (b.tension - a.tension)
        return pts[-1].tension


@dataclass
class StressMark:
    measure: int
    beat: float | None = None
    word: str | None = None
    stress: float = 1.0


@dataclass
class TextStressMap:
    stresses: list[StressMark] = field(default_factory=list)

    @property
    def present(self) -> bool:
        return len(self.stresses) > 0


@dataclass
class PieceContext:
    """Everything we know about the piece, parsed and normalized."""

    repetition: RepetitionMap = field(default_factory=RepetitionMap)
    tension: HarmonicTensionMap = field(default_factory=HarmonicTensionMap)
    text_stress: TextStressMap = field(default_factory=TextStressMap)
    director_notes: str | None = None

    @property
    def time_signature(self) -> tuple[int, int]:
        return self.repetition.time_signature


def _loads(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        obj = json.loads(raw)
        return obj if isinstance(obj, dict) else None
    except (json.JSONDecodeError, TypeError) as exc:
        log.warning("Could not parse context map JSON: %s", exc)
        return None


def parse_repetition_map(raw: str | None) -> RepetitionMap:
    obj = _loads(raw)
    if not obj:
        return RepetitionMap()
    sections: list[Section] = []
    for s in obj.get("sections", []):
        try:
            sections.append(
                Section(
                    label=str(s["label"]),
                    start_measure=int(s["start_measure"]),
                    end_measure=int(s["end_measure"]),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    ts = obj.get("time_signature", [4, 4])
    try:
        time_sig = (int(ts[0]), int(ts[1]))
    except (TypeError, ValueError, IndexError):
        time_sig = (4, 4)
    return RepetitionMap(sections=sections, time_signature=time_sig)


def parse_harmonic_tension_map(raw: str | None) -> HarmonicTensionMap:
    obj = _loads(raw)
    if not obj:
        return HarmonicTensionMap()
    points: list[TensionPoint] = []
    for p in obj.get("points", []):
        try:
            points.append(
                TensionPoint(measure=float(p["measure"]), tension=float(p["tension"]))
            )
        except (KeyError, TypeError, ValueError):
            continue
    return HarmonicTensionMap(points=points)


def parse_text_stress_map(raw: str | None) -> TextStressMap:
    obj = _loads(raw)
    if not obj:
        return TextStressMap()
    marks: list[StressMark] = []
    for m in obj.get("stresses", []):
        try:
            marks.append(
                StressMark(
                    measure=int(m["measure"]),
                    beat=float(m["beat"]) if m.get("beat") is not None else None,
                    word=str(m["word"]) if m.get("word") is not None else None,
                    stress=float(m.get("stress", 1.0)),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return TextStressMap(stresses=marks)


def build_piece_context(
    repetition_map: str | None,
    harmonic_tension_map: str | None,
    text_stress_map: str | None,
    director_notes: str | None,
) -> PieceContext:
    """Parse all three maps + director notes into a single PieceContext."""
    return PieceContext(
        repetition=parse_repetition_map(repetition_map),
        tension=parse_harmonic_tension_map(harmonic_tension_map),
        text_stress=parse_text_stress_map(text_stress_map),
        director_notes=(director_notes or None),
    )
