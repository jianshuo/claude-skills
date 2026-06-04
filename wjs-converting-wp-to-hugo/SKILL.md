---
name: wjs-converting-wp-to-hugo
description: Use when migrating a WordPress site to a Hugo static site on GitHub Pages from a WXR export (.xml) plus the wp-content/uploads folder — preserving /archives/<id>/ URLs, localizing images, and deploying via GitHub Actions. Triggers — "把 WordPress 迁成 Hugo", "wordpress 转静态站", "migrate WordPress to Hugo", "WXR to Hugo", "publish WordPress to GitHub Pages", "/wjs-converting-wp-to-hugo".
---

# wjs-converting-wp-to-hugo

把任意 WordPress 站迁成 **Hugo + Markdown + git** 静态站，部署到 **GitHub Pages**。
输入只需两样，**全程离线、零第三方依赖**：

1. **WXR 导出** — WordPress 后台 `工具 → 导出 → 所有内容` 得到的 `*.xml`（包含全部文章/页面/分类/标签的 HTML 正文）。
2. **`uploads/` 文件夹** — 站点的 `wp-content/uploads/`（按 `年/月` 分目录的图片与附件）。

产出：`content/*.md` + `static/wp-content/uploads/` + 手写极简主题，Hugo 构建，GitHub Actions 发布。
**全站 URL 保持 `/archives/<数字>/` 不变，老链接 100% 不断。**

## When to use

- 用户有一个 WordPress 站，想去掉动态/评论/数据库，改成 git + Markdown 维护。
- 用户提供了 WXR `.xml` 和 `uploads/`（或能拿到）。
- 老链接必须保留（SEO / 外部引用）。

## When NOT to use

- 没有 WXR，只有线上站 → 先在 WP 后台导出，或用 REST API 拉 JSON（本 skill 走 WXR，更可移植）。
- 要保留评论/会员/搜索等动态功能 → 静态站做不了，不适用。
- 站点极小（几篇）→ 手抄更快。

## Core principle

**WXR 是唯一真相源，`uploads/` 直接当静态资源。**
图片不下载、不改名：把 `uploads/` 拷进 `static/wp-content/uploads/`，正文里的图片 URL 改成 **根相对** `/wp-content/uploads/...` 即可原地解析。文章 URL 从 `<link>` 原样保留。转换器是**纯函数 + 单元测试**，先测后写。

## Pipeline

```
WXR .xml + uploads/  →  wxr_to_hugo.py  →  content/*.md + static/wp-content/uploads/  →  hugo build  →  GitHub Actions  →  Pages
```

## Two decisions you MUST ask the user (do not silently decide)

WordPress 里有两类内容静态站处理不了，**必须问用户**，别擅自发布：

1. **密码保护文章**（`<wp:post_password>` 非空）。静态站无密码门 → 发布就是公开。
   选项：**排除**（默认，最安全，URL 会 404）/ 公开发布 / 转成 `draft`。
   **核对计数务必用 ElementTree（即 `parse_items`），别用裸 grep**：`<wp:post_password>` 的值是 CDATA 包裹的（`<![CDATA[secret]]>`），`grep '<wp:post_password>[^<]*</...>'` 会把每条都当空 → 误报「0 篇密码文章」漏掉真有密码的文章（maggiacito.com 实战，差点漏发 1 篇）。
2. **WordPress 脚手架页**（`sample-page`、`login`/`register`/`findpassword` 等插件短代码页、空页、登录设计器预览页）。
   默认**排除**——它们不是内容。`is_real_page()` 已按「空正文 / 单条短代码 / 默认 slug 黑名单」过滤。

转换器对这两类都已实现排除；用 `AskUserQuestion` 确认后再跑全量。

## Steps

### 1. 放好输入，建工程

```bash
mkdir -p ~/code/<site> && cd ~/code/<site> && git init
# 把 WXR 拷进来（注意：WXR 含密码文章正文 + 作者邮箱，勿提交！见「安全」）
cp /path/to/<site>.WordPress.*.xml .
# uploads/ 放到工程根（含子目录 年/月）。注意它可能含 wordpress_db.sql —— 勿提交！
cp -R /path/to/uploads ./uploads
mkdir -p scripts tests content/posts layouts/_default layouts/partials static
```

