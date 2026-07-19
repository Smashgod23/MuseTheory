"""Voice parts and per-part vocal-technique knowledge.

A note that helps a Bass 2 is not phrased the way it should be for a Soprano 1:
the breath concerns, the register shifts, and the tricky parts of the range all
differ. This module supplies (a) the four SATB parts with their ranges (matching
the production database seed) plus the finer subparts, (b) a way to determine a
singer's part either from an explicit profile string or by estimating it from the
recording's pitch range, and (c) a short technique brief per part that the
coaching LLM uses to phrase suggestions in part-appropriate language.

The briefs are general vocal-pedagogy guidance, NOT claimed measurements. The LLM
is still forbidden from asserting any measured fact (measure numbers, words,
specific pitches) that is not in the finding; the part brief only shapes wording.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

# Note frequencies (Hz) for the SATB ranges seeded in the production DB.
_C4, _C6 = 261.63, 1046.50
_F3, _F5 = 174.61, 698.46
_C3, _C5 = 130.81, 523.25
_E2, _E4 = 82.41, 329.63

# part -> (low_hz, high_hz, technique brief)
_PARTS: dict[str, tuple[float, float, str]] = {
    "Soprano": (
        _C4, _C6,
        "Soprano is the highest voice and lives mostly in head voice. The upper "
        "passaggio sits around E5 to F#5; above the staff, migrate vowels toward more "
        "open or rounded shapes to keep the ring and avoid spreading or shrillness. "
        "Pace the breath on long high phrases and give the top notes space instead of "
        "pushing into them.",
    ),
    "Alto": (
        _F3, _F5,
        "Alto is the lower female voice, with a rich middle and a strong chest-to-head "
        "blend. The lower passaggio sits around E4 to F#4; carry warmth across it without "
        "pressing chest voice too high or swallowing the tone. The low notes want forward "
        "resonance rather than weight.",
    ),
    "Tenor": (
        _C3, _C5,
        "Tenor is the high male voice, and its passaggio (the break) sits around D4 to "
        "F4. Cover and modify vowels through that zone to avoid cracking or shouting, and "
        "keep the ring of the singer's formant. Sustained top notes need steady breath "
        "support and openness, not push.",
    ),
    "Bass": (
        _E2, _E4,
        "Bass is the lowest voice, rich in chest-voice low range, with a passaggio around "
        "A3 to C4. The low sustained notes need real breath support and forward resonance "
        "so they stay ringing rather than going woofy or swallowed. The top of the range "
        "wants space and openness.",
    ),
}

_NAME_PREFIXES = [
    ("sop", "Soprano"), ("mezzo", "Alto"), ("alt", "Alto"),
    ("ten", "Tenor"), ("bari", "Bass"), ("bass", "Bass"),
]
_LETTER = {"s": "Soprano", "a": "Alto", "t": "Tenor", "b": "Bass"}


@dataclass(frozen=True)
class VoicePart:
    name: str               # canonical SATB: Soprano | Alto | Tenor | Bass
    low_hz: float
    high_hz: float
    subpart: int | None = None   # 1 (higher tessitura) or 2 (lower), if known
    inferred: bool = False       # True when estimated from audio, not given

    @property
    def display(self) -> str:
        return f"{self.name} {self.subpart}" if self.subpart else self.name

    @property
    def center_hz(self) -> float:
        return math.sqrt(self.low_hz * self.high_hz)


def _make(name: str, subpart: int | None, inferred: bool = False) -> VoicePart:
    low, high, _ = _PARTS[name]
    return VoicePart(name=name, low_hz=low, high_hz=high, subpart=subpart, inferred=inferred)


def part_from_name(raw: str | None) -> VoicePart | None:
    """Parse a profile string like 'Bass 2', 'Soprano Voice', 'T1', 'mezzo' into a
    VoicePart. Returns None if it can't be recognized."""
    if not raw:
        return None
    s = raw.strip().lower()
    name = next((canon for pre, canon in _NAME_PREFIXES if s.startswith(pre)), None)
    # Single-letter code (e.g. "S", "B2") only when the string is genuinely a code,
    # not any longer word that happens to start with s/a/t/b ("section a").
    if name is None and len(s) <= 2 and s[0] in _LETTER:
        name = _LETTER[s[0]]
    if name is None:
        return None
    m = re.search(r"[^0-9]?([12])\b", s)  # a trailing 1/2 -> subpart
    subpart = int(m.group(1)) if m else None
    return _make(name, subpart)


def infer_part(median_hz: float | None, low_hz: float | None = None,
               high_hz: float | None = None) -> VoicePart | None:
    """Estimate the SATB part from a recording's pitch, by nearest range center in
    log-frequency. This is a best-effort fallback (one clip rarely shows the full
    range), so the result is marked `inferred` and carries no subpart."""
    if not median_hz or median_hz <= 0:
        return None
    target = math.log(median_hz)
    best = min(_PARTS, key=lambda n: abs(math.log(math.sqrt(_PARTS[n][0] * _PARTS[n][1])) - target))
    return _make(best, subpart=None, inferred=True)


def technique_brief(part: VoicePart | None) -> str | None:
    """Part-appropriate technique context for the coaching LLM."""
    if part is None:
        return None
    brief = _PARTS[part.name][2]
    if part.subpart == 1:
        brief += (f" As a {part.name} 1, this singer sits toward the higher, brighter end "
                  f"of the section, so the upper passaggio and vowels on top matter more.")
    elif part.subpart == 2:
        brief += (f" As a {part.name} 2, this singer sits toward the lower end of the "
                  f"section, so low-range resonance and support carry more of the weight.")
    return brief
