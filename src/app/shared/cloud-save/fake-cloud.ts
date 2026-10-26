/**
 * fake-cloud.ts — the local e2e's stand-in for Google sign-in and Firestore (localhost, a WebDriver browser, and
 * `eclipse-cloud-fake` = a uid in localStorage only; never on the site, and loaded only then, by dynamic import).
 *
 * Enough of `@angular/fire/auth` for CloudSaveService (popup, redirect, the persisted session, sign-out) and enough of
 * the Firestore API for the gateway, the lease and the reset stamp (doc, collection, get, set, delete, a batch, a
 * transaction), kept in localStorage (`eclipse-cloud-fake-db`) so it outlives a reload like the real cloud does.
 * `eclipse-cloud-fake-popup` = 'blocked' makes the popup unavailable, so sign-in takes the redirect path.
 */
const DB_KEY = 'eclipse-cloud-fake-db';
const SESSION_KEY = 'eclipse-cloud-fake-session';
const POPUP_KEY = 'eclipse-cloud-fake-popup';

type Doc = Record<string, unknown>;
const load = (): Record<string, Doc> => { try { return JSON.parse(localStorage.getItem(DB_KEY) ?? '{}'); } catch { return {}; } };
const save = (db: Record<string, Doc>): void => { localStorage.setItem(DB_KEY, JSON.stringify(db)); };
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const snapOf = (path: string, held: Doc | undefined) => ({ id: path.split('/').pop() ?? '', exists: () => held !== undefined, data: () => clone(held) });

export function fakeFirestore(): { db: object; api: Record<string, unknown> } {
  const api = {
    doc: (_db: unknown, ...seg: string[]) => ({ path: seg.join('/') }),
    collection: (_db: unknown, ...seg: string[]) => ({ path: seg.join('/') }),
    getDoc: async (ref: { path: string }) => snapOf(ref.path, load()[ref.path]),
    getDocs: async (ref: { path: string }) => {
      const prefix = ref.path + '/', db = load();
      const hits = Object.keys(db).filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'));
      return { forEach: (fn: (d: ReturnType<typeof snapOf>) => void) => hits.forEach(p => fn(snapOf(p, db[p]))), docs: hits.map(p => snapOf(p, db[p])), empty: !hits.length };
    },
    setDoc: async (ref: { path: string }, data: Doc, opts?: { merge?: boolean }) => { const db = load(); db[ref.path] = clone(opts?.merge ? { ...(db[ref.path] ?? {}), ...data } : data); save(db); },
    deleteDoc: async (ref: { path: string }) => { const db = load(); delete db[ref.path]; save(db); },
    writeBatch: () => {
      const staged: (() => void)[] = [];
      return {
        set: (ref: { path: string }, data: Doc, opts?: { merge?: boolean }) => { staged.push(() => { const db = load(); db[ref.path] = clone(opts?.merge ? { ...(db[ref.path] ?? {}), ...data } : data); save(db); }); },
        delete: (ref: { path: string }) => { staged.push(() => { const db = load(); delete db[ref.path]; save(db); }); },
        commit: async () => { for (const w of staged) w(); },
      };
    },
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const db = load();
      const out = await fn({
        get: async (ref: { path: string }) => snapOf(ref.path, db[ref.path]),
        set: (ref: { path: string }, d: Doc) => { db[ref.path] = clone(d); },
        update: (ref: { path: string }, d: Doc) => { db[ref.path] = { ...(db[ref.path] ?? {}), ...clone(d) }; },
        delete: (ref: { path: string }) => { delete db[ref.path]; },
      });
      save(db);
      return out;
    },
  };
  return { db: {}, api };
}

/** Enough of `@angular/fire/auth` for CloudSaveService, for user `uid`. */
export function fakeAuthModule(uid: string): unknown {
  const user = { uid, email: `${uid}@e2e.test`, displayName: uid, photoURL: null, getIdToken: async () => `fake.${uid}` };
  const signedIn = () => { try { return localStorage.getItem(SESSION_KEY) === uid; } catch { return false; } };
  const auth = { get currentUser() { return signedIn() ? user : null; } };
  class GoogleAuthProvider { setCustomParameters(): void { /* no account picker here */ } }
  return {
    getAuth: () => auth,
    GoogleAuthProvider,
    signInWithPopup: async () => {
      if (localStorage.getItem(POPUP_KEY) === 'blocked') throw Object.assign(new Error('popup blocked'), { code: 'auth/popup-blocked' });
      localStorage.setItem(SESSION_KEY, uid);
      return { user };
    },
    signInWithRedirect: async () => { localStorage.setItem(SESSION_KEY, uid); setTimeout(() => location.reload(), 50); await new Promise(() => undefined); },
    getRedirectResult: async () => (signedIn() ? { user } : null),
    onAuthStateChanged: (_a: unknown, next: (u: unknown) => void) => { setTimeout(() => next(signedIn() ? user : null)); return () => undefined; },
    signOut: async () => { localStorage.removeItem(SESSION_KEY); },
  };
}
