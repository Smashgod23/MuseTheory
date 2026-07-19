"""Contrast feature: how much expressive variation there is across repeated or
parallel material. This is the signal behind the product's headline use case
("you sang the repeat the same way both times").

If a repetition_map is supplied we compare instances that share a section label.
Otherwise we self-similarity-segment the audio and compare segments that cluster
together. If there is genuinely no repeated material, we fall back to overall
expressive variability across segments so the field is still populated.

`contrast_score` — 0..1. Higher = more expressive difference between repeats
(more interpretive variety); near 0 = repeats performed near-identically.
"""

from __future__ import annotations

import numpy as np

from muse_theory.context.maps import PieceContext
from muse_theory.features.signals import SignalCache
from muse_theory.features.types import Analysis
from muse_theory.structure.grid import TimeGrid, segment_self_similar

_EPS = 1e-8


def _span_summary(cache: SignalCache, t0: float, t1: float) -> dict | None:
    import librosa

    rms_mask = (cache.rms_times >= t0) & (cache.rms_times < t1)
    if rms_mask.sum() < 2:
        return None
    rms_db = 20.0 * np.log10(cache.rms[rms_mask] + _EPS)

    f0_mask = (cache.f0_times >= t0) & (cache.f0_times < t1)
    f0 = cache.f0[f0_mask]
    f0 = f0[np.isfinite(f0) & (f0 > 0)]
    f0_cents = 1200.0 * np.log2(np.median(f0) / 440.0) if f0.size else 0.0

    i0 = int(t0 * cache.sr)
    i1 = min(int(t1 * cache.sr), len(cache.samples))
    centroid = 0.0
    if i1 - i0 > 1024:
        c = librosa.feature.spectral_centroid(y=cache.samples[i0:i1], sr=cache.sr)[0]
        centroid = float(np.mean(c)) if c.size else 0.0

    return {
        "mean_db": float(np.mean(rms_db)),
        "dyn_db": float(np.percentile(rms_db, 95) - np.percentile(rms_db, 5)),
        "centroid": centroid,
        "f0_cents": float(f0_cents),
    }


def _group_contrast(instances: list[dict]) -> float | None:
    """Mean normalized pairwise distance between instance expressive vectors."""
    if len(instances) < 2:
        return None
    keys = ["mean_db", "dyn_db", "centroid", "f0_cents"]
    mat = np.array([[inst[k] for k in keys] for inst in instances], dtype=float)
    std = mat.std(axis=0)
    std[std < _EPS] = 1.0
    z = (mat - mat.mean(axis=0)) / std
    dists = [
        float(np.linalg.norm(z[i] - z[j]))
        for i in range(len(z))
        for j in range(i + 1, len(z))
    ]
    if not dists:
        return None
    # Squash mean distance (in normalized units) to 0..1.
    return float(np.tanh(np.mean(dists) / 2.0))


def extract_contrast(
    cache: SignalCache, grid: TimeGrid, context: PieceContext, analysis: Analysis, cfg
) -> None:
    groups: dict[str, list[dict]] = {}

    repeated = context.repetition.repeated_groups()
    if repeated:
        analysis.contrast_source = "repetition_map"
        for label, sections in repeated.items():
            for sec in sections:
                t0, t1 = grid.measure_span(sec.start_measure, sec.end_measure)
                summary = _span_summary(cache, t0, t1)
                if summary:
                    summary.update(
                        {"start_measure": sec.start_measure, "end_measure": sec.end_measure}
                    )
                    groups.setdefault(label, []).append(summary)
    else:
        segments = segment_self_similar(
            cache.samples,
            cache.sr,
            smoothing=int(cfg.structure.ssm_smoothing),
            min_segment_seconds=float(cfg.structure.min_segment_seconds),
        )
        if segments:
            analysis.contrast_source = "self_similar"
            for seg in segments:
                summary = _span_summary(cache, seg.start, seg.end)
                if summary:
                    summary.update(
                        {
                            "start_measure": grid.measure_of_time(seg.start),
                            "end_measure": grid.measure_of_time(seg.end),
                        }
                    )
                    groups.setdefault(str(seg.label), []).append(summary)

    analysis.section_instances = groups

    repeated_scores = [s for s in (_group_contrast(v) for v in groups.values()) if s is not None]
    if repeated_scores:
        analysis.contrast_score = float(np.mean(repeated_scores))
        return

    # No repeated material: fall back to overall expressive variability so the
    # field is populated rather than null.
    all_instances = [inst for v in groups.values() for inst in v]
    if len(all_instances) >= 2:
        analysis.contrast_source = "overall_variability"
        analysis.contrast_score = _group_contrast(all_instances)
    else:
        analysis.notes.append("Not enough structure to assess expressive contrast.")
