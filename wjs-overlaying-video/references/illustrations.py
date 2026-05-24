"""Per-clip illustration definitions + renderer for build_hf_clips.py.

ILLUSTRATIONS[sid] = list of illustration dicts. Each dict:
  pattern: "stack" | "hammer" | "counter" | "effbeat"
  key:     unique css id suffix within the clip (e.g. "hammer", "count")
  body_start / body_end: seconds RELATIVE TO BODY (cover offset added by renderer)
  stack:   label, rows=[{text, accent}]
  hammer:  left, equals, right, foot
  counter: phases (see _counter_* below) — a 3-act data-story stat card
  effbeat: two-state ×N stamp (see _effbeat_* below)

RENDER-SAFETY RULE: HyperFrames captures frames with several parallel
workers, each seeking the GSAP timeline straight to its own frame time.
So EVERY visual state must be a deterministic function of timeline time —
driven by tweens (incl. number tweens via onUpdate) and opacity crossfades
between stacked "faces". NEVER swap textContent in a `.add()` callback:
a worker that jumps directly to t=80 may not fire a callback authored at
t=69, so the text would be wrong on that frame.
"""

ILLUSTRATIONS = {
    1: [
        # Beat A — 效率/需求 escalation stamp (upper-center)
        {"key": "eff", "pattern": "effbeat",
         "body_start": 10.2, "body_end": 19.6,
         "a_label": "效率", "a_val": "×2", "a_at": 10.5,
         "b_label": "需求", "b_val": "×5~10", "b_at": 17.0},

        # Beats B+C — 全国程序员 数据三幕 (top-right stat card)
        # phase times are body-relative, matched to the transcript:
        #   60.1 "全国也就用50万成员"  → 50万
        #   67.4 "总数应该从50万"      ┐
        #   69.9 "降到个位数…5个人"    ┘ 按逻辑该崩到 ≈5人
        #   74.6 "但实际上…从50万"     ┐
        #   79.2 "涨到800万到1,000万"  ┘ 实际暴涨 800~1,000万
        {"key": "count", "pattern": "counter",
         "body_start": 59.0, "body_end": 86.0,
         "p1_at": 59.8, "p1_to": 50,
         "p2_at": 69.6,
         "p3_at": 75.4, "p3_to": 1000,
         "out_at": 84.6},
    ],
}


# ───────────────────────── effbeat (Beat A) ─────────────────────────

def _effbeat_css(key):
    # FACE-SAFE: subject sits center-left, so the escalation stamp lives on the
    # RIGHT rail (same zone as the counter card), never upper-center over the face.
    return f"""
#ill-{key} {{ position: absolute; top: 560px; left: auto; right: 56px; z-index: 11;
  display: flex; justify-content: flex-end; pointer-events: none; }}
#ill-{key} .eb-wrap {{ position: relative; width: 360px; height: 150px; }}
#ill-{key} .eb-face {{ position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; gap: 22px; opacity: 0; }}
#ill-{key} .eb-tag {{ font-family: "Noto Serif SC", serif; font-size: 40px; font-weight: 700;
  color: #fff; -webkit-text-stroke: 4px rgba(0,0,0,.85); paint-order: stroke fill;
  text-shadow: 0 3px 10px rgba(0,0,0,.6); }}
#ill-{key} .eb-x {{ font-size: 92px; font-weight: 900; line-height: 1;
  color: #1a1206; background: linear-gradient(180deg,#f3c877,#c79655);
  padding: 6px 22px; border-radius: 16px; box-shadow: 0 8px 26px -6px rgba(232,176,99,.7); }}
"""


def _effbeat_html(key, ill):
    return f"""      <div id="ill-{key}" class="clip" data-start="{ill['_abs_start']:.2f}" data-duration="{ill['_abs_dur']:.2f}" data-track-index="7">
        <div class="eb-wrap">
          <div class="eb-face eb-a"><span class="eb-tag">{ill['a_label']}</span><span class="eb-x">{ill['a_val']}</span></div>
          <div class="eb-face eb-b"><span class="eb-tag">{ill['b_label']}</span><span class="eb-x">{ill['b_val']}</span></div>
        </div>
      </div>
"""


