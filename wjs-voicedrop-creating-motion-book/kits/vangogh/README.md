# vangogh 画风套件

后印象派·梵高笔触（配方 huashu-art-motion `09_postimp`）。竖屏 1080×1920。实现 motion-book 套件接口（`window.K`），详细 API 见 `kit.json` 的 `api` / `notes` 字段（new_book.mjs 会把它们写进每本书的 `制作规范.md`）。

- `lib.js`：套件本体（单文件 IIFE，依赖引擎的 `U / PAINT / RIG / CAM / MO / TY`）。
- `kit.json`：name / label / grammar / fits / avoid / recipe / from_book / fonts / palette / api / notes / placeholder_bg。

核心思路：所有「面」用短笔触填充（`K.paint`），重的笔触层（背景整幅、道具、人物三层）都画进离屏位图缓存（`K.once` / `K.sprite` / `K.bg` 缓存，LRU），每帧只贴位图 + 画便宜的活物（星闪、灯晕环、火苗、热气、指针、图示）。无头 Chromium 软件光栅实测每镜每帧 8–37ms，冷启动首帧 0.6–1.1s。

高层 API 速查：背景 `K.bg`（night / room / window / field / plain）｜道具 `table chair chip chipStack chipPile lamp window clock book cup candle scales hourglass door cards sunflowers cypress`｜人 `K.person`（stand sit think slump cheer walk hold reach despair；mood、hat、beard、handN/handF、layer）、`K.crowd`｜图示 `arrow bars line num plate`｜字 `text popText callout subtitle finish chapterCard`。

自测工程：`~/art-films/_kittest`（测试镜头 `代码工程/scenes/book/ch01.js`，静帧 `静帧/`，源码分段在 `parts/`，`build.sh` 拼成 lib.js，`r.sh <镜头id>` 拼装＋渲静帧，`perf.py` 测帧耗时）。
