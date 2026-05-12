#!/usr/bin/env python3
"""Build hyperframes projects for all clips from segments.json.

Each clip gets: AI cover (full-frame) + body video + outlined HTML/CSS
captions + chapter chip + optional illustrations + end-card CTA.
Renders to ONE final encode per clip (no decode/encode cascade).

This is a TEMPLATE — copy it into your project and edit:
  - ROOT (project directory containing segments.json + output/)
  - CHAPTER (per-clip chapter chip text)
  - SYNC (per-clip sync offset; ZERO when clips were accurate-cut)
  - illustrations.py (sibling file: per-clip illustration definitions)

Sources read from `<ROOT>/output/`:
  clip_NN_slug.mp4           (or _v2.mp4 if re-cropped)
  cover_NN_slug.png
  clip_NN_slug.zh-CN.burn.srt

Targets written under `<ROOT>/hf_clip_NN/1080/`.

Run with `python3 build_hf_clips.py` after editing the constants below.
"""
import json, os, re, shutil, subprocess, sys
from pathlib import Path

# illustrations.py sits next to this script (or set sys.path accordingly)
sys.path.insert(0, str(Path(__file__).parent))
from illustrations import render_for_clip, ILLUSTRATIONS

# ── EDIT THESE PER PROJECT ──────────────────────────────────────
ROOT = Path("/PATH/TO/YOUR/PROJECT")
SEG = json.load(open(ROOT / "segments.json"))

# Per-clip sync offset (seconds). Use 0.0 when clips were accurate-cut
# with `segment.py --reencode` (the recommended default). If you used
# stream-copy and have keyframe-snap drift, fill in
# `requested_start − nearest_preceding_keyframe` per clip here.
SYNC = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.0}

# Per-clip chapter chip text — short label for the top-left chip
CHAPTER = {
    1: "第一段 · ...",
    2: "第二段 · ...",
    3: "第三段 · ...",
    4: "第四段 · ...",
    5: "第五段 · ...",
}

# Source video suffix. After re-crop, you typically have clip_NN_slug_v2.mp4
# (the cropped vertical version). Use "" to point at clip_NN_slug.mp4.
CLIP_SUFFIX = "_v2"
# ────────────────────────────────────────────────────────────────

COVER_SCENE_DUR = 1.5
CTA_SCENE_DUR = 3.24


def parse_ts(t):
    h, m, s = t.split(":")
    return int(h)*3600 + int(m)*60 + float(s)


def srt_to_cues(srt_path, cover_offset, sync_offset):
    TS = re.compile(r"(\d{2}):(\d{2}):(\d{2}),(\d{3})")
    def to_s(g):
        h,m,s,ms = map(int, g.groups())
        return h*3600 + m*60 + s + ms/1000.0
    cues = []
    for b in re.split(r"\n\s*\n", srt_path.read_text(encoding="utf-8").strip()):
        lines = b.strip().split("\n")
        if len(lines) < 3:
            continue
        m = list(TS.finditer(lines[1]))
        if len(m) != 2:
            continue
        text = "\n".join(lines[2:]).strip()
        if not text:
            continue
        cues.append({
            "text": text,
            "start": to_s(m[0]) + cover_offset + sync_offset,
            "end":   to_s(m[1]) + cover_offset + sync_offset,
        })
    return cues


