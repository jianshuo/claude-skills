#!/usr/bin/env python3
"""Retrofit the bg-image + bg-overlay layer into an existing index.html.

Idempotent — running twice has no extra effect.

Usage:
  retrofit-bg-image.py <article-folder>
  retrofit-bg-image.py <article-folder>/video    # also accepted

Inserts (only if not already present):
  - <div id="bg-image"></div> + <div id="bg-overlay"></div> right after <div id="root" ...>
  - CSS rules for #bg-image, #bg-overlay, .scene z-index inside the <style> block

The bg-image points to ../illustration.png (or ../cover.png as fallback).
"""
import sys, re, shutil
from pathlib import Path

CSS_INJECT = """
  /* ============ bg-image layer (abstract watercolor bg) ============ */
  #bg-image {
    position: absolute; inset: 0;
    background-image: url('bg.png');
    background-size: cover;
    background-position: center;
    filter: blur(30px) brightness(0.65) saturate(0.85);
    z-index: 0;
    transform: scale(1.1);
  }
  #bg-overlay {
    position: absolute; inset: 0;
    background: rgba(14, 11, 8, 0.28);
    z-index: 1;
  }
  .scene { z-index: 2; }
"""

HTML_INJECT = """
  <div id="bg-image"></div>
  <div id="bg-overlay"></div>
"""

def find_video_dir(arg: str) -> Path:
    p = Path(arg).resolve()
    if (p / "index.html").exists():
        return p
    if (p / "video" / "index.html").exists():
        return p / "video"
    sys.exit(f"No index.html found at {p} or {p}/video")

def ensure_bg_png(video_dir: Path) -> bool:
    """Copy illustration.png (or cover.png) from article folder into video/bg.png."""
    if (video_dir / "bg.png").exists():
        return True
    article_dir = video_dir.parent
    for cand in ("illustration.png", "cover.png"):
        src = article_dir / cand
        if src.exists():
            shutil.copy(src, video_dir / "bg.png")
            print(f"  + copied {cand} → bg.png")
            return True
    print(f"  ⚠️  no illustration.png or cover.png in {article_dir}, skipping bg-image retrofit")
    return False

def retrofit(video_dir: Path) -> bool:
    html_path = video_dir / "index.html"
    html = html_path.read_text()

    if not ensure_bg_png(video_dir):
        return False

    changed = False

    # Inject CSS (just before closing </style>)
    if "#bg-image" not in html:
        m = re.search(r"</style>", html)
        if not m:
            print(f"  ✗  no </style> tag in {html_path}, cannot inject CSS")
            return False
        html = html[:m.start()] + CSS_INJECT + html[m.start():]
        changed = True
        print(f"  + CSS injected")
    else:
        # Update existing CSS to tuned values (idempotent)
        html = re.sub(
            r"background-image:\s*url\('[^']+'\);",
            "background-image: url('bg.png');",
            html,
            count=1,
        )
        html = re.sub(
            r"filter:\s*blur\([^)]+\)\s*brightness\([^)]+\)\s*saturate\([^)]+\);",
            "filter: blur(30px) brightness(0.65) saturate(0.85);",
            html,
            count=1,
        )
        html = re.sub(
            r"background:\s*rgba\(14,\s*11,\s*8,\s*[\d.]+\);",
            "background: rgba(14, 11, 8, 0.28);",
            html,
            count=1,
        )

    # Inject HTML divs (right after opening <div id="root" ...>)
    if 'id="bg-image"' not in html:
        m = re.search(r'(<div id="root"[^>]*>)', html)
        if not m:
            print(f"  ✗  no <div id=\"root\"> in {html_path}, cannot inject divs")
            return False
        html = html[:m.end()] + HTML_INJECT + html[m.end():]
        changed = True
        print(f"  + HTML divs injected")

    if changed:
        html_path.write_text(html)
        print(f"  ✓ {html_path}")
    else:
        print(f"  · already has bg-image, no change")
    return changed

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for arg in sys.argv[1:]:
        video_dir = find_video_dir(arg)
        print(f"[retrofit] {video_dir}")
        retrofit(video_dir)

if __name__ == "__main__":
    main()
