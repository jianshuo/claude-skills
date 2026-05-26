#!/usr/bin/env python3
"""Build hyperframes projects for all clips from segments.json.

Each clip gets: cover (full-frame — use a FRAME FROM THE VIDEO itself, e.g. the
clip's first frame, NOT a brand-new AI painting) + body video + outlined HTML/CSS
captions + chapter chip + optional illustrations + end-card CTA.
Renders to ONE final encode per clip (no decode/encode cascade).

This is a TEMPLATE — copy it into your project and edit:
  - ROOT (project directory containing segments.json + output/)
  - CHAPTER (per-clip chapter chip text)
  - SYNC (per-clip sync offset; ZERO when clips were accurate-cut)
  - illustrations.py (sibling file: per-clip illustration definitions)

Sources read from `<ROOT>/output/`:
  clip_NN_slug.mp4           (HLG/HDR source; tone-mapped to SDR via tonemap_to_sdr)
  cover_NN_slug.png
  clip_NN_slug.asr.srt       (火山 streaming-ASR word-timed SRT)

Targets written under `<ROOT>/hf_clip_NN/1080/`.

Run with `python3 build_hf_clips.py [seg_id ...]` — pass segment ids to build
a subset (e.g. `python3 build_hf_clips.py 1`); no args builds all.
"""
import json, os, re, shutil, subprocess, sys
from pathlib import Path

# illustrations.py sits next to this script (or set sys.path accordingly)
sys.path.insert(0, str(Path(__file__).parent))
from illustrations import render_for_clip, ILLUSTRATIONS

# ── EDIT THESE PER PROJECT ──────────────────────────────────────
ROOT = Path(__file__).resolve().parent
SEG_FILE = os.environ.get("SEG_FILE", "segments.json")
SEG = json.load(open(ROOT / SEG_FILE))

# Per-clip sync offset (seconds). Use 0.0 when clips were accurate-cut
# with `segment.py --reencode` (the recommended default).
SYNC = {i: 0.0 for i in range(1, 11)}

# Per-clip chapter chip text — short label for the top-left chip
CHAPTER = {
    1: "第一段 · 效率暴涨",
    2: "第二段 · 需求与失业",
    3: "第三段 · 编程的终结",
    4: "第四段 · 差距变大",
    5: "第五段 · 一句 hello",
    6: "第六段 · 最好的职业",
    7: "第七段 · 学校禁 AI",
    8: "第八段 · 代码成艺术",
    9: "第九段 · 真有用吗",
    10: "第十段 · 驾驭层",
}

# Opener hook lines shown big over the cover (0→cover end). Each entry is a
# list of HTML lines; wrap the punch word in <span class="hk">…</span> (gold).
HOOK = {
    1: ["效率翻了一倍", "需求却涨了<span class=\"hk\">十倍</span>"],
    2: ["AI 来了", "谁会先<span class=\"hk\">失业</span>？"],
    3: ["编程", "真的要<span class=\"hk\">终结</span>了吗？"],
    4: ["AI 时代", "差距只会<span class=\"hk\">越来越大</span>"],
    5: ["一句 <span class=\"hk\">hello</span>", "就能改变什么？"],
    6: ["现在", "什么才是<span class=\"hk\">最好的职业</span>？"],
    7: ["学校为什么", "要<span class=\"hk\">禁用 AI</span>？"],
    8: ["写代码", "正在变成一门<span class=\"hk\">艺术</span>"],
    9: ["AI", "真的<span class=\"hk\">有用</span>吗？"],
    10: ["未来属于", "会<span class=\"hk\">驾驭 AI</span>的人"],
}

# Lower-third nameplate (王建硕 slides in when the speaker first appears).
NAMEPLATE_NAME = "王建硕"
NAMEPLATE_ROLE = "聊 AI · 聊创业"

# Source video suffix. Our cropped vertical clips ARE the canonical
# clip_NN_slug.mp4 (horizontal originals archived), so no suffix.
CLIP_SUFFIX = ""
# ────────────────────────────────────────────────────────────────