def _effbeat_gsap(key, ill, off):
    a = off + ill["a_at"]; b = off + ill["b_at"]; e = ill["_abs_start"] + ill["_abs_dur"]
    return f"""
      tl.fromTo("#ill-{key} .eb-a", {{ opacity: 0, scale: 0.5, rotation: -8 }}, {{ opacity: 1, scale: 1, rotation: 0, duration: 0.42, ease: "back.out(2.2)" }}, {a:.2f});
      tl.to("#ill-{key} .eb-a", {{ opacity: 0, scale: 0.8, duration: 0.3, ease: "power2.in" }}, {b:.2f});
      tl.fromTo("#ill-{key} .eb-b", {{ opacity: 0, scale: 0.5, rotation: 8 }}, {{ opacity: 1, scale: 1, rotation: 0, duration: 0.42, ease: "back.out(2.2)" }}, {b+0.05:.2f});
      tl.to("#ill-{key} .eb-b .eb-x", {{ scale: 1.12, duration: 0.28, yoyo: true, repeat: 1, ease: "power2.inOut" }}, {b+0.5:.2f});
      tl.to("#ill-{key} .eb-b", {{ opacity: 0, scale: 0.85, duration: 0.35, ease: "power2.in" }}, {e-0.4:.2f});
"""


# ───────────────────────── counter (Beats B+C) ─────────────────────────

def _counter_css(key):
    return f"""
#ill-{key} {{ position: absolute; top: 150px; right: 40px; z-index: 12; opacity: 0; }}
#ill-{key} .dc-card {{ position: relative; width: 360px; height: 280px;
  background: rgba(12,13,16,0.9); backdrop-filter: blur(12px);
  border: 2px solid rgba(199,150,85,0.6); border-radius: 18px;
  box-shadow: 0 14px 48px rgba(0,0,0,0.55); overflow: hidden; }}
#ill-{key} .dc-face {{ position: absolute; inset: 0; opacity: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px 20px; }}
#ill-{key} .dc-label {{ font-size: 24px; font-weight: 700; letter-spacing: 0.06em;
  color: #c79655; text-align: center; margin-bottom: 8px; }}
#ill-{key} .dc-numline {{ display: flex; align-items: baseline; gap: 8px; line-height: 1; }}
#ill-{key} .dc-num {{ font-size: 104px; font-weight: 900; letter-spacing: -0.02em; }}
#ill-{key} .dc-unit {{ font-size: 40px; font-weight: 800; }}
#ill-{key} .dc-tag {{ margin-top: 14px; font-size: 26px; font-weight: 700;
  padding: 6px 16px; border-radius: 999px; }}
/* phase colors */
#ill-{key} .f1 .dc-num, #ill-{key} .f1 .dc-unit {{ color: #f3c877; }}
#ill-{key} .f2 .dc-num, #ill-{key} .f2 .dc-unit {{ color: #ff5b5b; }}
#ill-{key} .f2 .dc-tag {{ color: #ff5b5b; background: rgba(255,91,91,0.14); }}
#ill-{key} .f3 .dc-num, #ill-{key} .f3 .dc-unit {{ color: #45d97a; }}
#ill-{key} .f3 .dc-tag {{ color: #45d97a; background: rgba(69,217,122,0.14); }}
#ill-{key} .f1 .dc-tag {{ color: #c79655; background: rgba(199,150,85,0.14); }}
#ill-{key} .dc-arrow {{ font-size: 56px; font-weight: 900; }}
"""


def _counter_html(key, ill):
    return f"""      <div id="ill-{key}" class="clip" data-start="{ill['_abs_start']:.2f}" data-duration="{ill['_abs_dur']:.2f}" data-track-index="6">
        <div class="dc-card">
          <div class="dc-face f1">
            <div class="dc-label">2000年 · 全国程序员</div>
            <div class="dc-numline"><span class="dc-num n1">0</span><span class="dc-unit">万</span></div>
            <div class="dc-tag">那时的全部需求</div>
          </div>
          <div class="dc-face f2">
            <div class="dc-label">按"效率"逻辑 · 该降到</div>
            <div class="dc-numline"><span class="dc-num">≈5</span><span class="dc-unit">人</span></div>
            <div class="dc-tag">↓ 几乎该归零</div>
          </div>
          <div class="dc-face f3">
            <div class="dc-label">实际上 · 暴涨到</div>
            <div class="dc-numline"><span class="dc-num n3">0</span><span class="dc-unit">万</span></div>
            <div class="dc-tag">↑ 远超预测</div>
          </div>
        </div>
      </div>
"""


