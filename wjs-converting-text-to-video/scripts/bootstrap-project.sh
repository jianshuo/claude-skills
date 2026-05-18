#!/usr/bin/env bash
# Bootstrap a hyperframes video sub-project under <article-folder>/video/.
#
# Copies the TTS / SFX helper scripts so the project is self-contained,
# creates a minimal hyperframes.json + package.json so `npx hyperframes`
# works from that directory, and generates SFX upfront (cheap).
#
# Usage:
#   bootstrap-project.sh <article-folder>
set -euo pipefail

ART="${1:-}"
if [[ -z "$ART" || ! -d "$ART" ]]; then
  echo "usage: bootstrap-project.sh <article-folder>" >&2
  exit 1
fi
ART="$(cd "$ART" && pwd)"
VIDEO="$ART/video"
mkdir -p "$VIDEO"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copy helper scripts so the per-article project is self-contained
cp "$SCRIPT_DIR/tts.py" "$VIDEO/tts_narration.py"
chmod +x "$VIDEO/tts_narration.py"

# Hyperframes project metadata (so `npx hyperframes` finds the project)
cat > "$VIDEO/hyperframes.json" <<'EOF'
{
  "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
  "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  "paths": {
    "blocks": "compositions",
    "components": "compositions/components",
    "assets": "assets"
  }
}
EOF

cat > "$VIDEO/meta.json" <<'EOF'
{ "name": "wjs-video", "width": 1080, "height": 1920, "fps": 30 }
EOF

cat > "$VIDEO/package.json" <<'EOF'
{ "name": "wjs-video", "private": true, "type": "module" }
EOF

# Generate SFX upfront (cheap, ~1s)
"$SCRIPT_DIR/synth-sfx.sh" "$VIDEO"

# Copy illustration (or cover) into video/ as bg.png for the bg-image layer.
# Must be inside video/ — hyperframes render does NOT resolve cross-directory paths
# like ../illustration.png (they render as black).
if [[ -f "$ART/illustration.png" ]]; then
  cp "$ART/illustration.png" "$VIDEO/bg.png"
  echo "[bootstrap] copied illustration.png → video/bg.png"
elif [[ -f "$ART/cover.png" ]]; then
  cp "$ART/cover.png" "$VIDEO/bg.png"
  echo "[bootstrap] no illustration.png, using cover.png as bg"
else
  echo "[bootstrap] ⚠️  no illustration.png or cover.png — bg will fall back to #0e0b08"
fi

echo ""
echo "[bootstrap] $VIDEO ready"
echo "  next steps:"
echo "    1. write narration_chunks.json (12 scene narration JSON)"
echo "    2. cd $VIDEO && set -a && source ~/code/.env && set +a && uvx --with requests python tts_narration.py"
echo "    3. write index.html (read timing.json for scene timings)"
echo "    4. npx hyperframes lint && npx hyperframes snapshot --at <ts> ."
echo "    5. npx hyperframes render --quality standard --output <slug>.mp4"
