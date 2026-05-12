"""Generate covers via gpt-image-2, with the title text baked into the image.

For each segment in segments.json, calls gpt-image-2 `images edit` with:
  - the segment's frame (`output/frame_NN_slug.jpg`) as reference image
  - a prompt that combines the segment's `cover_prompt` (visual concept)
    with explicit instructions to render the segment's `title` text
    prominently and clear of faces

Output:
  output/cover_NN_slug.png  at video-native 16:9 (default 1536x1024)

The cover is meant to double as a thumbnail AND as a title-card intro
that gets prepended to the clip — see prepend_intro.py.

GPT-Image-2's Chinese typography is decent but imperfect. Always
preview the first cover before generating the rest, and re-roll
individual segments via `--single N` if a title comes out garbled.

Usage:
  python3 make_cover.py --segments segments.json --out output/
  python3 make_cover.py --segments segments.json --out output/ --single 2
  python3 make_cover.py --segments segments.json --out output/ --size 1920x1080
  python3 make_cover.py --segments segments.json --out output/ --provider openai
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

GPT_IMAGE_CLI = Path.home() / ".claude/skills/gpt-image-2-skill/scripts/gpt_image_2_skill.cjs"

# Hard-baked typography instructions that go onto every prompt. The
# placeholders are filled per-segment.
TITLE_INSTRUCTION = (
    "Critical: keep the reference photograph EXACTLY as the literal "
    "background of the entire image — same people, same setting, same "
    "lighting, same composition, full frame, untouched and "
    "unmodified except for color grading. Do NOT add any decorative "
    "graphics, holograms, glowing elements, fake code, charts, "
    "diagrams, or stylised overlays around the people. The image must "
    "look like a photograph with one piece of text stamped on top — "
    "nothing else. "
    "Then on top of that photographic background, overlay ONE bold "
    'Chinese title and only that title: "{title}". '
    "Typography: crisp readable Chinese characters (Heiti / PingFang / "
    "geometric sans-serif), VERY LARGE — roughly 18-22% of the frame "
    "height per line. White fill with a heavy black outline (8-12 px) "
    "and a soft drop shadow for legibility on any background. Two "
    "lines maximum, broken at the explicit '\\n' in the title. "
    "Placement: free zone of the frame — never crossing or covering "
    "any human face. If faces are in the lower half, place the title "
    "in the upper third; if faces are in the upper half, place the "
    "title in the lower third. "
    "Aspect: exact 16:9 horizontal video-thumbnail framing. "
    "Absolutely no other text, no watermarks, no logos, no captions, "
    "no fake characters, no decorative glyphs anywhere in the image — "
    "only the one title."
)


def build_prompt(seg):
    title = seg["title"].strip()
    visual = seg.get("cover_prompt", "").strip()
    instr = TITLE_INSTRUCTION.format(title=title)
    if visual:
        return f"{visual}. {instr}"
    return instr


def call_gpt_image(prompt, ref_image, out_path, size, provider):
    cmd = [
        "node", str(GPT_IMAGE_CLI), "--json",
        "--provider", provider,
        "images", "edit",
        "--prompt", prompt,
        "--ref-image", str(ref_image),
        "--size", size,
        "--out", str(out_path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr[-3000:])
        proc.check_returncode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--segments", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument(
        "--size",
        default="1536x1024",
        help="cover dimensions; gpt-image-2 supports up to 4K. "
        "1536x1024 is the closest 16:9 standard size; use 1920x1080 if "
        "your provider supports custom dims.",
    )
    ap.add_argument(
        "--provider",
        default="codex",
        choices=["openai", "codex", "auto"],
        help="gpt-image-2 provider (default: codex)",
    )
    ap.add_argument(
        "--single",
        type=int,
        default=None,
        help="generate only segment id N",
    )
    args = ap.parse_args()

    cfg = json.loads(Path(args.segments).read_text(encoding="utf-8"))
    out_dir = Path(args.out).resolve()
    if not out_dir.exists():
        sys.exit(f"output dir not found: {out_dir} (run segment.py first)")

    if not GPT_IMAGE_CLI.exists():
        sys.exit(f"gpt-image-2 CLI not found at {GPT_IMAGE_CLI}; install gpt-image-2-skill")

    for seg in cfg["segments"]:
        if args.single is not None and seg["id"] != args.single:
            continue
        sid, slug = seg["id"], seg["slug"]
        frame = out_dir / f"frame_{sid:02d}_{slug}.jpg"
        cover = out_dir / f"cover_{sid:02d}_{slug}.png"
        if not frame.exists():
            print(
                f"[{sid:02d}] {slug}: frame missing → run segment.py first",
                file=sys.stderr,
            )
            continue
        prompt = build_prompt(seg)
        print(f"[{sid:02d}] generating cover for: {seg['title'].splitlines()[0]}…", file=sys.stderr)
        call_gpt_image(prompt, frame, cover, args.size, args.provider)
        print(f"[{sid:02d}] → {cover.name}", file=sys.stderr)


if __name__ == "__main__":
    main()
