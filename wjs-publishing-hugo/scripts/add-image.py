#!/usr/bin/env python3
"""Place an image into a Hugo site's static/uploads/<YYYY>/ and print its markdown.

New images go to static/uploads/ (served at /uploads/...). The legacy
static/wp-content/uploads/ tree from the WordPress import is left untouched.

Optionally downsizes very large images with macOS `sips` (no extra deps).
Prints the markdown image line to paste into a post body.
"""
import argparse
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo("Asia/Shanghai")
except Exception:
    TZ = None


def main():
    p = argparse.ArgumentParser(description="Add an image to a Hugo site's static/uploads/.")
    p.add_argument("src", help="path to the local image")
    p.add_argument("--repo", default=".", help="Hugo repo root (default: cwd)")
    p.add_argument("--alt", default="", help="alt text for the markdown")
    p.add_argument("--max-width", type=int, default=2000,
                   help="downscale wider images to this px width via sips (default 2000; 0=off)")
    p.add_argument("--name", help="destination filename (default: source filename)")
    a = p.parse_args()

    src = Path(a.src).expanduser()
    if not src.is_file():
        sys.exit(f"error: {src} not found")
    repo = Path(a.repo).resolve()
    if not (repo / "static").exists():
        sys.exit(f"error: {repo}/static does not exist — is --repo a Hugo site root?")

    year = (datetime.now(TZ) if TZ else datetime.now()).strftime("%Y")
    dest_dir = repo / "static" / "uploads" / year
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / (a.name or src.name)
    if dest.exists():
        stem, suf = dest.stem, dest.suffix
        i = 1
        while (dest_dir / f"{stem}-{i}{suf}").exists():
            i += 1
        dest = dest_dir / f"{stem}-{i}{suf}"

    shutil.copy2(src, dest)

    if a.max_width and shutil.which("sips"):
        try:
            out = subprocess.run(["sips", "-g", "pixelWidth", str(dest)],
                                 capture_output=True, text=True)
            w = next((int(l.split(":")[1]) for l in out.stdout.splitlines()
                      if "pixelWidth" in l), 0)
            if w > a.max_width:
                subprocess.run(["sips", "--resampleWidth", str(a.max_width), str(dest)],
                               capture_output=True, text=True)
        except Exception:
            pass  # resizing is best-effort; the copy already succeeded

    rel = dest.relative_to(repo / "static")
    url = "/" + str(rel).replace("\\", "/")
    print(f"![{a.alt}]({url})")


if __name__ == "__main__":
    main()
