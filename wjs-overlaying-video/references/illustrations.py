"""Per-clip illustration data. Each illustration injects:
- CSS rules under #ill-<key>
- HTML div with class="clip" data-start/data-duration
- GSAP entry + exit tweens

Pattern catalog (re-used across clips):
- 'stack' — top-right vertical list card (Pattern A from clip 1)
- 'hammer' — center BIG equation/text overlay (Pattern B from clip 1)
"""

# Body times here are RELATIVE to body start (i.e., after the 1.5s cover scene).
# At build time, +1.5s will be added so the illustration syncs with the audio.

ILLUSTRATIONS = {
    # ── clip 1 — LLM 是新的编译器 ───────────────────────────────
    1: [
        {
            "key": "stack",
            "pattern": "stack",
            "body_start": 0.3,
            "body_end": 9.0,
            "label": "我们写的层级",
            "rows": [
                {"text": "自然语言", "accent": True},
                {"text": "Python",   "accent": False},
                {"text": "C",        "accent": False},
                {"text": "Assembly", "accent": False},
            ],
        },
        {
            "key": "hammer",
            "pattern": "hammer",
            "body_start": 10.8,
            "body_end": 14.6,
            "left": "LLM",
            "equals": "=",
            "right": "新编译器",
            "foot": "自然语言 → Python → 汇编",
        },
    ],
    # ── clip 2 — 用 AI 的三层境界 ────────────────────────────────
    2: [
        {
            "key": "levels",
            "pattern": "stack",
            "body_start": 14.0,
            "body_end": 50.0,
            "label": "AI 使用三层",
            "rows": [
                {"text": "第一层 · 聊天",  "accent": True, "sub": "90% 在这"},
                {"text": "第二层 · 单文件 .md", "accent": False},
                {"text": "第三层 · 多文件工程", "accent": False},
            ],
        },
    ],
    # ── clip 3 — 程序员的最大风险 ─────────────────────────────────
    3: [
        {
            "key": "drive",
            "pattern": "hammer",
            "body_start": 30.0,
            "body_end": 38.0,
            "left": "AI ≠",
            "equals": "  ",
            "right": "更快的轿子",
            "foot": "你必须学开车",
        },
    ],
    # ── clip 4 — 它自己改自己 ─────────────────────────────────────
    4: [
        {
            "key": "loop",
            "pattern": "stack",
            "body_start": 50.0,
            "body_end": 100.0,
            "label": "自我迭代闭环",
            "rows": [
                {"text": "用户反馈",    "accent": False},
                {"text": "GitHub Issue", "accent": False},
                {"text": "Cloud Code",   "accent": False},
                {"text": "TestFlight 5 分钟",  "accent": True},
            ],
        },
    ],
    # ── clip 5 — Token = 新 GDP ────────────────────────────────
    5: [
        {
            "key": "gdp",
            "pattern": "hammer",
            "body_start": 56.0,
            "body_end": 65.0,
            "left": "Token",
            "equals": "=",
            "right": "新 GDP",
            "foot": "看 token 烧多少 · 不是看烧了多少钱",
        },
    ],
}


CSS_STACK = """\
#ill-{key} {{
  position: absolute;
  top: 160px;
  right: 40px;
  z-index: 8;
}}
#ill-{key} .ill-card {{
  background: rgba(12, 13, 16, 0.88);
  backdrop-filter: blur(12px);
  border: 2px solid rgba(199, 150, 85, 0.6);
  border-radius: 14px;
  padding: 22px 26px;
  min-width: 320px;
  max-width: 380px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}}
#ill-{key} .ill-card-label {{
  font-size: 22px;
  color: #c79655;
  letter-spacing: 0.1em;
  font-weight: 700;
  margin-bottom: 18px;
  text-transform: uppercase;
}}
#ill-{key} .ill-row {{
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
}}
#ill-{key} .ill-row:last-child {{ margin-bottom: 0; }}
#ill-{key} .ill-tag {{
  display: inline-block;
  padding: 10px 18px;
  font-size: 30px;
  font-weight: 800;
  color: #f4f4f5;
  background: rgba(255, 255, 255, 0.08);
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  min-width: 280px;
  text-align: center;
  letter-spacing: 0.02em;
}}
#ill-{key} .ill-tag.accent {{
  color: #0c0d10;
  background: #e8b063;
  border-color: #e8b063;
  font-weight: 900;
}}
#ill-{key} .ill-sub {{
  font-size: 20px;
  color: #c79655;
  font-weight: 700;
  margin-top: 4px;
  letter-spacing: 0.04em;
}}
"""

