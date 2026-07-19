"""Finding generators — the symbolic half of the neuro-symbolic coach.

Each generator inspects the `Analysis` (interpretable features + structural
evidence) plus, when available, the learned expressiveness dimension scores, and
emits zero or more `Finding`s. A Finding is a structured, measure-anchored
coaching opportunity with the concrete evidence behind it. The realizer
(templates or the on-device LLM) only ever turns a Finding into prose — it never
invents the musical facts. That separation is what makes every suggestion
explainable and traceable back to a measurement (brief §4, §7 decision record).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class Finding:
    kind: str                       # selects the template / grounds the LLM
    feature_targeted: str           # a §3.2 feature name or expressive dimension
    salience: float                 # 0..1 importance (drives ranking + score)
    headline: str                   # one-line structured statement of the issue
    evidence: dict[str, Any] = field(default_factory=dict)
    measure_start: Optional[int] = None
    measure_end: Optional[int] = None

    @property
    def musicality_score(self) -> float:
        # Lower current quality (higher salience) => bigger opportunity. Reported
        # on the 1-10 scale the contract uses for `musicality_score`.
        return round(max(1.0, min(10.0, 9.0 - 7.0 * self.salience)), 1)


def _dim(scores: dict[str, float] | None, name: str) -> float | None:
    if not scores:
        return None
    return scores.get(name)


def contrast_findings(analysis, scores) -> list[Finding]:
    cs = analysis.contrast_score
    if cs is None or analysis.contrast_source not in ("repetition_map", "self_similar"):
        return []
    out: list[Finding] = []
    # Find the repeated group whose instances are most alike (lowest internal
    # variation) and anchor to its instances.
    for label, instances in analysis.section_instances.items():
        if len(instances) < 2:
            continue
        if cs < 0.35:  # repeats performed near-identically
            first, last = instances[0], instances[-1]
            out.append(
                Finding(
                    kind="flat_repeat_contrast",
                    feature_targeted="contrast_score",
                    salience=float(min(1.0, (0.35 - cs) / 0.35 + 0.4)),
                    headline=(
                        f"Section '{label}' returns {len(instances)} times and all "
                        f"iterations are expressively very similar (contrast={cs:.2f})."
                    ),
                    evidence={
                        "label": label,
                        "instances": len(instances),
                        "contrast_score": round(cs, 3),
                        "first_mean_db": round(first.get("mean_db", 0.0), 1),
                        "last_mean_db": round(last.get("mean_db", 0.0), 1),
                    },
                    measure_start=last.get("start_measure"),
                    measure_end=last.get("end_measure"),
                )
            )
            break
    return out


def dynamics_findings(analysis, scores) -> list[Finding]:
    dr = analysis.dynamic_range
    if dr is None:
        return []
    out: list[Finding] = []
    if dr < 12.0:  # narrow dynamic spread (dB)
        ms = me = None
        if analysis.loud_measures and analysis.soft_measures:
            ms, me = min(analysis.soft_measures), max(analysis.soft_measures)
        out.append(
            Finding(
                kind="narrow_dynamic_range",
                feature_targeted="dynamic_range",
                salience=float(min(1.0, (12.0 - dr) / 12.0 + 0.3)),
                headline=f"The overall dynamic range is narrow (~{dr:.0f} dB); the line stays at one level.",
                evidence={"dynamic_range_db": round(dr, 1)},
                measure_start=ms,
                measure_end=me,
            )
        )
    return out


def text_music_findings(analysis, scores) -> list[Finding]:
    out: list[Finding] = []
    # Most under-emphasized stressed word: text wants stress, music is flat there.
    candidates = [s for s in analysis.stress_alignment if s.get("gap", 0.0) <= -0.35]
    candidates.sort(key=lambda s: s["gap"])  # most negative first
    for s in candidates[:2]:
        word = s.get("word")
        out.append(
            Finding(
                kind="text_under_emphasis",
                feature_targeted="text_music_alignment",
                salience=float(min(1.0, -s["gap"])),
                headline=(
                    f"The word{' ' + repr(word) if word else ''} carries strong textual "
                    f"stress but lands on a musically flat moment (gap={s['gap']:.2f})."
                ),
                evidence=s,
                measure_start=s.get("measure"),
                measure_end=s.get("measure"),
            )
        )
    return out


def phrasing_findings(analysis, scores) -> list[Finding]:
    plv = analysis.phrase_length_variance
    naturalness = _dim(scores, "naturalness")
    out: list[Finding] = []
    if plv is not None and plv < 0.4 and len(analysis.phrase_lengths) >= 3:
        salience = 0.5 if naturalness is None else min(1.0, 0.4 + (4.0 - naturalness) / 4.0)
        out.append(
            Finding(
                kind="uniform_phrasing",
                feature_targeted="phrase_length_variance",
                salience=float(salience),
                headline=(
                    f"Phrases are cut to near-uniform lengths (std={plv:.2f}s across "
                    f"{len(analysis.phrase_lengths)} phrases); breathing feels metronomic."
                ),
                evidence={
                    "phrase_count": len(analysis.phrase_lengths),
                    "std_seconds": round(plv, 2),
                    "breath_measures": analysis.breath_placement or [],
                },
            )
        )
    return out


def vibrato_findings(analysis, scores) -> list[Finding]:
    out: list[Finding] = []
    rate, extent = analysis.vibrato_rate, analysis.vibrato_extent
    if (analysis.voiced_ratio or 0) < 0.3:
        return out
    # Normal sung vibrato is ~1-2 semitones peak-to-peak; only flag genuinely wide
    # vibrato (calibrated on real solo singing, where 1.3-2.0 ST is typical).
    if extent is not None and extent > 2.4:
        out.append(
            Finding(
                kind="wide_vibrato",
                feature_targeted="vibrato_extent",
                salience=float(min(1.0, (extent - 2.4) / 1.0 + 0.3)),
                headline=f"Vibrato is wide (~{extent:.2f} semitones) and may blur the pitch center.",
                evidence={"vibrato_extent": round(extent, 2), "vibrato_rate": rate},
            )
        )
    elif analysis.vibrato_note_count == 0 and (analysis.voiced_ratio or 0) > 0.5:
        out.append(
            Finding(
                kind="straight_tone",
                feature_targeted="vibrato_rate",
                salience=0.45,
                headline="Sustained notes are sung with little or no vibrato (straight tone throughout).",
                evidence={"vibrato_note_count": 0},
            )
        )
    return out


def color_findings(analysis, scores) -> list[Finding]:
    """Timbral color contrast across repeated sections."""
    out: list[Finding] = []
    for label, instances in analysis.section_instances.items():
        if len(instances) < 2:
            continue
        centroids = [i.get("centroid", 0.0) for i in instances if i.get("centroid")]
        if len(centroids) >= 2:
            spread = max(centroids) - min(centroids)
            mean_c = sum(centroids) / len(centroids)
            if mean_c > 0 and spread / mean_c < 0.06:  # nearly identical brightness
                last = instances[-1]
                out.append(
                    Finding(
                        kind="flat_color_repeat",
                        feature_targeted="spectral_centroid_mean",
                        salience=0.4,
                        headline=(
                            f"Section '{label}' keeps the same vocal color on every return "
                            f"(brightness spread {spread/mean_c*100:.0f}%)."
                        ),
                        evidence={"label": label, "centroid_spread_pct": round(spread / mean_c * 100, 1)},
                        measure_start=last.get("start_measure"),
                        measure_end=last.get("end_measure"),
                    )
                )
                break
    return out


def tension_findings(analysis, scores) -> list[Finding]:
    out: list[Finding] = []
    # Where the score expects high tension but the performance stays neutral.
    mismatches = [
        t for t in analysis.tension_alignment
        if t["expected"] >= 0.6 and (t["expected"] - t["measured"]) >= 0.25
    ]
    mismatches.sort(key=lambda t: t["expected"] - t["measured"], reverse=True)
    if mismatches:
        t = mismatches[0]
        out.append(
            Finding(
                kind="under_tension",
                feature_targeted="harmonic_deviation",
                salience=float(min(1.0, (t["expected"] - t["measured"]))),
                headline=(
                    f"Measure {t['measure']} sits at a point of high harmonic tension "
                    f"(expected {t['expected']:.2f}) but is delivered evenly."
                ),
                evidence=t,
                measure_start=t["measure"],
                measure_end=t["measure"],
            )
        )
    return out


def pitch_findings(analysis, scores) -> list[Finding]:
    out: list[Finding] = []
    ps = analysis.pitch_stability
    if ps is not None and ps < 0.55 and (analysis.voiced_ratio or 0) > 0.4:
        out.append(
            Finding(
                kind="unstable_pitch_core",
                feature_targeted="pitch_stability",
                salience=float(min(0.8, (0.55 - ps) / 0.55 + 0.25)),
                headline=f"Sustained pitches waver around their center (stability={ps:.2f}).",
                evidence={"pitch_stability": round(ps, 2)},
            )
        )
    return out


# Generators NOT covered by the learned diagnosis model.
_STRUCTURAL_GENERATORS = (
    contrast_findings,
    text_music_findings,
    phrasing_findings,
    color_findings,
    tension_findings,
)
# Hand-threshold generators for the four deficits the learned model also covers.
# Used only when no diagnosis model is available (fallback).
_HAND_DEFICIT_GENERATORS = (
    dynamics_findings,
    vibrato_findings,
    pitch_findings,
)

# How each learned deficit becomes a coaching finding.
_DEFICIT_TO_FINDING = {
    "flat_dynamics": ("narrow_dynamic_range", "dynamic_range",
                      lambda a: f"The line stays at one dynamic level (learned deficit)."),
    "dull_color": ("dull_tone", "spectral_centroid_mean",
                   lambda a: "The tone stays dark and covered, losing its ring (learned deficit)."),
    "lost_vibrato": ("straight_tone", "vibrato_rate",
                     lambda a: "Sustained notes are sung with little or no vibrato (learned deficit)."),
    "unstable_pitch": ("unstable_pitch_core", "pitch_stability",
                       lambda a: "Sustained pitches waver around their center (learned deficit)."),
}


def diagnosis_findings(analysis, severities: dict[str, float], min_severity: float) -> list[Finding]:
    """Findings driven by the learned diagnosis model's calibrated severities,
    replacing the brittle hand thresholds for the four deficits it covers."""
    out: list[Finding] = []
    for deficit, sev in (severities or {}).items():
        if sev < min_severity or deficit not in _DEFICIT_TO_FINDING:
            continue
        kind, feature, headline = _DEFICIT_TO_FINDING[deficit]
        evidence = {"learned_severity": round(float(sev), 3)}
        ms = me = None
        if deficit == "flat_dynamics":
            evidence["dynamic_range_db"] = round(float(analysis.dynamic_range or 0.0), 1)
            if analysis.soft_measures:
                ms, me = min(analysis.soft_measures), max(analysis.soft_measures)
        out.append(
            Finding(kind=kind, feature_targeted=feature, salience=float(sev),
                    headline=headline(analysis), evidence=evidence,
                    measure_start=ms, measure_end=me)
        )
    return out


def generate_findings(
    analysis,
    dimension_scores: dict[str, float] | None = None,
    deficit_severities: dict[str, float] | None = None,
    deficit_min_severity: float = 0.40,
) -> list[Finding]:
    findings: list[Finding] = []
    # Always run the hand-threshold + structural generators. The learned diagnosis
    # findings are ADDITIVE: when the model is confident on a deficit it can detect
    # reliably, that finding is added on top and (being deduped by feature with the
    # higher salience kept) can strengthen a note, but it never removes a correct
    # hand-threshold note. This keeps production coaching safe while the model's
    # synthetic->real calibration is still maturing.
    if deficit_severities:
        findings.extend(diagnosis_findings(analysis, deficit_severities, deficit_min_severity))
    for gen in (*_STRUCTURAL_GENERATORS, *_HAND_DEFICIT_GENERATORS):
        try:
            findings.extend(gen(analysis, dimension_scores))
        except Exception:  # noqa: BLE001 - one generator must not break the rest
            continue
    findings.sort(key=lambda f: f.salience, reverse=True)
    return findings
