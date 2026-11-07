#!/usr/bin/env python3
"""Fetches the latest Instagram reels of the TravelBuddy account and adds them to
the website branch (gh-pages): reels.json plus one thumbnail per reel. Reels that
are already listed stay, so the website shows every reel, not just the newest.
To take a reel off the website, delete its entry from reels.json on gh-pages.

The access token comes only from the environment (GitHub secret IG_TOKEN).
It is never written to the website or printed in the log.
"""
import json, os, re, sys, urllib.error, urllib.parse, urllib.request
from pathlib import Path

API = "https://graph.instagram.com"
FIELDS = "id,caption,media_type,media_product_type,permalink,thumbnail_url,timestamp"
KEEP = 300  # upper limit for the whole list on the website
PERMALINK = re.compile(r"^https://www\.instagram\.com/(reel|p)/[\w-]+/?$")


UA = "TravelBuddyWebsite/1.0 (+https://kotdesigner.github.io/TravelBuddy/)"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, image/*"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


BEHOLD = re.compile(r"^https://feeds\.behold\.so/[A-Za-z0-9_-]+/?$")


def behold_media(feed):
    """Behold JSON feed (behold.so): no Meta developer app needed."""
    raw = json.loads(get(feed))
    posts = raw.get("posts", []) if isinstance(raw, dict) else raw
    out = []
    for p in posts:
        sizes = p.get("sizes") or {}
        # Reels: the original portrait thumbnail first, Behold's square sizes only as a fallback
        thumb = p.get("thumbnailUrl") or (sizes.get("large") or sizes.get("medium") or {}).get("mediaUrl", "")
        out.append({"id": p.get("id", ""), "media_type": p.get("mediaType", ""), "permalink": p.get("permalink", ""),
                    "thumbnail_url": thumb, "caption": p.get("prunedCaption") or p.get("caption", ""),
                    "timestamp": p.get("timestamp", "")})
    return {"data": out}


def facebook_media(token):
    """Token from Facebook Login: find the Instagram account linked to the Facebook page."""
    fb = "https://graph.facebook.com/v21.0"
    q = urllib.parse.urlencode({"fields": "name,instagram_business_account{username}", "access_token": token})
    pages = json.loads(get(f"{fb}/me/accounts?{q}")).get("data", [])
    ig = next((p["instagram_business_account"] for p in pages if p.get("instagram_business_account")), None)
    if not ig:
        sys.exit(f"This Facebook token sees {len(pages)} pages and no linked Instagram account. "
                 "Use an Instagram token instead (it starts with IGAA), see INSTAGRAM-AUTOMATIK.md.")
    print(f"Instagram account via Facebook: @{ig.get('username', '?')}")
    q = urllib.parse.urlencode({"fields": FIELDS, "limit": 25, "access_token": token})
    return json.loads(get(f"{fb}/{ig['id']}/media?{q}"))


def write(site, data):
    items = [m for m in data.get("data", [])
             if m.get("media_type") == "VIDEO" and PERMALINK.match(m.get("permalink", ""))]
    items.sort(key=lambda m: m.get("timestamp", ""), reverse=True)

    folder = site / "reels"
    folder.mkdir(exist_ok=True)
    try:
        before = json.loads((site / "reels.json").read_text())
    except Exception:
        before = []
    if not isinstance(before, list):
        before = []
    old_thumb = {r.get("permalink", "").rstrip("/"): r.get("thumb", "")
                 for r in before if isinstance(r, dict)}
    reels, keep_files = [], {".gitkeep"}
    for m in items:
        mid = re.sub(r"\D", "", m["id"])
        ext = ".webp" if ".webp" in (m.get("thumbnail_url") or "").split("?")[0] else ".jpg"
        name = f"{mid}-p{ext}"
        keep_files.add(name)
        target = folder / name
        if not target.exists() and m.get("thumbnail_url"):
            try:
                target.write_bytes(get(m["thumbnail_url"]))
            except Exception as e:
                print(f"thumbnail for {mid} failed: {type(e).__name__}")
        thumb = f"reels/{name}" if target.exists() else ""
        prev = old_thumb.get(m["permalink"].rstrip("/"), "")
        if not thumb and prev.startswith("reels/") and (site / prev).exists():
            thumb = prev  # keep the cover we already have
            keep_files.add(prev[len("reels/"):])
        reels.append({
            "id": mid,
            "permalink": m["permalink"],
            "caption": (m.get("caption") or "").strip()[:200],
            "timestamp": m.get("timestamp", ""),
            "thumb": thumb,
        })
    # The feed only has the newest posts (Behold free plan: 6), so every reel that
    # is already listed stays. A feed entry replaces an old one with the same
    # permalink, so a reel added by hand is never doubled.
    seen = {r["permalink"].rstrip("/") for r in reels}
    for r in before:
        link = r.get("permalink", "") if isinstance(r, dict) else ""
        if PERMALINK.match(link) and link.rstrip("/") not in seen:
            seen.add(link.rstrip("/"))
            reels.append(r)
            if r.get("thumb", "").startswith("reels/"):
                keep_files.add(r["thumb"][len("reels/"):])
    reels.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    reels = reels[:KEEP]

    for f in folder.iterdir():
        if f.name not in keep_files:
            f.unlink()
    (site / "reels.json").write_text(json.dumps(reels, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(reels)} reels written.")


def main():
    site = Path(sys.argv[1] if len(sys.argv) > 1 else "site")
    feed = os.environ.get("BEHOLD_FEED", "").strip()
    token = os.environ.get("IG_TOKEN", "").strip()
    if feed:
        if not BEHOLD.match(feed):
            sys.exit("BEHOLD_FEED must look like https://feeds.behold.so/<feed id>")
        try:
            data = behold_media(feed)
        except urllib.error.HTTPError as e:
            body = e.read()[:300].decode("utf-8", "replace").replace(feed, "<feed>")
            sys.exit(f"Behold feed request failed: HTTP {e.code} {body}")
        except Exception as e:
            sys.exit(f"Behold feed request failed: {type(e).__name__}")
        print(f"Behold feed: {len(data['data'])} posts")
        write(site, data)
        return
    if not token:
        print("Neither BEHOLD_FEED nor IG_TOKEN is set yet, nothing to do.")
        return
    token = token.strip().strip('"').strip("'")
    kind = ("Instagram (IGAA...)" if token.startswith("IG") else
            "Facebook (EA...), trying the Facebook route" if token.startswith("EA") else "unknown format")
    hints = [w for w, c in (("a link", "http" in token), ("an equals sign", "=" in token),
             ("an ampersand", "&" in token), ("a hash", "#" in token), ("a line break", "\n" in token)) if c]
    print(f"token check: {kind}, {len(token)} characters, starts with {token[:3]!r}, contains {', '.join(hints) or 'nothing odd'}")
    try:
        if token.startswith("EA"):
            data = facebook_media(token)
        else:
            q = urllib.parse.urlencode({"fields": FIELDS, "limit": 25, "access_token": token})
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
    write(site, data)

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
