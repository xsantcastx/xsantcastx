"""Regression tests for pipeline.agents.deploy._configure_git.

Background — daily-pipeline.yml runs #36–#43 (8 consecutive runs, 2026-04-17
to 2026-04-24) failed with "could not read Username for 'https://github.com':
terminal prompts disabled". Root cause: when the GH_PAT secret was missing
or empty, the original ``_configure_git`` silently no-op'd the remote-url
rewrite, leaving git with no embedded credentials and prompting interactively
in a non-interactive runner.

Fix: prefer GH_PAT, fall back to GITHUB_TOKEN, raise loudly with a clear
actionable message if both are missing/empty. These tests pin that contract.

Run: ``pytest pipeline/tests/`` or ``python -m unittest discover pipeline``.
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import call, patch

# pipeline/ is not installed as a package; make its top-level importable.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agents import deploy as d  # noqa: E402  (path-mangled import)


class ConfigureGitTests(unittest.TestCase):
    """Pin the GH_PAT → GITHUB_TOKEN → RuntimeError fallback chain."""

    def setUp(self) -> None:
        # _git is the only side-effecting call inside _configure_git; mock it
        # so tests don't touch the real .git directory.
        self.git_patch = patch.object(d, "_git")
        self.mock_git = self.git_patch.start()
        # Wipe env so each test starts from a known-empty baseline.
        self.env_patch = patch.dict(os.environ, {}, clear=True)
        self.env_patch.start()

    def tearDown(self) -> None:
        self.git_patch.stop()
        self.env_patch.stop()

    def test_uses_gh_pat_when_set(self) -> None:
        os.environ["GH_PAT"] = "pat-abc"
        os.environ["GH_REPO"] = "x/y"

        d._configure_git()

        self.assertEqual(
            self.mock_git.call_args_list[-1],
            call(
                "remote",
                "set-url",
                "origin",
                "https://x-access-token:pat-abc@github.com/x/y.git",
            ),
        )

    def test_falls_back_to_github_token_when_gh_pat_unset(self) -> None:
        os.environ["GITHUB_TOKEN"] = "ghs-xyz"

        d._configure_git()

        self.assertIn("ghs-xyz", self.mock_git.call_args_list[-1].args[3])

    def test_prefers_gh_pat_over_github_token(self) -> None:
        os.environ["GH_PAT"] = "pat-pref"
        os.environ["GITHUB_TOKEN"] = "ghs-fallback"

        d._configure_git()

        last = self.mock_git.call_args_list[-1]
        self.assertIn("pat-pref", last.args[3])
        self.assertNotIn("ghs-fallback", last.args[3])

    def test_treats_whitespace_only_pat_as_empty(self) -> None:
        # Common CI quirk — secret expands to a stray space when unset.
        os.environ["GH_PAT"] = "   "
        os.environ["GITHUB_TOKEN"] = "ghs-real"

        d._configure_git()

        self.assertIn("ghs-real", self.mock_git.call_args_list[-1].args[3])

    def test_raises_when_both_missing(self) -> None:
        with self.assertRaises(RuntimeError) as cm:
            d._configure_git()
        msg = str(cm.exception)

        # Message must name both env vars and point at the workflow file so a
        # human (or downstream agent) reading CI logs has a one-glance fix.
        self.assertIn("GH_PAT", msg)
        self.assertIn("GITHUB_TOKEN", msg)
        self.assertIn("daily-pipeline.yml", msg)

    def test_raises_when_both_empty_string(self) -> None:
        os.environ["GH_PAT"] = ""
        os.environ["GITHUB_TOKEN"] = ""

        with self.assertRaises(RuntimeError):
            d._configure_git()

    def test_uses_default_repo_when_gh_repo_unset(self) -> None:
        os.environ["GH_PAT"] = "pat-only"
        # GH_REPO intentionally absent — should default to xsantcastx/xsantcastx.

        d._configure_git()

        self.assertIn(
            "xsantcastx/xsantcastx.git",
            self.mock_git.call_args_list[-1].args[3],
        )


if __name__ == "__main__":  # pragma: no cover
    unittest.main(verbosity=2)
