---
name: wjs-publishing-testflight
description: 为 iOS 项目配置 fastlane + GitHub Actions，实现推送 main 分支自动构建并上传 TestFlight。参考实现：Cathier 项目。触发词：「testflight」「fastlane」「自动构建」「CI TestFlight」「/wjs-publishing-testflight」。
---

# wjs-publishing-testflight

为 iOS 项目接入 fastlane + GitHub Actions，推送 main → 自动构建 → TestFlight。参考实现是 Cathier 项目（`github.com/jianshuo/Cathier`）。

## 前置信息（所有项目通用）

| 项目 | 值 |
|------|-----|
| Apple ID | `jianshuo@hotmail.com` |
| Team ID | `97XBW2A43H` |
| ITC Team ID | `97847885` |
| ASC API Key ID | `S6363V64RS` |
| ASC Issuer ID | `69a6de82-56b6-47e3-e053-5b8c7c11a4d1` |
| ASC API Key 文件 | iCloud 重要文档目录下的 `.p8` 文件（见 [[apple-developer-credentials]]）|
| Match certs repo 格式 | `https://github.com/jianshuo/<APP>-certs.git` |

## 工作流逻辑

```
git push → main
    ↓
GitHub Actions (macos-15, Xcode 26.2)
    ↓
fastlane beta
    ├─ 查询 ASC 最新 build number → 加 1
    ├─ match（readonly，拉 appstore 证书）
    ├─ increment_build_number
    ├─ build_app (app-store export)
    ├─ build_num % 10 == 0 → 自动 App Store 提审（bump marketing version）
    ├─ pbxproj MARKETING_VERSION > 最新 release/* tag → 手动 bump → 提审
    └─ 否则 → upload_to_testflight + 打 testflight/<build_num> tag
```

**Auto-release 规则**（Cathier 的约定，新项目可自定）：
- 每第 10 个 build（build_num % 10 == 0）自动 bump minor 版本并提交 App Store
- 或开发者手动改 pbxproj 的 `MARKETING_VERSION` 并推送
- CI 永远不 commit pbxproj，不 push main

## Step 1 — 初始化 fastlane

```bash
cd /path/to/YourApp
bundle init
echo 'gem "fastlane"' >> Gemfile
bundle install
bundle exec fastlane init
```

## Step 2 — 文件内容

### `fastlane/Appfile`

```ruby
app_identifier("com.YOUR_BUNDLE_ID")
apple_id("jianshuo@hotmail.com")
itc_team_id("97847885")
team_id("97XBW2A43H")
```

### `fastlane/Matchfile`

```ruby
git_url("https://github.com/jianshuo/YOUR_APP-certs.git")
storage_mode("git")
type("development")
```

先跑一次建立证书仓库（本地）：

```bash
bundle exec fastlane match init
bundle exec fastlane match appstore
bundle exec fastlane match development
```

### `fastlane/Fastfile`

以下是完整 Fastfile，复制后把 `BUNDLE_ID` 替换为真实值：