CSS_HAMMER = """\
#ill-{key} {{
  position: absolute;
  top: 360px;
  left: 0;
  right: 0;
  z-index: 12;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 40px;
}}
#ill-{key} .ill-h-content {{
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 36px 56px;
  background: linear-gradient(180deg, rgba(31, 17, 8, 0.95) 0%, rgba(12, 13, 16, 0.95) 100%);
  border: 3px solid #e8b063;
  border-radius: 24px;
  box-shadow: 0 16px 64px rgba(232, 176, 99, 0.18), 0 8px 32px rgba(0, 0, 0, 0.6);
}}
#ill-{key} .ill-h-eq {{
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 88px;
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 1;
}}
#ill-{key} .ill-h-left {{ color: #ffffff; }}
#ill-{key} .ill-h-equals {{ color: #e8b063; font-size: 100px; }}
#ill-{key} .ill-h-right {{ color: #e8b063; }}
#ill-{key} .ill-h-foot {{
  font-size: 28px;
  font-weight: 600;
  color: #9a9aa0;
  letter-spacing: 0.04em;
  text-align: center;
}}
"""


def render_html_stack(ill):
    rows = []
    for r in ill["rows"]:
        sub_html = f'<div class="ill-sub">{r.get("sub", "")}</div>' if r.get("sub") else ""
        tag_cls = "ill-tag accent" if r.get("accent") else "ill-tag"
        rows.append(f'<div class="ill-row"><span class="{tag_cls}">{r["text"]}</span>{sub_html}</div>')
    return f'''\
      <div id="ill-{ill["key"]}" class="clip" data-start="{ill["start"]:.2f}" data-duration="{ill["dur"]:.2f}" data-track-index="5">
        <div class="ill-card">
          <div class="ill-card-label">{ill["label"]}</div>
          {"".join(rows)}
        </div>
      </div>'''


def render_html_hammer(ill):
    return f'''\
      <div id="ill-{ill["key"]}" class="clip" data-start="{ill["start"]:.2f}" data-duration="{ill["dur"]:.2f}" data-track-index="6">
        <div class="ill-h-content">
          <div class="ill-h-eq">
            <span class="ill-h-left">{ill["left"]}</span>
            <span class="ill-h-equals">{ill["equals"]}</span>
            <span class="ill-h-right">{ill["right"]}</span>
          </div>
          <div class="ill-h-foot">{ill["foot"]}</div>
        </div>
      </div>'''


def render_gsap_stack(ill):
    k = ill["key"]
    start = ill["start"]
    end = start + ill["dur"]
    n_rows = len(ill["rows"])
    return f'''\
      tl.fromTo("#ill-{k}",
        {{ x: 360, opacity: 0 }},
        {{ x: 0, opacity: 1, duration: 0.6, ease: "expo.out" }},
        {start + 0.2:.2f}
      );
      tl.from("#ill-{k} .ill-row", {{ y: 20, opacity: 0, duration: 0.4, stagger: 0.12, ease: "power2.out" }}, {start + 0.4:.2f});
      tl.to("#ill-{k}", {{ x: 360, opacity: 0, duration: 0.5, ease: "power2.in" }}, {end - 0.5:.2f});'''


def render_gsap_hammer(ill):
    k = ill["key"]
    start = ill["start"]
    end = start + ill["dur"]
    return f'''\
      tl.fromTo("#ill-{k}",
        {{ scale: 0.85, opacity: 0 }},
        {{ scale: 1.0, opacity: 1, duration: 0.45, ease: "back.out(1.6)" }},
        {start:.2f}
      );
      tl.from("#ill-{k} .ill-h-left", {{ x: -40, opacity: 0, duration: 0.4, ease: "expo.out" }}, {start + 0.2:.2f});
      tl.from("#ill-{k} .ill-h-equals", {{ scale: 0, opacity: 0, duration: 0.4, ease: "back.out(2)" }}, {start + 0.4:.2f});
      tl.from("#ill-{k} .ill-h-right", {{ x: 40, opacity: 0, duration: 0.4, ease: "expo.out" }}, {start + 0.6:.2f});
      tl.from("#ill-{k} .ill-h-foot", {{ y: 20, opacity: 0, duration: 0.4, ease: "power2.out" }}, {start + 0.8:.2f});
      tl.to("#ill-{k}", {{ scale: 1.05, opacity: 0, duration: 0.45, ease: "power2.in" }}, {end - 0.45:.2f});'''


def render_for_clip(clip_id, body_offset):
    """Return (css, html, gsap) blobs for a clip. body_offset is the
    cover-scene duration (1.5s) added to every illustration's body time
    so timings land on the composition timeline."""
    items = ILLUSTRATIONS.get(clip_id, [])
    css, html, gsap = [], [], []
    for ill in items:
        ill = dict(ill)
        ill["start"] = ill["body_start"] + body_offset
        ill["dur"] = ill["body_end"] - ill["body_start"]
        if ill["pattern"] == "stack":
            css.append(CSS_STACK.format(key=ill["key"]))
            html.append(render_html_stack(ill))
            gsap.append(render_gsap_stack(ill))
        elif ill["pattern"] == "hammer":
            css.append(CSS_HAMMER.format(key=ill["key"]))
            html.append(render_html_hammer(ill))
            gsap.append(render_gsap_hammer(ill))
    return "\n".join(css), "\n".join(html), "\n".join(gsap)
