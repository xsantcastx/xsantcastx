/**
 * decanter-games.data.ts — GENERATED from Decanter's catalog by scripts/export-site-games.py
 * in the Decanter repo. Don't edit by hand: change the catalog and run the script again.
 */
import { DecanterGame } from './decanter-games.types';

export const DECANTER_GAMES: DecanterGame[] = [
  {
    "id": "diablo-2-resurrected",
    "name": "Diablo II: Resurrected",
    "developer": "Blizzard Entertainment",
    "store": "Battle.net",
    "free": false,
    "sizeGb": 35,
    "blurb": "The classic action RPG, remastered. Runs in the Battle.net space.",
    "rating": "gold",
    "meaning": "Runs great, maybe one small tweak",
    "antiCheat": {
      "status": "client_side_ok",
      "system": "",
      "notes": "No kernel-level anti-cheat known. Blizzard ToS still applies to online play."
    },
    "knownIssues": [
      {
        "summary": "Direct launch reuses the last Battle.net session; if it has expired, launch via Battle.net once.",
        "workaround": null
      }
    ],
    "reports": 1,
    "tested": {
      "date": "2026-11-18",
      "macos": "27.2.1",
      "chip": "M5",
      "gptk": "3.x",
      "notes": "Starts the game directly and plays well; it reuses your Battle.net sign-in."
    }
  },
  {
    "id": "path-of-exile-2",
    "name": "Path of Exile 2",
    "developer": "Grinding Gear Games",
    "store": "Steam",
    "free": true,
    "sizeGb": 100,
    "blurb": "Free-to-play action RPG. DirectX 12 through D3DMetal.",
    "rating": "gold",
    "meaning": "Runs great, maybe one small tweak",
    "antiCheat": {
      "status": "none",
      "system": null,
      "notes": "No kernel anti-cheat at time of testing."
    },
    "knownIssues": [],
    "reports": 2,
    "tested": {
      "date": "2026-11-19",
      "macos": "27.2.1",
      "chip": "M5",
      "gptk": "4.0b3",
      "notes": "DX12 on Apple's Game Porting Toolkit 4 (D3DMetal 4.0 beta 3): looks and plays fine. First load after the driver change rebuilds shaders (about 2 minutes)."
    }
  },
  {
    "id": "team-fortress-2",
    "name": "Team Fortress 2",
    "developer": "Valve",
    "store": "Steam",
    "free": true,
    "sizeGb": 31,
    "blurb": "Free-to-play team shooter. Valve dropped its Mac version in 2024; it runs here through Wine.",
    "rating": "silver",
    "meaning": "Playable, with noticeable issues",
    "antiCheat": {
      "status": "client_side_ok",
      "system": "VAC",
      "notes": "Valve Anti-Cheat works under Wine on other systems; online play hasn't been tested with Decanter yet."
    },
    "knownIssues": [
      {
        "summary": "Some lag: DirectX 9 games are slower than DirectX 11 and 12 games here.",
        "workaround": "Lower the graphics settings, or turn off multicore rendering if it stutters."
      }
    ],
    "reports": 1,
    "tested": {
      "date": "2026-11-19",
      "macos": "27.2.1",
      "chip": "M5",
      "gptk": "3.x",
      "notes": "Runs and plays well, with some lag. DirectX 9 goes through Wine's own graphics layer (OpenGL), not D3DMetal."
    }
  },
  {
    "id": "age-of-empires-2-de",
    "name": "Age of Empires II: Definitive Edition",
    "developer": "Forgotten Empires",
    "store": "Steam",
    "free": false,
    "sizeGb": 30,
    "blurb": "Classic real-time strategy, remastered.",
    "rating": null,
    "meaning": null,
    "antiCheat": {
      "status": "none",
      "system": null,
      "notes": null
    },
    "knownIssues": [],
    "reports": 0
  },
  {
    "id": "counter-strike-2",
    "name": "Counter-Strike 2",
    "developer": "Valve",
    "store": "Steam",
    "free": true,
    "sizeGb": 85,
    "blurb": "Free-to-play competitive shooter.",
    "rating": null,
    "meaning": null,
    "antiCheat": {
      "status": "unknown",
      "system": "VAC",
      "notes": "Valve Anti-Cheat behaviour under Wine is not verified."
    },
    "knownIssues": [],
    "reports": 0
  },
  {
    "id": "diablo-iv",
    "name": "Diablo IV",
    "developer": "Blizzard Entertainment",
    "store": "Battle.net",
    "free": false,
    "sizeGb": 90,
    "blurb": "Dark action RPG, the latest in the series.",
    "rating": null,
    "meaning": null,
    "antiCheat": {
      "status": "none",
      "system": null,
      "notes": null
    },
    "knownIssues": [],
    "reports": 0
  },
  {
    "id": "elden-ring",
    "name": "Elden Ring",
    "developer": "FromSoftware",
    "store": "Steam",
    "free": false,
    "sizeGb": 60,
    "blurb": "Open-world action RPG.",
    "rating": null,
    "meaning": null,
    "antiCheat": {
      "status": "unknown",
      "system": "EasyAntiCheat",
      "notes": "Online play needs Easy Anti-Cheat, which does not run here. Offline play only."
    },
    "knownIssues": [
      {
        "summary": "Offline play only: Easy Anti-Cheat blocks online play.",
        "workaround": "Start the game in offline mode."
      }
    ],
    "reports": 0
  },
  {
    "id": "overwatch-2",
    "name": "Overwatch 2",
    "developer": "Blizzard Entertainment",
    "store": "Battle.net",
    "free": true,
    "sizeGb": 50,
    "blurb": "Free-to-play team shooter.",
    "rating": null,
    "meaning": null,
    "antiCheat": {
      "status": "none",
      "system": null,
      "notes": null
    },
    "knownIssues": [],
    "reports": 0
  },
  {
    "id": "destiny-2",
    "name": "Destiny 2",
    "developer": "Bungie",
    "store": "Steam",
    "free": true,
    "sizeGb": 105,
    "blurb": "Free-to-play sci-fi shooter.",
    "rating": "borked",
    "meaning": "Does not run on Mac",
    "antiCheat": {
      "status": "blocked",
      "system": "BattlEye",
      "notes": "Destiny 2 needs BattlEye, which does not run under Wine on a Mac. The game won't start."
    },
    "knownIssues": [],
    "reports": 0
  },
  {
    "id": "doom-eternal",
    "name": "DOOM Eternal",
    "developer": "id Software",
    "store": "Steam",
    "free": false,
    "sizeGb": 90,
    "blurb": "Fast, heavy-metal shooter.",
    "rating": "borked",
    "meaning": "Does not run on Mac",
    "antiCheat": null,
    "knownIssues": [
      {
        "summary": "Needs Vulkan, which Decanter does not include yet.",
        "workaround": null
      }
    ],
    "reports": 1,
    "why": "DOOM Eternal draws only with Vulkan. Decanter's engine uses Apple's D3DMetal (DirectX) and has no Vulkan yet."
  },
  {
    "id": "fall-guys",
    "name": "Fall Guys",
    "developer": "Mediatonic",
    "store": "Steam",
    "free": true,
    "sizeGb": 6,
    "blurb": "Free-to-play party royale.",
    "rating": "borked",
    "meaning": "Does not run on Mac",
    "antiCheat": {
      "status": "blocked",
      "system": "Easy Anti-Cheat",
      "notes": "Fall Guys needs Easy Anti-Cheat, which does not run under Wine on a Mac."
    },
    "knownIssues": [],
    "reports": 0
  },
  {
    "id": "gta-v-enhanced",
    "name": "Grand Theft Auto V",
    "developer": "Rockstar Games",
    "store": "Steam",
    "free": false,
    "sizeGb": 105,
    "blurb": "Open-world crime action.",
    "rating": "borked",
    "meaning": "Does not run on Mac",
    "antiCheat": {
      "status": "blocked",
      "system": "BattlEye",
      "notes": "GTA V needs BattlEye, even for story mode, and BattlEye does not run under Wine on a Mac."
    },
    "knownIssues": [],
    "reports": 0
  },
  {
    "id": "halo-infinite",
    "name": "Halo Infinite",
    "developer": "Halo Studios",
    "store": "Steam",
    "free": true,
    "sizeGb": 50,
    "blurb": "Free-to-play multiplayer shooter.",
    "rating": "borked",
    "meaning": "Does not run on Mac",
    "antiCheat": {
      "status": "blocked",
      "system": "Easy Anti-Cheat",
      "notes": "Halo Infinite multiplayer needs Easy Anti-Cheat, which does not run under Wine on a Mac."
    },
    "knownIssues": [],
    "reports": 0
  }
];
