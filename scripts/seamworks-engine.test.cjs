const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

// Compile the browser runtime directly so these deterministic fixed-step tests
// do not depend on Angular, asset downloads, or requestAnimationFrame timing.
function loadEngine() {
  const modules = new Map();
  function eventTarget(properties) {
    const listeners = new Map();
    return {
      ...properties,
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
      },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      dispatch(type) { for (const listener of listeners.get(type) || []) listener(); },
      listenerCount(type) { return listeners.get(type)?.size || 0; },
    };
  }
  const browserWindow = eventTarget({ devicePixelRatio: 1 });
  const browserDocument = eventTarget({ hidden: false });
  const context = vm.createContext({
    crypto, console,
    Image: class { set src(value) {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    window: browserWindow, document: browserDocument,
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  });
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const wrapper = vm.runInContext(`(function(require,module,exports){${code}\n})`, context);
    wrapper((name) => load(path.resolve(path.dirname(file), `${name}.ts`)), module, module.exports);
    return module.exports;
  }
  return { Engine: load(path.resolve(__dirname, '../src/app/play/engine/engine.ts')).SeamworksEngine, browserWindow, browserDocument };
}
const { Engine, browserWindow, browserDocument } = loadEngine();
function fixture(onLoot = () => true, extra = {}) {
  let state;
  const engine = new Engine({
    getContext: () => ({ setTransform() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 720 }),
    parentElement: { clientWidth: 1200, clientHeight: 720, getBoundingClientRect: () => ({ width: 1200, height: 720 }) },
  }, { assets: {}, onInteract() {}, onLoot, onState: value => { state = value; }, ...extra });
  return { engine, state: () => { engine.report(); return state; } };
}
// Station positions come from world data (the town quarter widened the camp),
// so read them instead of pinning the old 2580/110 literals.
function stationX(engine, id) { return engine.places.find(station => station.id === id).x; }
function strike(engine) {
  engine.attackCooldown = 0;
  engine.setInput('attack', false);
  engine.setInput('attack', true);
}
function killFirst(engine) {
  const monster = engine.monsters[0];
  engine.player.x = monster.x - 50;
  for (let n = 0; n < 6; n++) strike(engine);
  return monster;
}

test('unarmed farming kills a monster, drops loot once, and respawns after eight seconds', () => {
  const received = [];
  const { engine, state } = fixture(loot => { received.push(loot); return true; });
  const monster = killFirst(engine);
  assert.equal(monster.hp, 0);
  assert.equal(state().kills, 1);
  assert.equal(state().enemyDefeated, true);
  assert.equal(engine.drops.length, 2);
  strike(engine);
  assert.equal(engine.drops.length, 2, 'dead monsters must not generate more loot');
  engine.player.x = monster.x;
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  assert.equal(received.length, 2);
  assert.equal(received.reduce((sum, drop) => sum + drop.ore, 0), 1);
  assert.equal(state().coins, 9);
  assert.equal(engine.drops.length, 0);
  assert.equal(new Set(received.map(drop => drop.id)).size, 2);
  engine.player.x = 160;
  for (let n = 0; n < 480; n++) engine.update(1 / 60);
  assert.equal(monster.hp, 60);
  assert.equal(state().kills, 1);
  engine.destroy();
});

test('rejected pickups stay in the world and accepted drops are not granted twice', () => {
  let accepted = false;
  const granted = [];
  const { engine, state } = fixture(loot => { if (!accepted) return false; granted.push(loot.id); return true; });
  const monster = killFirst(engine); engine.player.x = monster.x;
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  assert.equal(engine.drops.length, 2); assert.equal(state().coins, 0);
  accepted = true;
  engine.update(1 / 60); engine.update(1 / 60);
  assert.equal(engine.drops.length, 0); assert.equal(granted.length, 2); assert.equal(state().coins, 9);
  engine.destroy();
});

test('portals allow repeat travel and movement continues after each transition', () => {
  const { engine, state } = fixture();
  engine.setProgress({ equipped: true, restored: true });
  for (let lap = 0; lap < 3; lap++) {
    engine.player.x = stationX(engine, 'passage'); engine.player.y = 610; engine.interact();
    assert.equal(state().area, 'Ember Quarry'); assert.equal(state().complete, false);
    const before = state().x;
    engine.setInput('right', true); engine.update(.1); engine.setInput('right', false);
    assert.ok(state().x > before);
    engine.player.x = stationX(engine, 'passage'); engine.interact();
    assert.equal(state().area, 'Basalt Seamworks');
    const returnX = state().x;
    engine.setInput('left', true); engine.update(.1); engine.setInput('left', false);
    assert.ok(state().x < returnX);
  }
  engine.destroy();
});

test('retry and camp return clear defeat, pause, completion and cooldowns while keeping loot', () => {
  const { engine, state } = fixture();
  killFirst(engine); engine.player.x = engine.monsters[0].x;
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  engine.hp = 0; engine.complete = true; engine.setPaused(true); engine.attackCooldown = 9; engine.dodgeCooldown = 9;
  engine.retry();
  assert.equal(state().hp, 100); assert.equal(state().paused, false); assert.equal(state().complete, false);
  assert.equal(engine.attackCooldown, 0); assert.equal(engine.dodgeCooldown, 0);
  assert.equal(state().coins, 9); assert.equal(state().kills, 1); assert.equal(state().x, 160);
  engine.setProgress({ equipped: true, restored: true }); engine.player.x = stationX(engine, 'passage'); engine.interact();
  engine.returnToCamp();
  assert.equal(state().area, 'Basalt Seamworks'); assert.equal(state().x, 160); assert.equal(state().coins, 9);
  engine.destroy();
});

test('presence reports the live pose and keeps a remote Keeper facing and speech', () => {
  const { engine, state } = fixture();
  engine.setInput('left', true);
  engine.update(.1);
  assert.equal(state().facing, -1);
  assert.equal(state().animation, 'run');
  engine.setPeers([{ id: 'nyx', name: 'Nyx', x: 400, y: 610, area: 'Basalt Seamworks', facing: -1, animation: 'jump' }]);
  const view = engine.peers.get('nyx');
  assert.equal(view.facing, -1);
  assert.equal(view.peer.animation, 'jump');
  engine.setChat([{ playerId: 'nyx', text: '  hello   hearth  ', at: Date.now() }, { playerId: 'nyx', text: 'older', at: Date.now() - 1000 }], 'me');
  assert.equal(engine.speech.get('nyx').text, 'hello hearth');
  assert.equal(engine.selfId, 'me');
  engine.destroy();
});

test('drop identifiers are unique across engine sessions', () => {
  const first = fixture().engine; const second = fixture().engine;
  killFirst(first); killFirst(second);
  assert.notEqual(first.drops[0].id, second.drops[0].id);
  first.destroy(); second.destroy();
});

for (const cause of ['blur', 'hidden']) {
  test(`${cause} releases held movement and actions without pausing the online world`, () => {
    const { engine, state } = fixture();
    try {
      engine.setInput('right', true);
      engine.setInput('attack', true);
      engine.update(.1);
      const before = engine.player.x;
      if (cause === 'blur') browserWindow.dispatch('blur');
      else { browserDocument.hidden = true; browserDocument.dispatch('visibilitychange'); }
      assert.equal(engine.input.size, 0, 'lost releases must not leave controls latched');
      engine.render = () => {};
      engine.tick(1000);
      const elapsed = engine.elapsed;
      engine.tick(1100);
      assert.equal(engine.player.x, before, 'held movement stops when focus is lost');
      assert.equal(state().paused, false);
      assert.ok(engine.elapsed > elapsed, 'simulation keeps running while unfocused');
      engine.attackCooldown = 0;
      engine.attackTime = 0;
      browserDocument.hidden = false;
      engine.setInput('attack', true);
      assert.ok(engine.attackTime > 0, 'the next press can start a fresh action');
      engine.setInput('right', true);
      engine.update(.1);
      assert.ok(engine.player.x > before, 'movement resumes only after a fresh press');
    } finally {
      browserDocument.hidden = false;
      engine.destroy();
    }
  });
}

test('visible-document notifications preserve current input and destroy removes focus listeners', () => {
  const beforeBlur = browserWindow.listenerCount('blur');
  const beforeVisibility = browserDocument.listenerCount('visibilitychange');
  const { engine } = fixture();
  assert.equal(browserWindow.listenerCount('blur'), beforeBlur + 1);
  assert.equal(browserDocument.listenerCount('visibilitychange'), beforeVisibility + 1);
  engine.setInput('right', true);
  browserDocument.hidden = false;
  browserDocument.dispatch('visibilitychange');
  assert.equal(engine.input.has('right'), true);
  engine.destroy();
  assert.equal(browserWindow.listenerCount('blur'), beforeBlur);
  assert.equal(browserDocument.listenerCount('visibilitychange'), beforeVisibility);
});

test('setStats drives melee damage and max HP, keeping the share of health', () => {
  const { engine, state } = fixture();
  const monster = engine.monsters[0];
  engine.player.x = monster.x - 50;
  strike(engine);
  assert.equal(monster.hp, 50, 'without setStats the legacy unarmed 10 still applies');
  engine.setStats({ damage: 25, maxHp: 100 });
  strike(engine);
  assert.equal(monster.hp, 25);
  engine.hp = 50;
  engine.setStats({ damage: 25, maxHp: 200 });
  assert.equal(state().hp, 100, 'half health stays half health');
  engine.retry();
  assert.equal(state().hp, 200, 'a fresh hunt starts at the new ceiling');
  engine.destroy();
});

// Mesh-deformation rig: pure math only (no canvas). Visual-only module.
function loadTs(file) {
  const cache = loadTs.cache || (loadTs.cache = new Map());
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('require', 'module', 'exports', code)((name) => loadTs(path.resolve(path.dirname(file), `${name}.ts`)), module, module.exports);
  return module.exports;
}
const rig = loadTs(path.resolve(__dirname, '../src/app/play/engine/rig.ts'));
const poses = loadTs(path.resolve(__dirname, '../src/app/play/engine/rig-poses.ts'));
function deform(spec, pose) {
  const mesh = rig.buildMesh(spec, 1);
  const matrices = new Float32Array(spec.bones.length * 6);
  const x = new Float32Array(mesh.nv), y = new Float32Array(mesh.nv);
  rig.solveBones(spec, mesh, pose, matrices);
  rig.skin(mesh, matrices, x, y);
  return { mesh, x, y };
}
function nearestVertex(mesh, u, v) {
  let best = 0;
  for (let i = 0; i < mesh.nv; i++) if (Math.hypot(mesh.u[i] - u, mesh.v[i] - v) < Math.hypot(mesh.u[best] - u, mesh.v[best] - v)) best = i;
  return best;
}

test('rig meshes stay within the triangle budget and every vertex is fully weighted', () => {
  for (const spec of [poses.KEEPER_RIG, poses.MAW_RIG]) {
    const mesh = rig.buildMesh(spec, 1);
    assert.ok(mesh.nt <= 150, `${mesh.nt} triangles`);
    spec.bones.forEach((bone, index) => assert.ok(bone.parent < index, `${bone.name} parent precedes it`));
    for (let i = 0; i < mesh.nv; i++) {
      let sum = 0;
      for (let k = 0; k < rig.MAX_INFLUENCES; k++) sum += mesh.wVal[i * rig.MAX_INFLUENCES + k];
      assert.ok(Math.abs(sum - 1) < 1e-5, `vertex ${i} weights sum to ${sum}`);
    }
  }
});

test('the rest pose reproduces the painting exactly', () => {
  const pose = rig.createPose(poses.KEEPER_RIG.bones.length);
  assert.equal(rig.isRestPose(pose), true);
  const { mesh, x, y } = deform(poses.KEEPER_RIG, pose);
  for (let i = 0; i < mesh.nv; i++) {
    assert.ok(Math.abs(x[i] - mesh.x[i]) < 1e-6 && Math.abs(y[i] - mesh.y[i]) < 1e-6);
  }
});

test('bones bend locally and children inherit their parent', () => {
  const K = poses.KEEPER;
  const pose = rig.createPose(poses.KEEPER_RIG.bones.length);
  pose[K.HEAD * rig.POSE_STRIDE] = .3;
  let { mesh, x, y } = deform(poses.KEEPER_RIG, pose);
  const crown = nearestVertex(mesh, .5, 0), foot = nearestVertex(mesh, .6, 1);
  assert.ok(Math.hypot(x[crown] - mesh.x[crown], y[crown] - mesh.y[crown]) > .02, 'the head moves');
  assert.ok(Math.hypot(x[foot] - mesh.x[foot], y[foot] - mesh.y[foot]) < 1e-3, 'the feet do not');
  rig.resetPose(pose);
  pose[K.CHEST * rig.POSE_STRIDE] = .3;
  ({ mesh, x, y } = deform(poses.KEEPER_RIG, pose));
  assert.ok(x[crown] - mesh.x[crown] > .02, 'a forward chest carries the head forward');
});

test('triangle affine maps all three corners', () => {
  const out = new Float32Array(6);
  assert.equal(rig.triangleAffine(0, 0, 10, 0, 0, 10, 5, 5, 12, 9, 1, 20, out), true);
  const map = (x, y) => [out[0] * x + out[2] * y + out[4], out[1] * x + out[3] * y + out[5]];
  for (const [[sx, sy], [dx, dy]] of [[[0, 0], [5, 5]], [[10, 0], [12, 9]], [[0, 10], [1, 20]]]) {
    const [mx, my] = map(sx, sy);
    assert.ok(Math.abs(mx - dx) < 1e-4 && Math.abs(my - dy) < 1e-4);
  }
  assert.equal(rig.triangleAffine(0, 0, 1, 1, 2, 2, 0, 0, 1, 0, 0, 1, out), false);
});

test('springs settle on their target and survive long frames', () => {
  const spring = { x: 0, v: 0 };
  for (let n = 0; n < 120; n++) rig.stepSpring(spring, 1, 9, .45, 1 / 60);
  assert.ok(Math.abs(spring.x - 1) < .02);
  const harsh = { x: 0, v: 0 };
  for (let n = 0; n < 50; n++) rig.stepSpring(harsh, 1, 14, .6, .25);
  assert.ok(Number.isFinite(harsh.x) && Math.abs(harsh.x - 1) < .01);
});

