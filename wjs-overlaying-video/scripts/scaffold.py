"""Scaffold a HyperFrames project from a spec.json that describes
overlays on top of a source video.

Inputs (spec.json):
  source_video  path to source MP4 (relative to spec.json or absolute)
  duration      total length in seconds
  size          "WxH"  (default 1920x1080)
  name          project dir name (default: spec.json's parent dir name)
  overlays[]    list of overlay descriptors — see types below

Overlay types:
  quote     1-2 lines kinetic typography w/ top or bottom darken band
  slogan    alias for quote at bottom, slightly larger
  callout   small annotation panel anchored to a corner
  custom    inner HTML/CSS/GSAP supplied by the user in a fragment file

Output: a project directory containing
  source.mp4 (symlink to the spec'd source video)
  index.html (root composition)
  hyperframes.json, meta.json, package.json (via npx hyperframes init)
  overlays/   (only if any custom overlays reference fragment files)

Usage:
  scaffold.py spec.json
  scaffold.py spec.json --out my_project/
  scaffold.py spec.json --force      # overwrite existing project
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

# ─── Templates ──────────────────────────────────────────────────────

ROOT_HTML = """\
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={width}, height={height}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{
        margin: 0;
        width: {width}px;
        height: {height}px;
        overflow: hidden;
        background: #000;
        font-family: "PingFang SC", "Hiragino Sans GB", "Heiti SC",
                     "Microsoft YaHei", sans-serif;
        -webkit-font-smoothing: antialiased;
      }}
      .bg-video {{
        position: absolute;
        top: 0; left: 0;
        width: {width}px;
        height: {height}px;
        object-fit: cover;
        z-index: 0;
      }}
      .overlay {{
        position: absolute;
        top: 0; left: 0;
        width: {width}px;
        height: {height}px;
        z-index: 10;
        pointer-events: none;
        opacity: 0;
      }}
      {overlay_css}
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="{duration}"
      data-width="{width}"
      data-height="{height}"
    >
      <video
        id="bg-v"
        class="clip bg-video"
        data-start="0"
        data-track-index="0"
        src="source.mp4"
        muted
        playsinline
      ></video>
      <audio
        id="bg-a"
        class="clip"
        data-start="0"
        data-track-index="2"
        src="source.mp4"
        data-volume="1"
      ></audio>
{overlay_html}
    </div>

    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
{overlay_gsap}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""

# ─── Quote / slogan ─────────────────────────────────────────────────

QUOTE_CSS = """
/* quote / slogan: full-width kinetic typography */
.ovl-quote .ovl-bg-top {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 67%;
  background: linear-gradient(180deg,
    rgba(8, 12, 24, 0.92) 0%,
    rgba(8, 12, 24, 0.78) 55%,
    rgba(8, 12, 24, 0) 100%);
}
.ovl-quote .ovl-bg-bottom {
  position: absolute;
  bottom: 0; left: 0;
  width: 100%;
  height: 67%;
  background: linear-gradient(0deg,
    rgba(8, 12, 24, 0.93) 0%,
    rgba(8, 12, 24, 0.78) 55%,
    rgba(8, 12, 24, 0) 100%);
}
.ovl-quote .ovl-content-top {
  position: absolute;
  top: 12%;
  left: 0; right: 0;
  text-align: center;
}
.ovl-quote .ovl-content-bottom {
  position: absolute;
  bottom: 16%;
  left: 0; right: 0;
  text-align: center;
}
.ovl-quote .quote-line {
  font-size: var(--qs-fs, 140px);
  font-weight: 800;
  letter-spacing: 6px;
  line-height: 1.2;
  color: #fff;
  text-shadow: 0 6px 24px rgba(0,0,0,0.85);
  opacity: 0;
  transform: translateY(60px);
  margin-bottom: 30px;
}
.ovl-quote .quote-line.accent { color: #ffeb00; }
.ovl-quote .quote-line:last-child { margin-bottom: 0; }
"""

