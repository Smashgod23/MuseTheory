#!/bin/zsh
# Start the Muse Theory AI service (the real, on-device model).
#
# It runs entirely on this machine. No cloud inference, no external API. First
# boot downloads the model weights from Hugging Face (~8 GB, cached after that);
# every run after that is offline.
#
# Usage:
#   zsh run.sh                 # uses ./.venv if present, else the active python
#   PORT=8001 zsh run.sh       # override the port (default 8000)
set -e
cd "$(dirname "$0")"

: "${PORT:=8000}"
: "${HOST:=127.0.0.1}"

# Prefer a venv living next to this service; fall back to whatever uvicorn is on
# PATH so an already-activated environment just works.
if [ -x ".venv/bin/uvicorn" ]; then
  UVICORN=".venv/bin/uvicorn"
else
  UVICORN="uvicorn"
fi

echo "Muse Theory AI service -> http://$HOST:$PORT  (on-device, Spring Boot is the only caller)"
exec "$UVICORN" service.main:app --host "$HOST" --port "$PORT"