```ruby
require "set"

default_platform(:ios)

BUNDLE_ID = "com.YOUR_BUNDLE_ID"

platform :ios do

  def next_build_number(api_key:)
    latest = latest_testflight_build_number(
      api_key:            api_key,
      app_identifier:     BUNDLE_ID,
      initial_build_number: 0
    )
    latest + 1
  end

  def guard_not_in_review
    require "spaceship"
    app = Spaceship::ConnectAPI::App.find(BUNDLE_ID)
    UI.user_error!("App not found on App Store Connect") unless app
    versions = app.get_app_store_versions(filter: { platform: "IOS" })
    versions.each do |v|
      if v.app_version_state == "IN_REVIEW"
        UI.user_error!("Version #{v.version_string} is IN_REVIEW — wait for review to finish.")
      end
    end
  end

  def push_release_notes_via_spaceship(notes:)
    require "spaceship"
    app = Spaceship::ConnectAPI::App.find(BUNDLE_ID)
    version = app.get_edit_app_store_version(platform: "IOS")
    UI.user_error!("No edit-state App Store Version found") unless version
    localizations = version.get_app_store_version_localizations
    localizations.each do |loc|
      text = notes[loc.locale] || notes[loc.locale.split("-").first] || notes["default"]
      next if text.nil? || text.empty?
      loc.update(attributes: { whats_new: text })
    end
  end

  def upload_and_submit_for_review(api_key:, app_version:)
    upload_to_app_store(
      api_key:                    api_key,
      app_version:                app_version,
      skip_metadata:              true,
      skip_screenshots:           true,
      submit_for_review:          false,
      run_precheck_before_submit: false,
    )
    push_release_notes_via_spaceship(notes: build_release_notes)
    upload_to_app_store(
      api_key:                    api_key,
      app_version:                app_version,
      skip_metadata:              true,
      skip_screenshots:           true,
      skip_binary_upload:         true,
      submit_for_review:          true,
      automatic_release:          true,
      reject_if_possible:         true,
      run_precheck_before_submit: false,
      submission_information: {
        add_id_info_uses_idfa:             false,
        export_compliance_uses_encryption: false,
      },
    )
  end

  def sign_and_build(api_key:, build_num:, scheme: "YOUR_SCHEME")
    match(
      type:                "appstore",
      readonly:            true,
      git_basic_authorization: Base64.strict_encode64(ENV["MATCH_GIT_BASIC_AUTH"]),
      api_key:             api_key
    )
    increment_build_number(build_number: build_num)
    build_app(
      scheme:        scheme,
      export_method: "app-store",
      xcargs: "CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY='Apple Distribution' PROVISIONING_PROFILE_SPECIFIER='match AppStore #{BUNDLE_ID}'",
      export_options: {
        provisioningProfiles: { BUNDLE_ID => "match AppStore #{BUNDLE_ID}" }
      }
    )
  end

  def build_release_notes
    last_tag = `git tag --list 'release/*' --sort=-version:refname 2>/dev/null | head -1`.strip
    raw = last_tag.empty? ?
      `git log -10 --pretty=format:"- %s"`.strip :
      `git log #{last_tag}..HEAD --pretty=format:"- %s"`.strip
    commits = raw.gsub(/<[^>]*>/, "").gsub(/[ \t]+/, " ").strip
    en = commits.empty? ? "Bug fixes and performance improvements." : "What's new:\n#{commits}"
    zh = commits.empty? ? "修复 bug 和性能改进。" : "更新内容：\n#{commits}"
    { "default" => en, "en-US" => en, "zh-Hans" => zh }
  end

  def bump_minor(version)
    parts = version.to_s.split(".")
    major = parts[0].to_i
    minor = (parts[1] || "0").to_i + 1
    minor > 9 ? "#{major + 1}.0" : "#{major}.#{minor}"
  end

  def set_marketing_version(version)
    require "xcodeproj"
    project_path = File.expand_path("../YOUR_APP.xcodeproj", __dir__)
    project = Xcodeproj::Project.open(project_path)
    project.targets.select { |t| t.name == "YOUR_SCHEME" }.each do |target|
      target.build_configurations.each do |c|
        c.build_settings["MARKETING_VERSION"] = version
      end
    end
    project.save
  end

  desc "Build and upload to TestFlight (auto-detects App Store release)."
  lane :beta do
    setup_ci
    api_key = app_store_connect_api_key(
      key_id:                ENV["ASC_API_KEY_ID"],
      issuer_id:             ENV["ASC_API_ISSUER_ID"],
      key_content:           ENV["ASC_API_KEY_CONTENT"],
      is_key_content_base64: true,
      duration:              1200,
      in_house:              false
    )
    build_num       = next_build_number(api_key: api_key)
    last_tag        = `git tag --list 'release/*' --sort=-version:refname 2>/dev/null | head -1`.strip
    last_released   = last_tag.sub(%r{^release/}, "")
    pbxproj_version = get_version_number(xcodeproj: "YOUR_APP.xcodeproj", target: "YOUR_SCHEME")
    auto_release    = (build_num % 10).zero?

    if auto_release
      highest = [pbxproj_version, last_released].reject(&:empty?)
                                                 .max_by { |v| Gem::Version.new(v) }
      current_version = bump_minor(highest)
      set_marketing_version(current_version)
      is_release = true
    else
      current_version = pbxproj_version
      is_release = last_released.empty? ||
                   Gem::Version.new(current_version) > Gem::Version.new(last_released)
    end

    sign_and_build(api_key: api_key, build_num: build_num)

    if is_release
      guard_not_in_review
      upload_and_submit_for_review(api_key: api_key, app_version: current_version)
      sh("git tag release/#{current_version} || true")
      sh("git push origin release/#{current_version} || true")
    else
      last_t = `git describe --tags --abbrev=0 2>/dev/null`.strip
      commits = last_t.empty? ?
        `git log -10 --pretty=format:"• %s"`.strip :
        `git log #{last_t}..HEAD --pretty=format:"• %s"`.strip
      commits = "• No notable changes" if commits.empty?
      upload_to_testflight(
        api_key:                           api_key,
        skip_waiting_for_build_processing: false,
        distribute_external:               false,
        notify_external_testers:           false,
        changelog:                         "Build #{build_num}\n\nWhat changed:\n#{commits}"
      )
      sh("git tag testflight/#{build_num} || true")
    end
  end

  desc "Bump MARKETING_VERSION (2.2→2.3). Commit pbxproj + push → next CI run submits to review."
  lane :bump do
    current     = get_version_number(xcodeproj: "YOUR_APP.xcodeproj", target: "YOUR_SCHEME")
    new_version = bump_minor(current)
    set_marketing_version(new_version)
    UI.success("Bumped: #{current} → #{new_version}")
    UI.message("Now: git add *.xcodeproj/project.pbxproj && git commit && git push origin main")
  end

  desc "Explicit App Store release (bypasses auto-detection)."
  lane :release do
    setup_ci
    api_key = app_store_connect_api_key(
      key_id:                ENV["ASC_API_KEY_ID"],
      issuer_id:             ENV["ASC_API_ISSUER_ID"],
      key_content:           ENV["ASC_API_KEY_CONTENT"],
      is_key_content_base64: true,
      duration:              1200,
      in_house:              false
    )
    build_num   = next_build_number(api_key: api_key)
    app_version = get_version_number(xcodeproj: "YOUR_APP.xcodeproj", target: "YOUR_SCHEME")
    sign_and_build(api_key: api_key, build_num: build_num)
    guard_not_in_review
    upload_and_submit_for_review(api_key: api_key, app_version: app_version)
  end

