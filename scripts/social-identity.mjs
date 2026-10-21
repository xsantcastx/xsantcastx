/**
 * social-identity.mjs — who a Keeper is, and what the Hearth keeps about them (docs/design/online.md Phase 3).
 *
 * No dependencies (the hearth's image is one Node file and its neighbours; firebase-admin would bring a lockfile and
 * ~40 MB): Firebase ID tokens are checked with node:crypto against Google's published certificates, and Firestore is
 * spoken over its REST API with the Cloud Run service account's token from the metadata server.
 *
 *   firebaseVerifier  RS256 signature, `aud` = the project, `iss` = securetoken.google.com/<project>, not expired,
 *                     a subject. Anonymous Firebase users count as guests.
 *   firestoreStore    users/{uid}/meta/ban (the GM console's ban, the same doc firestore.rules' isBanned() reads),
 *                     users/{uid}/social/friends and …/blocks, player-reports/{id}. Service-account requests are
 *                     authorised by IAM (roles/datastore.user), not by the rules, so the rules can deny clients.
 *   memoryStore       the same contract in memory (the specs; a local room with no project).
 *   fakeVerifier      local e2e only (SOCIAL_FAKE_AUTH=1, refused on Cloud Run): a token `fake.<uid>.<name>`.
 */
import { X509Certificate, verify as verifySig } from 'node:crypto';

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const METADATA_TOKEN = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const UID = /^[A-Za-z0-9_-]{1,128}$/;

const b64json = part => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
const refuse = message => Object.assign(new Error(message), { status: 401 });

/** A verifier for one Firebase project's ID tokens: `(token) => Promise<{uid, anonymous}>`, throwing on anything off. */
export function firebaseVerifier({ projectId, fetch: get = fetch, now = Date.now } = {}) {
  if (!projectId) throw new Error('firebaseVerifier needs a projectId');
  let certs = null, certsUntil = 0;
  const keys = async () => {
    if (certs && now() < certsUntil) return certs;
    const res = await get(CERTS_URL);
    if (!res.ok) throw new Error('certificates unavailable');
    const body = await res.json();
    const age = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
    certs = Object.fromEntries(Object.entries(body).map(([kid, pem]) => [kid, new X509Certificate(pem).publicKey]));
    certsUntil = now() + Math.max(60, Math.min(age, 86400)) * 1000;
    return certs;
  };
  return async token => {
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 3) throw refuse('Malformed token.');
    let header, claims;
    try { header = b64json(parts[0]); claims = b64json(parts[1]); } catch { throw refuse('Malformed token.'); }
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw refuse('Unexpected token.');
    const key = (await keys())[header.kid];
    if (!key) throw refuse('Unknown signing key.');
    const ok = verifySig('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
    if (!ok) throw refuse('Bad signature.');
    const t = Math.floor(now() / 1000), skew = 60;
    if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) throw refuse('Wrong project.');
    if (!(claims.exp > t) || !(claims.iat <= t + skew) || !(claims.auth_time <= t + skew)) throw refuse('Expired token.');
    if (typeof claims.sub !== 'string' || !UID.test(claims.sub)) throw refuse('No subject.');
    return { uid: claims.sub, anonymous: claims.firebase?.sign_in_provider === 'anonymous' };
  };
}

/** Local e2e only: `fake.<uid>.<anything>`; never on Cloud Run (K_SERVICE is set there). */
export function fakeVerifier() {
  if (process.env.K_SERVICE) throw new Error('fake auth is refused on Cloud Run');
  return async token => {
    const m = /^fake\.([A-Za-z0-9_-]{1,64})(?:\..*)?$/.exec(token ?? '');
    if (!m) throw refuse('Malformed token.');
    return { uid: m[1], anonymous: false };
  };
}

// ── Stores ──────────────────────────────────────────────────────────────────

/** The contract both stores keep. Lists are `{ids: string[], names: Record<uid, name>}`. */
const emptyList = () => ({ ids: [], names: {} });

export function memoryStore() {
  const bans = new Set(), friends = new Map(), blocks = new Map(), reports = [];
  const list = (map, uid) => { if (!map.has(uid)) map.set(uid, emptyList()); return map.get(uid); };
  const add = (l, uid, name) => { if (!l.ids.includes(uid)) l.ids.push(uid); l.names[uid] = name; };
  const drop = (l, uid) => { l.ids = l.ids.filter(x => x !== uid); delete l.names[uid]; };
  const copy = l => ({ ids: [...l.ids], names: { ...l.names } });
  return {
    bans, reports,
    async banned(uid) { return bans.has(uid); },
    async friends(uid) { return copy(list(friends, uid)); },
    async blocks(uid) { return copy(list(blocks, uid)); },
    async addFriends(a, aName, b, bName) { add(list(friends, a), b, bName); add(list(friends, b), a, aName); },
    async removeFriends(a, b) { drop(list(friends, a), b); drop(list(friends, b), a); },
    async saveBlocks(uid, l) { blocks.set(uid, copy(l)); },
    async report(doc) { reports.push(doc); return `r${reports.length}`; },
  };
}

