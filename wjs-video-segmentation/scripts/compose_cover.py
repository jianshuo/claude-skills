"""Composite a final cover image from background + title text.

Reads segments.json. For each segment, looks for a background image
in this priority order:
  1. cover_bg_NN_slug.png   (AI-generated via gpt-image-2)
  2. frame_NN_slug.jpg      (raw frame; fallback if AI step skipped)

Resizes/crops to target platform dimensions, then overlays the title
on a semi-transparent gradient panel.

Usage:
  python3 compose_cover.py --segments segments.json --out output/
  python3 compose_cover.py --segments segments.json --out output/ --platform douyin
  python3 compose_cover.py --segments segments.json --out output/ --single 2
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


PLATFORMS = {
    "wechat_channels": {"size": (1080, 1350), "title_band": "bottom_third"},
    "douyin":          {"size": (1080, 1920), "title_band": "bottom_quarter"},
    "xiaohongshu":     {"size": (1080, 1440), "title_band": "bottom_third"},
    "shorts":          {"size": (1080, 1920), "title_band": "center_band"},
    "reels":           {"size": (1080, 1920), "title_band": "bottom_third"},
}

# macOS-default Chinese-capable bold font candidates. Pillow needs
# (path, ttc_index); .ttf files just use index=0.
FONT_CANDIDATES = [
    ("/System/Library/Fonts/PingFang.ttc", 0),
    ("/System/Library/Fonts/STHeiti Medium.ttc", 0),
    ("/System/Library/Fonts/Hiragino Sans GB.ttc", 0),
    ("/Library/Fonts/Arial Unicode.ttf", 0),
]


def find_font():
    for p, idx in FONT_CANDIDATES:
        if not Path(p).exists():
            continue
        try:
            ImageFont.truetype(p, 24, index=idx)
            return p, idx
        except OSError:
            continue
    raise RuntimeError(
        "no Chinese-capable font found; set --font /path/to/font.ttf"
    )


def find_background(out_dir, sid, slug):
    candidates = [
        out_dir / f"cover_bg_{sid:02d}_{slug}.png",
        out_dir / f"cover_bg_{sid:02d}_{slug}.jpg",
        out_dir / f"frame_{sid:02d}_{slug}.jpg",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def fit_to_canvas(img, size):
    """Center-crop + resize source to fill the target canvas."""
    tw, th = size
    sw, sh = img.size
    target_ratio = tw / th
    src_ratio = sw / sh
    if src_ratio > target_ratio:
        # source wider than target → crop sides
        new_w = int(sh * target_ratio)
        x = (sw - new_w) // 2
        img = img.crop((x, 0, x + new_w, sh))
    else:
        # source taller → crop top/bottom
        new_h = int(sw / target_ratio)
        y = (sh - new_h) // 2
        img = img.crop((0, y, sw, y + new_h))
    return img.resize(size, Image.LANCZOS)


def draw_gradient(canvas: Image.Image, band_top: int, band_bottom: int):
    """Paint a vertical dark gradient over [band_top, band_bottom] for legibility."""
    w, h = canvas.size
    overlay = Image.new("RGBA", (w, band_bottom - band_top), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    band_h = band_bottom - band_top
    for y in range(band_h):
        # 0 at top of band → 200 (alpha) at bottom
        alpha = int(220 * (y / band_h) ** 1.4)
        draw.line([(0, y), (w, y)], fill=(0, 0, 0, alpha))
    canvas.alpha_composite(overlay, (0, band_top))


def wrap_text(text, font, max_width):
    """Honour explicit \\n; otherwise greedy-wrap by pixel width."""
    if "\n" in text:
        return text.split("\n")
    # Wrap at character boundary for Chinese.
    lines = []
    current = ""
    for ch in text:
        trial = current + ch
        # Pillow ≥10 returns (l,t,r,b) from getbbox.
        bbox = font.getbbox(trial)
        w = bbox[2] - bbox[0]
        if w > max_width and current:
            lines.append(current)
            current = ch
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def render_cover(
    seg: dict,
    bg_path: Path,
    out_path: Path,
    platform: dict,
    font_path: str,
    font_index: int = 0,
):
    canvas_size = platform["size"]
    band_mode = platform["title_band"]

    bg = Image.open(bg_path).convert("RGBA")
    canvas = fit_to_canvas(bg, canvas_size)

    w, h = canvas_size
    if band_mode == "bottom_third":
        band_top, band_bottom = int(h * 0.55), h
    elif band_mode == "bottom_quarter":
        band_top, band_bottom = int(h * 0.70), h
    elif band_mode == "center_band":
        band_top, band_bottom = int(h * 0.35), int(h * 0.70)
    else:
        band_top, band_bottom = int(h * 0.55), h

    draw_gradient(canvas, band_top, band_bottom)

    # Title typography.
    title = seg.get("title", "").strip()
    if not title:
        canvas.convert("RGB").save(out_path, "PNG")
        return

    title_size = 96 if h <= 1440 else 110
    font = ImageFont.truetype(font_path, title_size, index=font_index)
    margin = int(w * 0.08)
    max_text_w = w - margin * 2
    lines = wrap_text(title, font, max_text_w)

    line_gap = int(title_size * 0.25)
    total_h = (
        sum(font.getbbox(ln)[3] - font.getbbox(ln)[1] for ln in lines)
        + line_gap * (len(lines) - 1)
    )
    band_h = band_bottom - band_top
    cursor_y = band_top + (band_h - total_h) // 2 + int(band_h * 0.05)

    draw = ImageDraw.Draw(canvas)
    for ln in lines:
        bbox = font.getbbox(ln)
        line_w = bbox[2] - bbox[0]
        line_h = bbox[3] - bbox[1]
        x = (w - line_w) // 2 - bbox[0]
        # Soft shadow.
        shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_draw.text((x + 4, cursor_y + 4), ln, font=font, fill=(0, 0, 0, 160))
        shadow = shadow.filter(ImageFilter.GaussianBlur(4))
        canvas.alpha_composite(shadow)
        # White text on top.
        draw.text((x, cursor_y), ln, font=font, fill=(255, 255, 255, 255))
        cursor_y += line_h + line_gap

    canvas.convert("RGB").save(out_path, "PNG")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--segments", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument(
        "--platform",
        default=None,
        help=f"override platform preset; one of {','.join(PLATFORMS)}",
    )
    ap.add_argument("--font", default=None, help="path to TTF/TTC font")
    ap.add_argument("--single", type=int, default=None, help="render only segment id N")
    args = ap.parse_args()

    cfg = json.loads(Path(args.segments).read_text(encoding="utf-8"))
    out_dir = Path(args.out).resolve()
    platform_name = args.platform or cfg.get("platform") or "wechat_channels"
    if platform_name not in PLATFORMS:
        sys.exit(f"unknown platform: {platform_name}")
    platform = PLATFORMS[platform_name]
    if args.font:
        font_path, font_index = args.font, 0
    else:
        font_path, font_index = find_font()

    rendered = 0
    for seg in cfg["segments"]:
        if args.single is not None and seg["id"] != args.single:
            continue
        sid = seg["id"]
        slug = seg["slug"]
        bg = find_background(out_dir, sid, slug)
        if bg is None:
            print(
                f"[{sid:02d}] {slug}: no background image — run segment.py first",
                file=sys.stderr,
            )
            continue
        out_path = out_dir / f"cover_{sid:02d}_{slug}.png"
        render_cover(seg, bg, out_path, platform, font_path, font_index)
        print(f"[{sid:02d}] {slug} → {out_path.name}", file=sys.stderr)
        rendered += 1

    if rendered == 0:
        sys.exit("no covers rendered")


if __name__ == "__main__":
    main()
