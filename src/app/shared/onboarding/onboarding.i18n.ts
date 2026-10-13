/**
 * onboarding.i18n.ts: the tutorial's "walk into the world" door. Lazy:
 * registered by the onboarding component (its own chunk), checked by
 * scripts/check-i18n-keys.js. The rest of the tutorial's copy is older and
 * still sits in the eager table.
 */
export const ONBOARDING_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'onboarding.door.world.title': { en: 'Enter the world', es: 'Entra en el mundo' },
  'onboarding.door.world.body': { en: 'Walk the Basalt Seamworks. A goal line at the top shows your next step: buy a building, defeat a Maw, forge a blade, dig the Delve.', es: 'Recorre Basalt Seamworks. Una linea de objetivo arriba te dice el siguiente paso: compra un edificio, derrota una Fauce, forja una hoja, excava la Sima.' },
};
