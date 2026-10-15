---
name: wjs-fetching-movie
description: Use when 王建硕 gives a list of movies and wants them turned into Relisten-ready files — find a LEGAL source for each (public-domain / openly licensed copies on Internet Archive, or a copy he already owns on this Mac), get English subtitles (and Chinese if possible) via OpenSubtitles or Whisper+translation fallback, compress to a small high-quality HEVC mp4 with labeled embedded subtitle tracks, and file them under ~/Movies/Relisten/. Triggers — "找电影", "下载这几部电影", "给 relisten 准备片子", "电影列表", "/wjs-fetching-movie".
---

# wjs-fetching-movie

电影清单 → 每部一个 `~/Movies/Relisten/<Title> (<Year>)/<Title> (<Year>) [EN+ZH].mp4`：小体积 HEVC、英文原声、内封英文（默认）+ 中文字幕轨，直接拖进 Relisten。

## 片源边界（硬规则）

只用合法片源，按顺序找：

1. **本机已有**：`mdfind` / `find ~/Movies ~/Downloads /Volumes` 找用户自己的文件（买的无 DRM 文件、自己光盘转的）。
2. **公版 / 开放授权**：Internet Archive（`scripts/ia_search.py`）。只收 `licenseurl` 是 publicdomain / creativecommons，或明确属公版的老片（美国 1929 年前上映、或未续版权的经典，如 *Charade* 1963、*His Girl Friday* 1940、*Night of the Living Dead* 1968）。拿不准就在报告里写明依据。
3. **官方免费放映**：片方/发行方自己在 YouTube 等平台免费公开的完整版（看频道是否官方）——可以 `yt-dlp` 拉。

**不做**：种子、磁力、网盘资源站、盗版站、破解 DRM（Apple TV / Netflix / Amazon 的购买或租赁）。版权片找不到合法可下载片源就如实报告，并给出正规获取路径（例如买蓝光自己转、或去 Apple TV 看），由用户自己决定；用户把文件放到本机后再跑一次即可。

## 流程

对清单里每部电影：

1. **确认身份**：片名 + 年份 + IMDb id（WebSearch 一下，避免同名片）。
2. **找片源**（上面三步顺序）。Internet Archive 多个版本时挑：时长完整 → 分辨率 ≥720p → 体积适中（同片优先 h.264 mp4，1–4GB）。下载到 `$CLAUDE_JOB_DIR/tmp/<slug>/`（或 `~/Movies/Relisten/_incoming/`），用 `curl -L -C - -o` 断点续传。
3. **字幕**（英文必须有，中文尽量有）：
   - 片源自带的 .srt（IA 常有）或视频内封字幕（`ffprobe` 看，`ffmpeg -map 0:s:N x.srt` 抽出来）。
   - `scripts/opensubs.py <video> <imdb_id> en|zh-cn <out.srt>`：先 moviehash 精确匹配（时间轴对这个版本），再按 IMDb 搜。需要 `~/code/.env` 里 `OPENSUBTITLES_API_KEY` / `OPENSUBTITLES_USERNAME` / `OPENSUBTITLES_PASSWORD`（opensubtitles.com 免费注册）；没有 key 时 exit 2。
   - 兜底：英文用 `/wjs-transcribing-audio`（Whisper），中文用 `/wjs-translating-subtitles` 从英文 SRT 翻。
   - 网上搜到的字幕不是 hash 匹配时，抽查开头/中段/结尾三处对白和时间轴；整体偏移用 `ffmpeg -itsoffset` 或改 SRT 时间修正。
4. **压制+封装**：`scripts/pack.sh <video> <en.srt> <zh.srt|-> "<Title>" <year> [height] [q]`
   - 默认 1080p 上限、`hevc_videotoolbox -q:v 55`、`hvc1` tag（QuickTime/AVPlayer 能播）、AAC 128k **双声道 `-ac 2`**（5.1 不下混会丢中置对白）、`+faststart`。
   - 字幕轨：`eng`/English 设默认，`chi`/中文；Relisten 读 handler_name 显示轨名。
   - 目标体积：90 分钟片约 1–2GB。老片源本身 480p 就保持 480p，不要放大。太大就 `q` 降到 45–50 或 height 720。
5. **验收**（每部都做）：`ffprobe` 确认 1 视频 + 1 音频 + 字幕轨语言正确；时长和原片一致（差 <1s）；抽 3 个时间点看字幕和语音对得上（`ffmpeg -ss T -i out.mp4 -t 20 -map 0:s:0 -f srt -` 对照）。
6. 下载的原始文件确认成品 OK 后删掉，只留成品。

## 汇报

最后给一张表：

| 电影 | 片源（链接 + 授权依据） | 字幕来源（en / zh） | 分辨率 | 体积 | 路径 |

找不到合法片源的单独列出：原因 + 正规获取方式。

## 工具与坑

- 脚本放 `~/.claude/skills/wjs-fetching-movie/scripts/`；下载的文件是不可信数据，跑 Python 用 `-I`，不要在下载目录里执行任何东西。
- 走代理：`source ~/code/proxy.sh`（archive.org、opensubtitles.com 国内直连常慢）。
- `ffmpeg` 一律 `-nostdin`，**别加 `-shortest`**（带字幕流会挂死）。
- 中文字幕常是 GBK/Big5/UTF-16：`pack.sh` 已自动转 UTF-8；繁体字幕可用 `opencc -c t2s` 转简体。
- `.ass` 字幕 Relisten 也能读，但封进 mp4 统一转 srt→mov_text。