COVER_SCENE_DUR = 1.5
CTA_SCENE_DUR = 3.24

# Production pipeline version — bump on every change to the recipe.
# Stamped bottom-right on the end card of every clip.
SKILL_NAME = "wjs-overlaying-video"
VERSION = "v1.5"   # v1.5: 面部安全布局 — 所有文字/图形避开人脸(主体侧),图形走对侧/底部
# v1.4: 生动化 — 数据三幕动画+关键词弹跳+开场hook+人物条+Ken Burns+暗角呼吸
# v1.3: 字幕风格03 关键词高亮(金块)+思源宋体 Noto Serif SC
# v1.2: 火山流式ASR字幕 + zscale(npl=203 hable) HLG→SDR 调色

# zscale-capable ffmpeg (system Homebrew build lacks zscale/tonemap).
TM_FFMPEG = os.environ.get("TM_FFMPEG",
    str(Path.home() / "Library/Python/3.9/lib/python/site-packages/"
        "imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1"))
# Locked HLG(BT2020/arib-std-b67)->SDR(BT709) tone map. npl=203 matches the
# macOS-native (qlmanage) reference brightness; hable keeps contrast.
TONEMAP_VF = ("zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:t=linear:npl=203,"
              "format=gbrpf32le,tonemap=tonemap=hable:desat=0,"
              "zscale=t=bt709:m=bt709:p=bt709:r=tv,format=yuv420p,fps=30")


def _is_hlg_hdr(src):
    """True only for genuinely HLG/HDR sources (need tone-mapping). Clips that
    are ALREADY Rec.709 SDR (e.g. graded multicam renders, polysync output) must
    NOT be tone-mapped — running the HLG recipe on SDR washes/darkens the color.
    Detect via the video stream's color_transfer."""
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=color_transfer", "-of", "csv=p=0", str(src)],
            capture_output=True, text=True).stdout.strip().lower()
    except Exception:
        out = ""
    return out in ("arib-std-b67", "smpte2084")   # HLG / PQ


def tonemap_to_sdr(src, dst):
    """Make a render-ready body clip with DENSE keyframes (-g 30) so HyperFrames
    can seek every frame. HLG/HDR sources get the locked zscale tone-map; sources
    that are already SDR just get a straight re-encode (NO tone-map — that would
    ruin already-correct color). Skips if dst is up-to-date."""
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        print(f"  [color] reuse {dst.name} (up-to-date)")
        return
    if not _is_hlg_hdr(src):
        print(f"  [color] SDR re-encode (no tone-map) {src.name} -> {dst.name}")
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                        "-i", str(src), "-vf", "fps=30,format=yuv420p",
                        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                        "-g", "30", "-keyint_min", "30", "-movflags", "+faststart",
                        "-color_primaries", "bt709", "-color_trc", "bt709",
                        "-colorspace", "bt709",
                        "-c:a", "aac", "-b:a", "192k", str(dst)], check=True)
        return
    print(f"  [color] tonemap HLG->SDR {src.name} -> {dst.name} (zscale npl=203 hable)")
    subprocess.run([TM_FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
                    "-i", str(src), "-vf", TONEMAP_VF,
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                    "-pix_fmt", "yuv420p",
                    # dense keyframes (1/frame-second) so the HyperFrames renderer
                    # can seek every frame without freezing on sparse GOPs.
                    "-g", "30", "-keyint_min", "30", "-movflags", "+faststart",
                    "-color_primaries", "bt709", "-color_trc", "bt709",
                    "-colorspace", "bt709",
                    "-c:a", "aac", "-b:a", "192k", str(dst)], check=True)


def parse_ts(t):
    if isinstance(t, (int, float)):   # segments.json may store float seconds
        return float(t)
    h, m, s = t.split(":")
    return int(h)*3600 + int(m)*60 + float(s)


