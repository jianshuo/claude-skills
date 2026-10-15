#!/bin/bash
# pack.sh <video> <en.srt> [zh.srt|-] "<Title>" <year> [height=1080] [crf_q=55]
# → ~/Movies/Relisten/<Title> (<year>)/<Title> (<year>) [EN+ZH].mp4
# HEVC (VideoToolbox, hvc1) ≤height p + AAC stereo 128k + mov_text subs (eng default, chi), tagged.
set -euo pipefail
src=$1; en=$2; zh=${3:--}; title=$4; year=$5; height=${6:-1080}; q=${7:-55}
tag="EN"; [ "$zh" != "-" ] && tag="EN+ZH"
dir="$HOME/Movies/Relisten/${title} (${year})"; mkdir -p "$dir"
out="${dir}/${title} (${year}) [${tag}].mp4"; part="${out%.mp4}.partial.mp4"

# Subtitles: normalize to UTF-8 (Chinese subs are often GBK / UTF-16)
norm() { python3 -I - "$1" "$2" <<'PY'
import sys
b = open(sys.argv[1], 'rb').read()
for enc in ('utf-8-sig', 'utf-16', 'gb18030', 'big5', 'latin-1'):
    try: t = b.decode(enc); break
    except UnicodeDecodeError: pass
open(sys.argv[2], 'w', encoding='utf-8').write(t.replace('\r\n', '\n'))
PY
}
tmp=$(mktemp -d); norm "$en" "$tmp/en.srt"
inputs=(-i "$src" -i "$tmp/en.srt"); maps=(-map 0:v:0 -map 0:a:0 -map 1:0)
meta=(-metadata:s:s:0 language=eng -metadata:s:s:0 handler_name=English -metadata:s:s:0 title=English -disposition:s:0 default)
if [ "$zh" != "-" ]; then
  norm "$zh" "$tmp/zh.srt"; inputs+=(-i "$tmp/zh.srt"); maps+=(-map 2:0)
  meta+=(-metadata:s:s:1 language=chi -metadata:s:s:1 handler_name=中文 -metadata:s:s:1 title=中文 -disposition:s:1 0)
fi

# Only downscale if taller than target; keep 8-bit/10-bit as the encoder decides
ffmpeg -nostdin -hide_banner -loglevel warning -stats -y "${inputs[@]}" "${maps[@]}" \
  -vf "scale=-2:'min(${height},ih)'" -c:v hevc_videotoolbox -q:v "$q" -tag:v hvc1 \
  -c:a aac -b:a 128k -ac 2 -metadata:s:a:0 language=eng \
  -c:s mov_text "${meta[@]}" \
  -metadata title="${title} (${year})" -movflags +faststart "$part"
mv "$part" "$out"; rm -rf "$tmp"
echo "$out"
ffprobe -v error -show_entries format=duration,size:stream=index,codec_name,width,height:stream_tags=language,handler_name -of compact "$out"
