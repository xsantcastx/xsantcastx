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
    // Navigation

    // ── The Godforge command bar ─────────────────────────────────────────
    // Realm *names* are deliberately absent: they come from REALMS in
    // realm.model.ts and are proper nouns in the lore, untranslated in both
    // languages exactly as the tools page already renders them.
    'gfnav.brand':        { en: 'Eclipse Realms', es: 'Eclipse Realms' },
    'gfnav.brandLabel':   { en: 'Eclipse Realms — World', es: 'Eclipse Realms — Mundo' },
    'gfnav.world':        { en: 'World',         es: 'Mundo' },
    'gfnav.character':    { en: 'Character',     es: 'Personaje' },
    'gfnav.market':       { en: 'Market',        es: 'Mercado' },
    'gfnav.forge':        { en: 'Forge',         es: 'Forja' },
    'gfnav.codex':        { en: 'Codex',         es: 'Codice' },
    'gfnav.trials':       { en: 'Trials',        es: 'Pruebas' },
    'gfnav.quests':       { en: 'Quests',        es: 'Misiones' },
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
    'gfnav.sanctum':      { en: 'Sanctum',       es: 'Santuario' },

    'gfnav.section.main':      { en: 'Main',      es: 'Principal' },
    'gfnav.section.more':      { en: 'More',      es: 'Mas' },

    'gfnav.welcomeBack':  { en: 'Welcome back',  es: 'Bienvenido' },
    'gfnav.keeperLabel':  { en: 'Your Forge — rank, inventory and achievements', es: 'Tu forja: rango, inventario y logros' },
    'gfnav.menuLabel':    { en: 'Open the tome',  es: 'Abrir el tomo' },
    'gfnav.closeLabel':   { en: 'Close the tome', es: 'Cerrar el tomo' },
    'gfnav.tabsLabel':    { en: 'Primary',        es: 'Principal' },
    'gfnav.tomeArtTitle': { en: 'Eclipse Realms', es: 'Eclipse Realms' },
    'gfnav.tomeArtSub':   { en: 'A persistent world', es: 'Un mundo persistente' },

    // ── Cloud save ───────────────────────────────────────────────────────
    // The chip in the command bar. "Sign In" rather than "Save Progress" on
    // purpose: the control opens a Google account chooser, and a label that
    // does not say so makes the popup read as something the page did rather
    // than something it asked for.
    'cloud.signIn':      { en: 'Sign In', es: 'Entrar' },
    'cloud.signInLabel': {
      en: 'Sign in with Google so your progress follows you between devices',
      es: 'Entra con Google para que tu progreso te siga entre dispositivos',
    },
    'cloud.synced':      { en: 'Synced',      es: 'Sincronizado' },
    'cloud.syncing':     { en: 'Syncing',     es: 'Sincronizando' },
    'cloud.syncFailed':  { en: 'Sync failed', es: 'Fallo la sincronizacion' },

    'gfnav.hint.world':     { en: 'The world entrance',              es: 'La entrada al mundo' },
    'gfnav.hint.arena':     { en: 'Games forged in the eclipse',     es: 'Juegos forjados en el eclipse' },
    'gfnav.hint.codex':     { en: 'Fragments of a broken sun',       es: 'Fragmentos de un sol roto' },
    'gfnav.hint.market':    { en: 'Spend gold, sharpen the forge',   es: 'Gasta oro, afila la forja' },
    'gfnav.hint.runeForge': { en: 'Craft runes, words, and later weapons', es: 'Forja runas, palabras y mas adelante armas' },
    'gfnav.hint.quests':    { en: 'Daily, weekly and epic trials',   es: 'Pruebas diarias, semanales y epicas' },
    'gfnav.hint.keeper':    { en: 'Your rank and everything you own', es: 'Tu rango y todo lo que posees' },
    'gfnav.hint.sanctum':   { en: 'Your explorers, your expeditions', es: 'Tus exploradores, tus expediciones' },

    'gffoot.forgedBy':    { en: 'Forged by xsantcastx',            es: 'Forjado por xsantcastx' },
    'gffoot.forge':       { en: 'Forge',        es: 'Forja' },
    'gffoot.play':        { en: 'Play',         es: 'Juega' },
    'gffoot.build':       { en: 'Build',        es: 'Construye' },
    'gffoot.together':    { en: 'Together',     es: 'Juntos' },
    'gffoot.nextThing':   { en: 'The next thing is yours', es: 'Lo siguiente es tuyo' },

    // ── The entrance ─────────────────────────────────────────────────────
    'godforge.status.name':         { en: 'Eclipse Realms', es: 'Eclipse Realms' },
    'godforge.status.online':       { en: 'Status: Online', es: 'Estado: en linea' },
    'godforge.status.codexEntries': { en: 'Codex Entries',  es: 'Entradas del codice' },
    'godforge.status.forgeLevel':   { en: 'Forge Level',    es: 'Nivel de forja' },
    'godforge.status.viewFull':     { en: 'View full stats', es: 'Ver estadisticas' },

    'godforge.welcome.hd':    { en: 'Welcome',  es: 'Bienvenido' },
    'godforge.welcome.level': { en: 'Level',    es: 'Nivel' },
    'godforge.hero.descend':  { en: 'Scroll to descend', es: 'Desplaza para descender' },

    // Hero Section

    // Services Section

    // Projects Section

    // About Section

    // Skills Section

    // Contact Section

    // Donation Form

    // Footer
    // These two were referenced but never defined. `translate()` falls back to
    // returning the key, which is truthy — so the `|| 'Address copied'` idiom
    // at the call site never fired and the toast literally read "footer.copied".
    'footer.copied': { en: 'Address copied to clipboard', es: 'Direccion copiada al portapapeles' },
    'footer.copy.error': { en: 'Could not copy the address', es: 'No se pudo copiar la direccion' },
    'footer.paypal.title': { en: 'PayPal portal', es: 'Portal PayPal' },
    'footer.paypal.desc': { en: 'Send fuel through PayPal — a secure, instant signal.', es: 'Envia combustible por PayPal — senal segura e instantanea.' },
    'footer.paypal.note': { en: 'Every drop of fuel keeps a new tool shipping.', es: 'Cada gota de combustible mantiene una herramienta nueva en orbita.' },
    'footer.stripe.title': { en: 'Card portal', es: 'Portal de Tarjeta' },
    'footer.stripe.desc': { en: 'Send fuel by card — a secure, instant signal.', es: 'Envia combustible con tarjeta — senal segura e instantanea.' },
    'footer.stripe.note': { en: 'Encrypted by Stripe — your card never crosses my orbit.', es: 'Cifrado por Stripe — tu tarjeta nunca cruza mi orbita.' },
    'footer.donation': { en: 'Donation', es: 'Donacion' },
    'footer.amount': { en: 'Amount', es: 'Cantidad' },
    'footer.custom.amount': { en: 'Custom Amount', es: 'Cantidad Personalizada' },
    'footer.custom.placeholder': { en: 'Enter amount (min $1)', es: 'Ingresa una cantidad (minimo $1)' },
    'footer.custom.invalid': { en: 'Please enter a valid amount (minimum $1)', es: 'Ingresa una cantidad valida (minimo $1)' },
    'footer.processing': { en: 'Processing...', es: 'Procesando...' },
    'footer.success': { en: 'Thank you for your support!', es: 'Gracias por tu apoyo!' },
    'footer.error': { en: 'Payment failed. Please try again.', es: 'El pago fallo. Intenta de nuevo.' },

    // ─── Tools section ────────────────────────────────────────────────────────

    // Tools landing page

    // ── /tools — The Five Realms ──────────────────────────────────────────
    // The map's own copy. `godforge.forges.*` says the same things on the
    // landing page, but in the voice of a section inside a longer scroll;
    // these are the words for a page that IS the map.

    // One or two lines on what each realm holds — the gate's own description,
    // distinct from the codex `quote` that sits beneath it.
    // Shared button + UI panel labels — reusable across all tool templates (i18n batch 2026-04-26)

    // Tool category eyebrows — shared across every tool header

    // ─── Per-tool headers (title / subtitle) ──────────────────────────────────
    // Batch 1 — highest-traffic tools

    // Batch 2 — JSON / data / minifier tools

    // Batch 3 — text / markdown / encoding tools

    // Batch 4 — CSS / design-system / color tools

    // Batch 5 — network / device / image tools

    // Batch 6 — SEO / security / project-config tools

    // Batch 7 — DevOps references, productivity and data tools

    // HAR File Analyzer

    // Batch 8 — remaining CSS / TypeScript / utility tools

    // Batch 9 — CSS generators (TranslationService was injected in an earlier
    // pass, but their headers were still hardcoded English)

    // Batch 10 — email/security/SVG tools with headers still hardcoded

    // Tool card titles & descriptions
    'tools.pdf.title': { en: 'PDF Catalog Generator', es: 'Generador de Catálogo PDF' },
    'tools.pdf.desc': { en: 'Upload images, configure layout and captions, and export a polished catalog-style PDF — entirely in your browser. No uploads, no accounts.', es: 'Sube imágenes, configura el diseño y los textos, y exporta un PDF estilo catálogo elegante — todo en tu navegador. Sin subidas, sin cuentas.' },
    'tools.color.title': { en: 'Color Palette Extractor', es: 'Extractor de Paleta de Colores' },
    'tools.color.desc': { en: 'Upload any image and instantly extract its dominant colors. Copy hex, RGB or HSL values, export as CSS variables, Tailwind config, or JSON.', es: 'Sube cualquier imagen y extrae al instante sus colores dominantes. Copia valores hex, RGB o HSL, exporta como variables CSS, config de Tailwind o JSON.' },
    'tools.contrast.title': { en: 'Contrast Checker', es: 'Verificador de Contraste' },
    'tools.contrast.desc': { en: 'Check WCAG AA/AAA contrast ratios between any two colors. Instant pass/fail for text, UI components, and large text thresholds.', es: 'Verifica las relaciones de contraste WCAG AA/AAA entre dos colores. Resultado inmediato para texto, componentes UI y texto grande.' },
    'tools.compressor.title': { en: 'Image Compressor', es: 'Compresor de Imágenes' },
    'tools.compressor.desc': { en: 'Compress JPEG, PNG and WebP images in your browser with live quality preview. Batch compress, no uploads, no accounts — files never leave your device.', es: 'Comprime imágenes JPEG, PNG y WebP en tu navegador con vista previa de calidad en tiempo real. Compresión por lotes, sin subidas, sin cuentas.' },
    'tools.gradient.title': { en: 'Gradient Generator', es: 'Generador de Gradientes' },
    'tools.gradient.desc': { en: 'Build CSS gradients visually — linear, radial and conic. Add stops, adjust angles, copy ready-to-use CSS with one click.', es: 'Crea gradientes CSS visualmente — lineales, radiales y cónicos. Agrega paradas, ajusta ángulos, copia CSS listo para usar con un clic.' },

    // Color Palette page

    // Contrast Checker page

    // Image Compressor page

    // PDF Generator page

    // SVG to Code Converter

    // Cookie Banner / GDPR Consent
    'cookies.banner.title': { en: 'Cookie preferences', es: 'Preferencias de cookies' },
    'cookies.banner.description': { en: 'Tiny analytics breadcrumbs help us see which stars get visited most.', es: 'Pequenas migas de analytics nos ayudan a ver que estrellas se visitan mas.' },
    'cookies.banner.details': { en: 'No personal data is sold or shared — we just count footsteps in the cosmos.', es: 'No se vende ni se comparte ningun dato personal — solo contamos pisadas en el cosmos.' },
    'cookies.accept': { en: 'Accept Analytics', es: 'Aceptar Analytics' },
    'cookies.deny': { en: 'Essential Only', es: 'Solo Esenciales' },
    'cookies.banner.aria': { en: 'Cookie consent banner', es: 'Banner de consentimiento de cookies' },
    'cookies.accept.aria': { en: 'Accept analytics cookies', es: 'Aceptar cookies de analytics' },
    'cookies.deny.aria': { en: 'Use essential cookies only', es: 'Usar solo cookies esenciales' },

    // ─── Cosmic eyebrows + taglines ────────────────────────────────────────

    // ─── Guestbook cosmic copy ─────────────────────────────────────────────

    // ─── Cosmic anchor planet ──────────────────────────────────────────────

    // ─── The Godforge — homepage ───────────────────────────────────────────
    // The Eclipse Realms layer over the home page. Lore vocabulary, but every
    // number under it is real: artifacts are registry tools, paths are the
    // prerendered routes, fragments are registered easter eggs.
    'godforge.hero.eyebrow':   { en: 'The Engine of Creation',                     es: 'El motor de la creacion' },
    'godforge.hero.title':     { en: 'Eclipse Realms',                             es: 'Eclipse Realms' },
    'godforge.hero.sub':       { en: 'A persistent world of five Eclipse Realms — wander, collect, and forge your legend.', es: 'Un mundo persistente de cinco Reinos del Eclipse — explora, colecciona y forja tu leyenda.' },
    'godforge.hero.toNext':    { en: 'XP to',                                      es: 'XP para' },
    'godforge.hero.maxRank':   { en: 'the Eclipse is yours',                       es: 'el Eclipse es tuyo' },
    'godforge.hero.cta':       { en: 'Walk the Realms',                            es: 'Camina los reinos' },
    'godforge.hero.ctaLive':   { en: 'Open your Character',                        es: 'Abre tu personaje' },

    'godforge.pulse.fragments': { en: 'Fragments Hidden',   es: 'Fragmentos ocultos' },
    'godforge.pulse.realms':    { en: 'Realms to Explore',  es: 'Reinos por explorar' },

    'godforge.forges.eyebrow':   { en: 'The Five Places', es: 'Los cinco lugares' },
    'godforge.forges.title':     { en: 'The Five Realms', es: 'Los cinco reinos' },
    'godforge.forges.tagline':   { en: 'five places, five incomplete answers — inspect a landmark, a hazard, and an unresolved conflict', es: 'cinco lugares, cinco respuestas incompletas — inspecciona un hito, un peligro y un conflicto sin resolver' },

    // ── The Rune Forge band on /home ─────────────────────────────────────
    // The lede names the odds rather than promising a feeling. "One in two
    // thousand" is the Void's real rate, and a number a visitor can check is
    // worth more here than an adjective they cannot.
    'godforge.anvil.eyebrow':         { en: 'The Rune Forge',           es: 'La Forja de Runas' },
    'godforge.anvil.title':           { en: 'Strike the Anvil',         es: 'Golpea el yunque' },
    'godforge.anvil.lede':            { en: 'Twenty-five runes, seven tiers, and a Void that falls once in two thousand strikes. Set them into Runewords for permanent bonuses — and every strike may turn up a page of the codex as well.',
                                        es: 'Veinticinco runas, siete rangos, y un Vacio que cae una vez cada dos mil golpes. Combinalas en Palabras de Runa para bonificaciones permanentes, y cada golpe puede sacar tambien una pagina del codice.' },
    'godforge.anvil.runes':           { en: 'runes',                    es: 'runas' },
    'godforge.anvil.scrolls':         { en: 'scrolls',                  es: 'pergaminos' },
    'godforge.anvil.words':           { en: 'runewords',                es: 'palabras' },
    'godforge.anvil.cta':             { en: 'Strike the Forge →',       es: 'Golpea la forja →' },
    'godforge.anvil.cost':            { en: '10,000 Gold a strike',     es: '10.000 de oro por golpe' },

    'godforge.journey.eyebrow':       { en: 'Begin Your Journey',       es: 'Comienza tu viaje' },
    'godforge.journey.title':         { en: 'The Eclipse is a pressure, not a prize', es: 'El Eclipse es una presion, no un premio' },
    'godforge.journey.creed':         { en: 'Five realms hold five incomplete answers. Inspect them before anyone claims to have fixed the fracture.', es: 'Cinco reinos guardan cinco respuestas incompletas. Inspeccionalos antes de que alguien pretenda haber reparado la fractura.' },
    'godforge.journey.continue':      { en: 'Continue Journey',         es: 'Continua el viaje' },
    'godforge.journey.startWith':     { en: 'Or open',                 es: 'O abre' },
    'godforge.journey.arenaLabel':    { en: 'Prove yourself in',       es: 'Demuestra tu valia en' },
    'godforge.journey.arena':         { en: 'The Arena',               es: 'La arena' },
    'godforge.journey.arenaHint':     { en: 'fragments buried across the realms', es: 'fragmentos enterrados por los reinos' },

    // ─── Realm dossier and Fivefold Lock chrome (lore stays in narrative data) ─
    'world.crumb.label':        { en: 'Breadcrumb', es: 'Migas de navegacion' },
    'world.crumb.world':        { en: 'World', es: 'Mundo' },
    'world.realm.status':       { en: 'Place open. Opening chapter not yet playable.', es: 'Lugar abierto. El capitulo de apertura aun no se puede jugar.' },
    'world.realm.statusPlayable': { en: 'Place open. The Price of a Seam is playable.', es: 'Lugar abierto. El Precio de una Costura se puede jugar.' },
    'world.realm.witnessRuneLive': { en: 'Witness Rune from this chapter:', es: 'Runa Testigo de este capitulo:' },
    'world.realm.facts':        { en: 'Place and pressure', es: 'Lugar y presion' },
    'world.realm.landmark':     { en: 'Landmark', es: 'Hito' },
    'world.realm.hazard':       { en: 'Hazard', es: 'Peligro' },
    'world.realm.resource':     { en: 'Resource', es: 'Recurso' },
    'world.realm.threat':       { en: 'Threat', es: 'Amenaza' },
    'world.realm.conflict':     { en: 'Unresolved conflict', es: 'Conflicto sin resolver' },
    'world.realm.people':       { en: 'Who waits here', es: 'Quien espera aqui' },
    'world.realm.peopleNote':   { en: 'Inspection only. No standing or choice is recorded yet.', es: 'Solo inspeccion. Todavia no se registra afinidad ni eleccion.' },
    'world.realm.peopleNotePlayable': { en: 'Meet them, then record one brace. Standing is not scored.', es: 'Conocelos y registra un refuerzo. No se puntua afinidad.' },
    'world.realm.wants':        { en: 'Wants', es: 'Desea' },
    'world.realm.bond':         { en: 'Bond', es: 'Vinculo' },
    'world.realm.witnessRune':  { en: 'Witness Rune when the chapter ships:', es: 'Runa Testigo cuando el capitulo se publique:' },
    'world.realm.continue':     { en: 'Continue Journey', es: 'Continua el viaje' },
    'world.realm.enter':        { en: 'Enter {{name}}', es: 'Entra en {{name}}' },
    'world.realm.continueTo':   { en: 'Continue to {{name}}', es: 'Continua hacia {{name}}' },
    'world.realm.notPlayableHere': { en: '{{chapter}} is not yet playable. The {{landmark}} can be inspected.', es: '{{chapter}} aun no se puede jugar. Se puede inspeccionar {{landmark}}.' },
    'world.realm.notPlayableNext': { en: '{{chapter}} is not yet playable. Inspect the {{landmark}} next.', es: '{{chapter}} aun no se puede jugar. Inspecciona {{landmark}} a continuacion.' },
    // A2 Foraging — the Verdant landing's site link
    'world.realm.statusVerdant': { en: 'Place open. The Rootglass Canopy is open for Foraging; the opening chapter is not yet playable.', es: 'Lugar abierto. El Rootglass Canopy esta abierto para recolectar; el capitulo de apertura aun no se puede jugar.' },
    'world.realm.siteLabel': { en: 'Work here', es: 'Trabaja aqui' },
    'world.realm.statusCelestial': { en: 'Place open. The Meridian Orrery is open for Prospecting; the opening chapter is not yet playable.', es: 'Lugar abierto. El Meridian Orrery esta abierto para prospeccion; el capitulo de apertura aun no se puede jugar.' },
    'world.realm.orreryNote': { en: 'Survey the rings for alloy, prism and shard. Prospecting is the only rewarded action there.', es: 'Sondea los anillos por aleacion, prisma y esquirla. La prospeccion es la unica accion recompensada alli.' },
    'world.realm.canopyNote': { en: 'Gather herbs under the rootglass. Foraging is the only rewarded action there.', es: 'Recolecta hierbas bajo el rootglass. Recolectar es la unica accion recompensada alli.' },
    'world.realm.playableNext': { en: '{{chapter}} is playable. Choose at the {{landmark}}.', es: '{{chapter}} se puede jugar. Elige en {{landmark}}.' },
    'world.realm.unknownTitle': { en: 'This place is not on the map', es: 'Este lugar no esta en el mapa' },
    'world.realm.unknownBody':  { en: 'No realm named {{id}} is part of the five. The World still holds Celestial, Infernal, Luminous, Umbral, and Verdant.', es: 'Ningun reino llamado {{id}} forma parte de los cinco. El Mundo sigue teniendo Celestial, Infernal, Luminous, Umbral y Verdant.' },
    'world.realm.return':       { en: 'Return to the World', es: 'Volver al Mundo' },
    'world.realm.titlePage':    { en: '{{name}} — Eclipse Realms', es: '{{name}} — Eclipse Realms' },
    'world.realm.titleUnknown': { en: 'Unknown place — Eclipse Realms', es: 'Lugar desconocido — Eclipse Realms' },
    'world.lock.answers':       { en: 'Five incomplete answers', es: 'Cinco respuestas incompletas' },
    'world.lock.remedy':        { en: '{{faction}} wants a necessary but incomplete remedy.', es: '{{faction}} quiere un remedio necesario pero incompleto.' },
    'world.atlas.region':       { en: 'Fractured Realms atlas', es: 'Atlas de los Reinos Fracturados' },
    'world.atlas.hint':         { en: 'Choose a realm to inspect its dossier.', es: 'Elige un reino para inspeccionar su expediente.' },
    'world.atlas.list':         { en: 'Realm list', es: 'Lista de reinos' },
    'world.atlas.open':         { en: 'Open the {{name}} dossier', es: 'Abre el expediente de {{name}}' },
    'world.atlas.label.celestial': { en: 'Celestial Realm', es: 'Reino Celestial' },
    'world.atlas.label.luminous':  { en: 'Luminous Realm', es: 'Reino Luminous' },
    'world.atlas.label.infernal':  { en: 'Infernal Realm', es: 'Reino Infernal' },
    'world.atlas.label.umbral':    { en: 'Umbral Realm', es: 'Reino Umbral' },
    'world.atlas.label.verdant':   { en: 'Verdant Realm', es: 'Reino Verdant' },
    'world.atlas.desc.celestial': {
      en: 'Celestial Realm — observatory plateaus, star paths, and orbital structures',
      es: 'Reino Celestial — mesetas observatorio, caminos de estrellas y estructuras orbitales',
    },
    'world.atlas.desc.luminous': {
      en: 'Luminous Realm — dawn-lit terraces, prism spires, and crystal light',
      es: 'Reino Luminous — terrazas del amanecer, agujas de prisma y luz de cristal',
    },
    'world.atlas.desc.infernal': {
      en: 'Infernal Realm — basalt calderas, forge channels, and ember fissures',
      es: 'Reino Infernal — calderas de basalto, canales de forja y fisuras de brasa',
    },
    'world.atlas.desc.umbral': {
      en: 'Umbral Realm — mirrored ravines, moonlit glass, and hidden rifts',
      es: 'Reino Umbral — barrancos espejo, cristal de luna y grietas ocultas',
    },
    'world.atlas.desc.verdant': {
      en: 'Verdant Realm — living rootwood, bioluminescent groves, and renewal',
      es: 'Reino Verdant — madera raiz viva, arboledas bioluminiscentes y renovacion',
    },

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
    'levelUp.eyebrow': { en: 'Level up', es: 'Subida de nivel' },
    'levelUp.milestone': { en: 'Milestone reached', es: 'Hito alcanzado' },
    'levelUp.title': { en: '{{skill}} — Level {{level}}', es: '{{skill}} — Nivel {{level}}' },
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

    'infernal.eyebrow': { en: 'Opening chapter', es: 'Capitulo de apertura' },
    'infernal.title': { en: 'The Price of a Seam', es: 'El precio de una costura' },
    'infernal.lede': { en: 'A slag tide has cut the works. The calibration shard will not wait, and neither option is free.', es: 'Una marea de escoria ha cortado las obras. El fragmento de calibracion no espera, y ninguna opcion es gratis.' },
    'infernal.steps.label': { en: 'Chapter steps', es: 'Pasos del capitulo' },
    'infernal.step.enter': { en: 'Enter', es: 'Entrar' },
    'infernal.step.meet': { en: 'Meet', es: 'Conocer' },
    'infernal.step.inspect': { en: 'Inspect', es: 'Inspeccionar' },
    'infernal.step.choose': { en: 'Choose', es: 'Elegir' },
    'infernal.step.consequence': { en: 'Consequence', es: 'Consecuencia' },
    'infernal.enter.body': { en: 'The Keeper arrives at a bridge just as a slag tide cuts the Seamworks into isolated platforms.', es: 'El Guardian llega a un puente justo cuando una marea de escoria corta Seamworks en plataformas aisladas.' },
    'infernal.enter.continue': { en: 'Meet who waits here', es: 'Conoce a quien espera' },
    'infernal.meet.body': { en: 'Mara asks for the shard. Edrin asks you to inspect the heat line beneath the workers homes before agreeing.', es: 'Mara pide el fragmento. Edrin pide que inspecciones la linea de calor bajo las casas de los obreros antes de aceptar.' },
    'infernal.meet.continue': { en: 'Inspect the evidence', es: 'Inspecciona la evidencia' },
    'infernal.inspect.body': { en: 'The emergency solution works, but its harm is specific and predictable.', es: 'La solucion de emergencia funciona, pero su dano es especifico y predecible.' },
    'infernal.inspect.continue': { en: 'Choose a brace', es: 'Elige un refuerzo' },
    'infernal.evidence.fracture.title': { en: 'Fracture pattern', es: 'Patron de fractura' },
    'infernal.evidence.fracture.body': { en: 'The shard will hold if it is bound now. Delay lets the Seam Eater reach the join.', es: 'El fragmento aguantara si se ata ahora. Retrasar deja que el Devorador de Costuras alcance la junta.' },
    'infernal.evidence.ledger.title': { en: 'District heat ledger', es: 'Libro de calor del distrito' },
    'infernal.evidence.ledger.body': { en: 'A central brace redirects the surge through Edrin\'s district. The names on the ledger are specific, not abstract.', es: 'Un refuerzo central desvia la oleada por el distrito de Edrin. Los nombres del libro son concretos, no abstractos.' },
    'infernal.evidence.brace.title': { en: 'Unfinished oathsteel brace', es: 'Refuerzo de oathsteel inacabado' },
    'infernal.evidence.brace.body': { en: 'A slower distributed brace keeps heat in the works. It risks losing the shard and leaves visible damage across the landmark.', es: 'Un refuerzo distribuido mas lento deja el calor en las obras. Arriesga el fragmento y deja dano visible en el hito.' },
    'infernal.choose.body': { en: 'Authorize the emergency central brace, or commit the shard to the distributed brace and hold the line against the Seam Eater.', es: 'Autoriza el refuerzo central de emergencia, o entrega el fragmento al refuerzo distribuido y aguanta la linea contra el Devorador de Costuras.' },
    'infernal.choice.central.title': { en: 'Emergency central brace', es: 'Refuerzo central de emergencia' },
    'infernal.choice.central.body': { en: 'Save the works now. Mark Edrin\'s district for heat rationing.', es: 'Salva las obras ahora. Marca el distrito de Edrin para racion de calor.' },
    'infernal.choice.central.consequence': { en: 'The works hold. Heat rationing is already posted on Edrin\'s street. The cost has a name.', es: 'Las obras aguantan. La racion de calor ya esta publicada en la calle de Edrin. El costo tiene nombre.' },
    'infernal.choice.distributed.title': { en: 'Distributed brace', es: 'Refuerzo distribuido' },
    'infernal.choice.distributed.body': { en: 'Protect the district. Accept lost output and visible damage across the Seamworks.', es: 'Protege el distrito. Acepta menos produccion y dano visible en Seamworks.' },
    'infernal.choice.distributed.consequence': { en: 'The district stays livable. Output falls, and unfinished joins show across the landmark.', es: 'El distrito sigue habitable. La produccion cae, y las juntas inacabadas se ven en el hito.' },
    'infernal.consequence.kicker': { en: 'Immediate consequence', es: 'Consecuencia inmediata' },
    'infernal.rune': { en: 'You receive Witness Rune: {{rune}}. It is a record, not a currency.', es: 'Recibes la Runa Testigo: {{rune}}. Es un registro, no una moneda.' },
    'infernal.later': { en: 'Umbral can inspect this heat-shadow later. Mining starts at Basalt Seamworks now.', es: 'Umbral podra inspeccionar esta sombra de calor despues. La mineria empieza ahora en Basalt Seamworks.' },
    'infernal.next': { en: 'Go to Basalt Seamworks', es: 'Ir a Basalt Seamworks' },
    'infernal.persist': { en: 'The choice did not save. Last confirmed state is unchanged.', es: 'La eleccion no se guardo. El ultimo estado confirmado no cambio.' },
    'infernal.retry': { en: 'Retry', es: 'Reintentar' },

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
    'seamworks.status.capacity': { en: 'Inventory cannot accept {{ore}}.', es: 'El inventario no puede aceptar {{ore}}.' },
    'seamworks.status.location': { en: 'Mining requires Basalt Seamworks as Current Work.', es: 'Minar exige Basalt Seamworks como trabajo actual.' },
    'seamworks.status.persist': { en: 'Last confirmed totals are kept. Retry or refresh.', es: 'Se conservan los totales confirmados. Reintenta o recarga.' },
    'seamworks.status.unavailable': { en: 'Mining is not available on this view.', es: 'Minar no esta disponible en esta vista.' },
    'seamworks.full': { en: 'The bag cannot take another {{ore}}. Drop something in the bag — you can keep mining while it is open. No XP or discovery is rolled while the bag is full.', es: 'La bolsa no admite otro {{ore}}. Tira algo en la bolsa — puedes seguir minando con ella abierta. No se tira XP ni descubrimiento con la bolsa llena.' },
    'seamworks.openBag': { en: 'Open bag', es: 'Abrir bolsa' },
    'seamworks.haul': { en: 'Ore in the bag', es: 'Mineral en la bolsa' },
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
    'seamworks.back': { en: 'Return to Infernal', es: 'Volver a Infernal' },
    'seamworks.refine.title': { en: 'Refining', es: 'Refinado' },
    'seamworks.refine.lede': { en: 'Three of a lower ore become one of the next. No XP and no level needed — surplus turns into progress.', es: 'Tres minerales de un grado se vuelven uno del siguiente. Sin XP y sin nivel — el excedente se convierte en progreso.' },
    'seamworks.refine.rule': { en: '{{n}} {{from}} → 1 {{to}}', es: '{{n}} {{from}} → 1 {{to}}' },
    'seamworks.refine.amount': { en: 'How many batches of {{from}}', es: 'Cuantas tandas de {{from}}' },
    'seamworks.refine.choice': { en: '×{{n}}', es: '×{{n}}' },
    'seamworks.refine.choiceMax': { en: 'Max ×{{n}}', es: 'Max ×{{n}}' },
    'seamworks.refine.action': { en: 'Refine ×{{n}}', es: 'Refinar ×{{n}}' },
    'seamworks.refine.confirm': { en: 'Refine {{consume}} {{from}} → {{produce}} {{to}}?', es: 'Refinar {{consume}} {{from}} → {{produce}} {{to}}?' },
    'seamworks.refine.short': { en: 'Needs {{need}} {{from}} · held ×{{held}}', es: 'Necesita {{need}} {{from}} · tienes ×{{held}}' },
    'seamworks.refine.capacity': { en: 'The bag has no room for {{to}}. Drop something in the bag first — your {{from}} stays untouched.', es: 'La bolsa no tiene sitio para {{to}}. Tira algo en la bolsa antes — tu {{from}} queda intacto.' },
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
    'canopy.discovery.pending': { en: 'Rare find: {{chance}}% Rift Key on any gather. The {{at}}th gather guarantees the first if none has appeared.', es: 'Hallazgo raro: {{chance}}% Rift Key en cualquier recoleccion. La recoleccion {{at}} garantiza la primera si no aparecio antes.' },
    'canopy.discovery.bonus': { en: 'Rare find: Rift Key.', es: 'Hallazgo raro: Rift Key.' },
    'canopy.discovery.guarantee': { en: 'Guaranteed find: Rift Key.', es: 'Hallazgo garantizado: Rift Key.' },
    'canopy.discovery.none': { en: 'No rare find this gather.', es: 'Sin hallazgo raro en esta recoleccion.' },
    'canopy.gather': { en: 'Gather', es: 'Recolectar' },
    'canopy.gather.wait': { en: 'Regrowing {{seconds}}s', es: 'Rebrotando {{seconds}}s' },
    'canopy.gather.resolving': { en: 'Resolving', es: 'Resolviendo' },
    'canopy.speedup': { en: 'Your level: growths regrow {{pct}}% faster.', es: 'Tu nivel: los brotes rebrotan {{pct}}% mas rapido.' },
    'canopy.status.available': { en: 'Gather is ready.', es: 'Recolectar esta listo.' },
    'canopy.status.resolving': { en: 'Resolving this gather.', es: 'Resolviendo esta recoleccion.' },
    'canopy.status.recovering': { en: 'Regrowing {{seconds}} seconds. Extra clicks do nothing.', es: 'Rebrotando {{seconds}} segundos. Clics extra no hacen nada.' },
    'canopy.status.capacity': { en: 'Inventory cannot accept {{herb}}.', es: 'El inventario no puede aceptar {{herb}}.' },
    'canopy.status.location': { en: 'Foraging requires Rootglass Canopy as Current Work.', es: 'Recolectar exige Rootglass Canopy como trabajo actual.' },
    'canopy.status.persist': { en: 'Last confirmed totals are kept. Retry or refresh.', es: 'Se conservan los totales confirmados. Reintenta o recarga.' },
    'canopy.status.unavailable': { en: 'Foraging is not available on this view.', es: 'Recolectar no esta disponible en esta vista.' },
    'canopy.full': { en: 'The bag cannot take another {{herb}}. Drop something in the bag — you can keep gathering while it is open. No XP or find is rolled while the bag is full.', es: 'La bolsa no admite otro {{herb}}. Tira algo en la bolsa — puedes seguir recolectando con ella abierta. No se tira XP ni hallazgo con la bolsa llena.' },
    'canopy.haul': { en: 'Herbs in the bag', es: 'Hierbas en la bolsa' },
    'canopy.away': { en: 'Foraging requires Rootglass Canopy. Return here to gather.', es: 'Recolectar exige Rootglass Canopy. Vuelve aqui para recolectar.' },
    'canopy.persist': { en: 'The gather did not save. Last confirmed herbs and XP are unchanged.', es: 'La recoleccion no se guardo. Las hierbas y el XP confirmados no cambiaron.' },
    'canopy.result.herb': { en: '{{herb}} +{{gain}} · held ×{{held}}', es: '{{herb}} +{{gain}} · tienes ×{{held}}' },
    'canopy.result.key': { en: 'NEW Rift Key +{{gain}} · held ×{{held}}', es: 'NUEVO Rift Key +{{gain}} · tienes ×{{held}}' },
    'canopy.result.xp': { en: 'Foraging +{{amount}} XP.', es: 'Recoleccion +{{amount}} XP.' },
    'canopy.note': { en: 'Leaving this place awards nothing. There is no background trickle.', es: 'Salir de este lugar no otorga nada. No hay goteo en segundo plano.' },
    'canopy.back': { en: 'Return to Verdant', es: 'Volver a Verdant' },

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
    'orrery.status.capacity': { en: 'Inventory cannot accept {{mineral}}.', es: 'El inventario no puede aceptar {{mineral}}.' },
    'orrery.status.location': { en: 'Prospecting requires Meridian Orrery as Current Work.', es: 'La prospeccion exige Meridian Orrery como trabajo actual.' },
    'orrery.status.persist': { en: 'Last confirmed totals are kept. Retry or refresh.', es: 'Se conservan los totales confirmados. Reintenta o recarga.' },
    'orrery.status.unavailable': { en: 'Prospecting is not available on this view.', es: 'La prospeccion no esta disponible en esta vista.' },
    'orrery.full': { en: 'The bag cannot take another {{mineral}}. Drop something in the bag — you can keep surveying while it is open. No XP or find is rolled while the bag is full.', es: 'La bolsa no admite otro {{mineral}}. Tira algo en la bolsa — puedes seguir sondeando con ella abierta. No se tira XP ni hallazgo con la bolsa llena.' },
    'orrery.haul': { en: 'Minerals in the bag', es: 'Minerales en la bolsa' },
    'orrery.away': { en: 'Prospecting requires Meridian Orrery. Return here to survey.', es: 'La prospeccion exige Meridian Orrery. Vuelve aqui para sondear.' },
    'orrery.persist': { en: 'The survey did not save. Last confirmed minerals and XP are unchanged.', es: 'El sondeo no se guardo. Los minerales y el XP confirmados no cambiaron.' },
    'orrery.result.mineral': { en: '{{mineral}} +{{gain}} · held ×{{held}}', es: '{{mineral}} +{{gain}} · tienes ×{{held}}' },
    'orrery.result.elixir': { en: 'NEW Clarity Elixir +{{gain}} · held ×{{held}}', es: 'NUEVO Clarity Elixir +{{gain}} · tienes ×{{held}}' },
    'orrery.result.xp': { en: 'Prospecting +{{amount}} XP.', es: 'Prospeccion +{{amount}} XP.' },
    'orrery.note': { en: 'Leaving this place awards nothing. There is no background trickle.', es: 'Salir de este lugar no otorga nada. No hay goteo en segundo plano.' },
    'orrery.back': { en: 'Return to Celestial', es: 'Volver a Celestial' },

    // ─── Character hub ────────────────────────────────────────────────────
    'hub.tabs': { en: 'Character sections', es: 'Secciones del personaje' },
    'hub.tab.loadout': { en: 'Loadout', es: 'Equipo' },
    'hub.tab.bank': { en: 'Bank', es: 'Banco' },
    'hub.tab.skills': { en: 'Skills', es: 'Habilidades' },
    'hub.tab.stats': { en: 'Stats', es: 'Datos' },
    'hub.tab.records': { en: 'Records', es: 'Archivo' },
    'hub.bank.title': { en: 'Bank', es: 'Banco' },
    'hub.bank.tag': { en: '{{n}} held', es: '{{n}} en posesion' },
    'hub.bank.new': { en: 'NEW', es: 'NUEVO' },
    'hub.bank.rare': { en: 'RARE', es: 'RARO' },
    'hub.bank.gain': { en: '+{{n}}', es: '+{{n}}' },
    'hub.bank.kinds': { en: 'Bank shelves', es: 'Estantes del banco' },
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
    'hub.bank.material': { en: 'Material', es: 'Material' },
    'hub.bank.rune': { en: 'Rune', es: 'Runa' },
    'hub.bank.runeword': { en: 'Runeword', es: 'Palabra runica' },
    'hub.skills.title': { en: 'Skills', es: 'Habilidades' },
    'hub.skills.tag': { en: 'Mining, Foraging and Prospecting are live. Other disciplines wait.', es: 'La mineria, la recoleccion y la prospeccion estan activas. Las otras disciplinas esperan.' },
    'hub.skills.xpLine': { en: '{{xp}} / {{next}} XP', es: '{{xp}} / {{next}} XP' },
    'hub.skills.toNext': { en: '{{n}} XP to level {{level}}', es: '{{n}} XP para el nivel {{level}}' },
    'hub.skills.capped': { en: 'Every rung the Seamworks has to give.', es: 'Todos los peldanos que las Costuras pueden dar.' },
    'hub.skills.cappedForaging': { en: 'Every rung the Canopy has to give.', es: 'Todos los peldanos que el Canopy puede dar.' },
    'hub.skills.cappedProspecting': { en: 'Every rung the Orrery has to give.', es: 'Todos los peldanos que el Orrery puede dar.' },
    'hub.skills.barLabel': { en: '{{name}} progress to the next level', es: 'Progreso de {{name}} al siguiente nivel' },
    'hub.skills.reserved': { en: 'Reserved', es: 'Reservada' },
    'hub.skills.later.exploration': { en: 'Exploration', es: 'Exploracion' },
    'hub.skills.later.forge': { en: 'Forge', es: 'Forja' },
    'hub.skills.later.hunting': { en: 'Hunting', es: 'Caza' },
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
    'loadout.picker.choose': { en: 'Equip from your bag', es: 'Equipar desde la bolsa' },
    'loadout.picker.none': { en: 'Nothing in your bag fits this slot yet.', es: 'Nada en tu bolsa encaja en esta ranura todavia.' },
    'loadout.picker.close': { en: 'Close slot', es: 'Cerrar ranura' },
    'loadout.unequip': { en: 'Unequip', es: 'Desequipar' },
    'loadout.compare.against': { en: 'Compared against {{name}}', es: 'Comparado con {{name}}' },
    'loadout.compare.upgrade': { en: 'upgrade', es: 'mejora' },
    'loadout.stat.gold': { en: 'Gold/sec', es: 'Oro/s' },
    'loadout.stat.mf': { en: 'MF', es: 'SM' },
    'loadout.stat.xp': { en: 'XP', es: 'XP' },
    'loadout.stat.strike': { en: 'Anvil yield', es: 'Rendimiento del yunque' },
    'loadout.stat.ward': { en: 'Temper fails', es: 'Fallos de temple' },
    'loadout.stat.empty': { en: 'Nothing equipped. Mine at Basalt Seamworks, craft an Edge, then temper it.', es: 'Nada equipado. Mina en Basalt Seamworks, forja un filo y templalo.' },
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
    'loadout.slot.locked': { en: 'Awaiting a compatible piece', es: 'Espera una pieza compatible' },
    'loadout.slot.announce.empty': { en: '{{name}}, empty', es: '{{name}}, vacio' },
    'loadout.slot.announce.filled': { en: '{{name}}, equipped {{item}}. Inspect.', es: '{{name}}, equipado {{item}}. Inspeccionar.' },
    'loadout.slot.announce.locked': { en: '{{name}}, locked until a compatible item exists', es: '{{name}}, bloqueado hasta que exista un objeto compatible' },
    'loadout.charms.title': { en: 'Charms', es: 'Encantos' },
    'loadout.charms.count': { en: '{{n}} of {{max}} worn', es: '{{n}} de {{max}} equipados' },
    'loadout.charms.empty': { en: 'Empty', es: 'Vacio' },
    'loadout.charms.hint': { en: '{{n}} in your bag. Tap a well to put one on.', es: '{{n}} en tu bolsa. Toca una ranura para ponerte uno.' },
    'loadout.charms.none': { en: 'No charms yet. They turn up at the anvil and come home from expeditions.', es: 'Aun no tienes encantos. Aparecen en el yunque y vuelven de las expediciones.' },
    'loadout.bag.full': { en: 'Bag is full. Drop a row to keep mining.', es: 'La bolsa esta llena. Tira una fila para seguir minando.' },
    'loadout.drop': { en: 'Drop', es: 'Tirar' },
    'loadout.drop.confirmTitle': { en: 'Drop item', es: 'Tirar objeto' },
    'loadout.drop.confirmBody': { en: 'Drop {{name}}? It is gone for good.', es: 'Tirar {{name}}? Se pierde para siempre.' },
    'loadout.drop.confirmStack': { en: 'How many {{name}}? You hold {{n}}.', es: 'Cuantos {{name}}? Tienes {{n}}.' },
    'loadout.drop.choiceSome': { en: 'Drop {{n}}', es: 'Tirar {{n}}' },
    'loadout.drop.choiceAll': { en: 'Drop all {{n}}', es: 'Tirar los {{n}}' },
    'loadout.drop.confirmYes': { en: 'Drop it', es: 'Tirarlo' },
    'loadout.drop.confirmNo': { en: 'Keep it', es: 'Guardarlo' },

    // ─── Quick Inspect chrome (PR4a, read-only) ────────────────────────────
    'inspect.title':            { en: 'Inspect', es: 'Inspeccionar' },
    'inspect.action':           { en: 'Inspect', es: 'Inspeccionar' },
    'inspect.close':            { en: 'Close', es: 'Cerrar' },
    'inspect.retry':            { en: 'Retry', es: 'Reintentar' },
    'inspect.loading':          { en: 'Loading record', es: 'Cargando registro' },
    'inspect.missingTitle':     { en: 'Record unavailable', es: 'Registro no disponible' },
    'inspect.missing':          { en: 'The record {{name}} is unavailable.', es: 'El registro {{name}} no esta disponible.' },
    'inspect.errorTitle':       { en: 'Could not load', es: 'No se pudo cargar' },
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
    'forge.recipe.full':        { en: 'The bag cannot take Basalt Edge. Clear a row first. Nothing was consumed.', es: 'La bolsa no admite Basalt Edge. Libera una fila primero. No se consumio nada.' },
    'forge.recipe.persist':     { en: 'The strike did not save. Inputs and the weapon are unchanged.', es: 'El golpe no se guardo. Los insumos y el arma no cambiaron.' },
    'forge.recipe.made':        { en: '{{name}} is in the bag.', es: '{{name}} esta en la bolsa.' },
    'forge.recipe.openBag':     { en: 'Open in bag', es: 'Abrir en la bolsa' },
    'forge.recipe.ready':       { en: 'Ready to craft.', es: 'Listo para forjar.' },
    'inspect.action.equip':     { en: 'Equip weapon', es: 'Equipar arma' },
    'inspect.action.equipped':  { en: 'Already equipped', es: 'Ya equipado' },
    'inspect.fact.temper':      { en: 'Temper', es: 'Temple' },
    'inspect.fact.temperValue': { en: '+{{n}}', es: '+{{n}}' },
    'inspect.temper.level':     { en: 'Temper {{n}} / {{max}}', es: 'Temple {{n}} / {{max}}' },
    'inspect.temper.cost':      { en: '{{gold}} · {{mats}} · {{chance}}% chance', es: '{{gold}} · {{mats}} · {{chance}}% de exito' },
    'inspect.temper.act':       { en: 'Temper', es: 'Templar' },
    'inspect.temper.okDelta':   { en: 'It held. Temper {{n}} — here is what changed:', es: 'Aguanto. Temple {{n}}: esto es lo que cambio:' },
    'inspect.temper.max':       { en: 'Fully tempered — {{n}} / {{max}}. Nothing more to add.', es: 'Temple completo: {{n}} / {{max}}. No hay mas que anadir.' },
    'inspect.temper.fail':      { en: 'No change — the piece is intact. The Gold and materials listed above were spent.', es: 'Sin cambios: la pieza esta intacta. El oro y los materiales indicados arriba se gastaron.' },
    'inspect.temper.blocked':   { en: 'Need more Gold or materials.', es: 'Falta oro o materiales.' },
    'inspect.temper.ward':      { en: 'Your ward turns {{pct}}% of failures aside.', es: 'Tu guarda desvia el {{pct}}% de los fallos.' },
    // ── Reforge: the stat reroll (item-reforge.ts) ──────────────────────────
    'inspect.reforge.lede':     { en: 'Reforge rerolls every stat from {{gold}}.', es: 'Reforjar vuelve a tirar todas las estadisticas desde {{gold}}.' },
    'inspect.reforge.act':      { en: 'Reforge', es: 'Reforjar' },
    'inspect.reforge.warn':     { en: 'This rerolls every stat inside this rarity. It can come out worse. Rarity and temper level are untouched.', es: 'Esto vuelve a tirar todas las estadisticas dentro de esta rareza. Puede salir peor. La rareza y el nivel de temple no cambian.' },
    'inspect.reforge.lock':     { en: 'Lock', es: 'Fijar' },
    'inspect.reforge.locked':   { en: 'Locked', es: 'Fijada' },
    'inspect.reforge.lockOne':  { en: 'Lock {{stat}} and reroll the rest', es: 'Fija {{stat}} y vuelve a tirar el resto' },
    'inspect.reforge.lockCost': { en: '{{stat}} held — double price.', es: '{{stat}} fijada: precio doble.' },
    'inspect.reforge.cost':     { en: 'Cost: {{gold}}', es: 'Coste: {{gold}}' },
    'inspect.reforge.confirm':  { en: 'Strike the anvil', es: 'Golpea el yunque' },
    'inspect.reforge.cancel':   { en: 'Keep this roll', es: 'Conservar esta tirada' },
    'inspect.reforge.rolling':  { en: 'The anvil rings. The stats are still settling.', es: 'El yunque suena. Las estadisticas aun se asientan.' },
    'inspect.reforge.again':    { en: 'Done', es: 'Listo' },
    'inspect.reforge.held':     { en: 'held', es: 'fijada' },
    'inspect.reforge.heldTag':  { en: 'locked', es: 'fijada' },
    'inspect.reforge.same':     { en: 'no change', es: 'sin cambios' },
    'inspect.reforge.result.better': { en: 'The reroll came out ahead.', es: 'La tirada salio mejor.' },
    'inspect.reforge.result.worse':  { en: 'The reroll came out behind. The Gold was spent.', es: 'La tirada salio peor. El oro se gasto.' },
    'inspect.reforge.result.even':   { en: 'The reroll came out level.', es: 'La tirada salio igual.' },
    'inspect.reforge.error.funds':   { en: 'Not enough Gold for this reforge.', es: 'No hay oro suficiente para esta reforja.' },
    'inspect.reforge.error.kind':    { en: 'This piece has no rolled stats to reforge.', es: 'Esta pieza no tiene estadisticas tiradas que reforjar.' },
    'inspect.reforge.error.missing': { en: 'That piece is no longer in the bag.', es: 'Esa pieza ya no esta en la bolsa.' },
    'inspect.reforge.error.persist': { en: 'The reforge did not save. Nothing was spent — try again.', es: 'La reforja no se guardo. No se gasto nada: intentalo de nuevo.' },
    'inspect.reforge.error.clock':   { en: 'The reforge could not start. Try again.', es: 'La reforja no pudo empezar. Intentalo de nuevo.' },
    'inspect.reforge.error.ssr':     { en: 'Reforge is not available on this view.', es: 'Reforjar no esta disponible en esta vista.' },
    'inspect.stat.strikePower': { en: '+{{pct}}% anvil yield', es: '+{{pct}}% de rendimiento en el yunque' },
    'inspect.stat.strikePower.mining': { en: 'seam recovers {{pct}}% faster', es: 'la veta se recupera un {{pct}}% mas rapido' },
    'inspect.stat.ward':        { en: 'turns {{pct}}% of temper failures aside', es: 'desvia el {{pct}}% de los fallos de temple' },
    'forge.recipe.title':       { en: 'Equipment recipes', es: 'Recetas de equipo' },
    'forge.recipe.sub':         { en: 'Six Cinder Ore and one Ember Residue become Basalt Edge. No Gold.', es: 'Seis Cinder Ore y un Ember Residue se vuelven Basalt Edge. Sin oro.' },
    'forge.title':              { en: 'Rune Forge', es: 'Forja de runas' },
    'forge.tag':                { en: 'Collect. Discover. Forge.', es: 'Colecciona. Descubre. Forja.' },
    'forge.stat.gold':          { en: 'Gold', es: 'Oro' },
    'forge.stat.forges':        { en: 'Forges', es: 'Forjas' },
    'forge.roll':               { en: 'Roll new rune', es: 'Lanzar runa' },
    'forge.roll.need':          { en: 'Need {{gold}} more gold', es: 'Faltan {{gold}} de oro' },
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
    'forge.pill.found':         { en: 'found', es: 'halladas' },
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
    'inspect.location.bag':     { en: 'Bag', es: 'Bolsa' },
    'inspect.location.equipped':{ en: 'Loadout — {{slot}}', es: 'Equipo — {{slot}}' },
    'inspect.location.explorer':{ en: 'Held by explorer', es: 'En manos de un explorador' },
    'inspect.action.dossier':   { en: 'Open dossier', es: 'Abrir expediente' },

    'market.eyebrow':           { en: 'The Godforge Market', es: 'El Mercado de la Godforge' },
    'market.title':             { en: 'Everything the forge will sell you', es: 'Todo lo que la forja te vendera' },
    'market.tagline':           { en: 'gold is patience, essence is proof — spend both on a forge that keeps working after you close the tab', es: 'el oro es paciencia, la esencia es prueba — gasta ambos en una forja que sigue trabajando al cerrar la pestana' },
    'market.gold':              { en: 'Gold', es: 'Oro' },
    'market.owned.n': { en: 'Owned x{{n}}', es: 'Tienes x{{n}}' },
    'market.essence':           { en: 'Eclipse Essence', es: 'Esencia Eclipse' },
    'market.shards':            { en: 'Eclipse Shards', es: 'Fragmentos Eclipse' },
    'market.rate':              { en: 'Gold / second', es: 'Oro / segundo' },
    'market.total':             { en: 'Total value', es: 'Valor total' },
    'market.totalHint':         { en: 'Gold, plus Essence valued at the Artifact shelf\'s own rate.', es: 'Oro, mas Esencia valorada al ritmo del estante de artefactos.' },
    'market.running':           { en: 'is running —', es: 'esta activo —' },
    'market.search':            { en: 'Search the market', es: 'Buscar en el mercado' },
    'market.searchPlaceholder': { en: 'Search items...', es: 'Buscar objetos...' },
    'market.searchClear':       { en: 'Clear search', es: 'Borrar busqueda' },
    'market.filters':           { en: 'Filters', es: 'Filtros' },
    'market.categories':        { en: 'Categories', es: 'Categorias' },
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
    'market.filteredCount':     { en: '{{count}} listings', es: '{{count}} ofertas' },
    'market.empty':             { en: 'Nothing on the shelves matches that.', es: 'Nada en los estantes coincide.' },
    'market.showEverything':    { en: 'Show everything', es: 'Mostrar todo' },
    'market.error':             { en: 'The catalogue could not be shown. The shelves are still here.', es: 'No se pudo mostrar el catalogo. Los estantes siguen aqui.' },
    'market.retry':             { en: 'Retry', es: 'Reintentar' },
    'market.returnWorld':       { en: 'Return to the world', es: 'Volver al mundo' },
    'market.pages':             { en: 'Market pages', es: 'Paginas del mercado' },
    'market.page':              { en: 'Page {{n}} of {{m}}', es: 'Pagina {{n}} de {{m}}' },
    'market.prev':              { en: 'Previous page', es: 'Pagina anterior' },
    'market.next':              { en: 'Next page', es: 'Pagina siguiente' },
    'market.picks':             { en: 'Catalogue picks', es: 'Seleccion del catalogo' },
    'market.picksSub':          { en: 'Static recommendations from the local catalogue.', es: 'Recomendaciones fijas del catalogo local.' },
    'market.pickFind':          { en: 'Show {{name}} in the catalogue', es: 'Mostrar {{name}} en el catalogo' },
    'market.eclipse':           { en: 'The Eclipse', es: 'El Eclipse' },
    'market.buy':               { en: 'Buy {{name}} for {{price}} {{currency}}', es: 'Comprar {{name}} por {{price}} {{currency}}' },
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
    'market.state.buy':         { en: 'Buy', es: 'Comprar' },
    'market.state.locked':      { en: 'Locked', es: 'Bloqueado' },
    'market.state.held':        { en: 'Held', es: 'En poder' },
    'market.state.owned':       { en: 'Owned', es: 'En posesion' },
    'market.state.running':     { en: 'Running', es: 'Activo' },
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
    'market.cat.enchant':       { en: 'Enchantments', es: 'Encantamientos' },
    'market.cat.artifact':      { en: 'Artifacts', es: 'Artefactos' },
    'market.cat.cosmetic':      { en: 'Cosmetics', es: 'Cosmeticos' },
    'market.catShort.forge':    { en: 'Forge', es: 'Forja' },
    'market.catShort.hammer':   { en: 'Hammers', es: 'Martillos' },
    'market.catShort.automaton':{ en: 'Automatons', es: 'Automatas' },
    'market.catShort.mastery':  { en: 'Mastery', es: 'Maestria' },
    'market.catShort.expedition': { en: 'Expeditions', es: 'Expediciones' },
    'market.catShort.enchant':  { en: 'Enchants', es: 'Encantos' },
    'market.catShort.artifact': { en: 'Artifacts', es: 'Artefactos' },
    'market.catShort.cosmetic': { en: 'Cosmetics', es: 'Cosmeticos' },
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
    'footer.stripe.notReady':       { en: '✦ The card portal is still tuning in. Try Crypto or PayPal — or refresh in a few seconds to retry.', es: '✦ El portal de tarjetas aun se esta sintonizando. Prueba Crypto o PayPal — o recarga en unos segundos.' },

    // ─── Trust microcopy ───────────────────────────────────────────────────

    // ─── JSON Formatter page (i18n batch 2026-04-26) ──────────────────────────

    // ─── Hash Generator page (i18n batch 2026-04-26) ──────────────────────────

    // Tool input placeholders — batch

    // Tool input placeholders — batch

    // Tool input placeholders — batch

    // Tool input placeholders — batch

    // Tool input placeholders — batch

    // Tool input placeholders — batch
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

