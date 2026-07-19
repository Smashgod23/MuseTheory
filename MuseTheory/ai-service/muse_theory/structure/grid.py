"""Tempo, beat, and measure structure.

Singing recordings carry no explicit bar lines, but the §3.1 contract wants
suggestions anchored to measure numbers. We therefore estimate a beat grid with
librosa, group beats into measures using the piece's time signature, and expose
time<->measure conversions. This is an approximation (free rubato singing has no
metronomic beat), so the grid carries a `confidence` and the pipeline treats
measure anchors as approximate. When beat tracking fails we fall back to a fixed
nominal tempo so anchoring still degrades gracefully instead of crashing.

Also provides self-similarity segmentation, used to find repeated/parallel
material for the contrast feature when no repetition_map is supplied.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

log = logging.getLogger("muse_theory.structure")

_FALLBACK_TEMPO = 100.0  # BPM used when beat tracking is unreliable


@dataclass
class TimeGrid:
    tempo: float                  # estimated BPM
    tempo_variance: float         # variability of local tempo (rubato proxy)
    beat_times: np.ndarray        # seconds, ascending
    beats_per_measure: int
    duration: float
    confidence: float             # 0..1, how trustworthy the grid is

    @property
    def beat_period(self) -> float:
        if self.tempo <= 0:
            return 60.0 / _FALLBACK_TEMPO
        return 60.0 / self.tempo

    def measure_of_time(self, t: float) -> int:
        """1-based measure index containing time `t`."""
        if self.beat_times.size >= 2:
            beat_idx = int(np.searchsorted(self.beat_times, t, side="right") - 1)
            beat_idx = max(0, beat_idx)
        else:
            beat_idx = int(t / self.beat_period)
        return beat_idx // self.beats_per_measure + 1

    def time_of_measure(self, measure: int) -> float:
        """Start time (seconds) of a 1-based measure index."""
        beat_idx = (measure - 1) * self.beats_per_measure
        if self.beat_times.size > beat_idx >= 0:
            return float(self.beat_times[beat_idx])
        # Extrapolate beyond tracked beats using the mean beat period.
        if self.beat_times.size >= 1:
            return float(self.beat_times[0] + beat_idx * self.beat_period)
        return float(beat_idx * self.beat_period)

    def measure_span(self, start_measure: int, end_measure: int) -> tuple[float, float]:
        return self.time_of_measure(start_measure), self.time_of_measure(end_measure + 1)

    @property
    def n_measures(self) -> int:
        if self.beat_times.size >= 1:
            n_beats = self.beat_times.size
        else:
            n_beats = int(self.duration / self.beat_period)
        return max(1, n_beats // self.beats_per_measure)


def build_time_grid(
    samples: np.ndarray, sr: int, time_signature: tuple[int, int] = (4, 4)
) -> TimeGrid:
    import librosa

    duration = len(samples) / sr
    beats_per_measure = max(1, int(time_signature[0]))

    try:
        tempo, beat_frames = librosa.beat.beat_track(y=samples, sr=sr, units="frames")
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        tempo = float(np.atleast_1d(tempo)[0])
    except Exception as exc:  # noqa: BLE001
        log.warning("Beat tracking failed (%s); using fallback grid", exc)
        tempo, beat_times = 0.0, np.array([])

    if beat_times.size >= 3:
        # Local tempo from inter-beat intervals; its spread is a rubato proxy.
        intervals = np.diff(beat_times)
        intervals = intervals[intervals > 1e-3]
        local_bpm = 60.0 / intervals if intervals.size else np.array([tempo])
        tempo_variance = float(np.std(local_bpm))
        confidence = float(np.clip(beat_times.size / (duration + 1e-6) / 2.0, 0.0, 1.0))
        if tempo <= 0:
            tempo = float(np.median(local_bpm))
    else:
        tempo = tempo if tempo > 0 else _FALLBACK_TEMPO
        tempo_variance = 0.0
        confidence = 0.1
        # Synthesize a regular beat grid so measure anchoring still works.
        period = 60.0 / tempo
        beat_times = np.arange(0, duration, period)

    return TimeGrid(
        tempo=tempo,
        tempo_variance=tempo_variance,
        beat_times=beat_times,
        beats_per_measure=beats_per_measure,
        duration=duration,
        confidence=confidence,
    )


@dataclass
class Segment:
    start: float
    end: float
    label: int


def segment_self_similar(
    samples: np.ndarray,
    sr: int,
    smoothing: int = 8,
    min_segment_seconds: float = 2.0,
) -> list[Segment]:
    """Partition the clip into labeled segments via spectral clustering of a
    recurrence/self-similarity structure. Segments sharing a label are
    repeated/parallel material. Used only when no repetition_map is provided.
    """
    import librosa

    try:
        chroma = librosa.feature.chroma_cqt(y=samples, sr=sr)
        # Beat-synchronous to make the SSM compact and tempo-robust.
        _, beats = librosa.beat.beat_track(y=samples, sr=sr)
        if beats.size < 4:
            return []
        chroma_sync = librosa.util.sync(chroma, beats, aggregate=np.median)
        # Recurrence matrix -> Laplacian -> spectral embedding -> k segments.
        rec = librosa.segment.recurrence_matrix(chroma_sync, mode="affinity", sym=True)
        rec = librosa.segment.path_enhance(rec, n=smoothing)
        n = rec.shape[0]
        if n < 4:
            return []
        # Estimate a small number of segment types from the embedding.
        from sklearn.cluster import AgglomerativeClustering

        deg = np.maximum(rec.sum(axis=1), 1e-6)
        lap = np.eye(n) - (rec / deg[:, None])
        vals, vecs = np.linalg.eigh((lap + lap.T) / 2.0)
        k = int(np.clip(round(np.sqrt(n / 2)), 2, 6))
        embedding = vecs[:, 1 : k + 1]
        labels = AgglomerativeClustering(n_clusters=k).fit_predict(embedding)

        # `librosa.util.sync` produces len(beats)+1 columns (one per inter-beat
        # interval, plus the spans before the first and after the last beat), so
        # `labels` has len(beats)+1 entries. The matching segment edges in time are
        # [0, beat_0, ..., beat_last, end], i.e. len(labels)+1 boundaries. Segment i
        # spans edge[i] -> edge[i+1].
        n_frames = chroma.shape[1]
        edge_frames = np.concatenate([[0], beats, [n_frames]])
        edge_times = librosa.frames_to_time(edge_frames, sr=sr)
        segments: list[Segment] = []
        cur_label = labels[0]
        start_idx = 0
        for i in range(1, len(labels)):
            if labels[i] != cur_label:
                segments.append(Segment(float(edge_times[start_idx]), float(edge_times[i]), int(cur_label)))
                start_idx = i
                cur_label = labels[i]
        segments.append(Segment(float(edge_times[start_idx]), float(edge_times[len(labels)]), int(cur_label)))
        # Merge segments shorter than the floor into their predecessor.
        merged: list[Segment] = []
        for seg in segments:
            if merged and (seg.end - seg.start) < min_segment_seconds:
                merged[-1] = Segment(merged[-1].start, seg.end, merged[-1].label)
            else:
                merged.append(seg)
        return merged
    except Exception as exc:  # noqa: BLE001
        log.warning("Self-similar segmentation failed: %s", exc)
        return []
