#!/usr/bin/env bash
# 每天一本书 → 一个 X thread。launchd 每天 10:10 调（见 plist）。
#
# 流程：pick-next-book → fetch-book 素材 → claude -p 起草 thread（JSON 数组）
#       → 加权长度校验 → 封面图 media upload → xurl 链式发 → history.jsonl。
#
# Env overrides:
#   DRY_RUN=1        → 起草+校验，不发、不写 history
#   FORCE_SLUG=xxx   → 指定书，绕过 pick-next-book.sh

set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin:${PATH}"
export PATH

# launchd 无 shell 环境。按家规 source .env + proxy.sh（proxy.sh 自带端口探测，
# 不硬编码端口——1087 死端口的坑不再踩）。
set +u
[[ -f "${HOME}/code/.env" ]] && { set -a; source "${HOME}/code/.env"; set +a; }
[[ -f "${HOME}/code/machine-setup/proxy.sh" ]] && source "${HOME}/code/machine-setup/proxy.sh"
set -u

LOG_DIR="${HOME}/Library/Logs/wjs-publishing-books-to-x"
mkdir -p "$LOG_DIR"
exec > >(tee -a "${LOG_DIR}/daily-$(date +%Y-%m-%d).log") 2>&1
echo "=== wjs-publishing-books-to-x daily.sh start: $(date -Iseconds) DRY_RUN=${DRY_RUN:-0} ==="

for bin in claude xurl jq python3 curl; do
  command -v "$bin" >/dev/null 2>&1 || { echo "FATAL: missing $bin"; exit 1; }
done

today="$(date +%F)"
STATE="${HERE}/state"
HIST="${STATE}/history.jsonl"
mkdir -p "$STATE"
touch "$HIST"

record() { echo "$1" >> "$HIST"; }

# --- Step 1: 挑书 ---
if [[ -n "${FORCE_SLUG:-}" ]]; then
  SLUG="$FORCE_SLUG"; TITLE="$FORCE_SLUG"
else
  PICK=$("${HERE}/scripts/pick-next-book.sh"); rc=$?
  if [[ $rc -eq 3 ]]; then
    echo "没有可发的书了（全部发完）。"
    exit 0
  elif [[ $rc -ne 0 ]]; then
    echo "FATAL: pick-next-book failed (rc=$rc)"
    exit 1
  fi
  SLUG=$(printf '%s' "$PICK" | cut -f1)
  TITLE=$(printf '%s' "$PICK" | cut -f2-)
fi
echo "Picked: $SLUG （$TITLE）"

# --- Step 2: 抓素材 ---
MATERIAL="${STATE}/today-material.txt"
THREAD="${STATE}/today-thread.json"
rm -f "$MATERIAL" "$THREAD"
python3 "${HERE}/scripts/fetch-book.py" "$SLUG" "$MATERIAL" || {
  echo "FATAL: fetch-book failed"; record "{\"date\":\"${today}\",\"slug\":\"${SLUG}\",\"status\":\"fetch_failed\"}"; exit 1; }

# --- Step 3: claude 起草 thread ---
prompt=$(cat <<EOF
读这本书的素材文件：$MATERIAL
（这是王建硕在 VoiceDrop 上写的一本书，slug 是 $SLUG）

把这本书拆成一个 X (Twitter) thread，写成 JSON 字符串数组（每条 tweet 一个元素），用 Write 工具写到：
$THREAD

结构合同（总共 6-10 条）：
- 第 1 条：钩子——书的核心断言或问题 + 书名《$TITLE》。不带链接。
- 中间各条：按书的脉络每条讲透一个点，从素材的梗概/正文里抠具体内容（数字、比喻、反直觉的断言），不是报菜名式罗列章节标题。
- 倒数第 2 条：全书免费读 https://voicedrop.cn/books/$SLUG/
- 最后 1 条：讲这本书是怎么用 VoiceDrop 写出来的——丢一句中心思想（从素材推断这本书的 seed 是什么），整本书自己长出来、逐章补齐、不满意的地方一句话修书。落一句 voicedrop.cn。不写成广告词。

每条硬约束：
- 加权长度 ≤280（中文每字算 2，URL 一律算 23）；正文条控制在 120 个汉字以内
- 王建硕语气：平实、家常比喻、胸有成竹的断言
- 无 hashtag、无 emoji、无 @；链接只出现在最后两条
- 中英文之间加空格（盘古之白）

只写那个 JSON 文件（严格 JSON，数组套字符串），不要输出别的。
EOF
)
claude -p --allowedTools=Read,Write -- "$prompt" || {
  echo "FATAL: claude drafting failed"; record "{\"date\":\"${today}\",\"slug\":\"${SLUG}\",\"status\":\"draft_failed\"}"; exit 1; }
