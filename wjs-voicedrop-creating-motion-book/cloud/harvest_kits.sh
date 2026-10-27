#!/bin/bash
# 收回画风套件进 git（在 Tokyo VPS 上由 run_book.sh 调）：做书机上新建的 kits/<名>/ 已被 rsync 到 <产物目录>/kits/，
# 这里把它们拷进 VPS 上的 claude-skills 仓库、在 kits/USAGE.tsv 记一行「这本书用了哪个画风」，commit 后用部署钥匙推到 GitHub。
# 一次性机器做完就删，不收回来新画风就跟着机器没了（2026-10-27 之前 9 本书全是这样，画风库一直只有两个）。
# 只收新目录：已有套件在某本书里被改动，多半是那本书的临时补丁，不收。
# 公开仓库：字体只收 woff/woff2（开源许可，随许可证文件），ttf/otf/ttc 一律不收；单文件 >8MB 不收。
# 推送失败不报错：提交留在 VPS 本地，下次收回时一起推。几本书同时收工用 flock 排队。
# 用法：bash harvest_kits.sh <产物目录> <slug>
set -uo pipefail
SK="$(cd "$(dirname "$0")/.." && pwd)"; OUT=$1; slug=$2
REPO=$(git -C "$SK" rev-parse --show-toplevel 2>/dev/null) || { echo "收回套件：$SK 不在 git 仓库里，跳过"; exit 0; }
KEY=${MB_DEPLOY_KEY:-/opt/claude-agent/.ssh/id_claude_skills_deploy}
PUSH_URL=${MB_PUSH_URL:-git@github.com:jianshuo/claude-skills.git}   # 演练时指向本地裸仓库
export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=20"
G() { git -C "$REPO" -c user.name="motion-book (vps-tokyo)" -c user.email="noreply@jianshuo.dev" "$@"; }

exec 9>"$REPO/.git/harvest.lock"; flock -w 900 9 || { echo "收回套件：等锁超时，跳过"; exit 0; }
G pull -q --rebase --autostash origin main || echo "收回套件：pull 失败，先在本地提交"

names=()
for d in "$OUT"/kits/*/; do
  [ -d "$d" ] || continue; n=$(basename "$d")
  [ -f "$d/kit.json" ] && [ -f "$d/lib.js" ] || { echo "收回套件：$n 缺 kit.json 或 lib.js，不收"; continue; }
  [ -e "$SK/kits/$n/lib.js" ] && ! [ -e "$SK/kits/$n/.harvested" ] && { echo "收回套件：$n 跟仓库里已有的套件重名，不收"; continue; }
  rsync -a --exclude='*.ttc' --exclude='*.ttf' --exclude='*.otf' --exclude='.DS_Store' --max-size=8m "$d" "$SK/kits/$n/"
  echo "$slug" > "$SK/kits/$n/.harvested"   # 记一笔是收回来的（重做同名套件时允许覆盖）
  names+=("$n")
done

# 用量流水：每本书一行（日期、slug、画风），pick_styles.mjs 据此偏向用得少的
kit=$(node -e 'try{process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).kit||""))}catch{}' "$OUT/book.json")
[ -n "$kit" ] && ! grep -q "	$slug	" "$SK/kits/USAGE.tsv" 2>/dev/null && printf '%s\t%s\t%s\n' "$(date -u +%F)" "$slug" "$kit" >> "$SK/kits/USAGE.tsv"

G add -- "$SK/kits"
G diff --cached --quiet && { echo "收回套件：没有新东西"; exit 0; }
G commit -q -m "motion-book：《$slug》${names:+收回新画风 ${names[*]}，}记画风用量（$kit）" || exit 0
echo "收回套件：已提交 $(G log --oneline -1)"
for i in 1 2 3; do
  G push -q "$PUSH_URL" HEAD:main && { echo "收回套件：已推到 GitHub"; exit 0; }
  sleep $((i * 10)); G pull -q --rebase origin main || true
done
echo "收回套件：推送失败（部署钥匙没配好或网络问题），提交留在 VPS 本地，下次收回时一起推"
