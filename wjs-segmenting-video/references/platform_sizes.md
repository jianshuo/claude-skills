# Platform cover dimensions

Reference for `compose_cover.py` (Pillow fallback path). The default `make_cover.py` path generates 16:9 covers matching the source video — these alternatives are only relevant when a platform mandates a specific cover ratio that differs from the video itself.

| Platform | Cover ratio | Pixels | Title placement |
|---|---|---|---|
| 视频号 (default) | 4:5 vertical | 1080×1350 | bottom 1/3 |
| 抖音 / Douyin | 9:16 | 1080×1920 | bottom 1/4 |
| 小红书 | 3:4 vertical | 1080×1440 | top or bottom band |
| YouTube Shorts | 9:16 | 1080×1920 | center band |
| Reels (Instagram) | 9:16 | 1080×1920 | bottom 1/3 |

Pass via `--platform wechat_channels|douyin|xiaohongshu|reels|shorts` to `compose_cover.py`. The default video-native 16:9 cover from `make_cover.py` works on all of these as a thumbnail upload, just with letterboxing inside the platform's preview UI.
