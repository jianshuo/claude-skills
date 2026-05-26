---
name: wjs-uploading-video
description: Upload one or many videos to YouTube. Use when the user wants to "上传到 YouTube", "发 YouTube", "批量上传", "upload to YouTube", "post videos to YouTube", or to publish a finished `final/` directory of MP4s. Reads per-video metadata (title / description / tags) from a sibling `UPLOAD_META.md` file when present (the user's standard markdown format), or from command-line flags. Survives behind a SOCKS/HTTP proxy by using `requests` directly for the resumable upload (the stock `google-api-python-client` MediaFileUpload stalls under this user's proxy setup).
---

# wjs-uploading-video

Push finished videos to YouTube. Defaults are tuned for this user's workflow (王建硕 channel, China network with local proxy, 1080p horizontal recordings from Riverside / multicam edits).

## When to use

- User has one or more finished `.mp4` files and wants them on YouTube
- User points to a `final/` directory with multiple segments and an `UPLOAD_META.md`
- User wants a specific privacy / playlist / scheduled publish

**Don't use** for:
- 微信视频号 upload (no public API; user uploads manually via web)
- 抖音 / 小红书 / B 站 (different APIs, not yet implemented here)
- YouTube Shorts variants from horizontal source (use `wjs-reframing-video` first to produce the 9:16 cut, then upload that via this skill)

## Prerequisites (one-time per machine)

1. **Google Cloud OAuth client**: `~/.config/youtube/credentials.json` must exist. See `references/credentials-setup.md` for the 5-minute setup if missing.
2. **Python deps**: `pip3 install google-auth-oauthlib google-api-python-client requests` (only `google-auth` + `requests` are strictly needed at upload time, but the OAuth-lib pulls them).
3. **First-ever upload** opens a browser for Google consent and writes `~/.config/youtube/token.json`. Subsequent runs reuse it silently.

## How it works (and why it's not the stock youtube-uploader)

YouTube's resumable upload protocol issues a `Location:` URL after the metadata POST, then accepts the bytes in chunked `PUT` requests. The stock `google-api-python-client` runs this over `httplib2`, which under this user's local SOCKS+HTTP proxy stack throws `[Errno 65] No route to host` or `socket.timeout` on those follow-up PUTs and stalls indefinitely.

This skill bypasses `httplib2`: it does OAuth via `google-auth`, then drives the resumable upload manually with `requests`, passing the proxy explicitly. 8 MB chunks (not the stock 256 KB) — fewer round-trips through the proxy. Exponential-backoff retry on `socket.timeout` / `ConnectionError` / 5xx.

If you're tempted to "just call the YouTube API client directly," don't — it'll fail in this environment.

## Usage

### Batch upload a `final/` directory

```bash
python3 ~/.claude/skills/wjs-uploading-video/scripts/upload_youtube.py \
  --dir "/path/to/final" \
  --meta "/path/to/final/UPLOAD_META.md"
```

The script:
1. Reads `UPLOAD_META.md` and pairs each `## NN · filename.mp4` block to a video file in `--dir`
2. Skips videos already in `--results-file` (default `<dir>/.youtube_upload_results.json`) — safe to re-run after failures
3. Uploads sequentially with progress every 8 MB
4. Writes the final URL list to `--results-file`

### Single file

```bash
python3 ~/.claude/skills/wjs-uploading-video/scripts/upload_youtube.py \
  --video /path/to/clip.mp4 \
  --title "My Title" \
  --description "Body text" \
  --tags "tag1,tag2,tag3"
```

### Common overrides

| Flag | Default | Notes |
|---|---|---|
| `--privacy` | `public` | `private` / `unlisted` / `public` |
| `--category` | `28` | 28 = Science & Tech. 27 = Education. 24 = Entertainment. |
| `--made-for-kids` | `false` | YouTube requires this declaration |
| `--playlist <ID>` | none | Add each uploaded video to a playlist |
| `--publish-at <ISO8601>` | none | Schedule publish (requires `--privacy private`) |
| `--credentials` | `~/.config/youtube/credentials.json` | OAuth client JSON |
| `--token` | `~/.config/youtube/token.json` | Cached OAuth token |
| `--chunk-mb` | `8` | Smaller chunks if uploads keep failing mid-flight |
| `--dry-run` | off | Parse meta + list what would upload, don't touch network |