[[ -f "$THREAD" ]] || {
  echo "FATAL: no thread file"; record "{\"date\":\"${today}\",\"slug\":\"${SLUG}\",\"status\":\"no_thread_file\"}"; exit 1; }

# --- Step 4: 校验（严格 JSON、条数、加权长度） ---
python3 - "$THREAD" <<'PY' || { echo "FATAL: thread validation failed"; exit 1; }
import json, re, sys, unicodedata
arr = json.load(open(sys.argv[1]))
assert isinstance(arr, list) and all(isinstance(t, str) for t in arr), "not a string array"
assert 4 <= len(arr) <= 12, f"bad thread size {len(arr)}"
for i, t in enumerate(arr, 1):
    s = re.sub(r"https?://\S+", "x" * 23, t)
    w = sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)
    assert w <= 280, f"tweet {i} weighted {w} > 280: {t[:50]}"
print(f"validated: {len(arr)} tweets")
PY

N=$(jq 'length' "$THREAD")
echo "--- thread ($N tweets) ---"; jq -r 'to_entries[] | "[\(.key+1)] \(.value)\n"' "$THREAD"; echo "--- end ---"

if [[ "${DRY_RUN:-0}" == "1" ]]; then echo "DRY_RUN — not posting, not recording."; exit 0; fi

# --- Step 5: 封面图（拿不到就纯文字发，不阻塞） ---
COVER="${STATE}/today-cover.jpg"
MEDIA_ID=""
if curl -fsS -o "$COVER" "https://voicedrop.cn/books/${SLUG}/cover.jpg"; then
  # 坑：不带 --category tweet_image 会按视频处理，media id 无效
  up=$(xurl media upload --category tweet_image --media-type image/jpeg "$COVER" 2>&1)
  MEDIA_ID=$(printf '%s' "$up" | grep -oE '"media_id_string":"[0-9]+"' | grep -oE '[0-9]+' | head -1)
  [[ -n "$MEDIA_ID" ]] || MEDIA_ID=$(printf '%s' "$up" | grep -oE '"id":"[0-9]+"' | grep -oE '[0-9]+' | head -1)
  [[ -n "$MEDIA_ID" ]] || echo "WARN: media upload failed, posting without image: $up"
else
  echo "WARN: no cover.jpg, posting without image"
fi

# --- Step 6: 链式发 ---
PREV=""; FIRST_ID=""
for ((i = 0; i < N; i++)); do
  T=$(jq -r ".[$i]" "$THREAD")
  if ((i == 0)); then
    if [[ -n "$MEDIA_ID" ]]; then
      JSON=$(jq -nc --arg t "$T" --arg m "$MEDIA_ID" '{text:$t, media:{media_ids:[$m]}}')
    else
      JSON=$(jq -nc --arg t "$T" '{text:$t}')
    fi
  else
    JSON=$(jq -nc --arg t "$T" --arg r "$PREV" '{text:$t, reply:{in_reply_to_tweet_id:$r}}')
  fi
  resp=$(xurl -X POST -d "$JSON" /2/tweets 2>&1)
  # X 返回的 text 带裸换行，jq 会拒——grep 抠 id
  ID=$(printf '%s' "$resp" | grep -oE '"id":"[0-9]+"' | head -1 | grep -oE '[0-9]+')
  if [[ -z "$ID" ]]; then
    echo "FATAL: tweet $((i + 1))/$N failed: $resp"
    # 记 partial（slug 记下 = 这本不再重发，断的尾巴人工补）
    record "{\"date\":\"${today}\",\"slug\":\"${SLUG}\",\"status\":\"posted_partial\",\"posted\":$i,\"tweets\":$N,\"thread_first_id\":\"${FIRST_ID}\"}"
    exit 1
  fi
  ((i == 0)) && FIRST_ID="$ID"
  PREV="$ID"
  echo "  [$((i + 1))/$N] id=$ID"
  ((i < N - 1)) && sleep 5
done

URL="https://x.com/jianshuo/status/${FIRST_ID}"
echo "✓ Thread posted: $URL"
TITLE_JSON=$(printf '%s' "$TITLE" | jq -Rs .)
record "{\"date\":\"${today}\",\"slug\":\"${SLUG}\",\"title\":${TITLE_JSON},\"thread_first_id\":\"${FIRST_ID}\",\"tweets\":$N,\"url\":\"${URL}\",\"status\":\"posted\"}"
echo "=== done: $(date -Iseconds) ==="
