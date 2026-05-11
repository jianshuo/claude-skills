# Custom overlay recipes

These are ready-to-adapt fragment files for the `custom` overlay type. Each recipe shows the required structure: `<!-- BEGIN-OVERLAY-HTML -->...<!-- END-OVERLAY-HTML -->` for the inner HTML, optional `<!-- BEGIN-OVERLAY-CSS -->` block, optional `<!-- BEGIN-OVERLAY-JS -->` block.

The scaffolder reads these three sections and inlines them into the root composition's `<!-- BEGIN-OVERLAY-CSS -->` and `<!-- BEGIN-OVERLAY-JS -->` tags. The inline HTML replaces the `{id}` clip's content.

Important rules:
- All CSS selectors should be scoped under `#<overlay_id>` so they don't bleed into other overlays.
- All GSAP tweens go on `tl` (the root timeline already in scope). Time positions must be `>= overlay.start` and `<= overlay.start + overlay.duration` (otherwise the framework hides the element while you're animating it).
- Set initial CSS state for any element you'll animate `from` (opacity:0, transform:translate(...)) so the element is invisible until its tween fires.
- The root timeline already declares the parent overlay's `opacity: 1 → 0` enter/exit if you don't. To override, write your own `tl.to("#<id>", ...)` at start and end.

## Recipe: terminal demo

A code-window animation showing a `print` mistake → corrected version. Used in clip_01_animated for the C-language analogy.

```html
<!-- BEGIN-OVERLAY-HTML -->
  <div class="o2-bg"></div>
  <div class="o2-window" id="o2-window">
    <div class="o2-header">
      <span class="o2-dot red"></span>
      <span class="o2-dot yellow"></span>
      <span class="o2-dot green"></span>
    </div>
    <div class="o2-body">
      <span class="o2-line" id="o2-cmd1">
        <span class="o2-prompt">$</span>
        <span class="o2-fn">print</span>(<span class="o2-str">"hello"</span>)
      </span>
      <span class="o2-line o2-output white" id="o2-out1">
        hello
        <span class="o2-x" id="o2-x">✕</span>
      </span>
      <div class="o2-thought" id="o2-thought">我以为是<span class="blue">蓝色</span>的</div>
      <span class="o2-line" id="o2-cmd2">
        <span class="o2-prompt">$</span>
        <span class="o2-fn">set_color</span>(<span class="o2-arg">blue</span>);
        <span class="o2-fn">print</span>(<span class="o2-str">"hello"</span>)
      </span>
      <span class="o2-line o2-output blue" id="o2-out2">
        hello
        <span class="o2-check" id="o2-check">✓</span>
      </span>
    </div>
  </div>
  <div class="o2-caption" id="o2-caption">不是 bug · 是意图遗漏</div>
<!-- END-OVERLAY-HTML -->

<!-- BEGIN-OVERLAY-CSS -->
#o2 .o2-bg { position: absolute; inset: 0; background: rgba(8,12,24,0.94); }
#o2 .o2-window {
  position: absolute; top: 90px; left: 360px; width: 1200px;
  background: #1e1e1e; border-radius: 18px; border: 2px solid #444;
  box-shadow: 0 40px 90px rgba(0,0,0,0.7);
  font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
  opacity: 0; transform: translateY(80px);
}
#o2 .o2-header { background: #2d2d2d; padding: 22px 28px; display: flex; gap: 12px; border-bottom: 1px solid #444; }
#o2 .o2-dot { width: 18px; height: 18px; border-radius: 50%; }
#o2 .o2-dot.red { background: #ff5f57; }
#o2 .o2-dot.yellow { background: #febc2e; }
#o2 .o2-dot.green { background: #28c840; }
#o2 .o2-body { padding: 50px 60px; font-size: 46px; line-height: 1.6; color: #d4d4d4; min-height: 580px; }
#o2 .o2-line { display: block; margin-bottom: 24px; opacity: 0; }
#o2 .o2-prompt { color: #6cd9ff; margin-right: 18px; font-weight: 700; }
#o2 .o2-fn { color: #c586c0; }
#o2 .o2-str { color: #ce9178; }
#o2 .o2-arg { color: #9cdcfe; }
#o2 .o2-output { font-size: 64px; font-weight: 700; padding-left: 70px; opacity: 0; }
#o2 .o2-output.white { color: #ffffff; }
#o2 .o2-output.blue { color: #4f9bff; }
#o2 .o2-thought {
  position: relative; background: #fff; color: #1a1a1a;
  padding: 22px 36px; border-radius: 36px; display: inline-block;
  font-size: 40px; font-weight: 700; margin: 16px 0 28px 70px;
  font-family: "PingFang SC", sans-serif; opacity: 0;
}
#o2 .o2-thought:before {
  content: ''; position: absolute; top: -22px; left: 80px;
  border: 14px solid transparent; border-bottom-color: #fff;
}
#o2 .o2-thought .blue { color: #2476ff; font-weight: 800; }
#o2 .o2-x, #o2 .o2-check { font-size: 80px; font-weight: 900; margin-left: 24px; opacity: 0; display: inline-block; vertical-align: middle; }
#o2 .o2-x { color: #ff4444; }
#o2 .o2-check { color: #28c840; }
#o2 .o2-caption {
  position: absolute; bottom: 80px; left: 0; width: 1920px;
  text-align: center; font-size: 88px; font-weight: 800;
  letter-spacing: 4px; color: #ffeb00;
  text-shadow: 0 6px 22px rgba(0,0,0,0.85);
  opacity: 0; transform: translateY(40px);
}
<!-- END-OVERLAY-CSS -->

<!-- BEGIN-OVERLAY-JS -->
// Replace the literal "42" timestamps with your overlay's `start`.
const S = 42;
tl.to("#o2", { opacity: 1, duration: 0.5, ease: "power2.out" }, S);
tl.to("#o2-window", { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, S + 0.3);
tl.to("#o2-cmd1", { opacity: 1, duration: 0.4, ease: "power1.out" }, S + 1.2);
tl.to("#o2-out1", { opacity: 1, duration: 0.4, ease: "power2.out" }, S + 2.0);
tl.to("#o2-thought", { y: 0, opacity: 1, duration: 0.5, ease: "back.out(2)" }, S + 2.8);
tl.from("#o2-thought", { scale: 0.85 }, S + 2.8);
tl.to("#o2-x", { opacity: 1, duration: 0.4, ease: "back.out(3)" }, S + 3.6);
tl.from("#o2-x", { scale: 0.5 }, S + 3.6);
tl.to("#o2-cmd2", { opacity: 1, duration: 0.5, ease: "power3.out" }, S + 5.2);
tl.from("#o2-cmd2", { x: -40 }, S + 5.2);
tl.to("#o2-out2", { opacity: 1, duration: 0.5, ease: "power3.out" }, S + 6.0);
tl.from("#o2-out2", { scale: 0.92 }, S + 6.0);
tl.to("#o2-check", { opacity: 1, duration: 0.4, ease: "back.out(3)" }, S + 6.6);
tl.from("#o2-check", { scale: 0.5 }, S + 6.6);
tl.to("#o2-caption", { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, S + 7.4);
// hold ~10s, then exit
tl.to("#o2-window", { y: 30, opacity: 0, duration: 0.6, ease: "power2.in" }, S + 17.0);
tl.to("#o2-caption", { y: -20, opacity: 0, duration: 0.6, ease: "power2.in" }, S + 17.0);
tl.to("#o2", { opacity: 0, duration: 0.6, ease: "power2.in" }, S + 17.2);
<!-- END-OVERLAY-JS -->
```

## Recipe: layer-stack diagram

Animated abstraction layers (e.g. natural language → code → machine code) stacked vertically with a glowing arrow flowing through them. Useful for explaining hierarchy / pipeline concepts.

Skeleton:

```html
<!-- BEGIN-OVERLAY-HTML -->
  <div class="ls-bg"></div>
  <div class="ls-stack">
    <div class="ls-layer ls-layer-1" id="ls-l1">自然语言</div>
    <div class="ls-arrow" id="ls-a1">↓</div>
    <div class="ls-layer ls-layer-2" id="ls-l2">代码</div>
    <div class="ls-arrow" id="ls-a2">↓</div>
    <div class="ls-layer ls-layer-3" id="ls-l3">机器码</div>
  </div>
<!-- END-OVERLAY-HTML -->

<!-- BEGIN-OVERLAY-CSS -->
#X .ls-bg { position: absolute; inset: 0; background: rgba(8,12,24,0.92); }
#X .ls-stack { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); display: flex; flex-direction: column; align-items: center; gap: 30px; }
#X .ls-layer {
  font-size: 90px; font-weight: 800; color: #fff;
  padding: 30px 60px; border-radius: 12px;
  border: 3px solid;
  opacity: 0; transform: translateX(-100px);
}
#X .ls-layer-1 { border-color: #ffeb00; box-shadow: 0 0 40px rgba(255,235,0,0.4); }
#X .ls-layer-2 { border-color: #4f9bff; box-shadow: 0 0 40px rgba(79,155,255,0.3); }
#X .ls-layer-3 { border-color: #28c840; box-shadow: 0 0 40px rgba(40,200,64,0.25); }
#X .ls-arrow { font-size: 60px; color: rgba(255,255,255,0.5); opacity: 0; }
<!-- END-OVERLAY-CSS -->

<!-- BEGIN-OVERLAY-JS -->
const S = /* overlay start time */;
tl.to("#X", { opacity: 1, duration: 0.4 }, S);
tl.to("#X #ls-l1", { x: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, S + 0.3);
tl.to("#X #ls-a1", { opacity: 1, duration: 0.3 }, S + 0.9);
tl.to("#X #ls-l2", { x: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, S + 1.1);
tl.to("#X #ls-a2", { opacity: 1, duration: 0.3 }, S + 1.7);
tl.to("#X #ls-l3", { x: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, S + 1.9);
// exit at S + duration - 0.6
tl.to("#X", { opacity: 0, duration: 0.5 }, S + DURATION - 0.5);
<!-- END-OVERLAY-JS -->
```

Replace `#X` with the actual overlay id (e.g. `#o3`), `S` with start time, and `DURATION` with overlay duration.

## Recipe: before/after split

Two side-by-side states with labels — wrong on the left (red), right on the right (green).

Skeleton:

```html
<!-- BEGIN-OVERLAY-HTML -->
  <div class="ba-bg"></div>
  <div class="ba-half left" id="ba-left">
    <div class="ba-label">改 Python</div>
    <div class="ba-content">/* generated.py */<br>print("white")</div>
    <div class="ba-mark">✕</div>
  </div>
  <div class="ba-half right" id="ba-right">
    <div class="ba-label">改 prompt</div>
    <div class="ba-content">"打印蓝色的 hello"</div>
    <div class="ba-mark">✓</div>
  </div>
<!-- END-OVERLAY-HTML -->

<!-- BEGIN-OVERLAY-CSS -->
#X .ba-bg { position: absolute; inset: 0; background: rgba(8,12,24,0.94); }
#X .ba-half {
  position: absolute; top: 0; height: 100%; width: 50%;
  display: flex; flex-direction: column; justify-content: center;
  align-items: center; padding: 80px;
  opacity: 0;
}
#X .ba-half.left { left: 0; transform: translateX(-50px); }
#X .ba-half.right { right: 0; transform: translateX(50px); }
#X .ba-label { font-size: 70px; font-weight: 800; margin-bottom: 30px; }
#X .ba-half.left .ba-label { color: #ff4444; }
#X .ba-half.right .ba-label { color: #28c840; }
#X .ba-content {
  font-size: 50px; font-family: "SF Mono", Menlo, monospace;
  color: #d4d4d4; background: #1e1e1e; padding: 30px 50px;
  border-radius: 12px; max-width: 100%;
}
#X .ba-mark { font-size: 120px; font-weight: 900; margin-top: 40px; }
#X .ba-half.left .ba-mark { color: #ff4444; }
#X .ba-half.right .ba-mark { color: #28c840; }
<!-- END-OVERLAY-CSS -->

<!-- BEGIN-OVERLAY-JS -->
const S = /* overlay start */;
tl.to("#X", { opacity: 1, duration: 0.4 }, S);
tl.to("#X #ba-left", { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, S + 0.3);
tl.to("#X #ba-right", { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, S + 0.6);
tl.to("#X", { opacity: 0, duration: 0.5 }, S + DURATION - 0.5);
<!-- END-OVERLAY-JS -->
```

## Pattern: pulsing emphasis

Add a subtle pulse to draw attention to a single element while it's on screen. Use sparingly — once per overlay max.

```js
// requires: opacity:1, transform:scale(1) at rest
const cycleDur = 1.2;
const cycles = Math.ceil(HOLD_DUR / cycleDur);
tl.to("#X .pulse-target", {
  scale: 1.06,
  duration: cycleDur / 2,
  ease: "sine.inOut",
  yoyo: true,
  repeat: cycles * 2 - 1,
}, S + HOLD_START);
```

Never use `repeat: -1`. Always compute a finite repeat count.
