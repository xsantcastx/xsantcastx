import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

interface Translations {
  [key: string]: {
    en: string;
    es: string;
  };
}

/** The languages the site actually ships copy for, and the only values `?lang=` honours. */
export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
export const DEFAULT_LANGUAGE = 'en';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private currentLanguageSubject = new BehaviorSubject<string>('en');
  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  private translations: Translations = {
    // ── The Godforge command bar ─────────────────────────────────────────
    // Realm *names* are deliberately absent: they come from REALMS in
    // realm.model.ts and are proper nouns in the lore, untranslated in both
    // languages exactly as the tools page already renders them.

    /* appinstall.* / netstatus.* — the installable app. Namespaced away from
       `pwa` on purpose: the key check reads any dotted backticked word as a key,
       and `pwa.service.ts` in a comment would then fail the build. */
    'appinstall.title':      { en: 'Install Eclipse Realms', es: 'Instala Eclipse Realms' },
    'appinstall.body':       { en: 'Its own window, one tap from your home screen — and it opens even when you are offline.', es: 'Su propia ventana, a un toque desde tu pantalla de inicio, y se abre incluso sin conexion.' },
    'appinstall.install':    { en: 'Install', es: 'Instalar' },
    'appinstall.notNow':     { en: 'Not now', es: 'Ahora no' },
    'appinstall.dismiss':    { en: 'Dismiss the install offer', es: 'Descartar la oferta de instalacion' },
    'appinstall.iosBody':    { en: 'Tap Share, then Add to Home Screen. It opens full-screen, like an app.', es: 'Toca Compartir y luego Agregar a inicio. Se abre a pantalla completa, como una app.' },
    'appinstall.iosShare':   { en: 'Share', es: 'Compartir' },
    'appinstall.gotIt':      { en: 'Got it', es: 'Entendido' },
    'netstatus.offlineSync': { en: 'Offline — progress will sync when you reconnect', es: 'Sin conexion: tu progreso se sincronizara al reconectar' },
    'netstatus.offlineLocal':{ en: 'Offline — progress is saved on this device', es: 'Sin conexion: tu progreso se guarda en este dispositivo' },
    'netstatus.backSyncing': { en: 'Back online — syncing your progress', es: 'De nuevo en linea: sincronizando tu progreso' },
    'netstatus.back':        { en: 'Back online', es: 'De nuevo en linea' },

    /* related.* — the contextual link block at the foot of each room.
       Longer than the gfnav.* labels beside them on purpose: these are body
       links, and the words inside a link describe what is on the other end of
       it. "Bench" is a fine tab label and a wasted anchor. */
    // Left untranslated in both languages on purpose — "Pro" is the product
    // name, and it is what the badge, the title prefix and the receipt all say.
    // The page at this key has been the AI feed, then the Forge View, and is now
    // the Inner Sanctum at /sanctum. The key keeps its original name through all
    // three so every template pointing at it keeps working; the copy is what
    // moves. Renaming the key as well would be a rename in two places to buy
    // nothing a reader of the templates can see.
    // The bar's label for the same page. "The Inner Sanctum" is the name, and
    // it is what the footer and the page itself say; a hall is a slot roughly
    // one word wide, and "El santuario interior" is 175px of it in Spanish.

    'forge.benchLink':    { en: 'The runes are struck here. Kit is forged at the bench \u2192', es: 'Las runas se golpean aqui. El equipo se forja en el banco \u2192' },
    'forge.tableLink':    { en: 'Runes go in sockets too. The Table is through here \u2192', es: 'Las runas tambien van en engarces. La Mesa esta por aqui \u2192' },

    // ── The Coliseum ───────────────────────────────────────
    // Opponent names, taunts and ring flavour are deliberately absent: they are
    // proper nouns and authored voice in the lore, and are rendered untranslated
    // in both languages exactly as realm names already are.
    'arena.title':        { en: 'The Coliseum',   es: 'El Coliseo' },
    'arena.stat.points':  { en: 'Arena points',   es: 'Puntos de arena' },
    'arena.stat.record':  { en: 'Record',         es: 'Historial' },
    'arena.stat.streak':  { en: 'Streak',         es: 'Racha' },
    'arena.stat.rank':    { en: 'Standing',       es: 'Rango' },
    'arena.loadout.title':{ en: 'What you bring', es: 'Lo que traes' },
    'arena.loadout.might':{ en: 'Might',          es: 'Poder' },
    'arena.loadout.guard':{ en: 'Guard',          es: 'Guardia' },
    'arena.loadout.mightNote': { en: 'what you swing', es: 'lo que descargas' },
    'arena.loadout.guardNote': { en: 'what you subtract from what is swung at you', es: 'lo que restas de lo que te descargan' },
    'arena.loadout.rank': { en: 'Rank',           es: 'Nivel' },
    'arena.loadout.strike': { en: 'Strike (worn)', es: 'Golpe (equipado)' },
    'arena.loadout.ward': { en: 'Ward (worn)',    es: 'Proteccion (equipada)' },
    'arena.loadout.forge': { en: 'Forge Power',   es: 'Poder de forja' },
    'arena.loadout.hint': { en: 'Both numbers are read off worn kit and allocated stats, live.', es: 'Ambos numeros se leen del equipo puesto y los puntos asignados, en vivo.' },
    'arena.loadout.link': { en: 'Change your kit \u2192', es: 'Cambia tu equipo \u2192' },
    'arena.lock.ready':   { en: 'The gate is open.', es: 'La puerta esta abierta.' },
    'arena.lock.waiting': { en: 'Catching your breath \u2014', es: 'Recuperando el aliento \u2014' },
    'arena.rings.gold':   { en: 'Gold',           es: 'Oro' },
    'arena.rings.xp':     { en: 'XP',             es: 'XP' },
    'arena.rings.points': { en: 'Points',         es: 'Puntos' },
    'arena.rings.oddsNote': { en: 'against this ring\u2019s easiest name \u2014 each challenger below carries its own', es: 'contra el nombre mas facil de este anillo; cada retador de abajo lleva el suyo' },
    'arena.rings.challenge': { en: 'Challenge',      es: 'Retar a' },
    'arena.shop.title':   { en: 'The quartermaster', es: 'El intendente' },
    'arena.shop.blurb':   { en: 'Arena points buy things the rest of the world already understands \u2014 kit, Gold, Essence, materials.', es: 'Los puntos de arena compran cosas que el resto del mundo ya entiende: equipo, oro, esencia, materiales.' },
    'arena.shop.buy':     { en: 'Take it',        es: 'Tomalo' },
    'arena.shop.owned':   { en: 'Taken',          es: 'Tomado' },
    'arena.fight.label':  { en: 'Bout result',    es: 'Resultado del combate' },
    'arena.fight.close':  { en: 'Close the bout', es: 'Cerrar el combate' },
    'arena.fight.you':    { en: 'You',            es: 'Tu' },
    'arena.fight.guard':  { en: 'Guard',          es: 'Guardia' },
    'arena.fight.roundWon':  { en: 'yours',       es: 'tuyo' },
    'arena.fight.roundLost': { en: 'theirs',      es: 'suyo' },
    'arena.fight.victory':{ en: 'Victory',        es: 'Victoria' },
    'arena.fight.defeat': { en: 'Defeat',         es: 'Derrota' },
    'arena.fight.streak': { en: 'Streak bonus',   es: 'Bono de racha' },
    'arena.fight.consolation': { en: 'Nothing taken. The house pays you anyway:', es: 'No perdiste nada. La casa te paga igualmente:' },
    'arena.fight.unlocked': { en: 'A new gate is unchained:', es: 'Una nueva puerta se desencadena:' },
    'arena.fight.done':   { en: 'Leave the sand', es: 'Deja la arena' },

    // ── The Standings ───────────────────────────────────
    // Board names and blurbs live in LEADERBOARD_CATEGORIES, alongside their
    // summits and curves; splitting the copy from the number it describes would
    // have put a board's honesty in two files.


    // ── The Enchanting Table ──────────────────────────────────────────────
    'enchant.dismiss':    { en: 'Dismiss',        es: 'Descartar' },

    'enchant.sockets.empty':   { en: 'Nothing you own will hold a rune yet. Craft or find a weapon or a piece of armour and it arrives with its wells already cut.', es: 'Nada de lo que tienes admite runas todavia. Forja o encuentra un arma o una armadura y llegara con sus huecos ya tallados.' },
    'enchant.sockets.base':    { en: 'Base roll', es: 'Tirada base' },
    'enchant.sockets.runes':   { en: 'From runes', es: 'De las runas' },
    'enchant.sockets.total':   { en: 'What it pays', es: 'Lo que rinde' },
    'enchant.sockets.none':    { en: '\u2014',   es: '\u2014' },

    'enchant.words.title':     { en: 'Socket Words', es: 'Palabras de engarce' },
    'enchant.words.tagline':   { en: 'Fifteen sequences nobody wrote down. Fill every well on a piece with the right runes in the right order and the piece starts paying something the runes alone do not.', es: 'Quince secuencias que nadie escribio. Llena cada hueco de una pieza con las runas correctas en el orden correcto y la pieza rendira algo que las runas solas no dan.' },
    'enchant.words.clue':      { en: 'Clue',      es: 'Pista' },
    'enchant.words.frame.weapon': { en: 'Weapon only', es: 'Solo armas' },
    'enchant.words.frame.armor':  { en: 'Armour only', es: 'Solo armaduras' },
    'enchant.words.frame.any':    { en: 'Any piece',   es: 'Cualquier pieza' },

    // ── The Forge floor (strip above all three benches) ───────────────────
    'forgeFloor.label':         { en: 'The forge floor', es: 'El taller de la forja' },
    'forgeFloor.stockpile':     { en: 'Stockpile',       es: 'Acopio' },
    'forgeFloor.bag':           { en: 'Satchel',             es: 'Mochila' },
    'forgeFloor.station.anvil': { en: 'The Bench',       es: 'El Banco' },
    'forgeFloor.station.table': { en: 'The Table',       es: 'La Mesa' },
    'forgeFloor.station.runes': { en: 'The Forge',       es: 'La Forja' },
    'forgeFloor.made':          { en: 'Off the floor:',  es: 'Sale del taller:' },

    // ── The Crafting Bench ────────────────────────────────────────────────
    'crafting.level':     { en: 'Level',          es: 'Nivel' },
    'crafting.lvl':       { en: 'Lvl',            es: 'Nvl' },
    'crafting.stat.xp':   { en: 'Crafting XP',    es: 'XP de forja' },
    'crafting.stat.known':{ en: 'Recipes known',  es: 'Recetas conocidas' },
    'crafting.stat.mastered': { en: 'Mastered',   es: 'Dominadas' },
    'crafting.filters':   { en: 'Recipe filters', es: 'Filtros de recetas' },
    'crafting.search':    { en: 'Search recipes and materials', es: 'Buscar recetas y materiales' },
    'crafting.all':       { en: 'All',            es: 'Todo' },
    'crafting.recipes':   { en: 'recipes',        es: 'recetas' },
    'crafting.empty':     { en: 'Nothing on the bench matches that.', es: 'Nada en el banco coincide con eso.' },
    'crafting.filter.realm':       { en: 'Realm',       es: 'Reino' },
    'crafting.filter.allRealms':   { en: 'All realms',  es: 'Todos los reinos' },
    'crafting.filter.unaligned':   { en: 'Unaligned',   es: 'Sin reino' },
    'crafting.filter.rarity':      { en: 'Rarity',      es: 'Rareza' },
    'crafting.filter.allRarities': { en: 'All rarities', es: 'Todas las rarezas' },
    'crafting.filter.status':      { en: 'Status',      es: 'Estado' },
    'crafting.filter.everything':  { en: 'Everything',  es: 'Todas' },
    'crafting.filter.ready':       { en: 'Ready to craft', es: 'Listas para forjar' },
    'crafting.filter.known':       { en: 'Already known',  es: 'Ya conocidas' },
    'crafting.time':      { en: 'Time',           es: 'Tiempo' },
    'crafting.instant':   { en: 'Instant',        es: 'Al instante' },
    'crafting.xp':        { en: 'XP',             es: 'XP' },
    'crafting.upTo':      { en: 'up to',          es: 'hasta' },
    'crafting.rollNote':  { en: 'Every craft rolls its own numbers. Mastery raises the floor.', es: 'Cada forja tira sus propios numeros. El dominio sube el minimo.' },
    'crafting.mastered':  { en: 'Mastered',       es: 'Dominada' },
    'crafting.mastery.progress': { en: 'Toward mastery', es: 'Hacia el dominio' },
    'crafting.mastery.done':     { en: 'Mastered \u2014 every roll on this recipe is 10% better, forever.', es: 'Dominada: cada tirada de esta receta es un 10% mejor, para siempre.' },
    'crafting.result.note':      { en: 'It is in your satchel. Equip it on Character, or list it on the Exchange.', es: 'Esta en tu mochila. Equipalo en Personaje, o listalo en la Lonja.' },



    // ── Cloud save ───────────────────────────────────────────────────────
    // The chip in the command bar. "Sign In" rather than "Save Progress" on
    // purpose: the control opens a Google account chooser, and a label that
    // does not say so makes the popup read as something the page did rather
    // than something it asked for.

    // ── Device lease ────────────────────────────────────────────────────────
    // Written to be read at a glance and then ignored. A passive device is
    // still fully playable, so this is a status line rather than a warning, and
    // nothing in it should read as an error the visitor has to resolve.
    'cloud.lease.passive':  {
      en: 'Another device is active. Your progress will sync when you switch.',
      es: 'Otro dispositivo esta activo. Tu progreso se sincronizara cuando cambies.',
    },
    'cloud.lease.activeOn': { en: 'Active on: {{device}}', es: 'Activo en: {{device}}' },
    'cloud.lease.playHere': { en: 'Play Here',             es: 'Jugar aqui' },
    'cloud.lease.claiming': { en: 'Taking over...',        es: 'Tomando el control...' },
    'cloud.lease.label':    {
      en: 'Make this the active device for your saved progress',
      es: 'Haz que este sea el dispositivo activo para tu progreso guardado',
    },



    // The WebGL forge's escape hatch. One key: the switch's own state says
    // whether it is on, so a second "effects reduced" string would be a label
    // arguing with the control beside it.

    // The 3D item inspector. `label` is the button face and stays short — it
    // sits over the artwork in the Quick Inspect hero — while `open` carries
    // the full sentence for assistive technology.

    // ── The entrance ─────────────────────────────────────────────────────


    // Footer
    // These two were referenced but never defined. `translate()` falls back to
    // returning the key, which is truthy — so the `|| 'Address copied'` idiom
    // at the call site never fired and the toast literally read "footer.copied".

    // Cookie Banner / GDPR Consent
    'cookies.banner.title': { en: 'Cookie preferences', es: 'Preferencias de cookies' },
    'cookies.banner.description': { en: 'Tiny analytics breadcrumbs help us see which stars get visited most.', es: 'Pequenas migas de analytics nos ayudan a ver que estrellas se visitan mas.' },
    'cookies.banner.details': { en: 'No personal data is sold or shared — we just count footsteps in the cosmos.', es: 'No se vende ni se comparte ningun dato personal — solo contamos pisadas en el cosmos.' },
    'cookies.accept': { en: 'Accept Analytics', es: 'Aceptar Analytics' },
    'cookies.deny': { en: 'Essential Only', es: 'Solo Esenciales' },
    'cookies.banner.aria': { en: 'Cookie consent banner', es: 'Banner de consentimiento de cookies' },
    'cookies.accept.aria': { en: 'Accept analytics cookies', es: 'Aceptar cookies de analytics' },
    'cookies.deny.aria': { en: 'Use essential cookies only', es: 'Usar solo cookies esenciales' },

    // ─── First-run tutorial ────────────────────────────────────────────────
    // The five screens a browser with no save gets instead of /world. Written
    // as Kael speaking, because he is the NPC who stands on that route — the
    // voice is the one the visitor will keep hearing, not a tutorial narrator
    // who never appears again.
    //
    // Deliberately concrete: every promise here is one the app keeps
    // immediately. The Gold on screen two is banked in the real ledger, the
    // rank on screen three is LEVELS[0], and the quest on screen five is the
    // live board's own first open daily. Nothing on these screens is a mock.







    // ─── While you were away ───────────────────────────────────────────────
    // The absence summary. Spanish here is deliberately plain: the screen is
    // read once, at a glance, by somebody who has just come back and wants the
    // numbers — flourish belongs in the lore panels, not on a receipt.

    // ─── Social proof ──────────────────────────────────────────────────────
    // Singular and plural are separate keys rather than "Keeper(s)": this
    // widget has to be believable at a count of one, and copy visibly written
    // for a larger number is the first thing that undermines it.

    // ─── The Godforge — homepage ───────────────────────────────────────────
    // The Eclipse Realms layer over the home page. Lore vocabulary, but every
    // number under it is real: artifacts are registry tools, paths are the
    // prerendered routes, fragments are registered easter eggs.
    // Names the genre in the first six words. The line before this one read
    // "A persistent world of five Eclipse Realms — wander, collect, and forge
    // your legend", which is the right sentence for somebody who already knows
    // what this is and tells a stranger from a link nothing: not that it is a
    // game, not that it is free, not that it needs no account. Lore is the
    // eyebrow above it; this line is the pitch.



    // ── The Rune Forge band on /home ─────────────────────────────────────
    // The lede names the odds rather than promising a feeling. "One in two
    // thousand" is the Void's real rate, and a number a visitor can check is
    // worth more here than an adjective they cannot.


    // ─── Realm dossier and Fivefold Lock chrome (lore stays in narrative data) ─
    // A2 Foraging — the Verdant landing's site link

    // ─── C8 Infernal chapter, Current Work, Seamworks ─────────────────────
    'work.tile.label': { en: 'Current Work', es: 'Trabajo actual' },
    'work.tile.empty': { en: 'No Current Work', es: 'Sin trabajo actual' },
    'work.tile.closed': { en: '{{activity}} · {{location}} · Level {{level}} · {{xp}} / {{next}} XP', es: '{{activity}} · {{location}} · Nivel {{level}} · {{xp}} / {{next}} XP' },
    // Parameterised at B1 (skill authoring spec §11): these used to bake in
    // "Mining" and "Basalt Seamworks", which forced a …Foraging twin per key.
    // The twins are gone; the tile passes {{skill}} / {{verb}} / {{site}}.
    'work.tile.xp': { en: '{{skill}} Level {{level}} · {{xp}} / {{next}} XP', es: '{{skill}} nivel {{level}} · {{xp}} / {{next}} XP' },
    'work.tile.xpMax': { en: '{{skill}} Level {{level}} · {{xp}} XP', es: '{{skill}} nivel {{level}} · {{xp}} XP' },
    'work.tile.ready': { en: 'Ready to {{verb}} at {{site}}.', es: 'Listo para {{verb}} en {{site}}.' },
    'work.tile.recovering': { en: 'Recovering {{seconds}}s of {{wait}}s.', es: 'Recuperando {{seconds}}s de {{wait}}s.' },
    'work.tile.summary': { en: 'One deliberate strike. 1 Cinder Ore and 2 Mining XP. No background trickle.', es: 'Un golpe deliberado. 1 Cinder Ore y 2 XP de mineria. Sin goteo en segundo plano.' },
    'work.tile.go': { en: 'Go to Seamworks', es: 'Ir a Seamworks' },
    'work.tile.state.idle': { en: 'Idle', es: 'Inactivo' },
    'work.tile.state.ready': { en: 'Ready', es: 'Listo' },
    'work.tile.state.recovering': { en: 'Recovering', es: 'Recuperando' },
    'work.tile.state.away': { en: 'Elsewhere', es: 'En otro lugar' },
    'work.discipline.mining': { en: 'Mining', es: 'Mineria' },
    'work.location.seamworks': { en: 'Basalt Seamworks', es: 'Basalt Seamworks' },
    // A2 Foraging — the tile's foraging variants
    'work.discipline.foraging': { en: 'Foraging', es: 'Recoleccion' },
    'work.location.canopy': { en: 'Rootglass Canopy', es: 'Rootglass Canopy' },
    'work.tile.summaryForaging': { en: 'One deliberate gather. 1 Starlight Herb and 2 Foraging XP. No background trickle.', es: 'Una recoleccion deliberada. 1 Starlight Herb y 2 XP de recoleccion. Sin goteo en segundo plano.' },
    'work.tile.goCanopy': { en: 'Go to Canopy', es: 'Ir al Canopy' },

    // ── B1 Prospecting ──────────────────────────────────────────────────────
    'work.discipline.prospecting': { en: 'Prospecting', es: 'Prospeccion' },
    'work.location.orrery': { en: 'Meridian Orrery', es: 'Meridian Orrery' },
    'work.tile.summaryProspecting': { en: 'One deliberate survey. 1 Celestial Alloy and 2 Prospecting XP. No background trickle.', es: 'Un sondeo deliberado. 1 Celestial Alloy y 2 XP de prospeccion. Sin goteo en segundo plano.' },
    'work.tile.goOrrery': { en: 'Go to Orrery', es: 'Ir al Orrery' },
    // The {{verb}} var in work.tile.ready — one per live discipline.
    'work.verb.mining': { en: 'mine', es: 'minar' },
    'work.verb.foraging': { en: 'gather', es: 'recolectar' },
    'work.verb.prospecting': { en: 'survey', es: 'sondear' },

    'infernal.evidence.fracture.title': { en: 'Fracture pattern', es: 'Patron de fractura' },
    'infernal.evidence.fracture.body': { en: 'The shard will hold if it is bound now. Delay lets the Seam Eater reach the join.', es: 'El fragmento aguantara si se ata ahora. Retrasar deja que el Devorador de Costuras alcance la junta.' },
    'infernal.evidence.ledger.title': { en: 'District heat ledger', es: 'Libro de calor del distrito' },
    'infernal.evidence.ledger.body': { en: 'A central brace redirects the surge through Edrin\'s district. The names on the ledger are specific, not abstract.', es: 'Un refuerzo central desvia la oleada por el distrito de Edrin. Los nombres del libro son concretos, no abstractos.' },
    'infernal.evidence.brace.title': { en: 'Unfinished oathsteel brace', es: 'Refuerzo de oathsteel inacabado' },
    'infernal.evidence.brace.body': { en: 'A slower distributed brace keeps heat in the works. It risks losing the shard and leaves visible damage across the landmark.', es: 'Un refuerzo distribuido mas lento deja el calor en las obras. Arriesga el fragmento y deja dano visible en el hito.' },
    'infernal.choice.central.title': { en: 'Emergency central brace', es: 'Refuerzo central de emergencia' },
    'infernal.choice.central.body': { en: 'Save the works now. Mark Edrin\'s district for heat rationing.', es: 'Salva las obras ahora. Marca el distrito de Edrin para racion de calor.' },
    'infernal.choice.central.consequence': { en: 'The works hold. Heat rationing is already posted on Edrin\'s street. The cost has a name.', es: 'Las obras aguantan. La racion de calor ya esta publicada en la calle de Edrin. El costo tiene nombre.' },
    'infernal.choice.distributed.title': { en: 'Distributed brace', es: 'Refuerzo distribuido' },
    'infernal.choice.distributed.body': { en: 'Protect the district. Accept lost output and visible damage across the Seamworks.', es: 'Protege el distrito. Acepta menos produccion y dano visible en Seamworks.' },
    'infernal.choice.distributed.consequence': { en: 'The district stays livable. Output falls, and unfinished joins show across the landmark.', es: 'El distrito sigue habitable. La produccion cae, y las juntas inacabadas se ven en el hito.' },

    'seamworks.titlePage': { en: 'Basalt Seamworks — Eclipse Realms', es: 'Basalt Seamworks — Eclipse Realms' },
    'seamworks.eyebrow': { en: 'Infernal landmark', es: 'Hito infernal' },
    'seamworks.lede': { en: 'A suspended lattice of iron-black bridges and furnace channels. Mining is the only rewarded action here.', es: 'Una celosia suspendida de puentes negro hierro y canales de horno. Minar es la unica accion recompensada aqui.' },
    'seamworks.chapter.missing': { en: 'The Price of a Seam is still open on the Infernal dossier.', es: 'El Precio de una Costura sigue abierto en el expediente Infernal.' },
    'seamworks.chapter.resolved': { en: 'Recorded brace: {{choice}}', es: 'Refuerzo registrado: {{choice}}' },
    'seamworks.panel.title': { en: 'Mining · Basalt Seamworks', es: 'Mineria · Basalt Seamworks' },
    'seamworks.tier.title': { en: 'Choose a seam', es: 'Elige una veta' },
    'seamworks.tier.xp': { en: '+{{xp}} XP', es: '+{{xp}} XP' },
    'seamworks.tier.locked': { en: 'Unlocks at level {{level}}', es: 'Se desbloquea en el nivel {{level}}' },
    'seamworks.expect': { en: 'Expected: 1 {{ore}} + {{xp}} Mining XP.', es: 'Esperado: 1 {{ore}} + {{xp}} XP de mineria.' },
    'seamworks.discovery.pending': { en: 'Bonus discovery: {{chance}}% Ember Residue after the first eligible strike. The 800th strike guarantees one if none appeared.', es: 'Descubrimiento extra: {{chance}}% Ember Residue tras el primer golpe valido. El golpe 800 lo garantiza si no aparecio antes.' },
    'seamworks.discovery.bonus': { en: 'Bonus discovery: Ember Residue.', es: 'Descubrimiento extra: Ember Residue.' },
    'seamworks.discovery.guarantee': { en: 'First craft guarantee: Ember Residue.', es: 'Garantia del primer forjado: Ember Residue.' },
    'seamworks.discovery.none': { en: 'No bonus this strike.', es: 'Sin extra en este golpe.' },
    'seamworks.mine': { en: 'Mine', es: 'Minar' },
    'seamworks.speedup': { en: 'Your level and weapon: seams recover {{pct}}% faster.', es: 'Tu nivel y arma: las vetas se recuperan {{pct}}% mas rapido.' },
    'seamworks.mine.wait': { en: 'Recovering {{seconds}}s', es: 'Recuperando {{seconds}}s' },
    'seamworks.mine.resolving': { en: 'Resolving', es: 'Resolviendo' },
    'seamworks.status.available': { en: 'Mine is ready.', es: 'Minar esta listo.' },
    'seamworks.status.resolving': { en: 'Resolving this strike.', es: 'Resolviendo este golpe.' },
    'seamworks.status.recovering': { en: 'Recovering {{seconds}} seconds. Extra clicks do nothing.', es: 'Recuperando {{seconds}} segundos. Clics extra no hacen nada.' },
    'seamworks.status.capacity': { en: 'The satchel cannot accept {{ore}}.', es: 'La mochila no puede aceptar {{ore}}.' },
    'seamworks.status.location': { en: 'Mining requires Basalt Seamworks as Current Work.', es: 'Minar exige Basalt Seamworks como trabajo actual.' },
    'seamworks.status.persist': { en: 'Last confirmed totals are kept. Retry or refresh.', es: 'Se conservan los totales confirmados. Reintenta o recarga.' },
    'seamworks.status.unavailable': { en: 'Mining is not available on this view.', es: 'Minar no esta disponible en esta vista.' },
    'seamworks.full': { en: 'The satchel cannot take another {{ore}}. Drop something in the satchel — you can keep mining while it is open. No XP or discovery is rolled while the satchel is full.', es: 'La mochila no admite otro {{ore}}. Tira algo en la mochila — puedes seguir minando con ella abierta. No se tira XP ni descubrimiento con la mochila llena.' },
    'seamworks.openBag': { en: 'Open satchel', es: 'Abrir mochila' },
    'seamworks.haul': { en: 'Ore in the satchel', es: 'Mineral en la mochila' },
    'seamworks.held': { en: '×{{n}}', es: '×{{n}}' },
    'seamworks.gain': { en: '+{{n}} this strike', es: '+{{n}} en este golpe' },
    'seamworks.gain.rare': { en: 'NEW +{{n}}', es: 'NUEVO +{{n}}' },
    'seamworks.away': { en: 'Mining requires Basalt Seamworks. Return here to strike.', es: 'Minar exige Basalt Seamworks. Vuelve aqui para golpear.' },
    'seamworks.persist': { en: 'The strike did not save. Last confirmed ore and XP are unchanged.', es: 'El golpe no se guardo. El mineral y el XP confirmados no cambiaron.' },
    'seamworks.retry': { en: 'Retry', es: 'Reintentar' },
    'seamworks.refresh': { en: 'Refresh', es: 'Recargar' },
    'seamworks.result.ore': { en: '{{ore}} +{{gain}} · held ×{{held}}', es: '{{ore}} +{{gain}} · tienes ×{{held}}' },
    'seamworks.result.ember': { en: 'NEW Ember Residue +{{gain}} · held ×{{held}}', es: 'NUEVO Ember Residue +{{gain}} · tienes ×{{held}}' },
    'seamworks.result.xp': { en: 'Mining +{{amount}} XP.', es: 'Mineria +{{amount}} XP.' },
    'seamworks.note': { en: 'Leaving this place awards nothing. There is no background trickle.', es: 'Salir de este lugar no otorga nada. No hay goteo en segundo plano.' },
    'seamworks.refine.title': { en: 'Refining', es: 'Refinado' },
    'seamworks.refine.lede': { en: 'Three of a lower ore become one of the next. No XP and no level needed — surplus turns into progress.', es: 'Tres minerales de un grado se vuelven uno del siguiente. Sin XP y sin nivel — el excedente se convierte en progreso.' },
    'seamworks.refine.rule': { en: '{{n}} {{from}} → 1 {{to}}', es: '{{n}} {{from}} → 1 {{to}}' },
    'seamworks.refine.amount': { en: 'How many batches of {{from}}', es: 'Cuantas tandas de {{from}}' },
    'seamworks.refine.choice': { en: '×{{n}}', es: '×{{n}}' },
    'seamworks.refine.choiceMax': { en: 'Max ×{{n}}', es: 'Max ×{{n}}' },
    'seamworks.refine.action': { en: 'Refine ×{{n}}', es: 'Refinar ×{{n}}' },
    'seamworks.refine.confirm': { en: 'Refine {{consume}} {{from}} → {{produce}} {{to}}?', es: 'Refinar {{consume}} {{from}} → {{produce}} {{to}}?' },
    'seamworks.refine.short': { en: 'Needs {{need}} {{from}} · held ×{{held}}', es: 'Necesita {{need}} {{from}} · tienes ×{{held}}' },
    'seamworks.refine.capacity': { en: 'The satchel has no room for {{to}}. Drop something in the satchel first — your {{from}} stays untouched.', es: 'La mochila no tiene sitio para {{to}}. Tira algo en la mochila antes — tu {{from}} queda intacto.' },
    'seamworks.refine.persist': { en: 'The refine did not save. Both counts are unchanged.', es: 'El refinado no se guardo. Ambos totales siguen igual.' },
    'seamworks.refine.stale': { en: 'Not enough {{from}} after all — counts refreshed.', es: 'Al final no hay suficiente {{from}} — totales actualizados.' },
    'seamworks.refine.result': { en: '{{from}} −{{consume}} · {{to}} +{{produce}} · held ×{{held}}', es: '{{from}} −{{consume}} · {{to}} +{{produce}} · tienes ×{{held}}' },
    'seamworks.refine.status.ready': { en: '{{n}} {{from}} refine into 1 {{to}}.', es: '{{n}} {{from}} se refinan en 1 {{to}}.' },
    'seamworks.refine.status.armed': { en: 'Press again to confirm: {{consume}} {{from}} become {{produce}} {{to}}.', es: 'Pulsa otra vez para confirmar: {{consume}} {{from}} se vuelven {{produce}} {{to}}.' },
    'seamworks.refine.status.done': { en: 'Refined {{consume}} {{from}} into {{produce}} {{to}}.', es: 'Refinado: {{consume}} {{from}} en {{produce}} {{to}}.' },

    // ─── A2 Foraging — Rootglass Canopy (mirrors seamworks.*; the wording-neutral
    //     seamworks keys — tier.xp, tier.locked, held, gain, gain.rare, openBag,
    //     retry, refresh — are reused, not duplicated) ──────────────────────
    'canopy.titlePage': { en: 'Rootglass Canopy — Eclipse Realms', es: 'Rootglass Canopy — Eclipse Realms' },
    'canopy.eyebrow': { en: 'Verdant landmark', es: 'Hito verdant' },
    'canopy.lede': { en: 'A rootwood lattice threaded through living crystal, amber light marking old rift scars. Foraging is the only rewarded action here.', es: 'Una celosia de raices tejida en cristal vivo, con luz ambar marcando viejas cicatrices de grieta. Recolectar es la unica accion recompensada aqui.' },
    'canopy.panel.title': { en: 'Foraging · Rootglass Canopy', es: 'Recoleccion · Rootglass Canopy' },
    'canopy.tier.title': { en: 'Choose a growth', es: 'Elige un brote' },
    'canopy.expect': { en: 'Expected: 1 {{herb}} + {{xp}} Foraging XP.', es: 'Esperado: 1 {{herb}} + {{xp}} XP de recoleccion.' },
    'canopy.gather': { en: 'Gather', es: 'Recolectar' },
    'canopy.gather.wait': { en: 'Regrowing {{seconds}}s', es: 'Rebrotando {{seconds}}s' },
    'canopy.gather.resolving': { en: 'Resolving', es: 'Resolviendo' },
    'canopy.speedup': { en: 'Your level: growths regrow {{pct}}% faster.', es: 'Tu nivel: los brotes rebrotan {{pct}}% mas rapido.' },
    'canopy.status.available': { en: 'Gather is ready.', es: 'Recolectar esta listo.' },
    'canopy.status.resolving': { en: 'Resolving this gather.', es: 'Resolviendo esta recoleccion.' },
    'canopy.status.recovering': { en: 'Regrowing {{seconds}} seconds. Extra clicks do nothing.', es: 'Rebrotando {{seconds}} segundos. Clics extra no hacen nada.' },
    'canopy.status.capacity': { en: 'The satchel cannot accept {{herb}}.', es: 'La mochila no puede aceptar {{herb}}.' },
    'canopy.status.location': { en: 'Foraging requires Rootglass Canopy as Current Work.', es: 'Recolectar exige Rootglass Canopy como trabajo actual.' },
    'canopy.status.persist': { en: 'Last confirmed totals are kept. Retry or refresh.', es: 'Se conservan los totales confirmados. Reintenta o recarga.' },
    'canopy.status.unavailable': { en: 'Foraging is not available on this view.', es: 'Recolectar no esta disponible en esta vista.' },
    'canopy.full': { en: 'The satchel cannot take another {{herb}}. Drop something in the satchel — you can keep gathering while it is open. No XP or find is rolled while the satchel is full.', es: 'La mochila no admite otro {{herb}}. Tira algo en la mochila — puedes seguir recolectando con ella abierta. No se tira XP ni hallazgo con la mochila llena.' },
    'canopy.haul': { en: 'Herbs in the satchel', es: 'Hierbas en la mochila' },
    'canopy.away': { en: 'Foraging requires Rootglass Canopy. Return here to gather.', es: 'Recolectar exige Rootglass Canopy. Vuelve aqui para recolectar.' },
    'canopy.persist': { en: 'The gather did not save. Last confirmed herbs and XP are unchanged.', es: 'La recoleccion no se guardo. Las hierbas y el XP confirmados no cambiaron.' },
    'canopy.result.herb': { en: '{{herb}} +{{gain}} · held ×{{held}}', es: '{{herb}} +{{gain}} · tienes ×{{held}}' },
    'canopy.result.xp': { en: 'Foraging +{{amount}} XP.', es: 'Recoleccion +{{amount}} XP.' },
    'canopy.note': { en: 'Leaving this place awards nothing. There is no background trickle.', es: 'Salir de este lugar no otorga nada. No hay goteo en segundo plano.' },

    // ── B1 Prospecting · Meridian Orrery ────────────────────────────────────
    // Mirrors canopy.* key-for-key. The eight wording-neutral seamworks.* keys
    // (tier.xp, tier.locked, held, gain, gain.rare, openBag, retry, refresh)
    // are reused, not duplicated — skill authoring spec §7.6.
    'orrery.titlePage': { en: 'Meridian Orrery — Eclipse Realms', es: 'Meridian Orrery — Eclipse Realms' },
    'orrery.eyebrow': { en: 'Celestial landmark', es: 'Hito celestial' },
    'orrery.lede': { en: 'A brass-and-glass orbital chamber whose rings trace realm boundaries in star silver. Cut into them and the far realms give up what they are made of. Prospecting is the only rewarded action here.', es: 'Una camara orbital de laton y vidrio cuyos anillos trazan las fronteras de los reinos en plata estelar. Cortalos y los reinos lejanos entregan aquello de lo que estan hechos. La prospeccion es la unica accion recompensada aqui.' },
    'orrery.panel.title': { en: 'Prospecting · Meridian Orrery', es: 'Prospeccion · Meridian Orrery' },
    'orrery.tier.title': { en: 'Choose a cut', es: 'Elige un corte' },
    'orrery.expect': { en: 'Expected: 1 {{mineral}} + {{xp}} Prospecting XP.', es: 'Esperado: 1 {{mineral}} + {{xp}} XP de prospeccion.' },
    'orrery.discovery.pending': { en: 'Rare find: {{chance}}% Clarity Elixir on any survey. The {{at}}th survey guarantees the first if none has appeared.', es: 'Hallazgo raro: {{chance}}% Clarity Elixir en cualquier sondeo. El sondeo {{at}} garantiza el primero si no aparecio antes.' },
    'orrery.discovery.bonus': { en: 'Rare find: Clarity Elixir.', es: 'Hallazgo raro: Clarity Elixir.' },
    'orrery.discovery.guarantee': { en: 'Guaranteed find: Clarity Elixir.', es: 'Hallazgo garantizado: Clarity Elixir.' },
    'orrery.discovery.none': { en: 'No rare find this survey.', es: 'Sin hallazgo raro en este sondeo.' },
    'orrery.prospect': { en: 'Survey', es: 'Sondear' },
    'orrery.prospect.wait': { en: 'Realigning {{seconds}}s', es: 'Realineando {{seconds}}s' },
    'orrery.prospect.resolving': { en: 'Resolving', es: 'Resolviendo' },
    'orrery.speedup': { en: 'Your level: the rings realign {{pct}}% faster.', es: 'Tu nivel: los anillos se realinean {{pct}}% mas rapido.' },
    'orrery.status.available': { en: 'Survey is ready.', es: 'Sondear esta listo.' },
    'orrery.status.resolving': { en: 'Resolving this survey.', es: 'Resolviendo este sondeo.' },
    'orrery.status.recovering': { en: 'Realigning {{seconds}} seconds. Extra clicks do nothing.', es: 'Realineando {{seconds}} segundos. Clics extra no hacen nada.' },
    'orrery.status.capacity': { en: 'The satchel cannot accept {{mineral}}.', es: 'La mochila no puede aceptar {{mineral}}.' },
    'orrery.status.location': { en: 'Prospecting requires Meridian Orrery as Current Work.', es: 'La prospeccion exige Meridian Orrery como trabajo actual.' },
    'orrery.status.persist': { en: 'Last confirmed totals are kept. Retry or refresh.', es: 'Se conservan los totales confirmados. Reintenta o recarga.' },
    'orrery.status.unavailable': { en: 'Prospecting is not available on this view.', es: 'La prospeccion no esta disponible en esta vista.' },
    'orrery.full': { en: 'The satchel cannot take another {{mineral}}. Drop something in the satchel — you can keep surveying while it is open. No XP or find is rolled while the satchel is full.', es: 'La mochila no admite otro {{mineral}}. Tira algo en la mochila — puedes seguir sondeando con ella abierta. No se tira XP ni hallazgo con la mochila llena.' },
    'orrery.haul': { en: 'Minerals in the satchel', es: 'Minerales en la mochila' },
    'orrery.away': { en: 'Prospecting requires Meridian Orrery. Return here to survey.', es: 'La prospeccion exige Meridian Orrery. Vuelve aqui para sondear.' },
    'orrery.persist': { en: 'The survey did not save. Last confirmed minerals and XP are unchanged.', es: 'El sondeo no se guardo. Los minerales y el XP confirmados no cambiaron.' },
    'orrery.result.mineral': { en: '{{mineral}} +{{gain}} · held ×{{held}}', es: '{{mineral}} +{{gain}} · tienes ×{{held}}' },
    'orrery.result.elixir': { en: 'NEW Clarity Elixir +{{gain}} · held ×{{held}}', es: 'NUEVO Clarity Elixir +{{gain}} · tienes ×{{held}}' },
    'orrery.result.xp': { en: 'Prospecting +{{amount}} XP.', es: 'Prospeccion +{{amount}} XP.' },
    'orrery.note': { en: 'Leaving this place awards nothing. There is no background trickle.', es: 'Salir de este lugar no otorga nada. No hay goteo en segundo plano.' },

    // ─── Character hub ────────────────────────────────────────────────────
    'hub.tabs': { en: 'Character sections', es: 'Secciones del personaje' },
    'hub.tab.loadout': { en: 'Loadout', es: 'Equipo' },
    'hub.tab.bank': { en: 'Satchel', es: 'Mochila' },
    'hub.tab.skills': { en: 'Skills', es: 'Habilidades' },
    'hub.tab.stats': { en: 'Stats', es: 'Datos' },
    'hub.tab.story': { en: 'Story', es: 'Historia' },
    'hub.tab.records': { en: 'Records', es: 'Archivo' },
    'hub.bank.title': { en: 'Satchel', es: 'Mochila' },
    'hub.bank.tag': { en: '{{n}} held', es: '{{n}} en posesion' },
    'hub.bank.new': { en: 'NEW', es: 'NUEVO' },
    'hub.bank.rare': { en: 'RARE', es: 'RARO' },
    'hub.bank.gain': { en: '+{{n}}', es: '+{{n}}' },
    'hub.bank.kinds': { en: 'Satchel shelves', es: 'Estantes de la mochila' },
    'hub.bank.kind.all': { en: 'All', es: 'Todo' },
    'hub.bank.kind.items': { en: 'Items', es: 'Objetos' },
    'hub.bank.kind.materials': { en: 'Materials', es: 'Materiales' },
    'hub.bank.kind.runes': { en: 'Runes', es: 'Runas' },
    'hub.bank.search': { en: 'Search', es: 'Buscar' },
    'hub.bank.sort': { en: 'Sort', es: 'Orden' },
    'hub.bank.sort.newest': { en: 'Newest', es: 'Reciente' },
    'hub.bank.sort.name': { en: 'Name', es: 'Nombre' },
    'hub.bank.selectAll': { en: 'Select all', es: 'Elegir todo' },
    'hub.bank.clear': { en: 'Clear', es: 'Quitar' },
    'hub.bank.dropSelected': { en: 'Drop {{n}}', es: 'Tirar {{n}}' },
    'hub.bank.dropJunk': { en: 'Drop junk ({{n}})', es: 'Tirar basura ({{n}})' },
    'hub.bank.mark': { en: 'Mark {{name}}', es: 'Marcar {{name}}' },
    'hub.bank.bulkTitle': { en: 'Drop selected', es: 'Tirar seleccion' },
    'hub.bank.bulkBody': { en: 'Drop {{n}} rows? They are gone for good.', es: 'Tirar {{n}} filas? Se pierden para siempre.' },
    'hub.bank.empty': { en: 'The chest is empty. Mine, strike the anvil, or craft.', es: 'El cofre esta vacio. Mina, golpea el yunque o forja.' },
    'hub.bank.inVault': { en: '{{n}} more rest in your Vault. Visit the Vault in the Basalt Seamworks to take them out.', es: '{{n}} mas descansan en tu Bóveda. Visita la Bóveda en los Talleres de Basalto para sacarlos.' },
    'hub.bank.material': { en: 'Material', es: 'Material' },
    'hub.bank.rune': { en: 'Rune', es: 'Runa' },
    'hub.bank.runeword': { en: 'Runeword', es: 'Palabra runica' },
    'hub.skills.barLabel': { en: '{{name}} progress to the next level', es: 'Progreso de {{name}} al siguiente nivel' },
    'skills.title': { en: 'Skills', es: 'Habilidades' },
    'skills.lead': { en: 'Every skill opens something new about every ten levels.', es: 'Cada habilidad desbloquea algo nuevo cada diez niveles, mas o menos.' },
    'skills.levelLabel': { en: 'Level {{n}}', es: 'Nivel {{n}}' },
    'skills.next': { en: 'Next at level {{level}}: {{what}}', es: 'Siguiente en el nivel {{level}}: {{what}}' },
    'skills.allDone': { en: 'Every unlock earned.', es: 'Todo desbloqueado.' },
    'skills.details': { en: 'Details', es: 'Detalles' },
    'skills.xpTotal': { en: '{{xp}} XP in total', es: '{{xp}} XP en total' },
    'skills.foundIn': { en: 'Found in: {{where}}', es: 'Se encuentra en: {{where}}' },
    'delve.chip.label': { en: 'Delve mission', es: 'Mision de la Sima' },
    'delve.chip.claim': { en: 'Claim', es: 'Reclamar' },
    'skills.name.woodcutting': { en: 'Woodcutting', es: 'Tala' },
    'skills.name.smithing': { en: 'Smithing', es: 'Herreria' },
    'skills.name.delving': { en: 'Delving', es: 'Exploracion' },
    'skills.name.enchanting': { en: 'Enchanting', es: 'Encantamiento' },
    'skills.name.hunting': { en: 'Hunting', es: 'Caza' },
    'skills.hint.mining': { en: 'Hit ore rocks in the Seamworks or the Delves.', es: 'Golpea rocas de mineral en las Costuras o en las Simas.' },
    'skills.hint.foraging': { en: 'Gather herbs in the Canopy, or cut them in the wild with a sickle.', es: 'Recoge hierbas en el Canopy o cortalas en el mundo con una hoz.' },
    'skills.hint.woodcutting': { en: 'Chop trees out in the world with an axe.', es: 'Tala arboles en el mundo con un hacha.' },
    'skills.hint.smithing': { en: 'Craft anything at the Crafting Bench.', es: 'Fabrica lo que sea en el Banco de Artesania.' },
    'skills.hint.delving': { en: 'Explore the Delves and light up new rooms.', es: 'Explora las Simas e ilumina salas nuevas.' },
    'skills.hint.enchanting': { en: 'Break sealed stones in the world with a staff.', es: 'Rompe piedras selladas en el mundo con un baston.' },
    'skills.hint.hunting': { en: 'Defeat monsters out in the world.', es: 'Derrota monstruos en el mundo.' },
    'skills.hint.prospecting': { en: 'Survey the rings at the Meridian Orrery.', es: 'Examina los anillos en el Orrery Meridiano.' },
    'skills.unlock.tool': { en: 'Wield {{name}} ({{opens}})', es: 'Usar {{name}} ({{opens}})' },
    'skills.unlock.forge': { en: 'Forge tier {{tier}} tools', es: 'Forjar herramientas de nivel {{tier}}' },
    'skills.unlock.node': { en: 'Gather {{name}}', es: 'Recolectar {{name}}' },
    'skills.unlock.yield': { en: '+{{n}}% chance of a double haul', es: '+{{n}}% de probabilidad de botin doble' },
    'skills.unlock.speed': { en: 'Work {{n}}% faster', es: 'Trabajas un {{n}}% mas rapido' },
    'skills.unlock.quality': { en: '+{{n}}% quality on what you make', es: '+{{n}}% de calidad en lo que fabricas' },
    'skills.unlock.loot': { en: '+{{n}}% loot from hunts', es: '+{{n}}% de botin de caza' },
    'skills.unlock.lantern': { en: 'Lantern lights {{n}} tiles', es: 'El farol ilumina {{n}} casillas' },
    'skills.unlock.depth': { en: 'Delve to depth {{n}}', es: 'Descender a la profundidad {{n}}' },
    'skills.unlock.mastery': { en: 'Mastery: every rung climbed', es: 'Maestria: todos los peldanos subidos' },
    // /play: the Delve hotbar, gathering nodes in the hunting grounds, Hunting XP.
    'play.hotbar.label': { en: 'Things to place', es: 'Cosas para colocar' },
    'play.hotbar.held': { en: '{{name}}, {{n}} held', es: '{{name}}, {{n}} en la mochila' },
    'play.hotbar.none': { en: 'Nothing chosen', es: 'Nada elegido' },
    'play.hotbar.place': { en: 'Place', es: 'Colocar' },
    'play.hotbar.take': { en: 'Take', es: 'Recoger' },
    'play.hotbar.takeHint': { en: 'Take back a torch, ladder, chest, support or charge beside you', es: 'Recupera una antorcha, escalera, cofre, puntal o carga a tu lado' },
    'play.hotbar.ready': { en: '{{name}} ready ({{n}}). Press B, or hold a tap where it should go.', es: '{{name}} listo ({{n}}). Pulsa B o manten pulsado donde deba ir.' },
    'play.place.dirt-block': { en: 'Dirt block', es: 'Bloque de tierra' },
    'play.place.basalt-block': { en: 'Basalt block', es: 'Bloque de basalto' },
    'play.place.torch': { en: 'Torch', es: 'Antorcha' },
    'play.place.ladder': { en: 'Ladder', es: 'Escalera' },
    'play.place.platform': { en: 'Platform', es: 'Plataforma' },
    'play.place.chest': { en: 'Chest', es: 'Cofre' },
    'play.place.camp': { en: 'Camp', es: 'Campamento' },
    'play.place.timber-support': { en: 'Timber support', es: 'Puntal de madera' },
    'play.place.basalt-support': { en: 'Basalt support', es: 'Puntal de basalto' },
    'play.place.blast-charge': { en: 'Blasting charge', es: 'Carga explosiva' },
    'play.gather.work': { en: 'Gather {{name}}', es: 'Recolectar {{name}}' },
    'play.gather.needs': { en: '{{name}}: needs {{need}}', es: '{{name}}: necesita {{need}}' },
    'play.gather.regrowing': { en: '{{name}} grows back ({{n}}s)', es: '{{name}} vuelve a crecer ({{n}} s)' },
    'play.hunt.xp': { en: '+{{n}} Hunting XP', es: '+{{n}} XP de Caza' },
    'hub.stats.title': { en: 'Stats', es: 'Datos' },
    'hub.stats.rank': { en: 'Rank', es: 'Rango' },
    'hub.stats.xp': { en: 'XP', es: 'XP' },
    'hub.stats.gold': { en: 'Gold', es: 'Oro' },
    'hub.stats.essence': { en: 'Essence', es: 'Esencia' },
    'hub.stats.rate': { en: 'Gold / sec', es: 'Oro / s' },
    'hub.stats.affinity': { en: 'Luminous / Umbral', es: 'Luminous / Umbral' },
    'hub.records.drawer': { en: 'The Case and the Coals live on the Character hall.', es: 'El Estuche y las Brasas viven en la sala de Personaje.' },

    // ─── C4 Character loadout ─────────────────────────────────────────────
    'loadout.armed': { en: '{{name}} is armed — tap a highlighted slot.', es: '{{name}} esta armado — toca una ranura marcada.' },
    'loadout.picker.choose': { en: 'Equip from your satchel', es: 'Equipar desde la mochila' },
    'loadout.picker.none': { en: 'Nothing in your satchel fits this slot yet.', es: 'Nada en tu mochila encaja en esta ranura todavia.' },
    'loadout.picker.close': { en: 'Close slot', es: 'Cerrar ranura' },
    'loadout.unequip': { en: 'Unequip', es: 'Desequipar' },
    'loadout.compare.against': { en: 'Compared against {{name}}', es: 'Comparado con {{name}}' },
    'loadout.compare.upgrade': { en: 'upgrade', es: 'mejora' },
    'loadout.compare.empty': { en: 'Nothing worn here — every stat is a gain', es: 'Nada equipado aqui — cada atributo es una ganancia' },
    'loadout.sheet.title': { en: 'Keeper stats', es: 'Atributos del Guardian' },
    'loadout.stat.gold': { en: 'Gold/sec', es: 'Oro/s' },
    'loadout.stat.mf': { en: 'MF', es: 'SM' },
    'loadout.stat.xp': { en: 'XP', es: 'XP' },
    'loadout.stat.strike': { en: 'Anvil yield', es: 'Rendimiento del yunque' },
    'loadout.stat.ward': { en: 'Temper fails', es: 'Fallos de temple' },
    'loadout.stat.empty': { en: 'Nothing equipped. Mine at Basalt Seamworks, craft an Edge, then temper it.', es: 'Nada equipado. Mina en Basalt Seamworks, forja un filo y templalo.' },
    'loadout.build.eyebrow': { en: 'Build', es: 'Estilo' },
    'loadout.build.share': { en: '{{n}}% of build', es: '{{n}}% del estilo' },
    'loadout.build.from': { en: 'Mostly from {{name}}', es: 'Sobre todo de {{name}}' },
    'loadout.build.unforged.name': { en: 'Unforged', es: 'Sin forjar' },
    'loadout.build.unforged.desc': { en: 'Nothing worn carries a stat yet. Put on a piece and the Keeper starts to become someone.', es: 'Nada de lo que llevas tiene atributos aun. Ponte una pieza y el Guardian empieza a ser alguien.' },
    'loadout.build.vanguard.name': { en: 'Vanguard', es: 'Vanguardia' },
    'loadout.build.vanguard.desc': { en: 'Strike-heavy. Hits harder in the Seamworks and wrings more runes from the anvil.', es: 'Volcado en el golpe. Pega mas fuerte en Seamworks y saca mas runas del yunque.' },
    'loadout.build.treasureSeeker.name': { en: 'Treasure Seeker', es: 'Buscatesoros' },
    'loadout.build.treasureSeeker.desc': { en: 'Magic Find first. Rarer drops, better hauls.', es: 'Primero Hallazgo Magico. Botines mas raros y mejores.' },
    'loadout.build.forgewright.name': { en: 'Forgewright', es: 'Forjador' },
    'loadout.build.forgewright.desc': { en: 'Built on Gold per second. The forge pays while you are away.', es: 'Construido sobre Oro por segundo. La forja paga mientras no estas.' },
    'loadout.build.bulwark.name': { en: 'Bulwark', es: 'Baluarte' },
    'loadout.build.bulwark.desc': { en: 'Ward-heavy. More health in a fight and fewer tempers lost.', es: 'Volcado en la guarda. Mas vida en combate y menos temples fallidos.' },
    'loadout.build.lorekeeper.name': { en: 'Lorekeeper', es: 'Guardian del Saber' },
    'loadout.build.lorekeeper.desc': { en: 'XP first. Every run teaches the Keeper more.', es: 'Primero la XP. Cada salida le ensena mas al Guardian.' },
    'loadout.build.wanderer.name': { en: 'Wanderer', es: 'Errante' },
    'loadout.build.wanderer.desc': { en: 'Balanced. No one stat leads; a little of everything.', es: 'Equilibrado. Ningun atributo manda; un poco de todo.' },
    'loadout.doll.label': { en: 'Keeper paper doll', es: 'Muneco del Guardian' },
    'loadout.doll.alt': { en: 'Neutral Keeper paper doll. Equipment slots sit on top; the drawing is not proof of worn items.', es: 'Muneco neutral del Guardian. Las ranuras van encima; el dibujo no prueba equipo.' },
    'loadout.slot.charm1': { en: 'Charm I', es: 'Encanto I' },
    'loadout.slot.charm2': { en: 'Charm II', es: 'Encanto II' },
    'loadout.slot.charm3': { en: 'Charm III', es: 'Encanto III' },
    'loadout.slot.head': { en: 'Head', es: 'Cabeza' },
    'loadout.slot.chest': { en: 'Chest', es: 'Pecho' },
    'loadout.slot.hands': { en: 'Hands', es: 'Manos' },
    'loadout.slot.legs': { en: 'Legs', es: 'Piernas' },
    'loadout.slot.feet': { en: 'Feet', es: 'Pies' },
    'loadout.slot.weapon': { en: 'Weapon', es: 'Arma' },
    'loadout.slot.offhand': { en: 'Off-hand', es: 'Mano izquierda' },
    'loadout.slot.trinket': { en: 'Trinket', es: 'Amuleto' },
    'loadout.slot.empty': { en: 'Empty', es: 'Vacio' },
    'loadout.slot.locked': { en: 'None yet', es: 'Aún nada' },
    'loadout.slot.announce.empty': { en: '{{name}}, empty', es: '{{name}}, vacio' },
    'loadout.slot.announce.filled': { en: '{{name}}, equipped {{item}}. Inspect.', es: '{{name}}, equipado {{item}}. Inspeccionar.' },
    'loadout.slot.announce.locked': { en: '{{name}}, locked until a compatible item exists', es: '{{name}}, bloqueado hasta que exista un objeto compatible' },
    'loadout.charms.title': { en: 'Charms', es: 'Encantos' },
    'loadout.charms.count': { en: '{{n}} of {{max}} worn', es: '{{n}} de {{max}} equipados' },
    'loadout.charms.empty': { en: 'Empty', es: 'Vacio' },
    'loadout.charms.hint': { en: '{{n}} in your satchel. Tap a well to put one on.', es: '{{n}} en tu mochila. Toca una ranura para ponerte uno.' },
    'loadout.charms.none': { en: 'No charms yet. They turn up at the anvil and come home from expeditions.', es: 'Aun no tienes encantos. Aparecen en el yunque y vuelven de las expediciones.' },
    'loadout.bag.full': { en: 'Satchel is full. Drop a row to keep mining.', es: 'La mochila esta llena. Tira una fila para seguir minando.' },
    'loadout.drop': { en: 'Drop', es: 'Tirar' },
    'loadout.drop.confirmTitle': { en: 'Drop item', es: 'Tirar objeto' },
    'loadout.drop.confirmBody': { en: 'Drop {{name}}? It is gone for good.', es: 'Tirar {{name}}? Se pierde para siempre.' },
    'loadout.drop.confirmStack': { en: 'How many {{name}}? You hold {{n}}.', es: 'Cuantos {{name}}? Tienes {{n}}.' },
    'loadout.drop.choiceSome': { en: 'Drop {{n}}', es: 'Tirar {{n}}' },
    'loadout.drop.choiceAll': { en: 'Drop all {{n}}', es: 'Tirar los {{n}}' },
    'loadout.drop.confirmYes': { en: 'Drop it', es: 'Tirarlo' },
    'loadout.drop.confirmNo': { en: 'Keep it', es: 'Guardarlo' },

    // ─── Quick Inspect chrome (PR4a, read-only) ────────────────────────────
    'inspect.action':           { en: 'Inspect', es: 'Inspeccionar' },
    'inspect.missing':          { en: 'The record {{name}} is unavailable.', es: 'El registro {{name}} no esta disponible.' },
    'inspect.error':            { en: 'This record could not be loaded.', es: 'Este registro no se pudo cargar.' },
    'inspect.kind.item':        { en: 'Item', es: 'Objeto' },
    'inspect.kind.market-listing': { en: 'Market listing', es: 'Oferta del mercado' },
    'inspect.kind.rune':        { en: 'Rune', es: 'Runa' },
    'inspect.kind.runeword':    { en: 'Runeword', es: 'Palabra runica' },
    'inspect.kind.recipe':      { en: 'Recipe', es: 'Receta' },
    'inspect.kind.creature':    { en: 'Creature', es: 'Criatura' },
    'inspect.kind.realm':       { en: 'Realm', es: 'Reino' },
    'inspect.kind.quest':       { en: 'Quest', es: 'Mision' },
    'inspect.a11y.named':       { en: '{{name}}, {{kind}}', es: '{{name}}, {{kind}}' },
    'inspect.fact.price':       { en: 'Price', es: 'Precio' },
    'inspect.fact.worth':       { en: 'Worth', es: 'Valor' },
    'inspect.fact.sellValue':   { en: 'Sell value', es: 'Valor de venta' },
    'inspect.fact.effect':      { en: 'Effect', es: 'Efecto' },
    'inspect.fact.duration':    { en: 'Duration', es: 'Duracion' },
    'inspect.fact.rarity':      { en: 'Rarity', es: 'Rareza' },
    'inspect.fact.location':    { en: 'Location', es: 'Ubicacion' },
    'inspect.fact.drop':        { en: 'Drop chance', es: 'Probabilidad' },
    'inspect.fact.recipe':      { en: 'Recipe', es: 'Receta' },
    'inspect.fact.slot':        { en: 'Slot', es: 'Ranura' },
    'inspect.fact.status':      { en: 'Status', es: 'Estado' },
    'forge.recipe.locked':      { en: 'Listed. Not craftable yet.', es: 'En lista. Aun no se puede forjar.' },
    'forge.recipe.missing':     { en: 'Need', es: 'Falta' },
    'forge.recipe.craft':       { en: 'Craft', es: 'Forjar' },
    'forge.recipe.retry':       { en: 'Retry', es: 'Reintentar' },
    'forge.recipe.full':        { en: 'The satchel cannot take Basalt Edge. Clear a row first. Nothing was consumed.', es: 'La mochila no admite Basalt Edge. Libera una fila primero. No se consumio nada.' },
    'forge.recipe.persist':     { en: 'The strike did not save. Inputs and the weapon are unchanged.', es: 'El golpe no se guardo. Los insumos y el arma no cambiaron.' },
    'forge.recipe.made':        { en: '{{name}} is in the satchel.', es: '{{name}} esta en la mochila.' },
    'forge.recipe.openBag':     { en: 'Open in satchel', es: 'Abrir en la mochila' },
    'forge.recipe.ready':       { en: 'Ready to craft.', es: 'Listo para forjar.' },
    'inspect.action.equip':     { en: 'Equip weapon', es: 'Equipar arma' },
    'inspect.action.equipped':  { en: 'Already equipped', es: 'Ya equipado' },
    'inspect.fact.temper':      { en: 'Temper', es: 'Temple' },
    'inspect.fact.temperValue': { en: '+{{n}}', es: '+{{n}}' },
    // ── Reforge: the stat reroll (item-reforge.ts) ──────────────────────────
    'inspect.stat.strikePower': { en: '+{{pct}}% anvil yield', es: '+{{pct}}% de rendimiento en el yunque' },
    'inspect.stat.strikePower.mining': { en: 'seam recovers {{pct}}% faster', es: 'la veta se recupera un {{pct}}% mas rapido' },
    'inspect.stat.ward':        { en: 'turns {{pct}}% of temper failures aside', es: 'desvia el {{pct}}% de los fallos de temple' },
    'forge.recipe.title':       { en: 'Equipment recipes', es: 'Recetas de equipo' },
    'forge.recipe.sub':         { en: 'Six Cinder Ore and one Ember Residue become Basalt Edge. No Gold.', es: 'Seis Cinder Ore y un Ember Residue se vuelven Basalt Edge. Sin oro.' },
    'forge.title':              { en: 'Rune Forge', es: 'Forja de runas' },
    'forge.stat.forges':        { en: 'Forges', es: 'Forjas' },
    'forge.roll.dock':          { en: 'Roll', es: 'Lanzar' },
    'forge.roll.auto':          { en: 'Auto ×10', es: 'Auto ×10' },
    'forge.roll.auto.done':     { en: '{{n}} strikes · ✦ {{new}} new', es: '{{n}} golpes · ✦ {{new}} nuevas' },
    'forge.roll.actions':       { en: 'Roll again', es: 'Volver a lanzar' },
    'forge.roll.again':         { en: 'Roll again', es: 'Otra vez' },
    'forge.roll.all':           { en: 'ALL', es: 'TODO' },
    'forge.roll.best':          { en: 'Best of the run', es: 'Lo mejor de la tanda' },
    'forge.roll.progress':      { en: 'Striking… {{done}} / {{total}}', es: 'Golpeando… {{done}} / {{total}}' },
    'forge.roll.stop':          { en: 'Stop', es: 'Parar' },
    'forge.roll.auto.start':    { en: 'Auto', es: 'Auto' },
    'forge.roll.auto.stop':     { en: 'Stop auto', es: 'Parar auto' },
    'forge.roll.auto.stoppedFind': { en: 'Auto stopped — {{tier}} or better landed.', es: 'Auto detenido — cayo {{tier}} o mejor.' },
    'forge.roll.auto.stoppedGold': { en: 'Out of Gold. Earn more in the World, then pull again.', es: 'Sin oro. Consigue mas en el Mundo y vuelve a lanzar.' },
    'forge.library.title':      { en: 'Your rune library', es: 'Tu biblioteca' },
    'forge.library.stats':      { en: 'Collection', es: 'Coleccion' },
    'forge.library.done':       { en: 'The Archivum knows your name', es: 'El Archivum conoce tu nombre' },
    'forge.pill.complete':      { en: 'complete', es: 'completo' },
    'forge.pill.new':           { en: 'New', es: 'Nuevas' },
    'forge.tabs':               { en: 'Forge sections', es: 'Secciones de la forja' },
    'forge.tab.runes':          { en: 'Runes', es: 'Runas' },
    'forge.tab.runewords':      { en: 'Runewords', es: 'Palabras' },
    'forge.tab.equipment':      { en: 'Equipment', es: 'Equipo' },
    'forge.filters':            { en: 'Filters', es: 'Filtros' },
    'forge.filter.all':         { en: 'All', es: 'Todas' },
    'forge.filter.common':      { en: 'Common', es: 'Comun' },
    'forge.filter.uncommon':    { en: 'Uncommon', es: 'Poco comun' },
    'forge.filter.rare':        { en: 'Rare', es: 'Rara' },
    'forge.filter.epic':        { en: 'Epic', es: 'Epica' },
    'forge.filter.legendary':   { en: 'Legendary', es: 'Legendaria' },
    'forge.filter.mythic':      { en: 'Mythic', es: 'Mitica' },
    'forge.filter.singular':    { en: 'Singular', es: 'Singular' },
    'forge.search':             { en: 'Search runes...', es: 'Buscar runas...' },
    'forge.sort':               { en: 'Sort', es: 'Orden' },
    'forge.sort.rarity':        { en: 'Rarity', es: 'Rareza' },
    'forge.sort.newest':        { en: 'Newest', es: 'Recientes' },
    'forge.sort.name':          { en: 'Name A–Z', es: 'Nombre' },
    'forge.sort.collection':    { en: 'Collection order', es: 'Orden de album' },
    'forge.card.new':           { en: 'New', es: 'Nueva' },
    'forge.card.found':         { en: 'Discovered', es: 'Descubierta' },
    'forge.card.locked':        { en: 'Locked', es: 'Cerrada' },
    'forge.card.dup':           { en: 'Duplicate', es: 'Duplicada' },
    'forge.card.unknown':       { en: 'Unknown', es: 'Desconocida' },
    'forge.card.kind':          { en: 'Rune', es: 'Runa' },
    'forge.empty':              { en: 'The Archivum is empty. Your first mark is waiting.', es: 'El Archivum esta vacio. Tu primera marca espera.' },
    'forge.empty.more':         { en: 'unknown', es: 'desconocidas' },
    'forge.word.locked':        { en: 'Discover a required rune to reveal this word.', es: 'Descubre una runa requerida para revelar esta palabra.' },
    'forge.word.found':         { en: 'found', es: 'halladas' },
    'forge.word.set':           { en: 'Set the word', es: 'Fijar la palabra' },
    'forge.word.missing':       { en: 'Runes missing', es: 'Faltan runas' },
    'forge.word.live':          { en: 'Set. Its effect is live.', es: 'Fijada. El efecto esta activo.' },
    'forge.reveal.title':       { en: 'Rune revealed', es: 'Runa revelada' },
    'forge.reveal.new':         { en: 'New rune discovered', es: 'Nueva runa descubierta' },
    'forge.reveal.dup':         { en: 'Rune found', es: 'Runa hallada' },
    'forge.reveal.owned':       { en: 'Already discovered', es: 'Ya descubierta' },
    'forge.reveal.done':        { en: 'Add to library', es: 'Anadir a la biblioteca' },
    'forge.reveal.haul':        { en: 'Also in the strike', es: 'Tambien en el golpe' },
    'forge.reveal.item':        { en: 'Equippable', es: 'Equipable' },
    'forge.reveal.scroll':      { en: 'Lore scroll', es: 'Pergamino' },
    'forge.reveal.explorer':    { en: 'Explorer joins', es: 'Se une un explorador' },
    'forge.reveal.essence':     { en: 'Eclipse Essence', es: 'Esencia de Eclipse' },
    'forge.reveal.readScroll':  { en: 'Read the scroll', es: 'Leer el pergamino' },
    'forge.reveal.hideScroll':  { en: 'Fold the scroll', es: 'Doblar el pergamino' },
    'forge.reveal.batchHaul':   { en: '{{items}} equippables · {{scrolls}} scrolls · {{explorers}} explorers', es: '{{items}} equipables · {{scrolls}} pergaminos · {{explorers}} exploradores' },
    'forge.detail.close':       { en: 'Close', es: 'Cerrar' },
    'forge.detail.used':        { en: 'Used in', es: 'Se usa en' },
    'forge.detail.none':        { en: 'No runeword uses this mark yet.', es: 'Ninguna palabra usa esta marca aun.' },
    'inspect.fact.faction':     { en: 'Faction', es: 'Faccion' },
    'inspect.fact.landmark':    { en: 'Landmark', es: 'Hito' },
    'inspect.fact.hazard':      { en: 'Hazard', es: 'Peligro' },
    'inspect.fact.realm':       { en: 'Realm', es: 'Reino' },
    'inspect.fact.type':        { en: 'Type', es: 'Tipo' },
    'inspect.fact.reward':      { en: 'Reward', es: 'Recompensa' },
    'inspect.fact.xp':          { en: '{{amount}} XP', es: '{{amount}} XP' },
    'inspect.location.bag':     { en: 'Satchel', es: 'Mochila' },
    'inspect.location.equipped':{ en: 'Loadout — {{slot}}', es: 'Equipo — {{slot}}' },
    'inspect.location.explorer':{ en: 'Held by explorer', es: 'En manos de un explorador' },
    'inspect.location.vault':   { en: 'In your Vault', es: 'En tu Bóveda' },
    'inspect.action.dossier':   { en: 'Open dossier', es: 'Abrir expediente' },

    'market.eyebrow':           { en: 'The Godforge Market', es: 'El Mercado de la Godforge' },
    'market.gold':              { en: 'Gold', es: 'Oro' },
    'market.free':              { en: 'Free', es: 'Gratis' },
    'market.buy.free':          { en: 'Take {{name}} — free', es: 'Toma {{name}} — gratis' },
    'market.scout.title':       { en: 'Send a Scout first',
                                  es: 'Envia primero un Explorador' },
    'market.scout.body':        { en: 'Free, two minutes, and it comes back with a minute of your forge\'s income (at least 90 Gold). You already have the explorers.',
                                  es: 'Gratis, dos minutos, y vuelve con un minuto de lo que gana tu forja (al menos 90 de Oro). Ya tienes a los exploradores.' },
    'market.essence':           { en: 'Eclipse Essence', es: 'Esencia Eclipse' },
    'market.shards':            { en: 'Eclipse Shards', es: 'Fragmentos Eclipse' },
    'market.total':             { en: 'Total value', es: 'Valor total' },
    'market.totalHint':         { en: 'Gold, plus Essence valued at the Artifact shelf\'s own rate.', es: 'Oro, mas Esencia valorada al ritmo del estante de artefactos.' },
    'market.running':           { en: 'is running —', es: 'esta activo —' },
    'market.search':            { en: 'Search the market', es: 'Buscar en el mercado' },
    'market.searchPlaceholder': { en: 'Search items...', es: 'Buscar objetos...' },
    'market.searchClear':       { en: 'Clear search', es: 'Borrar busqueda' },
    'market.filters':           { en: 'Filters', es: 'Filtros' },
    'market.everything':        { en: 'Everything', es: 'Todo' },
    'market.all':               { en: 'All', es: 'Todo' },
    'market.rarity':            { en: 'Rarity', es: 'Rareza' },
    'market.ownership':         { en: 'Ownership', es: 'Posesion' },
    'market.ownership.all':     { en: 'All listings', es: 'Todas las ofertas' },
    'market.ownership.available': { en: 'Available', es: 'Disponibles' },
    'market.ownership.owned':   { en: 'Owned', es: 'En posesión' },
    'market.ownership.affordable': { en: 'Affordable', es: 'Al alcance' },
    'market.sort':              { en: 'Sort', es: 'Orden' },
    'market.sort.recommended':  { en: 'Recommended', es: 'Recomendado' },
    'market.sort.name-asc':     { en: 'Name', es: 'Nombre' },
    'market.sort.rarity-desc':  { en: 'Rarity', es: 'Rareza' },
    'market.sort.price-asc':    { en: 'Price, low to high', es: 'Precio, menor a mayor' },
    'market.sort.price-desc':   { en: 'Price, high to low', es: 'Precio, mayor a menor' },
    'market.sort.owned-first':  { en: 'Owned first', es: 'En posesion primero' },
    'market.clearFilters':      { en: 'Clear all filters', es: 'Quitar todos los filtros' },
    'market.chips':             { en: 'Active filters', es: 'Filtros activos' },
    'market.clearChip':         { en: 'Remove {{name}}', es: 'Quitar {{name}}' },
    'market.shelves':           { en: 'Market shelves', es: 'Estantes del mercado' },
    'market.empty':             { en: 'Nothing on the shelves matches that.', es: 'Nada en los estantes coincide.' },
    'market.showEverything':    { en: 'Show everything', es: 'Mostrar todo' },
    'market.error':             { en: 'The catalogue could not be shown. The shelves are still here.', es: 'No se pudo mostrar el catalogo. Los estantes siguen aqui.' },
    'market.retry':             { en: 'Retry', es: 'Reintentar' },
    'market.returnWorld':       { en: 'Return to the world', es: 'Volver al mundo' },
    'market.picks':             { en: 'Catalogue picks', es: 'Seleccion del catalogo' },
    'market.picksSub':          { en: 'Static recommendations from the local catalogue.', es: 'Recomendaciones fijas del catalogo local.' },
    'market.pickFind':          { en: 'Show {{name}} in the catalogue', es: 'Mostrar {{name}} en el catalogo' },
    'market.eclipse':           { en: 'The Eclipse', es: 'El Eclipse' },
    'market.buy.ok':            { en: 'Purchased.', es: 'Comprado.' },
    'market.buy.queued':        { en: 'Saved locally; sync pending.', es: 'Guardado en este dispositivo; sincronizacion pendiente.' },
    'market.buy.stale':         { en: 'The price changed. Check the listing.', es: 'El precio cambio. Revisa la oferta.' },
    'market.buy.ineligible':    { en: 'That listing cannot be bought right now.', es: 'Esa oferta no se puede comprar ahora.' },
    'market.buy.insufficient-funds': { en: 'Not enough currency for that listing.', es: 'No hay suficiente moneda para esa oferta.' },
    'market.buy.in-flight':     { en: 'Buying…', es: 'Comprando…' },
    'market.buy.not-found':     { en: 'That listing is not in the catalogue.', es: 'Esa oferta no esta en el catalogo.' },
    'market.buy.maxed':         { en: 'That upgrade is already held at its cap.', es: 'Esa mejora ya esta al maximo.' },
    'market.buy.owned':         { en: 'You already own that.', es: 'Ya lo tienes.' },
    'market.buy.weaker':        { en: 'A stronger enchantment is already running.', es: 'Ya hay un encantamiento mas fuerte en curso.' },
    'market.buy.conflict':      { en: 'That purchase lost a sync conflict and was not taken.', es: 'Esa compra perdio un conflicto de sincronizacion y no se aplico.' },
    'market.rarity.mortal':     { en: 'Mortal', es: 'Mortal' },
    'market.rarity.eclipsed':   { en: 'Eclipsed', es: 'Eclipsado' },
    'market.rarity.sacred':     { en: 'Sacred', es: 'Sagrado' },
    'market.rarity.anomalous':  { en: 'Anomalous', es: 'Anomalo' },
    'market.rarity.mythic':     { en: 'Mythic', es: 'Mitico' },
    'market.rarity.singular':   { en: 'Singular', es: 'Singular' },
    'market.cat.forge':         { en: 'Forge Upgrades', es: 'Mejoras de forja' },
    'market.cat.hammer':        { en: 'Hammers', es: 'Martillos' },
    'market.cat.automaton':     { en: 'Automatons', es: 'Automatas' },
    'market.cat.mastery':       { en: 'Mastery', es: 'Maestria' },
    'market.cat.expedition':    { en: 'Expeditions', es: 'Expediciones' },
    'market.cat.thrall':        { en: 'Forge Thralls', es: 'Siervos de la Forja' },
    'market.cat.enchant':       { en: 'Enchantments', es: 'Encantamientos' },
    'market.cat.artifact':      { en: 'Artifacts', es: 'Artefactos' },
    'market.cat.cosmetic':      { en: 'Cosmetics', es: 'Cosmeticos' },
    'market.catShort.forge':    { en: 'Forge', es: 'Forja' },
    'market.catShort.hammer':   { en: 'Hammers', es: 'Martillos' },
    'market.catShort.automaton':{ en: 'Automatons', es: 'Automatas' },
    'market.catShort.mastery':  { en: 'Mastery', es: 'Maestria' },
    'market.catShort.expedition': { en: 'Expeditions', es: 'Expediciones' },
    'market.catShort.thrall':   { en: 'Thralls', es: 'Siervos' },
    'market.catShort.enchant':  { en: 'Enchants', es: 'Encantos' },
    'market.catShort.artifact': { en: 'Artifacts', es: 'Artefactos' },
    'market.catShort.cosmetic': { en: 'Cosmetics', es: 'Cosmeticos' },
    'market.thrall.lead':       { en: 'Assign them, equip them and watch the shift from', es: 'Asignalos, equipalos y observa el turno desde' },
    'market.thrall.link':       { en: 'the Inner Sanctum', es: 'el Santuario Interior' },
    'market.thrall.tally':      { en: '{{owned}} of {{max}} bound · {{working}} of {{slots}} at the anvil.', es: '{{owned}} de {{max}} vinculados · {{working}} de {{slots}} en el yunque.' },
    'market.expedition.lead':   { en: 'You send them from', es: 'Los envias desde' },
    'market.expedition.link':   { en: 'the Forge View', es: 'la Vista de la Forja' },
    'market.expedition.all':    { en: 'All {{count}} hired — one for every realm.', es: 'Los {{count}} contratados — uno por cada reino.' },
    'market.expedition.some':   { en: '{{have}} of {{max}} hired.', es: '{{have}} de {{max}} contratados.' },
    'market.eclipse.lede':      { en: 'An Eclipse wipes your Gold and every Gold upgrade, and hands you Eclipse Shards — permanent, immune to every reset after it, and worth {{percent}}% on everything, each.', es: 'Un Eclipse borra tu Oro y cada mejora de Oro, y te entrega Fragmentos Eclipse — permanentes, inmunes a cada reinicio posterior, y valen {{percent}}% sobre todo, cada uno.' },
    'market.eclipse.held':      { en: 'Shards held', es: 'Fragmentos en poder' },
    'market.eclipse.bonus':     { en: 'Permanent bonus', es: 'Bonificacion permanente' },
    'market.eclipse.taken':     { en: 'Eclipses taken', es: 'Eclipses tomados' },
    'market.eclipse.waiting':   { en: 'Waiting for you', es: 'Esperandote' },
    'market.eclipse.shardIs':   { en: 'shard is waiting.', es: 'fragmento te espera.' },
    'market.eclipse.shardsAre': { en: 'shards are waiting.', es: 'fragmentos te esperan.' },
    'market.eclipse.raises':    { en: 'Taking them raises your permanent bonus to', es: 'Tomarlos sube tu bonificacion permanente a' },
    'market.eclipse.reset':     { en: 'Reset the Eclipse', es: 'Reiniciar el Eclipse' },
    'market.eclipse.confirm':   { en: 'Confirm the Eclipse', es: 'Confirmar el Eclipse' },
    'market.eclipse.warn':      { en: 'This takes {{gold}} Gold and {{cost}} across the Forge, Hammer, Automaton and Mastery shelves. It does not touch your rank, your Essence, your artifacts, your cosmetics or anything on the Codex wall.', es: 'Esto toma {{gold}} de Oro y {{cost}} en los estantes de Forja, Martillo, Autómata y Maestria. No toca tu rango, tu Esencia, tus artefactos, tus cosmeticos ni nada en el muro del Codex.' },
    'market.eclipse.noUndo':    { en: 'There is no undo.', es: 'No hay deshacer.' },
    'market.eclipse.take':      { en: 'Take the {{count}} shards', es: 'Tomar los {{count}} fragmentos' },
    'market.eclipse.notYet':    { en: 'Not yet', es: 'Todavia no' },
    'market.eclipse.progress':  { en: 'Progress toward the Eclipse', es: 'Progreso hacia el Eclipse' },
    'market.eclipse.gate':      { en: 'The Eclipse opens at {{gold}} Gold earned all-time, or at rank {{rank}} — whichever you reach first, so long as there is at least one shard in it.', es: 'El Eclipse se abre a {{gold}} de Oro ganado en total, o al rango {{rank}} — lo que llegue primero, siempre que haya al menos un fragmento.' },
    'market.eclipse.earned':    { en: '{{gold}} earned so far.', es: '{{gold}} ganado hasta ahora.' },
    'market.eclipse.done':      { en: 'The forge is cold and the sky is yours. +{{granted}} Eclipse Shards — {{total}} held, {{mult}} on everything, forever.', es: 'La forja esta fria y el cielo es tuyo. +{{granted}} Fragmentos Eclipse — {{total}} en poder, {{mult}} sobre todo, para siempre.' },
    'market.patron.head':       { en: 'Become a Godforge Patron', es: 'Hazte Patron de la Godforge' },
    'market.patron.sub':        { en: 'Exclusive items & early access', es: 'Objetos exclusivos y acceso anticipado' },
    'market.patron.lore':       { en: 'The forge runs on Gold. Everything around it runs on people who decided it should keep running.', es: 'La forja corre con Oro. Todo alrededor corre con gente que decidio que debia seguir.' },
    'market.ledger':            { en: 'Gold income breakdown', es: 'Desglose de ingreso de Oro' },
    'market.ledger.total':      { en: 'Total', es: 'Total' },
    'market.ledger.resolved':   { en: 'everything above, resolved', es: 'todo lo anterior, resuelto' },
    'market.stat.minute':       { en: 'Per minute', es: 'Por minuto' },
    'market.stat.strike':       { en: 'Per strike', es: 'Por golpe' },
    'market.stat.auto':         { en: 'Auto', es: 'Auto' },
    'market.stat.lifetime':     { en: 'Lifetime', es: 'Acumulado' },
    'market.stat.strikes':      { en: 'Strikes', es: 'Golpes' },
    'market.whisper':           { en: 'the forge does not care whether you are watching. it only cares that you came back.', es: 'a la forja no le importa si miras. solo le importa que volviste.' },
    'market.link.orders':       { en: 'The Standing Orders', es: 'Las Ordenes Permanentes' },
    'market.link.codex':        { en: 'The Codex', es: 'El Codex' },
    'market.link.forge':        { en: 'The Forge', es: 'La Forja' },

    // ─── Payment fallback copy ─────────────────────────────────────────────

};

  constructor() {
    // Precedence: ?lang= in the URL, then the saved preference, then English.
    //
    // The query param has to win, so that the Spanish view is linkable and
    // shareable — a localStorage-only preference never was.
    //
    // It is a reader-facing feature only. `?lang=es` used to be advertised to
    // crawlers as an hreflang alternate; those tags are gone, because nothing
    // on the serving path can honour the parameter. Production is prerender
    // plus a static CSR shell, this branch is browser-only, and Hosting hands
    // `/world?lang=es` the same English `world/index.html` it hands `/world`.
    // See the note in seo.service.ts.
    const saved = this.isBrowser ? localStorage.getItem('preferred-language') : null;
    const language = this.readLanguageFromUrl() ?? this.normalize(saved) ?? DEFAULT_LANGUAGE;
    this.currentLanguageSubject.next(language);
    this.reflectLanguageOnDocument(language);
  }

  /** `?lang=es` / `?lang=en`. Anything unsupported is ignored rather than trusted. */
  private readLanguageFromUrl(): string | null {
    if (!this.isBrowser) return null;
    return this.normalize(new URLSearchParams(window.location.search).get('lang'));
  }

  private normalize(language: string | null): string | null {
    return language && (SUPPORTED_LANGUAGES as readonly string[]).includes(language) ? language : null;
  }

  /**
   * Keep <html lang> honest. It drives screen-reader pronunciation, and a page
   * serving Spanish while still declaring lang="en" mispronounces every word
   * of it.
   */
  private reflectLanguageOnDocument(language: string): void {
    if (!this.isBrowser) return;
    document.documentElement.lang = language;
  }

  setLanguage(language: string): void {
    this.currentLanguageSubject.next(language);
    this.reflectLanguageOnDocument(language);
    if (this.isBrowser) localStorage.setItem('preferred-language', language);
  }

  /**
   * Merge a lazily-loaded string table — a route chunk's own copy, e.g.
   * station-ui.i18n.ts — into the live one. This table ships in the initial
   * bundle, so copy only one lazy page uses belongs in that page's chunk.
   * Keys already declared here win. Declared keys are checked by
   * scripts/check-i18n-keys.js, which reads every `*.i18n.ts` too.
   */
  register(table: Readonly<Translations>): void {
    for (const key of Object.keys(table)) this.translations[key] ??= table[key];
  }

  getCurrentLanguage(): string {
    return this.currentLanguageSubject.value;
  }

  translate(key: string, vars?: Record<string, string | number>): string {
    const currentLang = this.getCurrentLanguage();
    const translation = this.translations[key];
    let text = (translation && translation[currentLang as 'en' | 'es'])
      || translation?.en
      || key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.split(`{{${name}}}`).join(String(value));
      }
    }
    return text;
  }
}

