"""Prompt templates for social media post generation (Agent 5)."""
from __future__ import annotations

from datetime import date

# ---------------------------------------------------------------------------
# Tone rotation — cycles by day of week so posts don't sound repetitive
# ---------------------------------------------------------------------------

TONE_VARIATIONS = [
    "excited",          # Monday
    "matter-of-fact",   # Tuesday
    "curious",          # Wednesday
    "educational",      # Thursday
    "conversational",   # Friday
]

# Weekday index for Saturday / Sunday wraps back to 0 / 1
_HASHTAG_POOL = "#webdev #devtools #buildinpublic #css #javascript #productivity"


def _today_tone() -> str:
    return TONE_VARIATIONS[date.today().weekday() % len(TONE_VARIATIONS)]


# ---------------------------------------------------------------------------
# Twitter
# ---------------------------------------------------------------------------

def twitter_prompt(
    tool_name: str,
    description: str,
    url: str,
    keywords: str,
    pain_points: str,
) -> tuple[str, str]:
    """Return (system, user) prompt for 3 tweet variations."""
    tone = _today_tone()
    system = (
        f"You are a developer writing tweets in a {tone} tone. "
        "Write exactly 3 tweet variations separated by '---'. "
        "Each tweet must be under 260 characters, include the URL, "
        f"and 2-3 relevant hashtags chosen from: {_HASHTAG_POOL}. "
        "No numbering, no labels. Return only the tweet text."
    )
    user = (
        f"Tool: {tool_name}\n"
        f"Description: {description}\n"
        f"URL: {url}\n"
        f"Keywords: {keywords}\n"
        f"Pain points it solves: {pain_points}\n\n"
        "Write 3 tweet variations:\n"
        "1. Hook tweet — lead with a bold claim or surprising benefit\n"
        "2. Demo tweet — describe what the tool does in one concrete sentence\n"
        "3. Question tweet — open with a relatable question, then present the tool as the answer\n"
        "Separate each with '---'. Keep each under 260 characters including the URL."
    )
    return system, user


# ---------------------------------------------------------------------------
# LinkedIn
# ---------------------------------------------------------------------------

def linkedin_prompt(
    tool_name: str,
    description: str,
    url: str,
    keywords: str,
    pain_points: str,
) -> tuple[str, str]:
    """Return (system, user) prompt for a professional founder post (150-250 words)."""
    tone = _today_tone()
    system = (
        f"You are a founder writing a LinkedIn post in a {tone} tone. "
        "Write a professional 'built this today' post between 150 and 250 words. "
        "Lead with a relatable problem, explain what you built and why, "
        "end with the URL and an invitation to try it. "
        "Use line breaks for readability. No hashtag spam — max 3 relevant hashtags. "
        "Return only the post text."
    )
    user = (
        f"Tool: {tool_name}\n"
        f"Description: {description}\n"
        f"URL: {url}\n"
        f"Keywords: {keywords}\n"
        f"Pain points it solves: {pain_points}\n\n"
        "Write a LinkedIn post in the 'built this today' founder style."
    )
    return system, user


# ---------------------------------------------------------------------------
# Reddit
# ---------------------------------------------------------------------------

_SUBREDDIT_MAP = {
    "css": "css",
    "design": "web_design",
    "color": "web_design",
    "gradient": "web_design",
    "image": "webdev",
    "compress": "webdev",
    "text": "webdev",
    "font": "web_design",
    "json": "webdev",
    "api": "webdev",
    "markdown": "webdev",
    "productivity": "productivity",
    "seo": "webdev",
    "default": "webdev",
}


def _pick_subreddit(tool_name: str, description: str) -> str:
    combined = (tool_name + " " + description).lower()
    for keyword, sub in _SUBREDDIT_MAP.items():
        if keyword in combined:
            return sub
    return _SUBREDDIT_MAP["default"]


def reddit_prompt(
    tool_name: str,
    description: str,
    url: str,
    keywords: str,
    pain_points: str,
) -> tuple[str, str, str]:
    """Return (system, user, subreddit) for a non-spammy Reddit post."""
    tone = _today_tone()
    subreddit = _pick_subreddit(tool_name, description)
    system = (
        f"You are a developer sharing a project on Reddit in a {tone} tone. "
        "Write a non-spammy 'I built this' post that leads with value. "
        "Structure: brief intro sentence about the problem, what you built, "
        "2-3 technical details or interesting implementation choices, "
        "then the URL at the end with an invitation for feedback. "
        "Keep it under 200 words. No markdown headers. Return only the post body text."
    )
    user = (
        f"Subreddit: r/{subreddit}\n"
        f"Tool: {tool_name}\n"
        f"Description: {description}\n"
        f"URL: {url}\n"
        f"Keywords: {keywords}\n"
        f"Pain points it solves: {pain_points}\n\n"
        "Write a helpful Reddit post body that leads with value, not promotion."
    )
    return system, user, subreddit
