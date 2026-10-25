#!/bin/bash
# 兜底清理：打了 motion-book 标签、开了超过 MAX_HOURS（缺省 13）小时的 Vultr 机器一律删除（run_book.sh 被杀、断网、VPS 重启时的保险）。
# lab 服务（/api/video-book）每 10 分钟调一次；手动用 root 跑也行。MB_ROOT 同 run_book.sh。
# 时限要比 run_book.sh 的 --max-hours（整本缺省 12）宽一点，否则会把正常在做的书杀掉。
set -euo pipefail
MAXH=${MAX_HOURS:-13}
MB="$(cd "$(dirname "$0")" && pwd)/mb.mjs"
K=$(grep -E "^(export )?VULTR_API_KEY=" "${MB_ROOT:-/root/motion-book}/secrets.env" | head -1 | sed -E "s/^(export )?VULTR_API_KEY=//; s/^[\"']//; s/[\"']\$//")
curl -4 -sS --fail-with-body -H "Authorization: Bearer $K" "https://api.vultr.com/v2/instances?tag=motion-book&per_page=100" | node "$MB" stale "$MAXH" | while read -r id age label; do
  curl -4 -sS -X DELETE -H "Authorization: Bearer $K" "https://api.vultr.com/v2/instances/$id" && echo "$(date -u +%FT%TZ) 删除超时机器 $id（$label，${age}h）"
done
