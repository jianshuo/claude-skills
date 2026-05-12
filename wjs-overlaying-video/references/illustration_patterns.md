# Illustration patterns — canonical CSS / HTML / GSAP

Two re-usable patterns for in-clip illustration overlays:

- **`stack`** — top-right vertical list card. Best when showing a
  hierarchy or sequence while the speaker explains it.
- **`hammer`** — center-frame BIG equation / text overlay. Best for
  the single most quotable moment in a clip (e.g., "LLM = 编译器").

Both share a dark canvas + amber accent (`#e8b063`) palette that
contrasts well with daylight indoor footage. Adjust palette to match
brand if needed; the structural patterns are independent of colour.

Production-validated on 1080×1920 vertical clips. For 1920×1080
horizontal, scale `top` / `padding` / `font-size` values down by ~30%
to keep proportions.

---

## Pattern A: `stack` (top-right list card)

### HTML

```html
<div id="ill-stack" class="clip" data-start="{start}" data-duration="{dur}" data-track-index="5">
  <div class="ill-card">
    <div class="ill-card-label">{LABEL}</div>
    <div class="ill-row"><span class="ill-tag accent">{ROW 1}</span></div>
    <div class="ill-row"><span class="ill-tag">{ROW 2}</span></div>
    <div class="ill-row"><span class="ill-tag">{ROW 3}</span></div>
    <div class="ill-row"><span class="ill-tag">{ROW 4}</span></div>
  </div>
</div>
```

Mark one row with `accent` class to highlight it (the row the speaker
is talking about, or the level the viewer is at).

### CSS (replace `{key}` with the illustration's `data-` id, e.g., `stack`)

```css
#ill-{key} {
  position: absolute;
  top: 160px;
  right: 40px;
  z-index: 8;
}
#ill-{key} .ill-card {
  background: rgba(12, 13, 16, 0.88);
  backdrop-filter: blur(12px);
  border: 2px solid rgba(199, 150, 85, 0.6);
  border-radius: 14px;
  padding: 22px 26px;
  min-width: 320px;
  max-width: 380px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}
#ill-{key} .ill-card-label {
  font-size: 22px;
  color: #c79655;
  letter-spacing: 0.1em;
  font-weight: 700;
  margin-bottom: 18px;
  text-transform: uppercase;
}
#ill-{key} .ill-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
}
#ill-{key} .ill-row:last-child { margin-bottom: 0; }
#ill-{key} .ill-tag {
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
}
#ill-{key} .ill-tag.accent {
  color: #0c0d10;
  background: #e8b063;
  border-color: #e8b063;
  font-weight: 900;
}
#ill-{key} .ill-sub {
  font-size: 20px;
  color: #c79655;
  font-weight: 700;
  margin-top: 4px;
  letter-spacing: 0.04em;
}
```

### GSAP — slide in from right + stagger rows + slide out

```js
// start, end are absolute timeline positions (cover_offset already added)
tl.fromTo("#ill-{key}",
  { x: 360, opacity: 0 },
  { x: 0, opacity: 1, duration: 0.6, ease: "expo.out" },
  start + 0.2
);
tl.from("#ill-{key} .ill-row",
  { y: 20, opacity: 0, duration: 0.4, stagger: 0.12, ease: "power2.out" },
  start + 0.4
);
tl.to("#ill-{key}", { x: 360, opacity: 0, duration: 0.5, ease: "power2.in" }, end - 0.5);
```

### Sample usage (programmatic via `illustrations.py`)

```python
{
  "key": "levels",
  "pattern": "stack",
  "body_start": 14.0,
  "body_end": 50.0,
  "label": "AI 使用三层",
  "rows": [
    {"text": "第一层 · 聊天",        "accent": True},
    {"text": "第二层 · 单文件 .md",  "accent": False},
    {"text": "第三层 · 多文件工程",  "accent": False},
  ],
}
```

---

## Pattern B: `hammer` (center BIG equation)

### HTML

```html
<div id="ill-hammer" class="clip" data-start="{start}" data-duration="{dur}" data-track-index="6">
  <div class="ill-h-content">
    <div class="ill-h-eq">
      <span class="ill-h-left">{LEFT}</span>
      <span class="ill-h-equals">{=}</span>
      <span class="ill-h-right">{RIGHT}</span>
    </div>
    <div class="ill-h-foot">{FOOT TEXT}</div>
  </div>
</div>
```

Common substitutions:
- `LEFT = "LLM"`, `EQUALS = "="`, `RIGHT = "新编译器"` (clip 1)
- `LEFT = "AI ≠"`, `EQUALS = "  "`, `RIGHT = "更快的轿子"` (clip 3 — use `≠` to negate)
- `LEFT = "Token"`, `EQUALS = "="`, `RIGHT = "新 GDP"` (clip 5)

