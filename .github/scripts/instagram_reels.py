#!/usr/bin/env python3
"""Fetches the latest Instagram reels of the TravelBuddy account and writes them
into the website branch (gh-pages): reels.json plus one thumbnail per reel.

The access token comes only from the environment (GitHub secret IG_TOKEN).
It is never written to the website or printed in the log.
"""
import json, os, re, sys, urllib.error, urllib.parse, urllib.request
from pathlib import Path

API = "https://graph.instagram.com"
FIELDS = "id,caption,media_type,media_product_type,permalink,thumbnail_url,timestamp"
KEEP = 6
PERMALINK = re.compile(r"^https://www\.instagram\.com/(reel|p)/[\w-]+/?$")


def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read()


def main():
    site = Path(sys.argv[1] if len(sys.argv) > 1 else "site")
    token = os.environ.get("IG_TOKEN", "").strip()
    if not token:
        print("IG_TOKEN is not set yet, nothing to do.")
        return
    token = token.strip().strip('"').strip("'")
    kind = ("Instagram (IGAA...)" if token.startswith("IG") else
            "Facebook (EAA...), not usable here" if token.startswith("EAA") else "unknown format")
    print(f"token check: {kind}, {len(token)} characters, spaces inside: {' ' in token}")
    q = urllib.parse.urlencode({"fields": FIELDS, "limit": 25, "access_token": token})
    try:
        data = json.loads(get(f"{API}/me/media?{q}"))
    except urllib.error.HTTPError as e:  # never echo the URL, it carries the token
        try:
            err = json.loads(e.read()).get("error", {})
            detail = f"{err.get('type', '')} {err.get('code', '')}: {err.get('message', '')}"
        except Exception:
            detail = ""
        sys.exit(f"Instagram API request failed: HTTP {e.code} {detail}".replace(token, "***"))
    except Exception as e:
        sys.exit(f"Instagram API request failed: {type(e).__name__}")
    items = [m for m in data.get("data", [])
             if m.get("media_type") == "VIDEO" and PERMALINK.match(m.get("permalink", ""))]
    items.sort(key=lambda m: m.get("timestamp", ""), reverse=True)
    items = items[:KEEP]

    folder = site / "reels"
    folder.mkdir(exist_ok=True)
    reels, keep_files = [], {".gitkeep"}
    for m in items:
        mid = re.sub(r"\D", "", m["id"])
        name = f"{mid}.jpg"
        keep_files.add(name)
        target = folder / name
        if not target.exists() and m.get("thumbnail_url"):
            try:
                target.write_bytes(get(m["thumbnail_url"]))
            except Exception as e:
                print(f"thumbnail for {mid} failed: {type(e).__name__}")
        reels.append({
            "id": mid,
            "permalink": m["permalink"],
            "caption": (m.get("caption") or "").strip()[:200],
            "timestamp": m.get("timestamp", ""),
            "thumb": f"reels/{name}" if target.exists() else "",
        })
    for f in folder.iterdir():
        if f.name not in keep_files:
            f.unlink()
    (site / "reels.json").write_text(json.dumps(reels, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(reels)} reels written.")

    if os.environ.get("REFRESH") == "1":
        q = urllib.parse.urlencode({"grant_type": "ig_refresh_token", "access_token": token})
        try:
            new = json.loads(get(f"{API}/refresh_access_token?{q}")).get("access_token", "")
        except Exception as e:
            print(f"token refresh failed: {type(e).__name__}")
            return
        if new:
            out = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "ig_token"
            out.write_text(new)
            print("token refreshed.")


if __name__ == "__main__":
    main()
