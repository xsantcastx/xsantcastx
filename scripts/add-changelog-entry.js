#!/usr/bin/env node
/**
 * Add a single changelog entry to Firestore via REST API.
 *
 * Usage:
 *   node scripts/add-changelog-entry.js "Title here" "Details here" "category" "2026-03-29"
 *
 * Args:
 *   1. title    — short headline (e.g. "Mobile tools grid + touch UX overhaul")
 *   2. details  — one-liner with specifics
 *   3. category — one of: feature, fix, infrastructure, UX
 *   4. date     — ISO date string YYYY-MM-DD (defaults to today)
 */

const https = require("https");

const PROJECT_ID = "xsantcastx-1694b";
const API_KEY = "AIzaSyAABzajHVAd6NbLjMGk4IIVA9pB1T-P7To";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/changelog`;

const [,, title, details, category = "feature", dateStr] = process.argv;

if (!title || !details) {
  console.error("Usage: node scripts/add-changelog-entry.js <title> <details> [category] [YYYY-MM-DD]");
  process.exit(1);
}

const entryDate = dateStr ? new Date(dateStr + "T00:00:00Z") : new Date();
entryDate.setUTCHours(0, 0, 0, 0);

const fields = {
  date:      { timestampValue: entryDate.toISOString() },
  title:     { stringValue: title },
  details:   { stringValue: details },
  category:  { stringValue: category },
  project:   { stringValue: "xsantcastx" },
  createdAt: { timestampValue: new Date().toISOString() },
};

const body = JSON.stringify({ fields });
const url = new URL(`${BASE_URL}?key=${API_KEY}`);

const req = https.request({
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
}, (res) => {
  let data = "";
  res.on("data", (c) => (data += c));
  res.on("end", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const doc = JSON.parse(data);
      console.log(`✓ Changelog entry created: "${title}" → ${doc.name.split("/").pop()}`);
    } else {
      console.error(`✗ Failed (HTTP ${res.statusCode}):`, data.substring(0, 300));
      process.exit(1);
    }
  });
});

req.on("error", (e) => {
  console.error("✗ Network error:", e.message);
  process.exit(1);
});
req.write(body);
req.end();