拷入本 skill 的资产（保持目录对应）：

```bash
SK="$HOME/.claude/skills/wjs-converting-wp-to-hugo"
cp "$SK"/scripts/*.py scripts/                       # wxr_to_hugo.py, verify_build.py
cp "$SK"/tests/test_wxr.py tests/                     # 单元测试（须放 tests/，与 scripts/ 同级）
cp -R "$SK"/assets/layouts/. layouts/                 # 手写主题
cp "$SK"/assets/hugo.toml .                           # 改 title / baseURL / 菜单
mkdir -p .github/workflows && cp "$SK"/assets/workflow-hugo.yml .github/workflows/hugo.yml
cp "$SK"/assets/gitignore .gitignore
printf '%s' '<你的域名，如 huixianju.cn>' > static/CNAME   # 自定义域名
```

### 2. 先跑测试（转换器是 TDD 的）

```bash
python3 tests/test_wxr.py     # 期望 ALL PASS；改任何转换逻辑都先加失败测试
```

### 3. 确认计数 + 跑全量转换

```bash
python3 scripts/wxr_to_hugo.py <site>.WordPress.*.xml
```
打印报告：`posts / pages / images / uploads_copied / warnings`。核对文章数与 WP 后台一致。
warnings 会列出：空正文文章、被跳过的脚手架页、外链图片。

### 4. 构建并断言所有老链接命中

```bash
hugo --gc --minify              # 没装：brew install hugo（要 extended）
python3 scripts/verify_build.py <site>.WordPress.*.xml   # checked N posts, missing 0
```

### 5. 本地肉眼核对

```bash
hugo server -p 1313
```
对照线上抽查 5 篇（含 1 篇图片帖、1 篇多链接帖）：标题、列表、链接、图片、视频是否正常。
**关键**：链接应是页面相对（`../../...`），图片从本地 `/wp-content/uploads/` 加载，不是从线上拉。

### 6. 推到 GitHub（公开仓库见「安全」）

```bash
gh repo create <site> --public --source=. --remote=origin
git push -u origin main
```

### 7. 开 Pages → Actions，**先开后跑**

```bash
gh api -X POST repos/<owner>/<site>/pages -f build_type=workflow
```
**坑**：若 Pages 还没开就 push，首个 Action 会在 `configure-pages` 处 404 失败。开了 Pages 后**重跑**：
```bash
gh workflow run "Deploy Hugo site to Pages" --repo <owner>/<site>
gh run watch <run-id> --repo <owner>/<site> --exit-status
```
验证临时地址 `https://<owner>.github.io/<site>/`：home / 一篇 post / categories / index.xml / 一张图都 200。
（刚部署时图片可能短暂 301，是 CDN 预热，跟随重定向最终 200。）

### 8. DNS 切换（操作者手动，验证通过后再做）

先确认临时地址全站无误，**WP 仍在线**，零风险。然后在 DNS 商（如 **Cloudflare**）把域名指向 Pages：
- apex：A 记录 → `185.199.108.153 / 109.153 / 110.153 / 111.153`，或 CNAME → `<owner>.github.io`。
- 用 Cloudflare 橙云代理时，SSL/TLS 设 **Full**；首次签证书可临时灰云（仅 DNS）。
- DNS 生效后 Pages 勾 **Enforce HTTPS**。
- 线上稳定数日后再下线老 WP（先停机留备份，确认无需回退再彻底删）。

## 转换器踩过的坑（已在 wxr_to_hugo.py 修好，勿回退）