test('Keeper poses breathe, swing and trail; reduced motion is the still painting', () => {
  const K = poses.KEEPER, S = rig.POSE_STRIDE;
  const pose = rig.createPose(poses.KEEPER_RIG.bones.length);
  const motion = poses.createKeeperMotion();
  const base = { animation: 'idle', time: 0, attackT: 0, swing: 0, landing: 0, recoil: 0, facing: 1, dt: 1 / 60, reduced: false };
  poses.poseKeeper(pose, motion, { ...base, reduced: true, animation: 'run', time: 3 });
  assert.equal(rig.isRestPose(pose), true);
  poses.poseKeeper(pose, motion, { ...base, time: .7 });
  const breathA = pose[K.CHEST * S + 2];
  poses.poseKeeper(pose, motion, { ...base, time: 2.1 });
  assert.notEqual(pose[K.CHEST * S + 2], breathA, 'the chest rises and falls');
  poses.poseKeeper(pose, motion, { ...base, animation: 'attack', attackT: .1, swing: -.33 });
  assert.ok(pose[K.ARM_F * S] > 0, 'anticipation cocks the arm back');
  poses.poseKeeper(pose, motion, { ...base, animation: 'attack', attackT: .65, swing: 1 });
  assert.ok(pose[K.ARM_F * S] < -1, 'the strike sweeps it forward');
  // Running right: the cape trails behind (positive rotation) after a moment.
  const runner = poses.createKeeperMotion();
  for (let n = 0; n < 40; n++) {
    poses.trackKeeper(runner, 100 + n * 265 / 60, 610, 1 / 60);
    poses.poseKeeper(pose, runner, { ...base, animation: 'run', time: n / 60 });
  }
  assert.ok(runner.vx > 200 && runner.trail.x > .1, `cape trails at ${runner.trail.x}`);
  poses.trackKeeper(runner, 2400, 610, 1 / 60);
  assert.equal(runner.vx, 0, 'a teleport resets secondary motion');
  assert.equal(runner.trail.x, 0);
});

test('the Rivet Maw coils, lunges and opens its jaw on the strike', () => {
  const M = poses.MAW, S = rig.POSE_STRIDE;
  const pose = rig.createPose(poses.MAW_RIG.bones.length);
  poses.poseMaw(pose, { phase: 'windup', timer: .1, time: 1, seed: 0, reduced: false });
  assert.ok(pose[M.BODY * S + 1] > .03, 'wind-up draws the body back');
  poses.poseMaw(pose, { phase: 'strike', timer: .02, time: 1, seed: 0, reduced: false });
  assert.ok(pose[M.BODY * S + 1] < -.08, 'the strike lunges forward');
  assert.ok(pose[M.JAW * S] < -.35, 'the jaw opens');
  poses.poseMaw(pose, { phase: 'strike', timer: .02, time: 1, seed: 0, reduced: true });
  assert.equal(rig.isRestPose(pose), true);
});

test('an idle Keeper is blitted once per frame, fully opaque, with no smear or rim copies', () => {
  const { engine } = fixture();
  const noop = () => {};
  const stack = [];
  const target = {
    globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', shadowBlur: 0,
    save() { stack.push([this.globalAlpha, this.globalCompositeOperation, this.filter, this.shadowBlur]); },
    restore() { [this.globalAlpha, this.globalCompositeOperation, this.filter, this.shadowBlur] = stack.pop(); },
    measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
  };
  engine.context = new Proxy(target, { get: (t, key) => key in t ? t[key] : noop });
  const blits = [];
  engine.keeperRig.render = () => true;
  engine.keeperRig.attach = () => false;
  engine.keeperRig.blit = (c, ox = 0, oy = 0) => blits.push({ alpha: c.globalAlpha, op: c.globalCompositeOperation, ox, oy });
  engine.frameDt = 1 / 60;
  for (let n = 0; n < 30; n++) { engine.update(1 / 60); engine.render(); }
  assert.equal(engine.pose(), 'idle');
  assert.equal(blits.length, 30);
  for (const blit of blits) assert.deepEqual(blit, { alpha: 1, op: 'source-over', ox: 0, oy: 0 });
  engine.destroy();
});

test('drawing never moves combat state', () => {
  const { engine } = fixture();
  engine.setPeers([{ id: 'nyx', name: 'Nyx', x: 400, y: 610, area: 'Basalt Seamworks', facing: 1, animation: 'run' }]);
  const before = JSON.stringify({ p: engine.player, hp: engine.hp, m: engine.monsters.map(m => [m.x, m.hp, m.phase, m.timer]) });
  // No painting has loaded in the harness, so this exercises the whole-sprite fallback.
  const noop = () => {};
  const ctx = new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) },
    { get: (target, key) => key in target ? target[key] : noop, set: () => true });
  engine.context = ctx;
  for (let n = 0; n < 5; n++) engine.render();
  assert.equal(JSON.stringify({ p: engine.player, hp: engine.hp, m: engine.monsters.map(m => [m.x, m.hp, m.phase, m.timer]) }), before);
  engine.destroy();
});

// ── World data: towns, stations, panels, drops ───────────────────────────────
const world = loadTs(path.resolve(__dirname, '../src/app/play/world/world.model.ts'));
const registry = loadTs(path.resolve(__dirname, '../src/app/play/world/panel-registry.ts'));

test('world data is valid: unique ids, stations inside the town, every panel registered, passages resolve', () => {
  assert.deepEqual([...world.REALM_TOWN_IDS].sort(), Object.keys(world.TOWNS).sort(), 'every realm has a TOWNS entry');
  assert.deepEqual([...world.PANEL_IDS].sort(), Object.keys(registry.PANEL_REGISTRY).sort(), 'the registry covers every PanelId and nothing else');
  for (const entry of Object.values(registry.PANEL_REGISTRY)) {
    assert.equal(typeof entry.load, 'function'); assert.ok(entry.title && (entry.route === undefined || entry.route.startsWith('/')), 'a route, when given, is absolute');
  }
  const built = Object.values(world.TOWNS).filter(Boolean);
  assert.ok(built.length >= 1 && world.TOWNS.infernal, 'the Infernal town exists');
  for (const town of built) {
    assert.equal(town.realm, town.id);
    for (const area of [town, ...town.hunts]) {
      const where = `${town.id}/${area.id}`;
      const ids = area.stations.map(station => station.id);
      assert.equal(new Set(ids).size, ids.length, `${where}: station ids are unique`);
      assert.ok(area.spawnX > 0 && area.spawnX < area.width, `${where}: spawn inside`);
      assert.ok(area.platforms.some(p => p.x <= 0 && p.x + p.width >= area.width), `${where}: a floor spans the area`);
      for (const station of area.stations) {
        const half = (station.width ?? 120) / 2;
        assert.ok(station.x - half >= 0 && station.x + half <= area.width, `${where}/${station.id} sits inside the area`);
        if (station.kind === 'panel') assert.ok(world.PANEL_IDS.includes(station.panel) && registry.PANEL_REGISTRY[station.panel], `${where}/${station.id} opens a registered panel`);
        else assert.equal(station.panel, undefined, `${where}/${station.id}: only panel stations name a panel`);
        if (station.kind === 'passage') {
          const target = world.areaOf(town, station.to);
          assert.ok(target, `${where}/${station.id} leads to a known area`);
          const arrive = station.arriveX ?? target.spawnX;
          assert.ok(arrive > 0 && arrive < target.width, `${where}/${station.id} arrives inside ${target.id}`);
        }
      }
      // Stations far enough apart that walking to one never interacts with its neighbour.
      const xs = area.stations.map(station => station.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= world.STATION_REACH, `${where}: stations ${xs[i - 1]} and ${xs[i]} overlap`);
      for (const monster of area.monsters) {
        assert.ok(monster.hp > 0 && monster.creature && monster.name);
        for (const x of monster.spawnXs) assert.ok(x > (area.safeX ?? 0) && x < area.width, `${where}: ${monster.name} spawns in the hunting ground`);
      }
      const dropIds = area.drops.entries.map(entry => entry.id);
      assert.equal(new Set(dropIds).size, dropIds.length, `${where}: drop entry ids are unique (they key loot ids)`);
    }
  }
});

test('every built town has a waystone, and every material a zone drops is catalogued and crafted with', () => {
  const catalog = loadTs(path.resolve(__dirname, '../src/app/shared/rpg/material-catalog.ts'));
  const { CRAFTING_RECIPES } = loadTs(path.resolve(__dirname, '../src/app/shared/crafting/crafting.model.ts'));
  const used = new Set(CRAFTING_RECIPES.flatMap(recipe => recipe.ingredients.map(ingredient => ingredient.materialId)));
  assert.ok(used.size > 10, 'the recipe table loaded');
  for (const town of Object.values(world.TOWNS).filter(Boolean)) {
    assert.ok(town.stations.some(station => station.kind === 'waystone'), `${town.id} has a waystone`);
    for (const area of [town, ...town.hunts]) {
      const tables = [area.drops, ...area.monsters.map(monster => monster.drops).filter(Boolean)];
      for (const entry of tables.flatMap(table => table.entries)) {
        if (entry.chance !== undefined) assert.ok(entry.chance > 0 && entry.chance <= 1, `${area.id}/${entry.id}: chance in (0, 1]`);
        if (entry.kind !== 'material') continue;
        const display = catalog.materialDisplay(entry.material);
        assert.ok(display, `${area.id}/${entry.id}: ${entry.material} is a catalogued material (the bag can name and paint it)`);
        assert.equal(display.name, entry.label, `${area.id}/${entry.id}: the pickup label matches the bag's name`);
        assert.ok(entry.qty > 0);
        assert.ok(used.has(entry.material), `${area.id}/${entry.id}: ${entry.material} feeds a crafting recipe`);
      }
    }
  }
  const umbral = world.TOWNS.umbral;
  assert.ok(umbral, 'the Umbral town is built');
  assert.deepEqual(umbral.stations.filter(s => s.kind === 'panel').map(s => s.panel).sort(), ['exchange', 'gambler']);
  assert.equal(umbral.hunts[0].monsters[0].creature, 'mirror-substitute', 'Umbral hunts its canon creature');
});

test('the station nearest the Keeper wins, and a click hits a station by its footprint', () => {
  const stations = world.TOWNS.infernal.stations;
  assert.equal(world.nearestStation(stations, 1230).id, 'crafting');
  assert.equal(world.nearestStation(stations, 1360), null, 'between stations nothing is in reach');
  assert.equal(world.stationAt(stations, 1500, 560, 610).id, 'runes');
  assert.equal(world.stationAt(stations, 1500, 200, 610), null, 'the sky above a stall is not the stall');
});

test('clientToWorld undoes the canvas offset, CSS stretch, scale and camera', () => {
  const base = { left: 100, top: 50, rectWidth: 1200, rectHeight: 720, cssWidth: 1200, cssHeight: 720, camera: 0 };
  assert.deepEqual(world.clientToWorld(400, 410, base), { x: 300, y: 360 });
  // Half-height canvas: world units are twice the CSS pixels; the camera adds on.
  assert.deepEqual(world.clientToWorld(400, 230, { ...base, rectWidth: 600, rectHeight: 360, cssWidth: 600, cssHeight: 360, camera: 500 }), { x: 1100, y: 360 });
  // The element is drawn at 1200x720 but shown at 600x360 (CSS stretch): DPR never enters.
  assert.deepEqual(world.clientToWorld(400, 230, { ...base, rectWidth: 600, rectHeight: 360 }), { x: 600, y: 360 });
});

test('engine.pick maps a click on a stall to that station', () => {
  const { engine } = fixture();
  engine.camera = 1000;
  const hit = engine.pick(220, 560);
  assert.equal(Math.round(hit.x), 1220);
  assert.equal(hit.station.id, 'crafting');
  assert.equal(engine.pick(700, 100).station, null);
  engine.destroy();
});

test('moveTo walks in the fixed step, arrives once, and any key press or pause cancels it', () => {
  const { engine, state } = fixture();
  let arrived = 0;
  assert.equal(engine.moveTo(400, () => arrived++), true);
  engine.update(1 / 60);
  assert.equal(state().animation, 'run', 'a walk reads as running');
  assert.equal(state().facing, 1);
  for (let n = 0; n < 240 && engine.moving; n++) engine.update(1 / 60);
  assert.equal(engine.moving, false);
  assert.equal(arrived, 1);
  assert.ok(Math.abs(state().x - 400) <= 6, `stopped at ${state().x}`);
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  assert.equal(arrived, 1, 'arrival fires once');
  assert.equal(state().animation, 'idle');

  engine.moveTo(1000, () => arrived++);
  for (let n = 0; n < 20; n++) engine.update(1 / 60);
  engine.setInput('left', true);
  assert.equal(engine.moving, false, 'a movement key cancels the walk');
  engine.setInput('left', false);
  for (let n = 0; n < 240; n++) engine.update(1 / 60);
  assert.equal(arrived, 1, 'a cancelled walk never arrives');

  engine.moveTo(1000, () => arrived++);
  engine.setPaused(true);
  assert.equal(engine.moving, false, 'opening a panel cancels the walk');
  assert.equal(engine.moveTo(1000), false, 'no walking while paused');
  engine.setPaused(false);
  engine.destroy();
});

test('walking to a panel station opens it on arrival; locked places explain themselves', () => {
  const opened = [];
  const { engine, state } = fixture(undefined, { onStation: station => opened.push(station.id) });
  assert.equal(engine.goToStation('nowhere'), false, 'unknown ids are ignored');
  engine.goToStation('crafting');
  for (let n = 0; n < 600 && engine.moving; n++) engine.update(1 / 60);
  assert.deepEqual(opened, ['crafting']);
  assert.equal(state().nearby, 'crafting');
  assert.equal(state().nearbyKind, 'panel');
  engine.goToStation('waystone', true);
  assert.deepEqual(opened, ['crafting', 'waystone'], 'instant (reduced-motion) travel opens at once');
  engine.goToStation('passage', true);
  assert.equal(state().area, 'Basalt Seamworks');
  assert.match(state().message, /beacon/i, 'the passage stays shut until the beacon burns');
  engine.destroy();
});

