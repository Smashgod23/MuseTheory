"""Deterministic, template-based realization of findings into coach-voice text.

This is both (a) the fallback when the on-device LLM is unavailable and (b) the
grounding skeleton the LLM rephrases. Every template is written to the §4 quality
bar: specific, interpretive (about expression, not the score's markings),
anchored to a moment, and phrased like a thoughtful section coach would say it.

Templates read ONLY from the finding's evidence, so the text can never assert a
musical fact that wasn't measured.
"""

from __future__ import annotations

from muse_theory.coaching.findings import Finding


def _measures(f: Finding) -> str:
    if f.measure_start and f.measure_end and f.measure_end != f.measure_start:
        return f"measures {f.measure_start}-{f.measure_end}"
    if f.measure_start:
        return f"measure {f.measure_start}"
    return "this passage"


def _flat_repeat_contrast(f: Finding) -> str:
    n = f.evidence.get("instances", 2)
    where = _measures(f)
    return (
        f"This is the {_ordinal(n)} time this material comes back, and all {n} passes "
        f"sit at almost the same intensity and color. Let the return at {where} become a "
        f"different emotional shade than the first time: pull the dynamic back and darken "
        f"the vowel so it reads as a reflection rather than a repeat, or push past the "
        f"earlier passes so the repetition builds instead of echoing."
    )


def _narrow_dynamic_range(f: Finding) -> str:
    db = f.evidence.get("dynamic_range_db")
    where = _measures(f)
    lead = f"Across {where}, " if f.measure_start else "Across the piece, "
    return (
        f"{lead}you stay within about {db:.0f} dB from softest to loudest, so the line "
        f"reads as one continuous level. Pick one phrase to drop to a real piano and one to "
        f"open into a genuine forte; the contrast between them is what gives the audience a "
        f"sense of arc, not the absolute volume."
    )


def _text_under_emphasis(f: Finding) -> str:
    word = f.evidence.get("word")
    where = _measures(f)
    w = f"the word \"{word}\"" if word else "this word"
    return (
        f"At {where}, {w} carries the weight of the line in the text, but musically it "
        f"passes by evenly. Try delaying its consonant by a hair and leaning into the vowel "
        f"so the word blooms into the beat, letting the meaning of the phrase land where the "
        f"language already wants it to."
    )


def _uniform_phrasing(f: Finding) -> str:
    n = f.evidence.get("phrase_count")
    return (
        f"Your {n} phrases are breathed in near-identical lengths, which makes the line feel "
        f"metronomic. Choose one long arc to carry straight through its breath so it stretches "
        f"over the bar line, and let a later phrase breathe early on purpose; varying where you "
        f"take air is what shapes a paragraph instead of a list of sentences."
    )


def _wide_vibrato(f: Finding) -> str:
    ext = f.evidence.get("vibrato_extent")
    return (
        f"The vibrato is running wide (about {ext:.1f} semitones), which softens the center of "
        f"the pitch on held notes. Anchor the core of the note first and let the vibrato spin "
        f"as decoration on top of it, narrowing it on the most important sustained words so the "
        f"pitch stays unambiguous."
    )


def _straight_tone(f: Finding) -> str:
    return (
        "Your sustained notes are sung with a straight tone throughout. That can be a powerful "
        "choice, but using it everywhere flattens the line. Pick the emotional peaks and let a "
        "warm vibrato bloom late into those held notes, saving the straight tone for moments you "
        "want to sound bare or suspended."
    )


def _flat_color_repeat(f: Finding) -> str:
    label = f.evidence.get("label")
    where = _measures(f)
    return (
        f"Section {label} comes back at {where} with the same vocal color each time. Reshape the "
        f"vowels on this return, brightening toward the front of the mouth or darkening into a "
        f"rounder space, so the listener hears a change of light even though the notes are the same."
    )


def _under_tension(f: Finding) -> str:
    m = f.evidence.get("measure")
    return (
        f"Measure {m} is a moment of real harmonic tension, but it is delivered as evenly as the "
        f"phrases around it. Lean into the dissonance here: grow through the chord rather than "
        f"sitting on it, and time your release so the resolution that follows feels earned."
    )


