---
name: wjs-translating-subtitles
description: Use when the user has an SRT (or transcript text) in one language and wants it translated to another, with punctuation-bounded re-segmentation so cues end at real sentence breaks. Simplified Chinese (zh-CN) and English (en) are first-class targets; other targets follow the same rules. Outputs a target-language SRT or bilingual SRT — no audio, no burn-in. Triggers — "翻译字幕", "翻成中文", "translate this SRT", "中英双语字幕", "把这个 SRT 翻译成 X", "bilingual subtitles".
---

# wjs-translating-subtitles

Source-language SRT in → target-language (or bilingual) SRT out. **This skill is text-only.** Burn-in lives in `/wjs-burning-subtitles`; voice dub in `/wjs-dubbing-video`.

## When to use

- User has an SRT in language A and wants it in language B.
- User pasted a transcript (with or without timestamps) and wants a translation that becomes an SRT.
- User has an SRT but cues end mid-sentence — this skill's re-segmentation step fixes that.

## When NOT to use

- No source-language SRT yet → run `/wjs-transcribing-audio` first.
- User wants burned-in subtitles → finish translation here, then `/wjs-burning-subtitles`.
- User wants voice dub → finish translation here, then `/wjs-dubbing-video`.

## Pick the target

Resolve target from the user's phrasing once, don't re-ask:

- "翻成中文 / 中文字幕 / 中文配音" → `zh-CN`.
- "translate to English / English subs / English dub" → `en`.
- "bilingual" / "双语" → produce both `.<source>.srt` and `.<target>.srt` (and optionally a combined `.<source>-<target>.srt`).
- Ambiguous → default to whichever the user has historically chosen in the project.

Simplified Chinese and English are fully validated. Other targets (Japanese, Korean, French, etc.) work via the same rules; the bottleneck is TTS-voice availability if dubbing follows — see `/wjs-dubbing-video` before promising.

## Shared translation principles

- Prioritize meaning over literal wording.
- Use concise subtitle-style language — viewers read at ~3 wps for Chinese, ~3–4 wps for English; lines that exceed that go off-screen before they can be read.
- Preserve the tone of the speaker. Casual source → casual target; formal source → formal target.
- Do not over-translate names, brands, cultural references, or technical terms.
- Keep numbers, dates, names, and places accurate.
- If a phrase has no exact equivalent, translate the meaning naturally. No literal/word-for-word constructions.
- Avoid stiff, machine-translated output.

## Translating into Simplified Chinese (zh-CN)

- Use natural spoken Mandarin for casual speech, formal Mandarin for formal speech.
- Use Simplified characters only (do NOT use Traditional Hanzi unless the user explicitly asks).
- Subtitle lines should be roughly **15 Chinese characters** or fewer per line, max 2 lines per cue (3 only when unavoidable for very long cues).
- Use Chinese punctuation: 「，」「。」「；」「：」「、」「——」. Never mix English commas/periods into Chinese subtitles.
- **Minimize filler demonstratives 「这」「那」「这个」「那个」「那份」「那种」「那里」「那样」.** Spanish-to-Chinese (and English-to-Chinese) MT routinely inserts these because the source has overt demonstratives that Chinese usually drops. Examples:
  - "这把我们带入二元世界的载体" → "把我们带入二元的载体"
  - "运用那份能量" → "运用这股能量" if needed, or just "运用能量"
  - "正是在这合一里" → "正是在合一中"
  - "像罪人那样翻滚" → "像罪人翻滚" / "像罪人般翻滚"
  - "那份精微的觉知" → "精微的觉知"
  Keep them only when they carry real meaning (deixis, contrast, or fixed phrase like spiritual "我就是那" / "tat tvam asi"). Default is to delete; add back only if the sentence becomes ambiguous.

Examples (Spanish → Chinese):

```text
Spanish: No pasa nada.            → Chinese: 没关系。
Spanish: Vamos a ver qué pasa.    → Chinese: 我们看看会发生什么。
Spanish: Me parece una locura.    → Chinese: 我觉得这太疯狂了。
Spanish: ¿Qué quieres decir?      → Chinese: 你是什么意思？
Spanish: La verdad es que no lo esperaba.
                                  → Chinese: 说实话，我没想到会这样。
```

## Translating into English (en)

- Use natural conversational English. Avoid translationese ("It is precisely through entering the body…" → "It's by entering the body…").
- Lines should be roughly **40–42 characters** or fewer (about 7–9 words), max 2 lines per cue. Hard cap 50 chars per line.
- Use ASCII punctuation: `,` `.` `;` `:` `—` (em-dash). Avoid Unicode curly quotes — keeps `.srt` portable.
- For contemplative/spiritual content, prefer plain words over Latinate jargon: "presence" over "manifestation," "wholeness" over "totality," "wake up" over "awaken to consciousness."

Examples (Spanish → English):

```text
Spanish: No pasa nada.            → English: It's nothing.
Spanish: Vamos a ver qué pasa.    → English: Let's see what happens.
Spanish: Me parece una locura.    → English: This feels crazy to me.
Spanish: ¿Qué quieres decir?      → English: What do you mean?
Spanish: La verdad es que no lo esperaba.
                                  → English: Honestly, I wasn't expecting this.
```

