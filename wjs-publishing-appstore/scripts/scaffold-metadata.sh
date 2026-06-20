#!/usr/bin/env bash
#
# scaffold-metadata.sh — create the fastlane `deliver` metadata tree.
#
# Writes fastlane/metadata/<locale>/*.txt for zh-Hans + en-US, plus the
# non-localized review_information/ and top-level files. Existing files are NOT
# overwritten (safe to re-run). Seeded with VoiceDrop copy as a worked example —
# edit every .txt before submitting.
#
# Usage: scripts/scaffold-metadata.sh
#
# Field length limits (App Store):
#   name 30 · subtitle 30 · keywords 100 (comma-separated, no spaces) ·
#   promotional_text 170 · description 4000 · release_notes 4000

set -euo pipefail
ROOT="fastlane/metadata"
mkdir -p "$ROOT/zh-Hans" "$ROOT/en-US" "$ROOT/review_information"

# put <path> <<heredoc — only writes if the file does not already exist
put() { local f="$1"; shift; [[ -e "$f" ]] && { echo "skip (exists) $f"; return; }; cat > "$f"; echo "wrote $f"; }

# ---------- zh-Hans ----------
put "$ROOT/zh-Hans/name.txt"            <<< 'VoiceDrop 口述备忘'
put "$ROOT/zh-Hans/subtitle.txt"        <<< '随口一录，自动归档'
put "$ROOT/zh-Hans/keywords.txt"        <<< '语音备忘,录音,口述,灵感,转写,iCloud,地理标记,笔记,速记,voice memo'
put "$ROOT/zh-Hans/promotional_text.txt" <<< '想到什么，按下就录。VoiceDrop 自动按时间和地点命名，上传到你的文件中转站，回头慢慢整理成文字。'
put "$ROOT/zh-Hans/description.txt" <<'TXT'
VoiceDrop 是一个极简的口述备忘工具：打开就录，松手即存。

灵感、待办、路上的一段思考——随手说出来，剩下的交给 VoiceDrop。

• 一键录音，后台也能继续
• 自动用时间 + 当前位置（城市/城区）命名文件，日后一眼认出
• 自动上传到你自己的文件中转站，并归档到 iCloud
• 极简界面，没有多余按钮

录下来，是为了不丢。VoiceDrop 帮你把每一个一闪而过的念头稳稳接住。
TXT
put "$ROOT/zh-Hans/release_notes.txt"   <<< '首次发布。'
put "$ROOT/zh-Hans/support_url.txt"     <<< 'https://home.wangjianshuo.com'
put "$ROOT/zh-Hans/marketing_url.txt"   <<< 'https://home.wangjianshuo.com'
put "$ROOT/zh-Hans/privacy_url.txt"     <<< 'https://home.wangjianshuo.com/privacy'

# ---------- en-US ----------
put "$ROOT/en-US/name.txt"              <<< 'VoiceDrop'
put "$ROOT/en-US/subtitle.txt"          <<< 'Speak it, it files itself'
put "$ROOT/en-US/keywords.txt"          <<< 'voice memo,recorder,dictation,notes,ideas,transcribe,iCloud,geotag,quick capture'
put "$ROOT/en-US/promotional_text.txt"  <<< 'Tap and talk. VoiceDrop names each memo by time and place, uploads it to your own file inbox, and gets out of your way.'
put "$ROOT/en-US/description.txt" <<'TXT'
VoiceDrop is the simplest possible voice memo: open it, talk, done.

An idea, a to-do, a thought on the road — say it out loud and let VoiceDrop handle the rest.

• One-tap recording, keeps going in the background
• Auto-names each file by time + current location (city / district) so you recognize it later
• Auto-uploads to your own file inbox and archives to iCloud
• Minimal interface, no clutter

Capture it so you never lose it. VoiceDrop catches every passing thought.
TXT
put "$ROOT/en-US/release_notes.txt"     <<< 'Initial release.'
put "$ROOT/en-US/support_url.txt"       <<< 'https://home.wangjianshuo.com'
put "$ROOT/en-US/marketing_url.txt"     <<< 'https://home.wangjianshuo.com'
put "$ROOT/en-US/privacy_url.txt"       <<< 'https://home.wangjianshuo.com/privacy'

# ---------- non-localized ----------
put "$ROOT/primary_category.txt"        <<< 'PRODUCTIVITY'
put "$ROOT/secondary_category.txt"      <<< 'UTILITIES'
put "$ROOT/copyright.txt"               <<< '2026 Jianshuo Wang'

# ---------- review_information ----------
put "$ROOT/review_information/first_name.txt"   <<< 'Jianshuo'
put "$ROOT/review_information/last_name.txt"    <<< 'Wang'
put "$ROOT/review_information/email_address.txt" <<< 'jianshuo@hotmail.com'
put "$ROOT/review_information/phone_number.txt"  <<< '+86 ...FILL_ME...'
put "$ROOT/review_information/demo_user.txt"    <<< ''
put "$ROOT/review_information/demo_password.txt" <<< ''
put "$ROOT/review_information/notes.txt" <<'TXT'
Sign in with Apple is used for an anonymous, zero-PII account. No demo account
needed — the app works immediately on first launch. Microphone is used for the
core recording feature; location (optional, can be denied) only tags the
filename with the current city/district.
TXT

echo
echo "Done. Edit every .txt under $ROOT before submitting — the seed copy is a starting point."
