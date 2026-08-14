/**
 * continue-journey.ts — one deterministic next place, derived from static order.
 *
 * No visit history, no saved choice, no profile field. A new local profile and
 * a loaded profile receive the same destination until opening chapters exist.
 */
import {
  FIVE_REALMS,
  FIVEFOLD_LOCK,
  OPENING_REALM_ORDER,
  type NarrativeRealm,
  type NarrativeRealmId,
  isNarrativeRealmId,
  realmHref,
} from './five-realms.narrative';

export interface ContinueJourney {
  route: string;
  label: string;
  note: string;
  realmId: NarrativeRealmId | typeof FIVEFOLD_LOCK.id;
}

/** World’s single Continue Journey action: the opening arc begins in Luminous. */
export function continueFromWorld(): ContinueJourney {
  const luminous = FIVE_REALMS[0];
  return {
    route: realmHref(luminous.id),
    label: `Enter ${luminous.name}`,
    note: `${luminous.chapterTitle} is not yet playable. The ${luminous.landmark} can be inspected.`,
    realmId: luminous.id,
  };
}

/** From a realm dossier, the next inspectable place in the approved order. */
export function continueFromRealm(realm: NarrativeRealm): ContinueJourney {
  if (realm.nextRealmId === FIVEFOLD_LOCK.id) {
    return {
      route: FIVEFOLD_LOCK.route,
      label: FIVEFOLD_LOCK.name,
      note: FIVEFOLD_LOCK.status,
      realmId: FIVEFOLD_LOCK.id,
    };
  }
  const next = FIVE_REALMS.find(item => item.id === realm.nextRealmId)!;
  return {
    route: realmHref(next.id),
    label: `Continue to ${next.name}`,
    note: `${next.chapterTitle} is not yet playable. Inspect the ${next.landmark} next.`,
    realmId: next.id,
  };
}

export function continueFromRealmId(id: string | null | undefined): ContinueJourney | null {
  if (!isNarrativeRealmId(id)) return null;
  const realm = FIVE_REALMS.find(item => item.id === id);
  return realm ? continueFromRealm(realm) : null;
}

export function openingIndex(id: NarrativeRealmId): number {
  return OPENING_REALM_ORDER.indexOf(id);
}