## Re-segment at punctuation boundaries (mandatory)

Whisper segments by silence/breath, not grammar. The result almost always has cues that **end mid-sentence** (e.g., "...es una forma de aterrizar," next cue starts "el espíritu en el cuerpo..."). Any TTS that processes one cue at a time will then insert an unnatural pause exactly where the original speaker did not. The fix is mandatory before dubbing — and improves on-screen reading too.

Punctuation set differs:

- Chinese cues must end at `，` `。` `；` `：` `——` or `、`.
- English cues must end at `,` `.` `;` `:` `—` (em-dash) or, in practice for subtitles, occasionally a single dash. Never end an English cue on a comma-less clause break, and never split inside a phrase like "kind of" or "in order to".

Rules:

- **Every cue must end at a real punctuation mark.** Never let a cue end on a noun, verb, conjunction, or article that flows into the next cue.
- It is fine (and often necessary) to **split** a single source cue into 2–4 shorter cues, with timestamps interpolated by character position within the original cue's duration.
- It is fine to **merge** the tail of one source cue with the head of the next when they form one clause — the merged cue inherits the start of the first and the end of the second.
- Target 3–8 seconds per cue. Cues shorter than ~1.5s feel choppy on screen; cues longer than ~10s usually contain a missed punctuation break.

A typical 2–3 minute talk yields roughly 25–40 punct-bounded cues from 12–18 raw source cues. Don't try to keep the original cue count.

When TTS dubbing follows: the punctuation-bounded structure means each TTS clip is a complete utterance with proper end-intonation, and concatenating clips sounds natural because every join is at a real pause point.

## SRT output rules

```text
1
00:00:01,200 --> 00:00:04,800
中文字幕内容

2
00:00:04,800 --> 00:00:08,500
中文字幕内容
```

- Number subtitles sequentially starting from `1`.
- Timestamp format: `HH:MM:SS,mmm`. Comma milliseconds, **never** period milliseconds.
- Do not overlap timestamps.
- Preserve the original timing unless adjustment is necessary.
- Each subtitle should usually be 1–2 lines.
- If one subtitle is too long, split it into shorter subtitles when timing allows.
- Do not add commentary inside the subtitle file.

## Bilingual output

When the user asks for bilingual: source on first line, target on second:

```text
1
00:00:01,200 --> 00:00:04,800
No pasa nada.
没关系。
```

Rules:

- Keep source first, target second.
- Preserve timing.
- Avoid adding extra explanations unless requested.
- Keep both lines short enough to read.

## Output formats

Depending on the user request, provide one or more:

1. Target-only `.srt`
2. Bilingual `.srt` (source line + target line)
3. Target transcript without timestamps
4. Side-by-side source/target table

Default output for "translate this SRT" with no other modifiers: **target-only `.srt`** + a short uncertainty note if needed.

## File naming

```text
input.srt                          # source (e.g., from /wjs-transcribing-audio)

translated outputs:
  input.zh-CN.srt                  # Simplified Chinese only
  input.en.srt                     # English only
  input.es-zh.srt                  # Spanish + Chinese bilingual
  input.es-en.srt                  # Spanish + English bilingual
  input.es-zh-en.srt               # three-language
```

BCP-47-style suffixes make the target language obvious at a glance and keep multiple target-language outputs side-by-side.

## Handling unclear audio markers

If the source SRT contains `[inaudible]` or `[unclear]`:

- Translate the surrounding context naturally.
- Keep the bracketed marker in the target SRT (don't invent content).
- If a `[unclear]` chunk makes a cue ungrammatical in the target language, leave it bracketed and add a note in the response (not in the SRT file).

## Quality gate before handoff

- Subtitle numbers are sequential
- Timestamps are valid (`HH:MM:SS,mmm`, no overlap)
- Milliseconds use commas
- Translation is natural; speaker tone preserved
- Line length within platform/cue caps
- Proper nouns accurate
- No cue ends mid-clause / mid-phrase
- No invented content

## Downstream

- **`/wjs-burning-subtitles`** — burn this SRT onto the video, or soft-mux as a togglable track.
- **`/wjs-dubbing-video`** — generate a TTS voice dub from this SRT, time-aligned to the original timing.
- **For bilingual playback**: most platforms can soft-mux multiple subtitle tracks, but if you need bilingual *visible at once*, burn the `*.source-target.srt` directly via `/wjs-burning-subtitles`.

## Common pitfalls

- **Letting the cue end mid-sentence after translation.** The source's silence-aligned cues are unsafe boundaries; re-segment at punctuation, always.
- **Filler demonstratives in Chinese output.** MT inserts 「这」/「那」 because the source had `eso/that`. Delete them aggressively.
- **Period milliseconds.** Whisper local writes `.mmm`; SRT spec is `,mmm`. Always normalize.
- **Translating proper nouns.** Brand names, place names, technical terms — leave as-is or use the conventional target-language version (e.g., "OpenAI" stays, "New York" → "纽约").
- **Over-shortening for cue caps.** If a line is genuinely longer than the cap, split into two cues with interpolated timestamps; don't drop meaning to fit the cap.
- **Forgetting to do re-segmentation when no dub is requested.** The punct-bounded SRT is also better for *reading* — line endings at natural pauses match how viewers scan. Re-segment even when burn-only.
