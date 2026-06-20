#!/usr/bin/env bash
#
# shoot.sh — scripted App Store screenshot capture via `xcrun simctl`.
#
# Boots a simulator, builds + installs the app for that simulator, launches it,
# drives it to each marketing screen, and writes correctly-named PNGs into
# fastlane/screenshots/<locale>/ ready for `fastlane deliver`.
#
# No UITest target needed. The only per-app part is drive_screens() — edit it.
#
# Usage:
#   scripts/shoot.sh                      # defaults below
#   DEVICE="iPhone 16 Pro Max" LOCALE=en-US scripts/shoot.sh
#   FRAME=1 scripts/shoot.sh              # also run `fastlane frameit`
#
# Apple required size: the 6.9" display (1320×2868) covers iPhone-only apps.
# iPhone 16 Pro Max == 6.9". Add a second pass with a 13" iPad sim only if the
# app's TARGETED_DEVICE_FAMILY includes iPad.

set -euo pipefail

# ---- Config (override via env) ------------------------------------------------
SCHEME="${SCHEME:-VoiceDrop}"
PROJECT="${PROJECT:-VoiceDrop.xcodeproj}"
BUNDLE_ID="${BUNDLE_ID:-com.wangjianshuo.VoiceDrop}"
DEVICE="${DEVICE:-iPhone 16 Pro Max}"
OS="${OS:-latest}"
LOCALE="${LOCALE:-zh-Hans}"          # zh-Hans | en-US | ...
APPLE_LANG="${APPLE_LANG:-zh-Hans}"  # -AppleLanguages value the app launches in
OUT="${OUT:-fastlane/screenshots/${LOCALE}}"
DERIVED="${DERIVED:-build/screenshots}"

log() { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }

# ---- 0. Regenerate project if it's XcodeGen-managed --------------------------
if [[ -f project.yml ]] && command -v xcodegen >/dev/null 2>&1; then
  log "xcodegen generate"
  xcodegen generate >/dev/null
fi

# ---- 1. Boot the simulator ---------------------------------------------------
log "Booting simulator: $DEVICE"
UDID="$(xcrun simctl list devices available | grep -F "$DEVICE (" | head -1 | grep -oE '[0-9A-F-]{36}' | head -1 || true)"
if [[ -z "${UDID}" ]]; then
  echo "No available simulator named '$DEVICE'. List with: xcrun simctl list devices available" >&2
  exit 1
fi
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b
# Cosmetic: clean status bar (full battery, full signal, fixed clock).
xcrun simctl status_bar "$UDID" override \
  --time "9:41" --batteryState charged --batteryLevel 100 \
  --cellularMode active --cellularBars 4 --wifiBars 3 2>/dev/null || true

# ---- 2. Build for the simulator ----------------------------------------------
log "Building $SCHEME for simulator"
xcodebuild build \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "id=$UDID" \
  -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO | tail -5

APP_PATH="$(find "$DERIVED/Build/Products" -name "${SCHEME}.app" -type d | head -1)"
[[ -z "$APP_PATH" ]] && { echo "Build product ${SCHEME}.app not found under $DERIVED" >&2; exit 1; }

# ---- 3. Install + pre-grant privacy ------------------------------------------
log "Installing $APP_PATH"
xcrun simctl install "$UDID" "$APP_PATH"
# Pre-grant TCC so most permission dialogs never appear. NOTE: iOS does NOT
# honor this for AVFoundation's *record* prompt (mic) — that one still shows on
# first launch and must be tapped ONCE (see the gotcha below). Everything else
# (location, photos, contacts, camera, notifications) is reliably suppressed.
for svc in location location-always photos contacts camera microphone calendar reminders motion; do
  xcrun simctl privacy "$UDID" grant "$svc" "$BUNDLE_ID" 2>/dev/null || true
done

# ---- 4. Capture --------------------------------------------------------------
mkdir -p "$OUT"
shot() { # shot <NN_name>
  local name="$1"
  sleep "${SETTLE:-2.5}"   # let animations finish
  xcrun simctl io "$UDID" screenshot "$OUT/${name}.png"
  log "captured $OUT/${name}.png"
}
launch() {
  xcrun simctl launch "$UDID" "$BUNDLE_ID" \
    -AppleLanguages "($APPLE_LANG)" -AppleLocale "$LOCALE" "$@" >/dev/null
}
term() { xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true; }
# NOTE: there is NO `simctl io tap`. simctl cannot synthesize touches. To reach a
# screen, prefer launch arguments / a debug deep link your app reads. If you must
# tap (e.g. to dismiss the one unavoidable mic prompt), open Simulator.app and
# tap by hand once — the grant persists for the install, so later runs are clean.

# ===== EDIT THIS for your app =================================================
# Each numbered screen = one App Store screenshot. Keep 3–6. Filenames sort
# alphabetically in App Store Connect, so prefix with 01_, 02_, ...
# `simctl` cannot tap or type — jump to each screen with launch arguments / a
# debug deep link your app reads. Seed any needed UI state the same way.
# FIRST-LAUNCH MIC PROMPT: if the app requests record permission, iOS shows a
# dialog `simctl privacy` can't suppress. Open Simulator.app, tap 允许/Allow
# ONCE; the grant persists, so re-run this script and the shot will be clean.
drive_screens() {
  term; launch                 # cold launch → main / record screen
  shot "01_record"

  # Example of a second screen via a debug deep link the app handles:
  # term; launch -DeepLink "voicedrop://history"
  # shot "02_history"
}
# =============================================================================

drive_screens
term
xcrun simctl status_bar "$UDID" clear 2>/dev/null || true

# ---- 5. Optional framing -----------------------------------------------------
if [[ "${FRAME:-0}" == "1" ]]; then
  log "Framing with fastlane frameit"
  ( cd "$OUT" && bundle exec fastlane frameit silver ) || \
    echo "frameit failed (install imagemagick + 'fastlane frameit setup'?)" >&2
fi

log "Done. Screenshots in $OUT"
ls -1 "$OUT"
