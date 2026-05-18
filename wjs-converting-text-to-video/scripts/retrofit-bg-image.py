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
import sys, re
from pathlib import Path

CSS_INJECT = """
  /* ============ bg-image layer (取代纯黑底) ============ */
  #bg-image {
    position: absolute; inset: 0;
    background-image: url('../illustration.png');
    background-size: cover;
    background-position: center;
    filter: blur(60px) brightness(0.22) saturate(0.55);
    z-index: 0;
    transform: scale(1.1);
  }
  #bg-overlay {
    position: absolute; inset: 0;
    background: rgba(14, 11, 8, 0.55);
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

def retrofit(video_dir: Path) -> bool:
    html_path = video_dir / "index.html"
    html = html_path.read_text()

    # Pick image source
    article_dir = video_dir.parent
    if (article_dir / "illustration.png").exists():
        img_src = "../illustration.png"
    elif (article_dir / "cover.png").exists():
        img_src = "../cover.png"
    else:
        print(f"  ⚠️  no illustration.png or cover.png in {article_dir}, skipping")
        return False

    changed = False

    # Inject CSS (just before closing </style>)
    if "#bg-image" not in html:
        m = re.search(r"</style>", html)
        if not m:
            print(f"  ✗  no </style> tag in {html_path}, cannot inject CSS")
            return False
        css = CSS_INJECT.replace("../illustration.png", img_src)
        html = html[:m.start()] + css + html[m.start():]
        changed = True
        print(f"  + CSS injected ({img_src})")
    else:
        # Update image src in existing CSS in case it changed
        html = re.sub(
            r"background-image:\s*url\('[^']+'\);",
            f"background-image: url('{img_src}');",
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
