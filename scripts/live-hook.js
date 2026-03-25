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

  // Detect new session → emit "Session initialized" system entry + prune old docs
  const state = getSessionState();
  if (state.lastSessionId !== session_id) {
    saveSessionState({ lastSessionId: session_id });

    toPost.push({
      type:      { stringValue: 'system' },
      tool:      { stringValue: '' },
      text:      { stringValue: 'Session initialized — Claude Sonnet 4.6' },
      timestamp: { timestampValue: now },
      sessionId: { stringValue: session_id || 'unknown' }
    });

    // Prune old entries async (don't await — don't block the hook)
    listDocNames().then(async (names) => {
      if (names.length > MAX_ENTRIES) {
        const toDelete = names.slice(0, names.length - MAX_ENTRIES);
        for (const name of toDelete) await firestoreDelete(name);
      }
    }).catch(() => {});
  }

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

  // Post entries in order
  for (const f of toPost) await firestorePost(f);

  process.exit(0);
}

main().catch(() => process.exit(0));
