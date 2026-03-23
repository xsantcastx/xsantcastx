"""Helpers for posting to social media platforms.

Each function returns {"success": bool, "url": str, "error": str}.
"""
from __future__ import annotations


def post_tweet(
    text: str,
    api_key: str,
    api_secret: str,
    access_token: str,
    access_secret: str,
) -> dict:
    """Post a tweet using Tweepy v4. Returns {"success", "url", "error"}."""
    try:
        import tweepy  # type: ignore

        client = tweepy.Client(
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_secret,
        )
        response = client.create_tweet(text=text)
        tweet_id = response.data["id"]
        # Derive username from v1 API so we can build the URL
        auth = tweepy.OAuth1UserHandler(api_key, api_secret, access_token, access_secret)
        api_v1 = tweepy.API(auth)
        username = api_v1.verify_credentials().screen_name
        url = f"https://twitter.com/{username}/status/{tweet_id}"
        return {"success": True, "url": url, "error": ""}
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "url": "", "error": str(exc)}


def post_linkedin(
    text: str,
    access_token: str,
    person_urn: str,
) -> dict:
    """Post to LinkedIn using the UGC API. Returns {"success", "url", "error"}."""
    try:
        import requests  # noqa: PLC0415

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        }
        payload = {
            "author": person_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }
        resp = requests.post(
            "https://api.linkedin.com/v2/ugcPosts",
            headers=headers,
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        post_id = resp.headers.get("x-restli-id", "")
        url = f"https://www.linkedin.com/feed/update/{post_id}/" if post_id else ""
        return {"success": True, "url": url, "error": ""}
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "url": "", "error": str(exc)}


def post_reddit(
    title: str,
    text: str,
    subreddit: str,
    client_id: str,
    client_secret: str,
    username: str,
    password: str,
) -> dict:
    """Submit a text post to Reddit using PRAW. Returns {"success", "url", "error"}."""
    try:
        import praw  # type: ignore

        reddit = praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            username=username,
            password=password,
            user_agent=f"xsantcastx-pipeline/1.0 by u/{username}",
        )
        submission = reddit.subreddit(subreddit).submit(title=title, selftext=text)
        return {"success": True, "url": submission.url, "error": ""}
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "url": "", "error": str(exc)}
