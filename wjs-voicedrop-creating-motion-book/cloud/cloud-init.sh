#!/bin/bash
# 一次性做书机的开机脚本（Vultr user_data，root 跑一次）：Node 22、uv、Playwright Chromium（含系统依赖）、Claude Code、
# huashu-art-motion 引擎和本 skill。装完写 /home/mb/.ready。日志 /var/log/motion-book-init.log。
# __PUBKEY__ 由 run_book.sh 换成本次运行临时生成的公钥（只给 mb 用户，不给 root）。
set -euxo pipefail
exec > /var/log/motion-book-init.log 2>&1
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl ca-certificates rsync tmux python3 xz-utils
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -        # Node 22：WebSocket 内置
apt-get install -y nodejs
useradd -m -s /bin/bash mb
install -d -o mb -g mb -m 700 /home/mb/.ssh
echo "__PUBKEY__" > /home/mb/.ssh/authorized_keys
chown mb:mb /home/mb/.ssh/authorized_keys; chmod 600 /home/mb/.ssh/authorized_keys
sudo -u mb -H bash -lc '
  set -eux
  curl -LsSf https://astral.sh/uv/install.sh | sh
  curl -fsSL https://claude.ai/install.sh | bash
  mkdir -p ~/code ~/.claude/skills ~/art-films
  git clone -q --depth 1 https://github.com/alchaincyf/huashu-art-motion.git ~/code/huashu-art-motion
  git clone -q --depth 1 https://github.com/jianshuo/claude-skills.git ~/code/claude-skills
  ln -sfn ~/code/huashu-art-motion ~/.claude/skills/huashu-art-motion
  ln -sfn ~/code/claude-skills/wjs-voicedrop-creating-motion-book ~/.claude/skills/wjs-voicedrop-creating-motion-book
  ~/.local/bin/uv run --with playwright playwright install chromium
'
# Chromium 的系统库要 root 装
cd /tmp && /home/mb/.local/bin/uv run --with playwright playwright install-deps chromium
echo 'export PATH=$HOME/.local/bin:$PATH RENDER_SLOTS=4' >> /home/mb/.profile
touch /home/mb/.ready && chown mb:mb /home/mb/.ready
