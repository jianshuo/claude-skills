#!/bin/bash
# 在 Tokyo VPS 上装「做书账号」mb（root 跑，可重复跑，幂等）。2026-11-10 起视频书不再开一次性 Vultr 机器，
# 就在 VPS 本机的 mb 用户里一次做一本：run_book.sh 用专用密钥 ssh mb@127.0.0.1 驱动它（跟以前驱动云机器同一套命令）。
# 装：Node 22（只装在 mb 家目录，系统 Node 20 给 lab/paint/router 用，不动）、uv、Playwright Chromium（含系统库）、
#     Claude Code、huashu-art-motion 引擎和本 skill 的 git 副本。
# 闸：mb 整个用户 slice 限内存 2.8G（2.3G 起开始回收）、CPU 150%——做书再怎么吃也只会挤死自己，碰不到公众号中转、lab 这些常驻服务。
set -euxo pipefail
MB_ROOT=${MB_ROOT:-/opt/claude-agent/motion-book}
NODE_V=${NODE_V:-v22.23.4}
export DEBIAN_FRONTEND=noninteractive

id mb >/dev/null 2>&1 || useradd -m -s /bin/bash mb
# run_book.sh 以 claude-agent（lab 起的单元）或 root 跑；密钥放 MB_ROOT 下，属主跟 MB_ROOT 走
if [ ! -f "$MB_ROOT/worker_id" ]; then
  ssh-keygen -q -t ed25519 -N '' -f "$MB_ROOT/worker_id" -C motion-book-worker
  chown "$(stat -c %U "$MB_ROOT")": "$MB_ROOT/worker_id" "$MB_ROOT/worker_id.pub"; chmod 600 "$MB_ROOT/worker_id"
fi
install -d -o mb -g mb -m 700 /home/mb/.ssh
echo "from=\"127.0.0.1,::1\" $(cat "$MB_ROOT/worker_id.pub")" > /home/mb/.ssh/authorized_keys
chown mb:mb /home/mb/.ssh/authorized_keys; chmod 600 /home/mb/.ssh/authorized_keys

sudo -u mb -H NODE_V="$NODE_V" bash -c '
  set -eux
  cd ~
  mkdir -p ~/code ~/.claude/skills ~/art-films ~/.local
  if [ "$(~/.local/node/bin/node -v 2>/dev/null)" != "$NODE_V" ]; then
    curl -fsSL "https://nodejs.org/dist/$NODE_V/node-$NODE_V-linux-x64.tar.xz" | tar -xJ -C ~/.local
    rm -rf ~/.local/node; mv ~/.local/node-$NODE_V-linux-x64 ~/.local/node
  fi
  export PATH=$HOME/.local/node/bin:$HOME/.local/bin:$PATH
  command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
  command -v claude >/dev/null || curl -fsSL https://claude.ai/install.sh | bash
  [ -d ~/code/huashu-art-motion/.git ] || git clone -q --depth 1 https://github.com/alchaincyf/huashu-art-motion.git ~/code/huashu-art-motion
  [ -d ~/code/claude-skills/.git ] || git clone -q --depth 1 https://github.com/jianshuo/claude-skills.git ~/code/claude-skills
  ln -sfn ~/code/huashu-art-motion ~/.claude/skills/huashu-art-motion
  ln -sfn ~/code/claude-skills/wjs-voicedrop-creating-motion-book ~/.claude/skills/wjs-voicedrop-creating-motion-book
  ~/.local/bin/uv run --with playwright playwright install chromium
'
# Chromium 的系统库要 root 装
cd /tmp && /home/mb/.local/bin/uv run --with playwright playwright install-deps chromium
grep -q 'motion-book worker' /home/mb/.profile || \
  echo 'export PATH=$HOME/.local/node/bin:$HOME/.local/bin:$PATH RENDER_SLOTS=1   # motion-book worker' >> /home/mb/.profile

# mb 用户的 slice 限额（ssh 登进来的会话和 nohup 起的 claude/Chromium 都在里面）
install -d /etc/systemd/system/user-$(id -u mb).slice.d
cat > /etc/systemd/system/user-$(id -u mb).slice.d/50-motion-book.conf <<EOF
[Slice]
MemoryHigh=2300M
MemoryMax=2800M
CPUQuota=150%
TasksMax=2000
EOF
systemctl daemon-reload
touch /home/mb/.ready && chown mb:mb /home/mb/.ready
echo "做书账号就绪：ssh -i $MB_ROOT/worker_id mb@127.0.0.1"
