# wjs-publishing-hugo

Hugo 静态博客的**对话式后台**:不装 CMS、不要 PAT、不碰 Cloudflare——你跟 Claude 说一句,
它就按仓库约定改 `content/`、放图、commit、push,走仓库现有的 GitHub Pages 部署流自动上线。

适用 maggiacito.com 这类 Hugo 站(`content/posts/*.md` + categories/tags taxonomy + GitHub Pages
Actions 部署)。下面分两部分:**一次性的 GitHub 配置** 和 **日常发文章怎么用**。

---

## 一、一次性 GitHub 配置

要让"push 到 main 就自动上线"成立,仓库需要这套配置。已经配好的(比如 maggiacito.com)跳过这节。

### 1. 仓库 + GitHub Pages(Actions 源)
```bash
# 在 Hugo 仓库根目录
gh repo create <owner>/<repo> --public --source=. --remote=origin --push
# 把 Pages 的构建源设为 GitHub Actions
gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow
```

### 2. 部署 workflow `.github/workflows/deploy.yml`
Hugo → Pages 的标准构建部署。**三个触发器都要有**(`push` + `workflow_dispatch` +
`workflow_run`),原因见第 4 点:
```yaml
name: deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
  workflow_run:
    workflows: ["feedback-loop"]   # 若装了反馈闭环(wjs-looping-feedback)才需要这条
    types: [completed]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      HUGO_VERSION: 0.162.1            # 跟本地 `hugo version` 对齐
    steps:
      - uses: actions/checkout@v4
        with: { submodules: recursive, fetch-depth: 0 }
      - name: Install Hugo (extended)
        run: |
          wget -O hugo.deb https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.deb
          sudo dpkg -i hugo.deb
      - uses: actions/configure-pages@v5
      - run: hugo --minify
      - uses: actions/upload-pages-artifact@v3
        with: { path: ./public }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 3. 自定义域名(可选)
- 仓库里放 `static/CNAME`,内容是你的域名(如 `maggiacito.com`),Hugo 会拷到 `public/CNAME`。
- 在 GitHub Pages 设自定义域名:`gh api -X PUT repos/<owner>/<repo>/pages -f cname=<域名>`。
- DNS:apex 域名加 4 条 A 记录指向 GitHub Pages
  (`185.199.108.153` / `109.153` / `110.153` / `111.153`),**设为 DNS-only**,
  让 GitHub 能签 HTTPS 证书。证书签好后开 Enforce HTTPS。

### 4. 关键坑:谁的 push 能触发部署
- **你本人 `git push`** → 触发 `deploy.yml` 的 `on: push`,正常上线。这是发文章的常规路径。
- **GitHub Actions 用 `GITHUB_TOKEN` 的 push**(如 `wjs-looping-feedback` 反馈机器人)
  → GitHub 防递归机制**不触发**其它 workflow,所以单靠 `on: push` 不会部署。
  解法就是上面那条 `workflow_run` 触发器:反馈闭环跑完就部署。
  没装反馈闭环可以不要这条;装了就必须有。

---

## 二、日常:用这个 skill 发文章

在 Hugo 仓库根目录,对 Claude 说「发一篇博客」「给 Hugo 加文章」「/wjs-publishing-hugo」即可。
Claude 会走 `SKILL.md` 的流程。手动跑脚本也行(`<SKILL_DIR>` = 本 skill 目录):

```bash
# 0) 看现有类目(选类目前先看,免得造重复)
bash <SKILL_DIR>/scripts/categories.sh <仓库根>

# 1) 新增帖子(front matter 由脚本生成,格式不会漂)
echo "<正文 markdown>" | python3 <SKILL_DIR>/scripts/new-post.py \
  --repo <仓库根> --title "标题" --category "知天命" --slug 可选英文slug
#   生成 content/posts/<slug>.md,date/lastmod=当前 Asia/Shanghai,url=/<类目>/<slug>/

# 2) 配图(可选):新图进 static/uploads/<年>/,打印一行 markdown 图片链接插进正文
python3 <SKILL_DIR>/scripts/add-image.py <本地图片> --repo <仓库根> --alt "说明"

# 3) 本地预览(可选)
hugo server -D     # 看 http://localhost:1313

# 4) 发布 → 自动上线
bash <SKILL_DIR>/scripts/publish.sh "post: <标题>" <仓库根>
```

**编辑已有帖子**:直接改 `content/posts/*.md`,改完把 `lastmod` 更新成当前时间(`date` 不动),再 `publish.sh`。
**删除帖子**:删掉对应 `.md`,`publish.sh` 推一下即可下线(注意旧链接会 404)。
**改/合并类目**:扫所有 `content/posts/*.md` 的 `categories[]` 批量替换——这是 CMS 做不到、Claude 能做的。

### 帖子的权威格式
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
日期 `YYYY-MM-DD HH:MM:SS`(Asia/Shanghai);`url` 显式写 `/<主类目>/<标题或slug>/`(沿用 WordPress 迁来的链接风格,可含中文)。
**别手写 front matter**——一律走 `new-post.py`。

### 范围(YAGNI)
只做:新增/编辑帖子、管理类目、上传图片、发布。不做评论、用户管理、草稿工作流、定时发布。
