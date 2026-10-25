#!/bin/bash
# 渲染排队：同时最多 RENDER_SLOTS 个渲染进程（Chromium 一个峰值约 550MB；16GB Mac 取 2，云端 8 核 16GB 取 4）。
# 用法：bash render_lock.sh <命令…>   例：bash render_lock.sh uv run --with playwright python render.py --film ch01a …
N=${RENDER_SLOTS:-2}; D=${RENDER_LOCK_DIR:-/tmp/motion-book-render-slots}; mkdir -p "$D"
while :; do
  for s in $(seq "$N"); do if mkdir "$D/slot$s" 2>/dev/null; then trap 'rmdir "$D/slot'"$s"'"' EXIT; "$@"; exit $?; fi; done
  for s in $(seq "$N"); do f="$D/slot$s"; [ -d "$f" ] || continue   # 超过 15 分钟的槽位当作崩掉的进程留下的，收回
    m=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f"); [ $(( $(date +%s) - m )) -gt 900 ] && rmdir "$f" 2>/dev/null; done
  sleep 3
done
