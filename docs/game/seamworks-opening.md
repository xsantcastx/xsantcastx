# Seamworks opening

`/play` is the first playable adventure prototype. The World page's **Play the adventure** link opens it. It uses the existing Seamworks illustration, item art, inventory, mining recovery and Basalt Edge recipe.

The player gathers six Cinder Ore, accepts a one-time Ember Residue from the Keeper, crafts and equips a Basalt Edge, then learns to guard and strike against a Rivet Maw. Lighting the beacon after victory visibly restores the crossing. Losing the encounter allows a retry without losing equipment.

Materials and the blade live in the existing inventory. Beacon completion is saved on this browser; this prototype does not add cloud synchronization for its narrative state. Combat is a short encounter designed for this opening, not a replacement for the existing arena system. The other realms remain accessible through the hub. Chapter dialogue is currently English; the hub entry retains English and Spanish labels.

The play route removes the site's decorative overlays and navigation. Cookie consent, account notices, device lease and save conflict handling remain available. The rest of the site keeps its existing shell.

## Local development

```sh
npm ci
npm start -- --host 127.0.0.1 --port 4317
```

Open `http://localhost:4317/play`. With that server running:

```sh
npm run typecheck
PW_PORT=4317 npx playwright test e2e/infernal-adventure.spec.ts --project=chromium
```

The browser test starts without gameplay resources and checks the full loop, defeat and retry, reload persistence, route transitions, and a 375px mobile viewport.