| 坑 | 现象 | 修法 |
|---|---|---|
| 超链接丢 href | `<a href>` 只剩文字，URL 丢了 | `<a>` 内攒文字，闭合时输出 `[文字](href)` |
| 相册多余 `-`（figure 版） | 图片帖每张图前一个空列表符 | `figure` 栈识别 `wp-block-gallery`，相册内 `<li>` 不输出 `- ` |
| 相册多余 `-`（ul 版） | 早期 Gutenberg 把 `wp-block-gallery` 放 `<ul>`（无 `<figure>` 包裹），上一行的 figure 判定漏掉，每图前留孤立 `-` | `_ul_stack` 同样识别 `<ul class=wp-block-gallery>`，相册内 `<li>` 不输出 `- `（maggiacito.com 实战） |
| CJK permalink 编码 | permalink 是 URL 编码的中文（`/sculpting-in-time/%e4%ba%8c…/`）。原样保留会让 Hugo 建字面 `%e4%..` 目录，服务器把请求里的 `%xx` 解码后对不上 → 老链接全断 | `_norm_url()` 用 `unquote()` 把路径解码成中文，Hugo 建 UTF-8 目录；静态主机对入站 `%xx` 解码即命中，**编码/解码两种老链接都活**。数字 `/archives/<id>/` 不受影响（maggiacito.com 实战） |
| 图片从线上加载 | 正文图是绝对 `https://站点/wp-content/...` | `_root_relative()` 把自托管图改成 `/wp-content/...`；外链图保持绝对 |
| 视频/嵌入丢失 | `<video>`/`<iframe>` 正文变空 | 原样透传为 HTML（`hugo.toml` 开 `goldmark unsafe=true`） |
| lastmod 空 | 有的 WXR 无 `wp:post_modified` | 缺失时回退到 `wp:post_date` |
| 经典编辑器软换行 | 正文裸 `\n` 被吃 | `handle_data` 保留裸文本换行 |
| 实体没解码 | 标题里 `&#038;` | `html.unescape()`；标题内引号换成单引号 |
| 发新文跳号 | 手动起 URL 号易撞 | `next_archive_id()` 扫现有最大号 +1 |

## 链接可移植性

`hugo.toml` 设 `relativeURLs = true` + `canonifyURLs = false`，Hugo 把所有链接输出成**页面相对**
（`../../archives/123/`）。这样 `public/` 在 `file://`、子路径（`github.io/<repo>/`）、自定义域名下都能点。
图片 URL 在转换器里已改成根相对，Hugo 再相对化，本地/线上都解析。

## 安全（公开仓库必读）

WXR 和原始 `uploads/` 含敏感数据，**绝不进 git**：

- **WXR `.xml`** 含**密码保护文章的正文**（正是你从站点排除的内容）和**作者邮箱**。
- **`uploads/wordpress_db.sql`** 是整库 dump（用户、密码哈希）。转换器拷贝时已跳过 `.sql`/`.DS_Store`。
- `assets/gitignore` 用**根锚定** `/uploads/`（不能写 `uploads/`，否则会连 `static/wp-content/uploads/` 一起忽略，图片就传不上去）。它还忽略 `*.WordPress.*.xml`、`public/`、`resources/`。
- 若 WXR 之前**已被 commit**：gitignore 对已跟踪文件无效，要先 `git rm --cached <xml>`。
- 推公开仓库前，若历史里有 WXR、含基础设施细节的设计文档（实例 ID / IP / 云命令）→ **重建干净历史**：
  ```bash
  git checkout --orphan _clean && git add -A && git commit -m "..." && git branch -D main && git branch -m main
  ```
  确认 `git diff --cached --name-only | grep -iE 'WordPress.*xml|wordpress_db|\.sql$'` 为空再推。

## 主题

`assets/layouts/` 是**手写极简主题**，零外部依赖（不用 submodule / PaperMod，省掉外来构建代码与权限麻烦）。
CJK 友好、首页文章列表、分类页、按年归档、文章页上下篇、`/feed/ → /index.xml` 老 RSS 兼容。
改 `static/CNAME` 为目标域名。

## 以后写新文章

```bash
ID=$(python3 -c "import sys;sys.path.insert(0,'scripts');import wxr_to_hugo;print(wxr_to_hugo.next_archive_id('content'))")
# 建 content/posts/$ID.md，front matter 写 url: /archives/$ID/，与老文章同一号段
git push   # Action 自动构建上线
```

## 验收

- [ ] 文章数与 WP 后台一致；每个 `/archives/<id>/` 在 `public/` 命中（`verify_build.py`）
- [ ] 图片全本地化，无外链 `wp-content`；视频/iframe 透传可播
- [ ] 密码文章、脚手架页已按用户决定处理
- [ ] 链接页面相对，`file://`/子路径/域名都可点
- [ ] WXR / db.sql / 原始 uploads 未进 git；公开仓库历史无敏感数据
- [ ] 临时 Pages 地址全站 200，DNS 切换后老链接 200
