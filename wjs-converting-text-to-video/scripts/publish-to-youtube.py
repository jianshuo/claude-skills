#!/usr/bin/env python3
"""Publish a finished MP4 to YouTube, replacing any existing upload for the same article.

Usage:
  publish-to-youtube.py <article-folder>
  publish-to-youtube.py <article-folder> --privacy unlisted
  publish-to-youtube.py <article-folder> --dry-run

Behaviour:
  - Finds the MP4 at <article-folder>/<slug>.mp4 (slug = article-folder basename, last segment after the date prefix if present)
  - Reads article.md to derive title (first H1) + description (intro paragraphs)
  - Detects portrait vs landscape via ffprobe → portrait gets `#shorts` appended to title
  - If <article-folder>/.youtube.json exists with a video_id, attempts to DELETE that video first (requires youtube.force-ssl scope)
  - Uploads new via wjs-uploading-video's upload_youtube.py
  - Saves <article-folder>/.youtube.json with {video_id, url, kind, uploaded_at}
"""
from __future__ import annotations
import argparse, json, os, re, subprocess, sys, time
from pathlib import Path
from datetime import datetime, timezone

UPLOADER = Path.home() / ".claude/skills/wjs-uploading-video/scripts/upload_youtube.py"
TOKEN = Path.home() / ".config/youtube/token.json"

def detect_aspect(mp4: Path) -> str:
    """Returns 'portrait' or 'landscape'."""
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=s=x:p=0", str(mp4),
    ], text=True).strip()
    w, h = (int(x) for x in out.split("x"))
    return "portrait" if h > w else "landscape"

def find_mp4(article_dir: Path) -> Path:
    """Find the final MP4 in the article root (not in video/)."""
    candidates = [p for p in article_dir.glob("*.mp4")
                  if not p.name.startswith(".")
                  and "-OLD" not in p.name
                  and "-raw" not in p.name
                  and "-silang" not in p.name]
    if not candidates:
        sys.exit(f"No .mp4 found in {article_dir} (root level, parallel to video/)")
    if len(candidates) > 1:
        sys.exit(f"Multiple .mp4 candidates in {article_dir}: {[c.name for c in candidates]} — please specify")
    return candidates[0]

def parse_article(article_md: Path) -> tuple[str, str]:
    """Returns (title, description) from article.md."""
    text = article_md.read_text()
    # Title: first H1
    m = re.search(r"^#\s+(.+?)$", text, re.MULTILINE)
    title = m.group(1).strip() if m else article_md.parent.name
    # Description: first 2-3 non-heading paragraphs
    body = re.sub(r"^#.+?$", "", text, count=1, flags=re.MULTILINE).strip()
    paragraphs = []
    for para in body.split("\n\n"):
        para = para.strip()
        if not para or para.startswith("#") or para.startswith("![") or para.startswith("<"):
            continue
        # Strip markdown
        para = re.sub(r"\*\*(.*?)\*\*", r"\1", para)
        para = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", para)
        paragraphs.append(para)
        if len(paragraphs) >= 3:
            break
    desc = "\n\n".join(paragraphs)
    # Trim to 5000 chars (YouTube limit)
    if len(desc) > 4500:
        desc = desc[:4500] + "..."
    return title, desc

def load_existing(article_dir: Path) -> dict | None:
    p = article_dir / ".youtube.json"
    if p.exists():
        return json.loads(p.read_text())
    return None

def save_record(article_dir: Path, record: dict):
    (article_dir / ".youtube.json").write_text(json.dumps(record, ensure_ascii=False, indent=2))

