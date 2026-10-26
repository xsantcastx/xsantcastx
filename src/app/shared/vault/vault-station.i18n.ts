/**
 * vault-station.i18n.ts — the Vault station's copy (inventory spec §5.4).
 * Lazy: registered by VaultStationComponent, checked by scripts/check-i18n-keys.js.
 * Namespace `vault.*`. Never name a file `vault.<x>.ts`: a backticked file name
 * in a comment would read as a missing key.
 */
export const VAULT_STATION_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'vault.title': { en: 'The Vault', es: 'La Bóveda' },
  'vault.purpose': { en: 'Drag things between your satchel and the stash. Nothing comes here by itself.', es: 'Arrastra cosas entre tu mochila y el baul. Nada llega aqui por si solo.' },
  'vault.tabs': { en: 'Vault tabs', es: 'Pestañas de la Bóveda' },
  'vault.tab.general-1': { en: 'General I', es: 'General I' },
  'vault.tab.general-2': { en: 'General II', es: 'General II' },
  'vault.tab.general-3': { en: 'General III', es: 'General III' },
  'vault.tab.general-4': { en: 'General IV', es: 'General IV' },
  'vault.tab.materials': { en: 'Materials', es: 'Materiales' },
  'vault.tab.supplies': { en: 'Supplies', es: 'Suministros' },
  'vault.tab.gear': { en: 'Gear', es: 'Equipo' },
  'vault.tab.overflow': { en: 'Overflow', es: 'Desborde' },
  'vault.strip.satchel': { en: 'Satchel', es: 'Mochila' },
  'vault.strip.vault': { en: 'Vault · {{tab}}', es: 'Bóveda · {{tab}}' },
  'vault.hint.locked': { en: 'Not yours yet. Buy it once; it is yours for good.', es: 'Aun no es tuya. Comprala una vez y es tuya para siempre.' },
  'vault.act.buyTab': { en: 'Buy the {{tab}} tab', es: 'Comprar la pestaña {{tab}}' },
  'vault.why.blocked': { en: 'No room there. Try another spot.', es: 'No cabe ahi. Prueba otro sitio.' },
  'vault.why.failed': { en: 'That could not be saved. Nothing was spent. Try again.', es: 'No se pudo guardar. No se gasto nada. Intentalo de nuevo.' },
  'vault.holding': { en: 'Holding {{name}}. Tap a cell to put it there.', es: 'Llevas {{name}}. Toca una casilla para dejarlo ahi.' },
  'vault.act.deposit': { en: 'Deposit all', es: 'Guardar todo' },
  'vault.act.takeAll': { en: 'Take all', es: 'Sacar todo' },
  'vault.act.sortTab': { en: 'Sort tab', es: 'Ordenar pestana' },
  'vault.act.sortBag': { en: 'Sort satchel', es: 'Ordenar mochila' },
  'vault.done.deposit': { en: '{{n}} stored in the Vault.', es: '{{n}} guardados en la Boveda.' },
  'vault.done.take': { en: '{{n}} taken into the satchel.', es: '{{n}} sacados a la mochila.' },
  'vault.done.left': { en: '{{n}} moved; {{left}} had no room.', es: '{{n}} movidos; {{left}} no cabian.' },
  'vault.done.sort': { en: 'Sorted by kind, rarity and name.', es: 'Ordenado por tipo, rareza y nombre.' },
  'vault.cancel': { en: 'Put back', es: 'Devolver' },
  'vault.line.overflow': { en: 'What did not fit when the satchel became a grid waits here, safe. Drag it out when you have room.', es: 'Lo que no cupo cuando la mochila se hizo cuadricula espera aqui, a salvo. Arrastralo fuera cuando tengas sitio.' },
  'vault.line.row': { en: 'Your satchel grows to {{rows}} rows.', es: 'Tu mochila crece a {{rows}} filas.' },
  'vault.done.row': { en: 'Your satchel now has {{rows}} rows.', es: 'Tu mochila ahora tiene {{rows}} filas.' },
  'vault.done.tab': { en: 'The {{tab}} tab is yours.', es: 'La pestaña {{tab}} es tuya.' },
  'vault.details.hint': { en: 'Prices for more room, and how the stash works', es: 'Precios de mas espacio, y como funciona el baul' },
  'vault.details.prices': { en: 'Storage you can buy', es: 'Espacio que puedes comprar' },
  'vault.details.owned': { en: 'Owned', es: 'Tuya' },
  'vault.details.how': { en: 'Things move into the Vault only when you drag them here. Benches and the forge use what you carry, so take materials out before you craft.', es: 'Las cosas entran en la Bóveda solo cuando las arrastras aqui. Los bancos y la forja usan lo que llevas, asi que saca los materiales antes de fabricar.' },
  'vault.details.keep': { en: 'Purchases are permanent; the Eclipse leaves them.', es: 'Las compras son permanentes; el Eclipse no las toca.' },
};
