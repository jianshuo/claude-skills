#!/bin/bash
# 云端做一本书：在 Tokyo VPS 上跑（root，或 lab 服务的 claude-agent 用户——/api/video-book 就是用 systemd-run 起它）。
# 开一台一次性 Vultr 机器 → 装环境 → 无人值守 Claude Code 按本 skill 做完 HTML 版 → 拉回 → 发布到书架
# voicedrop.cn/books/<slug>/video/ → 销毁机器。不管成功失败，退出时都销毁（--keep 除外）；reaper.sh 兜底删开太久的机器。
#
# 用法：bash run_book.sh <slug> [--only ch01,ch02,ch03] [--plan vhp-8c-16gb-amd] [--max-hours 12] [--keep] [--no-publish] [--dry]
#   --dry：不派 Claude，只验证开机、装环境、Chromium 能出图、销毁（几美分）
#   --max-hours：缺省整本 12、试看版（--only）6；到点收工（拉回已有的东西、不发布）
# 路径（环境变量可改，lab 服务用 MB_ROOT=/opt/claude-agent/motion-book）：
#   $MB_ROOT/secrets.env            VULTR_API_KEY、VOLC_ASR_APPID、VOLC_ASR_ACCESS_TOKEN（600）
#   $MB_CLAUDE_ENV                  CLAUDE_CODE_OAUTH_TOKEN（缺省 /opt/claude-agent/.env：写书引擎同一个 setup-token 长期令牌，不轮换，可多机共用）
#   $VOICEDROP_CREDENTIALS          书架发布令牌（缺省 /opt/claude-agent/.config/voicedrop/credentials，build.mjs 发书同一份）
# 产物：$MB_ROOT/books/<slug>/（html/、稿、句时间、镜头表、qa、RESULT.md、cloud.log、claude.jsonl、state.json）
# state.json：{state: booting|setup|making|publishing|done|failed, step, startedAt, updatedAt, only, instance, url?, error?}
set -euo pipefail
SK="$(cd "$(dirname "$0")/.." && pwd)"
slug=${1:?用法：bash run_book.sh <slug> [--only …]}; shift
ONLY=""; PLAN=vhp-8c-16gb-amd; MAXH=""; KEEP=0; PUBLISH=1; DRY=0
while [ $# -gt 0 ]; do case $1 in
  --only) ONLY=$2; shift 2;; --plan) PLAN=$2; shift 2;; --max-hours) MAXH=$2; shift 2;;
  --keep) KEEP=1; shift;; --no-publish) PUBLISH=0; shift;; --dry) DRY=1; PUBLISH=0; shift;; *) echo "不认识的参数 $1"; exit 2;; esac; done
