"""On-device LLM realizer (Apple Silicon, via MLX).

This is the "neural surface realization" stage. It does NOT decide what to coach
or invent musical facts — that is the job of the symbolic finding generators. It
only rewrites an already-correct, already-specific draft note into warm,
natural coach's prose, strictly constrained to the facts in the finding. If MLX
is unavailable, the model can't load, or the output looks degenerate, the caller
keeps the deterministic template instead.

Default model: mlx-community/Qwen2.5-3B-Instruct-4bit (a ~1.7 GB 4-bit model that
runs comfortably on Apple Silicon and loads cleanly on the pinned mlx-lm).
Swappable via configs/default.yaml.
"""

from __future__ import annotations

import logging
import re

log = logging.getLogger("muse_theory.coaching.llm")

_SYSTEM = (
    "You are an experienced, warm choir director giving one short, specific note to a "
    "singer about their own recording. You will be given an analysis finding, a draft note, "
    "and sometimes the singer's voice part. Rewrite the draft as natural spoken coaching. "
    "Rules: keep every specific detail from the draft (measure numbers, words, the direction "
    "of the change); do NOT invent a measured specific (a measure number, lyric, or exact "
    "pitch) that is not in the draft or finding. General vocal technique appropriate to the "
    "singer's voice part (its passaggio, registration, breath, or range) is encouraged where "
    "it genuinely fits the note. Write 2 to 4 sentences in the second person; no lists, no "
    "markdown, no preamble, no quotation marks."
)


def build_user_content(finding, draft: str, director_notes: str | None,
                       voice_context: str | None = None, part_label: str | None = None) -> str:
    """Assemble the user turn for the realizer. Kept module-level so it can be
    unit-tested without loading the model."""
    where = ""
    if finding.measure_start:
        where = (
            f"measures {finding.measure_start}-{finding.measure_end}"
            if finding.measure_end and finding.measure_end != finding.measure_start
            else f"measure {finding.measure_start}"
        )
    user = [f"Finding: {finding.headline}", f"Targeted aspect: {finding.feature_targeted}"]
    if where:
        user.append(f"Location: {where}")
    if voice_context:
        label = part_label or "singer"
        user.append(
            f"The singer is a {label}. Part technique context: {voice_context} "
            f"Where it genuinely helps this note, connect the advice to how it plays out for a "
            f"{label} voice (passaggio, registration, breath, or range), keeping it natural and "
            f"brief. Do not assert a measured specific (measure number, lyric, or exact pitch) "
            f"that is not in the finding."
        )
    if director_notes:
        user.append(
            f"The director also noted: \"{director_notes}\". Align your phrasing with this only "
            f"if it is relevant; do not add new musical facts from it."
        )
    user.append(f"Draft note to rewrite:\n{draft}")
    return "\n".join(user)


class MLXRealizer:
    def __init__(self, model_id: str, cfg):
        from mlx_lm import load  # raises if MLX/model unavailable -> caller falls back

        self.model_id = model_id
        self.model, self.tokenizer = load(model_id)
        self.max_tokens = int(cfg.coaching.max_tokens)
        self.temperature = float(cfg.coaching.temperature)

    def _build_prompt(self, finding, draft, director_notes, voice_context, part_label) -> str:
        messages = [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": build_user_content(
                finding, draft, director_notes, voice_context, part_label)},
        ]
        return self.tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )

    def realize(self, finding, draft: str, director_notes: str | None = None,
                voice_context: str | None = None, part_label: str | None = None) -> str:
        from mlx_lm import generate

        prompt = self._build_prompt(finding, draft, director_notes, voice_context, part_label)
        try:
            text = generate(
                self.model, self.tokenizer, prompt=prompt,
                max_tokens=self.max_tokens, temp=self.temperature, verbose=False,
            )
        except TypeError:
            # Older/newer signature without `temp` kwarg.
            text = generate(
                self.model, self.tokenizer, prompt=prompt,
                max_tokens=self.max_tokens, verbose=False,
            )
        return self._clean(text)

    @staticmethod
    def _clean(text: str) -> str:
        text = (text or "").strip()
        # Drop any leaked role markers / preamble.
        text = re.sub(r"^(assistant|note|coach)\s*:\s*", "", text, flags=re.IGNORECASE).strip()
        text = text.strip('"').strip()
        # Keep it to the first paragraph.
        return text.split("\n\n")[0].strip()
