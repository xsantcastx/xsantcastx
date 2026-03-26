#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook
 * Writes real tool call events to Firestore → live page activity feed
 */
'use strict';

const https = require('https');
const os    = require('os');
const path  = require('path');
const fs    = require('fs');

const PROJECT_ID   = 'xsantcastx-1694b';
const API_KEY      = 'AIzaSyAABzajHVAd6NbLjMGk4IIVA9pB1T-P7To';
const COLLECTION   = 'claude-activity';
const SESSION_FILE = path.join(os.tmpdir(), 'claude-live-session.json');
const MAX_ENTRIES  = 200; // keep at most this many docs (pruned on new session)

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSessionState() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); }
  catch { return { lastSessionId: null }; }
}

function saveSessionState(state) {
  try { fs.writeFileSync(SESSION_FILE, JSON.stringify(state)); } catch {}
}

const short   = (s, n = 60) => (s || '').substring(0, n);
const relPath = (p) => (p || '').split('/').slice(-2).join('/');

function buildText(tool, input = {}) {
  switch (tool) {
    case 'Read':      return `Read("${relPath(input.file_path)}")`;
    case 'Write':     return `Write("${relPath(input.file_path)}")`;
    case 'Edit':      return `Edit("${relPath(input.file_path)}")`;
    case 'Bash':      return `Bash("${short(input.command, 55)}")`;
    case 'Grep':      return `Grep("${short(input.pattern, 40)}")`;
    case 'Glob':      return `Glob("${short(input.pattern, 40)}")`;
    case 'Agent':     return `Agent("${short(input.description, 50)}")`;
    case 'WebFetch':  return `WebFetch("${short(input.url, 50)}")`;
    case 'TodoWrite': return `TodoWrite(${(input.todos || []).length} items)`;
    default:          return `${tool}(...)`;
  }
}

function buildDetail(tool, input = {}, response = {}) {
  const isError = response.is_error;
  const text    = (response.content?.[0]?.text ?? response.output ?? '');

  switch (tool) {
    case 'Read': {
      const lines = text.split('\n').length;
      return lines > 1 ? `→ ${lines} lines read` : null;
    }
    case 'Write': {
      const lines = (input.content || '').split('\n').length;
      return `→ ${lines} lines written`;
    }
    case 'Edit':
      return isError ? '→ error applying changes' : '→ changes applied';
    case 'Bash':
      return isError ? '→ exit error' : '→ done';
    case 'Grep': {
      const lines = text.split('\n').filter(Boolean).length;
      return lines > 0 ? `→ ${lines} match${lines !== 1 ? 'es' : ''}` : '→ no matches';
    }
    case 'Glob': {
      const files = text.split('\n').filter(Boolean).length;
      return files > 0 ? `→ ${files} file${files !== 1 ? 's' : ''} found` : null;
    }
    case 'Agent':
      return isError ? '→ sub-agent failed' : '→ sub-agent complete';
    default:
      return null;
  }
}

