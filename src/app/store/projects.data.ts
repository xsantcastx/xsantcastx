/**
 * projects.data.ts — the projects store's catalogue (owner's decision, 2026-11-18).
 *
 * One entry per project. Adding a project to the store is adding one object to
 * PROJECTS: the carousel, the shelves, the category chips, search, the
 * `/apps/<id>` route (app-routing.module.ts), the prerender list and the JSON-LD
 * all read from here. The only other step is a line in prerender-routes.txt.
 *
 * Everything in this file is public copy. No private repository links, no
 * admin links, no contact addresses, no analytics ids.
 */
import { SITE_URL } from '../seo.service';

/** The three design systems the store wears. `skin` selects its token set in styles/tokens/_store.css. */
export type StoreSkin = 'decanter' | 'cronta' | 'eclipse';

export type ProjectCategory = 'games' | 'mac' | 'web';
export type ProjectStatus = 'live' | 'soon';

/** A screenshot-strip item: a captured image, or a small drawn sample screen (see project-detail). */
export type ProjectShot =
  | { kind: 'image'; src: string; width: number; height: number; alt: string; caption: string }
  | { kind: 'mock'; mock: 'cronta-clock' | 'cronta-whos-in' | 'cronta-week'; alt: string; caption: string };

export interface ProjectCta {
  label: string;
  /** Disabled-looking primary (not yet available): rendered as a non-interactive button. */
  disabled?: boolean;
  /** Internal route, e.g. `/play`. */
  route?: string;
  /** External URL, opened with rel="noopener". */
  href?: string;
  /** A file to download in the same tab (with the `download` attribute), e.g. a GitHub release file. */
  download?: string;
}

export interface StoreProject {
  id: string;
  name: string;
  skin: StoreSkin;
  status: ProjectStatus;
  /** One-line pitch, shown on cards. */
  pitch: string;
  /** Two sentences at most, shown in the carousel and the detail hero. */
  blurb: string;
  /** Small label above the title in the carousel. */
  kicker: string;
  categories: ProjectCategory[];
  /** Platform tags on cards. */
  platforms: string[];
  /** One line under the CTA, e.g. price and requirements. */
  note: string;
  cta: ProjectCta;
  /** The shelf rows this project appears on (by shelf id). */
  shelves: string[];
  /** Square icon: a raster, or the logo symbol svg. */
  icon: { src: string; alt: string };
  /** Hero artwork for the carousel slide and the detail hero (optional). */
  art?: { src: string; alt: string; width: number; height: number };
  features: string[];
  /** Label / value rows in "Platform and requirements". */
  requirements: { label: string; value: string }[];
  shots: ProjectShot[];
  /**
   * The donate section (`#support` on the detail page). Shown only when `href` is set: a Stripe
   * Payment Link where the donor picks the amount. Decanter's Help › Support Decanter opens it.
   */
  support?: { title: string; text: string; label: string; note: string; href: string };
  /** A public GitHub repo whose release downloads are counted on the detail page ("Downloaded N times"). */
  downloadsRepo?: string;
  /** A page listing what works (Decanter's games), linked from the detail page. */
  gamesPage?: { route: string; text: string; label: string };
  /** Questions and answers, shown on the detail page and as FAQPage structured data. */
  faq?: { q: string; a: string }[];
  seo: { title: string; description: string; ogImage?: string };
  /** Machine-readable app facts for JSON-LD. */
  schema: {
    type: 'VideoGame' | 'SoftwareApplication';
    applicationCategory: string;
    operatingSystem: string;
    free?: boolean;
    url: string;
  };
}

/** Decanter's Stripe Payment Link (public). Empty hides the donate section. */
export const DECANTER_DONATE_URL = 'https://donate.stripe.com/7sY8wO0PX2DUbNW22x5sA00';

export const STORE_TITLE = 'xsantcastx — projects: a browser RPG, a Mac app and a time clock';
export const STORE_DESCRIPTION =
  'Projects by xsantcastx: Eclipse Realms, a pixel-art online RPG you play in your browser; Decanter, a free Mac app for Windows games; and Cronta, a time clock for small shops.';

export interface StoreShelf {
  id: string;
  title: string;
  subtitle: string;
}

