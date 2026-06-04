---
name: wjs-publishing-hugo
description: 当用户想给自己的 Hugo 静态博客（如 maggiacito.com）新增或编辑帖子、管理类目、上传图片并发布上线时使用——对话式后台，说一句就改文件、commit、推送、自动部署，不需要任何 CMS/服务器。触发词：「发一篇博客」「给 Hugo 加文章」「写篇帖子到博客」「管理博客类目」「上传图片到博客」「博客后台」「/wjs-publishing-hugo」。
---

# wjs-publishing-hugo

Hugo 博客的对话式后台。**我就是后台**——没有 CMS、没有 /admin 页面、没有 PAT、没有 Cloudflare。
你说要发什么，我按仓库约定改 `content/`、放图、commit、push，走仓库现有部署流自动上线。

适用：maggiacito.com 这类 Hugo 站（`content/posts/*.md` + categories/tags taxonomy + GitHub Pages
Actions 部署）。其它 Hugo 仓库也能用，先按下面「前置检测」对齐约定。

## 前置检测（每次开工先做）
1. 确认在 Hugo 仓库根：有 `hugo.toml`（或 `config.toml`）和 `content/`。不在就让用户给路径。
2. 读 `hugo.toml`：拿 `timeZone`、`[taxonomies]`（确认 `categories`/`tags`）。
3. 看一篇现有帖子的 front matter（`content/posts/` 里随便挑一篇），确认字段与下面「权威格式」一致；
   不一致就以**仓库现状**为准，别套用本文档的默认。

## 帖子的权威格式（maggiacito 现状）
文件：`content/posts/<slug>.md`。front matter 严格如下，日期用 `YYYY-MM-DD HH:MM:SS`（Asia/Shanghai）：

```
---
title: "标题"
date: 2026-06-04 21:30:00
lastmod: 2026-06-04 21:30:00
categories: ["知天命"]
tags: []
url: /知天命/标题/
---

正文 markdown……
```

- `url` 显式写 `/<主类目>/<标题或slug>/`（沿用 WordPress 迁来的链接风格；类目和标题可含中文）。
- `categories` / `tags` 是字符串数组，可空 `[]`。
- **不要手写 front matter**——用 `scripts/new-post.py` 生成，格式才不会漂。

## 工作流

### 1. 新增帖子
拿到标题 + 正文（用户给草稿/链接/零散思路都行；要润色按需润），选好类目，然后：
```
echo "<正文 markdown>" | python3 <SKILL_DIR>/scripts/new-post.py \
  --repo <仓库根> --title "标题" --category "知天命" --slug 可选英文slug
```
脚本生成 `content/posts/<slug>.md` 并打印路径。不传 `--slug` 时按标题派生文件名（中文也行，文件名读者看不到）。
不传 `--url` 时默认 `/<首个类目>/<标题或slug>/`。需要别的链接用 `--url` 覆盖。

### 2. 编辑帖子
直接改对应 `content/posts/*.md`：改正文随意；改了内容把 `lastmod` 更新成当前时间，`date` 不动。

### 3. 管理类目
- 先列现有类目给用户挑（避免造重复）：`bash <SKILL_DIR>/scripts/categories.sh <仓库根>`
- 新类目：现场加进帖子的 `categories[]` 即可，Hugo taxonomy 自动建 `/categories/<名>/` 页，无需别的配置。
- 改名/合并类目：扫所有 `content/posts/*.md` 的 `categories[]` 批量替换（这是 CMS 做不到、我能做的）。改完提醒用户旧的 `/categories/<旧名>/` 链接会失效。

### 4. 上传图片
新图放 `static/uploads/<年>/`（served 为 `/uploads/...`）；老的 `static/wp-content/uploads/` 不动。
```
python3 <SKILL_DIR>/scripts/add-image.py <本地图片> --repo <仓库根> --alt "说明"
```
打印一行 markdown 图片链接，插进正文。超 2000px 宽的图会用 macOS `sips` 自动缩小。

### 5. 发布上线
本地预览（可选）：`hugo server -D` → 看 http://localhost:1313 。
确认后发布：
```
bash <SKILL_DIR>/scripts/publish.sh "post: <标题>" <仓库根>
```
普通用户的 `git push` 会触发 `deploy.yml`（`on: push`）构建上线——**只有反馈机器人那种 `GITHUB_TOKEN`
推送**才会被 GitHub 防递归挡掉，你自己推不受影响。push 完可 `gh run watch` 看部署。

## 范围（YAGNI）
只做：新增/编辑帖子、管理类目、上传图片、发布。**不做**评论、用户管理、草稿工作流、定时发布。

## 常见错误
- ❌ 手写 front matter 导致日期格式/字段漂移 → ✅ 一律走 `new-post.py`。
- ❌ 图片塞进 `static/wp-content/uploads/`（那是迁移来的历史目录）→ ✅ 新图进 `static/uploads/`。
- ❌ 改了帖子忘了更 `lastmod` → ✅ 编辑后同步 `lastmod`。
- ❌ 造了和现有同名/近义的类目 → ✅ 先 `categories.sh` 看一遍再定。
- ❌ 以为 push 不会自动部署（被反馈闭环那条 `GITHUB_TOKEN` 限制误导）→ ✅ 你本人 push 会触发 `deploy.yml`。
- ❌ 设了会撞车的 `url`（和已有帖子重复）→ ✅ 用 `categories.sh`/grep 查重，必要时 `--url` 指定唯一路径。
