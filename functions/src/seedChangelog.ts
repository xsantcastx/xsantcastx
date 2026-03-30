import { onRequest } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

export const seedChangelog = onRequest(
  { cors: true },
  async (_request, response) => {
    const entries = [
      {
        date: Timestamp.fromDate(new Date("2026-03-28")),
        title: "Firestore-backed changelog system",
        details:
          "Replaced hardcoded changelog with live Firestore data. Entries grouped by day with expandable details.",
        category: "feature",
        project: "xsantcastx",
        createdAt: FieldValue.serverTimestamp(),
      },
      {
        date: Timestamp.fromDate(new Date("2026-03-28")),
        title: "Tool QA — 13 tools tested, 11 healthy",
        details:
          "Automated QA tested all 13 live tools via Chrome. SVG to Code Converter has i18n display bug. SSL Auditor needs styling update.",
        category: "infrastructure",
        project: "xsantcastx",
        createdAt: FieldValue.serverTimestamp(),
      },
      {
        date: Timestamp.fromDate(new Date("2026-03-28")),
        title: "Homepage changelog deployed to production",
        details:
          "11 new changelog entries added and deployed via Firebase CI.",
        category: "feature",
        project: "xsantcastx",
        createdAt: FieldValue.serverTimestamp(),
      },
      {
        date: Timestamp.fromDate(new Date("2026-03-27")),
        title: "heroCarouselTools fix — correct tools cycling",
        details:
          "Fixed hero carousel to use tool IDs instead of fragile array indices.",
        category: "fix",
        project: "xsantcastx",
        createdAt: FieldValue.serverTimestamp(),
      },
      {
        date: Timestamp.fromDate(new Date("2026-03-27")),
        title: "SSR isPlatformBrowser guards added",
        details:
          "Added platform browser checks to 5 tools that were failing during server-side rendering.",
        category: "fix",
        project: "xsantcastx",
        createdAt: FieldValue.serverTimestamp(),
      },
      {
        date: Timestamp.fromDate(new Date("2026-03-27")),
        title: "CI upgraded to Node 22",
        details:
          "GitHub Actions CI upgraded from Node 20 to Node 22. Eliminates deprecation warnings.",
        category: "infrastructure",
        project: "xsantcastx",
        createdAt: FieldValue.serverTimestamp(),
      },
      {
        date: Timestamp.fromDate(new Date("2026-03-27")),
        title: "Button typography standardized",
        details:
          "All buttons now use Source Sans 3, weight 600, tracking-widest per Brand Bible Zone 3/3b specs.",
        category: "fix",
        project: "xsantcastx",
        createdAt: FieldValue.serverTimestamp(),
      },
    ];

    const batch = db.batch();
    for (const entry of entries) {
      const ref = db.collection("changelog").doc();
      batch.set(ref, entry);
    }
    await batch.commit();

    response.json({
      success: true,
      count: entries.length,
      message: `Seeded ${entries.length} changelog entries.`,
    });
  }
);