end
```

### `Gemfile`

```ruby
source "https://rubygems.org"
gem "fastlane"
```

Run `bundle install` then commit `Gemfile.lock`.

## Step 3 — GitHub Actions Workflow

Save as `.github/workflows/build.yml`:

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      destination:
        description: 'Deploy target'
        required: true
        default: 'testflight'
        type: choice
        options:
          - testflight
          - appstore

jobs:
  build:
    runs-on: macos-15

    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0        # full history for commit log in changelog
          fetch-tags: true
          token: ${{ secrets.FEEDBACK_PAT }}

      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode_26.2.app

      - name: Show Xcode info
        run: xcodebuild -version

      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true

      # PRs: build only (verify it compiles, no signing)
      - name: Build for verification
        if: github.event_name == 'pull_request'
        run: |
          xcodebuild build \
            -project YOUR_APP.xcodeproj \
            -scheme YOUR_SCHEME \
            -destination 'generic/platform=iOS' \
            -skipPackagePluginValidation \
            CODE_SIGNING_ALLOWED=NO

      # Push to main → TestFlight (or App Store if auto/manual release)
      - name: Run fastlane
        if: github.event_name != 'pull_request'
        env:
          MATCH_PASSWORD:       ${{ secrets.MATCH_PASSWORD }}
          MATCH_GIT_BASIC_AUTH: ${{ secrets.MATCH_GIT_BASIC_AUTH }}
          ASC_API_KEY_ID:       ${{ secrets.ASC_API_KEY_ID }}
          ASC_API_ISSUER_ID:    ${{ secrets.ASC_API_ISSUER_ID }}
          ASC_API_KEY_CONTENT:  ${{ secrets.ASC_API_KEY_CONTENT }}
        run: |
          DEST="${{ github.event.inputs.destination }}"
          if [ "$DEST" = "appstore" ]; then
            bundle exec fastlane release
          else
            bundle exec fastlane beta
          fi

      - name: Push tags
        if: success() && github.event_name != 'pull_request'
        run: git push --tags || true
```

