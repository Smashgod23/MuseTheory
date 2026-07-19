"""MERT self-supervised embeddings.

MERT (m-a-p/MERT-v1-95M) is a music-domain SSL model; its hidden states are a
strong, general representation of musical content. We pool them into a single
fixed-length embedding used as input to the expressiveness regressor. This is the
"neural" half of the system's perceptual grounding (the SongEval baseline and the
ICASSP-2026 challenge entrants all build on SSL features of this kind).

Pooling: for each ~10s chunk we mean-pool every transformer layer over time, then
mean across layers, then mean across chunks -> a 768-d vector. Runs on MPS/CPU;
there is no CUDA dependency.
"""

from __future__ import annotations

import logging

import numpy as np

from muse_theory.config import resolve_device

log = logging.getLogger("muse_theory.model.mert")

_MERT_SR = 24000
_CHUNK_SECONDS = 10.0


class MERTEmbedder:
    def __init__(self, model_id: str = "m-a-p/MERT-v1-95M", device: str | None = None,
                 seed: int = 1729):
        import torch
        from transformers import AutoModel, Wav2Vec2FeatureExtractor

        # Seed before load so any newly-initialized parameters are deterministic,
        # which keeps the embeddings (and therefore training/eval) reproducible.
        torch.manual_seed(seed)

        self.device = device or resolve_device("auto")
        self.model_id = model_id
        self.processor = Wav2Vec2FeatureExtractor.from_pretrained(
            model_id, trust_remote_code=True
        )
        self.model = AutoModel.from_pretrained(model_id, trust_remote_code=True)
        self._fix_pos_conv_weights()
        self.model.to(self.device).eval()
        self._torch = torch
        self.embedding_dim = int(self.model.config.hidden_size)

    def _fix_pos_conv_weights(self) -> None:
        """The checkpoint stores the positional conv with the legacy weight_norm
        names (weight_g/weight_v). torch>=2.1 uses the parametrizations.* names, so
        transformers leaves those weights randomly initialized. We remap and load
        them explicitly; otherwise the positional convolution would be garbage."""
        import torch
        from huggingface_hub import hf_hub_download

        try:
            ckpt = hf_hub_download(self.model_id, "pytorch_model.bin")
            sd = torch.load(ckpt, map_location="cpu")
            remap = {
                "encoder.pos_conv_embed.conv.weight_g":
                    "encoder.pos_conv_embed.conv.parametrizations.weight.original0",
                "encoder.pos_conv_embed.conv.weight_v":
                    "encoder.pos_conv_embed.conv.parametrizations.weight.original1",
            }
            to_load = {dst: sd[src] for src, dst in remap.items() if src in sd}
            if to_load:
                missing, unexpected = self.model.load_state_dict(to_load, strict=False)
                loaded = [k for k in to_load if k not in unexpected]
                log.info("Loaded MERT pos_conv weights: %d tensors", len(loaded))
        except Exception as exc:  # noqa: BLE001 - degrade to random init if needed
            log.warning("Could not remap MERT pos_conv weights (%s)", exc)

    @property
    def target_sr(self) -> int:
        return _MERT_SR

    def embed(self, samples: np.ndarray, sr: int) -> np.ndarray:
        """Return a single pooled embedding for the clip."""
        import librosa

        if sr != _MERT_SR:
            samples = librosa.resample(samples, orig_sr=sr, target_sr=_MERT_SR)
        chunk = int(_CHUNK_SECONDS * _MERT_SR)
        if samples.shape[0] < _MERT_SR:  # pad very short clips to >=1s
            samples = np.pad(samples, (0, _MERT_SR - samples.shape[0]))

        chunk_embeddings: list[np.ndarray] = []
        for start in range(0, samples.shape[0], chunk):
            piece = samples[start : start + chunk]
            if piece.shape[0] < _MERT_SR // 2:  # skip tiny tail
                continue
            chunk_embeddings.append(self._embed_chunk(piece))
        if not chunk_embeddings:
            chunk_embeddings.append(self._embed_chunk(samples[:chunk]))
        return np.mean(chunk_embeddings, axis=0).astype(np.float32)

    def _embed_chunk(self, piece: np.ndarray) -> np.ndarray:
        torch = self._torch
        inputs = self.processor(
            piece, sampling_rate=_MERT_SR, return_tensors="pt"
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            out = self.model(**inputs, output_hidden_states=True)
        # hidden_states: tuple of (1, T, H); stack -> (L, T, H)
        hs = torch.stack(out.hidden_states, dim=0).squeeze(1)
        pooled = hs.mean(dim=1).mean(dim=0)  # mean over time, then over layers
        return pooled.float().cpu().numpy()