The `FOOT TEXT` is the secondary line beneath the equation (e.g.,
"自然语言 → Python → 汇编" or "你必须学开车").

### CSS

```css
#ill-{key} {
  position: absolute;
  top: 360px;
  left: 0;
  right: 0;
  z-index: 12;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 40px;
}
#ill-{key} .ill-h-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 36px 56px;
  background: linear-gradient(180deg, rgba(31, 17, 8, 0.95) 0%, rgba(12, 13, 16, 0.95) 100%);
  border: 3px solid #e8b063;
  border-radius: 24px;
  box-shadow: 0 16px 64px rgba(232, 176, 99, 0.18), 0 8px 32px rgba(0, 0, 0, 0.6);
}
#ill-{key} .ill-h-eq {
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 88px;
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 1;
}
#ill-{key} .ill-h-left   { color: #ffffff; }
#ill-{key} .ill-h-equals { color: #e8b063; font-size: 100px; }
#ill-{key} .ill-h-right  { color: #e8b063; }
#ill-{key} .ill-h-foot {
  font-size: 28px;
  font-weight: 600;
  color: #9a9aa0;
  letter-spacing: 0.04em;
  text-align: center;
}
```

### GSAP — scale-pop entrance, stagger each piece, scale-fade exit

```js
tl.fromTo("#ill-{key}",
  { scale: 0.85, opacity: 0 },
  { scale: 1.0, opacity: 1, duration: 0.45, ease: "back.out(1.6)" },
  start
);
tl.from("#ill-{key} .ill-h-left",   { x: -40, opacity: 0, duration: 0.4, ease: "expo.out" }, start + 0.2);
tl.from("#ill-{key} .ill-h-equals", { scale: 0, opacity: 0, duration: 0.4, ease: "back.out(2)" }, start + 0.4);
tl.from("#ill-{key} .ill-h-right",  { x: 40, opacity: 0, duration: 0.4, ease: "expo.out" }, start + 0.6);
tl.from("#ill-{key} .ill-h-foot",   { y: 20, opacity: 0, duration: 0.4, ease: "power2.out" }, start + 0.8);
tl.to("#ill-{key}", { scale: 1.05, opacity: 0, duration: 0.45, ease: "power2.in" }, end - 0.45);
```

---

## Pattern C: `cta` (end-card)

Not technically an "illustration" but uses the same dark+amber
language. Place at the end of every clip; **always use 王建硕 as the
channel name** (per global instructions — never a guest's name).

### HTML

```html
<div id="cta" class="clip" data-start="{cta_start}" data-duration="3.24" data-track-index="1">
  <div class="cta-line-1">关注王建硕</div>
  <div class="arrow">↓</div>
  <div class="cta-line-2">微信公众号 · 视频号</div>
  <div class="cta-foot">AI 炼金术 · 持续更新</div>
</div>
```

### CSS

```css
#cta {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 50%, #1f1108 0%, #0c0d10 60%), #0c0d10;
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  padding: 0 120px; gap: 40px;
}
#cta .arrow      { font-size: 96px; color: #c79655; line-height: 1; }
#cta .cta-line-1 { font-size: 88px; font-weight: 800; color: #f4f4f5; letter-spacing: -0.01em; }
#cta .cta-line-2 { font-size: 44px; font-weight: 600; color: #e8b063; letter-spacing: 0.04em; }
#cta .cta-foot   { font-size: 26px; color: #6b6b71; letter-spacing: 0.12em; margin-top: 24px; }
```

### GSAP — staggered entrance, no exit (final scene)

```js
tl.from("#cta .cta-line-1", { y: 40,  opacity: 0, duration: 0.5, ease: "expo.out" },   cta_start + 0.14);
tl.from("#cta .arrow",      { y: -30, opacity: 0, duration: 0.4, ease: "power3.out" }, cta_start + 0.34);
tl.from("#cta .cta-line-2", { y: 30,  opacity: 0, duration: 0.5, ease: "power2.out" }, cta_start + 0.54);
tl.from("#cta .cta-foot",   {         opacity: 0, duration: 0.4, ease: "power2.out" }, cta_start + 0.84);
```

---

## Choosing which pattern when

- The speaker is enumerating a **list / hierarchy / sequence** (e.g.,
  "第一层 / 第二层 / 第三层", "用户反馈 → GitHub Issue → ...") → use
  `stack` for the duration of the explanation (~20–60s).
- The speaker has a single **quotable equation or analogy** ("LLM 是
  新的编译器", "Token = 新 GDP", "AI ≠ 更快的轿子") → use `hammer`
  for ~4–8s right around that line.
- The clip has BOTH (a setup hierarchy + a punchline) → use both. The
  `hammer` should fire AFTER the `stack` exits, or at a moment when
  the speaker pauses for emphasis on the punchline.

A 2-minute clip usually has 1–2 illustrations max. More than that
fatigues the viewer and competes with the speaker's face.