export const SHELVES: readonly StoreShelf[] = [
  { id: 'play', title: 'Play now', subtitle: 'Free, in your browser' },
  { id: 'apps', title: 'Apps', subtitle: 'Made to be used every day' },
  { id: 'soon', title: 'Coming soon', subtitle: 'In the works' },
];

export const CATEGORY_CHIPS: readonly { id: 'all' | ProjectCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'games', label: 'Games' },
  { id: 'mac', label: 'Mac apps' },
  { id: 'web', label: 'Web apps' },
];

const A = '/assets/projects';

export const PROJECTS: readonly StoreProject[] = [
  {
    id: 'eclipse-realms',
    name: 'Eclipse Realms',
    skin: 'eclipse',
    status: 'live',
    pitch: 'A pixel-art online RPG with dark dungeons and loot to chase.',
    blurb: 'Pick a calling, walk a shared world of hand-made maps and dark dungeons, and hunt for loot with rolled affixes. Free, in your browser.',
    kicker: 'Play now',
    categories: ['games', 'web'],
    platforms: ['Browser', 'Phone', 'Desktop'],
    note: 'Free to play · Nothing to install',
    cta: { label: 'Play free in your browser', route: '/play' },
    shelves: ['play'],
    icon: { src: '/assets/brand/icon-192.png', alt: 'Eclipse Realms icon' },
    art: { src: '/assets/og/og-godforge.jpg', alt: 'A violet-lit anvil on a stone altar beneath an eclipse, ringed by broken pillars', width: 1200, height: 630 },
    features: [
      'Choose a calling: Warlock, Ashguard, Lanternwright or Thornstrider.',
      'Explore a shared world of hand-made maps, towns and dark dungeons.',
      'Hunt monsters for loot with rolled affixes, then craft and enchant your gear.',
      'Team up in parties and trade with other Keepers.',
      'Play on your phone or desktop, with nothing to install.',
    ],
    requirements: [
      { label: 'Price', value: 'Free to play' },
      { label: 'Works on', value: 'Any modern browser, on phone or desktop' },
      { label: 'Install', value: 'Nothing to install. You can add it to your home screen.' },
      { label: 'Languages', value: 'English and Spanish' },
    ],
    shots: [
      { kind: 'image', src: '/assets/images/bg-infernal-1280.webp', width: 1280, height: 720, alt: 'Pixel-art painting of the Infernal realm: black stone and rivers of fire.', caption: 'The Infernal realm' },
      { kind: 'image', src: '/assets/images/bg-umbral-1280.webp', width: 1280, height: 720, alt: 'Pixel-art painting of the Umbral realm: a purple-lit night over dark ground.', caption: 'The Umbral realm' },
      { kind: 'image', src: '/assets/images/bg-luminous-1280.webp', width: 1280, height: 720, alt: 'Pixel-art painting of the Luminous realm: pale gold light over white stone.', caption: 'The Luminous realm' },
      { kind: 'image', src: '/assets/images/bg-market-1280.webp', width: 1280, height: 720, alt: 'Painting of the in-game market with stalls under lantern light.', caption: 'The market' },
    ],
    seo: {
      title: 'Eclipse Realms — a pixel-art online RPG in your browser',
      description: 'Eclipse Realms is a free pixel-art online RPG: pick a calling, explore a shared world and dark dungeons, and hunt for loot. Play in your browser, nothing to install.',
      ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
    },
    schema: { type: 'VideoGame', applicationCategory: 'GameApplication', operatingSystem: 'Any', free: true, url: `${SITE_URL}/play` },
  },
  {
    id: 'decanter',
    name: 'Decanter',
    skin: 'decanter',
    status: 'live',
    pitch: 'Play Windows games on your Mac, from a store-style library.',
    blurb: 'A free Mac app that plays Windows games through Wine. Browse what runs well, get a game in a few steps, and play from your own library.',
    kicker: 'Free Mac app',
    categories: ['mac'],
    platforms: ['macOS', 'Apple silicon'],
    note: 'Free · Version 0.3.0 · 3.5 MB · Apple silicon · macOS 14+',
    cta: { label: 'Download for Mac', download: 'https://github.com/xsantcastx/decanter-releases/releases/download/v0.3.0/Decanter-0.3.0.dmg' },
    shelves: ['apps'],
    icon: { src: `${A}/decanter/icon-256.png`, alt: 'Decanter app icon: a white decanter on a claret tile' },
    art: { src: `${A}/decanter/store.jpg`, alt: 'The Decanter Store: a featured game and a shelf of games rated for Mac.', width: 1600, height: 1000 },
    features: [
      'Browse a store of Windows games, each rated for how well it runs on a Mac.',
      'Get a game from Steam or Battle.net, or add any Windows game. Each gets a private Windows space.',
      'Sign in with your own store account. Decanter never sees your password.',
      'Play from one library, and stop everything with a single button.',
      'A graphics slider and "How it ran" advice per game, drag-and-drop mods, save backups and snapshots.',
    ],
    requirements: [
      { label: 'Price', value: 'Free, funded by donations' },
      { label: 'Works on', value: 'Macs with Apple silicon' },
      { label: 'System', value: 'macOS 14 or later (15 or later for DirectX 11 and 12 games)' },
      { label: 'Games', value: 'Decanter never hosts game files. Games come from the stores you already use.' },
      { label: 'Graphics', value: "Apple's free Game Porting Toolkit. Decanter walks you through adding it on first launch." },
      { label: 'Version', value: '0.3.0, an early version' },
      { label: 'First open', value: "Decanter isn't notarized by Apple yet. If macOS says it can't check it, open System Settings › Privacy & Security and click Open Anyway. You only do this once." },
    ],
    shots: [
      { kind: 'image', src: `${A}/decanter/store.jpg`, width: 1600, height: 1000, alt: 'The Decanter Store with a featured game and a shelf of games that run great on Mac.', caption: 'Store' },
      { kind: 'image', src: `${A}/decanter/library.jpg`, width: 1600, height: 1000, alt: 'The Decanter Library: your installed games as covers, with filters along the top.', caption: 'Library' },
      { kind: 'image', src: `${A}/decanter/game.jpg`, width: 1600, height: 1000, alt: 'A game page in Decanter: Diablo II: Resurrected rated Gold, with a Play button, its compatibility report and known issues.', caption: 'Game page' },
      { kind: 'image', src: `${A}/decanter/support.jpg`, width: 1600, height: 1000, alt: 'Support Decanter: why donations matter, and a Donate button.', caption: 'Support Decanter' },
    ],
    downloadsRepo: 'xsantcastx/decanter-releases',
    gamesPage: { route: '/apps/decanter/games', label: 'See which games work', text: 'Real test results for every game Decanter knows, including the ones that can\'t run and why.' },
    faq: [
      { q: 'Is Decanter really free?', a: 'Yes. No ads, no account, no subscription and no paid tier. It is made by one person and paid for by donations from people who enjoy it.' },
      { q: 'Which Macs does it run on?', a: 'Macs with Apple silicon (M1 or later) on macOS 14 or later. Apple\'s current Game Porting Toolkit, which DirectX 11 and 12 games need, requires macOS 15 Sequoia or later.' },
      { q: 'Do I have to buy my games again?', a: 'No. Decanter runs the Windows versions of Steam and Battle.net, and you sign in with your own accounts. Your games download from those stores; Decanter never sells, hosts or sees them, and never sees your passwords.' },
      { q: 'Can I play games that aren\'t in the Store?', a: 'Yes. Library › Add a Windows Game runs any installer (.exe or .msi), such as a GOG offline installer, an old CD game or an itch.io download, or adds a folder with the game already in it. Each game gets its own Windows space with Play, Files, mods, save backups and snapshots.' },
      { q: 'Can I play my GOG games?', a: 'Yes. Install GOG Galaxy (or a GOG offline installer) in Decanter, and the games you install show in your Library under GOG and start directly, without Galaxy, because GOG games are DRM-free. Galaxy itself runs but scrolls slowly on a Mac, so use it for downloading.' },
      { q: 'Can I play with a controller?', a: 'Yes. Connect an Xbox controller to your Mac, and games that support controllers see it. Most switch to controller mode as soon as you press a button.' },
      { q: 'Can I download games from websites?', a: 'Yes. Decanter\'s Browser shows websites a Windows PC, so they offer the Windows download, and the installer goes straight into Decanter. It keeps its own sign-ins apart from Safari, can\'t see your files, and nothing runs until you click.' },
      { q: 'What if a patch or a mod breaks my saves?', a: 'Decanter backs up each game\'s saves before every launch (only when they changed, and the newest 10 are kept). Restore any backup from the game\'s page. Your current saves are backed up first, so you can switch back.' },
      { q: 'How is it different from CrossOver or Whisky?', a: 'CrossOver is a paid, general-purpose app from CodeWeavers, whose open-source Wine code Decanter\'s engine is built from. Whisky is no longer developed. Decanter is free and built around games: a store with tested settings for each game, one-click setup, and updates that keep everything working.' },
      { q: 'Why does macOS say it can\'t check Decanter?', a: 'Decanter isn\'t notarized by Apple yet. The first time you open it, go to System Settings › Privacy & Security and click Open Anyway. You only do this once, and Decanter updates itself after that.' },
      { q: 'It says "Bad CPU type in executable". What do I do?', a: 'Your Mac needs Apple\'s Rosetta, a free part of macOS that Windows games run through. Decanter 0.1.9 and later offers to install it with one click. On an older version, open Terminal, run softwareupdate --install-rosetta --agree-to-license, enter your Mac password, and play again. You only do this once.' },
      { q: 'Can I play online games?', a: 'Many, yes. Games whose anti-cheat needs Windows itself (like Destiny 2, GTA V Online, Valorant or Fall Guys) can\'t run under Wine on a Mac. The games list marks them so you don\'t download them for nothing.' },
      { q: 'Will my Mac get hot?', a: 'Games work your Mac hard, as they do on any computer. Each game\'s page shows how it ran: the frame rate across the session, how busy the graphics chip was and how warm the Mac got, with a fix when something wasn\'t smooth. Decanter helps: each game has a graphics slider (Performance, Balanced, Quality) and Optimize for my Mac picks one for your chip; you can set a frame-rate limit, turn on MetalFX upscaling for games with DLSS, and on battery games are capped at 60 fps by default. Steam starts without its window when you launch a game, which saves a lot of power.' },
      { q: 'Does Decanter change my games?', a: 'No. It doesn\'t change any game file. To measure the frame rate it loads a tiny counter of its own into the game while it runs, which counts the frames drawn and writes one number a second for Decanter to show. It reads nothing else and sends nothing anywhere, and Settings › Frame rate turns it off.' },
      { q: 'Can I install mods?', a: 'Yes. Drag a mod (.zip or folder) onto a game in your Library and Decanter puts it in the right place for games it knows, remembering every file so you can remove it cleanly. Mod managers like Vortex or Mod Organizer 2 run in the game\'s Windows space with one click, and Nexus Mods\' Mod Manager Download links go straight to them. Before your first mod, Decanter takes an instant snapshot of the game, so you can always put it back exactly as it was.' },
      { q: 'Can I get to the game\'s files?', a: 'Yes. Files shows each game\'s Windows space like a Windows PC: a This PC page with drive C:, your Mac\'s Downloads as M:, Documents, Saved Games and each game\'s folder, with back and forward, and an address bar you can type a Windows path into. Drag files in from Finder, double-click a Windows program to run it there, or copy a Windows path. Anything you download on your Mac is in Windows\' Downloads too.' },
      { q: 'Can Windows programs see my files?', a: 'They see your Downloads folder as drive M:, and can change files only there and in their own Windows space. Decanter runs every Windows program in a macOS sandbox, so it can\'t change files elsewhere on your Mac or open your keychains, keys, browsers or mail. Both can be relaxed in Settings if a tool needs it.' },
      { q: 'Where are my games, and how do I remove Decanter?', a: 'Everything lives in ~/Library/Application Support/Decanter. To remove Decanter, delete the app and that folder. Your store accounts and purchases stay with Steam and Battle.net.' },
    ],
    support: {
      title: 'Support Decanter',
      text: 'Decanter is free, with no ads and no account. Donations pay for its development, the engine builds and the downloads.',
      label: 'Donate',
      note: 'You choose the amount. A one-off payment on Stripe; nothing repeats.',
      href: DECANTER_DONATE_URL,
    },
    seo: {
      title: 'Decanter — play Windows games on your Mac',
      description: 'Decanter is a free Mac app that plays Windows games through Wine. A store-style library with a rating for every game. Free download for Apple silicon, macOS 14 or later.',
      ogImage: `${SITE_URL}${A}/decanter/store.jpg`,
    },
    schema: { type: 'SoftwareApplication', applicationCategory: 'GameApplication', operatingSystem: 'macOS 14 or later', free: true, url: `${SITE_URL}/apps/decanter` },
  },
  {
    id: 'cronta',
    name: 'Cronta',
    skin: 'cronta',
    status: 'live',
    pitch: 'A time clock for small shops: clock in, plan shifts, run payroll.',
    blurb: 'Staff clock in and out on their phone or a wall kiosk. Owners plan shifts, approve time off and run payroll from one dashboard.',
    kicker: 'Time clock',
    categories: ['web'],
    platforms: ['Web', 'Phone', 'Kiosk'],
    note: 'Works in any browser · cronta.app',
    cta: { label: 'Open cronta.app', href: 'https://cronta.app' },
    shelves: ['apps'],
    icon: { src: `${A}/cronta/symbol.svg`, alt: 'Cronta symbol' },
    features: [
      'Clock in, start a break and clock out from a phone or a wall kiosk.',
      'See who is in right now, on one screen.',
      'Plan the week. Drafts stay hidden until you publish.',
      'Approve time off, and copy last week into this one.',
      'Run payroll from the hours your team clocked.',
    ],
    requirements: [
      { label: 'Works on', value: 'Any modern browser, on phone, tablet or desktop' },
      { label: 'Kiosk', value: 'A tablet or wall screen can run the clock for the whole shop' },
      { label: 'Made for', value: 'Small shops and the people who work in them' },
      { label: 'Formats', value: 'Dates, times and money follow your own locale' },
    ],
    shots: [
      { kind: 'mock', mock: 'cronta-clock', alt: 'Sample screen: a large Clock in button on a phone, with the time and a Start break option.', caption: 'Clock in' },
      { kind: 'mock', mock: 'cronta-whos-in', alt: 'Sample screen: a list headed Who is in, with names marked Working or On break.', caption: 'Who is in' },
      { kind: 'mock', mock: 'cronta-week', alt: 'Sample screen: a week of shifts as a grid, with a Publish button.', caption: 'Plan the week' },
    ],
    seo: {
      title: 'Cronta — a time clock for small shops',
      description: 'Cronta is a time clock for small shops. Staff clock in and out on a phone or kiosk. Owners plan shifts, approve time off and run payroll. Works in any browser.',
    },
    schema: { type: 'SoftwareApplication', applicationCategory: 'BusinessApplication', operatingSystem: 'Any (web)', url: 'https://cronta.app' },
  },
];