/** Firestore's typed values, both ways (only what these documents hold). */
export function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
}
export function fromValue(v) {
  if (!v || typeof v !== 'object') return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, fromValue(x)]));
  return undefined;
}
const field = key => `\`${key.replace(/[`\\]/g, '\\$&')}\``;

/** Firestore over REST with the service account (Cloud Run's metadata server hands out its token). */
export function firestoreStore({ projectId, fetch: get = fetch, now = Date.now, token: tokenSource } = {}) {
  if (!projectId) throw new Error('firestoreStore needs a projectId');
  const root = `projects/${projectId}/databases/(default)/documents`;
  const api = `https://firestore.googleapis.com/v1/${root}`;
  let bearer = null, bearerUntil = 0;
  const token = tokenSource ?? (async () => {
    if (bearer && now() < bearerUntil) return bearer;
    const res = await get(METADATA_TOKEN, { headers: { 'Metadata-Flavor': 'Google' } });
    if (!res.ok) throw new Error('no service-account token');
    const body = await res.json();
    bearer = body.access_token; bearerUntil = now() + Math.max(60, (body.expires_in ?? 300) - 60) * 1000;
    return bearer;
  });
  const call = async (url, init = {}) => {
    const res = await get(url, { ...init, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`firestore ${res.status}`);
    return res.json();
  };
  const readList = async path => {
    const doc = await call(`${api}/${path}`);
    const data = doc ? fromValue({ mapValue: { fields: doc.fields ?? {} } }) : {};
    const ids = Array.isArray(data.ids) ? data.ids.filter(x => typeof x === 'string' && UID.test(x)) : [];
    const names = data.names && typeof data.names === 'object' ? data.names : {};
    return { ids, names: Object.fromEntries(ids.map(id => [id, typeof names[id] === 'string' ? names[id] : 'Keeper'])) };
  };
  /** One side of a friendship, as a write for :commit (the names map entry and the ids array, nothing else touched). */
  const friendWrite = (owner, other, name) => ({
    update: { name: `${root}/users/${owner}/social/friends`, fields: { names: toValue({ [other]: name }), updatedAt: toValue(new Date(now())) } },
    updateMask: { fieldPaths: [`names.${field(other)}`, 'updatedAt'] },
    updateTransforms: [{ fieldPath: 'ids', appendMissingElements: { values: [toValue(other)] } }],
  });
  const unfriendWrite = (owner, other) => ({
    // In the mask but not in `fields`: the names entry is deleted.
    update: { name: `${root}/users/${owner}/social/friends`, fields: { updatedAt: toValue(new Date(now())) } },
    updateMask: { fieldPaths: [`names.${field(other)}`, 'updatedAt'] },
    updateTransforms: [{ fieldPath: 'ids', removeAllFromArray: { values: [toValue(other)] } }],
  });
  const commit = writes => call(`${api}:commit`, { method: 'POST', body: JSON.stringify({ writes }) });
  return {
    async banned(uid) {
      const doc = await call(`${api}/users/${uid}/meta/ban`);
      return !!doc && doc.fields?.banned?.booleanValue === true;
    },
    friends: uid => readList(`users/${uid}/social/friends`),
    blocks: uid => readList(`users/${uid}/social/blocks`),
    // Both sides in one commit: a friendship is never half-written.
    async addFriends(a, aName, b, bName) { await commit([friendWrite(a, b, bName), friendWrite(b, a, aName)]); },
    async removeFriends(a, b) { await commit([unfriendWrite(a, b), unfriendWrite(b, a)]); },
    async saveBlocks(uid, l) {
      await call(`${api}/users/${uid}/social/blocks`, { method: 'PATCH', body: JSON.stringify({ fields: { ids: toValue(l.ids), names: toValue(l.names), updatedAt: toValue(new Date(now())) } }) });
    },
    async report(doc) {
      const res = await call(`${api}/player-reports`, { method: 'POST', body: JSON.stringify({ fields: toValue({ ...doc, at: new Date(doc.at) }).mapValue.fields }) });
      return String(res?.name ?? '').split('/').pop();
    },
  };
}
