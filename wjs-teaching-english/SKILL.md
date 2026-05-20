---
name: wjs-teaching-english
description: Use when the user wants to teach / learn an English word as a video — turn a single English word into a self-contained HLS "supercut" lesson built from the mira video base. Stitches every season2 clip where the word is spoken (via the search-app API) into one .m3u8, prepended with a Claude-written bilingual word-intro card (word + IPA + 中文 gloss + usage, Volcano TTS) and appended with a 关注王建硕 CTA card. No MP4 burn. Triggers — "teach <word>", "讲讲 <word>", "学英语 <word>", "把 <word> 做成视频", "/wjs-teaching-english <word>".
---

# Teach an English word as a video supercut

Turn one English word into a self-contained HLS lesson:

```
intro.ts  (word /IPA/ · 中文 gloss · usage + Volcano TTS)
   ⋯ EXT-X-DISCONTINUITY
[supercut] every season2 clip where the word is spoken  (search-app /api/playlist, COS URLs)
   ⋯ EXT-X-DISCONTINUITY
cta.ts    (关注王建硕 + Volcano TTS)
= search-app/out/<word>.m3u8
```

No MP4 is burned — only the two cards are rendered as tiny `.ts`, re-encoded to
match the supercut's codec so they play in any HLS player.

## Prerequisites (check once)

- `ffmpeg` / `ffprobe` on PATH (Homebrew).
- Python `volcengine` SDK (declared in mira `requirements.txt`, used for TTS):
  `python3 -c "import volcengine"`. If missing, ask the user to allow
  `pip3 install volcengine==1.0.58` (it's a pinned repo dependency).
- The deployed search-app at `https://search-app-three-kappa.vercel.app`
  (default). Override with `SEARCH_APP_BASE=http://localhost:3000` if running
  locally (needs Node ≥ 23.6 + `npm start`).

## Steps

1. **Get the word.** A single English word (or short phrase). If the user gave
   a sentence, pick the target word.

2. **Write the mini-lesson JSON.** YOU (Claude) author it — no dictionary API.
   Keep it accurate and concise. Save to a temp file, e.g. `/tmp/lesson.json`:

   ```json
   {
     "word": "love",
     "ipa": "/lʌv/",
     "pos": "v. / n.",
     "gloss": "爱，热爱",
     "usage": "下面是它在真实电影里的说法",
     "tts_text": "love. 爱。"
   }
   ```

   - `tts_text` is read aloud over the intro card — keep it to the word + a
     short 中文 gloss (Volcano reads mixed English/中文 fine).
   - `usage` is one short line shown on the card (≤ ~20 chars renders best at
     low resolutions).

3. **Build it:**

   ```bash
   cd /Users/jianshuo/code/mira/search-app
   python3 scripts/build_lesson.py --word love --lesson /tmp/lesson.json
   ```

   Useful flags: `--speaker zh_female_qingxin` (default), `--limit 300` (max
   clips), `--no-tts` (silent cards), `--base <url>`, `--out <dir>`.

4. **Report** the printed output path (`search-app/out/<word>.m3u8`) and the
   clip count. The `.m3u8` plus its sibling `<word>.intro.ts` / `<word>.cta.ts`
   are the deliverable; `out/` is git-ignored.

## Notes

- If the word has no clips, the script exits with "no clips match" and writes
  nothing — tell the user and suggest a more common word.
- Intro/CTA are encoded to the FIRST supercut segment's resolution/codec/fps so
  the first discontinuity needs no decoder re-init (avoids `bufferAppendError`).
- To play locally: `ffplay search-app/out/<word>.m3u8`, or serve the `out/`
  folder over HTTP and open in any HLS player (Safari plays `.m3u8` natively).