## UPLOAD_META.md format

The parser expects the user's standard structure:

```
## 01 · segment_01_no-bugs.mp4

**短标题**
代码没有错误,只有意图不一致

**视频描述**
AI 时代屎山的重新定义...

—— 王建硕 × 任鑫《...》第 1 集

#王建硕 #AI编程 #ClaudeCode

---
```

Mapping:
- `## NN · <filename>` → which video this block describes
- `**短标题**` (or `**Title**`) block → YouTube **title**, verbatim. Short titles work but consider that YouTube allows up to 100 chars — if you want a richer title with series name, write it that way in `**短标题**`
- `**视频描述**` (or `**Description**`) block → YouTube **description**, verbatim, with the `#tag` hashtags retained at the bottom
- All `#word` tokens in the 视频描述 → comma-separated YouTube **tags** (each `#` is stripped; the user's channel name `王建硕` is auto-prepended per global instructions)

Filename in the heading must match an actual file in `--dir`. If a file exists but has no meta block, the script errors loudly — pass `--allow-missing-meta` to upload it with `--title <basename>` and empty description.

## Sensible defaults this skill bakes in

- **Privacy = public**: videos go live immediately and appear in subscriber feeds + search. Override per call with `--privacy unlisted` (link-only) or `--privacy private` (owner-only) when you want to review first
- **Category = 28 (Science & Tech)**: matches 王建硕 channel's main content; override with `--category` per upload
- **selfDeclaredMadeForKids = false**: YouTube requires this; the user's content is adult-targeted
- **Chunk size = 8 MB**: validated working size through this user's local proxy (256 KB stalled)
- **Skip already-uploaded**: results file is the source of truth; deleting it forces re-upload

## Channel-name CTA rule

If you write description footers, signatures, or "subscribe to me" lines into a video's metadata, use **王建硕** (the user's channel name). Don't put a guest's name there — guests like 任鑫 belong inside the description body when they're the conversation partner, never in the channel-CTA slot.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `access_denied 403` on consent screen | Add user's Google account to the OAuth client's Test users list in Google Cloud Console |
| `[Errno 65] No route to host` mid-upload | Almost always a proxy issue — verify `curl --max-time 10 https://upload.googleapis.com/upload/youtube/v3/videos` returns a 4xx (any 4xx = proxy reachable); if `000`, the proxy is down |
| Upload stalls with no progress lines | The proxy is silently buffering. Lower `--chunk-mb 4` or restart the proxy daemon |
| `quotaExceeded` (API units) | YouTube Data API default quota is 10,000 units/day, each upload is 1,600 units — so ~6 uploads/day. Request a quota bump in Google Cloud Console, or split uploads across days |
| `429 rateLimitExceeded` · `Video Uploads per day` | **A DIFFERENT, separate limit** from API units — YouTube's per-project *daily video-upload count* (anti-abuse, tied to project verification status; can be very low). When hit, **every** upload in the batch fails `init session failed: 429`, none succeed. It is NOT a proxy/auth problem and can't be worked around. It resets at **midnight US Pacific Time** (not your local midnight). Options: wait for the PT reset and re-run (the results file was cleared so all retry); or **upload via the YouTube Studio web UI**, which does NOT consume this API limit; or get the GCP project verified to raise the cap. Earlier uploads the same PT-day (even manual API ones) eat into this count. |
| Token refresh fails | Delete `~/.config/youtube/token.json` and re-run; OAuth browser flow restarts |

## After uploading

- Results saved to `--results-file` (JSON: file, title, video id, URL)
- Echo the URL list back to the user in a markdown table
- Videos are `public` by default — they're live the moment the upload completes. If the user wanted a review buffer, mention they can re-upload with `--privacy unlisted` (or flip back to unlisted in YouTube Studio)
- If they mentioned a 合集 / series, offer to create a YouTube playlist and batch-add the new uploads (the user must give a playlist ID or let you create one)