// ── Firestore REST helpers ────────────────────────────────────────────────────

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function httpsRequest(options, body) {
  return new Promise((resolve) => {
    const req = https.request({ ...options, timeout: 6000 }, (res) => {
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

function firestorePost(fields) {
  const body = JSON.stringify({ fields });
  return httpsRequest({
    hostname: 'firestore.googleapis.com',
    path:     `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}?key=${API_KEY}`,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
}

/**
 * List document names in COLLECTION so we can prune old ones.
 * Returns array of full resource names like "projects/.../documents/claude-activity/docId"
 */
async function listDocNames() {
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path:     `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}?pageSize=300&key=${API_KEY}`,
    method:   'GET',
    headers:  { 'Content-Type': 'application/json' }
  }, null);
  if (!res) return [];
  try {
    const json = JSON.parse(res.data);
    return (json.documents || []).map(d => d.name);
  } catch { return []; }
}

async function firestoreDelete(docName) {
  const shortName = docName.replace('projects/', '/projects/');
  return httpsRequest({
    hostname: 'firestore.googleapis.com',
    path:     `/v1${shortName}?key=${API_KEY}`,
    method:   'DELETE',
    headers:  {}
  }, null);
}

// ── Agent status + bot comms helpers ─────────────────────────────────────────

function firestorePut(collection, docId, fields) {
  const body = JSON.stringify({ fields });
  return httpsRequest({
    hostname: 'firestore.googleapis.com',
    path:     `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?key=${API_KEY}`,
    method:   'PATCH',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
}

function postComms(botName, botId, message) {
  const body = JSON.stringify({
    fields: {
      botName:   { stringValue: botName },
      botId:     { stringValue: botId },
      message:   { stringValue: message },
      timestamp: { timestampValue: new Date().toISOString() }
    }
  });
  return httpsRequest({
    hostname: 'firestore.googleapis.com',
    path:     `/v1/projects/${PROJECT_ID}/databases/(default)/documents/agent-comms?key=${API_KEY}`,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
}

// Track tool call count per session for progress estimation
const PROGRESS_FILE = path.join(os.tmpdir(), 'claude-live-progress.json');

function getProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return { toolCalls: 0, task: '' }; }
}

function saveProgress(data) {
  try { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data)); } catch {}
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Read stdin
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;

  let event;
  try { event = JSON.parse(raw); }
  catch { process.exit(0); }

  const { tool_name, tool_input = {}, tool_response = {}, session_id } = event;
  if (!tool_name) process.exit(0);

  const now = new Date().toISOString();
  const toPost = [];
  const commsQueue = [];

  // Detect new session → emit "Session initialized" system entry + prune old docs
  const state = getSessionState();
  if (state.lastSessionId !== session_id) {
    saveSessionState({ lastSessionId: session_id });
    saveProgress({ toolCalls: 0, task: 'New session' });

    toPost.push({
      type:      { stringValue: 'system' },
      tool:      { stringValue: '' },
      text:      { stringValue: 'Session initialized — Claude Sonnet 4.6' },
      timestamp: { timestampValue: now },
      sessionId: { stringValue: session_id || 'unknown' }
    });

    // Post bot comms for session start
    commsQueue.push(['ClaudeOps', 'ops', 'New session initialized. Scanning workspace...']);
    commsQueue.push(['ClaudeReview', 'review', 'Review agent online. Standing by.']);

    // Update agent status — new session
    firestorePut('agent-status', 'current', {
      task:      { stringValue: 'Initializing session...' },
      progress:  { integerValue: '0' },
      agent:     { stringValue: 'ClaudeOps' },
      isActive:  { booleanValue: true },
      timestamp: { timestampValue: now },
    }).catch(() => {});

    // Prune old entries async (don't await — don't block the hook)
    listDocNames().then(async (names) => {
      if (names.length > MAX_ENTRIES) {
        const toDelete = names.slice(0, names.length - MAX_ENTRIES);
        for (const name of toDelete) await firestoreDelete(name);
      }
    }).catch(() => {});
  }

  // Track progress
  const progress = getProgress();
  progress.toolCalls++;

  // Build the tool_call entry
  const text   = buildText(tool_name, tool_input);
  const detail = buildDetail(tool_name, tool_input, tool_response);

  const fields = {
    type:      { stringValue: 'tool_call' },
    tool:      { stringValue: tool_name },
    text:      { stringValue: text },
    timestamp: { timestampValue: now },
    sessionId: { stringValue: session_id || 'unknown' }
  };
  if (detail) fields.detail = { stringValue: detail };

  toPost.push(fields);

  // Derive current task from TodoWrite calls
  if (tool_name === 'TodoWrite' && tool_input.todos?.length > 0) {
    const inProgress = tool_input.todos.find(t => t.status === 'in_progress');
    const completed  = tool_input.todos.filter(t => t.status === 'completed').length;
    const total      = tool_input.todos.length;
    const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;
    const taskName   = inProgress?.activeForm || inProgress?.content || 'Processing...';

    progress.task = taskName;

    // Update agent-status with task info
    firestorePut('agent-status', 'current', {
      task:      { stringValue: taskName },
      progress:  { integerValue: String(pct) },
      agent:     { stringValue: 'ClaudeOps' },
      isActive:  { booleanValue: true },
      timestamp: { timestampValue: now },
    }).catch(() => {});

    commsQueue.push(['ClaudeOps', 'ops', `Task: ${taskName} (${pct}%)`]);
    if (completed > 0) {
      commsQueue.push(['ClaudeAnalytics', 'analytics', `Progress: ${completed}/${total} steps complete`]);
    }
  }

  // Bot comms for interesting tool calls
  if (tool_name === 'Bash' && tool_input.command) {
    const cmd = tool_input.command;
    if (cmd.includes('npm run build') || cmd.includes('ng build')) {
      commsQueue.push(['ClaudeReview', 'review', 'Build triggered. Monitoring output...']);
    } else if (cmd.includes('firebase deploy')) {
      commsQueue.push(['ClaudeOps', 'ops', 'Deploying to Firebase hosting...']);
    } else if (cmd.includes('git push')) {
      commsQueue.push(['ClaudeOps', 'ops', 'Pushing changes to remote...']);
    }
  }

  if (tool_name === 'Write') {
    const fp = relPath(tool_input.file_path || '');
    commsQueue.push(['ClaudeReview', 'review', `New file: ${fp}. Queued for review.`]);
  }

  // Update progress tracking
  saveProgress(progress);

  // Post activity entries in order
  for (const f of toPost) await firestorePost(f);

  // Post bot comms (fire and forget — don't block hook exit)
  for (const [bn, bi, msg] of commsQueue) {
    postComms(bn, bi, msg).catch(() => {});
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
