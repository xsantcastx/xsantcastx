"""Reddit public JSON API helpers — no auth required."""
import time
import requests

HEADERS = {"User-Agent": "xsantcastx-pipeline/1.0"}

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
]


def fetch_posts(subreddit: str, listing: str = "hot", limit: int = 25, time_filter: str = "day") -> list[dict]:
    """Fetch posts from a subreddit endpoint.

    listing: 'hot', 'new', or 'top'
    """
    if listing == "top":
        url = f"https://www.reddit.com/r/{subreddit}/top.json?t={time_filter}&limit={limit}"
    else:
        url = f"https://www.reddit.com/r/{subreddit}/{listing}.json?limit={limit}"

    response = requests.get(url, headers=HEADERS, timeout=20)
    response.raise_for_status()
    data = response.json()

    posts = []
    for child in data.get("data", {}).get("children", []):
        post = child.get("data", {})
        posts.append({
            "title": post.get("title", ""),
            "selftext": post.get("selftext", "")[:600],
            "permalink": "https://reddit.com" + post.get("permalink", ""),
            "score": post.get("score", 0),
            "subreddit": subreddit,
            "num_comments": post.get("num_comments", 0),
        })
    return posts


def _matches_keyword(post: dict) -> str | None:
    """Return the first matching keyword, or None."""
    text = (post["title"] + " " + post["selftext"]).lower()
    for kw in KEYWORDS:
        if kw in text:
            return kw
    return None


def collect_all(rate_limit_delay: float = 1.0) -> list[dict]:
    """Collect and filter pain-point posts from all configured subreddits.

    Returns deduplicated list sorted by score descending.
    rate_limit_delay: seconds to sleep between requests to avoid 429s.
    """
    all_posts: list[dict] = []
    seen_permalinks: set[str] = set()

    for subreddit in SUBREDDITS:
        for listing in ("hot", "new", "top"):
            try:
                posts = fetch_posts(subreddit, listing)
                time.sleep(rate_limit_delay)
            except requests.HTTPError as exc:
                print(f"[reddit] HTTP error {subreddit}/{listing}: {exc}")
                continue
            except Exception as exc:
                print(f"[reddit] Error fetching {subreddit}/{listing}: {exc}")
                continue

            for post in posts:
                permalink = post["permalink"]
                if permalink in seen_permalinks:
                    continue
                kw = _matches_keyword(post)
                if kw:
                    post["matched_keyword"] = kw
                    seen_permalinks.add(permalink)
                    all_posts.append(post)

    # Sort by score so Claude sees the most upvoted pain points first
    all_posts.sort(key=lambda p: p["score"], reverse=True)
    return all_posts
