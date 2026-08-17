#!/usr/bin/env python3
"""Re-run YouTube OAuth to add the force-ssl scope (needed for comments,
deletes, thumbnails). Opens the default browser for consent; token saved
back to ~/.config/youtube/token.json (old one backed up as token.json.bak).

Run: uvx --with google-auth-oauthlib python reauth-youtube.py
"""
import shutil
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

CONF = Path.home() / ".config/youtube"
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]

tok = CONF / "token.json"
if tok.exists():
    shutil.copy(tok, CONF / "token.json.bak")

flow = InstalledAppFlow.from_client_secrets_file(str(CONF / "credentials.json"), SCOPES)
creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")
tok.write_text(creds.to_json())
print(f"✓ new token saved with scopes: {creds.scopes}")
