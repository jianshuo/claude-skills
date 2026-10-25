#!/bin/bash
# 云端做一本书：在 Tokyo VPS 上跑（root）。开一台一次性 Vultr 机器 → 装环境 → 无人值守 Claude Code 按本 skill 做完 HTML 版
# → 拉回 → 发布到书架 voicedrop.cn/books/<slug>/video/ → 销毁机器。不管成功失败，退出时都销毁（--keep 除外）；
# 另有 reaper.sh 兜底：打 motion-book 标签、开了超过 6 小时的机器一律删。
#
# 用法：bash run_book.sh <slug> [--only ch01,ch02,ch03] [--plan vhp-8c-16gb-amd] [--max-hours 6] [--keep] [--no-publish] [--dry]
#   --dry：不派 Claude，只验证开机、装环境、Chromium 能出图、拉回、销毁（几美分）
# 凭据（只读，不复制进别人的目录）：
#   /root/motion-book/secrets.env      VULTR_API_KEY、VOLC_ASR_APPID、VOLC_ASR_ACCESS_TOKEN（600）
#   /opt/claude-agent/.env             CLAUDE_CODE_OAUTH_TOKEN（写书引擎同一个 setup-token 长期令牌，不轮换，可多机共用）
#   /opt/claude-agent/.config/voicedrop/credentials   书架发布令牌（build.mjs 发书同一份）
# 产物：/root/motion-book/books/<slug>/（html/、稿、句时间、镜头表、qa、RESULT.md、cloud.log、claude.jsonl）
set -euo pipefail
SK="$(cd "$(dirname "$0")/.." && pwd)"
slug=${1:?用法：bash run_book.sh <slug> [--only …]}; shift
ONLY=""; PLAN=vhp-8c-16gb-amd; MAXH=6; KEEP=0; PUBLISH=1; DRY=0
while [ $# -gt 0 ]; do case $1 in
  --only) ONLY=$2; shift 2;; --plan) PLAN=$2; shift 2;; --max-hours) MAXH=$2; shift 2;;
  --keep) KEEP=1; shift;; --no-publish) PUBLISH=0; shift;; --dry) DRY=1; PUBLISH=0; shift;; *) echo "不认识的参数 $1"; exit 2;; esac; done
ROOT=/root/motion-book; OUT=$ROOT/books/$slug; mkdir -p "$OUT"; exec > >(tee -a "$OUT/cloud.log") 2>&1
echo "=== $(date -u +%FT%TZ) 开始：$slug ${ONLY:+（只做 $ONLY）} plan=$PLAN max=${MAXH}h dry=$DRY"
getenv() { grep -E "^(export )?$1=" "$2" | head -1 | sed -E "s/^(export )?$1=//; s/^[\"']//; s/[\"']\$//"; }
VULTR_API_KEY=$(getenv VULTR_API_KEY $ROOT/secrets.env); ASR_ID=$(getenv VOLC_ASR_APPID $ROOT/secrets.env); ASR_TK=$(getenv VOLC_ASR_ACCESS_TOKEN $ROOT/secrets.env)
CLAUDE_TK=$(getenv CLAUDE_CODE_OAUTH_TOKEN /opt/claude-agent/.env)
[ -n "$VULTR_API_KEY" ] && [ -n "$ASR_ID" ] && [ -n "$ASR_TK" ] && [ -n "$CLAUDE_TK" ] || { echo "凭据不全"; exit 2; }
api() { curl -4 -sS --fail-with-body -H "Authorization: Bearer $VULTR_API_KEY" -H 'Content-Type: application/json' "$@"; }
J() { python3 -c "import json,sys;d=json.load(sys.stdin);print($1)"; }

# 要做的章都写完了才开机（不然白花钱）
node "$SK/scripts/fetch_book.mjs" "$slug" "$OUT/章名.txt" ${ONLY:+--only $ONLY} > "$OUT/book_meta.json"