def _counter_gsap(key, ill, off):
    p1 = off + ill["p1_at"]; p2 = off + ill["p2_at"]
    p3 = off + ill["p3_at"]; out = off + ill["out_at"]
    sin = ill["_abs_start"]
    return f"""
      // --- counter {key}: number tweens via onUpdate are seek-deterministic ---
      const n1_{key} = document.querySelector("#ill-{key} .n1");
      const n3_{key} = document.querySelector("#ill-{key} .n3");
      const o1_{key} = {{ v: 0 }}, o3_{key} = {{ v: 0 }};
      const fmt_{key} = v => Math.round(v).toLocaleString("en-US");
      // card slides in from right
      tl.fromTo("#ill-{key}", {{ x: 380, opacity: 0 }}, {{ x: 0, opacity: 1, duration: 0.5, ease: "expo.out" }}, {sin+0.3:.2f});
      // PHASE 1 — count up to 50万 (gold)
      tl.to("#ill-{key} .f1", {{ opacity: 1, duration: 0.3 }}, {p1:.2f});
      tl.to(o1_{key}, {{ v: {ill['p1_to']}, duration: 0.8, ease: "power2.out", onUpdate: () => {{ n1_{key}.textContent = fmt_{key}(o1_{key}.v); }} }}, {p1:.2f});
      tl.to("#ill-{key} .f1", {{ opacity: 0, duration: 0.3 }}, {p2-0.25:.2f});
      // PHASE 2 — crash to ≈5人 (red), shake the card
      tl.fromTo("#ill-{key} .f2", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.25 }}, {p2:.2f});
      tl.fromTo("#ill-{key} .f2 .dc-numline", {{ y: -26, scale: 1.15 }}, {{ y: 0, scale: 1, duration: 0.45, ease: "bounce.out" }}, {p2:.2f});
      tl.fromTo("#ill-{key} .dc-card", {{ x: 0 }}, {{ x: 10, duration: 0.06, yoyo: true, repeat: 5, ease: "none" }}, {p2+0.05:.2f});
      tl.to("#ill-{key} .f2", {{ opacity: 0, duration: 0.3 }}, {p3-0.25:.2f});
      // PHASE 3 — explode 5 → 1,000万 (green), pulse
      tl.fromTo("#ill-{key} .f3", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.25 }}, {p3:.2f});
      tl.to(o3_{key}, {{ v: {ill['p3_to']}, duration: 1.2, ease: "power3.out", onUpdate: () => {{ n3_{key}.textContent = fmt_{key}(o3_{key}.v); }} }}, {p3:.2f});
      tl.fromTo("#ill-{key} .dc-card", {{ scale: 0.95 }}, {{ scale: 1.06, duration: 0.32, yoyo: true, repeat: 1, ease: "power2.inOut" }}, {p3+1.0:.2f});
      // exit
      tl.to("#ill-{key}", {{ x: 380, opacity: 0, duration: 0.5, ease: "power2.in" }}, {out:.2f});
"""


# ───────────────────────── stack / hammer (existing) ─────────────────────────

def _hammer_css(key):
    return f"""
#ill-{key} {{
  position: absolute; top: 360px; left: 0; right: 0; z-index: 12;
  display: flex; flex-direction: column; align-items: center; padding: 0 40px;
}}
#ill-{key} .ill-h-content {{
  display: flex; flex-direction: column; align-items: center; gap: 24px;
  padding: 36px 56px;
  background: linear-gradient(180deg, rgba(31,17,8,0.95) 0%, rgba(12,13,16,0.95) 100%);
  border: 3px solid #e8b063; border-radius: 24px;
  box-shadow: 0 16px 64px rgba(232,176,99,0.18), 0 8px 32px rgba(0,0,0,0.6);
}}
#ill-{key} .ill-h-eq {{
  display: flex; align-items: center; gap: 24px;
  font-size: 96px; font-weight: 900; letter-spacing: -0.02em; line-height: 1;
}}
#ill-{key} .ill-h-left   {{ color: #ffffff; }}
#ill-{key} .ill-h-equals {{ color: #e8b063; font-size: 100px; }}
#ill-{key} .ill-h-right  {{ color: #e8b063; }}
#ill-{key} .ill-h-foot {{
  font-size: 30px; font-weight: 600; color: #c7c7cc;
  letter-spacing: 0.04em; text-align: center;
}}
"""


def _hammer_html(key, ill):
    return f"""      <div id="ill-{key}" class="clip" data-start="{ill['_abs_start']:.2f}" data-duration="{ill['_abs_dur']:.2f}" data-track-index="6">
        <div class="ill-h-content">
          <div class="ill-h-eq">
            <span class="ill-h-left">{ill['left']}</span>
            <span class="ill-h-equals">{ill['equals']}</span>
            <span class="ill-h-right">{ill['right']}</span>
          </div>
          <div class="ill-h-foot">{ill['foot']}</div>
        </div>
      </div>
"""


