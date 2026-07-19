"""Controllable expressive-degradation operators (the self-supervision engine).

Each operator takes clean-ish singing and injects ONE expressive deficit at a
known severity in [0, 1]. Because we choose the deficit and its strength, the
training label is exact and free: no hand labeling, no LLM, no external data. A
model trained to recover (deficit, severity) from the resulting acoustic features
learns to diagnose expressive weaknesses — and, unlike the hand-tuned thresholds
it replaces, it is calibrated by thousands of known examples.

All operators run locally on CPU. Pitch-domain edits (vibrato, intonation) use
Praat's PSOLA resynthesis via parselmouth; amplitude/spectral edits are pure
numpy/scipy. Each operator is verified (see tests) to move its target feature in
the expected direction.
"""

from __future__ import annotations

import logging

import numpy as np

log = logging.getLogger("muse_theory.diagnosis.perturb")

# Canonical deficit order — the label vector follows this order everywhere.
DEFICITS: tuple[str, ...] = ("flat_dynamics", "dull_color", "lost_vibrato", "unstable_pitch")


class PerturbationError(Exception):
    """Raised when an operator cannot be applied (e.g. Praat fails on a clip)."""


def flat_dynamics(sig: np.ndarray, sr: int, severity: float, rng) -> np.ndarray:
    """Compress the loudness envelope toward a constant level -> narrow dynamics."""
    import librosa

    hop = 512
    rms = librosa.feature.rms(y=sig, frame_length=2048, hop_length=hop)[0]
    env = np.interp(np.arange(len(sig)), np.arange(len(rms)) * hop, rms) + 1e-6
    target = float(np.median(env))
    gain = target / env
    # Blend original (gain=1) toward fully-leveled (gain=target/env) by severity.
    gain = (1.0 - severity) + gain * severity
    return (sig * gain).astype(np.float32)


def dull_color(sig: np.ndarray, sr: int, severity: float, rng) -> np.ndarray:
    """Low-pass / darken the timbre -> monochrome, dull tone color."""
    import scipy.signal as ss

    cutoff = 4500.0 * (1.0 - severity) + 1100.0 * severity
    wn = min(cutoff / (sr / 2.0), 0.99)
    b, a = ss.butter(4, wn, btype="low")
    return ss.filtfilt(b, a, sig).astype(np.float32)


def lost_vibrato(sig: np.ndarray, sr: int, severity: float, rng) -> np.ndarray:
    """Smooth the F0 contour to remove vibrato -> flat, straight tone."""

    def transform(times: np.ndarray, f0: np.ndarray, _rng) -> np.ndarray:
        cents = 1200.0 * np.log2(f0 / np.mean(f0))
        dt = (times[-1] - times[0]) / max(1, len(times) - 1)
        win = max(1, int(0.16 / max(dt, 1e-6)))  # ~160 ms moving-average kills 4-8 Hz vibrato
        kernel = np.ones(win) / win
        smooth = np.convolve(cents, kernel, mode="same")
        out = cents * (1.0 - severity) + smooth * severity
        return np.mean(f0) * 2.0 ** (out / 1200.0)

    return _praat_edit_f0(sig, sr, transform, rng)


def unstable_pitch(sig: np.ndarray, sr: int, severity: float, rng) -> np.ndarray:
    """Add high-frequency jitter to F0 -> wavering, unsteady intonation. Uses
    per-frame (not cumulative) noise so it raises frame-to-frame deviation, which
    is what pitch instability actually is."""

    def transform(times: np.ndarray, f0: np.ndarray, r) -> np.ndarray:
        cents_noise = r.normal(0.0, 40.0 * severity, size=len(f0))  # up to ~40 cents std
        return f0 * 2.0 ** (cents_noise / 1200.0)

    return _praat_edit_f0(sig, sr, transform, rng)


PERTURBATIONS = {
    "flat_dynamics": flat_dynamics,
    "dull_color": dull_color,
    "lost_vibrato": lost_vibrato,
    "unstable_pitch": unstable_pitch,
}


def apply(sig: np.ndarray, sr: int, severities: dict[str, float], rng) -> np.ndarray:
    """Apply a set of {deficit: severity} edits in canonical order."""
    out = sig.astype(np.float32)
    for name in DEFICITS:
        sev = float(severities.get(name, 0.0))
        if sev > 0.0:
            out = PERTURBATIONS[name](out, sr, sev, rng)
    # Re-normalize so loudness changes don't leak a trivial cue.
    peak = float(np.max(np.abs(out))) + 1e-9
    return (out / peak * 0.97).astype(np.float32)


def _praat_edit_f0(sig: np.ndarray, sr: int, transform, rng) -> np.ndarray:
    """Resynthesize `sig` with an edited F0 contour via Praat PSOLA. `transform`
    maps (times, f0_hz, rng) -> new f0_hz."""
    try:
        import parselmouth
        from parselmouth.praat import call

        snd = parselmouth.Sound(sig.astype(np.float64), sampling_frequency=sr)
        manip = call(snd, "To Manipulation", 0.01, 75, 500)
        pitch = call(snd, "To Pitch", 0.01, 75, 500)
        n = int(call(pitch, "Get number of frames"))
        times, f0s = [], []
        for i in range(1, n + 1):
            f = call(pitch, "Get value in frame", i, "Hertz")
            if f and not np.isnan(f):
                times.append(call(pitch, "Get time from frame number", i))
                f0s.append(f)
        if len(f0s) < 5:
            raise PerturbationError("too few voiced frames for F0 edit")

        new_f0 = transform(np.asarray(times), np.asarray(f0s), rng)
        pt = call("Create PitchTier", "pt", 0.0, snd.get_total_duration())
        for t, f in zip(times, new_f0):
            call(pt, "Add point", float(t), float(max(50.0, f)))
        call([manip, pt], "Replace pitch tier")
        res = call(manip, "Get resynthesis (overlap-add)")
        out = np.asarray(res.values).flatten().astype(np.float32)
        return out if out.size else sig
    except PerturbationError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise PerturbationError(str(exc)) from exc