## Step 4 — GitHub Secrets

Run these once per repo (`REPO=jianshuo/YOUR_APP`):

```bash
REPO=jianshuo/YOUR_APP

# 1. match encryption password (same as your local match password)
echo "YOUR_MATCH_PASSWORD" | gh secret set MATCH_PASSWORD --repo $REPO

# 2. base64(username:PAT) for certs repo access
echo -n "jianshuo:YOUR_GITHUB_PAT" | base64 | gh secret set MATCH_GIT_BASIC_AUTH --repo $REPO

# 3. ASC API key (same key across all apps)
echo "S6363V64RS" | gh secret set ASC_API_KEY_ID --repo $REPO
echo "69a6de82-56b6-47e3-e053-5b8c7c11a4d1" | gh secret set ASC_API_ISSUER_ID --repo $REPO
cat ~/path/to/AuthKey_S6363V64RS.p8 | base64 | gh secret set ASC_API_KEY_CONTENT --repo $REPO

# 4. GitHub PAT (needs repo + workflow scopes) for checkout with tag push
echo "YOUR_GITHUB_PAT" | gh secret set FEEDBACK_PAT --repo $REPO
```

**ASC API Key 文件位置**：见 [[apple-developer-credentials]]，在 iCloud 重要文档目录。

## Step 5 — 验证

1. 推一个空 commit：`git commit --allow-empty -m "trigger CI" && git push`
2. 看 Actions tab：`github.com/jianshuo/YOUR_APP/actions`
3. 首次成功后 TestFlight 里会出现新 build

## 日常操作

| 操作 | 命令 |
|------|------|
| 触发 TestFlight build | `git push origin main`（任何 commit）|
| 手动提审 App Store | GitHub Actions → Run workflow → 选 `appstore` |
| 本地 bump 版本 → 下次 CI 提审 | `bundle exec fastlane bump` → commit pbxproj → push |
| 强制立即提审 | `bundle exec fastlane release`（本地跑，需本地证书）|

## 替换清单

新项目复制上面文件后，全局替换：

| 占位符 | 替换为 |
|--------|--------|
| `YOUR_BUNDLE_ID` | 实际 bundle identifier |
| `YOUR_APP` | repo/文件名，如 `Cathier` |
| `YOUR_SCHEME` | Xcode scheme 名 |

## 常见问题

| 现象 | 原因 | 解决 |
|------|------|------|
| `No matching provisioning profiles found` | match 未跑或 certs repo 空 | 本地跑 `bundle exec fastlane match appstore` |
| `401 Unauthorized` on ASC | ASC API Key 内容有误或过期 | 重新 base64 encode `.p8` 写入 secret |
| build number 没递增 | `MATCH_GIT_BASIC_AUTH` 未设置导致 match 失败中断 | 检查 secret 格式（base64 无换行）|
| tag push 失败 | `FEEDBACK_PAT` 权限不够 | PAT 需要 `repo` + `workflow` scope |
| `IN_REVIEW` 报错 | 版本正在审核 | 等审核结束或取消后再触发 release |