[ -n "$MAXH" ] || { [ -n "$ONLY" ] && MAXH=6 || MAXH=12; }
ROOT=${MB_ROOT:-/root/motion-book}; CLAUDE_ENV=${MB_CLAUDE_ENV:-/opt/claude-agent/.env}
export VOICEDROP_CREDENTIALS=${VOICEDROP_CREDENTIALS:-/opt/claude-agent/.config/voicedrop/credentials}
OUT=$ROOT/books/$slug; mkdir -p "$OUT"; exec > >(tee -a "$OUT/cloud.log") 2>&1
STARTED=$(date +%s); ID=""; STATE=booting
MB="$SK/cloud/mb.mjs"   # JSON 小活都交给它（以前是内嵌 python，2026-10-25 统一成 Node）
# st <state> <step> [url] [内部日志尾]：写 state.json（接口读它答进度；logTail 只内部用），并把 step 记进对外日志
st() { STATE=$1; node "$MB" state "$OUT/state.json" "$1" "$2" "${3:-}" "${4:-}" "$STARTED" "$ONLY" "$ID"; ev "$2"; prog "$2"; }
# 对外日志 events.json：只记「时间＋一句中文步骤」，不写路径、IP、机器 ID；同一句不连着重复记
ev() { node "$MB" event "$OUT/events.json" "$1"; }
# 有租约就把这一步报给 engine-router（状态页 lab.jianshuo.dev/router/「租约」栏显示；每报一次租约按 ttl 续期，12h 的整本也不会过期）
prog() { [ -n "${LEASE:-}" ] || return 0; STEP="$1" node -e 'process.stdout.write(JSON.stringify({step:process.env.STEP}))' | rt "/$LEASE/progress" >/dev/null || true; }
st booting "检查书和凭据"
# 编排机上的 skill 副本跟上 GitHub（以前从不更新，停在旧版本）。git 换文件是删了重建，正在跑的这份脚本不受影响，下一单才用新版。
( flock -w 120 9 && git -C "$SK" pull -q --ff-only origin main ) 9>"$(git -C "$SK" rev-parse --absolute-git-dir 2>/dev/null || echo /tmp)/harvest.lock" 2>/dev/null || echo "skill 副本没更新成（不影响这一单）"
echo "=== $(date -u +%FT%TZ) 开始：$slug ${ONLY:+（只做 $ONLY）} plan=$PLAN max=${MAXH}h dry=$DRY"
api() { curl -4 -sS --fail-with-body -H "Authorization: Bearer $VULTR_API_KEY" -H 'Content-Type: application/json' "$@"; }
J() { node "$MB" get "$1"; }   # J 'd.instance.id'：从 stdin 的 JSON 取值
KD=""; VULTR_API_KEY=""; LEASE=""; RURL=""; RTOK=""
# engine-router 租约（见 engine-router/README「接入方」）：lease → 「租约id 引擎 账号id 最早恢复」，挑不出是「- - - <eta>」，router 不通是空串
# 引擎 claude（订阅令牌）或 kimi（同一个 Claude Code CLI，换 Anthropic 兼容端点）——做书机上跑的都是 claude -p。
rt() { curl -4 -sS -m 10 -H "Authorization: Bearer $RTOK" -H 'Content-Type: application/json' -X POST "$RURL/v1/leases$1" -d @- 2>/dev/null; }
lease() {   # label = 状态页上显示的书名
  local lj; lj=$(T="《${TITLE}》视频书${ONLY:+（试看 ${ONLY}）}" node -e 'process.stdout.write(JSON.stringify(process.env.T))')
  echo "{\"kind\":\"text\",\"task_class\":\"video\",\"engine_hints\":{\"require\":[\"claude\",\"kimi\"]},\"ttl_ms\":21600000,\"label\":$lj}" | rt "" \
    | J '[d.lease_id||"-",d.engine||"-",String(d.account||"-").split("/").pop(),d.eta||"-"].join(" ")' 2>/dev/null || true; }
lease_done() {   # 回报并释放；本轮起过 Claude 又没成功，就把报错给 router，额度/凭据类报错会让该账号冷却
  # 429/额度在 claude.jsonl 的 is_api_error_message 里，不在 stderr；stderr 里 kimi 腿每次都有 unrecognized_model 告警（无害），滤掉
  # （2026-10-30 market-oracle：kimi 5h 撞墙，回报的却只有三行告警）
  [ -n "$LEASE" ] || return 0
  local err=""; if [ "$STATE" != done ] && [ -n "${ROUND:-}" ]; then
    err=$( { tail -c 300000 "$OUT/claude.jsonl" 2>/dev/null | grep '"is_api_error_message":true' | tail -1 | J 'd.message.content[0].text' 2>/dev/null || true
             grep -v 'claude-code:unrecognized_model' "$OUT/claude.err" 2>/dev/null || true; } | tail -c 400); fi
  OK=$([ "$STATE" = done ] && echo true || echo false) ERR="$err" ENG="${ENG:-claude}" node -e 'process.stdout.write(JSON.stringify({ok:process.env.OK==="true",engine_used:process.env.ENG,error:process.env.ERR}))' \
    | rt "/$LEASE/complete" >/dev/null || true
  LEASE=""; }
destroy() { set +e   # 退出一律走这里：销毁机器、删临时密钥、交还租约、没成功就把 state.json 落成 failed
  if [ -n "$ID" ]; then if [ $KEEP = 1 ]; then echo "保留机器 $ID（--keep），记得手动删"; else api -X DELETE "https://api.vultr.com/v2/instances/$ID" >/dev/null && { echo "=== 已销毁 $ID $(date -u +%FT%TZ)"; ev "制作机已销毁"; }; fi; fi
  [ -n "$KD" ] && rm -rf "$KD"
  lease_done
  case $STATE in done) ;; *) st failed "${STEP_DESC:-中途退出}" "" "$(tail -3 "$OUT/cloud.log" | tr '\n' ' ' | cut -c1-300)";; esac; }