# Keyword highlight (字幕风格 03): wrap punchy QUANTITATIVE phrases in a gold
# block. Auto-selected, sparse on purpose — most cues stay clean serif white.
# Only the genuinely emphatic magnitudes: 倍数(一倍/十倍/翻倍), 大数量级(50万/
# 一亿/1,000万), 百分比(50%). Deliberately EXCLUDES generic 个/年 ("一个","20年")
# so the gold block stays meaningful, not noisy. Handles thousands-commas.
_NUM = r"[0-9０-９,，一二三四五六七八九十百千两零几]+"
_HOT_RE = re.compile(
    rf"(?:翻了?{_NUM}?[倍番]|{_NUM}\s*(?:[倍番]|万亿?|亿|％|%))"
)


def mark_keywords(text):
    """Return HTML with quantitative keywords wrapped in <span class='hot'>.
    HTML-escapes the rest so cue text never injects markup."""
    import html as _html
    out, last = [], 0
    for m in _HOT_RE.finditer(text):
        out.append(_html.escape(text[last:m.start()]))
        out.append(f'<span class="hot">{_html.escape(m.group())}</span>')
        last = m.end()
    out.append(_html.escape(text[last:]))
    return "".join(out)


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
            "html": mark_keywords(text),
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;700;900&display=swap" rel="stylesheet">
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
      /* 字幕风格 03 关键词高亮 · 思源宋体 Noto Serif SC */
      #caption .bubble {
        position: absolute; top: 50%; left: 50%;
        display: inline-block;
        padding: 0 24px;
        font-family: "Noto Serif SC", "Songti SC", "STSong", serif;
        font-size: 52px;
        line-height: 1.32;
        font-weight: 700;
        color: #ffffff;
        max-width: 980px;
        text-align: center;
        -webkit-text-stroke: 2.5px rgba(0,0,0,0.9);
        paint-order: stroke fill;
        text-shadow: 0 2px 8px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.9);
        letter-spacing: 0.01em;
      }
      #caption .bubble .hot {
        color: #1a1206;
        -webkit-text-stroke: 0;
        background: linear-gradient(180deg, #f3c877, #c79655);
        padding: 2px 12px;
        border-radius: 9px;
        margin: 0 3px;
        box-shadow: 0 3px 10px -3px rgba(232,176,99,0.6);
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
      #ver-stamp {
        position: absolute; right: 28px; bottom: 28px; z-index: 30;
        font-size: 20px; color: rgba(150,150,156,0.55);
        letter-spacing: 0.06em; font-weight: 500;
      }
      /* breathing vignette — darkens edges (legibility) + slow pulse for life */
      #vignette {
        position: absolute; inset: 0; z-index: 4; pointer-events: none;
        background: radial-gradient(ellipse 82% 72% at 50% 42%,
          transparent 52%, rgba(0,0,0,0.5) 100%);
      }
      /* opener hook — big serif line over the cover */
      #hook {
        position: absolute; inset: 0; z-index: 14;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        padding: 0 90px; text-align: center; gap: 8px;
        background: linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0.6) 100%);
      }
      #hook .hook-line {
        font-family: "Noto Serif SC", "Songti SC", serif;
        font-size: 92px; font-weight: 900; line-height: 1.22; color: #ffffff;
        -webkit-text-stroke: 2px rgba(0,0,0,0.55); paint-order: stroke fill;
        text-shadow: 0 6px 28px rgba(0,0,0,0.85);
      }
      #hook .hook-line .hk {
        color: #1a1206; -webkit-text-stroke: 0;
        background: linear-gradient(180deg, #f3c877, #c79655);
        padding: 2px 16px; border-radius: 12px;
        box-shadow: 0 6px 20px -4px rgba(232,176,99,0.7);
      }
      /* lower-third nameplate */
      #nameplate {
        position: absolute; left: 60px; bottom: 150px; z-index: 13;
      }
      #nameplate .np-bar {
        display: flex; flex-direction: column; gap: 4px;
        padding: 16px 30px 16px 22px;
        background: linear-gradient(135deg, rgba(31,17,8,0.94), rgba(12,13,16,0.92));
        border-left: 6px solid #e8b063; border-radius: 4px 16px 16px 4px;
        box-shadow: 0 12px 36px rgba(0,0,0,0.55);
      }
      #nameplate .np-name { font-size: 48px; font-weight: 800; color: #ffffff; letter-spacing: 0.02em; line-height: 1.1; }
      #nameplate .np-role { font-size: 27px; font-weight: 600; color: #e8b063; letter-spacing: 0.06em; }
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
             src="clip.mp4" muted playsinline data-layout-allow-overflow></video>
      <div id="vignette" class="clip" data-start="0" data-duration="@@CTA_START@@" data-track-index="8"></div>
      <div id="hook" class="clip" data-start="0" data-duration="@@COVER_DUR@@" data-track-index="9">