test('drop tables are data: chances roll on the engine RNG and materials carry their stack id', () => {
  const town = world.TOWNS.infernal;
  const table = { id: 'test', entries: [
    { id: 'coins', kind: 'coins', base: 3 },
    { id: 'gem', kind: 'material', material: 'ember-residue', art: 'ember-residue', label: 'Ember Residue', short: 'ember', qty: 2, chance: .5 },
  ] };
  const custom = { ...town, drops: table, monsters: [{ ...town.monsters[0], hp: 10 }], hunts: [] };
  const loot = [];
  const { engine } = fixture(drop => { loot.push(drop); return true; }, { town: custom });
  engine.random = () => .9;
  killFirst(engine);
  assert.deepEqual([...engine.drops.map(drop => drop.coins)], [3], 'a missed chance drops nothing');
  engine.random = () => .1;
  const monster = engine.monsters[1];
  engine.player.x = monster.x - 50; strike(engine);
  const gem = engine.drops.find(drop => drop.material === 'ember-residue');
  assert.ok(gem, 'a hit chance drops the material');
  assert.equal(gem.ore, 2);
  assert.match(engine.message, /coins and Ember Residue/);
  engine.player.x = gem.x;
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  assert.ok(loot.some(drop => drop.material === 'ember-residue' && drop.ore === 2));
  engine.destroy();
});

test('the Celestial town: Codex and Leaderboards stand in Meridian Orrery, and the Rings drop real Celestial materials', () => {
  const town = world.TOWNS.celestial;
  assert.ok(town, 'Meridian Orrery is built');
  assert.equal(town.name, 'Meridian Orrery');
  assert.equal(town.background, 'bg-celestial');
  const byId = Object.fromEntries(town.stations.map(station => [station.id, station]));
  assert.equal(byId.codex.panel, 'codex');
  assert.equal(byId.leaderboards.panel, 'leaderboards');
  assert.equal(byId.waystone.kind, 'waystone');
  assert.equal(town.monsters.length, 0, 'the terrace is quiet ground');
  const rings = world.areaOf(town, byId.passage.to);
  assert.equal(rings.monsters[0].creature, 'ephemeris-leech', 'the canon Celestial creature');

  // Every material the Rings drop is something a crafting recipe actually consumes.
  const recipes = fs.readFileSync(path.resolve(__dirname, '../src/app/shared/crafting/crafting.model.ts'), 'utf8');
  const materials = rings.drops.entries.filter(entry => entry.kind === 'material');
  assert.ok(materials.length >= 1 && materials.length <= 3);
  for (const entry of materials) assert.ok(recipes.includes(`m('${entry.material}'`), `${entry.material} feeds a recipe`);

  // Walk it in the engine: arrive, take the passage, kill a Leech, see alloy fall.
  const { engine, state } = fixture();
  engine.setTown(town);
  assert.equal(state().area, 'Meridian Orrery');
  engine.goToStation('passage', true);
  assert.equal(state().areaId, 'orrery-rings');
  engine.random = () => .99;
  const leech = engine.monsters[0];
  engine.player.x = leech.x - 50;
  for (let n = 0; n < 20 && leech.hp > 0; n++) strike(engine);
  assert.equal(leech.hp, 0);
  assert.deepEqual([...engine.drops.map(drop => drop.material ?? 'coins')].sort(), ['celestial-alloy', 'coins'], 'missed chances drop nothing; alloy is certain');
  engine.destroy();
});

// Drop tables name real stacks: a drop must render (catalogue) and must feed a recipe.
const materialCatalog = loadTs(path.resolve(__dirname, '../src/app/shared/rpg/material-catalog.ts'));
const craftingModel = loadTs(path.resolve(__dirname, '../src/app/shared/crafting/crafting.model.ts'));
const forgeRecipes = loadTs(path.resolve(__dirname, '../src/app/shared/rpg/forge-recipes.ts'));

test('every drop-table material is catalogued and used by at least one recipe', () => {
  const used = new Set([
    ...craftingModel.CRAFTING_RECIPES.flatMap(recipe => recipe.ingredients.map(ingredient => ingredient.materialId)),
    ...forgeRecipes.FORGE_EQUIPMENT_RECIPES.flatMap(recipe => recipe.inputs.map(input => input.id)),
  ]);
  for (const town of Object.values(world.TOWNS).filter(Boolean)) {
    for (const area of [town, ...town.hunts]) {
      const tables = [area.drops, ...area.monsters.map(monster => monster.drops).filter(Boolean)];
      for (const table of tables) {
        for (const entry of table.entries) {
          if (entry.kind !== 'material') continue;
          const where = `${town.id}/${area.id}/${table.id}/${entry.id}`;
          const display = materialCatalog.materialDisplay(entry.material);
          assert.ok(display, `${where}: ${entry.material} is in the material catalogue`);
          assert.equal(entry.label, display.name, `${where}: the label matches the catalogue name`);
          assert.ok(used.has(entry.material), `${where}: ${entry.material} feeds a recipe`);
          assert.ok(entry.qty >= 1 && (entry.chance ?? 1) > 0 && (entry.chance ?? 1) <= 1, `${where}: qty and chance are sane`);
        }
      }
    }
  }
});

test('the Heliograph Court: Market stall, waystone, and a Forager hunt that feeds the Aurumleaf Pendant', () => {
  const town = world.TOWNS.luminous;
  assert.ok(town, 'the Luminous town is registered');
  assert.equal(town.background, 'bg-luminous');
  const market = town.stations.find(station => station.id === 'market');
  assert.equal(market.kind, 'panel'); assert.equal(market.panel, 'market');
  assert.ok(town.stations.some(station => station.kind === 'waystone'), 'the Court has a waystone');
  const passage = town.stations.find(station => station.kind === 'passage');
  const hunt = world.areaOf(town, passage.to);
  assert.ok(hunt && hunt !== town, 'the east stair leads to a hunting ground');
  assert.ok(hunt.stations.some(station => station.kind === 'passage' && station.to === town.id), 'and back');
  assert.deepEqual(hunt.monsters.map(monster => monster.creature), ['prism-forager']);
  // The pendant's inputs come from the Forager table alone, in about ten kills or fewer.
  const pendant = craftingModel.CRAFTING_RECIPES.find(recipe => recipe.id === 'craft-aurumleaf-pendant');
  const kills = pendant.ingredients.map(({ materialId, count }) => {
    const entry = hunt.drops.entries.find(drop => drop.kind === 'material' && drop.material === materialId);
    assert.ok(entry, `the Forager drops ${materialId}`);
    return count / (entry.qty * (entry.chance ?? 1));
  });
  assert.ok(Math.max(...kills) <= 10, `expected kills for one pendant: ${Math.max(...kills).toFixed(1)}`);
  // A town with no monsters runs: the Keeper walks the Court without a hunt to fight.
  const { engine, state } = fixture(() => true, { town });
  assert.equal(engine.monsters.length, 0);
  for (let n = 0; n < 60; n++) engine.update(1 / 60);
  assert.ok(state().hp > 0);
  engine.destroy();
});

// ── The Verdant town (Rootglass Canopy) ──────────────────────────────────────
test('Verdant: Rootglass Canopy hosts the Sanctum, the boards and both gates, and the root path reaches the Thicket', () => {
  const town = world.TOWNS.verdant;
  assert.ok(town, 'the Verdant town is built');
  assert.equal(town.name, 'Rootglass Canopy');
  assert.equal(town.background, 'bg-verdant');
  const panels = Object.fromEntries(town.stations.filter(s => s.kind === 'panel').map(s => [s.id, s.panel]));
  assert.deepEqual(panels, { sanctum: 'sanctum', quests: 'quests', arena: 'arena', trials: 'trials', skills: 'skills' }, 'each panel station id is its own ?at= place');
  assert.ok(town.stations.some(s => s.kind === 'waystone'), 'a Waystone stands in the canopy');
  assert.equal(town.monsters.length, 0, 'the town itself is safe ground');
  const passage = town.stations.find(s => s.kind === 'passage');
  assert.equal(passage.requires, undefined, 'the Thicket is open from the start: the beacon gate is Infernal-only');
  const thicket = world.areaOf(town, passage.to);
  assert.equal(thicket.id, 'rootglass-thicket');
  assert.deepEqual([...thicket.monsters.map(m => m.creature)], ['rootglass-stag']);
});

test('Verdant: a Stag drops coins and real Verdant crafting materials, rolled on the engine RNG', () => {
  const crafting = fs.readFileSync(path.resolve(__dirname, '../src/app/shared/crafting/crafting.model.ts'), 'utf8');
  const town = world.TOWNS.verdant;
  const table = town.hunts[0].drops;
  for (const entry of table.entries.filter(e => e.kind === 'material')) {
    assert.ok(crafting.includes(`m('${entry.material}'`), `${entry.material} is consumed by a crafting recipe`);
    assert.equal(entry.art, entry.material, `${entry.material} draws its own art`);
  }
  const { engine } = fixture(() => true, { town });
  engine.goToStation('passage', true);
  assert.equal(engine.areaDef.id, 'rootglass-thicket');
  engine.random = () => 0; // every chance hits
  killFirst(engine);
  assert.deepEqual([...engine.drops.map(d => d.material ?? 'coins')], ['coins', 'thornroot', 'verdant-sap', 'world-root-bark']);
  engine.random = () => .99; // every chance misses: the certain lines still drop
  const next = engine.monsters[1];
  engine.player.x = next.x - 50;
  for (let n = 0; n < 6; n++) strike(engine);
  const second = engine.drops.filter(d => d.id.includes(':2:')).map(d => d.material ?? 'coins');
  assert.deepEqual([...second], ['coins', 'thornroot']);
  engine.destroy();
});

// ── Phase 2 renderer: per-creature rigs, loot beams and flights, gear on the Keeper ──
const creatures = loadTs(path.resolve(__dirname, '../src/app/play/engine/creature-rigs.ts'));
const lootFx = loadTs(path.resolve(__dirname, '../src/app/play/engine/loot-fx.ts'));
const loadout = loadTs(path.resolve(__dirname, '../src/app/play/engine/loadout.ts'));
const PAINTED = ['rivet-maw', 'prism-forager', 'ephemeris-leech', 'mirror-substitute', 'rootglass-stag'];
const poseInput = (extra = {}) => ({ phase: 'idle', timer: 1, time: 1.3, seed: 0, reduced: false, hurt: 0, ...extra });

test('each painted creature gets its own rig; unknown keys get the generic one', () => {
  const specs = new Set();
  for (const key of PAINTED) {
    const def = creatures.creatureRigFor(key);
    assert.equal(def.key, key);
    specs.add(def.spec);
  }
  assert.equal(specs.size, PAINTED.length, 'no two creatures share a bone layout');
  assert.equal(creatures.creatureRigFor('rivet-maw').spec, poses.MAW_RIG, 'the Rivet Maw keeps its rig');
  for (const key of ['not-a-creature', '', undefined, 'constructor', 'toString']) {
    assert.equal(creatures.creatureRigFor(key), creatures.GENERIC_CREATURE, `${String(key)} falls back`);
  }
  for (const def of [...PAINTED.map(creatures.creatureRigFor), creatures.GENERIC_CREATURE]) {
    const mesh = rig.buildMesh(def.spec, 1);
    assert.ok(mesh.nt <= 150, `${def.key}: ${mesh.nt} triangles`);
    def.spec.bones.forEach((bone, index) => assert.ok(bone.parent < index, `${def.key}.${bone.name} parent precedes it`));
    for (let i = 0; i < mesh.nv; i++) {
      let sum = 0;
      for (let k = 0; k < rig.MAX_INFLUENCES; k++) sum += mesh.wVal[i * rig.MAX_INFLUENCES + k];
      assert.ok(Math.abs(sum - 1) < 1e-5, `${def.key} vertex ${i}`);
    }
    const pose = rig.createPose(def.spec.bones.length);
    def.pose(pose, poseInput({ phase: 'windup', timer: .1, reduced: true, hurt: 1 }));
    assert.equal(rig.isRestPose(pose), true, `${def.key}: reduced motion is the still painting`);
    for (const phase of ['idle', 'windup', 'strike', 'recover']) {
      def.pose(pose, poseInput({ phase, timer: .05 }));
      for (const value of pose) assert.ok(Number.isFinite(value), `${def.key} ${phase} pose is finite`);
    }
    const calm = rig.createPose(def.spec.bones.length), struck = rig.createPose(def.spec.bones.length);
    def.pose(calm, poseInput()); def.pose(struck, poseInput({ hurt: 1 }));
    assert.notDeepEqual([...struck], [...calm], `${def.key}: a hit shows`);
  }
});

test('creature motion: the stag lowers its head, the leech undulates, the mirror sways in reflection, the forager skitters', () => {
  const S = rig.POSE_STRIDE;
  const stag = creatures.creatureRigFor('rootglass-stag');
  const pose = rig.createPose(stag.spec.bones.length);
  stag.pose(pose, poseInput({ phase: 'windup', timer: .05 }));
  assert.ok(pose[creatures.STAG.NECK * S] > .3, 'wind-up drops the neck (the stag faces right)');
  stag.pose(pose, poseInput({ phase: 'strike', timer: .01 }));
  assert.ok(pose[creatures.STAG.ROOT * S + 1] > .12, 'the charge drives forward');

  const leech = creatures.creatureRigFor('ephemeris-leech');
  const L = creatures.LEECH;
  const a = rig.createPose(leech.spec.bones.length);
  // A travelling wave: the abdomen peaks after the head does.
  let headPeak = 0, bellyPeak = 0, headBest = -Infinity, bellyBest = -Infinity;
  for (let n = 0; n < 160; n++) {
    const time = n / 60;
    leech.pose(a, poseInput({ time, seed: 0 }));
    if (a[L.HEAD * S] > headBest) { headBest = a[L.HEAD * S]; headPeak = time; }
    if (a[L.ABDOMEN * S] > bellyBest) { bellyBest = a[L.ABDOMEN * S]; bellyPeak = time; }
  }
  assert.ok(bellyPeak > headPeak, `the wave runs head → abdomen (${headPeak} → ${bellyPeak})`);
  leech.pose(a, poseInput({ phase: 'windup', timer: .05 }));
  assert.ok(a[L.ABDOMEN * S] < -.2, 'the wind-up arches the abdomen forward (faces left)');

  const mirror = creatures.creatureRigFor('mirror-substitute');
  const m = rig.createPose(mirror.spec.bones.length), M = creatures.MIRROR;
  for (const time of [.4, 1.9, 2.6]) {
    mirror.pose(m, poseInput({ time }));
    assert.ok(Math.abs(m[M.ARM_L * S] + m[M.ARM_R * S]) < 1e-6, 'the arms are reflections');
    assert.ok(m[M.HIPS * S] * m[M.CHEST * S] <= 0, 'hips and chest lean opposite ways');
  }
  mirror.pose(m, poseInput({ phase: 'windup', timer: .05 }));
  assert.ok(m[M.ARM_L * S] > .8 && m[M.ARM_R * S] < -.8, 'the wind-up opens both arms wide');

  const forager = creatures.creatureRigFor('prism-forager');
  const f = rig.createPose(forager.spec.bones.length), F = creatures.FORAGER;
  forager.pose(f, poseInput({ time: Math.PI / 3.8 }));
  assert.ok(f[F.LEG_F * S] * f[F.LEG_B * S] < 0, 'the legs skitter in alternation');
  forager.pose(f, poseInput({ phase: 'windup', timer: .05 }));
  assert.ok(f[F.CLAW * S] > 1, 'the claw cocks back before the swipe');
});

