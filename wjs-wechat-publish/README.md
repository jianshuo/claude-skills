# wjs-wechat-publish

Claude Code skill for writing and publishing **微信公众号 (WeChat Official Account)** articles, with AI-generated covers, AI-generated explanation illustrations, and a one-command upload helper.

Built around three principles:

1. **Light polish, no rewriting.** Preserve the author's voice. The skill fixes typos and paragraph spacing; it does not "improve" the prose.
2. **Two images per article.** A 2.35:1 typographic cover (题图) for the WeChat editor's cover field, and an aspect-ratio-flexible cartoon illustration (解释图) for the article body.
3. **Tier-1 publishing assist.** Open browser, reveal cover in Finder, push body HTML to clipboard as rich text — paste into mp.weixin.qq.com in ~2 minutes.

## What it does

```
draft → polish (light)
      → title + summary
      → cover (typographic, 900×383)
      → illustration (cartoon, model-chosen ratio)
      → article folder
      → publish.sh: open browser + clipboard
      → paste into mp.weixin.qq.com
```

Each article ends up in a dated folder:

```
articles/2026-05-09-my-slug/
├── original.md          # your raw input (backup)
├── article.md           # lightly polished markdown
├── article.html         # rich-text HTML for pasting
├── cover.png            # 题图 900×383 (2.35:1, strict)
├── illustration.png     # 解释图 (any ratio, AI picks)
├── meta.json            # title / summary / author / slug
└── cover-prompt-used.txt
```

## Install

```bash
git clone https://github.com/jianshuo/wjs-wechat-publish ~/.claude/skills/wjs-wechat-publish
```

Then in Claude Code, the skill auto-fires on prompts like "写一篇公众号", "润色", "准备发布", or "/wjs-wechat-publish".

## Dependencies

- **macOS** (uses `sips`, `pbcopy`, `osascript`, `open`)
- **Python 3** (for markdown→html conversion and meta parsing)
- **Node.js** (for the AI image generation wrapper)
- **[gpt-image-2-skill](https://github.com/Wangnov/gpt-image-2-skill)** — required for AI cover and illustration. Install:

  ```bash
  git clone https://github.com/Wangnov/gpt-image-2-skill /tmp/g
  cp -r /tmp/g/skills/gpt-image-2-skill ~/.claude/skills/
  ```

  Auth: either `OPENAI_API_KEY` (needs OpenAI org verification for `gpt-image-2`) **or** Codex `~/.codex/auth.json` (any ChatGPT Plus account works, no verification needed — recommended).

- **Optional**: `pandoc` for nicer markdown→html. The fallback is a built-in minimal converter.

## Usage

The skill does most of the work for you. After it asks 1–2 clarifying questions and produces the article folder, three scripts handle the assets:

```bash
DIR=articles/YYYY-MM-DD-slug

# Generate the typographic cover (2.35:1, auto-cropped to 900×383)
~/.claude/skills/wjs-wechat-publish/gen-cover-ai.sh "$DIR" "目标字词"

# Generate the cartoon explanation image (any aspect ratio)
~/.claude/skills/wjs-wechat-publish/gen-illustration.sh "$DIR"

# Open browser, reveal cover, push HTML to clipboard
~/.claude/skills/wjs-wechat-publish/publish.sh "$DIR"
```

Each script is idempotent — re-run it to get a different result (image generations are stochastic).

## Customization

Both image generators read prompt templates that you can edit:

- **`cover-prompt.md`** — the cover (题图) design philosophy, with `[目标字词]` placeholder. Locked to 2.35:1.
- **`illustration-prompt.md`** — the illustration (解释图) style guide, with `[文章内容]` placeholder. Aspect ratio chosen by the model based on content.

Environment variables (optional):
- `WECHAT_PUBLISH_IMAGE_SIZE` — default `1536x1024`
- `WECHAT_PUBLISH_IMAGE_QUALITY` — `auto` / `low` / `medium` / `high` (default `high`)

## Files

```
.
├── SKILL.md                    # how the skill behaves (its prompt)
├── cover-prompt.md             # AI cover prompt template
├── cover-template.html         # HTML/CSS fallback cover (no AI)
├── render-cover.sh             # render the HTML/CSS cover
├── gen-cover-ai.sh             # AI cover via gpt-image-2 → 900×383
├── illustration-prompt.md      # AI illustration prompt template
├── gen-illustration.sh         # AI illustration, no crop
└── publish.sh                  # Tier-1 publish helper
```

## Why two images?

The 题图 is the cover the reader sees in the WeChat feed *before* clicking. It needs maximum punch in 2.35:1 (900×383, the exact dimensions of the WeChat cover slot). Typography wins here.

The 解释图 lives inside the article. It needs to teach. A cartoon explanation often helps readers grasp the idea before reading the text. Forcing this image into the cover ratio destroys it. Different jobs, different aspect ratios.

## What this skill explicitly does NOT do

- It does not rewrite your prose. If you want an LLM to ghostwrite, this is the wrong tool.
- It does not auto-publish via WeChat API (Tier 1 only — opens browser + clipboard). Tier 2 (browser automation) and Tier 3 (official API, requires 服务号 + 企业认证) are not implemented.
- It does not manage 公众号 accounts, follower analytics, or scheduled posts.

## License

MIT — see [LICENSE](LICENSE).

## Author

[Wang Jianshuo (王建硕)](https://github.com/jianshuo) — built for my own 公众号 workflow, shared for anyone with the same problem.