@@HOOK_LINES@@
      </div>
      <audio id="audio" class="clip" data-start="@@BODY_START@@" data-duration="@@BODY_DUR@@" data-track-index="2"
             src="clip.mp4" data-volume="1"></audio>
      <div id="chapter" class="clip" data-start="@@BODY_START@@" data-duration="@@BODY_DUR@@" data-track-index="3">
        <span class="dot"></span>
        <span class="text">@@CHAPTER_TEXT@@</span>
      </div>
      <div id="caption" class="clip" data-start="@@BODY_START@@" data-duration="@@BODY_DUR@@" data-track-index="4"></div>
      <div id="nameplate" class="clip" data-start="@@BODY_START@@" data-duration="@@NAMEPLATE_DUR@@" data-track-index="10">
        <div class="np-bar">
          <span class="np-name">@@NP_NAME@@</span>
          <span class="np-role">@@NP_ROLE@@</span>
        </div>
      </div>

@@ILL_HTML@@

      <div id="cta" class="clip" data-start="@@CTA_START@@" data-duration="@@CTA_DUR@@" data-track-index="1">
        <div class="cta-line-1">关注王建硕</div>
        <div class="arrow">↓</div>
        <div class="cta-line-2">微信公众号 · 视频号</div>
        <div class="cta-foot">聊 AI · 聊创业 · 持续更新</div>
      </div>
      <div id="ver-stamp" class="clip" data-start="@@CTA_START@@" data-duration="@@CTA_DUR@@" data-track-index="2">@@VER_STAMP@@</div>
    </div>
    <script id="captions-data" type="application/json">
