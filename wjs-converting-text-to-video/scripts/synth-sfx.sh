#!/usr/bin/env bash
# Synthesize 3 SFX files (tick / chime / bell) into <target-dir>/sfx/
# via ffmpeg. Deterministic, idempotent.
#
# Usage:
#   synth-sfx.sh <target-dir>   # writes <target-dir>/sfx/{tick,chime,bell}.mp3
set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "usage: synth-sfx.sh <target-dir>" >&2
  exit 1
fi
mkdir -p "$TARGET/sfx"

# Soft wood-block tick — 1.2kHz sine, 80ms, exp decay, low volume
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=1200:duration=0.08" \
  -af "afade=t=out:st=0.01:d=0.07:curve=exp,volume=0.18" \
  -ac 2 -ar 48000 "$TARGET/sfx/tick.mp3"

# Soft chime — major sixth interval (880 + 1320Hz), 220ms decay
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=880:duration=0.25" \
  -f lavfi -i "sine=frequency=1320:duration=0.25" \
  -filter_complex "[0:a][1:a]amix=inputs=2:weights=1.0 0.6,afade=t=out:st=0.02:d=0.23:curve=exp,volume=0.14" \
  -ac 2 -ar 48000 "$TARGET/sfx/chime.mp3"

# Final bell — low 220Hz + harmonics, 1.5s decay
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=220:duration=1.5" \
  -f lavfi -i "sine=frequency=660:duration=1.5" \
  -f lavfi -i "sine=frequency=1100:duration=1.5" \
  -filter_complex "[0:a][1:a][2:a]amix=inputs=3:weights=1.0 0.4 0.2,afade=t=out:st=0.05:d=1.45:curve=exp,volume=0.22" \
  -ac 2 -ar 48000 "$TARGET/sfx/bell.mp3"

echo "[sfx] wrote $TARGET/sfx/{tick,chime,bell}.mp3"