def _hammer_gsap(key, s, e):
    return f"""
      tl.fromTo("#ill-{key}", {{ scale: 0.85, opacity: 0 }}, {{ scale: 1.0, opacity: 1, duration: 0.45, ease: "back.out(1.6)" }}, {s:.2f});
      tl.from("#ill-{key} .ill-h-left",   {{ x: -40, opacity: 0, duration: 0.4, ease: "expo.out" }}, {s+0.2:.2f});
      tl.from("#ill-{key} .ill-h-equals", {{ scale: 0, opacity: 0, duration: 0.4, ease: "back.out(2)" }}, {s+0.4:.2f});
      tl.from("#ill-{key} .ill-h-right",  {{ x: 40, opacity: 0, duration: 0.4, ease: "expo.out" }}, {s+0.6:.2f});
      tl.from("#ill-{key} .ill-h-foot",   {{ y: 20, opacity: 0, duration: 0.4, ease: "power2.out" }}, {s+0.8:.2f});
      tl.to("#ill-{key}", {{ scale: 1.05, opacity: 0, duration: 0.45, ease: "power2.in" }}, {e-0.45:.2f});
"""


def _stack_css(key):
    return f"""
#ill-{key} {{ position: absolute; top: 160px; right: 40px; z-index: 8; }}
#ill-{key} .ill-card {{
  background: rgba(12,13,16,0.88); backdrop-filter: blur(12px);
  border: 2px solid rgba(199,150,85,0.6); border-radius: 14px;
  padding: 22px 26px; min-width: 320px; max-width: 380px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
}}
#ill-{key} .ill-card-label {{
  font-size: 22px; color: #c79655; letter-spacing: 0.1em;
  font-weight: 700; margin-bottom: 18px;
}}
#ill-{key} .ill-row {{ display: flex; flex-direction: column; align-items: center; gap: 4px; margin-bottom: 12px; }}
#ill-{key} .ill-row:last-child {{ margin-bottom: 0; }}
#ill-{key} .ill-tag {{
  display: inline-block; padding: 10px 18px; font-size: 30px; font-weight: 800;
  color: #f4f4f5; background: rgba(255,255,255,0.08);
  border: 1.5px solid rgba(255,255,255,0.18); border-radius: 10px;
  min-width: 280px; text-align: center; letter-spacing: 0.02em;
}}
#ill-{key} .ill-tag.accent {{ color: #0c0d10; background: #e8b063; border-color: #e8b063; font-weight: 900; }}
"""


def _stack_html(key, ill):
    rows = "".join(
        f'          <div class="ill-row"><span class="ill-tag{" accent" if r.get("accent") else ""}">{r["text"]}</span></div>\n'
        for r in ill["rows"]
    )
    return f"""      <div id="ill-{key}" class="clip" data-start="{ill['_abs_start']:.2f}" data-duration="{ill['_abs_dur']:.2f}" data-track-index="5">
        <div class="ill-card">
          <div class="ill-card-label">{ill['label']}</div>
{rows}        </div>
      </div>
"""


def _stack_gsap(key, s, e):
    return f"""
      tl.fromTo("#ill-{key}", {{ x: 360, opacity: 0 }}, {{ x: 0, opacity: 1, duration: 0.6, ease: "expo.out" }}, {s+0.2:.2f});
      tl.from("#ill-{key} .ill-row", {{ y: 20, opacity: 0, duration: 0.4, stagger: 0.12, ease: "power2.out" }}, {s+0.4:.2f});
      tl.to("#ill-{key}", {{ x: 360, opacity: 0, duration: 0.5, ease: "power2.in" }}, {e-0.5:.2f});
"""


def render_for_clip(sid, body_offset):
    css, html, gsap = "", "", ""
    for ill in ILLUSTRATIONS.get(sid, []):
        key = ill["key"]
        s = body_offset + ill["body_start"]
        e = body_offset + ill["body_end"]
        ill["_abs_start"] = s
        ill["_abs_dur"] = e - s
        if ill["pattern"] == "hammer":
            css += _hammer_css(key); html += _hammer_html(key, ill); gsap += _hammer_gsap(key, s, e)
        elif ill["pattern"] == "stack":
            css += _stack_css(key); html += _stack_html(key, ill); gsap += _stack_gsap(key, s, e)
        elif ill["pattern"] == "counter":
            css += _counter_css(key); html += _counter_html(key, ill); gsap += _counter_gsap(key, ill, body_offset)
        elif ill["pattern"] == "effbeat":
            css += _effbeat_css(key); html += _effbeat_html(key, ill); gsap += _effbeat_gsap(key, ill, body_offset)
    return css, html, gsap