HTML_TEMPLATE = '''\
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        margin: 0;
        width: 1080px;
        height: 1920px;
        overflow: hidden;
        background: #0c0d10;
        font-family: "PingFang SC", "Heiti SC", "Noto Sans SC", sans-serif;
        color: #f4f4f5;
        -webkit-font-smoothing: antialiased;
      }
      #cover { position: absolute; inset: 0; background: #0c0d10; overflow: hidden; }
      #cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      #video { position: absolute; inset: 0; width: 1080px; height: 1920px; object-fit: cover; }
      #caption {
        position: absolute; left: 0; right: 0; bottom: 240px;
        height: 240px; z-index: 10; overflow: visible;
      }
      #caption .bubble {
        position: absolute; top: 50%; left: 50%;
        display: inline-block;
        padding: 0 24px;
        font-size: 56px;
        line-height: 1.18;
        font-weight: 900;
        color: #ffffff;
        max-width: 1020px;
        text-align: center;
        -webkit-text-stroke: 5px #000;
        paint-order: stroke fill;
        text-shadow: 0 6px 12px rgba(0,0,0,0.55), 0 0 4px rgba(0,0,0,0.6);
        letter-spacing: 0.01em;
      }
      #chapter {
        position: absolute; top: 80px; left: 60px; z-index: 9;
        display: inline-flex; align-items: center; gap: 12px;
        padding: 12px 20px;
        background: rgba(12,13,16,0.78);
        border: 1px solid rgba(199,150,85,0.4);
        border-radius: 999px;
      }
      #chapter .dot { width: 10px; height: 10px; border-radius: 999px; background: #e8b063; }
      #chapter .text {
        font-size: 24px; color: #f4f4f5; letter-spacing: 0.04em; font-weight: 600;
      }
      #cta {
        position: absolute; inset: 0;
        background: radial-gradient(ellipse at 50% 50%, #1f1108 0%, #0c0d10 60%), #0c0d10;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        padding: 0 120px; gap: 40px;
      }
      #cta .arrow { font-size: 96px; color: #c79655; line-height: 1; }
      #cta .cta-line-1 { font-size: 88px; font-weight: 800; color: #f4f4f5; letter-spacing: -0.01em; }
      #cta .cta-line-2 { font-size: 44px; font-weight: 600; color: #e8b063; letter-spacing: 0.04em; }
      #cta .cta-foot { font-size: 26px; color: #6b6b71; letter-spacing: 0.12em; margin-top: 24px; }
      @@ILL_CSS@@
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="@@TOTAL_DUR@@"
         data-width="1080" data-height="1920">
      <div id="cover" class="clip" data-start="0" data-duration="@@COVER_DUR@@" data-track-index="1" data-layout-allow-overflow>
        <img src="cover.png" alt="" data-layout-allow-overflow />
      </div>
      <video id="video" class="clip" data-start="@@BODY_START@@" data-duration="@@BODY_DUR@@" data-track-index="0"
             src="clip.mp4" muted playsinline></video>
      <audio id="audio" class="clip" data-start="@@BODY_START@@" data-duration="@@BODY_DUR@@" data-track-index="2"
             src="clip.mp4" data-volume="1"></audio>
      <div id="chapter" class="clip" data-start="@@BODY_START@@" data-duration="@@BODY_DUR@@" data-track-index="3">
        <span class="dot"></span>
        <span class="text">@@CHAPTER_TEXT@@</span>
      </div>
      <div id="caption" class="clip" data-start="@@BODY_START@@" data-duration="@@BODY_DUR@@" data-track-index="4"></div>

@@ILL_HTML@@

      <div id="cta" class="clip" data-start="@@CTA_START@@" data-duration="@@CTA_DUR@@" data-track-index="1">
        <div class="cta-line-1">关注王建硕</div>
        <div class="arrow">↓</div>
        <div class="cta-line-2">微信公众号 · 视频号</div>
        <div class="cta-foot">AI 炼金术 · 持续更新</div>
      </div>
    </div>
    <script id="captions-data" type="application/json">
@@CAPTIONS_JSON@@
    </script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      tl.from("#chapter", { x: -40, opacity: 0, duration: 0.5, ease: "expo.out" }, @@CHAPTER_IN@@);
      tl.to("#chapter", { opacity: 0, duration: 0.4, ease: "power2.in" }, @@CHAPTER_OUT@@);

      const captionEl = document.getElementById("caption");
      const groups = JSON.parse(document.getElementById("captions-data").textContent);
      const bubbles = groups.map((g, i) => {
        const b = document.createElement("span");
        b.className = "bubble";
        b.id = "cap-" + i;
        b.textContent = g.text;
        b.style.opacity = "0";
        captionEl.appendChild(b);
        return b;
      });
      gsap.set(bubbles, { xPercent: -50, yPercent: -50 });
      groups.forEach((g, i) => {
        const el = bubbles[i];
        tl.fromTo(el,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" },
          g.start
        );
        const exitStart = Math.max(g.start + 0.18, g.end - 0.12);
        tl.to(el, { opacity: 0, duration: 0.12, ease: "power2.in" }, exitStart);
        tl.set(el, { opacity: 0 }, g.end);
      });

      tl.from("#cta .cta-line-1", { y: 40, opacity: 0, duration: 0.5, ease: "expo.out" }, @@CTA_IN_1@@);
      tl.from("#cta .arrow", { y: -30, opacity: 0, duration: 0.4, ease: "power3.out" }, @@CTA_IN_2@@);
      tl.from("#cta .cta-line-2", { y: 30, opacity: 0, duration: 0.5, ease: "power2.out" }, @@CTA_IN_3@@);
      tl.from("#cta .cta-foot", { opacity: 0, duration: 0.4, ease: "power2.out" }, @@CTA_IN_4@@);

      // ── illustrations ──
@@ILL_GSAP@@

      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''


def build_clip(seg):
    sid = seg["id"]
    slug = seg["slug"]
    body_dur = parse_ts(seg["end"]) - parse_ts(seg["start"])
    body_start = COVER_SCENE_DUR
    cta_start = body_start + body_dur
    total_dur = cta_start + CTA_SCENE_DUR

    proj = ROOT / f"hf_clip_{sid:02d}"
    proj.mkdir(exist_ok=True)
    work = proj / "1080"
    if not work.exists():
        # init hyperframes scaffold
        subprocess.run(["npx", "hyperframes", "init"], cwd=proj, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    work.mkdir(exist_ok=True)

    # Copy media + cover. CLIP_SUFFIX="_v2" if re-cropped vertical, else "".
    shutil.copy(ROOT / "output" / f"clip_{sid:02d}_{slug}{CLIP_SUFFIX}.mp4", work / "clip.mp4")
    shutil.copy(ROOT / "output" / f"cover_{sid:02d}_{slug}.png", work / "cover.png")

    # Build captions json
    cues = srt_to_cues(
        ROOT / "output" / f"clip_{sid:02d}_{slug}.zh-CN.burn.srt",
        cover_offset=COVER_SCENE_DUR,
        sync_offset=SYNC[sid],
    )
    captions_json = json.dumps(cues, ensure_ascii=False, indent=2)

    ill_css, ill_html, ill_gsap = render_for_clip(sid, body_offset=body_start)
    subs = {
        "@@TOTAL_DUR@@": f"{total_dur:.2f}",
        "@@COVER_DUR@@": f"{COVER_SCENE_DUR + 0.1:.2f}",
        "@@BODY_START@@": f"{body_start:.2f}",
        "@@BODY_DUR@@": f"{body_dur:.2f}",
        "@@CHAPTER_TEXT@@": CHAPTER[sid],
        "@@CHAPTER_IN@@": f"{body_start + 0.4:.2f}",
        "@@CHAPTER_OUT@@": f"{body_start + 4.0:.2f}",
        "@@CTA_START@@": f"{cta_start:.2f}",
        "@@CTA_DUR@@": f"{CTA_SCENE_DUR:.2f}",
        "@@CTA_IN_1@@": f"{cta_start + 0.14:.2f}",
        "@@CTA_IN_2@@": f"{cta_start + 0.34:.2f}",
        "@@CTA_IN_3@@": f"{cta_start + 0.54:.2f}",
        "@@CTA_IN_4@@": f"{cta_start + 0.84:.2f}",
        "@@CAPTIONS_JSON@@": captions_json,
        "@@ILL_CSS@@": ill_css,
        "@@ILL_HTML@@": ill_html,
        "@@ILL_GSAP@@": ill_gsap,
    }
    html = HTML_TEMPLATE
    for k, v in subs.items():
        html = html.replace(k, v)
    (work / "index.html").write_text(html, encoding="utf-8")
    print(f"[clip {sid}] built {work} ({body_dur:.1f}s body, {len(cues)} cues, sync +{SYNC[sid]:.2f}s)")


for s in SEG["segments"]:
    build_clip(s)
