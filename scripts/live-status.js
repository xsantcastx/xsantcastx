#!/usr/bin/env node
/**
 * Agent status updater — writes current task info to Firestore
 * so the /live page can display real mission status.
 *
 * Usage:
 *   node scripts/live-status.js <action> [args...]
 *
 * Actions:
 *   task  <name> <progress> <agent>    — Update current task
 *   comms <botName> <botId> <message>  — Post a bot comms message
 *   done  <summary>                    — Mark task complete + post comms
 *   idle                               — Clear active status
 *
 * Examples:
 *   node scripts/live-status.js task "Building JWT Decoder" 45 "ClaudeOps"
 *   node scripts/live-status.js comms "ClaudeOps" "ops" "Starting workspace scan"
 *   node scripts/live-status.js done "JWT Decoder built and compiled"
 *   node scripts/live-status.js idle
 */
'use strict';

const https = require('https');

const PROJECT_ID = 'xsantcastx-1694b';
const API_KEY    = 'AIzaSyAABzajHVAd6NbLjMGk4IIVA9pB1T-P7To';
const FS_BASE    = `/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Firestore REST helpers ──────────────────────────────────────────────────

function httpsRequest(options, body) {
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'firestore.googleapis.com', timeout: 6000, ...options }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error',   () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    if (body) req.write(body);
    req.end();
  });
}

/** PATCH (upsert) a named document */
async function fsPut(collection, docId, fields) {
  const body = JSON.stringify({ fields });
  return httpsRequest({
    path:    `${FS_BASE}/${collection}/${docId}?key=${API_KEY}`,
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
}

/** POST a new auto-ID document */
async function fsPost(collection, fields) {
  const body = JSON.stringify({ fields });
  return httpsRequest({
    path:    `${FS_BASE}/${collection}?key=${API_KEY}`,
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
}

// ── Actions ─────────────────────────────────────────────────────────────────

const now = () => ({ timestampValue: new Date().toISOString() });
const str = (v) => ({ stringValue: String(v || '') });
const int = (v) => ({ integerValue: String(Math.round(Number(v) || 0)) });
const bool = (v) => ({ booleanValue: !!v });

async function updateTask(taskName, progress, agent) {
  await fsPut('agent-status', 'current', {
    task:      str(taskName),
    progress:  int(progress),
    agent:     str(agent || 'ClaudeOps'),
    isActive:  bool(true),
    timestamp: now(),
  });
  console.log(`✓ Status updated: "${taskName}" @ ${progress}%`);
}

async function postComms(botName, botId, message) {
  await fsPost('agent-comms', {
    botName:   str(botName),
    botId:     str(botId),
    message:   str(message),
    timestamp: now(),
  });
  console.log(`✓ Comms posted: [${botName}] ${message}`);
}

async function markDone(summary) {
  await fsPut('agent-status', 'current', {
    task:      str(summary || 'Task complete'),
    progress:  int(100),
    agent:     str('ClaudeOps'),
    isActive:  bool(false),
    timestamp: now(),
  });
  await postComms('ClaudeOps', 'ops', `✓ Complete: ${summary || 'Task finished'}`);
  console.log(`✓ Task marked done: "${summary}"`);
}

async function markIdle() {
  await fsPut('agent-status', 'current', {
    task:      str('Awaiting next mission...'),
    progress:  int(0),
    agent:     str('ClaudeOps'),
    isActive:  bool(false),
    timestamp: now(),
  });
  console.log('✓ Status set to idle');
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const [,, action, ...args] = process.argv;

  switch (action) {
    case 'task':
      await updateTask(args[0], args[1], args[2]);
      break;
    case 'comms':
      await postComms(args[0] || 'ClaudeOps', args[1] || 'ops', args[2] || '...');
      break;
    case 'done':
      await markDone(args[0]);
      break;
    case 'idle':
      await markIdle();
      break;
    default:
      console.error('Usage: live-status.js <task|comms|done|idle> [args...]');
      process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