def render_quote(o):
    """Render a quote/slogan overlay: HTML, GSAP entrance/exit."""
    is_slogan = o["type"] == "slogan"
    position = o.get("position", "bottom" if is_slogan else "top")
    lines = o["lines"]
    if not isinstance(lines, list) or not (1 <= len(lines) <= 2):
        raise ValueError(f"{o['id']}: lines must be a list of 1-2 strings")
    accent = o.get("accent")
    if accent is None:
        # Default: last line accented.
        accent = [False] * (len(lines) - 1) + [True]
    if len(accent) != len(lines):
        raise ValueError(f"{o['id']}: accent length must match lines length")
    base_fs = o.get("font_size", 170 if is_slogan else 140)

    line_divs = "\n          ".join(
        f'<div class="quote-line{" accent" if a else ""}" id="{o["id"]}-l{i+1}">{html_escape(line)}</div>'
        for i, (line, a) in enumerate(zip(lines, accent))
    )
    html = f"""\
      <div id="{o['id']}" class="clip overlay ovl-quote" \
data-start="{o['start']}" data-duration="{o['duration']}" data-track-index="1" \
style="--qs-fs: {base_fs}px">
        <div class="ovl-bg-{position}"></div>
        <div class="ovl-content-{position}">
          {line_divs}
        </div>
      </div>"""

    s = float(o["start"])
    e = s + float(o["duration"])
    gsap_lines = [
        f'tl.to("#{o["id"]}", {{ opacity: 1, duration: 0.4, ease: "power2.out" }}, {s:.3f});',
    ]
    for i in range(len(lines)):
        offset = 0.2 + i * 0.5
        ease = "power3.out" if i == 0 else "expo.out"
        gsap_lines.append(
            f'tl.to("#{o["id"]}-l{i+1}", {{ y: 0, opacity: 1, duration: 0.7, ease: "{ease}" }}, {s + offset:.3f});'
        )
    # Exit only if this isn't the final overlay landing at the very end.
    if e < float(o.get("_total_duration", 1e9)) - 0.5:
        gsap_lines.append(
            f'tl.to("#{o["id"]}", {{ opacity: 0, duration: 0.5, ease: "power2.in" }}, {e - 0.5:.3f});'
        )
    return html, "\n      ".join(gsap_lines)


# ─── Callout ────────────────────────────────────────────────────────

CALLOUT_CSS = """
/* callout: small anchored annotation panel */
.ovl-callout {
  /* position controlled by inline style based on anchor */
}
.ovl-callout .callout-box {
  position: absolute;
  background: rgba(8, 12, 24, 0.88);
  border-left: 6px solid #ffeb00;
  padding: 28px 38px;
  border-radius: 8px;
  max-width: 720px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  opacity: 0;
  transform: translateY(20px);
}
.ovl-callout .callout-text {
  color: #fff;
  font-size: 56px;
  font-weight: 700;
  line-height: 1.2;
}
.ovl-callout .callout-subtext {
  color: rgba(255, 255, 255, 0.7);
  font-size: 36px;
  font-weight: 500;
  margin-top: 14px;
  letter-spacing: 1px;
}
.ovl-callout .anchor-top-left .callout-box     { top: 60px;    left: 60px; }
.ovl-callout .anchor-top-right .callout-box    { top: 60px;    right: 60px; }
.ovl-callout .anchor-bottom-left .callout-box  { bottom: 80px; left: 60px; }
.ovl-callout .anchor-bottom-right .callout-box { bottom: 80px; right: 60px; }
.ovl-callout .anchor-bottom-center .callout-box {
  bottom: 80px; left: 50%; transform: translate(-50%, 20px);
}
"""

def render_callout(o):
    anchor = o.get("anchor", "top-right")
    valid_anchors = {"top-left", "top-right", "bottom-left",
                     "bottom-right", "bottom-center"}
    if anchor not in valid_anchors:
        raise ValueError(f"{o['id']}: anchor must be one of {valid_anchors}")
    text = o["text"]
    subtext = o.get("subtext")
    text_lines = text if isinstance(text, list) else [text]
    text_html = "<br>".join(html_escape(t) for t in text_lines)
    sub_html = (
        f'<div class="callout-subtext">{html_escape(subtext)}</div>'
        if subtext else ""
    )

    html = f"""\
      <div id="{o['id']}" class="clip overlay ovl-callout anchor-{anchor}" \
data-start="{o['start']}" data-duration="{o['duration']}" data-track-index="1">
        <div class="callout-box" id="{o['id']}-box">
          <div class="callout-text">{text_html}</div>
          {sub_html}
        </div>
      </div>"""

    s = float(o["start"])
    e = s + float(o["duration"])
    gsap_lines = [
        f'tl.to("#{o["id"]}", {{ opacity: 1, duration: 0.3 }}, {s:.3f});',
        f'tl.to("#{o["id"]}-box", {{ y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }}, {s + 0.15:.3f});',
    ]
    if e < float(o.get("_total_duration", 1e9)) - 0.5:
        gsap_lines.append(
            f'tl.to("#{o["id"]}", {{ opacity: 0, duration: 0.4, ease: "power2.in" }}, {e - 0.4:.3f});'
        )
    return html, "\n      ".join(gsap_lines)


