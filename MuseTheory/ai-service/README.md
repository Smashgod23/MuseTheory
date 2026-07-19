# Muse Theory AI service

The real analysis engine behind the app, built by Pratham Aithal (Rock Hill High School, Frisco, TX). Spring Boot is the only thing that talks to it. It never faces the public internet.

## What this is

A singer uploads a recording. The backend stores it and calls this service, which listens to the audio and returns specific, interpretive coaching: pull this dynamic back so the repeat lands differently, delay this consonant so the word blooms into the beat, save the vibrato for the top of the phrase. Every sentence it produces traces back to something it actually measured.

Until now this folder held a stub that returned `random.uniform(...)` numbers so the rest of the app could be wired up. That stub is gone. This is the trained model from the research repo (`MuseTheoryModel`), vendored here so the website is self-contained.

## It runs on your machine, on purpose

The whole thing runs locally. Feature extraction, the MERT aesthetics model, source separation, and the small on-device language model that phrases the coaching all execute on a laptop. There is no cloud inference call, no external AI API, nothing rented by the hour in a data center. First boot downloads the model weights from Hugging Face (about 8 GB) and caches them; after that it works offline.

That is a deliberate choice, not a limitation I am apologizing for. The point of this project is to give a singer a tool, not to feed their recording into a giant always-on server. The analysis side decides what is true and a tightly leashed rephraser only gets to word it. On Apple Silicon the rephraser uses MLX for warmer prose. On any other machine those wheels are skipped and it falls back to deterministic templates, which are still real coaching, just plainer.

## Running it

```bash
cd ai-service
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt   # core + ML stack
zsh run.sh                                   # serves on 127.0.0.1:8000
```

The backend finds it through the `AI_SERVICE_URL` env var it already reads (defaults to `http://localhost:8000`), so no backend change is needed to point at it. On a Mac you can reuse the research repo's existing `.venv` instead of building a new one, since the weights are already cached there.

Full-stack bring-up (MinIO, this service, Spring Boot, the frontend) is one command: `zsh ~/muse-demo.sh`.

## Endpoints

- `GET /health` returns `{"status": "ok", "version": ..., "device": "mps"}`.
- `POST /analyze` takes an audio URL (or local path) plus optional piece context and voice part, and returns a `feature_vector` and a list of `suggestions`. It answers in snake_case to match the database columns, accepts both camelCase and snake_case input, and never 500s the backend: bad or too-short audio comes back as HTTP 200 with null features and no suggestions.

The request and response shapes, the optional context-map JSON schemas, and the timeout budget are documented in full in the research repo at `docs/INTEGRATION.md`.

## Source of truth

The model code here is a copy. The canonical version, the training code, the tests, and the paper live in the `MuseTheoryModel` repo. If the pipeline changes there, re-vendor `muse_theory/`, `service/`, and `configs/` into this folder.
