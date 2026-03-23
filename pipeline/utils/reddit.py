"""Post collection helpers.

Sources (tried in order):
  1. Reddit public JSON API  — blocked from GitHub Actions IPs (~403), works locally
  2. Hacker News Algolia API — always open, no auth, CI-safe fallback
"""
import time
import requests

HEADERS = {"User-Agent": "xsantcastx-pipeline/1.0"}

# ---------------------------------------------------------------------------
# Shared keywords
# ---------------------------------------------------------------------------

KEYWORDS = [
    "i wish there was a tool",
    "anyone know a tool for",
    "is there a way to",
    "i need something that",
    "hate doing this manually",
    "wish this existed",
    "looking for a tool",
    "does anyone know of a tool",
    "would love a tool",
    "automate this",
]


def _matches_keyword(text: str) -> str | None:
    lowered = text.lower()
    for kw in KEYWORDS:
        if kw in lowered:
            return kw
    return None


# ---------------------------------------------------------------------------
# Reddit (public JSON — may 403 from CI)
# ---------------------------------------------------------------------------

SUBREDDITS = [
    "webdev",
    "programming",
    "SideProject",
    "entrepreneur",
    "startups",
    "nocode",
    "productivity",
    "learnprogramming",
    "indiegaming",
    "Entrepreneur",
]


def _fetch_reddit_listing(subreddit: str, listing: str, limit: int = 25, time_filter: str = "day") -> list[dict]:
    if listing == "top":
        url = f"https://www.reddit.com/r/{subreddit}/top.json?t={time_filter}&limit={limit}"
    else:
        url = f"https://www.reddit.com/r/{subreddit}/{listing}.json?limit={limit}"
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    posts = []
    for child in resp.json().get("data", {}).get("children", []):
        p = child.get("data", {})
        posts.append({
            "source": "reddit",
            "title": p.get("title", ""),
            "selftext": p.get("selftext", "")[:600],
            "permalink": "https://reddit.com" + p.get("permalink", ""),
            "score": p.get("score", 0),
            "subreddit": subreddit,
        })
    return posts


def collect_reddit(rate_limit_delay: float = 1.0) -> list[dict]:
    """Try collecting from Reddit. Returns [] if all requests 403/fail."""
    all_posts: list[dict] = []
    seen: set[str] = set()
    error_count = 0

    for subreddit in SUBREDDITS:
        for listing in ("hot", "new", "top"):
            try:
                posts = _fetch_reddit_listing(subreddit, listing)
                time.sleep(rate_limit_delay)
            except requests.HTTPError as exc:
                print(f"[reddit] HTTP error {subreddit}/{listing}: {exc}")
                error_count += 1
                continue
            except Exception as exc:
                print(f"[reddit] Error {subreddit}/{listing}: {exc}")
                error_count += 1
                continue

            for post in posts:
                key = post["permalink"]
                if key in seen:
                    continue
                combined = post["title"] + " " + post["selftext"]
                kw = _matches_keyword(combined)
                if kw:
                    post["matched_keyword"] = kw
                    seen.add(key)
                    all_posts.append(post)

        # If the first subreddit 403s on all 3 listings, Reddit is probably blocked —
        # bail early rather than hammering 27 more blocked requests.
        if error_count >= 3 and len(all_posts) == 0:
            print("[reddit] First subreddit fully blocked — aborting Reddit collection.")
            break

    all_posts.sort(key=lambda p: p["score"], reverse=True)
    return all_posts


# ---------------------------------------------------------------------------
# Hacker News Algolia (always open, CI-safe)
# ---------------------------------------------------------------------------

HN_QUERIES = [
    "wish there was a tool",
    "hate doing this manually",
    "anyone know a tool for",
    "is there a way to automate",
    "need something that",
]


def collect_hn(hits_per_query: int = 50) -> list[dict]:
    """Search HN comments via Algolia for tool pain-point mentions."""
    all_posts: list[dict] = []
    seen: set[str] = set()

    for query in HN_QUERIES:
        try:
            url = "https://hn.algolia.com/api/v1/search"
            params = {
                "query": query,
                "tags": "comment",
                "hitsPerPage": hits_per_query,
            }
            resp = requests.get(url, params=params, headers=HEADERS, timeout=20)
            resp.raise_for_status()
            hits = resp.json().get("hits", [])
            time.sleep(0.5)
        except Exception as exc:
            print(f"[hn] Error fetching '{query}': {exc}")
            continue

        for hit in hits:
            oid = hit.get("objectID", "")
            if oid in seen:
                continue
            comment_text = hit.get("comment_text") or ""
            story_title = hit.get("story_title") or ""
            combined = story_title + " " + comment_text
            kw = _matches_keyword(combined)
            if kw:
                seen.add(oid)
                all_posts.append({
                    "source": "hackernews",
                    "title": story_title,
                    "selftext": comment_text[:600],
                    "permalink": f"https://news.ycombinator.com/item?id={oid}",
                    "score": hit.get("points") or 0,
                    "subreddit": "HackerNews",
                    "matched_keyword": kw,
                })

    all_posts.sort(key=lambda p: p["score"], reverse=True)
    print(f"[hn] Collected {len(all_posts)} matching HN comments.")
    return all_posts


# ---------------------------------------------------------------------------
# Combined entry point
# ---------------------------------------------------------------------------

def collect_all() -> list[dict]:
    """Collect pain-point posts from Reddit, falling back to HN if Reddit is blocked."""
    print("[sources] Trying Reddit…")
    reddit_posts = collect_reddit()

    if reddit_posts:
        print(f"[sources] Reddit returned {len(reddit_posts)} posts — using Reddit data.")
        return reddit_posts

    print("[sources] Reddit returned 0 posts (likely blocked) — falling back to Hacker News.")
    hn_posts = collect_hn()
    return hn_posts