# ─── Custom ─────────────────────────────────────────────────────────

CUSTOM_PLACEHOLDER = """\
<!--
  Custom overlay fragment for {id}.

  Three sections, each delimited by a unique marker comment:

    BEGIN-OVERLAY-HTML / END-OVERLAY-HTML — inner HTML for the clip
    BEGIN-OVERLAY-CSS  / END-OVERLAY-CSS  — CSS (scope to #{id})
    BEGIN-OVERLAY-JS   / END-OVERLAY-JS   — GSAP tweens on `tl`

  Patterns:
    1. CSS selectors should be scoped under #{id} so they don't leak.
    2. JS tweens go on `tl` (root timeline already in scope) at
       time positions >= overlay start.
    3. Set initial CSS state for animated elements so they're hidden
       until their tween fires.

  See ~/.claude/skills/video-overlay/references/custom_overlay_recipes.md
  for ready-made patterns.
-->

<!-- BEGIN-OVERLAY-HTML -->
<div class="todo-marker">CUSTOM OVERLAY: replace this placeholder</div>
<!-- END-OVERLAY-HTML -->

<!-- BEGIN-OVERLAY-CSS -->
#{id} .todo-marker {{
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 100, 100, 0.95);
  color: #fff;
  font-size: 60px;
  font-weight: 800;
  padding: 30px 50px;
  border-radius: 8px;
}}
<!-- END-OVERLAY-CSS -->

<!-- BEGIN-OVERLAY-JS -->
// Tweens for #{id}, anchored to the overlay's [start, end] window.
// Replace these with real entrance/exit animations for your content.
tl.to("#{id}", {{ opacity: 1, duration: 0.4 }}, {start});
tl.to("#{id}", {{ opacity: 0, duration: 0.4 }}, {exit_start});
<!-- END-OVERLAY-JS -->
"""

OVERLAY_HTML_RE = re.compile(
    r"<!--\s*BEGIN-OVERLAY-HTML\s*-->(?P<v>.*?)<!--\s*END-OVERLAY-HTML\s*-->",
    re.DOTALL,
)
OVERLAY_CSS_RE = re.compile(
    r"<!--\s*BEGIN-OVERLAY-CSS\s*-->(?P<v>.*?)<!--\s*END-OVERLAY-CSS\s*-->",
    re.DOTALL,
)
OVERLAY_JS_RE = re.compile(
    r"<!--\s*BEGIN-OVERLAY-JS\s*-->(?P<v>.*?)<!--\s*END-OVERLAY-JS\s*-->",
    re.DOTALL,
)


def render_custom(o, project_dir):
    """Inline a custom overlay's HTML, CSS, and JS from a fragment file.
    If the file is missing, write a placeholder and treat it as the source.
    """
    if "html" not in o:
        raise ValueError(f"{o['id']}: custom overlay needs `html` field "
                         "(path to fragment file)")
    frag_path = project_dir / o["html"]
    frag_path.parent.mkdir(parents=True, exist_ok=True)
    if not frag_path.exists():
        # Write placeholder.
        frag_path.write_text(
            CUSTOM_PLACEHOLDER.format(
                id=o["id"],
                start=f'{float(o["start"]):.3f}',
                exit_start=f'{float(o["start"]) + float(o["duration"]) - 0.4:.3f}',
            ),
            encoding="utf-8",
        )
        print(
            f"   placeholder written → {frag_path.relative_to(project_dir)}",
            file=sys.stderr,
        )

    text = frag_path.read_text(encoding="utf-8")
    html_m = OVERLAY_HTML_RE.search(text)
    if not html_m:
        raise ValueError(
            f"{o['id']}: fragment file {frag_path} is missing the "
            "BEGIN-OVERLAY-HTML / END-OVERLAY-HTML markers."
        )
    inner_html = html_m.group("v").strip()
    css_m = OVERLAY_CSS_RE.search(text)
    css = css_m.group("v").strip() if css_m else ""
    js_m = OVERLAY_JS_RE.search(text)
    js = js_m.group("v").strip() if js_m else ""

    html = f"""\
      <div id="{o['id']}" class="clip overlay ovl-custom" \
data-start="{o['start']}" data-duration="{o['duration']}" data-track-index="1">
        {inner_html}
      </div>"""

    return html, css, js


# ─── Glue ───────────────────────────────────────────────────────────

def html_escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
         .replace("<", "&lt;")
         .replace(">", "&gt;")
    )