test('the engine builds one rig per creature key and reuses it', () => {
  const { engine } = fixture();
  const stag = engine.creatureRig('rootglass-stag');
  assert.equal(stag.def.key, 'rootglass-stag');
  assert.equal(engine.creatureRig('rootglass-stag'), stag, 'built once');
  assert.equal(engine.creatureRig('ephemeris-leech').def.key, 'ephemeris-leech');
  assert.equal(engine.creatureRig('mystery-beast').def.key, 'generic');
  assert.notEqual(engine.creatureRig('prism-forager').sprite, stag.sprite);
  engine.destroy();
});

test('loot beams take the rarity colour; coins and plain materials have defaults', () => {
  assert.equal(lootFx.beamColor('epic', false), lootFx.RARITY_COLORS.epic);
  assert.equal(lootFx.beamColor(undefined, true), lootFx.COIN_BEAM_COLOR);
  assert.equal(lootFx.beamColor(undefined, false), lootFx.RARITY_COLORS.common);
  assert.ok(lootFx.beamHeight('legendary', false) > lootFx.beamHeight('rare', false));
  assert.ok(lootFx.beamHeight('rare', false) > lootFx.beamHeight(undefined, false));
  const { engine } = fixture(() => true, { town: { ...world.TOWNS.infernal, drops: { id: 't', entries: [
    { id: 'coins', kind: 'coins', base: 4 },
    { id: 'gem', kind: 'material', material: 'm', art: 'm', label: 'Star Shard', short: 'shard', qty: 3, rarity: 'rare' },
  ] } } });
  killFirst(engine);
  const [coins, gem] = engine.drops;
  assert.equal(coins.caption, '4 coins');
  assert.equal(gem.caption, '3 x Star Shard');
  assert.equal(gem.color, lootFx.RARITY_COLORS.rare);
  engine.destroy();
});

test('pickup flights start at the drop and end exactly on the satchel', () => {
  const out = { x: 0, y: 0, scale: 0 };
  lootFx.flightPoint(100, 500, 900, 40, 0, out);
  assert.deepEqual([out.x, out.y, out.scale], [100, 500, 1]);
  lootFx.flightPoint(100, 500, 900, 40, 1, out);
  assert.ok(Math.abs(out.x - 900) < 1e-9 && Math.abs(out.y - 40) < 1e-9);
  lootFx.flightPoint(100, 500, 900, 40, .5, out);
  assert.ok(out.y < 500 && out.x > 100 && out.x < 900, 'mid-flight it is in the air between the two');
  lootFx.flightPoint(100, 500, 900, 40, 7, out);
  assert.ok(Math.abs(out.x - 900) < 1e-9, 't is clamped');
  const point = { x: 0, y: 0 };
  lootFx.satchelPoint(null, { left: 0, top: 0, width: 1200, height: 720 }, 1200, 720, point);
  assert.deepEqual(point, { x: 1200 - lootFx.SATCHEL_DEFAULT_INSET, y: lootFx.SATCHEL_DEFAULT_INSET }, 'default: top-right');
  lootFx.satchelPoint({ x: 350, y: 120 }, { left: 50, top: 100, width: 600, height: 360 }, 1200, 720, point);
  assert.deepEqual(point, { x: 600, y: 40 }, 'client px → canvas CSS px, undoing a CSS stretch');
  lootFx.satchelPoint({ x: 2000, y: -30 }, { left: 0, top: 0, width: 1200, height: 720 }, 1200, 720, point);
  assert.deepEqual(point, { x: 1200, y: 0 }, 'an off-canvas satchel clamps to the edge');

  // In the engine: a pickup launches one flight toward the host's satchel.
  const { engine } = fixture(() => true, { satchelTarget: () => ({ x: 600, y: 20 }) });
  const monster = killFirst(engine);
  engine.player.x = monster.x;
  for (let n = 0; n < 40; n++) engine.update(1 / 60);
  const flying = engine.flights.filter(row => row.active);
  assert.equal(flying.length, 2, 'coins and ore both fly');
  for (const row of flying) assert.deepEqual([row.ex, row.ey], [600, 20]);
  engine.setSatchelTarget(null);
  engine.destroy();
});

test('a worn weapon is held by its grip in the hand and points along the swing', () => {
  const t = loadout.createHeldTransform();
  const item = { art: 'x.webp' };
  const aim = loadout.aimFromBladeRotation(-.95);
  loadout.heldTransform(40, -110, aim, item, loadout.WEAPON_DEFAULTS, t);
  const grip = { x: 0, y: 0 }, tip = { x: 0, y: 0 };
  loadout.heldPoint(t, loadout.WEAPON_DEFAULTS.grip.u, loadout.WEAPON_DEFAULTS.grip.v, grip);
  assert.ok(Math.abs(grip.x - 40) < 1e-9 && Math.abs(grip.y + 110) < 1e-9, 'the grip lands on the hand');
  // The painted axis runs grip → tip at the default tilt (diagonal up-right).
  const d = Math.SQRT1_2 * .5;
  loadout.heldPoint(t, loadout.WEAPON_DEFAULTS.grip.u + d, loadout.WEAPON_DEFAULTS.grip.v - d, tip);
  assert.ok(Math.abs(Math.atan2(tip.y - grip.y, tip.x - grip.x) - aim) < 1e-9, 'the blade points along the aim');
  assert.equal(loadout.aimFromBladeRotation(0), -Math.PI / 2, 'an unrotated blade points straight up');
  // A custom grip and tilt.
  loadout.heldTransform(0, 0, 0, { art: 'y', grip: { u: .5, v: 1 }, tilt: -Math.PI / 2, size: 40 }, loadout.WEAPON_DEFAULTS, t);
  loadout.heldPoint(t, .5, 0, tip);
  assert.ok(Math.abs(tip.x - 40) < 1e-9 && Math.abs(tip.y) < 1e-9, 'an upright painting aimed at 0 points right');

  // In the engine: setLoadout draws the weapon at the rig's hand, the off-hand at the back hand.
  const { engine } = fixture();
  const noop = () => {};
  const drawn = [];
  engine.context = new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    drawImage: (image) => drawn.push(image) }, { get: (target, key) => key in target ? target[key] : noop, set: () => true });
  const sword = { complete: true, naturalWidth: 96, naturalHeight: 96 }, shield = { complete: true, naturalWidth: 96, naturalHeight: 96 };
  engine.urlImages.set('assets/sword.webp', sword); engine.urlImages.set('assets/shield.webp', shield);
  engine.keeperRig.render = () => true;
  engine.keeperRig.blit = noop;
  const placed = [];
  engine.keeperRig.attach = (bone, u, v, out) => { out.x = bone * 10; out.y = -100; out.angle = 0; placed.push(bone); return true; };
  engine.setLoadout({ weapon: { art: 'assets/sword.webp', rarity: 'epic' }, offhand: { art: 'assets/shield.webp' }, auraRarity: 'epic' });
  const before = JSON.stringify({ p: engine.player, hp: engine.hp });
  engine.render();
  assert.ok(drawn.includes(sword) && drawn.includes(shield), 'both items are drawn');
  assert.ok(drawn.indexOf(shield) < drawn.indexOf(sword), 'the off-hand goes down first, behind the body');
  assert.deepEqual(placed, [poses.KEEPER.ARM_B, poses.KEEPER.ARM_F]);
  assert.equal(engine.held.x, poses.KEEPER.ARM_F * 10, 'the weapon sits at the front hand');
  assert.equal(JSON.stringify({ p: engine.player, hp: engine.hp }), before, 'gear never touches combat state');
  engine.setLoadout(null);
  drawn.length = 0; engine.render();
  assert.ok(!drawn.includes(sword), 'cleared');
  engine.destroy();
});

// ── Ember Delve: terrain, tools, light ──────────────────────────────────────
const terrainMod = loadTs(path.resolve(__dirname, '../src/app/play/engine/terrain.ts'));
const lightMod = loadTs(path.resolve(__dirname, '../src/app/play/engine/lighting.ts'));
const delveSpec = world.TOWNS.infernal.hunts.find(h => h.id === 'ember-delve').terrain;
function enterDelve(onWorldAction) {
  const { engine, state } = fixture(() => true, { onWorldAction });
  engine.player.x = stationX(engine, 'delve'); engine.player.y = 610; engine.interact();
  assert.equal(state().areaId, 'ember-delve');
  return { engine, state };
}

test('delve terrain generates deterministically from its seed', () => {
  const a = terrainMod.generateTerrain(delveSpec), b = terrainMod.generateTerrain(delveSpec);
  assert.deepEqual(Array.from(a.kind), Array.from(b.kind));
  assert.equal(a.nodeAt(103, 24).id, 'cache');
  assert.equal(a.nodeAt(0, a.rows - 1).id, 'bedrock');
});

test('tools: right tier cracks, low tier clangs with the requirement', () => {
  const n = terrainMod.TERRAIN_NODES;
  assert.equal(terrainMod.toolFor(n['slag-vein'], { pickaxe: 1 }).ok, false);
  assert.deepEqual(terrainMod.toolFor(n['slag-vein'], { pickaxe: 1 }).need, { tool: 'pickaxe', tier: 2 });
  assert.equal(terrainMod.toolFor(n['cinder-vein'], { pickaxe: 2 }).damage, 1.5);
  assert.deepEqual(terrainMod.toolFor(n['cracked-wall'], { pickaxe: 3 }, terrainMod.SWING_TOOLS).need, { tool: 'staff', tier: 1 });
  assert.equal(terrainMod.toolFor(n.bedrock, { pickaxe: 9 }).need, null);
  const { MINING_TIERS } = loadTs(path.resolve(__dirname, '../src/app/shared/activity/activity.model.ts'));
  for (const tier of MINING_TIERS) {
    const node = terrainMod.TERRAIN_NODE_LIST.find(row => row.yield && row.yield.materialId === tier.oreId);
    assert.equal(node.minLevel, tier.unlockLevel); assert.equal(node.xp, tier.xpPerAction);
  }
});

test('digging down: a broken cell is fallable, the Keeper stands on terrain', () => {
  const { engine } = enterDelve(() => true);
  engine.setTools({ pickaxe: 1 });
  const t = engine.terrain;
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  assert.equal(engine.player.y, 610, 'stands on the surface');
  const col = t.colAt(engine.player.x);
  engine.input.add('down');
  for (let n = 0; n < 8 && t.solid(col, 0); n++) { engine.attackCooldown = 0; engine.attack(); }
  engine.input.delete('down');
  assert.equal(t.solid(col, 0), false, 'the cell under the feet broke');
  for (let n = 0; n < 60; n++) engine.update(1 / 60);
  assert.ok(engine.player.y > 610, 'fell into the hole');
  assert.equal(engine.player.grounded, true);
  engine.destroy();
});

test('onWorldAction refusal leaves the ore standing; acceptance breaks it once', () => {
  let accept = false; const events = [];
  const { engine } = enterDelve(e => { events.push(e); return accept; });
  engine.setTools({ pickaxe: 1 });
  const t = engine.terrain;
  t.set(12, 0, terrainMod.nodeIndex('cinder-vein'));
  engine.player.x = 12 * 32 - 30; engine.player.y = 610; engine.facing = 1;
  const hit = () => { engine.attackCooldown = 0; engine.strikeCell(12 * 32 + 16, 626); };
  for (let n = 0; n < 5; n++) hit();
  assert.equal(t.nodeAt(12, 0).id, 'cinder-vein', 'refused: still there');
  assert.ok(events.length >= 1);
  assert.equal(events[0].kind, 'mine'); assert.equal(events[0].materialId, 'cinder-ore'); assert.equal(events[0].discipline, 'mining');
  accept = true; hit();
  assert.equal(t.solid(12, 0), false);
  assert.equal(new Set(events.map(e => e.mutationId)).size, 1, 'retries reuse one mutation id');
  engine.destroy();
});

test('light math: the lantern lifts the dark at its centre and not past its radius', () => {
  const pool = new lightMod.LightPool(4);
  pool.add(0, 0, 200, 1); pool.add(5000, 0, 100, 1);
  assert.equal(lightMod.darknessAt(0, 0, pool.lights, 2, .9), 0);
  assert.equal(lightMod.darknessAt(300, 0, pool.lights, 2, .9), .9);
  assert.equal(lightMod.selectLights(pool.lights, 2, 1, 4990, 0), 1);
  assert.equal(pool.lights[0].x, 5000);
  assert.ok(lightMod.ambientDarkness(0) < lightMod.ambientDarkness(1000));
});

// ── Ember Delve: per-player persistence, biomes, inscriptions ───────────────
const saveMod = loadTs(path.resolve(__dirname, '../src/app/shared/delve/delve-save.model.ts'));
const loreMod = loadTs(path.resolve(__dirname, '../src/app/shared/delve/delve-lore.model.ts'));
const delveArea = world.TOWNS.infernal.hunts.find(h => h.id === 'ember-delve');

