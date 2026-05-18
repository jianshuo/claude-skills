#!/usr/bin/env python3
"""Strip dark scene-level background colors so bg-image (watercolor) shows through.

Keeps:
- Bright color-flip bgs (lightness ≥ 0.35 in HSL) — those are intentional A3 punches
- flash overlays, body bg, bg-image, bg-overlay, etc.

Strips:
- Dark scene bg tints (#0e0b08 family, #1a1208, #0a1428, etc.) — those cover bg-image

Also updates filter/overlay CSS values to the tuned ones (blur30 / brightness0.65 / alpha0.28).

Usage:
  strip-dark-scene-bgs.py <article-folder> [<article-folder>...]
"""
import sys, re, colorsys
from pathlib import Path

def hex_to_lightness(hex_str: str) -> float:
    h = hex_str.lstrip('#')
    if len(h) == 3:
        h = ''.join(c*2 for c in h)
    if len(h) != 6:
        return 0.0
    try:
        r = int(h[0:2], 16) / 255
        g = int(h[2:4], 16) / 255
        b = int(h[4:6], 16) / 255
    except ValueError:
        return 0.0
    _, l, _ = colorsys.rgb_to_hls(r, g, b)
    return l

def find_video_dir(arg: str) -> Path:
    p = Path(arg).resolve()
    if (p / "index.html").exists():
        return p
    if (p / "video" / "index.html").exists():
        return p / "video"
    sys.exit(f"No index.html found at {p} or {p}/video")

def strip(video_dir: Path) -> int:
    """Returns number of scene bgs stripped."""
    html_path = video_dir / "index.html"
    html = html_path.read_text()
    stripped = 0
    kept = 0

    # Find scene CSS blocks: matches `#sN { ... background: #XYZ; ... }` or similar
    # Pattern: #s<digits> with possible class/pseudo, then { stuff }
    # We only modify background declarations INSIDE these blocks.
    def process_block(match: re.Match) -> str:
        nonlocal stripped, kept
        selector = match.group(1)
        body = match.group(2)
        # Find background: #XXX; declarations
        def maybe_strip(m: re.Match) -> str:
            nonlocal stripped, kept
            hex_color = m.group(1)
            lightness = hex_to_lightness(hex_color)
            if lightness >= 0.35:
                # Bright — keep (color-flip)
                kept += 1
                return m.group(0)
            else:
                # Dark — strip
                stripped += 1
                return ''  # remove
        body = re.sub(r"background:\s*(#[0-9a-fA-F]{3,6});", maybe_strip, body)
        return f"{selector}{{{body}}}"

    # Match #s<num> [optional sub-selectors] { body }
    # Careful: body may contain nested { } — for CSS we don't expect nested
    pattern = re.compile(r"(#s\d+\b[^{]*)\{([^}]*)\}", re.MULTILINE)
    new_html = pattern.sub(process_block, html)

    # Also update tuned CSS values for bg-image / bg-overlay
    new_html = re.sub(
        r"filter:\s*blur\([^)]+\)\s*brightness\([^)]+\)\s*saturate\([^)]+\);",
        "filter: blur(30px) brightness(0.65) saturate(0.85);",
        new_html,
        count=1,
    )
    new_html = re.sub(
        r"background:\s*rgba\(14,\s*11,\s*8,\s*[\d.]+\);",
        "background: rgba(14, 11, 8, 0.28);",
        new_html,
        count=1,
    )

    if new_html != html:
        html_path.write_text(new_html)
        print(f"  ✓ {html_path}  stripped {stripped} dark bg, kept {kept} bright (color-flip)")
    else:
        print(f"  · {html_path}  no changes")
    return stripped

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for arg in sys.argv[1:]:
        vd = find_video_dir(arg)
        print(f"[strip] {vd}")
        strip(vd)

if __name__ == "__main__":
    main()
