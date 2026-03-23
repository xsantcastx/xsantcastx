"""Agent 5 — Social Media Automation.

Generates social media copy with Claude (Haiku) and optionally posts it.

draft_mode=True  → saves posts to runs/YYYY-MM-DD/05_social_drafts.json
draft_mode=False → posts to each platform, saves results to 05_social.json

Missing credentials are handled gracefully — that platform is skipped.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.claude_client import call_claude, HAIKU
from utils.social_prompts import twitter_prompt, linkedin_prompt, reddit_prompt
from utils.social_api import post_tweet, post_linkedin, post_reddit


# ---------------------------------------------------------------------------
# Credential helpers
# ---------------------------------------------------------------------------

def _twitter_creds() -> dict | None:
    keys = ("TWITTER_API_KEY", "TWITTER_API_SECRET", "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_SECRET")
    vals = {k: os.environ.get(k, "") for k in keys}
    if all(vals.values()):
        return vals
    missing = [k for k, v in vals.items() if not v]
    print(f"[social] Twitter credentials missing ({', '.join(missing)}) — skipping.")
    return None


def _linkedin_creds() -> dict | None:
    keys = ("LINKEDIN_ACCESS_TOKEN", "LINKEDIN_PERSON_URN")
    vals = {k: os.environ.get(k, "") for k in keys}
    if all(vals.values()):
        return vals
    missing = [k for k, v in vals.items() if not v]
    print(f"[social] LinkedIn credentials missing ({', '.join(missing)}) — skipping.")
    return None


def _reddit_creds() -> dict | None:
    keys = ("REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USERNAME", "REDDIT_PASSWORD")
    vals = {k: os.environ.get(k, "") for k in keys}
    if all(vals.values()):
        return vals
    missing = [k for k, v in vals.items() if not v]
    print(f"[social] Reddit credentials missing ({', '.join(missing)}) — skipping.")
    return None


# ---------------------------------------------------------------------------
# Copy generation
# ---------------------------------------------------------------------------

def _generate_copy(tool_name: str, description: str, url: str,
                   keywords: str, pain_points: str) -> dict:
    print("[social] Generating Twitter copy…")
    tw_sys, tw_user = twitter_prompt(tool_name, description, url, keywords, pain_points)
    twitter_raw = call_claude(
        system=tw_sys,
        messages=[{"role": "user", "content": tw_user}],
        max_tokens=1024,
        model=HAIKU,
    )
    tweets = [t.strip() for t in twitter_raw.split("---") if t.strip()]

    print("[social] Generating LinkedIn copy…")
    li_sys, li_user = linkedin_prompt(tool_name, description, url, keywords, pain_points)
    linkedin_post = call_claude(
        system=li_sys,
        messages=[{"role": "user", "content": li_user}],
        max_tokens=1024,
        model=HAIKU,
    ).strip()

    print("[social] Generating Reddit copy…")
    rd_sys, rd_user, subreddit = reddit_prompt(tool_name, description, url, keywords, pain_points)
    reddit_body = call_claude(
        system=rd_sys,
        messages=[{"role": "user", "content": rd_user}],
        max_tokens=1024,
        model=HAIKU,
    ).strip()
    reddit_title = f"I built {tool_name} — a free {description.rstrip('.').lower()} tool"

    return {
        "twitter": {"tweets": tweets},
        "linkedin": {"post": linkedin_post},
        "reddit": {"title": reddit_title, "body": reddit_body, "subreddit": subreddit},
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(context: dict, draft_mode: bool = True) -> dict:
    tool_name   = context.get("tool_name", "")
    slug        = context.get("slug", "")
    description = context.get("description", "")
    live_url    = context.get("live_url", f"https://xsantcastx.web.app/tools/{slug}")
    keywords    = context.get("seo_keywords", "")
    pain_points = context.get("pain_points", "")
    run_dir: Path = context["run_dir"]

    mode_label = "draft" if draft_mode else "live"
    output_file = "05_social_drafts.json" if draft_mode else "05_social.json"
    output_path = run_dir / output_file

    if output_path.exists():
        print(f"[social] Output already exists ({output_file}) — skipping.")
        return json.loads(output_path.read_text())

    print(f"[social] Generating copy for '{tool_name}' (mode={mode_label})…")
    copy = _generate_copy(tool_name, description, live_url, keywords, pain_points)

    results: dict = {"mode": mode_label, "tool_name": tool_name, "url": live_url, "platforms": {}}

    if draft_mode:
        results["platforms"]["twitter"] = {"drafted": True, "tweets": copy["twitter"]["tweets"]}
        results["platforms"]["linkedin"] = {"drafted": True, "post": copy["linkedin"]["post"]}
        results["platforms"]["reddit"] = {
            "drafted": True,
            "title": copy["reddit"]["title"],
            "body": copy["reddit"]["body"],
            "subreddit": copy["reddit"]["subreddit"],
        }
        print("[social] Draft mode — not posting to any platform.")
    else:
        # Twitter
        tw = _twitter_creds()
        if tw and copy["twitter"]["tweets"]:
            tweet_text = copy["twitter"]["tweets"][0]
            print(f"[social] Posting to Twitter: {tweet_text[:60]}…")
            tw_result = post_tweet(
                tweet_text,
                tw["TWITTER_API_KEY"], tw["TWITTER_API_SECRET"],
                tw["TWITTER_ACCESS_TOKEN"], tw["TWITTER_ACCESS_SECRET"],
            )
            results["platforms"]["twitter"] = {**tw_result, "tweets": copy["twitter"]["tweets"]}
        else:
            results["platforms"]["twitter"] = {"skipped": True, "tweets": copy["twitter"]["tweets"]}

        # LinkedIn
        li = _linkedin_creds()
        if li:
            print("[social] Posting to LinkedIn…")
            li_result = post_linkedin(
                copy["linkedin"]["post"],
                li["LINKEDIN_ACCESS_TOKEN"],
                li["LINKEDIN_PERSON_URN"],
            )
            results["platforms"]["linkedin"] = {**li_result, "post": copy["linkedin"]["post"]}
        else:
            results["platforms"]["linkedin"] = {"skipped": True, "post": copy["linkedin"]["post"]}

        # Reddit
        rd = _reddit_creds()
        if rd:
            subreddit = copy["reddit"]["subreddit"]
            print(f"[social] Posting to r/{subreddit}…")
            rd_result = post_reddit(
                copy["reddit"]["title"],
                copy["reddit"]["body"],
                subreddit,
                rd["REDDIT_CLIENT_ID"], rd["REDDIT_CLIENT_SECRET"],
                rd["REDDIT_USERNAME"], rd["REDDIT_PASSWORD"],
            )
            results["platforms"]["reddit"] = {**rd_result, **copy["reddit"]}
        else:
            results["platforms"]["reddit"] = {"skipped": True, **copy["reddit"]}

    output_path.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"[social] Done → {output_path}")
    return results
