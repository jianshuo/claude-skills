#!/usr/bin/env python3
"""Post a chapter's transcript as YouTube comments under its video:
one top-level comment (part 1/N) + the remaining parts as replies.

Run: uvx --with google-auth --with requests python post-transcript-comments.py \
         <video_id> <chapter.md> [--header "《书名》第X章 全文文稿"]

Needs ~/.config/youtube/token.json with scope youtube.force-ssl.
Proxy: honors https_proxy/HTTPS_PROXY env (requests default behavior).
"""
import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

CHUNK = 4200          # chars per comment (YouTube hard limit ~10k; keep readable)
TOKEN = Path.home() / ".config/youtube/token.json"
API = "https://www.googleapis.com/youtube/v3"


def get_access_token() -> str:
    creds = Credentials.from_authorized_user_file(str(TOKEN))
    if not creds.valid:
        creds.refresh(Request())
        TOKEN.write_text(creds.to_json())
    if "youtube.force-ssl" not in " ".join(creds.scopes or []):
        sys.exit("token lacks youtube.force-ssl scope — re-auth first "
                 "(scripts/reauth-youtube.py)")
    return creds.token


def clean_transcript(md: str) -> str:
    """Strip site nav junk from an extracted chapter.md."""
    # start at first section heading
    m = re.search(r'^## ', md, re.M)
    if m:
        md = md[m.start():]
    # cut trailing nav (下一章/目录/听本章 footer)
    for marker in ("\n下一章 →", "\n← 上一章", "\n目录\n", "\n🎧"):
        i = md.find(marker)
        if i > 0:
            md = md[:i]
    md = re.sub(r'\n{3,}', '\n\n', md).strip()
    return md


def split_chunks(text: str, limit: int = CHUNK):
    paras, chunks, cur = text.split("\n\n"), [], ""
    for p in paras:
        cand = (cur + "\n\n" + p).strip()
        if len(cand) > limit and cur:
            chunks.append(cur)
            cur = p
        else:
            cur = cand
    if cur:
        chunks.append(cur)
    return chunks


def post(url, token, payload, proxies=None):
    r = requests.post(url, headers={"Authorization": f"Bearer {token}",
                                    "Content-Type": "application/json"},
                      data=json.dumps(payload), timeout=60)
    if r.status_code >= 300:
        sys.exit(f"API error {r.status_code}: {r.text[:400]}")
    return r.json()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video_id")
    ap.add_argument("chapter_md")
    ap.add_argument("--header", default="📖 本章全文文稿")
    args = ap.parse_args()

    text = clean_transcript(Path(args.chapter_md).read_text())
    chunks = split_chunks(text)
    n = len(chunks)
    token = get_access_token()

    first = f"{args.header}（1/{n}，其余在本条回复里）\n\n{chunks[0]}"
    top = post(f"{API}/commentThreads?part=snippet", token, {
        "snippet": {"videoId": args.video_id,
                    "topLevelComment": {"snippet": {"textOriginal": first}}}})
    parent = top["snippet"]["topLevelComment"]["id"]
    print(f"top comment posted ({len(first)} chars), id={parent}")

    for k, c in enumerate(chunks[1:], start=2):
        body = f"（{k}/{n}）\n\n{c}"
        post(f"{API}/comments?part=snippet", token,
             {"snippet": {"parentId": parent, "textOriginal": body}})
        print(f"reply {k}/{n} posted ({len(body)} chars)")
        time.sleep(2)   # be gentle; avoid spam-detection on rapid replies

    print(f"✓ {n} comment(s) posted on {args.video_id}")


if __name__ == "__main__":
    main()
