# HD Keepers and NPCs (isometric B), handoff

Branch `hdchar`. Painter: `src/app/play/td/td-hd-keeper.ts` (on the sculptor `td-hd-sculpt.ts`). Shots: `docs/handoff/hdchar/`
(camera: `HDCHAR_SHOTS=1 PW_PORT=4709 npx playwright test e2e/td-hdchar-shots --project=chromium`).

## Done
- Every figure is painted from the classic painter's own inputs (look, worn gear with the class kit, townsfolk garb), so
  all 4 callings (masc/fem), the 29 named NPCs, generic townsfolk and peers come out in HD with their gear.
- Six facings (4 rows + mirrors). Frames: idle, breath, 4-step walk, a 3-frame swing or bow draw, a 2-frame cast, hit,
  kneel and down.
- Gear: helms (incl. Pyre, open, great, horned), hoods, cowls with glowing eyes (the Sexton's red), crowns, circlets,
  masks, hats; plate, scale, coats, robes, mantles, cloaks and capes (fold tubes); gauntlets, wraps, greaves, boots,
  sandals; every weapon kind; shields, lanterns, tomes, orbs and other off-hand props.
- Proportions about 1:3.9 (head at 0.8 about the chin), eight-tone ramps, a feminine silhouette.
- In the world (player, townsfolk, peers), the HUD face, NPC portraits, the satchel paper doll and the Glass all
  switch to HD when the graphics are Isometric.
- Sheets bake lazily, a cell at a time under a ~6 ms/16 ms budget, in per-view strips, in an LRU of 28 figures. That
  is 9–13 MB in the town square on a phone (`__tdArt.hdBytes()`).

## Left
- **Lobby campfire (play/lobby/camp-art.ts):** still classic. Its canvas is drawn at art px × 2–4, so HD figures
  need a 2× layer, or the whole lobby repainted at the HD pixel. Not started.
- **Old idle equipment panel (shared/rpg/equipment-panel):** switches to HD. The top-down character sheet has no figure.
- **Facings:** turned (3/4) views are a shifted front/back; a true profile would read better on SE/NE.
- **Long tail:** some worn shapes (mantle, censer, scales) are generic; ring, charm and pendant are not drawn on the body.
- **Memory:** cells are 98×126, so cropping to the figure's bounds would cut memory by about 30%. Pets and creatures
  (the next family) are still classic, or the prototype Bone Walker.
