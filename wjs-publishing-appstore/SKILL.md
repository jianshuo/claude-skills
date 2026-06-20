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

**The App Store `name` is globally unique.** A short common name ("VoiceDrop")
is almost certainly already taken by another account — the submit then dies at
`upload_to_app_store` with *"The app name you entered is already being used."*
This is the **display name only**; the home-screen name (`CFBundleDisplayName`)
is separate and can stay whatever you like. Pick a distinct string (e.g. add a
word or a Chinese suffix — "VoiceDrop 口述"); longer = safer. It's per-locale and
changeable in a later version, so it's not permanent.

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
frame. (`simctl` has no `tap`; don't try to click it from the script — synthetic
clicks via `osascript` need macOS Accessibility permission the runner lacks.)

**Other iOS 26 sim screenshot gotchas:**
- To screenshot a screen you can't reach without a tap, temporarily root the app
  into that view (env-gated `DebugRoot`), and **seed its data via the app's own
  token** (a sim regenerates its synchronizable-Keychain identity on every
  reinstall — no iCloud account — so injected data under an old identity won't
  show; on a real device the identity persists).
- The sim paints a faint **ghost of `TabView` labels** near the Dynamic Island
  even for a bare two-tab `TabView` — a sim-only Liquid Glass artifact, not in
  your app. Don't chase it; verify on device.

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

**Robust two-step ship (what actually worked):** `git push` → the `beta` lane
builds and uploads to TestFlight **and waits for Apple to finish processing** →
*then* dispatch `appstore` → `fastlane release skip_build:true` reuses that
already-processed build. Building a fresh binary inside the release lane risks
submitting before the build is processed. CI checks out `main`, so **metadata +
screenshots must be committed to `main` before you dispatch.**

**Un-ignore the screenshots.** The TestFlight-only setup often has
`fastlane/screenshots/` in `.gitignore` (that flow uses `skip_screenshots`). This
lane uploads them, so they **must be committed** — remove that ignore line (keep
ignoring only `frameit` extras) or CI uploads nothing.

## App Store Connect one-time gotchas (first submission)

These live in the ASC web console, **not** in fastlane metadata, and fastlane
will refuse the submit until they're set. **Do all of them once before the first
`fastlane release`** — they're sticky (later versions don't need them redone).
A submit that hits these fails at the *very last step*: the metadata + screenshots
have already uploaded, so just fix the console items and re-dispatch — nothing is
re-uploaded. The real error block lists all the missing attributes at once
(`violenceCartoonOrFantasy`, `ageAssurance`, `contentRightsDeclaration`, *"App is
not eligible for submission until pricing has been set"* …).

- **Age rating** questionnaire — answer all None/No for a utility. Apple
  **expanded this in 2025** (new fields: `ageAssurance`, `parentalControls`,
  `messagingAndChat`, `healthOrWellnessTopics`, …) that fastlane's rating config
  does **not** fully cover — so do it in the **web console**, not via fastlane.
- **Pricing & Availability** — set Price = **Free** + territories. Until set:
  *"App is not eligible for submission until pricing has been set."*
- **Content Rights** declaration (App Information) — "does not use third-party
  content" for most apps.
- **App Privacy** "nutrition label" — declare data collection. VoiceDrop: audio
  is user content to the user's own store; location is optional/coarse (filename
  only); Sign in with Apple is an anonymous identifier; no tracking.
- **Export compliance** — handled by the lane (`export_compliance_uses_encryption:
  false`); no console action.
- A **build** must be attached (the lane does this) before review.

## Updating a version that's already in review

`guard_not_in_review` (and Apple) will block a re-submit while the version is
**Waiting for Review**. To swap in a newer build, fix copy, or add a screenshot:
in ASC open the version → **"Remove this version from review"** (back to editable)
→ then re-dispatch `fastlane release skip_build:true`. The new build is selected,
metadata + screenshots re-upload, and it resubmits.

**Screenshots must match the binary (guideline 2.3.3).** Don't put a screenshot
of a feature the in-review build lacks — either ship that feature in the build
you're submitting, or hold the screenshot for the version that has it.

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
| *"The app name you entered is already being used"* | The `name` is globally taken → pick a unique display name (Step 2). |
| Submit fails "missing screenshots" / CI uploaded none | No 6.9" screenshot, wrong size, or `fastlane/screenshots/` still gitignored (un-ignore it). |
| Missing `violence…` / `ageAssurance` / `contentRightsDeclaration` / *"pricing has been set"* | First-submission console items unset → fill age rating, pricing=Free, content rights, App Privacy in the ASC web console once. |
| `Another version is in review` / `guard_not_in_review` tripped | To update an in-review version, "Remove this version from review" in ASC, then re-dispatch. |
| Keyword field rejected | Keywords must be comma-separated, **no spaces**, ≤100 chars total. |
| Wrong build submitted | Use `release skip_build:true` to reuse the exact TestFlight build for this `MARKETING_VERSION`. |

## Files in this skill

- `scripts/scaffold-metadata.sh` — create the `deliver` metadata tree (seeded with VoiceDrop copy)
- `scripts/shoot.sh` — scripted `simctl` screenshot capture
- `scripts/release_lane.rb` — the `release` fastlane lane to paste into your Fastfile