trap destroy EXIT
getenv() { [ -r "$2" ] || return 0; grep -E "^(export )?$1=" "$2" | head -1 | sed -E "s/^(export )?$1=//; s/^[\"']//; s/[\"']\$//" || true; }
VULTR_API_KEY=$(getenv VULTR_API_KEY $ROOT/secrets.env); ASR_ID=$(getenv VOLC_ASR_APPID $ROOT/secrets.env); ASR_TK=$(getenv VOLC_ASR_ACCESS_TOKEN $ROOT/secrets.env)
CLAUDE_TK=$(getenv CLAUDE_CODE_OAUTH_TOKEN "$CLAUDE_ENV")
[ -n "$VULTR_API_KEY" ] && [ -n "$ASR_ID" ] && [ -n "$ASR_TK" ] && [ -n "$CLAUDE_TK" ] || { STEP_DESC="凭据不全"; echo "凭据不全"; exit 2; }

# 要做的章都写完了才开机（不然白花钱）
STEP_DESC="取书"; node "$SK/scripts/fetch_book.mjs" "$slug" "$OUT/章名.txt" ${ONLY:+--only $ONLY} > "$OUT/book_meta.json"
NCH=$(J 'd.chapters' < "$OUT/book_meta.json"); TITLE=$(J 'd.title' < "$OUT/book_meta.json")
ev "读到书：《$TITLE》共 $NCH 章${ONLY:+，这次只做 $(echo $ONLY | tr ',' ' ')}"

# 账号由 engine-router 在 claude-1/2、kimi-1 里按配速和红线挑。挑不出就在开机前排队等（每 10 分钟再问，最多 WAITH 小时），
# 不再 force 硬拿——2026-10-30 两个 Claude 号就是被视频书 force 吃光的。
# router 只回账号名，凭据取 secrets.env：claude → CLAUDE_TOKEN_<账号 id，- 换 _>；kimi → KIMI_KEY_<账号 id>（可选 KIMI_BASE_URL、KIMI_MODEL）。
# router 不通 / 没有这个账号的凭据 → 用 CLAUDE_TK（lab .env 那个 = claude-1）照做，不因此停工。
RURL=$(getenv ROUTER_URL "$CLAUDE_ENV"); RTOK=$(getenv ROUTER_TOKEN "$CLAUDE_ENV"); ACCT="缺省令牌（claude-1）"; ENG=claude; A=""; KIMI_KEY=""
WAITH=${MB_WAIT_HOURS:-6}; WAITED=0
if [ -n "$RURL" ] && [ -n "$RTOK" ]; then
  while :; do
    E=""; ETA=""; read -r LEASE E A ETA <<< "$(lease)" || true
    if [ "${LEASE:-}" != - ]; then break; fi
    if [ "${ETA:-}" = - ]; then ETA=""; fi
    if [ $WAITED -ge $((WAITH * 3600)) ]; then STEP_DESC="等 AI 额度超时"; echo "等了 ${WAITH}h 仍挑不出账号，放弃"; exit 1; fi
    st booting "等 AI 额度（几个账号都到了配速线或红线${ETA:+，最早 $(TZ=Asia/Shanghai date -d "$ETA" +%H:%M 2>/dev/null || echo "$ETA")}）"
    sleep 600; WAITED=$((WAITED + 600))
  done
  T=""
  if [ -n "$LEASE" ] && [ "$E" = kimi ]; then KIMI_KEY=$(getenv "KIMI_KEY_${A//-/_}" $ROOT/secrets.env); [ -n "$KIMI_KEY" ] && T=kimi
  elif [ -n "$LEASE" ]; then T=$(getenv "CLAUDE_TOKEN_${A//-/_}" $ROOT/secrets.env); fi
  if [ -n "$T" ]; then ENG=${E:-claude}; ACCT=$A; if [ "$ENG" = claude ]; then CLAUDE_TK=$T; fi
  else echo "router 没给出能用的账号（${LEASE:-router 不通} ${A:-}），用缺省令牌"; KIMI_KEY=""; lease_done; fi
fi
echo "引擎账号：${ACCT}${LEASE:+（$ENG，租约 $LEASE）}"; ev "这本由 ${ACCT} 来做"

