---
name: wjs-publishing-appstore
description: Use when an iOS app already on TestFlight needs to ship to the App Store — preparing the screenshots and the description/metadata, then using the existing fastlane setup to submit for review. Triggers — 「提交 App Store」「上架」「app store 审核」「准备截图和文案」「submit for review」「/wjs-publishing-appstore」.
---

# wjs-publishing-appstore

Take an iOS app that's already building to **TestFlight** and ship it to the
**App Store**: prepare the **screenshots** + **description/metadata**, then use
the existing **fastlane** to **submit for review**.

This is the App Store counterpart to **`wjs-publishing-testflight`**, which is a
**prerequisite** — that skill owns build / signing (`match`) / CI / the `beta`
lane. This skill assumes that's done and only adds the listing + a deliberate
`release` lane. Reference implementations: **VoiceDrop**, **Cathier**.

## Mental model

```
git push → main      → beta lane    → TestFlight        (unchanged, automatic)
fastlane release     → release lane → metadata + screenshots → submit for review
```

Submitting to review is high-stakes, so it is **never** triggered by a push — it
is the explicit `fastlane release` command you run on purpose.

## Prerequisites

- `wjs-publishing-testflight` already set up: `match` appstore certs, the
  `ASC_API_*` secrets, a working `beta` lane, and **at least one build already
  uploaded to TestFlight** (this also creates the App Store Connect app record).
- Apple credentials / ASC API key: see [[apple-developer-credentials]] and the
  prerequisites table in `wjs-publishing-testflight` — do **not** re-list secrets
  here (this skill auto-publishes to a public repo).
- If the App Store Connect app record does **not** exist yet, create it once:
  `bundle exec fastlane produce -u jianshuo@hotmail.com -a <BUNDLE_ID> --app_name "<Name>"`.

## Steps

### 1. Scaffold the metadata tree
```bash
scripts/scaffold-metadata.sh        # from this skill; run at the repo root
```
Creates `fastlane/metadata/{zh-Hans,en-US}/*.txt` + `review_information/` +
top-level category/copyright, seeded with editable VoiceDrop copy. Re-running
never overwrites existing files.

### 2. Write the real copy
Edit every `.txt`. Watch the limits: **name 30 · subtitle 30 · keywords 100
(comma-separated, no spaces) · promotional_text 170 · description 4000**. Fill in
`review_information/` (phone, and a demo account only if login is required) and
the privacy URL.

### 3. Shoot screenshots
```bash
scripts/shoot.sh                    # default: iPhone 16 Pro Max (6.9"), zh-Hans
LOCALE=en-US scripts/shoot.sh       # second locale
```
Edit `drive_screens()` in `shoot.sh` to hit each marketing screen (3–6, named
`01_*`, `02_*`…). It boots a sim, builds, installs, captures into
`fastlane/screenshots/<locale>/`. `FRAME=1` adds `frameit` framing.

**Required size:** only the **6.9" display (1320×2868)** is mandatory and it
covers iPhone-only apps. Add a 13" iPad pass **only** if
`TARGETED_DEVICE_FAMILY` includes iPad (VoiceDrop is iPhone-only → one size).

**Mic-permission gotcha:** if the app requests microphone/record permission, iOS
shows a dialog `xcrun simctl privacy grant microphone` does **not** suppress (a
real iOS 26 sim limitation). Open Simulator.app, tap 允许/Allow **once** — the
grant persists for the install, so re-running `shoot.sh` then captures a clean
frame. (`simctl` has no `tap`; don't try to click it from the script.)

### 4. Add the `release` lane
Paste `scripts/release_lane.rb` into the existing `fastlane/Fastfile` inside
`platform :ios do … end`. It uploads metadata + screenshots (the TestFlight lane
sets `skip_metadata`/`skip_screenshots: true`; this lane sets them `false`),
then `submit_for_review: true` with the encryption/IDFA compliance answers,
guarded by `guard_not_in_review`.

### 5. Preview, then submit
```bash
# dry-run the listing without submitting (writes an HTML preview, no upload):
bundle exec fastlane deliver --skip_binary_upload true --submit_for_review false --force false

# real submit (uses the build already on TestFlight for this version):
bundle exec fastlane release skip_build:true     # reuse the TestFlight build
bundle exec fastlane release                      # or build a fresh one first
```
Run locally, or via the CI `workflow_dispatch` if your `build.yml` routes a
`appstore` choice to `fastlane release` (see `wjs-publishing-testflight` Step 3).

## App Store Connect one-time gotchas (first submission)

These live in the ASC web console, **not** in fastlane metadata — fastlane will
refuse the submit until they're set:

- **App Privacy** "nutrition label" — declare data collection. VoiceDrop: audio
  is user content uploaded to the user's own store; location is optional and used
  only for the filename; Sign in with Apple is an anonymous identifier. Fill the
  questionnaire accordingly.
- **Age rating** questionnaire.
- **Export compliance** — set to "no encryption / exempt"; the lane already sends
  `export_compliance_uses_encryption: false`.
- **Pricing & Availability** — set to Free + territories.
- A **build** must be attached to the version (the lane does this) before review.

## Verification checklist

- [ ] `fastlane/metadata/**` has no `...FILL_ME...` / empty required fields
- [ ] `fastlane/screenshots/<locale>/` has ≥1 6.9" PNG per locale, named `NN_*`
- [ ] `fastlane deliver` preview (Step 5 dry-run) renders the listing cleanly
- [ ] App Privacy, age rating, pricing set in ASC console
- [ ] `fastlane release` → "Submitted X for App Store review"; a `release/X` tag exists
- [ ] App Store Connect shows the version as **Waiting for Review**

## Common mistakes

| Symptom | Fix |
|---------|-----|
| `Could not find app … on App Store Connect` | App record missing → `fastlane produce` (Step / Prereqs). |
| Submit fails "missing screenshots" | No 6.9" screenshot, or wrong folder/size. Re-run `shoot.sh`; ASC requires the 6.9" set. |
| Submit fails on App Privacy / age rating | Set them in the ASC web console once (see gotchas). |
| `Another version is in review` | `guard_not_in_review` tripped — wait for Apple, or reject the in-flight version. |
| Keyword field rejected | Keywords must be comma-separated, **no spaces**, ≤100 chars total. |
| Wrong build submitted | Use `release skip_build:true` to reuse the exact TestFlight build for this `MARKETING_VERSION`. |

## Files in this skill

- `scripts/scaffold-metadata.sh` — create the `deliver` metadata tree (seeded with VoiceDrop copy)
- `scripts/shoot.sh` — scripted `simctl` screenshot capture
- `scripts/release_lane.rb` — the `release` fastlane lane to paste into your Fastfile