export function projectById(id: string | null | undefined): StoreProject | undefined {
  return PROJECTS.find(p => p.id === id);
}

/** Where a project's CTA goes (for the "More" link row and cards). */
export function projectUrl(p: StoreProject): string {
  return `/apps/${p.id}`;
}

function appNode(p: StoreProject): Record<string, unknown> {
  return {
    '@type': p.schema.type,
    name: p.name,
    description: p.blurb,
    url: p.schema.url,
    applicationCategory: p.schema.applicationCategory,
    operatingSystem: p.schema.operatingSystem,
    ...(p.schema.free ? { isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } : {}),
    author: { '@id': `${SITE_URL}/#person` },
  };
}

const PERSON = { '@type': 'Person', '@id': `${SITE_URL}/#person`, name: 'xsantcastx', url: SITE_URL };

export function storeJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'xsantcastx', description: STORE_DESCRIPTION },
      PERSON,
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/#projects`,
        url: SITE_URL,
        name: 'Projects by xsantcastx',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: PROJECTS.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}${projectUrl(p)}`, name: p.name })),
        },
      },
    ],
  };
}

export function projectJsonLd(p: StoreProject): object {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      appNode(p),
      PERSON,
      ...(p.faq?.length ? [{
        '@type': 'FAQPage',
        mainEntity: p.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }] : []),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Projects', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: p.name, item: `${SITE_URL}${projectUrl(p)}` },
        ],
      },
    ],
  };
}
