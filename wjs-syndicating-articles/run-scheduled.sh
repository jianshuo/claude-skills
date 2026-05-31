#!/bin/zsh
# Unattended daily run of wjs-syndicating-articles. launchd: com.jianshuo.syndicate @ 22:00.
# 不 source ~/.zshrc（交互配置在 launchd 下会挂）。显式 PATH 覆盖 claude / xurl / jq。
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
# launchd 无代理；国内发帖/调 API 需本地代理。
export HTTPS_PROXY="http://127.0.0.1:1087" HTTP_PROXY="http://127.0.0.1:1087"
export https_proxy="http://127.0.0.1:1087" http_proxy="http://127.0.0.1:1087"
export ALL_PROXY="socks5://127.0.0.1:1087" NO_PROXY="localhost,127.0.0.1,::1"

WORKDIR="/Users/jianshuo/code/wechat-publish"
LOG="$HOME/.claude/skills/wjs-syndicating-articles/state/scheduled.log"
mkdir -p "$(dirname "$LOG")"
cd "$WORKDIR" || { echo "$(date '+%F %T') cd failed" >> "$LOG"; exit 1; }

echo "===== $(date '+%F %T') scheduled run start =====" >> "$LOG"

PROMPT='运行 wjs-syndicating-articles skill 的定时流程：选最新一篇还没分发过的公众号文章，抽一套核心文案（保留王建硕语气），自动发到「X 以外」的有 API 平台（Bluesky / Threads / LinkedIn 等）。**不要发 X —— X 由 /wjs-tweeting-from-articles 单独负责，这里发会重复。** 手动平台（小红书 / 即刻 / 知乎等）备好 outbox，最后汇总结果。无人值守：不要问任何问题，不要开浏览器，发完即可。'

claude -p "$PROMPT" --allowedTools "Bash,Read,Write,Edit,Skill" >> "$LOG" 2>&1
echo "===== $(date '+%F %T') scheduled run end (exit $?) =====" >> "$LOG"