@@CAPTIONS_JSON@@
    </script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      // ── opener hook (over cover) ──
      tl.fromTo("#hook .hook-line",
        { y: 46, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "expo.out", stagger: 0.12 }, 0.08);
      tl.to("#hook", { opacity: 0, duration: 0.3, ease: "power2.in" }, @@HOOK_OUT@@);
      tl.set("#hook", { opacity: 0 }, @@BODY_START@@);  // hard kill: seek past fade stays hidden

      // ── breathing vignette (slow opacity pulse, seek-safe finite repeat) ──
      tl.fromTo("#vignette",
        { opacity: 0.82 },
        { opacity: 1.0, duration: 4.5, yoyo: true, repeat: 40, ease: "sine.inOut" }, 0);

      // ── Ken Burns: slow constant push-in on the body video ──
      tl.fromTo("#video",
        { scale: 1.0 },
        { scale: 1.07, duration: @@BODY_DUR@@, ease: "none" }, @@BODY_START@@);

      // ── nameplate lower-third (slides in when speaker appears) ──
      tl.fromTo("#nameplate",
        { x: -380, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.55, ease: "expo.out" }, @@NAMEPLATE_IN@@);
      tl.to("#nameplate", { x: -380, opacity: 0, duration: 0.45, ease: "power2.in" }, @@NAMEPLATE_OUT@@);

      tl.from("#chapter", { x: -40, opacity: 0, duration: 0.5, ease: "expo.out" }, @@CHAPTER_IN@@);
      tl.to("#chapter", { opacity: 0, duration: 0.4, ease: "power2.in" }, @@CHAPTER_OUT@@);

      const captionEl = document.getElementById("caption");
      const groups = JSON.parse(document.getElementById("captions-data").textContent);
      const bubbles = groups.map((g, i) => {
        const b = document.createElement("span");
        b.className = "bubble";
        b.id = "cap-" + i;
        b.innerHTML = g.html || g.text;
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
        // kinetic keyword: gold blocks stamp in (scale+rotate spring) as the
        // bubble lands. Start exactly at g.start so there is no pre-pop frame
        // where the keyword shows full-size before snapping small (seek-safe).
        const hots = el.querySelectorAll(".hot");
        if (hots.length) {
          gsap.set(hots, { transformOrigin: "center center" });
          tl.fromTo(hots,
            { scale: 0.35, rotation: -7 },
            { scale: 1, rotation: 0, duration: 0.4, ease: "back.out(3)", stagger: 0.08 },
            g.start
          );
        }
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

    # Color-convert HLG source -> SDR clip.mp4 (locked zscale recipe), copy cover.
    tonemap_to_sdr(ROOT / "output" / f"clip_{sid:02d}_{slug}{CLIP_SUFFIX}.mp4",
                   work / "clip.mp4")
    shutil.copy(ROOT / "output" / f"cover_{sid:02d}_{slug}.png", work / "cover.png")

    # Build captions json from the 火山 streaming-ASR SRT (word-timed).
    cues = srt_to_cues(
        ROOT / "output" / f"clip_{sid:02d}_{slug}.asr.srt",
        cover_offset=COVER_SCENE_DUR,
        sync_offset=SYNC[sid],
    )
    captions_json = json.dumps(cues, ensure_ascii=False, indent=2)

    ill_css, ill_html, ill_gsap = render_for_clip(sid, body_offset=body_start)
    hook_lines = "\n".join(
        f'        <div class="hook-line">{ln}</div>' for ln in HOOK.get(sid, [])
    )
    subs = {
        "@@TOTAL_DUR@@": f"{total_dur:.2f}",
        "@@COVER_DUR@@": f"{COVER_SCENE_DUR + 0.1:.2f}",
        "@@BODY_START@@": f"{body_start:.2f}",
        "@@BODY_DUR@@": f"{body_dur:.2f}",
        "@@HOOK_LINES@@": hook_lines,
        "@@HOOK_OUT@@": f"{COVER_SCENE_DUR - 0.3:.2f}",
        "@@NAMEPLATE_DUR@@": f"{min(5.0, body_dur):.2f}",
        "@@NAMEPLATE_IN@@": f"{body_start + 0.3:.2f}",
        "@@NAMEPLATE_OUT@@": f"{body_start + 4.0:.2f}",
        "@@NP_NAME@@": NAMEPLATE_NAME,
        "@@NP_ROLE@@": NAMEPLATE_ROLE,
        "@@CHAPTER_TEXT@@": CHAPTER[sid],
        "@@CHAPTER_IN@@": f"{body_start + 0.4:.2f}",
        "@@CHAPTER_OUT@@": f"{body_start + 4.0:.2f}",
        "@@CTA_START@@": f"{cta_start:.2f}",
        "@@CTA_DUR@@": f"{CTA_SCENE_DUR:.2f}",
        "@@CTA_IN_1@@": f"{cta_start + 0.14:.2f}",
        "@@CTA_IN_2@@": f"{cta_start + 0.34:.2f}",
        "@@CTA_IN_3@@": f"{cta_start + 0.54:.2f}",
        "@@CTA_IN_4@@": f"{cta_start + 0.84:.2f}",
        "@@VER_STAMP@@": f"{SKILL_NAME} {VERSION}",
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


_only = {int(a) for a in sys.argv[1:] if a.isdigit()}
for s in SEG["segments"]:
    if _only and s["id"] not in _only:
        continue
    build_clip(s)