def delete_video(video_id: str, dry_run: bool = False) -> bool:
    """Delete a YouTube video by ID. Returns True on success."""
    if dry_run:
        print(f"[dry-run] would delete YouTube video {video_id}")
        return True
    try:
        import requests
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        creds = Credentials.from_authorized_user_file(str(TOKEN))
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
        # Check scope
        scopes = creds.scopes or []
        if not any("youtube.force-ssl" in s or s == "https://www.googleapis.com/auth/youtube" for s in scopes):
            print(f"[warn] OAuth token only has scopes: {scopes}")
            print(f"[warn] Need 'youtube.force-ssl' to delete. Skipping delete of {video_id}.")
            print(f"[warn] Old video remains at https://youtu.be/{video_id} — delete manually or re-auth with broader scope.")
            return False
        proxies = None
        for k in ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"):
            v = os.environ.get(k)
            if v:
                proxies = {"http": v, "https": v}
                break
        r = requests.delete(
            f"https://www.googleapis.com/youtube/v3/videos?id={video_id}",
            headers={"Authorization": f"Bearer {creds.token}"},
            proxies=proxies, timeout=60,
        )
        if r.status_code == 204:
            print(f"[✓] deleted old video {video_id}")
            return True
        print(f"[warn] delete failed ({r.status_code}): {r.text[:300]}")
        return False
    except Exception as e:
        print(f"[warn] delete error: {e}")
        return False

def upload(mp4: Path, title: str, description: str, tags: list[str], privacy: str, dry_run: bool = False) -> str | None:
    """Run uploader, return video_id from results."""
    if dry_run:
        print(f"[dry-run] would upload {mp4.name}")
        print(f"  title: {title}")
        print(f"  description: {description[:200]}...")
        print(f"  tags: {tags}")
        return "DRYRUN_VIDEO_ID"
    cmd = [
        "python3", str(UPLOADER),
        "--video", str(mp4),
        "--title", title,
        "--description", description,
        "--tags", ",".join(tags),
        "--privacy", privacy,
    ]
    print(f"[upload] {' '.join(cmd[:3])} ...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)
    if result.returncode != 0:
        sys.exit(f"upload failed (rc={result.returncode})")
    # Parse video_id from stdout (multiple possible formats)
    patterns = [
        r"https://www\.youtube\.com/watch\?v=([A-Za-z0-9_\-]{11})",
        r"https://youtu\.be/([A-Za-z0-9_\-]{11})",
        r"✅\s+([A-Za-z0-9_\-]{11})\s",
        r"\"id\":\s*\"([A-Za-z0-9_\-]{11})\"",
    ]
    for pat in patterns:
        m = re.search(pat, result.stdout)
        if m:
            return m.group(1)
    print("[warn] couldn't parse video_id from upload output")
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("article_dir", type=Path)
    ap.add_argument("--privacy", choices=["public", "unlisted", "private"], default="public")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    article_dir = args.article_dir.resolve()
    if not article_dir.is_dir():
        sys.exit(f"Not a directory: {article_dir}")

    article_md = article_dir / "article.md"
    if not article_md.exists():
        sys.exit(f"No article.md in {article_dir}")

    mp4 = find_mp4(article_dir)
    aspect = detect_aspect(mp4)
    is_shorts = (aspect == "portrait")
    print(f"[detect] {mp4.name} = {aspect} → {'Shorts' if is_shorts else 'regular video'}")

    title, desc = parse_article(article_md)
    if is_shorts:
        title = f"{title} #shorts"
        desc = f"{desc}\n\n#shorts"

    # 王建硕 channel default tags
    tags = ["王建硕", "AI", "Claude Code", "竖屏短视频" if is_shorts else "视频"]

    # Check for existing upload
    existing = load_existing(article_dir)
    if existing and existing.get("video_id"):
        old_id = existing["video_id"]
        print(f"[replace] existing video: https://youtu.be/{old_id} — deleting first")
        delete_video(old_id, dry_run=args.dry_run)

    video_id = upload(mp4, title, desc, tags, args.privacy, dry_run=args.dry_run)
    if not video_id:
        sys.exit("upload returned no video_id")

    url = f"https://youtu.be/{video_id}"
    record = {
        "video_id": video_id,
        "url": url,
        "kind": "shorts" if is_shorts else "video",
        "title": title,
        "privacy": args.privacy,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "mp4_file": mp4.name,
    }
    if not args.dry_run:
        save_record(article_dir, record)
    print(f"[✓] published: {url}")
    print(f"[✓] record saved to {article_dir / '.youtube.json'}")

if __name__ == "__main__":
    main()
