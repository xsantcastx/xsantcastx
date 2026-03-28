/**
 * Seed script: populates Firestore `changelog` collection with xsantcastx entries.
 * Run with: node scripts/seed-changelog.js
 * Requires: firebase-admin, GOOGLE_APPLICATION_CREDENTIALS or service account key
 */

const admin = require('firebase-admin');

const PROJECT_ID = 'xsantcastx-1694b';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();

const entries = [
  // March 28, 2026
  {
    date: new Date('2026-03-28'),
    title: 'Tool QA — 13 tools tested, 11 healthy, 2 known bugs tracked',
    details: 'Automated QA agent tested all 13 live tools via Chrome. JSON Formatter, Base64 Encoder, Regex Tester, Color Palette Extractor, Contrast Checker, Image Compressor, Gmail Deliverability Checker, Box Shadow Generator, Email Deliverability Auditor, SSL Certificate Inspector, and PDF Catalog Generator all passed. SVG to Code Converter has i18n key display bug. SSL Certificate Auditor needs styling update.',
    category: 'infrastructure',
    project: 'xsantcastx',
    createdAt: new Date(),
  },
  {
    date: new Date('2026-03-28'),
    title: 'Homepage changelog rebuilt with Firestore backend',
    details: 'Replaced hardcoded changelog array with Firestore-backed system. Entries grouped by day, expandable detail view, filtered to xsantcastx-only updates.',
    category: 'feature',
    project: 'xsantcastx',
    createdAt: new Date(),
  },
  // March 27, 2026
  {
    date: new Date('2026-03-27'),
    title: 'heroCarouselTools fix — correct tools now cycle in carousel',
    details: 'Fixed hero carousel to use tool IDs instead of fragile array indices. PDF Generator and other tools now correctly appear in the rotation.',
    category: 'fix',
    project: 'xsantcastx',
    createdAt: new Date(),
  },
  {
    date: new Date('2026-03-27'),
    title: 'SSR isPlatformBrowser guards added to 5 tool components',
    details: 'Added platform browser checks to 5 tools that were failing during server-side rendering. Prevents DOM API errors during prerendering.',
    category: 'fix',
    project: 'xsantcastx',
    createdAt: new Date(),
  },
  {
    date: new Date('2026-03-27'),
    title: 'CI upgraded to Node 22',
    details: 'Upgraded GitHub Actions CI pipeline from Node 20 to Node 22. Eliminates deprecation warnings and ensures compatibility with latest dependencies.',
    category: 'infrastructure',
    project: 'xsantcastx',
    createdAt: new Date(),
  },
];

async function seed() {
  const col = db.collection('changelog');
  for (const entry of entries) {
    const ref = await col.add({
      ...entry,
      date: admin.firestore.Timestamp.fromDate(entry.date),
      createdAt: admin.firestore.Timestamp.fromDate(entry.createdAt),
    });
    console.log(`Added: ${entry.title} (${ref.id})`);
  }
  console.log(`\nSeeded ${entries.length} entries to changelog collection.`);
}

seed().catch(console.error);
