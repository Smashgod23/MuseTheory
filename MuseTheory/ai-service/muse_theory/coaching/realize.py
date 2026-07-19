"""Turn findings into the contract's `Suggestion` list.

Pipeline: generate_findings -> rank/filter -> realize each into coach-voice text
(on-device LLM if available, deterministic template otherwise) -> Suggestion.

The LLM is strictly a *rephraser* grounded on the template text; if it is
unavailable or returns something degenerate, we keep the template. This keeps the
service deterministic-by-default and reproducible, and guarantees real (not
random) suggestions even with no model present.
"""

from __future__ import annotations

import logging

from muse_theory.coaching.findings import Finding, generate_findings
from muse_theory.coaching.templates import render_template
from muse_theory.schema import Suggestion

log = logging.getLogger("muse_theory.coaching")

# Lazily-initialized LLM realizer (None until first use; False if unavailable).
_LLM = None


def _get_llm(cfg):
    global _LLM
    if _LLM is None:
        try:
            from muse_theory.coaching.llm import MLXRealizer

            _LLM = MLXRealizer(cfg.coaching.llm_id, cfg)
            log.info("On-device LLM realizer ready: %s", cfg.coaching.llm_id)
        except Exception as exc:  # noqa: BLE001 - MLX/model not present -> templates
            log.info("LLM realizer unavailable (%s); using templates", exc)
            _LLM = False
    return _LLM or None


def _select(findings: list[Finding], cfg) -> list[Finding]:
    min_sal = float(cfg.coaching.min_salience)
    max_n = int(cfg.coaching.max_suggestions)
    min_n = int(cfg.coaching.min_suggestions)

    chosen = [f for f in findings if f.salience >= min_sal]
    if len(chosen) < min_n:
        # Relax: include the next-most-salient findings to reach the floor.
        extras = [f for f in findings if f not in chosen]
        chosen = (chosen + extras)[: max(min_n, len(chosen))]
    return chosen[:max_n]


def _exploratory(analysis) -> list[Finding]:
    """Grounded stretch goals used to top up to the minimum number of suggestions
    when the performance is clean enough that few problems trigger. Each is tied
    to a real measured value, so it is still specific rather than generic."""
    out: list[Finding] = []
    # NB: these use dedicated *_stretch templates with accurate, positive framing,
    # NOT the problem templates — so they never assert a flaw the clip doesn't have.
    if analysis.dynamic_range is not None:
        out.append(Finding(
            kind="dynamics_stretch", feature_targeted="dynamic_range", salience=0.2,
            headline="Dynamic shaping already works; there is room to widen the extremes further.",
            evidence={"dynamic_range_db": round(float(analysis.dynamic_range), 1)},
        ))
    if analysis.vibrato_note_count == 0 and (analysis.voiced_ratio or 0) > 0.5:
        out.append(Finding(
            kind="straight_tone", feature_targeted="vibrato_rate", salience=0.2,
            headline="Straight tone throughout; vibrato could add a layer of color.",
            evidence={"vibrato_note_count": 0},
        ))
    if analysis.section_instances:
        # A repeated section is a chance to vary the color on the return.
        label = next(iter(analysis.section_instances))
        insts = analysis.section_instances[label]
        if len(insts) >= 2:
            last = insts[-1]
            out.append(Finding(
                kind="color_stretch", feature_targeted="spectral_centroid_mean", salience=0.18,
                headline=f"Section '{label}' returns; the final pass is a chance for a new color.",
                evidence={"label": label},
                measure_start=last.get("start_measure"), measure_end=last.get("end_measure"),
            ))
    if analysis.phrase_lengths and len(analysis.phrase_lengths) >= 2:
        out.append(Finding(
            kind="phrasing_stretch", feature_targeted="phrase_length_variance", salience=0.16,
            headline="Phrasing is consistent; varying one breath would add shape.",
            evidence={"phrase_count": len(analysis.phrase_lengths)},
        ))
    # Always-available stretch goals grounded in features every clip has, so the
    # minimum suggestion count is reliably met with specific (not generic) advice.
    if analysis.vibrato_note_count and (analysis.vibrato_extent or 0) <= 2.4:
        out.append(Finding(
            kind="vibrato_as_choice", feature_targeted="vibrato_rate", salience=0.15,
            headline="Vibrato is steady; using it as a choice rather than a constant would add growth.",
            evidence={"vibrato_extent": analysis.vibrato_extent},
        ))
    if analysis.articulation_style is not None:
        out.append(Finding(
            kind="articulation_stretch", feature_targeted="articulation_style", salience=0.13,
            headline="Articulation is consistent; contrasting one phrase would add shape.",
            evidence={"articulation_style": round(float(analysis.articulation_style), 2)},
        ))
    if analysis.spectral_centroid_mean is not None:
        out.append(Finding(
            kind="timbre_stretch", feature_targeted="spectral_centroid_mean", salience=0.12,
            headline="Tone color is steady; varying it across phrases would add light and shade.",
            evidence={"spectral_centroid_mean": round(float(analysis.spectral_centroid_mean), 0)},
        ))
    return out


def _top_up(selected: list[Finding], analysis, min_n: int) -> list[Finding]:
    """Ensure at least `min_n` suggestions by adding exploratory findings whose
    targeted feature isn't already covered."""
    if len(selected) >= min_n:
        return selected
    covered = {f.feature_targeted for f in selected}
    for extra in _exploratory(analysis):
        if len(selected) >= min_n:
            break
        if extra.feature_targeted not in covered:
            selected.append(extra)
            covered.add(extra.feature_targeted)
    return selected


def generate_suggestions(
    analysis, context, dimension_scores, cfg, deficit_severities=None, voice_part=None
) -> list[Suggestion]:
    findings = generate_findings(
        analysis,
        dimension_scores,
        deficit_severities=deficit_severities,
        deficit_min_severity=float(cfg.get_path("diagnosis.min_severity", 0.40)),
    )
    selected = _select(findings, cfg)
    if not selected:
        selected = _exploratory(analysis)
    # One suggestion per targeted feature (no two notes about the same aspect).
    seen: set[str | None] = set()
    deduped: list[Finding] = []
    for f in selected:
        if f.feature_targeted in seen:
            continue
        seen.add(f.feature_targeted)
        deduped.append(f)
    # Top up to the configured minimum with grounded stretch goals.
    selected = _top_up(deduped, analysis, int(cfg.coaching.min_suggestions))
    selected = selected[: int(cfg.coaching.max_suggestions)]

    llm = _get_llm(cfg) if cfg.coaching.use_llm else None
    director_notes = getattr(context, "director_notes", None)
    # Part-appropriate technique context for the LLM (the personalization payload).
    from muse_theory.voice.parts import technique_brief
    voice_context = technique_brief(voice_part)
    part_label = voice_part.display if voice_part else None

    suggestions: list[Suggestion] = []
    for finding in selected:
        template_text = render_template(finding)
        text = template_text
        if llm is not None:
            try:
                rephrased = llm.realize(finding, template_text, director_notes,
                                        voice_context=voice_context, part_label=part_label)
                if rephrased and len(rephrased.strip()) > 30:
                    text = rephrased.strip()
            except Exception as exc:  # noqa: BLE001
                log.warning("LLM realization failed (%s); using template", exc)
        suggestions.append(
            Suggestion(
                suggestion_text=text,
                musicality_score=finding.musicality_score,
                measure_start=finding.measure_start,
                measure_end=finding.measure_end,
                feature_targeted=finding.feature_targeted,
            )
        )
    return suggestions
