# Google Cloud OAuth setup for YouTube upload

One-time, ~5 minutes. Result: a `credentials.json` file you save to `~/.config/youtube/credentials.json`.

## 1. Create a project

1. https://console.cloud.google.com → top-bar project picker → **New Project**
2. Name it anything (e.g., `youtube-upload`) and create

## 2. Enable the API

1. APIs & Services → **Library**
2. Search **YouTube Data API v3** → **Enable**

## 3. Configure the OAuth consent screen

1. APIs & Services → **OAuth consent screen**
2. User Type: **External** → Create
3. App name: `YouTube Upload`. Support email: your address. Developer contact: your address. Save & continue.
4. Scopes step: leave empty, continue.
5. **Test users**: add your own Google account (the one you'll upload from). Save.

This puts the app in **Testing** mode — that's fine; only the Test users you listed can grant access. There's no need to ever publish/verify the app.

## 4. Create the OAuth client

1. APIs & Services → **Credentials**
2. **+ Create Credentials** → **OAuth client ID**
3. Application type: **Desktop app**
4. Create → **Download JSON**
5. Move it to `~/.config/youtube/credentials.json`:

```bash
mkdir -p ~/.config/youtube
mv ~/Downloads/client_secret_*.json ~/.config/youtube/credentials.json
```

## 5. First upload triggers consent

The first time the upload script runs, it opens your browser:

1. Pick the Google account you added as a Test user
2. Google shows a **"Google hasn't verified this app"** warning — click **Advanced** → **Go to YouTube Upload (unsafe)**. This is normal for a personal OAuth app in Testing mode; you own the app, the warning is about Google not having reviewed it.
3. Grant the `youtube.upload` scope → Continue
4. The script writes `~/.config/youtube/token.json` — subsequent runs reuse it silently, no browser

## Common pitfalls

- **`access_denied 403`** on consent: your Google account isn't on the Test users list. Add it (step 3.5) and retry.
- **Wrong project**: the Credentials and OAuth consent screen pages always show data for the currently selected project (top bar). If you created the client in project A but OAuth consent screen is currently showing project B, you'll get cryptic errors. Confirm the project name matches.
- **Token expired and refresh fails**: delete `~/.config/youtube/token.json` and re-run; browser flow re-runs.

## Quota

YouTube Data API default quota is **10,000 units/day**. An upload costs **1,600 units**, so you get ~6 uploads/day on the default tier. If you need more, request a quota increase in Google Cloud Console under **APIs & Services → Quotas**.