/** A DelvePersistence backed by the real save model, the way DelveSaveService is. */
function memoryDelve(seed) {
  const save = saveMod.newDelveSave(seed, 1000);
  const live = new Map();
  return {
    save,
    seed: () => save.seed,
    cells: (id, layout) => { const cells = saveMod.cellsFor(save, id, layout); return cells.size ? cells : null; },
    changed(id, layout, index, kind) {
      let area = live.get(id);
      if (!area || area.layout !== layout) { area = { layout, cells: saveMod.cellsFor(save, id, layout) }; live.set(id, area); }
      if (kind === null) area.cells.delete(index); else area.cells.set(index, kind);
      save.areas[id] = { layout, cells: saveMod.encodeCells(area.cells) };
    },
    isClaimed: id => save.claimed.includes(id),
    claim: id => saveMod.claimOnce(save, id),
  };
}
function enterOwnDelve(delve, extra = {}) {
  const { engine, state } = fixture(() => true, { onWorldAction: () => true, delve, ...extra });
  engine.player.x = stationX(engine, 'delve'); engine.player.y = 610; engine.interact();
  return { engine, state };
}

test('per-player seeds move the veins but never the hand-made stamps or carved walls', () => {
  const a = terrainMod.generateTerrain(delveSpec, 111), b = terrainMod.generateTerrain(delveSpec, 222);
  assert.notDeepEqual(Array.from(a.kind), Array.from(b.kind));
  for (const t of [a, b]) {
    assert.equal(t.nodeAt(103, 24).id, 'cache');
    assert.equal(t.nodeAt(106, 50).id, 'godforge-fragment');
    assert.equal(t.nodeAt(60, 16).id, 'air', 'the Maw cavern is carved for everyone');
    for (const ins of delveSpec.inscriptions) assert.equal(t.nodeAt(ins.col, ins.row).id, 'inscription');
  }
  assert.notEqual(terrainMod.terrainLayout(delveSpec, 111), terrainMod.terrainLayout(delveSpec, 222));
});

test('persistence round-trip: seed + saved diff regenerate the dug Delve cell for cell', () => {
  const delve = memoryDelve(0xabcdef);
  const first = enterOwnDelve(delve);
  first.engine.setTools({ pickaxe: 3, axe: 3, sickle: 3, blade: 3, staff: 3 });
  const t = first.engine.terrain;
  // Dig a few cells through the real swing path, and place one block back.
  for (const [col, row] of [[7, 0], [8, 0], [9, 0]]) {
    first.engine.player.x = col * 32 - 20; first.engine.player.y = 610; first.engine.facing = 1;
    for (let n = 0; n < 12 && t.solid(col, row); n++) { first.engine.attackCooldown = 0; first.engine.strikeCell(col * 32 + 16, 610 + row * 32 + 16); }
    assert.equal(t.solid(col, row), false, `dug ${col},${row}`);
  }
  first.engine.player.x = 400;
  assert.equal(first.engine.placeCell(8, 0, 'rock'), true, 'a block goes into an open cell');
  assert.equal(first.engine.placeCell(8, 0, 'rock'), false, 'not into rock');
  assert.equal(first.engine.placeCell(14, 7, 'inscription'), false, 'only solid blocks');
  const dug = Array.from(t.kind);
  first.engine.destroy();
  // The save is plain JSON: round-trip it through a string like localStorage does.
  const reloaded = saveMod.coerceDelveSave(JSON.parse(JSON.stringify(delve.save)));
  assert.equal(reloaded.seed, 0xabcdef);
  const again = memoryDelve(0); Object.assign(again.save, reloaded);
  const second = enterOwnDelve(again);
  assert.deepEqual(Array.from(second.engine.terrain.kind), dug, 'identical after a reload');
  // And straight from the model, without an engine.
  const fresh = terrainMod.generateTerrain(delveSpec, reloaded.seed);
  terrainMod.applyTerrainDiff(fresh, saveMod.cellsFor(reloaded, 'ember-delve', terrainMod.terrainLayout(delveSpec, reloaded.seed)));
  assert.deepEqual(Array.from(fresh.kind), dug);
  assert.deepEqual(terrainMod.terrainDiff(fresh), saveMod.cellsFor(reloaded, 'ember-delve', terrainMod.terrainLayout(delveSpec, reloaded.seed)));
  second.engine.destroy();
});

test('a diff saved under another layout (version bump, other seed) is dropped, not misapplied', () => {
  const save = saveMod.newDelveSave(5, 1);
  save.areas['ember-delve'] = { layout: '120x40:v1:5', cells: saveMod.encodeCells(new Map([[300, 0]])) };
  assert.equal(saveMod.cellsFor(save, 'ember-delve', terrainMod.terrainLayout(delveSpec, 5)).size, 0);
  assert.deepEqual(saveMod.decodeCells('zz.0,bad,-1.2,4.zzz,a.3'), new Map([[35 * 36 + 35, 0], [10, 3]]));
});

test('merging two devices: the earlier seed wins, same-layout digs union, claims union', () => {
  const older = saveMod.newDelveSave(7, 100), newer = saveMod.newDelveSave(9, 200);
  const layout7 = terrainMod.terrainLayout(delveSpec, 7), layout9 = terrainMod.terrainLayout(delveSpec, 9);
  older.areas['ember-delve'] = { layout: layout7, cells: saveMod.encodeCells(new Map([[1, 0]])) };
  newer.areas['ember-delve'] = { layout: layout9, cells: saveMod.encodeCells(new Map([[2, 0]])) };
  newer.claimed = ['godforge-fragment'];
  for (const merged of [saveMod.mergeDelveSaves(older, newer), saveMod.mergeDelveSaves(newer, older)]) {
    assert.equal(merged.seed, 7);
    assert.equal(merged.areas['ember-delve'].layout, layout7);
    assert.deepEqual(merged.claimed, ['godforge-fragment']);
  }
  const same = saveMod.newDelveSave(7, 100);
  same.areas['ember-delve'] = { layout: layout7, cells: saveMod.encodeCells(new Map([[3, 0], [1, 2]])) };
  const union = saveMod.mergeDelveSaves(same, older);
  assert.deepEqual(saveMod.decodeCells(union.areas['ember-delve'].cells), new Map([[1, 0], [3, 0]]), 'local wins a disagreeing cell');
  assert.equal(saveMod.coerceDelveSave({ seed: -1 }), null);
});

test('biome bands: every row maps to its biome, and the engine reports where the Keeper stands', () => {
  const names = row => terrainMod.biomeAt(delveSpec, row).name;
  assert.equal(names(-3), 'Root Hollows'); assert.equal(names(0), 'Root Hollows'); assert.equal(names(11), 'Root Hollows');
  assert.equal(names(12), 'Basalt Caverns'); assert.equal(names(25), 'Basalt Caverns');
  assert.equal(names(26), 'Glowcap Grotto'); assert.equal(names(39), 'Glowcap Grotto');
  assert.equal(names(40), 'Magma Halls'); assert.equal(names(55), 'Magma Halls'); assert.equal(names(999), 'Magma Halls');
  assert.equal(terrainMod.biomeAt({}, 3), terrainMod.DEFAULT_BIOME);
  const t = terrainMod.generateTerrain(delveSpec);
  assert.equal(t.biomeAt(30).id, 'glowcap-grotto');
  // Each biome carries its own look and nodes.
  const ids = new Set(delveSpec.biomes.map(b => b.id));
  assert.deepEqual([...ids], ['root-hollows', 'basalt-caverns', 'glowcap-grotto', 'magma-halls']);
  assert.ok(delveSpec.biomes.find(b => b.id === 'root-hollows').veins.some(v => v.node === 'shadow-root'));
  assert.ok(delveSpec.biomes.find(b => b.id === 'glowcap-grotto').veins.some(v => v.node === 'glowcap'));
  assert.ok(delveSpec.biomes.find(b => b.id === 'magma-halls').shimmer);
  const { engine, state } = enterOwnDelve(null);
  assert.equal(state().area, 'Ember Delve'); assert.equal(state().biome, 'Root Hollows');
  // Standing in the Maws' cavern (row 19 floor): Basalt Caverns, and the bar names a Maw.
  engine.player.x = 60 * 32; engine.player.y = 610 + 19 * 32;
  assert.equal(state().biome, 'Basalt Caverns');
  assert.equal(state().enemyName, 'Rivet Maw'); assert.ok(state().enemyHp > 0);
  // At the surface ledge nothing is on the Keeper's level: the bar hides.
  engine.player.x = 260; engine.player.y = 610;
  assert.equal(state().enemyHp, 0); assert.equal(state().enemyName, undefined);
  // In the fragment chamber, the guardian.
  engine.player.x = 100 * 32; engine.player.y = 610 + 51 * 32;
  assert.equal(state().enemyName, 'Rune-Warden'); assert.equal(state().biome, 'Magma Halls');
  engine.destroy();
});

test('new nodes: shadow-root and glowcap are Foraging cuts, the fragment pays once and stays dug', () => {
  const n = terrainMod.TERRAIN_NODES;
  assert.equal(n['shadow-root'].yield.materialId, 'shadow-root-cutting'); assert.equal(n['shadow-root'].discipline, 'foraging');
  assert.ok(n['shadow-root'].tools.sickle && n['shadow-root'].tools.blade);
  assert.equal(n.glowcap.yield.materialId, 'glowcap'); assert.equal(n.glowcap.discipline, 'foraging');
  assert.equal(n.inscription.solid, false);
  const delve = memoryDelve(42); const events = [];
  delve.claim(terrainMod.WARDEN_FLAG); // the warden has fallen (see the finale test)
  const { engine } = enterOwnDelve(delve, { onWorldAction: e => { events.push(e); return true; } });
  engine.setTools({ pickaxe: 3, staff: 1 });
  const t = engine.terrain;
  engine.player.x = 105 * 32 + 8; engine.player.y = 610 + 51 * 32; engine.facing = 1;
  for (let n = 0; n < 20 && t.solid(106, 50); n++) { engine.attackCooldown = 0; engine.strikeCell(106 * 32 + 16, 610 + 50 * 32 + 16); }
  assert.equal(t.solid(106, 50), false);
  assert.deepEqual(events.filter(e => e.materialId === 'godforge-fragment').length, 1);
  engine.destroy();
  // Re-entering from the save: the fragment is gone for this player.
  const back = enterOwnDelve(delve);
  assert.equal(back.engine.terrain.nodeAt(106, 50).id, 'air');
  back.engine.destroy();
  // And the claim ledger pays it once even if the rock came back.
  const save = saveMod.newDelveSave(1, 1);
  assert.equal(saveMod.claimOnce(save, 'godforge-fragment'), true);
  assert.equal(saveMod.claimOnce(save, 'godforge-fragment'), false);
});

test('inscriptions: E beside a carved wall reports it; the lore ledger records it once', () => {
  // The model's list and the spec's placements agree, id for id.
  assert.deepEqual(loreMod.INSCRIPTIONS.map(i => [i.id, i.col, i.row]), delveSpec.inscriptions.map(i => [i.id, i.col, i.row]));
  for (const ins of loreMod.INSCRIPTIONS) assert.equal(terrainMod.biomeAt(delveSpec, ins.row).id, ins.biome, ins.id);
  assert.equal(loreMod.INSCRIPTIONS.length, 8);
  const found = [];
  const { engine, state } = enterOwnDelve(null, { onDiscover: e => found.push(e) });
  // The old tunnel in the Root Hollows: floor at row 9, the carving at (19, 7).
  engine.player.x = 19 * 32 + 16; engine.player.y = 610 + 9 * 32; engine.player.vy = 0;
  engine.update(1 / 60);
  assert.equal(state().nearby, 'inscription');
  engine.interact(); engine.interact();
  assert.deepEqual({ ...found[0] }, { kind: 'inscription', id: 'roots-inverse-tree', biome: 'root-hollows' });
  assert.equal(found.length, 2, 'every reading is reported; the host decides what is new');
  engine.destroy();
  const lore = loreMod.emptyDelveLore();
  assert.equal(loreMod.recordInscriptionIn(lore, 'roots-inverse-tree'), true);
  assert.equal(loreMod.recordInscriptionIn(lore, 'roots-inverse-tree'), false);
  assert.equal(loreMod.recordInscriptionIn(lore, 'no-such-carving'), false);
  assert.deepEqual(loreMod.coerceDelveLore({ inscriptions: ['roots-inverse-tree', 'gone', 7] }).inscriptions, ['roots-inverse-tree']);
  assert.deepEqual(loreMod.mergeDelveLore({ inscriptions: ['magma-the-fracture'] }, lore).inscriptions, ['magma-the-fracture', 'roots-inverse-tree']);
});

// ── Delve finale: the warden stays down, the fragment waits for it, Kael's cache ──
test('finale: the Rune-Warden falls once per player and unseals the fragment', () => {
  const delve = memoryDelve(77); const events = [];
  const { engine, state } = enterOwnDelve(delve, { onWorldAction: e => { events.push(e); return true; } });
  engine.setTools({ pickaxe: 3, staff: 1 });
  const t = engine.terrain;
  const warden = () => engine.monsters.find(m => m.def.name === 'Rune-Warden');
  assert.ok(warden(), 'the warden guards the chamber');
  // Swinging at the fragment while the warden stands: it clangs and holds.
  engine.player.x = 105 * 32 + 8; engine.player.y = 610 + 51 * 32; engine.facing = 1;
  const swing = () => { engine.attackCooldown = 0; engine.strikeCell(106 * 32 + 16, 610 + 50 * 32 + 16); };
  for (let n = 0; n < 20; n++) swing();
  assert.equal(t.nodeAt(106, 50).id, 'godforge-fragment', 'sealed while the warden stands');
  assert.match(state().message, /Rune-Warden still stands/);
  assert.equal(events.filter(e => e.materialId === 'godforge-fragment').length, 0);
  // Fell it.
  const w = warden(); w.hp = 1; engine.hurtMonster(w, 50);
  assert.equal(delve.isClaimed(terrainMod.WARDEN_FLAG), true, 'saved per player');
  for (let n = 0; n < 60 * 20; n++) engine.update(1 / 60);
  assert.equal(w.hp, 0, 'never respawns');
  for (let n = 0; n < 20 && t.solid(106, 50); n++) swing();
  assert.equal(t.solid(106, 50), false, 'the fragment comes free');
  assert.equal(events.filter(e => e.materialId === 'godforge-fragment').length, 1);
  engine.restartHunt();
  assert.equal(warden(), undefined, 'a restarted hunt does not raise it');
  engine.destroy();
  // A new session from the same save: no warden at all.
  const back = enterOwnDelve(delve);
  assert.equal(back.engine.monsters.some(m => m.def.name === 'Rune-Warden'), false);
  assert.equal(back.engine.monsters.some(m => m.def.name === 'Magma Maw'), true, 'ordinary Maws still live');
  back.engine.destroy();
  // A fresh player still meets it.
  const fresh = enterOwnDelve(memoryDelve(78));
  assert.equal(fresh.engine.monsters.some(m => m.def.name === 'Rune-Warden'), true);
  fresh.engine.destroy();
});

