import { deleteApp, getApp, getApps, initializeApp } from 'firebase/app';
import { environment } from '../environments/environment';
import { ensureFirebaseApp } from './app-check.bootstrap';

describe('ensureFirebaseApp', () => {
  afterEach(async () => {
    await Promise.all(getApps().map(app => deleteApp(app)));
  });

  it('creates the default app when none exists yet', () => {
    expect(getApps().length).toBe(0);
    const app = ensureFirebaseApp();
    expect(app.name).toBe('[DEFAULT]');
    expect(getApps().length).toBe(1);
    expect(getApp()).toBe(app);
  });

  it('reuses the existing default app instead of throwing', () => {
    const existing = initializeApp(environment.firebase);
    const reused = ensureFirebaseApp();
    expect(reused).toBe(existing);
    expect(getApps().length).toBe(1);
  });
});
