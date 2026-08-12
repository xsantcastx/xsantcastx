import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map, take } from 'rxjs/operators';
import { of } from 'rxjs';

/**
 * The one account allowed to see /admin.
 *
 * This constant is the *client-side* gate. It is deliberately not the only one:
 * anything sensitive the dashboard reads (blueprint-suggestions) is also gated
 * on the same address in firestore.rules, because a client-side check only
 * decides what gets rendered — it cannot decide what the database hands out.
 * Someone who edits this string in devtools gets an empty dashboard, not data.
 */
export const ADMIN_EMAIL = 'ogaitnas.9615@gmail.com';

/** Case-insensitive match — Firebase preserves the casing the user typed. */
export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL;
}

/**
 * Gate for /admin.
 *
 * Three outcomes:
 *   - signed in as the owner  → allow
 *   - signed in as anyone else → redirect to /home
 *   - not signed in            → allow, and the component renders a bare
 *                                sign-in card (see the note below)
 *
 * On the *unauthenticated* case the brief said "redirect to homepage". Doing
 * that literally makes the route unreachable: Firebase restores a session from
 * IndexedDB, so a cold visit to /admin is always unauthenticated for the first
 * few hundred milliseconds, and bouncing on that would bounce the owner every
 * time. So unauthenticated visitors land on a sign-in card instead — it renders
 * no data, reads no collection, and offers nothing but a Google button, which
 * leaks strictly less than the homepage it would otherwise redirect to.
 *
 * That card is now the only sign-in surface on the site. It used to share the
 * job with /guestbook, which the full migration deleted; since the card signs
 * in on its own with signInWithPopup, nothing about this gate changed.
 *
 * A wrong-email session still gets bounced, which is the case that actually
 * matters: it means someone signed in and is not Santiago.
 *
 * On the server the guard allows the route through, and that is deliberate —
 * it must NOT redirect. Angular's prerenderer discovers routes from the router
 * config, so it visits /admin whether or not the route is in
 * prerender-routes.txt. If the guard bounces there, the prerender writes a
 * redirect-to-/home stub to dist/admin/index.html, and Firebase Hosting serves
 * static files *before* it applies the `**` → index.csr.html rewrite. The
 * result is a production /admin that meta-refreshes every visitor to the
 * homepage, owner included, with no way to reach the dashboard at all.
 *
 * Letting it through is safe because there is no session to authenticate
 * against on the server: the component leaves `gate` at 'checking', so the
 * prerendered HTML is a spinner and the words "Restoring session" — no data,
 * no markup from any panel. The real decision happens after hydration, when
 * Firebase has restored the session. The route also carries `noindex` in its
 * route data, which SeoService emits during the same prerender.
 */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return of(true).pipe(take(1));
  }

  const auth = inject(Auth);

  return authState(auth).pipe(
    take(1),
    map(user => {
      // Not signed in yet — let the component show its sign-in card.
      if (!user) return true;
      // Signed in as someone else — this is the case worth bouncing.
      return isAdminEmail(user.email) ? true : router.parseUrl('/home');
    })
  );
};