test("finale: Kael's old cache sits in the Maws' cavern for every seed and pays Kael's Hammer", () => {
  for (const seed of [1, 999, 0xabcdef]) assert.equal(terrainMod.generateTerrain(delveSpec, seed).nodeAt(85, 18).id, 'kaels-cache');
  const node = terrainMod.TERRAIN_NODES['kaels-cache'];
  assert.equal(node.yield.materialId, 'kaels-hammer'); assert.equal(node.discipline, 'exploration');
  assert.equal(terrainMod.biomeAt(delveSpec, 18).id, 'basalt-caverns');
  const events = [];
  const { engine } = enterOwnDelve(memoryDelve(5), { onWorldAction: e => { events.push(e); return true; } });
  engine.setTools({ pickaxe: 1 });
  const t = engine.terrain;
  engine.player.x = 84 * 32 + 8; engine.player.y = 610 + 19 * 32; engine.facing = 1;
  for (let n = 0; n < 8 && t.solid(85, 18); n++) { engine.attackCooldown = 0; engine.strikeCell(85 * 32 + 16, 610 + 18 * 32 + 16); }
  assert.equal(t.solid(85, 18), false);
  assert.deepEqual(events.filter(e => e.materialId === 'kaels-hammer').map(e => e.qty), [1]);
  engine.destroy();
});

// ── Building: place blocks ──────────────────────────────────────────────────
/** A fresh, flat test pit: an open room (cols 20-40, rows 3-8) over a stone floor. */
function buildRoom(engine) {
  const t = engine.terrain, rock = terrainMod.nodeIndex('rock');
  for (let row = 0; row < 12; row++) for (let col = 16; col < 46; col++) t.set(col, row, rock);
  for (let row = 3; row <= 8; row++) for (let col = 20; col <= 40; col++) t.set(col, row, 0);
  engine.player.x = 30 * 32 + 16; engine.player.y = 610 + 9 * 32; engine.player.vy = 0; engine.player.grounded = true; engine.facing = 1;
  return t;
}

test('placeTarget: the floor ahead first (bridging), then the lowest open cell beside the body; Down = under the feet', () => {
  const t = terrainMod.generateTerrain(delveSpec);
  const rock = terrainMod.nodeIndex('rock'), box = { halfWidth: 13, height: 90 };
  for (let row = 0; row < 12; row++) for (let col = 16; col < 46; col++) t.set(col, row, rock);
  for (let row = 3; row <= 8; row++) for (let col = 20; col <= 40; col++) t.set(col, row, 0);
  const x = 30 * 32 + 16, feet = 610 + 9 * 32;
  // Flat floor: the floor ahead is rock, so the lowest open cell beside the body (feet row 8).
  assert.equal(terrainMod.placeTarget(t, x, feet, 1, false, box), t.index(31, 8));
  assert.equal(terrainMod.placeTarget(t, x, feet, -1, false, box), t.index(29, 8));
  // A hole ahead: the floor cell first.
  t.set(31, 9, 0);
  assert.equal(terrainMod.placeTarget(t, x, feet, 1, false, box), t.index(31, 9));
  // Under the feet: only when it is open.
  assert.equal(terrainMod.placeTarget(t, x, feet, 1, true, box), -1);
  t.set(30, 9, 0);
  assert.equal(terrainMod.placeTarget(t, x, feet, 1, true, box), t.index(30, 9));
  // A wall ahead: nowhere to go.
  for (let row = 5; row <= 9; row++) t.set(31, row, rock);
  assert.equal(terrainMod.placeTarget(t, x, feet, 1, false, box), -1);
  // Never onto a carved wall.
  const ins = delveSpec.inscriptions[0];
  assert.equal(terrainMod.isAir(t, ins.col, ins.row), false);
});

test('placing a block: B asks the satchel first, fills the cell, saves it, and the block digs back out', () => {
  const delve = memoryDelve(31); const placed = []; const actions = [];
  let have = 2;
  const { engine, state } = enterOwnDelve(delve, {
    onPlace: e => { placed.push(e); if (have < 1) return false; have--; return true; },
    onWorldAction: e => { actions.push(e); return true; },
  });
  engine.setTools({ pickaxe: 1 });
  const t = buildRoom(engine);
  assert.equal(engine.place(), false, 'nothing chosen yet');
  assert.match(state().message, /Choose something to place/);
  engine.setPlaceable('dirt-block');
  assert.equal(engine.place(), true);
  assert.equal(t.nodeAt(31, 8).id, 'packed-dirt');
  assert.equal(placed[0].item, 'dirt-block'); assert.equal(placed[0].cellKey, '31,8');
  assert.match(state().message, /Dirt block placed/);
  // Stairs: the next goes on top of it.
  assert.equal(engine.place(), true);
  assert.equal(t.nodeAt(31, 7).id, 'packed-dirt');
  assert.notEqual(placed[0].mutationId, placed[1].mutationId, 'each placement its own consume');
  // The satchel is empty: refused, nothing placed.
  assert.equal(engine.place(), false);
  assert.equal(t.nodeAt(31, 6).id, 'air');
  // Never inside the Keeper.
  engine.setPlaceable('basalt-block');
  assert.equal(engine.placeCell(30, 8, 'basalt-block'), false);
  // Saved: the diff carries the placed blocks.
  const layout = terrainMod.terrainLayout(delveSpec, 31);
  const diff = saveMod.cellsFor(delve.save, 'ember-delve', layout);
  assert.equal(diff.get(t.index(31, 8)), terrainMod.nodeIndex('packed-dirt'));
  // Digging a placed block pays the block back (no XP), under a fresh mutation id.
  engine.facing = 1;
  for (let n = 0; n < 4 && t.solid(31, 8); n++) { engine.attackCooldown = 0; engine.strikeCell(31 * 32 + 16, 610 + 8 * 32 + 16); }
  assert.equal(t.solid(31, 8), false);
  const back = actions.find(e => e.cellKey === '31,8');
  assert.equal(back.block, 'dirt-block'); assert.equal(back.xp, 0); assert.match(back.mutationId, /:p\d+$/);
  // Natural dirt and stone drop their blocks too.
  assert.equal(terrainMod.TERRAIN_NODES.dirt.block, 'dirt-block');
  assert.equal(terrainMod.TERRAIN_NODES.rock.block, 'basalt-block');
  assert.equal(terrainMod.TERRAIN_NODES['cinder-vein'].block, undefined, 'ore pays ore, not a block');
  engine.destroy();
  // Reloaded from the save: the second block still stands.
  const again = enterOwnDelve(delve);
  assert.equal(again.engine.terrain.nodeAt(31, 7).id, 'packed-dirt');
  again.engine.destroy();
});

test('a long-press places where it lands, in reach only', () => {
  const { engine } = enterOwnDelve(memoryDelve(32));
  const t = buildRoom(engine);
  engine.setPlaceable('basalt-block');
  // Client px = world px here (1200×720 canvas, scale 1); the camera follows the Keeper.
  engine.render = () => {};
  const at = (col, row) => [col * 32 + 16 - engine.camera, 610 + row * 32 + 16 - engine.cameraY];
  assert.equal(engine.placeAtClient(...at(32, 8)), true);
  assert.equal(t.nodeAt(32, 8).id, 'basalt-block');
  assert.equal(engine.placeAtClient(...at(39, 4)), false, 'out of reach');
  assert.equal(t.nodeAt(39, 4).id, 'air');
  engine.destroy();
});

// ── Building: torches ───────────────────────────────────────────────────────
const craftMod = loadTs(path.resolve(__dirname, '../src/app/shared/crafting/crafting.model.ts'));

test('torches: crafted from Delve materials, placed beside you, always lit, walked through, taken back', () => {
  // The recipe: a stack of three from Root Hollows finds, in the Delve kit.
  const recipe = craftMod.craftingRecipeById('craft-delve-torch');
  assert.equal(recipe.category, 'delve'); assert.equal(recipe.output.stack, true);
  assert.equal(recipe.output.itemId, 'torch'); assert.equal(recipe.output.count, 3);
  assert.deepEqual(recipe.ingredients.map(i => i.materialId).sort(), ['cinder-ore', 'world-root-bark']);
  assert.ok(craftMod.CRAFTING_CATEGORIES.some(c => c.id === 'delve'));
  assert.equal(craftMod.craftXpFor(recipe), craftMod.CRAFT_XP.common, 'a handful is one craft of XP');
  // Light: a torch burns wherever it stands; a vein only once exposed.
  const n = terrainMod.TERRAIN_NODES;
  assert.equal(n.torch.solid, false); assert.equal(n.torch.placeable, 'torch');
  assert.ok(terrainMod.glowIntensity(n.torch, false) > terrainMod.glowIntensity(n['cinder-vein'], true));
  assert.equal(terrainMod.glowIntensity(n['cinder-vein'], false), 0);
  assert.equal(terrainMod.glowIntensity(n.rock, true), 0);

  const delve = memoryDelve(41); const taken = [];
  const { engine, state } = enterOwnDelve(delve, { onTakeBack: e => { taken.push(e); return true; } });
  const t = buildRoom(engine);
  t.set(31, 9, 0); // a hole ahead: a torch never goes in the floor
  engine.setPlaceable('torch');
  assert.equal(engine.place(), true);
  assert.equal(t.nodeAt(31, 8).id, 'torch', 'beside the body, at the feet');
  // Walled in, it goes where you stand.
  const rock = terrainMod.nodeIndex('rock');
  for (let row = 3; row <= 9; row++) t.set(29, row, rock);
  engine.facing = -1;
  assert.equal(engine.place(), true);
  assert.equal(t.nodeAt(30, 8).id, 'torch');
  // Torches never block: the Keeper walks through.
  engine.facing = 1; t.set(31, 9, rock);
  engine.player.x = 30 * 32 + 16;
  engine.input.add('right');
  for (let n = 0; n < 40; n++) engine.update(1 / 60);
  engine.input.delete('right');
  assert.ok(engine.player.x > 31 * 32 + 16, 'walked past the torch');
  // Saved, and back after a reload.
  engine.destroy();
  const again = enterOwnDelve(delve, { onTakeBack: e => { taken.push(e); return true; } });
  const t2 = again.engine.terrain;
  assert.equal(t2.nodeAt(31, 8).id, 'torch');
  // X beside it takes it back into the satchel; the cell is open air again and saved so.
  again.engine.player.x = 30 * 32 + 16; again.engine.player.y = 610 + 9 * 32; again.engine.facing = 1;
  assert.equal(again.engine.takeBack(), true);
  assert.equal(taken.at(-1).item, 'torch'); assert.equal(taken.at(-1).cellKey, '31,8');
  assert.equal(t2.nodeAt(31, 8).id, 'air');
  assert.match(again.state().message, /Torch back in the satchel/);
  // Refused (a full satchel): it stays.
  again.engine.destroy();
  const third = enterOwnDelve(delve, { onTakeBack: () => false });
  third.engine.player.x = 30 * 32 + 16; third.engine.player.y = 610 + 9 * 32; third.engine.facing = -1;
  assert.equal(third.engine.takeBack(), false);
  assert.equal(third.engine.terrain.nodeAt(30, 8).id, 'torch');
  third.engine.destroy();
  // (31, 8) lies in the Root Hollows' old tunnel, generated open: taken back, it needs no diff entry at all.
  assert.equal(t2.base[t2.index(31, 8)], 0);
  assert.equal(saveMod.cellsFor(delve.save, 'ember-delve', terrainMod.terrainLayout(delveSpec, 41)).has(t2.index(31, 8)), false,
    'back to what was generated: the diff stays compact');
});

// ── Building: ladders and platforms ─────────────────────────────────────────
test('ladders: place where you stand, climb, place again — out of a shaft and back down', () => {
  const recipe = craftMod.craftingRecipeById('craft-delve-ladder');
  assert.equal(recipe.output.itemId, 'ladder'); assert.equal(recipe.output.stack, true);
  const delve = memoryDelve(51);
  const { engine } = enterOwnDelve(delve);
  const t = engine.terrain, rock = terrainMod.nodeIndex('rock');
  // A one-cell shaft: col 30, open rows 2..8, rock all round.
  for (let row = 0; row < 12; row++) for (let col = 26; col < 35; col++) t.set(col, row, rock);
  for (let row = 2; row <= 8; row++) t.set(30, row, 0);
  engine.player.x = 30 * 32 + 16; engine.player.y = 610 + 9 * 32; engine.player.vy = 0; engine.facing = 1;
  const step = (frames = 1) => { for (let n = 0; n < frames; n++) engine.update(1 / 60); };
  step(5);
  assert.equal(engine.player.y, 610 + 9 * 32, 'stands on the shaft floor');
  engine.setPlaceable('ladder');
  for (let rung = 0; rung < 3; rung++) {
    assert.equal(engine.place(), true, `ladder ${rung + 1}`);
    step(1);
    engine.setInput('jump', true);
    step(40);
    engine.setInput('jump', false);
    step(10);
  }
  assert.equal(t.nodeAt(30, 8).id, 'ladder'); assert.equal(t.nodeAt(30, 7).id, 'ladder'); assert.equal(t.nodeAt(30, 6).id, 'ladder');
  assert.equal(engine.player.y, 610 + 6 * 32, 'standing on the top rung, three cells up');
  assert.equal(engine.player.grounded, true);
  // Down: drop onto the ladder and climb down to the floor.
  engine.setInput('down', true);
  step(60);
  engine.setInput('down', false);
  step(5);
  assert.equal(engine.player.y, 610 + 9 * 32, 'back on the floor');
  // On a ladder, Up never jumps.
  engine.setInput('jump', true); step(1);
  assert.ok(engine.player.vy >= 0, 'no jump off a ladder');
  engine.setInput('jump', false);
  // The pure model agrees.
  assert.equal(terrainMod.onLadder(t, 30 * 32 + 16, 610 + 9 * 32, { halfWidth: 13, height: 90 }), true);
  assert.equal(terrainMod.onLadder(t, 30 * 32 + 16, 610 + 6 * 32, { halfWidth: 13, height: 90 }), false, 'on top is standing, not climbing');
  engine.destroy();
});

