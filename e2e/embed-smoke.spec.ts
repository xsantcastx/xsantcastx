import { test, expect } from '@playwright/test';

// A-4: Embed surface smoke tests.
// Routes are prerendered so plain static serving is sufficient.

const embedRoutes = [
  { path: '/embed/json-formatter', component: 'app-json-formatter' },
  { path: '/embed/gradient-generator', component: 'app-gradient-generator' },
  { path: '/embed/uuid-generator', component: 'app-uuid-generator' },
];

for (const { path, component } of embedRoutes) {
  test(`embed smoke: ${path} renders ${component}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    // 'load' not 'networkidle' — SPAs with long-polling never reach networkidle in WebKit
    await page.goto(path, { waitUntil: 'load' });

    // Wait for the tool component to be in DOM (prerendered SSR or hydrated)
    await expect(page.locator(component).first()).toBeAttached({ timeout: 10000 });

    // Only fail on real JS errors (TypeError, ReferenceError, Angular ERROR).
    // Filter all network/HTTP/third-party noise.
    const realErrors = consoleErrors.filter(
      e => !e.match(/403|404|Failed to load resource|net::|firestore|googleapis|google-analytics|carbonads|firebase|stripe|favicon/i),
    );

    expect(realErrors, `JS errors on ${path}: ${realErrors.join('; ')}`).toHaveLength(0);
  });
}