KD=$(mktemp -d); ssh-keygen -q -t ed25519 -N '' -f "$KD/id" -C "motion-book-$slug"
UD=$(sed "s#__PUBKEY__#$(cat "$KD/id.pub")#" "$SK/cloud/cloud-init.sh" | base64 -w0)
ID=$(api -X POST https://api.vultr.com/v2/instances -d "{\"region\":\"nrt\",\"plan\":\"$PLAN\",\"os_id\":2284,\"label\":\"motion-book-$slug\",\"hostname\":\"motion-book\",\"tags\":[\"motion-book\"],\"backups\":\"disabled\",\"user_data\":\"$UD\"}" | J 'd["instance"]["id"]')
echo "开机 $ID"
destroy() { set +e; if [ $KEEP = 1 ]; then echo "保留机器 $ID（--keep），记得手动删"; else api -X DELETE "https://api.vultr.com/v2/instances/$ID" >/dev/null && echo "=== 已销毁 $ID $(date -u +%FT%TZ)"; fi; rm -rf "$KD"; }
trap destroy EXIT

IP=""; for i in $(seq 90); do read -r st ip < <(api "https://api.vultr.com/v2/instances/$ID" | J 'd["instance"]["status"]+" "+d["instance"]["main_ip"]')
  [ "$st" = active ] && [ "$ip" != 0.0.0.0 ] && { IP=$ip; break; }; sleep 10; done
[ -n "$IP" ] || { echo "开机超时"; exit 1; }
SSHO="-i $KD/id -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -o ServerAliveInterval=30 -o LogLevel=ERROR"
R() { ssh $SSHO "mb@$IP" "$@"; }
echo "IP $IP，等装环境（约 5–10 分钟）"
for i in $(seq 120); do R test -f .ready 2>/dev/null && break; sleep 15; done
R test -f .ready || { echo "装环境超时"; exit 1; }
echo "环境就绪 $(date -u +%T)"
printf 'export VOLC_ASR_APPID=%q\nexport VOLC_ASR_ACCESS_TOKEN=%q\nexport CLAUDE_CODE_OAUTH_TOKEN=%q\nexport RENDER_SLOTS=4\n' "$ASR_ID" "$ASR_TK" "$CLAUDE_TK" | R 'umask 077; cat > ~/code/.env'

if [ $DRY = 1 ]; then   # 演习：只验证环境（Node、Claude Code、Chromium 出一张静帧、冒烟检查）
  R 'bash -lc "set -e; node --version; claude --version; cd ~/code/huashu-art-motion/scripts/engine && uv run --with playwright python render.py --film gallery --solo 01_cave --stills 1.0 --no-counter --out /tmp/dry && ls -la /tmp/dry"' | tee "$OUT/dry.txt"
  exit 0
fi

S='~/.claude/skills/wjs-voicedrop-creating-motion-book/scripts'
PROMPT="你在一台一次性的云服务器上（Vultr ${PLAN}，Ubuntu，有 Chromium，全程无人值守：没有人回答问题，不要停下来问）。
用 wjs-voicedrop-creating-motion-book skill 把书架上的《$(python3 -c "import json;print(json.load(open('$OUT/book_meta.json'))['title'])")》（slug $slug）做成竖屏 HTML 动画版${ONLY:+，只做 $ONLY 这几章（试看版，总装用 assemble.mjs --only $ONLY）}。
- 项目目录 ~/art-films/$slug。取书用 node $S/fetch_book.mjs $slug ~/art-films/章名.txt（这台机器没有 VoiceDrop MCP），再 new_book.mjs、narrate.mjs。
- 画风按 references/选画风.md 自己定：可以出主镜头对比，评委用子 agent，定了就往下走。
- 分章制作派子 agent 并行；单个 agent 负责的口播不超过约 4 分钟，长章拆成 chNN_a / chNN_b（assemble 会自动按字母顺序拼）。渲染命令一律 bash $S/render_lock.sh 前缀（RENDER_SLOTS=4）。
- 每章交稿前冒烟检查零报错零缺字；总装后整本冒烟检查，再 build_html.mjs。不要发布、不要上传到任何地方（编排机会拉回去发布），不要 git push。
- 全部完成后写 ~/art-films/$slug/RESULT.md：画风和理由、章节、镜头数、时长、冒烟结果、你知道的遗留问题。"
printf '%s' "$PROMPT" | R 'cat > ~/art-films/prompt.txt'
R "cd ~/art-films && nohup bash -lc 'source ~/code/.env; claude -p \"\$(cat prompt.txt)\" --dangerously-skip-permissions --output-format stream-json --verbose > claude.jsonl 2> claude.err; echo \$? > exit.code' > /dev/null 2>&1 < /dev/null &"
echo "Claude 开工 $(date -u +%T)"

deadline=$(( $(date +%s) + MAXH * 3600 - 1200 ))
while ! R test -f art-films/exit.code 2>/dev/null; do
  [ "$(date +%s)" -gt "$deadline" ] && { echo "到时限了，收工（未完成）"; break; }
  sleep 120
  echo "$(date -u +%T) $(R "ls ~/art-films/$slug/代码工程/scenes/book/ch*.js 2>/dev/null | wc -l; ls ~/art-films/$slug/音频/*.mp3 2>/dev/null | wc -l" 2>/dev/null | tr '\n' ' ') （章节代码文件数、口播章数）"
done
echo "Claude 退出码：$(R cat art-films/exit.code 2>/dev/null || echo 无)"
rsync -az -e "ssh $SSHO" --exclude '代码工程/lib/' --exclude '代码工程/demos/' --exclude '代码工程/reference_films/' --exclude '代码工程/examples/' --exclude '静帧/' \
  "mb@$IP:art-films/$slug/" "$OUT/" || true
rsync -az -e "ssh $SSHO" "mb@$IP:art-films/claude.jsonl" "mb@$IP:art-films/claude.err" "$OUT/" 2>/dev/null || true
if [ $PUBLISH = 1 ] && [ -f "$OUT/html/index.html" ]; then
  VOICEDROP_CREDENTIALS=/opt/claude-agent/.config/voicedrop/credentials node "$SK/scripts/publish_video.mjs" "$OUT"
else echo "没有发布（--no-publish 或没有 html/index.html）"; fi
echo "=== 结束 $(date -u +%FT%TZ)，产物 $OUT"