test('platforms: a one-way floor you place across a gap, stand on, and drop through holding Down', () => {
  const recipe = craftMod.craftingRecipeById('craft-delve-platform');
  assert.equal(recipe.output.itemId, 'platform');
  const { engine } = enterOwnDelve(memoryDelve(52));
  const t = buildRoom(engine);
  // A pit ahead: col 31, rows 9..11.
  for (let row = 9; row <= 11; row++) t.set(31, row, 0);
  engine.setPlaceable('platform');
  assert.equal(engine.place(), true);
  assert.equal(t.nodeAt(31, 9).id, 'platform', 'bridges the pit ahead');
  assert.equal(t.solid(31, 9), false);
  // Walk onto it: it holds.
  engine.player.x = 31 * 32 + 16;
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  assert.equal(engine.player.y, 610 + 9 * 32);
  assert.equal(engine.player.grounded, true);
  // A jump up through it from below would pass (one-way); Down drops through.
  engine.setInput('down', true);
  for (let n = 0; n < 40; n++) engine.update(1 / 60);
  engine.setInput('down', false);
  assert.equal(engine.player.y, 610 + 12 * 32, 'fell to the bottom of the pit');
  engine.destroy();
});

// ── Building: chests ────────────────────────────────────────────────────────
test('chests: four kinds of thing, moves counted, saved and merged by moves', () => {
  const recipe = craftMod.craftingRecipeById('craft-delve-chest');
  assert.equal(recipe.output.itemId, 'chest'); assert.equal(recipe.output.count, 1);
  const chest = { layout: 'L', born: 7, n: 0, slots: {} };
  for (const key of ['a', 'b', 'c', 'd']) assert.equal(saveMod.chestPut(chest, key, 2), true);
  assert.equal(saveMod.chestPut(chest, 'e', 1), false, 'a fifth kind does not fit');
  assert.equal(saveMod.chestPut(chest, 'a', 5), true, 'more of a kind it holds always fits');
  assert.equal(chest.slots.a, 7); assert.equal(chest.n, 5);
  assert.equal(saveMod.chestTake(chest, 'a'), 7);
  assert.equal(chest.slots.a, undefined); assert.equal(chest.n, 6);
  assert.equal(saveMod.chestTake(chest, 'zzz'), 0); assert.equal(chest.n, 6, 'a no-op is not a move');
  // On disk: coerced, junk dropped, absent when there are none.
  const save = saveMod.newDelveSave(3, 1);
  assert.equal('chests' in saveMod.coerceDelveSave(save), false);
  save.chests = { [saveMod.chestKey('ember-delve', 300)]: chest, bad: { layout: 1 } };
  const back = saveMod.coerceDelveSave(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(Object.keys(back.chests), ['ember-delve:8c']);
  assert.deepEqual(back.chests['ember-delve:8c'].slots, { b: 2, c: 2, d: 2 });
  // Merge: the copy with more moves wins; a re-placed chest (later born) wins.
  const older = saveMod.newDelveSave(3, 1), newer = saveMod.newDelveSave(3, 1);
  older.chests = { k: { layout: 'L', born: 7, n: 2, slots: { a: 1 } } };
  newer.chests = { k: { layout: 'L', born: 7, n: 5, slots: { a: 9 } }, j: { layout: 'L', born: 1, n: 0, slots: {} } };
  for (const merged of [saveMod.mergeDelveSaves(older, newer), saveMod.mergeDelveSaves(newer, older)]) {
    assert.deepEqual(merged.chests.k.slots, { a: 9 }); assert.ok(merged.chests.j);
  }
  older.chests.k = { layout: 'L', born: 9, n: 0, slots: {} };
  assert.equal(saveMod.mergeDelveSaves(older, newer).chests.k.born, 9);
});

test('chests: placed on ground only, E (or a tap) opens one by its cell, taking back asks the host', () => {
  const used = []; let empty = false;
  const { engine, state } = enterOwnDelve(memoryDelve(61), {
    onUse: e => used.push(e), onTakeBack: e => (e.item === 'chest' ? empty : true),
  });
  const t = buildRoom(engine);
  engine.setPlaceable('chest');
  t.set(31, 9, 0); // nothing under the cell ahead
  assert.equal(engine.place(), false);
  assert.match(state().message, /needs solid ground/);
  t.set(31, 9, terrainMod.nodeIndex('rock'));
  assert.equal(engine.place(), true);
  assert.equal(t.nodeAt(31, 8).id, 'chest');
  engine.update(1 / 60);
  assert.equal(state().nearby, 'chest'); assert.equal(state().nearbyLabel, 'CHEST');
  engine.interact();
  assert.deepEqual({ ...used[0] }, { kind: 'chest', areaId: 'ember-delve', cellKey: '31,8', index: t.index(31, 8) });
  // A tap on it in reach opens it too.
  engine.attackCooldown = 0;
  assert.equal(engine.strikeCell(31 * 32 + 16, 610 + 8 * 32 + 16), true);
  assert.equal(used.length, 2);
  // Not empty: the host refuses and it stays.
  assert.equal(engine.takeBack(), false);
  assert.equal(t.nodeAt(31, 8).id, 'chest');
  empty = true;
  assert.equal(engine.takeBack(), true);
  assert.equal(t.nodeAt(31, 8).id, 'air');
  assert.equal(engine.nodeIdAt('ember-delve', t.index(31, 8)), 'air');
  assert.equal(engine.nodeIdAt('nowhere', 0), null);
  engine.destroy();
});

// ── Building: the camp ──────────────────────────────────────────────────────
test('camp: one per Delve, opens the bench on what can be made now, and town descends straight to it', () => {
  const recipe = craftMod.craftingRecipeById('craft-delve-camp');
  assert.equal(recipe.output.itemId, 'camp'); assert.equal(recipe.output.stack, true);
  // Every Delve-kit recipe makes a placeable from materials the Delve itself gives.
  const placeables = new Set(terrainMod.PLACEABLES.map(p => p.id));
  for (const kit of craftMod.DELVE_KIT_RECIPES) {
    assert.ok(placeables.has(kit.output.itemId), kit.id);
    assert.equal(kit.requiredLevel, 1, kit.id);
  }
  assert.deepEqual(terrainMod.PLACEABLES.map(p => p.id), ['dirt-block', 'basalt-block', 'torch', 'ladder', 'platform', 'chest', 'camp'], 'hotbar order, keys 1-7');
  for (const p of terrainMod.PLACEABLES) assert.equal(terrainMod.TERRAIN_NODES[p.node].placeable ?? terrainMod.TERRAIN_NODES[p.node].block, p.id, p.id);

  const delve = memoryDelve(71); const used = [];
  const { engine, state } = enterOwnDelve(delve, { onUse: e => used.push(e) });
  const t = buildRoom(engine);
  engine.setPlaceable('camp');
  assert.equal(engine.place(), true);
  assert.equal(t.nodeAt(31, 8).id, 'camp');
  assert.ok(terrainMod.glowIntensity(t.nodeAt(31, 8), false) > 0, 'its fire lights the dark');
  engine.facing = -1;
  assert.equal(engine.place(), false, 'a second camp is refused');
  assert.match(state().message, /already have a camp/);
  engine.facing = 1; engine.update(1 / 60);
  assert.equal(state().nearby, 'camp'); assert.equal(state().nearbyLabel, 'YOUR CAMP');
  engine.interact();
  assert.equal(used[0].kind, 'camp');
  // Back to town: the shaft offers the camp, and descending stands the Keeper beside it.
  engine.returnToCamp();
  assert.equal(state().areaId, 'infernal');
  assert.equal(engine.hasDelveCamp(), true);
  assert.equal(engine.descendToCamp(), true);
  assert.equal(state().areaId, 'ember-delve');
  assert.equal(engine.player.x, 31 * 32 + 16); assert.equal(engine.player.y, 610 + 9 * 32);
  assert.equal(engine.descendToCamp(), false, 'only from town');
  engine.destroy();
  // A new session from the save: still there. (buildRoom's rock was never saved, so the
  // camp now stands in the generated tunnel; it still has its floor and room to stand.)
  const next = fixture(() => true, { delve });
  assert.equal(next.engine.hasDelveCamp(), true);
  assert.equal(next.engine.descendToCamp(), true);
  assert.equal(next.state().areaId, 'ember-delve');
  next.engine.destroy();
  // No camp: nothing to descend to.
  const none = fixture(() => true, { delve: memoryDelve(72) });
  assert.equal(none.engine.hasDelveCamp(), false);
  assert.equal(none.engine.descendToCamp(), false);
  none.engine.destroy();
});

// ── Gathering in the hunting grounds, Hunting XP, cross-town ?at=, the lantern ──
const skillTools = loadTs(path.resolve(__dirname, '../src/app/shared/skills/tools.ts'));
const skillUnlocks = loadTs(path.resolve(__dirname, '../src/app/shared/skills/skill-unlocks.ts'));
const hunting = loadTs(path.resolve(__dirname, '../src/app/shared/skills/hunting.ts'));

test('gathering nodes: every realm hunt has them, each one valid, catalogued, crafted with and out of a station\'s reach', () => {
  const { CRAFTING_RECIPES } = loadTs(path.resolve(__dirname, '../src/app/shared/crafting/crafting.model.ts'));
  const used = new Set(CRAFTING_RECIPES.flatMap(recipe => recipe.ingredients.map(ingredient => ingredient.materialId)));
  const skillOf = { mining: 'mining', foraging: 'foraging', woodcutting: 'woodcutting' };
  for (const id of world.REALM_TOWN_IDS) {
    const town = world.TOWNS[id];
    const hunt = town.hunts.find(area => !area.terrain && area.monsters.length);
    assert.ok(hunt?.nodes?.length >= 3, `${id}: its hunting ground has gathering nodes`);
    assert.ok(hunt.nodes.some(node => node.kind === 'herb'), `${id}/${hunt.id}: a herb to cut`);
    assert.ok(hunt.nodes.some(node => Object.values(node.tools).every(tier => tier === 1) && (node.minLevel ?? 1) === 1), `${id}/${hunt.id}: something the starter kit can gather`);
    const ids = hunt.nodes.map(node => node.id);
    assert.equal(new Set(ids).size, ids.length, `${hunt.id}: node ids unique`);
    for (const node of hunt.nodes) {
      const where = `${hunt.id}/${node.id}`;
      assert.ok(node.x > 0 && node.x < hunt.width, `${where} inside`);
      assert.ok(node.x < (hunt.monsters[0].spawnXs[0] - 100), `${where} stands west of the first spawn`);
      for (const station of hunt.stations) assert.ok(Math.abs(station.x - node.x) > world.STATION_REACH, `${where} is not inside ${station.id}'s reach`);
      const tools = Object.entries(node.tools);
      assert.ok(tools.length && tools.every(([tool, tier]) => terrainMod.SWING_TOOLS.includes(tool) && tier >= 1 && tier <= 4), `${where}: swing tools, tier I-IV`);
      assert.ok(node.hp > 0 && node.respawn > 0 && Number.isInteger(node.xp) && node.xp > 0 && node.xp <= 500, `${where}: hp, respawn, xp`);
      assert.ok(materialCatalog.materialDisplay(node.yield.materialId), `${where}: ${node.yield.materialId} is catalogued`);
      assert.ok(used.has(node.yield.materialId), `${where}: ${node.yield.materialId} feeds a recipe`);
      assert.ok(skillOf[node.discipline], `${where}: trains a gathering skill`);
      // The level gate mirrors the Skills panel's "Gather X" row when there is one.
      const row = skillUnlocks.SKILL_UNLOCKS[skillOf[node.discipline]].find(u => u.kind === 'node' && u.materialId === node.yield.materialId);
      if (row) assert.equal(node.minLevel ?? 1, row.level, `${where}: minLevel matches the unlock table`);
    }
  }
});

function enterThicket(extra = {}) {
  const calls = [];
  const { refuse, ...options } = extra;
  const { engine, state } = fixture(() => true, {
    town: world.TOWNS.verdant,
    onWorldAction: event => { calls.push(event); return refuse ? false : true; },
    ...options,
  });
  engine.enter(world.TOWNS.verdant.hunts[0]);
  return { engine, state, calls };
}
function standAt(engine, x) { engine.resetPosition(x); }
function nodeX(engine, id) { return engine.areaDef.nodes.find(node => node.id === id).x; }

test('gathering: the starter sickle cuts starlight in one swing, books it once, and it grows back', () => {
  let clock = 1_700_000_000_000;
  const { engine, state, calls } = enterThicket({ now: () => clock });
  engine.setTools({ sickle: 1, axe: 1, pickaxe: 1 });
  standAt(engine, nodeX(engine, 'starlight-clump') + 30);
  assert.equal(state().nearby, 'gather');
  assert.equal(state().gather.ready, true);
  assert.equal(state().gather.need, undefined);
  strike(engine);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].site, 'starlight-clump');
  assert.equal(calls[0].kind, 'forage');
  assert.equal(calls[0].discipline, 'foraging');
  assert.equal(calls[0].materialId, 'starlight-herb');
  assert.equal(calls[0].qty, 1);
  assert.match(calls[0].mutationId, /^gather:.+:rootglass-thicket:starlight-clump:0$/);
  assert.equal(state().gather.ready, false, 'harvested: resting');
  strike(engine);
  assert.equal(calls.length, 1, 'a resting node books nothing');
  assert.match(state().message, /growing back/);
  engine.setInput('attack', false);
  for (let n = 0; n < 26 * 60; n++) engine.update(1 / 60);
  assert.equal(state().gather.ready, false, 'regrowth runs on the wall clock, not on frames');
  clock += 26_000; engine.update(1 / 60);
  assert.equal(state().gather.ready, true, 'grown back after its respawn');
  strike(engine);
  assert.equal(calls.length, 2);
  assert.match(calls[1].mutationId, /:starlight-clump:1$/, 'each regrowth is a new grant');
  engine.destroy();
});

