#!/bin/bash
# 兜底清理：打了 motion-book 标签、开了超过 MAX_HOURS（默认 6）小时的 Vultr 机器一律删除（run_book.sh 被杀、断网、VPS 重启时的保险）。
# lab 服务（/api/video-book）每 10 分钟调一次；手动用 root 跑也行。MB_ROOT 同 run_book.sh。
# 时限要比 run_book.sh 的 --max-hours（整本缺省 12）宽一点，否则会把正常在做的书杀掉。
set -euo pipefail
MAXH=${MAX_HOURS:-13}
K=$(grep -E "^(export )?VULTR_API_KEY=" "${MB_ROOT:-/root/motion-book}/secrets.env" | head -1 | sed -E "s/^(export )?VULTR_API_KEY=//; s/^[\"']//; s/[\"']\$//")
curl -4 -sS --fail-with-body -H "Authorization: Bearer $K" "https://api.vultr.com/v2/instances?tag=motion-book&per_page=100" | python3 -c "
import json,sys,datetime
now=datetime.datetime.now(datetime.timezone.utc)
for i in json.load(sys.stdin)['instances']:
    age=(now-datetime.datetime.fromisoformat(i['date_created'])).total_seconds()/3600
    print(i['id'], round(age,2), i['label'])" | while read -r id age label; do
  if python3 -c "import sys;sys.exit(0 if $age > $MAXH else 1)"; then
    curl -4 -sS -X DELETE -H "Authorization: Bearer $K" "https://api.vultr.com/v2/instances/$id" && echo "$(date -u +%FT%TZ) 删除超时机器 $id（$label，${age}h）"
  fi
done
