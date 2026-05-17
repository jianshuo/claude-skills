#!/usr/bin/env bash
# Mass-send an already-created WeChat draft to all subscribers (or preview
# to a single OpenID first). On success, also enables comments on the article
# and persists msg_id / msg_data_id to publish.json so fetch-comments.sh can
# pull留言 later.
#
# WHY this is a separate command (not folded into upload-draft.sh):
#   - 订阅号 has only 1 mass-send slot per day. An accidental auto-trigger
#     burns the day's quota.
#   - Mass-send bypasses the human "草稿箱 → 后台预览 → 改一下措辞" gate.
#     That final human check has caught typos in the past — keeping it.
#
# Usage:
#   mass-send.sh <article-folder> --preview <openid>   # send to ONE person (yourself), 0 quota cost
#   mass-send.sh <article-folder> --preview <wxname>    # OR a WeChat ID (e.g. "jianshuo")
#   mass-send.sh <article-folder> --send                 # real broadcast to all subscribers
#
# --preview target auto-detection:
#   - Looks like an OpenID (28 chars, starts with 'o', alphanumeric) → uses `touser` field
#   - Otherwise treated as a WeChat ID (微信号) → uses `towxname` field
#   - Preview quota is 100/day per account (separate from the 1/day mass-send quota)
#
# Run --preview first. Inspect the message in your WeChat. If happy, run --send.
#
# Prerequisites:
#   - WECHAT_APPID + WECHAT_SECRET in env (same as upload-draft.sh)
#   - <article-folder>/publish.json exists with draft_media_id (written by upload-draft.sh)
#   - 公众号 is "已认证" (个人认证 or 企业认证) — unauthenticated 个人订阅号 gets errcode=48001

set -euo pipefail

ARTICLE_DIR="${1:-}"
MODE="${2:-}"
TARGET="${3:-}"

usage() {
  cat <<'EOF' >&2
usage:
  mass-send.sh <article-folder> --preview <openid-or-wxname>
  mass-send.sh <article-folder> --send

  --preview: mass/preview to one user (typically yourself). Argument is auto-detected:
              28-char string starting with 'o' → OpenID (touser)
              anything else                    → WeChat ID 微信号 (towxname)
              100/day preview quota; does NOT consume mass-send quota.
  --send:    mass/sendall to all subscribers. Burns today's 1 mass-send slot.
EOF
  exit 1
}

[[ -d "$ARTICLE_DIR" ]] || usage
ARTICLE_DIR="$(cd "$ARTICLE_DIR" && pwd)"

case "$MODE" in
  --preview) [[ -n "$TARGET" ]] || usage ;;
  --send)    ;;
  *)         usage ;;
esac

PUB="$ARTICLE_DIR/publish.json"
[[ -f "$PUB" ]] || { echo "error: $PUB missing (did you run upload-draft.sh?)" >&2; exit 1; }

: "${WECHAT_APPID:?WECHAT_APPID env var not set}"
: "${WECHAT_SECRET:?WECHAT_SECRET env var not set}"

# Get fresh access_token, then mass-send, then comment/open, then persist.
# All API I/O lives in one python block so errors surface cleanly.
WECHAT_APPID="$WECHAT_APPID" WECHAT_SECRET="$WECHAT_SECRET" \
ARTICLE_DIR="$ARTICLE_DIR" MODE="$MODE" TARGET="$TARGET" \
python3 <<'PYEOF'
import os, json, sys, urllib.request, urllib.parse, time

APPID  = os.environ['WECHAT_APPID']
SECRET = os.environ['WECHAT_SECRET']
DIR    = os.environ['ARTICLE_DIR']
MODE   = os.environ['MODE']
TARGET = os.environ['TARGET']
PUB    = os.path.join(DIR, 'publish.json')

pub = json.load(open(PUB))
media_id = pub.get('draft_media_id')
if not media_id:
    sys.exit('error: publish.json has no draft_media_id')

def api(method, path, body=None):
    url = f'https://api.weixin.qq.com/cgi-bin/{path}'
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))