def _unstable_pitch_core(f: Finding) -> str:
    return (
        "On your sustained notes the pitch wanders around its center before it settles. Place the "
        "very start of each long note squarely in tune and keep that core steady; once the pitch "
        "is anchored you can shape dynamics and color around it freely without it sounding unsure."
    )


def _dynamics_stretch(f: Finding) -> str:
    return (
        "Your dynamic shaping is already working. To push it further, pick the one phrase "
        "that matters most and take it even softer than feels comfortable, then find a later "
        "moment to open even wider, so the distance between your softest and loudest grows "
        "into a real arc."
    )


def _color_stretch(f: Finding) -> str:
    label = f.evidence.get("label")
    where = _measures(f)
    return (
        f"Section {label} comes back around {where}. The notes are solid, so use the return as "
        f"a chance to change the light: reshape the vowels a little brighter or a little rounder "
        f"than the first time, and the repeat will feel like a new thought rather than the same one."
    )


def _phrasing_stretch(f: Finding) -> str:
    return (
        "Your phrasing flows evenly, which is a strong base to build on. For one phrase, carry the "
        "line a little longer before you breathe so it stretches across the bar, and let a later "
        "phrase breathe early on purpose; that small variation is what shapes a paragraph."
    )


def _timbre_stretch(f: Finding) -> str:
    return (
        "Your tone holds a fairly steady color throughout. Pick one phrase to deliberately brighten, "
        "lifting the vowel toward the front of the mouth, and another to round and darken; hearing the "
        "color change is what tells the listener the meaning has shifted, even when the notes have not."
    )


def _articulation_stretch(f: Finding) -> str:
    detached = (f.evidence.get("articulation_style") or 0) > 0.3
    if detached:
        return (
            "Your line is on the detached side. Choose one phrase to truly connect, carrying the sound "
            "straight from each note into the next so it reads as a single sweep rather than separate "
            "syllables, and save the detachment for a moment you want to feel pointed."
        )
    return (
        "Your line is smoothly connected, which is a strong default. On one phrase, try lifting cleanly "
        "off a note or two to give the shape some articulation, so the legato that surrounds it feels "
        "like a deliberate choice rather than the only option."
    )


def _vibrato_as_choice(f: Finding) -> str:
    return (
        "Your vibrato is steady and consistent. Try starting a couple of the most important sustained "
        "notes with a straight tone and letting the vibrato bloom in late; using it as a choice rather "
        "than a constant gives those notes a sense of growth and keeps it from sounding automatic."
    )


def _dull_tone(f: Finding) -> str:
    return (
        "Your tone is staying dark and covered through this passage, so the sound loses its "
        "ring. Lift the soft palate and bring the vowel forward toward the front of the mouth on "
        "the key words, aiming for a little more brightness in the 2-4 kHz band; that ring is what "
        "lets a voice carry without pushing."
    )


_TEMPLATES = {
    "dull_tone": _dull_tone,
    "dynamics_stretch": _dynamics_stretch,
    "color_stretch": _color_stretch,
    "phrasing_stretch": _phrasing_stretch,
    "timbre_stretch": _timbre_stretch,
    "articulation_stretch": _articulation_stretch,
    "vibrato_as_choice": _vibrato_as_choice,
    "flat_repeat_contrast": _flat_repeat_contrast,
    "narrow_dynamic_range": _narrow_dynamic_range,
    "text_under_emphasis": _text_under_emphasis,
    "uniform_phrasing": _uniform_phrasing,
    "wide_vibrato": _wide_vibrato,
    "straight_tone": _straight_tone,
    "flat_color_repeat": _flat_color_repeat,
    "under_tension": _under_tension,
    "unstable_pitch_core": _unstable_pitch_core,
}


def _ordinal(n: int) -> str:
    return {1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth"}.get(n, f"{n}th")


def render_template(finding: Finding) -> str:
    fn = _TEMPLATES.get(finding.kind)
    if fn is None:
        return finding.headline
    try:
        return fn(finding)
    except Exception:  # noqa: BLE001 - never let a template formatting error escape
        return finding.headline