def parse_size(s: str):
    m = re.match(r"^(\d+)x(\d+)$", s.strip())
    if not m:
        raise ValueError(f"size must look like '1920x1080', got {s!r}")
    return int(m.group(1)), int(m.group(2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec", help="path to spec.json")
    ap.add_argument("--out", help="project directory name (overrides spec.name)")
    ap.add_argument("--force", action="store_true",
                    help="overwrite an existing project directory")
    args = ap.parse_args()

    spec_path = Path(args.spec).resolve()
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    spec_dir = spec_path.parent

    name = args.out or spec.get("name") or spec_dir.name
    project_dir = (spec_dir / name).resolve()

    width, height = parse_size(spec.get("size", "1920x1080"))
    duration = float(spec["duration"])
    source = (spec_dir / spec["source_video"]).resolve()
    if not source.exists():
        sys.exit(f"source video not found: {source}")

    if project_dir.exists() and not args.force:
        # Allow re-scaffold of index.html only.
        if not (project_dir / "package.json").exists():
            sys.exit(
                f"{project_dir} exists but is not a HyperFrames project; "
                "pass --force to overwrite."
            )
        print(f"project exists at {project_dir}; refreshing index.html",
              file=sys.stderr)
    else:
        if project_dir.exists() and args.force:
            shutil.rmtree(project_dir)
        # Run npx hyperframes init in the parent dir, capturing output.
        print(f"initializing HyperFrames project at {project_dir}…",
              file=sys.stderr)
        result = subprocess.run(
            ["npx", "--yes", "hyperframes", "init",
             "--name", name,
             "--width", str(width),
             "--height", str(height)],
            cwd=spec_dir, capture_output=True, text=True,
        )
        if result.returncode != 0:
            sys.stderr.write(result.stderr)
            sys.exit(result.returncode)
        # init creates dir under spec_dir/<name>; if name has spaces/CJK,
        # init still uses it as-is. Confirm and flatten if needed.
        if not project_dir.exists():
            sys.exit(f"hyperframes init did not produce {project_dir}")

    # Symlink source.mp4 (replace if exists).
    link = project_dir / "source.mp4"
    if link.is_symlink() or link.exists():
        link.unlink()
    rel_source = os.path.relpath(source, project_dir)
    link.symlink_to(rel_source)
    print(f"   linked source.mp4 → {rel_source}", file=sys.stderr)

    # Render overlays.
    overlay_html_blocks = []
    overlay_css_blocks = []
    overlay_gsap_blocks = []
    custom_js_blocks = []
    for o in spec["overlays"]:
        o["_total_duration"] = duration
        otype = o["type"]
        if otype in ("quote", "slogan"):
            html, gsap = render_quote(o)
            overlay_html_blocks.append(html)
            overlay_gsap_blocks.append(gsap)
            if QUOTE_CSS not in overlay_css_blocks:
                overlay_css_blocks.append(QUOTE_CSS)
        elif otype == "callout":
            html, gsap = render_callout(o)
            overlay_html_blocks.append(html)
            overlay_gsap_blocks.append(gsap)
            if CALLOUT_CSS not in overlay_css_blocks:
                overlay_css_blocks.append(CALLOUT_CSS)
        elif otype == "custom":
            html, css, js = render_custom(o, project_dir)
            overlay_html_blocks.append(html)
            if css:
                overlay_css_blocks.append(f"\n/* custom: {o['id']} */\n{css}")
            if js:
                custom_js_blocks.append(f"\n      // custom: {o['id']}\n      {js}")
        else:
            sys.exit(f"unknown overlay type: {otype!r} on {o.get('id')}")

    overlay_gsap_blocks.extend(custom_js_blocks)

    final_html = ROOT_HTML.format(
        width=width,
        height=height,
        duration=duration,
        overlay_css="\n      ".join(overlay_css_blocks),
        overlay_html="\n".join(overlay_html_blocks),
        overlay_gsap="      " + "\n      ".join(overlay_gsap_blocks),
    )

    (project_dir / "index.html").write_text(final_html, encoding="utf-8")
    print(f"   wrote {project_dir / 'index.html'}", file=sys.stderr)

    print(f"\n✓ Project ready at {project_dir}", file=sys.stderr)
    print(f"  cd {project_dir.relative_to(Path.cwd()) if project_dir.is_relative_to(Path.cwd()) else project_dir}",
          file=sys.stderr)
    print("  npm run check    # lint + validate + inspect", file=sys.stderr)
    print("  npm run render   # render to MP4", file=sys.stderr)


if __name__ == "__main__":
    main()