print('→ fetching access_token ...', file=sys.stderr)
tok = api('GET', f'token?grant_type=client_credential&appid={APPID}&secret={SECRET}')
if 'access_token' not in tok:
    sys.exit(f'token error: {tok}')
TOKEN = tok['access_token']

if MODE == '--preview':
    # Auto-detect: OpenID is 28 chars, starts with 'o', alphanumeric+_-.
    # Anything else is a WeChat ID (微信号) → towxname field.
    import re
    is_openid = bool(re.fullmatch(r'o[A-Za-z0-9_-]{27}', TARGET))
    field = 'touser' if is_openid else 'towxname'
    label = 'OpenID' if is_openid else '微信号 (wxname)'
    print(f'→ mass/preview to {label}={TARGET} ...', file=sys.stderr)
    body = {field: TARGET, 'mpnews': {'media_id': media_id}, 'msgtype': 'mpnews'}
    r = api('POST', f'message/mass/preview?access_token={TOKEN}', body)
else:  # --send
    print('→ mass/sendall to ALL subscribers (burning today\'s 1 quota) ...', file=sys.stderr)
    body = {'filter': {'is_to_all': True},
            'mpnews': {'media_id': media_id},
            'msgtype': 'mpnews',
            'send_ignore_reprint': 0}
    r = api('POST', f'message/mass/sendall?access_token={TOKEN}', body)

if r.get('errcode', 0) != 0:
    hint = ''
    if r.get('errcode') == 48001:
        hint = ('\n  hint: 48001 = api unauthorized — but it\'s probably NOT what you think.'
                '\n  自 2025-07 起，微信回收了「个人主体」账号的「发布能力 API」权限。'
                '\n  即使你公众号有黄色 V（个人认证），mass/preview + mass/sendall 都返回 48001。'
                '\n  只有「企业主体认证」的服务号/订阅号才有这个 API 权限。'
                '\n  fallback：用 fetch-comments-by-cookie.sh + 浏览器抓包 cookie 拉留言（不依赖 API）'
                '\n  或者 mp.weixin.qq.com 后台 → 留言管理 → 人肉看 / 导出')
    elif r.get('errcode') == 45028:
        hint = '\n  hint: 45028 = today\'s mass-send quota exhausted (订阅号 1/day, 服务号 4/month)'
    sys.exit(f'mass send failed: {r}{hint}')

msg_id      = r.get('msg_id')
msg_data_id = r.get('msg_data_id')
print(f'  ✓ mass send OK: msg_id={msg_id}  msg_data_id={msg_data_id}', file=sys.stderr)

# Open comments on this article. Idempotent in practice — failures here are
# not fatal because comments may already be on, but we surface the result.
if msg_data_id:
    print('→ comment/open ...', file=sys.stderr)
    open_r = api('POST', f'comment/open?access_token={TOKEN}',
                 {'msg_data_id': int(msg_data_id), 'index': 0})
    if open_r.get('errcode', 0) == 0:
        print('  ✓ comments enabled', file=sys.stderr)
    else:
        print(f'  ⚠ comment/open returned {open_r} (may already be open — ignoring)', file=sys.stderr)

# Persist back to publish.json. Preserve any prior fields.
import datetime
now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
if MODE == '--preview':
    pub['preview_sent_at']      = now
    pub['preview_to']            = TARGET
    pub['preview_msg_id']        = msg_id
else:
    pub['mass_sent_at']          = now
    pub['msg_id']                = msg_id
    pub['msg_data_id']           = msg_data_id
    pub['comments_open']         = True
open(PUB, 'w').write(json.dumps(pub, ensure_ascii=False, indent=2))
print(f'  (publish.json updated)', file=sys.stderr)

if MODE == '--send':
    print('\n下一步：', file=sys.stderr)
    print('  - 等几分钟让粉丝看到 + 开始留言', file=sys.stderr)
    print(f'  - 然后 fetch-comments.sh "{DIR}" 把所有留言拉成 comments.md', file=sys.stderr)
PYEOF