test('gathering: tiers matter — no tool clangs, a low tier names the tier, a low skill names the level', () => {
  const { engine, state, calls } = enterThicket();
  standAt(engine, nodeX(engine, 'sap-tree'));
  strike(engine);
  assert.equal(calls.length, 0);
  assert.match(state().message, /Need Axe II/);
  assert.equal(state().gather.need, 'Axe II');
  engine.setTools({ axe: 2, levels: { woodcutting: 5 } });
  strike(engine);
  assert.equal(calls.length, 0);
  assert.match(state().message, /Needs Woodcutting 10/);
  engine.setTools({ axe: 2, levels: { woodcutting: 10 } });
  for (let n = 0; n < 2; n++) strike(engine);
  assert.equal(calls.length, 0, 'a tree takes its hits');
  strike(engine);
  assert.equal(calls.length, 1);
  assert.deepEqual([calls[0].kind, calls[0].discipline, calls[0].materialId, calls[0].xp], ['chop', 'woodcutting', 'verdant-sap', 7]);
  engine.destroy();
});

test('gathering: a refusal leaves the node standing on its last crack; E works a node like J; a click on it works it', () => {
  const refused = enterThicket({ refuse: true });
  refused.engine.setTools({ sickle: 1 });
  standAt(refused.engine, nodeX(refused.engine, 'starlight-clump'));
  strike(refused.engine);
  assert.equal(refused.calls.length, 1);
  assert.equal(refused.state().gather.ready, true, 'still standing');
  refused.engine.destroy();
  const { engine, state, calls } = enterThicket();
  engine.setTools({ axe: 1 });
  standAt(engine, nodeX(engine, 'world-root-sapling'));
  for (let n = 0; n < 3; n++) { engine.attackCooldown = 0; engine.interact(); }
  assert.equal(calls.length, 1, 'E chopped the sapling');
  assert.equal(calls[0].materialId, 'world-root-bark');
  engine.setTools({ sickle: 1 });
  const x = nodeX(engine, 'starlight-clump');
  standAt(engine, x + 200);
  engine.attackCooldown = 0;
  assert.equal(engine.strikeAt(x, 570), true, 'a click on the node is taken');
  assert.equal(engine.moving, true, 'out of reach: the Keeper walks there');
  for (let n = 0; n < 120 && calls.length < 2; n++) engine.update(1 / 60);
  assert.equal(calls.length, 2, 'and swings on arrival');
  assert.equal(state().gather.id, 'starlight-clump');
  engine.destroy();
});

test('hunting: each kill reports once with the creature\'s HP; XP scales with HP', () => {
  const kills = [];
  const { engine } = fixture(() => true, { onKill: event => kills.push(event) });
  const monster = killFirst(engine);
  assert.equal(kills.length, 1);
  assert.equal(kills[0].hp, monster.maxHp);
  assert.equal(kills[0].name, 'Rivet Maw');
  assert.equal(kills[0].areaId, 'infernal');
  strike(engine);
  assert.equal(kills.length, 1, 'a dead creature does not die twice');
  engine.setInput('attack', false);
  for (let n = 0; n < 9 * 60; n++) engine.update(1 / 60);
  killFirst(engine);
  assert.ok(kills.length >= 2, 'the risen Maw reports its own kill');
  assert.equal(new Set(kills.map(kill => kill.id)).size, kills.length, 'kill ids are unique (they key the XP grant)');
  assert.equal(hunting.huntingXpFor(60), 12);
  assert.equal(hunting.huntingXpFor(50), 10);
  assert.equal(hunting.huntingXpFor(260), 52);
  assert.equal(hunting.huntingXpFor(0), 1);
  assert.equal(hunting.huntingXpFor(1e6), 500, 'capped at the gateway ceiling');
  engine.destroy();
});

test('findStation: ?at= resolves a station in any built town, the current town first', () => {
  assert.equal(world.findStation('gambler')?.townId, 'umbral');
  assert.equal(world.findStation('crafting')?.townId, 'infernal');
  assert.equal(world.findStation('codex')?.townId, 'celestial');
  assert.equal(world.findStation('skills')?.townId, 'verdant');
  assert.equal(world.findStation('skills').station.panel, 'skills');
  assert.equal(world.findStation('waystone', 'celestial').townId, 'celestial', 'a repeated id resolves in the preferred town');
  assert.equal(world.findStation('waystone').townId, 'infernal', 'without a preference, realm order');
  assert.equal(world.findStation('nowhere'), null);
  assert.equal(world.findStation(''), null);
  assert.equal(world.findStation(null), null);
  assert.equal(world.findStation('rootglass-thicket'), null, 'hunts are not deep-link places');
  for (const id of world.REALM_TOWN_IDS) {
    for (const station of world.TOWNS[id].stations.filter(s => s.kind === 'panel')) {
      const found = world.findStation(station.id);
      assert.equal(found.townId, id, `${station.id} resolves to ${id}`);
      assert.equal(found.station, station);
    }
  }
});

test('lantern: Skills tiles and engine px agree — Delving 1 lights the default reach, each ten levels one more tile', () => {
  assert.equal(skillTools.lanternRadiusFor(1) * terrainMod.CELL, lightMod.DEFAULT_LANTERN);
  const { engine } = fixture();
  assert.equal(engine.lanternRadius, lightMod.DEFAULT_LANTERN);
  engine.setTools({ lanternTiles: skillTools.lanternRadiusFor(30) });
  assert.equal(engine.lanternRadius, 10 * terrainMod.CELL);
  engine.setTools({ lanternTiles: 9, lanternRadius: 999 });
  assert.equal(engine.lanternRadius, 9 * terrainMod.CELL, 'tiles win over px');
  engine.setTools({ lanternRadius: 300 });
  assert.equal(engine.lanternRadius, 300, 'px still accepted');
  const tiers = skillTools.toolTiers({ items: [], equipped: {} }, { version: 1, xpByDiscipline: { exploration: 1e7 } });
  assert.equal(tiers.lanternRadius, 16, 'Delving 99 lights 16 tiles');
  engine.destroy();
});

// ── Gathering regrowth persists: harvest times saved, readiness derived from the wall clock ──
const gatherSave = loadTs(path.resolve(__dirname, '../src/app/shared/skills/gather-save.model.ts'));
/** A GatherPersistence over a real save object, the way GatherSaveService is. */
function gatherStore(save = gatherSave.emptyGatherSave()) {
  return {
    save,
    writes: 0,
    harvestedAt(areaId, nodeId) { return gatherSave.harvestedAtIn(this.save, areaId, nodeId); },
    harvested(areaId, nodeId, at) { if (gatherSave.recordHarvestIn(this.save, areaId, nodeId, at)) this.writes++; },
  };
}

test('gathering regrowth: a harvest is saved as a timestamp and a reload shows the node still regrowing', () => {
  let clock = 1_760_000_000_000;
  const store = gatherStore();
  const first = enterThicket({ now: () => clock, gathering: store });
  first.engine.setTools({ sickle: 1 });
  standAt(first.engine, nodeX(first.engine, 'starlight-clump'));
  strike(first.engine);
  assert.equal(first.calls.length, 1);
  assert.equal(store.writes, 1, 'the harvest was written once');
  assert.equal(store.harvestedAt('rootglass-thicket', 'starlight-clump'), clock, 'stamped with the wall clock');
  const respawn = first.engine.areaDef.nodes.find(node => node.id === 'starlight-clump').respawn;
  first.engine.destroy();

  // "Reload" 10 s later: a fresh engine (new session) over the same save.
  clock += 10_000;
  const second = enterThicket({ now: () => clock, gathering: store });
  standAt(second.engine, nodeX(second.engine, 'starlight-clump'));
  assert.equal(second.state().gather.ready, false, 'still regrowing after the reload');
  assert.equal(second.state().gather.seconds, respawn - 10, 'exactly as far along as the clock says');
  second.engine.setTools({ sickle: 1 });
  strike(second.engine);
  assert.equal(second.calls.length, 0, 'a regrowing node books nothing');
  // A panel open (no frames at all) does not stop the clock.
  clock += (respawn - 10) * 1000;
  second.engine.update(1 / 60);
  assert.equal(second.state().gather.ready, true, 'ready once its respawn has passed in real time');
  second.engine.attackCooldown = 0;
  strike(second.engine);
  assert.equal(second.calls.length, 1);
  assert.equal(store.harvestedAt('rootglass-thicket', 'starlight-clump'), clock, 'the new harvest replaces the old stamp');
  assert.notEqual(second.calls[0].mutationId, first.calls[0].mutationId, 'a new session books a new grant');
  // Long after: the stamp is ancient and the node is simply ready.
  clock += 3_600_000;
  const third = enterThicket({ now: () => clock, gathering: store });
  standAt(third.engine, nodeX(third.engine, 'starlight-clump'));
  assert.equal(third.state().gather.ready, true);
  second.engine.destroy(); third.engine.destroy();
});

test('gathering regrowth: a refused harvest saves nothing; a cloud merge is re-read by setGathering', () => {
  let clock = 1_760_000_000_000;
  const store = gatherStore();
  const refused = enterThicket({ refuse: true, now: () => clock, gathering: store });
  refused.engine.setTools({ sickle: 1 });
  standAt(refused.engine, nodeX(refused.engine, 'starlight-clump'));
  strike(refused.engine);
  assert.equal(store.writes, 0, 'nothing booked, nothing saved');
  refused.engine.destroy();

  const { engine, state } = enterThicket({ now: () => clock, gathering: store });
  standAt(engine, nodeX(engine, 'starlight-clump'));
  assert.equal(state().gather.ready, true);
  // Another device harvested it 5 s ago; cloud save merges that in and tells the engine.
  const merged = gatherSave.mergeGatherSaves({ version: 1, areas: { 'rootglass-thicket': { 'starlight-clump': clock - 5000 } } }, store.save);
  engine.setGathering(gatherStore(merged));
  assert.equal(state().gather.ready, false, 'the merged harvest shows at once');
  // A clock running fast on the other device cannot lock the node away for longer than one respawn.
  const respawn = engine.areaDef.nodes.find(node => node.id === 'starlight-clump').respawn;
  engine.setGathering(gatherStore({ version: 1, areas: { 'rootglass-thicket': { 'starlight-clump': clock + 86_400_000 } } }));
  assert.equal(state().gather.seconds, respawn, 'a future stamp counts as "just harvested"');
  engine.destroy();
});

test('gathering save model: coerced, merged by the later harvest, pruned, and idempotent', () => {
  const M = gatherSave;
  assert.deepEqual(M.coerceGatherSave(null), { version: 1, areas: {} });
  assert.deepEqual(M.coerceGatherSave({ areas: { 'Bad Id': { x: 1 }, ok: { 'n-1': 5, 'n-2': 'x', 'n-3': -1, 'n-4': NaN }, empty: {} } }),
    { version: 1, areas: { ok: { 'n-1': 5 } } }, 'junk ids and stamps are dropped');
  const a = { version: 1, areas: { hunt: { herb: 100, tree: 300 } } };
  const b = { version: 1, areas: { hunt: { herb: 200 }, other: { ore: 50 } } };
  const ab = M.mergeGatherSaves(a, b), ba = M.mergeGatherSaves(b, a);
  assert.deepEqual(ab, { version: 1, areas: { hunt: { herb: 200, tree: 300 }, other: { ore: 50 } } }, 'per node, the later harvest');
  assert.deepEqual(ab, ba, 'commutative');
  assert.deepEqual(M.mergeGatherSaves(ab, ab), ab, 'idempotent');
  assert.deepEqual(a, { version: 1, areas: { hunt: { herb: 100, tree: 300 } } }, 'inputs untouched');
  const save = M.emptyGatherSave();
  assert.equal(M.recordHarvestIn(save, 'hunt', 'herb', 1000), true);
  assert.equal(M.recordHarvestIn(save, 'hunt', 'herb', 1000), false, 'a replay changes nothing');
  assert.equal(M.recordHarvestIn(save, 'hunt', 'herb', 900), false, 'an older stamp never rewinds a node');
  assert.equal(M.recordHarvestIn(save, 'hunt', '__proto__', 1000), false, 'only kebab ids');
  M.recordHarvestIn(save, 'old', 'herb', 1);
  M.pruneGatherSave(save, 1000 + M.PRUNE_MS);
  assert.deepEqual(save.areas, { hunt: { herb: 1000 } }, 'harvests older than a day are forgotten');
  assert.equal(M.regrowSecondsLeft(null, 30, 0), 0);
  assert.equal(M.regrowSecondsLeft(0, 30, 10_000), 20);
  assert.equal(M.regrowSecondsLeft(0, 30, 31_000), 0);
});

// ── The Delve's own creatures spawn under their own art keys, on their stand-ins' bodies ──
test('art keys: the Magma Maw and the Rune-Warden spawn as magma-maw / rune-warden and keep their stand-in rigs', () => {
  const delve = world.TOWNS.infernal.hunts.find(h => h.id === 'ember-delve');
  const byName = Object.fromEntries(delve.monsters.map(m => [m.name, m.creature]));
  assert.equal(byName['Magma Maw'], 'magma-maw');
  assert.equal(byName['Rune-Warden'], 'rune-warden');
  assert.equal(byName['Rivet Maw'], 'rivet-maw', 'the Basalt Maws are still Rivet Maws');
  const maw = creatures.creatureRigFor('magma-maw'), warden = creatures.creatureRigFor('rune-warden');
  assert.equal(maw.key, 'magma-maw'); assert.equal(warden.key, 'rune-warden');
  for (const [own, standIn] of [[maw, creatures.creatureRigFor('rivet-maw')], [warden, creatures.creatureRigFor('mirror-substitute')]]) {
    assert.equal(own.spec, standIn.spec, `${own.key} keeps ${standIn.key}'s bones`);
    assert.equal(own.pose, standIn.pose);
    assert.deepEqual([own.box, own.ground, own.shadow, own.facesLeft], [standIn.box, standIn.ground, standIn.shadow, standIn.facesLeft]);
  }
});
