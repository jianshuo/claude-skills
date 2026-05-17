#!/usr/bin/env python3
"""
wjs-uploading-video: YouTube uploader that survives a local proxy.

Why a custom uploader instead of google-api-python-client's MediaFileUpload?
- httplib2 (under google-api-python-client) stalls or throws [Errno 65] No
  route to host on the resumable-upload PUTs under this user's local
  SOCKS+HTTP proxy stack.
- This script uses google-auth only for OAuth, then drives the YouTube
  resumable upload protocol manually with `requests`, passing the proxy
  explicitly. 8 MB chunks (vs the stock 256 KB) for fewer round-trips.

See SKILL.md and references/credentials-setup.md for setup and usage.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import socket
import sys
import time
from pathlib import Path
from typing import Optional

import requests

# Lazy import so --help works without google deps installed
def _import_google():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    return Credentials, Request


SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
DEFAULT_CRED = Path.home() / ".config" / "youtube" / "credentials.json"
DEFAULT_TOKEN = Path.home() / ".config" / "youtube" / "token.json"
DEFAULT_CHANNEL_TAG = "王建硕"  # user's channel name — always included in tags

UPLOAD_INIT_URL = (
    "https://www.googleapis.com/upload/youtube/v3/videos"
    "?uploadType=resumable&part=snippet,status"
)


# ────────────────────────────────────────────────────────────────────
# Proxy detection
# ────────────────────────────────────────────────────────────────────
def detect_proxies() -> Optional[dict]:
    """Read proxy from env. Returns dict for requests, or None."""
    for k in ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"):
        v = os.environ.get(k)
        if v:
            return {"http": v, "https": v}
    return None


# ────────────────────────────────────────────────────────────────────
# OAuth
# ────────────────────────────────────────────────────────────────────
def get_token(credentials_path: Path, token_path: Path) -> str:
    """Load + refresh OAuth token. If no token, run browser flow once."""
    Credentials, Request = _import_google()
    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            from google_auth_oauthlib.flow import InstalledAppFlow
            if not credentials_path.exists():
                raise FileNotFoundError(
                    f"credentials.json not found at {credentials_path}\n"
                    f"See ~/.claude/skills/wjs-uploading-video/references/credentials-setup.md"
                )
            flow = InstalledAppFlow.from_client_secrets_file(
                str(credentials_path), SCOPES
            )
            creds = flow.run_local_server(port=0)
        token_path.parent.mkdir(parents=True, exist_ok=True)
        with open(token_path, "w") as f:
            f.write(creds.to_json())
    return creds.token


# ────────────────────────────────────────────────────────────────────
# Metadata file parser (UPLOAD_META.md user-standard format)
# ────────────────────────────────────────────────────────────────────
def parse_meta_md(path: Path) -> dict:
    """
    Parse the user's UPLOAD_META.md format. Returns:
        { filename: {"title": ..., "description": ..., "tags": [...]} }

    Format expected:
        ## NN · filename.ext
        **短标题**
        title text
        **视频描述**
        body...
        body...
        #tag1 #tag2 #tag3
        ---
    """
    text = path.read_text(encoding="utf-8")
    out = {}
    # Split into per-video blocks at "## " headings that have "·" or "•"
    block_re = re.compile(
        r"^##\s+\S+\s*[·•]\s*(?P<fname>\S+\.\w+)\s*$",
        re.MULTILINE,
    )
    matches = list(block_re.finditer(text))
    for i, m in enumerate(matches):
        fname = m.group("fname")
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        block = text[start:end]

        title = _grab_section(block, "短标题") or _grab_section(block, "Title")
        desc = _grab_section(block, "视频描述") or _grab_section(block, "Description")

        if not title:
            continue

        # Tags: any #word tokens in the description body
        tag_tokens = re.findall(r"#([^\s#]+)", desc or "")
        tags = []
        for t in tag_tokens:
            t = t.strip()
            if t and t not in tags:
                tags.append(t)
        if DEFAULT_CHANNEL_TAG not in tags:
            tags.insert(0, DEFAULT_CHANNEL_TAG)

        out[fname] = {
            "title": title.strip(),
            "description": (desc or "").strip(),
            "tags": tags,
        }
    return out


def _grab_section(block: str, label: str) -> Optional[str]:
    """
    Find a **label** marker and return the body up to the next **label**,
    `---`, or end of block.
    """
    m = re.search(rf"\*\*{re.escape(label)}\*\*\s*\n(.*?)(?=\n\s*\*\*|\n\s*---|\Z)",
                  block, re.DOTALL)
    if not m:
        return None
    return m.group(1).strip()


# ────────────────────────────────────────────────────────────────────
# Upload
# ────────────────────────────────────────────────────────────────────
def init_session(token: str, title: str, desc: str, tags: list,
                 category: str, privacy: str, made_for_kids: bool,
                 publish_at: Optional[str], proxies: Optional[dict],
                 mimetype: str) -> str:
    """POST metadata, return resumable Location URL."""
    body = {
        "snippet": {
            "title": title,
            "description": desc,
            "tags": tags,
            "categoryId": str(category),
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": made_for_kids,
        },
    }
    if publish_at:
        body["status"]["publishAt"] = publish_at

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimetype,
    }
    r = requests.post(UPLOAD_INIT_URL, headers=headers, json=body,
                      proxies=proxies, timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"init session failed: {r.status_code} {r.text[:500]}")
    loc = r.headers.get("Location")
    if not loc:
        raise RuntimeError(f"no Location header in response: {dict(r.headers)}")
    return loc


def upload_chunks(session_url: str, fp: Path, total_size: int,
                  chunk_size: int, proxies: Optional[dict],
                  on_progress) -> dict:
    """Stream the file in PUT chunks with retry. Returns final response JSON."""
    offset = 0
    last_pct = -1
    with open(fp, "rb") as f:
        while offset < total_size:
            f.seek(offset)
            chunk = f.read(chunk_size)
            end = offset + len(chunk) - 1
            headers = {
                "Content-Length": str(len(chunk)),
                "Content-Range": f"bytes {offset}-{end}/{total_size}",
            }
            r = _put_with_retry(session_url, chunk, headers, proxies)
            if r.status_code in (200, 201):
                return r.json()
            if r.status_code == 308:
                # "Resume Incomplete" — confirm bytes received via Range header
                rng = r.headers.get("Range", "")
                if rng.startswith("bytes=0-"):
                    offset = int(rng.split("-")[1]) + 1
                else:
                    offset = end + 1
            else:
                raise RuntimeError(
                    f"chunk PUT failed: {r.status_code} {r.text[:500]}"
                )
            pct = int(offset * 100 / total_size)
            if pct != last_pct:
                on_progress(pct)
                last_pct = pct
    raise RuntimeError("upload loop ended without final response")


def _put_with_retry(url: str, data: bytes, headers: dict,
                    proxies: Optional[dict], max_retries: int = 5):
    """PUT with exponential backoff on socket/connection/5xx errors."""
    attempt = 0
    while True:
        try:
            r = requests.put(url, data=data, headers=headers,
                             proxies=proxies, timeout=300)
            if r.status_code in (500, 502, 503, 504):
                raise _RetryableHttp(r.status_code)
            return r
        except (_RetryableHttp, requests.RequestException,
                socket.timeout, ConnectionError, OSError) as e:
            attempt += 1
            if attempt > max_retries:
                raise
            wait = 2 ** attempt
            sys.stderr.write(
                f"  ⚠️  {type(e).__name__}: {e} — retry {attempt}/{max_retries} in {wait}s\n"
            )
            sys.stderr.flush()
            time.sleep(wait)


class _RetryableHttp(Exception):
    def __init__(self, status):
        super().__init__(f"HTTP {status}")
        self.status = status


def add_to_playlist(token: str, video_id: str, playlist_id: str,
                    proxies: Optional[dict]):
    url = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet"
    body = {
        "snippet": {
            "playlistId": playlist_id,
            "resourceId": {"kind": "youtube#video", "videoId": video_id},
        }
    }
    r = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
        },
        json=body,
        proxies=proxies,
        timeout=60,
    )
    if r.status_code not in (200, 201):
        sys.stderr.write(
            f"  ⚠️  playlist add failed: {r.status_code} {r.text[:300]}\n"
        )


# ────────────────────────────────────────────────────────────────────
# Orchestration
# ────────────────────────────────────────────────────────────────────
def upload_one(token: str, fp: Path, title: str, desc: str, tags: list,
               category: str, privacy: str, made_for_kids: bool,
               publish_at: Optional[str], chunk_size: int,
               proxies: Optional[dict], playlist_id: Optional[str]) -> dict:
    size = fp.stat().st_size
    size_mb = size / 1024 / 1024
    print(f"\n=== {fp.name} ({size_mb:.1f} MB) ===", flush=True)
    print(f"Title: {title}", flush=True)
    print(f"Tags : {', '.join(tags)}", flush=True)

    session = init_session(token, title, desc, tags, category, privacy,
                           made_for_kids, publish_at, proxies, "video/mp4")
    print(f"  session: {session[:80]}...", flush=True)

    def on_progress(pct: int):
        print(f"  upload {pct}%", flush=True)

    resp = upload_chunks(session, fp, size, chunk_size, proxies, on_progress)
    vid = resp["id"]
    url = f"https://www.youtube.com/watch?v={vid}"
    print(f"  ✅ {vid}  {url}", flush=True)

    if playlist_id:
        add_to_playlist(token, vid, playlist_id, proxies)
        print(f"  ➕ added to playlist {playlist_id}", flush=True)

    return {"file": fp.name, "title": title, "id": vid, "url": url}


def main():
    p = argparse.ArgumentParser(
        description="Upload one or many MP4s to YouTube (proxy-safe).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--video", type=Path, help="Single video file to upload")
    g.add_argument("--dir", type=Path,
                   help="Directory of .mp4 files — pair with --meta")

    p.add_argument("--meta", type=Path,
                   help="UPLOAD_META.md (required with --dir unless --allow-missing-meta)")
    p.add_argument("--allow-missing-meta", action="store_true",
                   help="Upload files even when no meta block exists (uses filename as title)")

    # Per-file overrides (used with --video)
    p.add_argument("--title")
    p.add_argument("--description", default="")
    p.add_argument("--tags", default="",
                   help="Comma-separated tags")

    # Status flags
    p.add_argument("--privacy", choices=["private", "unlisted", "public"],
                   default="public")
    p.add_argument("--category", default="28",
                   help="Numeric YouTube category id; 28=Science&Tech, 27=Education, 24=Entertainment")
    p.add_argument("--made-for-kids", action="store_true",
                   help="Declare madeForKids=true (default false)")
    p.add_argument("--publish-at",
                   help="ISO 8601 timestamp for scheduled publish (requires --privacy private)")
    p.add_argument("--playlist", help="Playlist ID to add each upload to")

    # Mechanics
    p.add_argument("--credentials", type=Path, default=DEFAULT_CRED)
    p.add_argument("--token", type=Path, default=DEFAULT_TOKEN)
    p.add_argument("--chunk-mb", type=int, default=8,
                   help="Upload chunk size in MB (default 8). Try 4 if uploads stall.")
    p.add_argument("--results-file", type=Path,
                   help="JSON file recording uploaded video IDs. Defaults to <dir>/.youtube_upload_results.json or <video parent>/.youtube_upload_results.json")
    p.add_argument("--dry-run", action="store_true",
                   help="Print what would happen, do not call YouTube")

    args = p.parse_args()

    proxies = detect_proxies()
    if proxies:
        print(f"[proxy] {proxies['https']}", file=sys.stderr)

    # Build the list of (path, meta) pairs
    jobs: list[tuple[Path, dict]] = []
    if args.video:
        if not args.title:
            sys.exit("--video requires --title")
        tags = [t.strip() for t in args.tags.split(",") if t.strip()]
        if DEFAULT_CHANNEL_TAG not in tags:
            tags.insert(0, DEFAULT_CHANNEL_TAG)
        jobs.append((args.video.resolve(),
                     {"title": args.title, "description": args.description,
                      "tags": tags}))
        default_results = args.video.parent / ".youtube_upload_results.json"
    else:
        d: Path = args.dir.resolve()
        if not d.is_dir():
            sys.exit(f"--dir not a directory: {d}")
        meta_path = args.meta or (d / "UPLOAD_META.md")
        meta: dict = {}
        if meta_path.exists():
            meta = parse_meta_md(meta_path)
            print(f"[meta] {meta_path}: parsed {len(meta)} block(s)",
                  file=sys.stderr)
        elif not args.allow_missing_meta:
            sys.exit(f"Meta file not found: {meta_path}\n"
                     f"Pass --allow-missing-meta to upload with filename-only titles.")

        for fp in sorted(d.glob("*.mp4")):
            entry = meta.get(fp.name)
            if entry is None:
                if not args.allow_missing_meta:
                    sys.exit(f"No meta block for {fp.name} in {meta_path}; "
                             f"add one or pass --allow-missing-meta.")
                entry = {
                    "title": fp.stem,
                    "description": "",
                    "tags": [DEFAULT_CHANNEL_TAG],
                }
            jobs.append((fp, entry))
        default_results = d / ".youtube_upload_results.json"

    results_path: Path = args.results_file or default_results

    # Skip already-uploaded (idempotent re-runs)
    prior: list = []
    done = set()
    if results_path.exists():
        try:
            prior = json.loads(results_path.read_text(encoding="utf-8"))
            done = {r["file"] for r in prior if r.get("id")}
        except Exception:
            prior = []

    if args.dry_run:
        print(f"\n[dry-run] privacy={args.privacy} category={args.category} "
              f"chunk={args.chunk_mb}MB playlist={args.playlist or '-'}")
        print(f"[dry-run] results file: {results_path}")
        for fp, m in jobs:
            mark = "⏭ " if fp.name in done else "↑  "
            print(f"{mark}{fp.name}  ←  title={m['title'][:60]}")
        return 0

    # Authenticate
    token = get_token(args.credentials, args.token)

    chunk_size = args.chunk_mb * 1024 * 1024
    results: list = list(prior)

    for fp, m in jobs:
        if fp.name in done:
            print(f"⏭  skip (already uploaded): {fp.name}", flush=True)
            continue
        try:
            r = upload_one(
                token=token,
                fp=fp,
                title=m["title"],
                desc=m["description"],
                tags=m["tags"],
                category=args.category,
                privacy=args.privacy,
                made_for_kids=args.made_for_kids,
                publish_at=args.publish_at,
                chunk_size=chunk_size,
                proxies=proxies,
                playlist_id=args.playlist,
            )
            results.append(r)
        except Exception as e:
            print(f"  ❌ FAIL: {type(e).__name__}: {e}", flush=True)
            results.append({"file": fp.name, "title": m["title"],
                            "id": None, "error": str(e)})
        # Persist after every video so a crash doesn't lose URLs
        results_path.parent.mkdir(parents=True, exist_ok=True)
        results_path.write_text(
            json.dumps(results, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    # Summary
    print("\n=== SUMMARY ===", flush=True)
    for r in results:
        mark = "✅" if r.get("id") else "❌"
        print(f"{mark} {r['file']}  {r.get('url', r.get('error', ''))}",
              flush=True)
    print(f"\nResults: {results_path}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