KD=$(mktemp -d); ssh-keygen -q -t ed25519 -N '' -f "$KD/id" -C "motion-book-$slug"
UD=$(sed "s#__PUBKEY__#$(cat "$KD/id.pub")#" "$SK/cloud/cloud-init.sh" | base64 -w0)
STEP_DESC="开机"; ID=$(api -X POST https://api.vultr.com/v2/instances -d "{\"region\":\"nrt\",\"plan\":\"$PLAN\",\"os_id\":2284,\"label\":\"motion-book-$slug\",\"hostname\":\"motion-book\",\"tags\":[\"motion-book\"],\"backups\":\"disabled\",\"user_data\":\"$UD\"}" | J 'd.instance.id')
echo "开机 $ID"; st booting "申请制作机（8 核 16GB）"

IP=""; for i in $(seq 90); do read -r s ip < <(api "https://api.vultr.com/v2/instances/$ID" | J 'd.instance.status+" "+d.instance.main_ip')
  [ "$s" = active ] && [ "$ip" != 0.0.0.0 ] && { IP=$ip; break; }; sleep 10; done
[ -n "$IP" ] || { STEP_DESC="开机超时"; echo "开机超时"; exit 1; }
SSHO="-i $KD/id -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -o ServerAliveInterval=30 -o LogLevel=ERROR"
R() { ssh $SSHO "mb@$IP" "$@"; }
echo "IP $IP，等装环境（约 5–10 分钟）"; ev "制作机已开机"; st setup "安装制作环境（约 5 分钟）"
for i in $(seq 120); do R test -f .ready 2>/dev/null && break; sleep 15; done
R test -f .ready || { STEP_DESC="安装制作环境超时"; echo "装环境超时"; exit 1; }
echo "环境就绪 $(date -u +%T)"; ev "制作环境就绪（Node、Chromium、Claude Code、动画引擎）"
if [ "$ENG" = kimi ]; then   # 同 engine-router adapters.ts 的 kimi 腿：换端点，Claude Code 内部各档位（含子 agent）全映射到 Kimi 模型
  KM=$(getenv KIMI_MODEL $ROOT/secrets.env); KM=${KM:-k3[1m]}; KB=$(getenv KIMI_BASE_URL $ROOT/secrets.env); KB=${KB:-https://api.kimi.com/coding/}
  { printf 'export VOLC_ASR_APPID=%q\nexport VOLC_ASR_ACCESS_TOKEN=%q\nexport RENDER_SLOTS=4\n' "$ASR_ID" "$ASR_TK"
    printf 'export ANTHROPIC_BASE_URL=%q\nexport ANTHROPIC_API_KEY=%q\n' "$KB" "$KIMI_KEY"
    for k in ANTHROPIC_MODEL ANTHROPIC_DEFAULT_FABLE_MODEL ANTHROPIC_DEFAULT_OPUS_MODEL ANTHROPIC_DEFAULT_SONNET_MODEL ANTHROPIC_DEFAULT_HAIKU_MODEL CLAUDE_CODE_SUBAGENT_MODEL; do printf 'export %s=%q\n' $k "$KM"; done
    printf 'export CLAUDE_CODE_AUTO_COMPACT_WINDOW=1048576\nexport CLAUDE_CODE_MAX_CONTEXT_TOKENS=1048576\nexport CLAUDE_CODE_EFFORT_LEVEL=high\n'
  } | R 'umask 077; cat > ~/code/.env'
else
  printf 'export VOLC_ASR_APPID=%q\nexport VOLC_ASR_ACCESS_TOKEN=%q\nexport CLAUDE_CODE_OAUTH_TOKEN=%q\nexport RENDER_SLOTS=4\n' "$ASR_ID" "$ASR_TK" "$CLAUDE_TK" | R 'umask 077; cat > ~/code/.env'
fi

if [ $DRY = 1 ]; then   # 演习：只验证环境（Node、Claude Code、Chromium 出一张静帧）
  R 'bash -lc "set -e; node --version; claude --version; cd ~/code/huashu-art-motion/scripts/engine && uv run --with playwright python render.py --film gallery --solo 01_cave --stills 1.0 --no-counter --out /tmp/dry && ls -la /tmp/dry"' | tee "$OUT/dry.txt"
  st done "演习完成"; exit 0
fi

S='~/.claude/skills/wjs-voicedrop-creating-motion-book/scripts'
# 续做：上一轮拉回来的半成品（口播、ASR、句时间、已交稿的分镜和场景、稿、book.json）先传上去，Claude 只补缺的
RESUMED=0
if ls "$OUT"/音频/ch??.mp3 >/dev/null 2>&1; then
  R "mkdir -p ~/art-films/$slug"
  rsync -az -e "ssh $SSHO" --exclude 'html/' --exclude 'qa/' --exclude 'output/' --exclude '*.json.tmp' --exclude 'state.json' --exclude 'events.json' \
    --exclude 'cloud.log' --exclude 'claude.*' --exclude 'book_meta.json' --exclude '章名.txt' --exclude 'dry.txt' --exclude 'RESULT.md' "$OUT/" "mb@$IP:art-films/$slug/" && RESUMED=1
  [ $RESUMED = 1 ] && ev "接着上一轮的半成品做（口播 $(ls "$OUT"/音频/ch??.mp3 | wc -l | tr -d ' ') 章、分镜 $(ls "$OUT"/音频/*.shots.json 2>/dev/null | wc -l | tr -d ' ') 段已在）"
fi
RULES="- **子 agent 一律前台并行**：在同一条消息里同时发出多个 Agent 调用（一条消息别超过 10 个），不要用 run_in_background / 后台 agent，也不要说「等通知」就结束回合。这是 claude -p 无人值守模式：你一结束回合，进程就退出，还在跑的后台 agent 会被一起杀掉。一批全部返回后再派下一批。
- 不写完 ~/art-films/$slug/RESULT.md 不要结束回合。"
PROMPT="你在一台一次性的云服务器上（Vultr ${PLAN}，Ubuntu，有 Chromium，全程无人值守：没有人回答问题，不要停下来问）。
用 wjs-voicedrop-creating-motion-book skill 把书架上的《$TITLE》（slug $slug）做成竖屏 HTML 动画版${ONLY:+，只做 $ONLY 这几章（试看版，总装用 assemble.mjs --only $ONLY）}。
- 项目目录 ~/art-films/$slug。取书用 node $S/fetch_book.mjs $slug ~/art-films/章名.txt（这台机器没有 VoiceDrop MCP），再 new_book.mjs、narrate.mjs。
$([ $RESUMED = 1 ] && echo "- 项目目录里已经有上一轮做了一半的东西：先照样跑 new_book.mjs 把引擎装上（它不覆盖已有文件，book.json 里的画风沿用）；口播/ASR 已齐的章 narrate.mjs 会跳过；已有 chNN_x.js 和对应 shots.json、且冒烟通过的段不要重做，只补缺的段。" || true)
- 画风按 references/选画风.md 定，现在是**探索期**：先跑 node $S/pick_styles.mjs 抽候选，三个候选的主镜头必须真画出来（这台机器有 Chromium），评委必须用没参与画图的子 agent，不许跳过直接选已有套件。选中新画风就在 skill 的 kits/<名>/ 建成套件再开工——编排机会把它收回进 git，下一本书能复用。
- 分章制作派子 agent 并行；单个 agent 负责的口播不超过约 4 分钟，长章拆成 chNN_a / chNN_b（assemble 会自动按字母顺序拼）。渲染命令一律 bash $S/render_lock.sh 前缀（RENDER_SLOTS=4）。
$RULES
- 每章交稿前冒烟检查零报错零缺字；总装后整本冒烟检查，再 build_html.mjs。不要发布、不要上传到任何地方（编排机会拉回去发布），不要 git push。
- 全部完成后写 ~/art-films/$slug/RESULT.md：画风和理由、章节、镜头数、时长、冒烟结果、你知道的遗留问题。"
PROMPT_CONT="你上一轮在子 agent 还没全部交稿时就结束了回合，进程退出，那时还在跑的 agent 都被杀了。现在接着做《$TITLE》：
先看项目 ~/art-films/$slug 里已经有什么（各段 shots.json、代码工程/scenes/book/chNN*.js、qa/smoke），只补缺的段，然后总装、整本冒烟检查、build_html.mjs、写 RESULT.md。
$RULES"
# 起一轮 Claude。注意是「cd …;」不是「cd … &&」：「a && b &」会把整串放进一个后台子 shell，它攥着 ssh 的管道不放，ssh 一直不返回（2026-10-25 第一单就卡在这）
launch() {   # launch <第几轮>：第 1 轮用 PROMPT，之后 --continue 接着同一个会话、用 PROMPT_CONT
  local flag=""; if [ "$1" -gt 1 ]; then flag="--continue"; printf '%s' "$PROMPT_CONT" | R 'cat > ~/art-films/prompt.txt'; else printf '%s' "$PROMPT" | R 'cat > ~/art-films/prompt.txt'; fi
  R "rm -f ~/art-films/exit.code"
  R -n "cd ~/art-films; nohup bash -lc 'source ~/code/.env; claude -p $flag \"\$(cat prompt.txt)\" --dangerously-skip-permissions --output-format stream-json --verbose >> claude.jsonl 2>> claude.err; echo \$? > exit.code' > /dev/null 2>&1 < /dev/null &"
}
ROUND=1; MAXROUND=3; launch 1
echo "Claude 开工 $(date -u +%T)"; st making "Claude 开始制作"; STEP_DESC="制作中"

# 进度：每 2 分钟在做书机上跑一次 probe.mjs（开机时随 skill 克隆过去了），里程碑记进对外日志（只记变化），state.json 的 step 是一句总括。
# Claude 退出了但还没做出网页版 → 续跑（最多 MAXROUND 轮）；到时限就收工（开机前等额度的时间不算进时限）。
deadline=$(( STARTED + WAITED + MAXH * 3600 - 1200 )); TIMEUP=0; prevsum=""
while :; do
  while ! R test -f art-films/exit.code 2>/dev/null; do
    [ "$(date +%s)" -gt "$deadline" ] && { echo "到时限了，收工（未完成）"; ev "到了时限还没做完，收工"; TIMEUP=1; break; }
    sleep 120
    pj=$(R "node ~/.claude/skills/wjs-voicedrop-creating-motion-book/cloud/probe.mjs $slug" 2>/dev/null || true); echo "$(date -u +%T) $pj"
    [ -n "$pj" ] || continue
    summary=$(node "$MB" summary "$pj" "$NCH" "$SK/kits") || true   # 进度显示出错不能连累制作（set -e 会直接退出并销毁机器）
    while IFS= read -r line; do [ -n "$line" ] && ! grep -qxF -- "$line" <<< "$prevsum" && ev "$line"; done <<< "$summary"; prevsum=$summary   # 只记跟上一轮比变了的行
    last=$(printf '%s\n' "$summary" | tail -1); st making "${last:-Claude 制作中}"
  done
  echo "第 $ROUND 轮 Claude 退出码：$(R cat art-films/exit.code 2>/dev/null || echo 无)"
  [ $TIMEUP = 1 ] && break
  R test -f "art-films/$slug/html/index.html" 2>/dev/null && break
  [ $ROUND -ge $MAXROUND ] && { ev "续跑 $MAXROUND 轮仍没做完，收工"; break; }
  ROUND=$((ROUND + 1)); ev "Claude 中途停了，第 $ROUND 轮接着做"; launch $ROUND
done
STEP_DESC="取回成品"; ev "制作完成，取回成品"
rsync -az -e "ssh $SSHO" --exclude '代码工程/lib/' --exclude '代码工程/demos/' --exclude '代码工程/reference_films/' --exclude '代码工程/examples/' --exclude '静帧/' \
  "mb@$IP:art-films/$slug/" "$OUT/" || true
rsync -az -e "ssh $SSHO" "mb@$IP:art-films/claude.jsonl" "mb@$IP:art-films/claude.err" "$OUT/" 2>/dev/null || true
# 新画风套件收回：做书机上 kits/ 里新建（git 未跟踪）的套件目录 → 本书产物 kits/ → harvest_kits.sh 提交进 claude-skills 并推送。
# 机器马上要销毁，这一步不收就永远丢了。做没做完都收（套件常在第一章前就建好）。
STEP_DESC="收回画风套件"
KR='code/claude-skills/wjs-voicedrop-creating-motion-book/kits'
newkits=$(R "cd ~/code/claude-skills && git status --porcelain --untracked-files=normal -- wjs-voicedrop-creating-motion-book/kits" 2>/dev/null \
  | sed -n 's#^?? wjs-voicedrop-creating-motion-book/kits/\([^/]*\)/.*#\1#p' | sort -u || true)
for n in $newkits; do mkdir -p "$OUT/kits/$n"; rsync -az -e "ssh $SSHO" "mb@$IP:$KR/$n/" "$OUT/kits/$n/" && ev "收回新画风套件：$n"; done
bash "$SK/cloud/harvest_kits.sh" "$OUT" "$slug" || true
if [ $PUBLISH = 1 ] && [ -f "$OUT/html/index.html" ]; then
  st publishing "发布到书架"; STEP_DESC="发布"
  node "$SK/scripts/publish_video.mjs" "$OUT"
  st done "已发布" "https://voicedrop.cn/books/$slug/video/"
else STEP_DESC="这次没做出动画版"; echo "没有发布（--no-publish 或没有 html/index.html）"; [ $PUBLISH = 0 ] && st done "完成（未发布）"; fi
echo "=== 结束 $(date -u +%FT%TZ)，产物 $OUT"
