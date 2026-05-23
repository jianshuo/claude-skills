---
name: wjs-syndicating-articles
description: Use when the user wants to auto-syndicate their latest 微信公众号 article across social platforms — picks the newest un-syndicated article, extracts one core copy, auto-posts to API platforms (X / Bluesky / Threads / LinkedIn) and prepares a copy-paste outbox for manual platforms (Facebook / 小红书 / 即刻 / 知乎). Triggers — "分发文章到各平台", "同步到社交平台", "今天的文章发各平台", "/wjs-syndicating-articles".
---

# wjs-syndicating-articles

每天把最新一篇还没分发过的公众号文章，扇出（syndicate）到各社交平台。**一套文案走天下**，有 API 的真发，没 API 的备好待发件箱让你手动粘。

## Core Principles

- **稳定第一**：每个平台是独立步骤，一个失败绝不影响其它。
- **幂等去重**：`state/history.jsonl` 按 `(slug, platform)` 记录；重复跑只补发没成功的，永不重复发。
- **凭证降级**：API 平台缺/过期凭证 → 自动转 outbox（手动），不报错。
- **署名 / CTA 用「王建硕」**（用户全局偏好），不写营销腔、不堆 hashtag/@/emoji（除非原文有）。

## Inputs

```
/wjs-syndicating-articles                 # 选最新未分发文章，走完整流程（默认/定时用）
/wjs-syndicating-articles <article-folder># 显式指定文章
/wjs-syndicating-articles --open          # 交互模式：打开手动平台 web 页 + 文案进剪贴板
/wjs-syndicating-articles --dry-run       # 只草拟，不发、不写 history
/wjs-syndicating-articles --mark <slug> <platform>  # 手动标记某平台已发
```

`SKILL_DIR = ~/.claude/skills/wjs-syndicating-articles`

## Workflow (default / scheduled run)

### Step 0: --mark short-circuit
若调用是 `--mark <slug> <platform>`：`bash $SKILL_DIR/scripts/history.sh record <slug> <platform> posted` 然后告诉用户已标记，结束。

### Step 1: 选文章
```bash
bash $SKILL_DIR/scripts/pick-next-article.sh
```
- 显式指定了 `<article-folder>` 则跳过此脚本，直接用它。
- 输出为空 → 最近文章都分发完了，今天 rest day，结束。
- 记 `FOLDER`，`SLUG=$(basename "$FOLDER")`。

### Step 2: 抽一套核心文案（你来做，不是脚本）
读 `$FOLDER/article.md` 和 `$FOLDER/meta.json`。抽出**一段最 quotable 的核心句/小段，≤120 字**（保证塞进 X 的 280 字符；中文每字算 2），保留王建硕语气。再加一行软 CTA + 文章链接（公众号链接，没有就用 `meta.json` 里信息+ `article_url_base`）。

把最终文案写进 `$SKILL_DIR/outbox/<date>-<SLUG>/post.txt`（先 `mkdir -p`）。`<date>=$(date +%F)`。

`--dry-run` 时：打印 post.txt 内容 + 下面每个平台「将发什么」，**不**继续 Step 3+，结束。

### Step 3: API 平台（逐个 try/catch，真发）
对 `x bluesky threads linkedin` 各跑一次（按 config 里 mode==api 的）：

```bash
# 先去重：tweeting skill 也可能发过 X
if [[ "$P" == "x" ]]; then
  TW_HIST="$HOME/.claude/skills/wjs-tweeting-from-articles/state/history.jsonl"
  if [[ -f "$TW_HIST" ]] && grep -q "\"$SLUG\"" "$TW_HIST" && grep "\"$SLUG\"" "$TW_HIST" | grep -q '"status":"posted"'; then
    bash $SKILL_DIR/scripts/history.sh record "$SLUG" x skipped; continue
  fi
fi
if bash $SKILL_DIR/scripts/history.sh has "$SLUG" "$P"; then continue; fi   # already done

OUT="$(bash $SKILL_DIR/scripts/post-$P.sh "$POST_TXT")"; CODE=$?
case $CODE in
  0) URL="$(echo "$OUT" | sed -n 's/^url=//p')"; PID="$(echo "$OUT" | sed -n 's/^post_id=//p')"
     bash $SKILL_DIR/scripts/history.sh record "$SLUG" "$P" posted "$URL" "$PID" ;;
  3) bash $SKILL_DIR/scripts/history.sh record "$SLUG" "$P" queued "" "" no_creds ;;  # degrade -> outbox
  *) bash $SKILL_DIR/scripts/history.sh record "$SLUG" "$P" failed ;;                 # retry next run
esac
```

### Step 4: 手动平台 → 待发件箱
```bash
OUTBOX="$SKILL_DIR/outbox/$(date +%F)-$SLUG"
bash $SKILL_DIR/scripts/build-outbox.sh "$FOLDER" "$POST_TXT" "$OUTBOX"
for P in facebook xiaohongshu jike zhihu; do
  bash $SKILL_DIR/scripts/history.sh has "$SLUG" "$P" || bash $SKILL_DIR/scripts/history.sh record "$SLUG" "$P" queued
done
```
（degrade 到 outbox 的 API 平台同理已在 history 记为 queued；它们的文案就在同一个 OPEN.md 里。）

### Step 5: 通知 + 汇总
打印一张表：每个平台 status（posted+URL / queued(outbox) / failed / skipped）。
无人值守（定时）跑：发一条 PushNotification，例：「✅ X、Bluesky 已发；📋 Facebook/小红书/即刻/知乎 在 outbox 待粘：$OUTBOX」。
**不要**在 Step 5 自动开浏览器——那是 `--open` 的事。

## --open mode（交互，发手动平台时）
1. 找到今天的 outbox：`$SKILL_DIR/outbox/$(date +%F)-<SLUG>`（或最新一个）。
2. `cat OUTBOX/post.txt | pbcopy`（文案进剪贴板）。
3. 用 `/browse` skill 打开 config 里 facebook、jike、zhihu 的 `web_compose`。
4. 小红书：`open "$OUTBOX/image.png"`（Finder 弹出），提示用户 AirDrop 到手机、文案已在剪贴板。
5. 逐个提示：粘贴 → 发布。用户发完某个可 `--mark <slug> <platform>`。

## File Layout
```
$SKILL_DIR/
├── SKILL.md  config.json  secrets.json(gitignored)
├── scripts/  lib.sh history.sh pick-next-article.sh post-*.sh build-outbox.sh
├── outbox/<date>-<slug>/  post.txt image.png OPEN.md
└── state/history.jsonl
```

## 配置 API 平台（可选，配了才真发）
拷 `secrets.json.example` → `secrets.json`，按需填 bluesky / threads / linkedin。不填的平台自动走 outbox。

## Daily 自动化
```
/schedule daily 10:00 /wjs-syndicating-articles
```
