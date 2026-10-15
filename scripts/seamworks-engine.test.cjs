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

test('the enemy bar hides on a town\'s safe ground and names a Maw past it', () => {
  const { engine, state } = fixture();
  const safeX = engine.areaDef.safeX;
  assert.ok(safeX > 0);
  engine.player.x = engine.areaDef.spawnX;
  assert.equal(state().enemyHp, 0); assert.equal(state().enemyName, undefined);
  engine.player.x = safeX + 10;
  assert.ok(state().enemyHp > 0); assert.equal(state().enemyId, 'rivet-maw');
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

test('heat: a paused world draws one last frame and parks its loop; unpausing resumes it', () => {
  const { engine, state } = fixture();
  let drawn = 0;
  engine.render = () => { drawn++; };
  engine.start();
  assert.equal(drawn, 1, 'start draws the first frame');
  assert.equal(engine.parked, false);
  engine.setPaused(true);
  engine.tick(1000);
  assert.equal(drawn, 2, 'one frame is drawn after pausing');
  assert.equal(engine.frame, null, 'then no next frame is requested');
  assert.equal(engine.parked, true);
  assert.equal(state().paused, true, 'the HUD still hears the pause');
  engine.setPaused(false);
  assert.notEqual(engine.frame, null, 'unpausing requests a frame again');
  assert.equal(engine.previous, 0, 'and the first delta after the pause is zero, not the time spent in the place');
  engine.tick(90000);
  assert.equal(drawn, 3);
  assert.equal(engine.elapsed, 0, 'no simulation time passes for the minutes the place was open');
  engine.destroy();
  engine.setPaused(false);
  assert.equal(engine.frame, null, 'a destroyed engine never restarts');
});

test('heat: frames are capped at 60 per second, and a still town draws at 30', () => {
  const { engine } = fixture();
  let drawn = 0;
  engine.render = () => { drawn++; };
  engine.start();
  // A 120 Hz display: a callback every 8.33 ms.
  let t = 1000;
  const second = () => { const from = drawn; for (let n = 0; n < 120; n++) { t += 1000 / 120; engine.tick(t); } return drawn - from; };
  const first = second();
  assert.ok(first >= 58 && first <= 61, `moving or just arrived: ~60 drawn, got ${first}`);
  second(); second();
  const still = second();
  assert.ok(still >= 29 && still <= 31, `nothing the player drives has moved for 2.5 s: ~30 drawn, got ${still}`);
  engine.setInput('right', true);
  const walking = second();
  assert.ok(walking >= 58 && walking <= 61, `walking again: back to ~60, got ${walking}`);
  engine.setInput('right', false);
  engine.destroy();
});

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

// play-hunting.spec.ts saw "two Maws dying" from one J. That is the cleave, not
// a double count: a swing hits every Maw in reach, and two Maws that walked up
// to the same spot have taken the same blows. Each still pays exactly once.
test('one swing that fells two stacked Maws counts two kills, each paid once', () => {
  const kills = [];
  const loot = [];
  const { engine, state } = fixture(drop => { loot.push(drop); return true; }, { onKill: event => kills.push(event) });
  const [a, b, c] = engine.monsters;
  engine.player.x = a.x - 50; engine.facing = 1;
  b.x = a.x + 30; // the second Maw stands in the same reach
  for (let n = 0; n < 6; n++) strike(engine);
  assert.equal(a.hp, 0); assert.equal(b.hp, 0);
  assert.equal(c.hp, 60, 'a Maw out of reach takes nothing');
  assert.equal(state().kills, 2);
  assert.equal(kills.length, 2, 'onKill fires once per Maw');
  assert.equal(new Set(kills.map(event => event.id)).size, 2, 'each kill has its own id, so Hunting XP is keyed once each');
  assert.equal(engine.drops.length, 4, 'each Maw spills its own coins and ore');
  strike(engine);
  assert.equal(engine.drops.length, 4, 'swinging at the fallen spills nothing more');
  engine.player.x = a.x;
  for (let n = 0; n < 60; n++) engine.update(1 / 60);
  engine.player.x = b.x;
  for (let n = 0; n < 60; n++) engine.update(1 / 60);
  assert.equal(loot.length, 4);
  assert.equal(new Set(loot.map(drop => drop.id)).size, 4, 'no drop is granted twice');
  assert.equal(state().coins, loot.reduce((sum, drop) => sum + (drop.coins ?? 0), 0));
  assert.equal(state().kills, 2, 'collecting does not count a kill again');
  engine.destroy();
});

test('combat swings keep the base pace: a forged pickaxe does not speed up hitting a Maw', () => {
  const { engine } = fixture();
  engine.setTools({ pickaxe: 3, swing: { pickaxe: .25 }, power: { pickaxe: 1.5 } });
  const monster = engine.monsters[0];
  engine.player.x = monster.x - 50; engine.facing = 1;
  engine.setInput('attack', true); engine.setInput('attack', false);
  assert.equal(monster.hp, 50, 'a swing at a Maw deals melee damage, not tool power');
  assert.ok(Math.abs(engine.attackCooldown - .52) < 1e-9, 'the next combat swing waits the full 0.52 s');
  engine.destroy();
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
  assert.deepEqual(umbral.stations.filter(s => s.kind === 'panel').map(s => s.panel).sort(), ['eclipse-ascent', 'gambler', 'reels', 'rune-drop', 'seam-sweeper']);
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

test('the Celestial town: the Codex stands in Meridian Orrery, and the Rings drop real Celestial materials', () => {
  const town = world.TOWNS.celestial;
  assert.ok(town, 'Meridian Orrery is built');
  assert.equal(town.name, 'Meridian Orrery');
  assert.equal(town.background, 'bg-celestial');
  const byId = Object.fromEntries(town.stations.map(station => [station.id, station]));
  assert.equal(byId.codex.panel, 'codex');
  assert.equal(byId.leaderboards, undefined, 'the Leaderboards station closed with the game-only shell (docs/handoff/page-audit.md)');
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
  // The world clock's Afterimage Moth keeps its hour (only under an eclipse): the hunt's own creature is the Forager.
  assert.deepEqual([...new Set(hunt.monsters.filter(monster => !monster.when).map(monster => monster.creature))], ['prism-forager']);
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
  assert.deepEqual([...new Set(thicket.monsters.map(m => m.creature))], ['rootglass-stag']);
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
const { DELVE_I18N } = loadTs(path.resolve(__dirname, '../src/app/play/world/delve.i18n.ts'));
/** A keyed Delve line: its EN template, filled the way the HUD fills it, is exactly the engine's English; ES exists. */
function assertDelveLine(s) {
  const entry = DELVE_I18N[s.messageKey];
  assert.ok(entry && entry.es, `${s.messageKey} has EN + ES`);
  const vars = { ...(s.messageVars || {}) };
  if (vars.item) { const label = terrainMod.placeableById(vars.item).label; vars.name = label; vars.lname = label.toLowerCase(); }
  assert.equal(entry.en.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k])), s.message);
}

test('Delve lines: every play.delve.* key the engine, chest service and HUD use has EN + ES', () => {
  const files = ['../src/app/play/engine/engine.ts', '../src/app/shared/delve/delve-chest.service.ts',
    '../src/app/play/side-scroller.component.ts', '../src/app/play/side-scroller.component.html'];
  let used = 0;
  for (const file of files) {
    const src = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
    for (const [, key] of src.matchAll(/'(play\.delve\.[\w.]+)'/g)) {
      used++;
      assert.ok(DELVE_I18N[key]?.en && DELVE_I18N[key]?.es, `${file}: ${key} has EN + ES`);
    }
  }
  assert.ok(used > 40, `found ${used} keyed lines`);
});
const { HUD_I18N } = loadTs(path.resolve(__dirname, '../src/app/play/world/hud.i18n.ts'));
/** A keyed HUD line: its EN template, filled with the engine's vars, is exactly the engine's English; ES exists. */
function assertHudLine(s, key) {
  assert.equal(s.messageKey, key, `keyed as ${key}: ${s.message}`);
  const entry = HUD_I18N[key];
  assert.ok(entry && entry.es, `${key} has EN + ES`);
  assert.equal(entry.en.replace(/\{\{(\w+)\}\}/g, (_, k) => String(s.messageVars?.[k])), s.message);
}

test('HUD lines: every play.hud.* key the engine and the HUD use has EN + ES', () => {
  const files = ['../src/app/play/engine/engine.ts', '../src/app/play/side-scroller.component.ts', '../src/app/play/side-scroller.component.html'];
  let used = 0;
  for (const file of files) {
    const src = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
    for (const [, key] of src.matchAll(/'(play\.hud\.[\w.]+)'/g)) {
      used++;
      assert.ok(HUD_I18N[key]?.en && HUD_I18N[key]?.es, `${file}: ${key} has EN + ES`);
    }
  }
  assert.ok(used > 100, `found ${used} keyed lines`);
});

test('HUD lines: the quest chain, camp, hunt and drop messages are keyed, and their English matches', () => {
  const { engine, state } = fixture();
  assertHudLine(state(), 'play.hud.obj.start');
  engine.player.x = -9999; engine.interact();
  assertHudLine(state(), 'play.hud.eng.moveCloser');
  killFirst(engine);
  assert.ok(['play.hud.eng.defeatedDrops', 'play.hud.eng.defeated'].includes(state().messageKey));
  assertHudLine(state(), state().messageKey);
  engine.restartHunt();
  assertHudLine(state(), 'play.hud.eng.freshHunt');
  engine.returnToCamp();
  assertHudLine(state(), 'play.hud.eng.backAtCamp');
  engine.destroy();
});
const lightMod = loadTs(path.resolve(__dirname, '../src/app/play/engine/lighting.ts'));
const delveSpec = world.TOWNS.infernal.hunts.find(h => h.id === 'ember-delve').terrain;
/** Set a cell as if the seed had generated it (only generated cells pay, spec §4.2). */
function setGenerated(t, col, row, kind) { t.set(col, row, kind); t.base[t.index(col, row)] = kind; }
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

test('ember-veined basalt leaves Ember Residue a quarter of the time (meaning audit #1)', () => {
  const rock = terrainMod.TERRAIN_NODES['ember-rock'];
  assert.deepEqual(rock.yield, { materialId: 'ember-residue', qty: 1, chance: 0.25 });
  assert.equal(rock.xp, 1);
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
  setGenerated(t, 12, 0, terrainMod.nodeIndex('cinder-vein'));
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
  assert.equal(state().enemyName, 'Rivet Maw'); assert.equal(state().enemyId, 'rivet-maw'); assert.ok(state().enemyHp > 0);
  // At the surface ledge nothing is on the Keeper's level: the bar hides.
  engine.player.x = 260; engine.player.y = 610;
  assert.equal(state().enemyHp, 0); assert.equal(state().enemyName, undefined); assert.equal(state().enemyId, undefined);
  // In the fragment chamber, the guardian.
  engine.player.x = 100 * 32; engine.player.y = 610 + 51 * 32;
  assert.equal(state().enemyName, 'Seam Eater'); assert.equal(state().enemyId, 'seam-eater'); assert.equal(state().biome, 'Magma Halls');
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
  assert.equal(loreMod.INSCRIPTIONS.length, 12, 'three per biome');
  for (const biome of ['root-hollows', 'basalt-caverns', 'glowcap-grotto', 'magma-halls']) {
    assert.equal(loreMod.INSCRIPTIONS.filter(i => i.biome === biome).length, 3, biome);
  }
  // Each carving sits in a cell every seed already opens: no saved dig can name it, so `version` stays.
  const bare = { ...delveSpec, inscriptions: [] };
  for (const seed of [1, 77, 0xabcdef, 0x5eed_de1e]) {
    const t = terrainMod.generateTerrain(bare, seed);
    for (const ins of delveSpec.inscriptions) assert.equal(t.nodeAt(ins.col, ins.row).id, 'air', `${ins.id} @ seed ${seed}`);
  }
  assert.equal(delveSpec.version, 2);
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
test('finale: the Seam Eater falls once per player and unseals the fragment', () => {
  const delve = memoryDelve(77); const events = [];
  const { engine, state } = enterOwnDelve(delve, { onWorldAction: e => { events.push(e); return true; } });
  engine.setTools({ pickaxe: 3, staff: 1 });
  const t = engine.terrain;
  const warden = () => engine.monsters.find(m => m.def.name === 'Seam Eater');
  assert.ok(warden(), 'the warden guards the chamber');
  // Swinging at the fragment while the warden stands: it clangs and holds.
  engine.player.x = 105 * 32 + 8; engine.player.y = 610 + 51 * 32; engine.facing = 1;
  const swing = () => { engine.attackCooldown = 0; engine.strikeCell(106 * 32 + 16, 610 + 50 * 32 + 16); };
  for (let n = 0; n < 20; n++) swing();
  assert.equal(t.nodeAt(106, 50).id, 'godforge-fragment', 'sealed while the warden stands');
  assert.match(state().message, /Seam Eater still stands/);
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
  assert.equal(back.engine.monsters.some(m => m.def.name === 'Seam Eater'), false);
  assert.equal(back.engine.monsters.some(m => m.def.name === 'Cinder Bailiff'), true, 'ordinary Maws still live');
  back.engine.destroy();
  // A fresh player still meets it.
  const fresh = enterOwnDelve(memoryDelve(78));
  assert.equal(fresh.engine.monsters.some(m => m.def.name === 'Seam Eater'), true);
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
  assert.equal(state().messageKey, 'play.delve.chooseFirst');
  assertDelveLine(state());
  engine.setPlaceable('dirt-block');
  assert.equal(engine.place(), true);
  assert.equal(t.nodeAt(31, 8).id, 'packed-dirt');
  assert.equal(placed[0].item, 'dirt-block'); assert.equal(placed[0].cellKey, '31,8');
  assert.match(state().message, /Dirt block placed/);
  assert.equal(state().messageKey, 'play.delve.placed'); assert.equal(state().messageVars.item, 'dirt-block');
  assertDelveLine(state());
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
  // The recipe: a stack of three from Seamworks ore, in the Delve kit.
  const recipe = craftMod.craftingRecipeById('craft-delve-torch');
  assert.equal(recipe.category, 'delve'); assert.equal(recipe.output.stack, true);
  assert.equal(recipe.output.itemId, 'torch'); assert.equal(recipe.output.count, 3);
  // The guaranteed first bench craft: Seamworks ore only, cheap enough for the first two minutes.
  assert.deepEqual(recipe.ingredients.map(i => i.materialId), ['cinder-ore']);
  assert.ok(recipe.ingredients[0].count <= 2 && recipe.goldCost <= 2 && recipe.requiredLevel === 1 && !recipe.skill);
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

test('X reaches as far as E: the chest the prompt names is the one X takes back', () => {
  const taken = [];
  const { engine, state } = enterOwnDelve(memoryDelve(62), { onUse() {}, onTakeBack: e => { taken.push(e); return true; } });
  const t = buildRoom(engine);
  const chest = terrainMod.nodeIndex('chest');
  // The finding: the body overlaps the chest's column, the centre is in the next
  // column, the Keeper faces away. E's prompt names the chest; X used to answer
  // "Nothing placed here".
  t.set(29, 8, chest);
  engine.player.x = 30 * 32 + 6; engine.facing = 1; // body spans x 953..979, into col 29
  engine.update(1 / 60);
  assert.equal(state().nearby, 'chest', 'the prompt names the chest');
  assert.equal(engine.takeBack(), true);
  assert.equal(t.nodeAt(29, 8).id, 'air');
  assert.equal(taken[0].cellKey, '29,8');
  // Clear of the body but within half a cell of it, facing away: still E's reach, so still X's.
  t.set(29, 8, chest);
  engine.player.x = 30 * 32 + 20; engine.facing = 1; // body 967..993 (cols 30-31), E reaches x 951 (col 29)
  engine.update(1 / 60);
  assert.equal(state().nearby, 'chest');
  assert.equal(engine.takeBack(), true);
  assert.equal(t.nodeAt(29, 8).id, 'air');
  // Two things in reach: the one the prompt names wins over the one in front.
  t.set(29, 8, chest); t.set(31, 8, chest);
  engine.player.x = 30 * 32 + 16; engine.facing = 1;
  engine.update(1 / 60);
  const named = engine.findInteractive();
  assert.equal(engine.takeBack(), true);
  assert.equal(t.kind[named], 0, 'the named chest went back');
  // Out of E's reach: X does not take it either.
  t.set(29, 8, 0); t.set(31, 8, 0); t.set(26, 8, chest);
  engine.update(1 / 60);
  assert.notEqual(state().nearby, 'chest');
  assert.equal(engine.takeBack(), false);
  assert.match(state().message, /Nothing placed here/);
  // The pure helper agrees: prefer, then front, then own column, then E's window.
  const box = { halfWidth: 13, height: 90 }, feet = 610 + 9 * 32;
  t.set(26, 8, 0); t.set(28, 8, chest);
  assert.equal(terrainMod.takeTarget(t, 29 * 32 + 6, feet, 1, box), t.index(28, 8), 'E\'s window, behind the Keeper');
  t.set(30, 8, chest);
  assert.equal(terrainMod.takeTarget(t, 29 * 32 + 6, feet, 1, box), t.index(30, 8), 'front first');
  assert.equal(terrainMod.takeTarget(t, 29 * 32 + 6, feet, 1, box, t.index(28, 8)), t.index(28, 8), 'the named cell first');
  assert.equal(terrainMod.takeTarget(t, 29 * 32 + 6, feet, 1, box, t.index(20, 3)), t.index(30, 8), 'a named cell that is not takeable is ignored');
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
    // Level 1, except the Smithing-gated shoring and charges.
    if (kit.skill !== 'smithing') assert.equal(kit.requiredLevel, 1, kit.id);
  }
  assert.deepEqual(terrainMod.PLACEABLES.map(p => p.id),
    ['dirt-block', 'basalt-block', 'torch', 'ladder', 'platform', 'chest', 'camp', 'timber-support', 'basalt-support', 'blast-charge', 'obsidian-block',
      'seam-rail', 'bark-rope', 'rift-anchor'], 'hotbar order, keys 1-9 then 0, then shown only while held');
  assert.equal(terrainMod.HOTBAR_FIXED, 10);
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

// ── Delve extras: loose rock and supports, blasting charges, gear in chests ──
const SWING = ['pickaxe', 'axe', 'sickle', 'blade'];
const HALL_FLOOR = 49; // the Cinder Bailiffs' hall: open rows 44-48 over a bedrock floor
/** A Delve whose Magma hall ceiling (row 43) has a loose cell over the hall, and that column. */
function looseHall() {
  for (let seed = 1; seed < 400; seed++) {
    const t = terrainMod.generateTerrain(delveSpec, seed);
    const cols = [];
    // Clear of the hall's two lava pools (cols 31-35 and 54-58), so the Keeper stands on dry floor.
    for (let col = 37; col <= 52; col++) if (terrainMod.isLoose(t, col, 43)) cols.push(col);
    if (cols.length >= 2 && cols[1] - cols[0] > 8) return { seed, cols };
  }
  throw new Error('no seed with two loose hall cells');
}

test('loose rock: only the Magma Halls, about one cell in five, fixed for every seed, and generation untouched', () => {
  const t = terrainMod.generateTerrain(delveSpec, 4242);
  let band = 0, loose = 0;
  for (let row = 0; row < t.rows; row++) for (let col = 0; col < t.cols; col++) {
    if (!terrainMod.isLoose(t, col, row)) { if (row >= 40 && t.nodeAt(col, row).id === 'scorched-basalt') band++; continue; }
    loose++; band++;
    assert.equal(t.biomeAt(row).id, 'magma-halls');
    assert.equal(t.nodeAt(col, row).id, 'scorched-basalt');
  }
  assert.ok(loose / band > .12 && loose / band < .28, `share ${loose}/${band}`);
  // Dug or replaced, it is no longer loose rock.
  const [col, row] = (() => { for (let r = 40; r < 54; r++) for (let c = 0; c < t.cols; c++) if (terrainMod.isLoose(t, c, r)) return [c, r]; })();
  t.set(col, row, terrainMod.nodeIndex('basalt-block'));
  assert.equal(terrainMod.isLoose(t, col, row), false);
  // Supports: the post holds within its reach (Chebyshev), timber 3, basalt 5.
  const s = terrainMod.generateTerrain(delveSpec, 4242);
  s.set(40, 48, terrainMod.nodeIndex('timber-support'));
  assert.equal(terrainMod.supportNear(s, 43, 45), true);
  assert.equal(terrainMod.supportNear(s, 40, 44), false, 'four rows up is past timber');
  s.set(40, 48, terrainMod.nodeIndex('basalt-support'));
  assert.equal(terrainMod.supportNear(s, 40, 43), true, 'basalt reaches five');
  assert.equal(terrainMod.supportNear(s, 46, 43), false);
  assert.equal(terrainMod.TERRAIN_NODES['timber-support'].solid, false, 'walked through');
});

test('loose rock: digging it with no support drops rubble that bruises, never fells; a support holds it', () => {
  const { seed, cols: [first, second] } = looseHall();
  const { engine, state } = enterOwnDelve(memoryDelve(seed));
  engine.setTools({ pickaxe: 3 });
  // The Bailiffs patrol this hall; this test is about the ceiling, not them.
  engine.monsters.length = 0;
  const t = engine.terrain;
  const stand = col => { engine.player.x = col * 32 + 16; engine.player.y = 610 + HALL_FLOOR * 32; engine.player.vy = 0; engine.player.grounded = true; engine.hurtTime = 0; };
  const dig = (col, row) => { for (let n = 0; n < 10 && t.solid(col, row); n++) engine.hitCell(col, row, SWING, false); };
  stand(first);
  engine.update(1 / 60);
  assert.match(state().message, /Loose rock overhead/, 'named once, when it is close');
  assert.equal(engine.hp, 100);
  dig(first, 43);
  assert.equal(t.solid(first, 43), false);
  assert.match(state().message, /Loose rock!/, 'the groan before it falls');
  engine.update(1 / 60);
  assert.equal(engine.hp, 100, 'nothing falls during the groan: time to step aside');
  for (let n = 0; n < 90; n++) engine.update(1 / 60);
  assert.ok(engine.hp < 100 && engine.hp >= 90, `bruised, ${engine.hp}`);
  assert.match(state().message, /Loose rock hits you/);
  // Never lethal: at 2 HP a chunk leaves the Keeper standing.
  engine.hp = 2; engine.hurtTime = 0;
  engine.dropRubble(engine.player.x, t.top + 44 * 32, '#3a1e1c');
  for (let n = 0; n < 90; n++) engine.update(1 / 60);
  assert.equal(engine.hp, 1);
  // A basalt support on the hall floor holds the ceiling five rows up: no rubble.
  stand(second);
  engine.hp = 100;
  assert.equal(engine.placeCell(second + 2, 48, 'basalt-support'), true);
  dig(second, 43);
  assert.equal(t.solid(second, 43), false);
  for (let n = 0; n < 90; n++) engine.update(1 / 60);
  assert.equal(engine.hp, 100, 'held by the support');
  assert.equal(engine.rubble.some(r => r.active), false);
  engine.destroy();
});

test('blasting charges: Smithing-gated, lit from a staff, clear a small round of rock once, and persist like digging', () => {
  for (const [id, level, out] of [['craft-delve-timber-support', 5, 'timber-support'], ['craft-delve-basalt-support', 12, 'basalt-support'], ['craft-delve-blast-charge', 10, 'blast-charge']]) {
    const recipe = craftMod.craftingRecipeById(id);
    assert.equal(recipe.skill, 'smithing', id); assert.equal(recipe.requiredLevel, level, id);
    assert.equal(recipe.output.itemId, out); assert.equal(recipe.output.stack, true); assert.equal(recipe.category, 'delve');
  }
  const delve = memoryDelve(91); const events = []; const placed = [];
  const { engine, state } = enterOwnDelve(delve, {
    onWorldAction: e => { events.push(e); return true; },
    onPlace: e => { placed.push(e); return true; },
  });
  engine.setTools({ pickaxe: 1 });
  const t = buildRoom(engine);
  t.base = t.kind.slice(); // the test room counts as generated rock (placed cells pay no XP)
  const rock = terrainMod.nodeIndex('rock');
  engine.setPlaceable('blast-charge');
  // No staff: refused before the satchel is asked.
  assert.equal(engine.place(), false);
  assert.match(state().message, /staff to light the fuse/);
  assert.equal(state().messageKey, 'play.delve.needStaff'); assertDelveLine(state());
  assert.equal(placed.length, 0);
  engine.setTools({ pickaxe: 1, staff: 1 });
  // Bedrock and a protected stamp sit in the blast; neither may go.
  t.set(33, 9, terrainMod.nodeIndex('bedrock'));
  t.protect[t.index(29, 9)] = 1;
  // A placed block in reach pays its block back, no XP.
  assert.equal(engine.placeCell(32, 7, 'basalt-block'), true);
  assert.equal(engine.place(), true);
  assert.equal(t.nodeAt(31, 8).id, 'blast-charge');
  assert.match(state().message, /Fuse lit/);
  assert.equal(state().messageKey, 'play.delve.fuseLit'); assertDelveLine(state());
  // The fuse burns: nothing yet.
  for (let n = 0; n < 60; n++) engine.update(1 / 60);
  assert.equal(t.nodeAt(31, 9).id, 'rock');
  for (let n = 0; n < 60; n++) engine.update(1 / 60);
  assert.equal(t.nodeAt(31, 8).id, 'air', 'the charge is spent');
  for (const [col, row] of [[31, 9], [31, 10], [30, 9], [32, 9], [30, 10], [32, 10]]) {
    assert.equal(t.solid(col, row), false, `cleared ${col},${row}`);
  }
  assert.equal(t.nodeAt(33, 9).id, 'bedrock', 'never bedrock');
  assert.equal(t.nodeAt(29, 9).id, 'rock', 'never a protected stamp');
  assert.equal(t.solid(31, 12), true, 'outside the radius stands');
  const rockEvents = events.filter(e => e.kind === 'blast' && e.cellKey !== '32,7');
  assert.ok(rockEvents.length >= 6);
  for (const e of rockEvents) { assert.equal(e.discipline, 'mining'); assert.ok(e.xp >= 1); assert.match(e.mutationId, /^delve:/); }
  const block = events.find(e => e.cellKey === '32,7');
  assert.equal(block.xp, 0); assert.equal(block.block, 'basalt-block');
  assert.match(state().message, /charge goes off: \d+ cells/);
  // Saved like digging.
  const layout = terrainMod.terrainLayout(delveSpec, 91);
  const diff = saveMod.cellsFor(delve.save, 'ember-delve', layout);
  assert.equal(diff.get(t.index(31, 9)), 0);
  // X beside a lit charge pinches it out: it comes back and never goes off.
  t.set(31, 9, rock); t.set(30, 9, rock); t.set(32, 9, rock);
  engine.player.x = 30 * 32 + 16; engine.player.y = 610 + 9 * 32; engine.player.vy = 0; engine.facing = 1;
  assert.equal(engine.place(), true);
  assert.equal(engine.takeBack(), true);
  assert.match(state().message, /pinch the fuse out/);
  for (let n = 0; n < 150; n++) engine.update(1 / 60);
  assert.equal(t.nodeAt(31, 9).id, 'rock');
  engine.destroy();
  const again = enterOwnDelve(delve);
  assert.equal(again.engine.terrain.solid(31, 10), false, 'the blast survives a reload');
  again.engine.destroy();
});

test('blasting charges: the fragment chamber is sealed to a charge until its warden falls, the fragment and caches never', () => {
  const t = terrainMod.generateTerrain(delveSpec, 5);
  const shut = () => false, open = () => true;
  let wall = null;
  for (let row = 44; row < 52 && !wall; row++) for (let col = 90; col < 110 && !wall; col++) {
    if (terrainMod.blastable(t, col, row, 2, open) && !t.protect[t.index(col, row)]) wall = [col, row];
  }
  assert.ok(wall, 'a chamber wall a charge could break');
  assert.equal(terrainMod.blastable(t, ...wall, 2, shut), false, 'sealed until the warden falls');
  for (const [col, row] of [[106, 50], [85, 18], [103, 24], [100, 21]]) assert.equal(terrainMod.blastable(t, col, row, 9, open), false, `${col},${row} protected`);
  // Power is the staff's tier + 1: heartstone (Pickaxe III) needs Staff II.
  t.set(10, 10, terrainMod.nodeIndex('heartstone-vein'));
  assert.equal(terrainMod.blastable(t, 10, 10, 2, open), false);
  assert.equal(terrainMod.blastable(t, 10, 10, 3, open), true);
  const out = new Int32Array(32);
  const n = terrainMod.blastCells(t, 10, 10, 3, open, out);
  assert.ok(n > 0 && n <= 21);
  assert.equal(out[0], t.index(10, 10), 'nearest first');
});

test('chest gear: held by the chest through the ledger location, strays come home', () => {
  const chest = { layout: 'L', born: 1234, n: 0, slots: {} };
  assert.equal(saveMod.chestHolderId(chest), 'delve-chest:1234');
  assert.equal(saveMod.isChestHolder('delve-chest:1234'), true);
  assert.equal(saveMod.isChestHolder('explorer-7'), false);
  assert.equal(saveMod.isChestHolder(undefined), false);
  const items = [
    { id: 'a', explorerId: 'delve-chest:1234' }, { id: 'b', explorerId: 'delve-chest:99' },
    { id: 'c', explorerId: 'thrall-1' }, { id: 'd' },
  ];
  assert.deepEqual(saveMod.strayChestGear(items, { 'ember-delve:8c': chest }), ['b']);
  assert.deepEqual(saveMod.strayChestGear(items, undefined), ['a', 'b']);
  assert.equal(saveMod.CHEST_GEAR_SLOTS, 6);
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

// ── The world clock (docs/handoff/world-clock.md): the things that keep an hour ──
const worldClock = loadTs(path.resolve(__dirname, '../src/app/shared/world-clock/world-clock.model.ts'));
const skyOf = (day, minute, alignedHunt = null) => ({ ...worldClock.skyAt(worldClock.msAt(day, minute)), alignedHunt });

test('world clock: the Moonwake opens only in the dark, the Eclipse Glass only under an eclipse, the aligned realm gives two', () => {
  const { engine, state, calls } = enterThicket();
  engine.setTools({ sickle: 1, axe: 1, pickaxe: 1 });
  engine.setSky(skyOf(1, 12 * 60));
  // By day: a shut bud that says when, and refuses the sickle; the eclipse's outcrop is not there at all.
  standAt(engine, nodeX(engine, 'moonwake'));
  assert.equal(state().nearby, 'gather');
  assert.equal(state().gather.id, 'moonwake');
  assert.equal(state().gather.shut, true);
  strike(engine);
  assert.equal(calls.length, 0);
  assert.match(state().message, /shut tight/);
  assert.equal(state().timed, '');
  standAt(engine, nodeX(engine, 'eclipse-glass'));
  assert.notEqual(state().gather?.id, 'eclipse-glass');
  // Night: it opens and cuts like any herb.
  engine.setSky(skyOf(1, 23 * 60));
  assert.equal(state().timed, 'moonwake');
  standAt(engine, nodeX(engine, 'moonwake'));
  assert.equal(state().gather.shut, undefined);
  strike(engine);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].materialId, 'moonwake-bloom');
  // An eclipse aligned with the Verdant: the outcrop rises, the Moonwake opens at noon too, and the glass comes two a cut.
  assert.equal(worldClock.isEclipseDay(22), true);
  engine.setSky(skyOf(22, 14 * 60, 'rootglass-thicket'));
  assert.equal(state().timed, 'moonwake,eclipse-glass');
  standAt(engine, nodeX(engine, 'eclipse-glass'));
  assert.equal(state().gather.id, 'eclipse-glass');
  for (let n = 0; n < 6 && calls.length < 2; n++) strike(engine);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].materialId, 'eclipse-glass');
  assert.equal(calls[1].qty, 2, 'the aligned realm\'s glass comes two a cut');
  // The eclipse passes: the outcrop is gone again.
  engine.setSky(skyOf(23, 12 * 60));
  standAt(engine, nodeX(engine, 'eclipse-glass'));
  assert.notEqual(state().gather?.id, 'eclipse-glass');
  engine.destroy();
});

test('world clock: the Ink Lantern rises in the Corridors when the dark comes and fades when it goes; the Moth only under an eclipse', () => {
  const { engine } = fixture(() => true, { town: world.TOWNS.umbral });
  engine.enter(world.TOWNS.umbral.hunts[0]);
  engine.setSky(skyOf(1, 12 * 60));
  const lanterns = () => engine.monsters.filter(m => m.def.creature === 'ink-lantern').length;
  assert.equal(lanterns(), 0, 'not by day');
  engine.setSky(skyOf(1, 23 * 60));
  assert.equal(lanterns(), 2, 'out at night');
  assert.ok(engine.monsters.filter(m => m.def.creature === 'ink-lantern').every(m => m.born > 0), 'they rise');
  engine.setSky(skyOf(2, 7 * 60 + 30));
  assert.equal(lanterns(), 0, 'gone with the dawn (idle ones fade)');
  engine.setSky(skyOf(2, 14 * 60));
  assert.equal(lanterns(), 2, 'the eclipse is a night at noon');
  engine.destroy();
  const channels = fixture(() => true, { town: world.TOWNS.luminous });
  channels.engine.enter(world.TOWNS.luminous.hunts[0]);
  channels.engine.setSky(skyOf(1, 23 * 60));
  assert.equal(channels.engine.monsters.filter(m => m.def.creature === 'afterimage-moth').length, 0, 'the Moth is not a night thing');
  channels.engine.setSky(skyOf(7, 12 * 60));
  assert.equal(channels.engine.monsters.filter(m => m.def.creature === 'afterimage-moth').length, 1, 'it rises under the eclipse');
  channels.engine.destroy();
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
test('art keys: the Cinder Bailiff and the Seam Eater spawn as cinder-bailiff / seam-eater and keep their stand-in rigs', () => {
  const delve = world.TOWNS.infernal.hunts.find(h => h.id === 'ember-delve');
  const byName = Object.fromEntries(delve.monsters.map(m => [m.name, m.creature]));
  assert.equal(byName['Cinder Bailiff'], 'cinder-bailiff');
  assert.equal(byName['Seam Eater'], 'seam-eater');
  assert.equal(byName['Rivet Maw'], 'rivet-maw', 'the Basalt Maws are still Rivet Maws');
  // Atlas names, each with its own drop table (meaning audit #14).
  const mats = name => delve.monsters.find(m => m.name === name).drops.entries.filter(e => e.kind === 'material').map(e => e.material);
  assert.deepEqual(mats('Cinder Bailiff'), ['cinder-ore', 'ember-residue', 'infernal-heartstone']);
  assert.deepEqual(mats('Seam Eater'), ['slag-fragment', 'ember-residue', 'infernal-heartstone']);
  assert.equal(delve.monsters.find(m => m.name === 'Seam Eater').once, terrainMod.WARDEN_FLAG, 'the Seam Eater still falls once per player');
  const maw = creatures.creatureRigFor('cinder-bailiff'), warden = creatures.creatureRigFor('seam-eater');
  assert.equal(maw.key, 'cinder-bailiff'); assert.equal(warden.key, 'seam-eater');
  for (const [own, standIn] of [[maw, creatures.creatureRigFor('rivet-maw')], [warden, creatures.creatureRigFor('mirror-substitute')]]) {
    assert.equal(own.spec, standIn.spec, `${own.key} keeps ${standIn.key}'s bones`);
    assert.equal(own.pose, standIn.pose);
    assert.deepEqual([own.box, own.ground, own.shadow, own.facesLeft], [standIn.box, standIn.ground, standIn.shadow, standIn.facesLeft]);
  }
});

// ── Phase 4 Life: keepers at stations, wandering townsfolk, per-realm atmosphere ──
const life = loadTs(path.resolve(__dirname, '../src/app/play/world/life.ts'));
const lifeI18n = loadTs(path.resolve(__dirname, '../src/app/play/world/life.i18n.ts')).LIFE_I18N;
const townLifeMod = loadTs(path.resolve(__dirname, '../src/app/play/engine/town-life.ts'));
const atmosphereMod = loadTs(path.resolve(__dirname, '../src/app/play/engine/atmosphere.ts'));
const npcModel = loadTs(path.resolve(__dirname, '../src/app/shared/npc/npc.model.ts'));
const LIFE_FLOOR = loadTs(path.resolve(__dirname, '../src/app/play/engine/engine.model.ts')).FLOOR;
const builtTowns = () => Object.values(world.TOWNS).filter(Boolean);
const footprintOf = s => [s.x - (s.width ?? 120) / 2, s.x + (s.width ?? 120) / 2];
/** A canvas context that records every call and draws nothing. */
function recordingContext() {
  const calls = [];
  const target = { calls, measureText: text => ({ width: String(text).length * 7 }) };
  return new Proxy(target, {
    get(obj, key) {
      if (key in obj) return obj[key];
      return (...args) => { calls.push([key, ...args]); };
    },
    set(obj, key, value) { obj[key] = value; return true; },
  });
}

test('life: every panel station has a keeper beside it, never on a footprint or another keeper', () => {
  for (const town of builtTowns()) {
    const placed = life.placeKeepers(town);
    assert.equal(placed.length, life.TOWN_KEEPERS[town.realm].length, `${town.id}: every keeper found a spot`);
    for (const station of town.stations.filter(s => s.kind === 'panel')) {
      assert.ok(placed.some(p => p.station.id === station.id || (p.def.serves || []).includes(station.id)), `${town.id}/${station.id} has a keeper`);
    }
    for (const p of placed) {
      const body = [p.x - life.KEEPER_HALF, p.x + life.KEEPER_HALF];
      for (const station of town.stations) {
        const [s0, s1] = footprintOf(station);
        assert.ok(body[1] <= s0 || body[0] >= s1, `${town.id}: ${p.def.id} clears ${station.id}`);
      }
      for (const other of placed) if (other !== p) {
        assert.ok(Math.abs(other.x - p.x) >= life.KEEPER_HALF * 2, `${town.id}: ${p.def.id} and ${other.def.id} do not overlap`);
      }
      const [s0, s1] = footprintOf(p.station);
      const gap = p.x < s0 ? s0 - p.x : p.x - s1;
      assert.ok(gap > 0 && gap <= life.KEEPER_HALF + life.KEEPER_GAP + 80, `${p.def.id} stands beside ${p.station.id} (${gap}px)`);
      assert.ok(p.x > 0 && p.x < town.width);
    }
  }
  const at = (realm, id) => life.placeKeepers(world.TOWNS[realm]).find(p => p.def.id === id);
  assert.equal(at('infernal', 'kael').station.id, 'runes', 'Kael at the Rune Forge');
  assert.equal(at('luminous', 'merchant').station.id, 'market', 'the Merchant at the Market');
  assert.equal(at('celestial', 'archivist').station.id, 'codex', 'the Archivist at the Codex');
  assert.ok(at('luminous', 'aureth'), 'Aureth stands in Luminous');
  assert.ok(at('umbral', 'verrin'), 'Verrin stands in Umbral');
  // The Croupier runs the Gambler and the four games of chance, which stand in
  // a row just east of it, and stands between the Gambler and the Reels.
  const croupier = at('umbral', 'croupier');
  const reels = world.TOWNS.umbral.stations.find(s => s.id === 'reels');
  assert.deepEqual([...croupier.def.serves], ['reels', 'rune-drop', 'seam-sweeper', 'eclipse-ascent']);
  const games = croupier.def.serves.map(id => world.TOWNS.umbral.stations.find(s => s.id === id));
  for (let i = 1; i < games.length; i++) assert.ok(footprintOf(games[i])[0] >= footprintOf(games[i - 1])[1], `${games[i].id} stands east of ${games[i - 1].id}, clear of it`);
  assert.ok(croupier.x < footprintOf(reels)[0] && footprintOf(reels)[0] - croupier.x <= life.KEEPER_HALF + life.KEEPER_GAP + 80, 'the Croupier stands beside the Reels too');
});

test('life: name tags and chatter are i18n keys in EN + ES; canon keepers only say their canon lines', () => {
  const ids = new Set();
  for (const town of builtTowns()) {
    for (const def of life.TOWN_KEEPERS[town.realm]) {
      assert.ok(!ids.has(def.id), `${def.id} is unique`); ids.add(def.id);
      for (const key of [def.nameKey, ...def.lines]) {
        const row = lifeI18n[key];
        assert.ok(row && row.en && row.es, `${key} has EN and ES`);
      }
      assert.ok(def.lines.length >= 1 && def.lines.every(k => lifeI18n[k].en.length <= 90), `${def.id}: short lines, no walls of text`);
      assert.match(def.art, /-figure$/, `${def.id} uses a full-figure art key, not the menu portrait`);
      if (def.npc) {
        const canon = npcModel.DIALOGUE.filter(t => t.npcId === def.npc).flatMap(t => t.lines);
        for (const key of def.lines) assert.ok(canon.includes(lifeI18n[key].en), `${def.id}: "${lifeI18n[key].en}" is canon`);
        assert.equal(lifeI18n[def.nameKey].en, npcModel.npcById(def.npc).name, `${def.id} is named as the cast names them`);
      }
    }
  }
});

test('life: townsfolk wander only open floor, stay in bounds, yield to the Keeper and keep moving', () => {
  for (const town of builtTowns()) {
    const placed = life.placeKeepers(town);
    const segments = life.wanderSegments(town, placed);
    assert.ok(segments.length > 0, `${town.id} has open floor`);
    for (const [lo, hi] of segments) {
      assert.ok(hi - lo >= life.WANDER_MIN);
      for (const station of town.stations) {
        const [s0, s1] = footprintOf(station);
        assert.ok(hi <= s0 || lo >= s1, `${town.id}: segment ${lo}-${hi} avoids ${station.id}`);
      }
      for (const p of placed) assert.ok(hi <= p.x - life.KEEPER_HALF || lo >= p.x + life.KEEPER_HALF, `${town.id}: segment avoids ${p.def.id}`);
      if (town.safeX) assert.ok(hi <= town.safeX, `${town.id}: townsfolk stay on the safe side`);
    }
    const crowd = new life.TownsfolkCrowd(town, placed);
    assert.ok(crowd.folk.length >= 2 && crowd.folk.length <= life.TOWNSFOLK_MAX, `${town.id}: 2-4 townsfolk`);
    const start = crowd.folk.map(p => p.x);
    let moved = 0;
    for (let n = 0; n < 60 * 120; n++) {
      crowd.update(1 / 60, 400 + (n % 2000));
      for (const p of crowd.folk) {
        assert.ok(p.x >= p.lo && p.x <= p.hi, `${town.id}: in bounds`);
        assert.ok(segments.some(([lo, hi]) => p.lo === lo && p.hi === hi), 'wanders an open segment');
      }
    }
    crowd.folk.forEach((p, i) => { if (Math.abs(p.x - start[i]) > 1) moved++; });
    assert.ok(moved > 0, `${town.id}: the crowd is alive`);
    // Deterministic per seed.
    const again = new life.TownsfolkCrowd(town, placed);
    assert.deepEqual(again.folk.map(p => p.x), start);
  }
  // Yield: a walker heading at the Keeper stops short instead of walking through.
  const town = world.TOWNS.umbral;
  const crowd = new life.TownsfolkCrowd(town, life.placeKeepers(town));
  const p = crowd.folk[0];
  p.pause = 0; p.target = p.hi; p.x = p.lo;
  crowd.update(1 / 60, p.lo + 40);
  assert.ok(p.pause > 0 && p.x === p.lo, 'stops when the Keeper is just ahead');
  // Elbow room: one standing where the Keeper stands walks off, and never stops behind the Keeper.
  const q = crowd.folk[0];
  const mid = (q.lo + q.hi) / 2;
  q.x = mid; q.pause = 5; q.target = mid;
  for (let n = 0; n < 60 * 8; n++) crowd.update(1 / 60, mid + 10);
  assert.ok(Math.abs(q.x - (mid + 10)) >= life.TOWNSFOLK_CLEAR, 'a townsperson does not stand behind the Keeper');
  // Pinned against the end of its floor (a stall, a keeper): it passes behind the Keeper to the open side.
  q.x = q.hi; q.pause = 5; q.target = q.hi; q.passing = false;
  for (let n = 0; n < 60 * 8; n++) crowd.update(1 / 60, q.hi - 10);
  assert.ok(Math.abs(q.x - (q.hi - 10)) >= life.TOWNSFOLK_CLEAR, 'a cornered townsperson passes to the open side');
});

test('life: every townsperson names where a local material is found (meaning audit #6)', () => {
  assert.ok(lifeI18n[life.TOWNSFOLK_LINE].en.includes('{{material}}') && lifeI18n[life.TOWNSFOLK_LINE].es.includes('{{place}}'));
  for (const town of builtTowns()) {
    const lines = life.townsfolkLines(town);
    assert.ok(lines.length > 0, `${town.id}: its hunts yield something to name`);
    for (const line of lines) assert.ok(town.hunts.some(h => h.name === line.place), `${town.id}: ${line.place} is one of its hunts`);
    const crowd = new life.TownsfolkCrowd(town, life.placeKeepers(town));
    for (const p of crowd.folk) assert.deepEqual(p.def.lines, [life.TOWNSFOLK_LINE]);
    if (crowd.folk.length > 1 && lines.length > 1) assert.notDeepEqual(crowd.folk[0].says, crowd.folk[1].says, `${town.id}: neighbours say different things`);
  }
  // A townsperson speaks when the Keeper walks up, and the bubble fills the line.
  const town = world.TOWNS.infernal;
  const tl = new townLifeMod.TownLife();
  tl.enter(town, town);
  const folk = tl.townsfolk.folk[0];
  let t = 0;
  for (let n = 0; n < 30 && tl.townsfolkSpeaking < 0; n++) { t += 1 / 60; tl.update(1 / 60, folk.x, t); }
  assert.ok(tl.townsfolkSpeaking >= 0, 'a townsperson greets the Keeper');
});

test('life: off-camera figures are culled; keepers face the Keeper; chatter is one line per approach', () => {
  assert.equal(life.onScreen(500, 0, 1200), true);
  assert.equal(life.onScreen(-200, 0, 1200), false);
  assert.equal(life.onScreen(1400, 0, 1200), false);
  const town = world.TOWNS.infernal;
  const tl = new townLifeMod.TownLife();
  tl.enter(town, town);
  assert.ok(tl.keepers.length >= 4);
  const frame = { camera: 0, viewport: 1200, time: 0, reduced: true, playerX: 0, pixelScale: 1, image: () => undefined, translate: k => lifeI18n[k]?.en ?? k };
  const near = recordingContext();
  frame.camera = tl.keepers[0].x - 600; tl.draw(near, frame);
  const far = recordingContext();
  frame.camera = town.width + 5000; tl.draw(far, frame);
  assert.ok(near.calls.length > 40, 'figures in view are drawn');
  assert.equal(far.calls.length, 0, 'nothing off camera is drawn');
  // A hunt clears the stage.
  tl.enter(town.hunts[0], town);
  assert.equal(tl.keepers.length, 0);
  assert.equal(tl.townsfolk, null);

  // Chatter: approach once, one line; linger, silence; leave and return, the next line.
  tl.enter(town, town);
  const kael = tl.keepers.findIndex(p => p.def.id === 'kael');
  const kx = tl.keepers[kael].x;
  let t = 0;
  const step = x => { t += 1 / 60; tl.update(1 / 60, x, t); };
  for (let n = 0; n < 30; n++) step(kx + 1000);
  assert.equal(tl.speaking, null);
  step(kx + 60);
  assert.deepEqual(tl.speaking, { keeper: 'kael', line: 'play.life.line.kael.1' });
  for (let n = 0; n < 120; n++) step(kx + 60);
  assert.ok(tl.facing[kael] > .9, 'Kael turns toward the Keeper');
  for (let n = 0; n < 60 * 8; n++) step(kx + 60);
  assert.equal(tl.speaking, null, 'one line, then quiet while the Keeper lingers');
  for (let n = 0; n < 60 * 25; n++) step(kx + 2000);
  step(kx - 60);
  assert.deepEqual(tl.speaking, { keeper: 'kael', line: 'play.life.line.kael.2' }, 'the next approach gets the next line');
  for (let n = 0; n < 60; n++) step(kx - 60);
  assert.ok(tl.facing[kael] < -.5, 'and turns to face the Keeper on the other side');
});

test('life (S3): people wear their name with the role title under it; every keeper has 4-8 lines and a People entry', () => {
  const keeperLinesMod = loadTs(path.resolve(__dirname, '../src/app/play/world/keeper-lines.ts'));
  const people = loadTs(path.resolve(__dirname, '../src/app/codex/people.i18n.ts')).PEOPLE_I18N;
  const named = { 'bench-smith': ['Mara Voss', 'Bench Smith'], 'buyback-clerk': ['Edrin Kade', 'Buyback Clerk'], tomas: ['Tomas Rill', 'Lantern Keeper'],
    ilyra: ['Ilyra Venn', 'Archive Listener'], sera: ['Sera Quill', 'Chief Meridian'], 'chart-clerk': ['Nox Aster', 'Chart Clerk'], rook: ['Rook Sable', 'Veil Cartographer'],
    broker: ['Amina Thorne', 'Exchange Broker'], 'lodge-warden': ['Kesh Arbo', 'Lodge Warden'], steward: ['Siv Moss', 'Expedition Steward'],
    'vault-clerk': ['Orla Stave', 'Vault Clerk'], enchanter: ['Idris Calder', 'Enchanter'], croupier: ['Lune Coyne', 'Croupier'],
    herald: ['Pim Larkin', 'Board Herald'], gatekeeper: ['Corran Holt', 'Arena Gatekeeper'], 'trials-warden': ['Hesta Cairn', 'Trials Warden'] };
  const all = Object.values(life.TOWN_KEEPERS).flat();
  for (const [id, [name, title]] of Object.entries(named)) {
    const def = all.find(k => k.id === id);
    assert.ok(def, `${name} stands in a town`);
    assert.equal(lifeI18n[def.nameKey].en, name);
    assert.equal(lifeI18n[def.titleKey].en, title, `${name}'s subtitle is the approved role title`);
  }
  assert.ok(all.every(def => def.titleKey), 'every keeper wears a name with a title or epithet under it: none is called only by its job');
  for (const def of all) {
    assert.ok(def.lines.length >= 4 && def.lines.length <= 8, `${def.id}: ${def.lines.length} lines`);
    assert.deepEqual(def.lines, keeperLinesMod.allKeeperLines(def.id));
    for (const f of ['where', 'who', 'teaches']) assert.ok(people[`codex.people.${f}.${def.id}`]?.es, `${def.id} has a People entry (${f})`);
    if (def.titleKey) assert.ok(lifeI18n[def.titleKey]?.es, `${def.titleKey} EN + ES`);
  }
  // The town feels connected: lines that name another keeper.
  const names = all.map(k => lifeI18n[k.nameKey].en.split(' ')[0]).filter(n => n !== 'The');
  const crossRefs = all.flatMap(def => def.lines.filter(key => names.some(n => n !== lifeI18n[def.nameKey].en.split(' ')[0] && lifeI18n[key].en.includes(n))));
  assert.ok(crossRefs.length >= 5, `${crossRefs.length} lines mention another keeper`);
});

test('life (S3): a keeper says the newest thing first, never a line for a beat or deed not reached', () => {
  const town = world.TOWNS.infernal;
  const tl = new townLifeMod.TownLife();
  tl.enter(town, town);
  const mara = tl.keepers.findIndex(p => p.def.id === 'bench-smith');
  const mx = tl.keepers[mara].x;
  let t = 0;
  const step = x => { t += 1 / 60; tl.update(1 / 60, x, t); };
  const approach = () => { for (let n = 0; n < 60 * 25; n++) step(mx + 2000); step(mx + 60); return tl.speaking; };
  assert.deepEqual(approach(), { keeper: 'bench-smith', line: 'play.life.line.bench-smith.1' }, 'a fresh save hears the first line');
  // A first craft: the next approach hears about it, not the next line in turn.
  tl.setContext({ beats: new Set(), deeds: new Set(['crafted']) });
  assert.deepEqual(approach(), { keeper: 'bench-smith', line: 'play.life.line.bench-smith.4' });
  assert.deepEqual(approach(), { keeper: 'bench-smith', line: 'play.life.line.bench-smith.1' }, 'then back round the pool');
  // A story beat outranks a deed; a later beat outranks an earlier one.
  tl.setContext({ beats: new Set(['p.edge', 'a1.hammer']), deeds: new Set(['crafted']) });
  assert.deepEqual(approach(), { keeper: 'bench-smith', line: 'play.life.line.bench-smith.7' });
  assert.deepEqual(approach(), { keeper: 'bench-smith', line: 'play.life.line.bench-smith.6' });
  // Nothing about the act break until it happens.
  const heard = new Set();
  for (let n = 0; n < 12; n++) heard.add(approach().line);
  assert.ok(!heard.has('play.life.line.bench-smith.8'), 'the act-break line waits for the act break');
  // Context survives leaving and re-entering the town.
  tl.enter(town.hunts[0], town); tl.enter(town, town);
  assert.deepEqual(approach(), { keeper: 'bench-smith', line: 'play.life.line.bench-smith.7' });
});

test('life: the engine stands keepers in towns only, and a click on a keeper opens its station', () => {
  const { engine } = fixture();
  assert.ok(engine.life.keepers.length >= 4, 'the Seamworks is staffed');
  const kael = engine.life.keepers.find(p => p.def.id === 'kael');
  assert.equal(engine.life.stationAt(kael.x, LIFE_FLOOR - 80).id, 'runes');
  assert.equal(engine.life.stationAt(kael.x, LIFE_FLOOR - 400), null, 'above the head is sky');
  engine.player.x = stationX(engine, 'passage');
  engine.setProgress({ equipped: true, restored: true });
  engine.interact();
  assert.equal(engine.inTown, false);
  assert.equal(engine.life.keepers.length, 0, 'hunting grounds have no keepers');
});

test('atmosphere: one capped layer per realm, frozen in place under reduced motion', () => {
  for (const realm of ['infernal', 'luminous', 'umbral', 'celestial', 'verdant']) {
    const a = recordingContext(), b = recordingContext();
    atmosphereMod.ambientLayer(a, realm, 0, 900, 1200);
    atmosphereMod.ambientLayer(b, realm, 0, 900, 1200);
    assert.deepEqual(a.calls, b.calls, `${realm}: static at time 0`);
    const shapes = a.calls.filter(([k]) => k === 'fill' || k === 'stroke' || k === 'fillRect').length;
    assert.ok(shapes > 0 && shapes <= atmosphereMod.AMBIENT_CAP * 2, `${realm}: ${shapes} draws, capped`);
    const moving = recordingContext();
    atmosphereMod.ambientLayer(moving, realm, 7.3, 900, 1200);
    assert.notDeepEqual(moving.calls, a.calls, `${realm}: alive when motion is allowed`);
  }
});

// ── Sprite-sheet renderer (engine/sprite.ts) ────────────────────────────────
// A programmatic test sheet: the same shape the importer writes into
// sprite-manifest.generated.ts (1x units). No PNG ships; images are faked by
// their dimensions, which is all the renderer reads.
const sprite = loadTs(path.resolve(__dirname, '../src/app/play/engine/sprite.ts'));
const spriteManifest = loadTs(path.resolve(__dirname, '../src/app/shared/art/sprite-manifest.generated.ts'));
function testSheet(extra = {}) {
  return {
    src: 'assets/game/sprites/characters/01-keeper@1x.webp', src2x: 'assets/game/sprites/characters/01-keeper@2x.webp',
    frameW: 48, frameH: 48, pivotX: 24, pivotY: 46,
    actions: {
      idle: { row: 0, frames: 4, fps: 8, loop: true },
      run: { row: 1, frames: 6, fps: 12, loop: true },
      attack: {
        row: 2, frames: 6, fps: 14, loop: false,
        anchors: {
          hand_front: [[30, 20, 150], [31, 21, 120], [32, 22, 90], [34, 22, 60], [33, 23, 70], [32, 24, 100]],
          hand_back: [[18, 22], [18, 22], [18, 23], [18, 23], [18, 22], [18, 22]],
        },
      },
    },
    ...extra,
  };
}
function sheetImage(scale) { return { complete: true, naturalWidth: 6 * 48 * scale, naturalHeight: 3 * 48 * scale }; }
function recorder(log) {
  const noop = () => {};
  const target = {
    imageSmoothingEnabled: true, globalAlpha: 1,
    drawImage: (...args) => log.push(['drawImage', ...args]),
    save: () => log.push(['save']), restore: () => log.push(['restore']),
    scale: (x, y) => log.push(['scale', x, y]),
    measureText: () => ({ width: 10 }),
  };
  return new Proxy(target, { get: (t, key) => key in t ? t[key] : noop, set: (t, key, value) => { t[key] = value; log.push(['set', key, value]); return true; } });
}

test('sprite: frame timing loops, holds one-shots, and stills stay on frame 0', () => {
  const sheet = testSheet();
  const { idle, attack } = sheet.actions;
  assert.equal(sprite.frameAt(idle, 0), 0);
  assert.equal(sprite.frameAt(idle, .124), 0);
  assert.equal(sprite.frameAt(idle, .125), 1, '8 fps: frame 1 at 1/8 s');
  assert.equal(sprite.frameAt(idle, .5), 0, 'four frames at 8 fps wrap after half a second');
  assert.equal(sprite.frameAt(idle, .625), 1);
  assert.equal(sprite.frameAt(attack, 10), 5, 'a one-shot holds its last frame');
  assert.equal(sprite.frameAt({ row: 0, frames: 4, fps: 0, loop: true }, 3), 0, 'fps 0 is a still');
  assert.equal(sprite.frameAt({ row: 0, frames: 1, fps: 8, loop: true }, 3), 0);
  assert.equal(sprite.frameAt(idle, -1), 0);
  // The attack is timed to the GAME's window, not the sheet's fps.
  assert.deepEqual([0, .16, .17, .5, .99, 1, 2].map(p => sprite.frameAtProgress(attack, p)), [0, 0, 1, 3, 5, 5, 5]);
  assert.ok(Math.abs(sprite.actionDuration(attack) - 6 / 14) < 1e-12);
  assert.equal(sprite.actionDuration({ row: 0, frames: 1, fps: 0, loop: false }), 0);
  // A figure's clock restarts only when its action changes.
  const clock = sprite.createSpriteClock();
  assert.equal(sprite.tickClock(clock, 'run', 5), 0);
  assert.equal(sprite.tickClock(clock, 'run', 5.5), .5);
  assert.equal(sprite.tickClock(clock, 'attack', 6), 0);
});

test('sprite: missing actions fall back to the nearest one the sheet has, then idle', () => {
  const sheet = testSheet();
  const K = sprite.KEEPER_SPRITE_FALLBACKS, C = sprite.CREATURE_SPRITE_FALLBACKS;
  assert.equal(sprite.resolveAction(sheet, 'run', K.run), 'run');
  assert.equal(sprite.resolveAction(sheet, 'jump', K.jump), 'idle', 'the first test sheet has no jump/fall');
  assert.equal(sprite.resolveAction(sheet, 'dodge', K.dodge), 'run', 'a dodge without frames reads as a dash');
  assert.equal(sprite.resolveAction(sheet, 'death', K.death), 'idle');
  assert.equal(sprite.resolveAction(sheet, undefined), 'idle');
  const maw = { ...sheet, actions: { windup: { row: 1, frames: 4, fps: 10, loop: false }, attack: { row: 0, frames: 4, fps: 14, loop: false } } };
  assert.equal(sprite.resolveAction(maw, 'strike', C.strike), 'attack');
  assert.equal(sprite.resolveAction(maw, 'recover', C.recover), 'attack', 'no idle: the top row');
  assert.equal(sprite.resolveAction({ ...sheet, actions: {} }, 'idle'), null);
});

test('sprite: anchors are pivot-relative, mirror with the sprite, and carry the authored angle', () => {
  const sheet = testSheet();
  const out = sprite.createSpriteAnchor();
  assert.equal(sprite.anchorAt(sheet, 'attack', 'hand_front', 3, false, out), true);
  assert.deepEqual([out.x, out.y, out.angled], [10, -24, true]);
  assert.ok(Math.abs(out.rotation - Math.PI / 3) < 1e-12, '60 deg clockwise from up');
  sprite.anchorAt(sheet, 'attack', 'hand_front', 3, true, out);
  assert.equal(out.x, -10, 'mirrored around the pivot');
  assert.ok(Math.abs(out.rotation + Math.PI / 3) < 1e-12, 'a mirror reflects the angle');
  sprite.anchorAt(sheet, 'attack', 'hand_back', 0, false, out);
  assert.deepEqual([out.x, out.y, out.angled, out.rotation], [-6, -24, false, 0]);
  assert.equal(sprite.anchorAt(sheet, 'idle', 'hand_front', 0, false, out), false, 'no anchors on idle');
  assert.equal(sprite.anchorAt(sheet, 'attack', 'hand_front', 6, false, out), false, 'out of range');
  const r = new sprite.SpriteRenderer(sheet);
  r.anchor('attack', 'hand_front', 3, false, out, .5);
  assert.deepEqual([out.x, out.y], [5, -12], 'scaled with the figure');
  // An upright item rotated by the anchor angle (60 deg) points up-right.
  const aim = loadout.aimFromBladeRotation(Math.PI / 3);
  assert.ok(Math.cos(aim) > 0 && Math.sin(aim) < 0);
});

test('sprite: draws the right cell of a 1x or 2x sheet with the pivot on the origin, mirrored and crisp on request', () => {
  const sheet = testSheet();
  assert.equal(sprite.sheetRows(sheet), 3);
  assert.equal(sprite.imageScaleOf(sheet, 144), 1);
  assert.equal(sprite.imageScaleOf(sheet, 288), 2);
  const rect = sprite.frameRect(sheet, sheet.actions.attack, 4, 2, { sx: 0, sy: 0, sw: 0, sh: 0 });
  assert.deepEqual(rect, { sx: 384, sy: 192, sw: 96, sh: 96 });
  assert.equal(sprite.frameRect(sheet, sheet.actions.idle, 99, 1, rect).sx, 3 * 48, 'clamped to the row');

  const r = new sprite.SpriteRenderer(sheet);
  const log = [];
  const c = recorder(log);
  const image = sheetImage(2);
  assert.equal(r.draw(c, image, 'run', 2), true);
  assert.deepEqual(log.at(-1), ['drawImage', image, 192, 96, 96, 96, -24, -46, 48, 48], 'source in 2x px, destination in 1x world px from the pivot');
  log.length = 0;
  r.draw(c, image, 'idle', 1, { mirror: true, scale: .5, offsetX: 4 });
  assert.deepEqual(log[0], ['save']);
  assert.deepEqual(log[1], ['scale', -1, 1]);
  assert.deepEqual(log[2], ['drawImage', image, 96, 0, 96, 96, -12 - 4, -23, 24, 24], 'the offset stays in world space when mirrored');
  assert.equal(log.some(e => e[0] === 'set' && e[1] === 'imageSmoothingEnabled'), false, 'smooth sheets leave smoothing alone');
  assert.equal(r.draw(c, { complete: false, naturalWidth: 0 }, 'idle', 0), false, 'not loaded: the caller keeps its fallback');
  assert.equal(r.draw(c, image, 'swim', 0), false);

  const pixel = new sprite.SpriteRenderer(testSheet({ pixelArt: true }));
  log.length = 0;
  pixel.draw(c, sheetImage(1), 'idle', 0, { offsetX: .4 });
  const sets = log.filter(e => e[0] === 'set' && e[1] === 'imageSmoothingEnabled').map(e => e[2]);
  assert.deepEqual(sets, [false, true], 'pixel-art sheets draw unsmoothed and restore the flag');
  assert.deepEqual(log.find(e => e[0] === 'drawImage').slice(6, 8), [-24, -46], 'snapped to whole pixels');
});

test('sprite: the hit flash is one cached white copy per frame, never rebuilt', () => {
  const made = [];
  const previous = globalThis.document;
  globalThis.document = {
    createElement: () => {
      const ops = [];
      const canvas = { width: 0, height: 0, ops, getContext: () => recorder(ops) };
      made.push(canvas);
      return canvas;
    },
  };
  try {
    const r = new sprite.SpriteRenderer(testSheet());
    const image = sheetImage(2);
    const log = [];
    const c = recorder(log);
    for (let n = 0; n < 5; n++) r.draw(c, image, 'attack', 2, { flash: true });
    assert.equal(made.length, 1, 'built once');
    assert.deepEqual([made[0].width, made[0].height], [96, 96]);
    assert.ok(made[0].ops.some(e => e[0] === 'set' && e[1] === 'globalCompositeOperation' && e[2] === 'source-atop'), 'tinted inside the silhouette');
    const draws = log.filter(e => e[0] === 'drawImage');
    assert.equal(draws.length, 5);
    for (const d of draws) assert.deepEqual(d.slice(1), [made[0], 0, 0, 96, 96, -24, -46, 48, 48]);
    r.draw(c, image, 'attack', 3, { flash: true });
    assert.equal(made.length, 2, 'a different frame gets its own copy');
    r.draw(c, image, 'attack', 2, { flash: false });
    assert.equal(log.at(-1)[1], image, 'no flash: the sheet itself');
  } finally {
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
  // No DOM (SSR, tests): the flash falls back to the plain frame instead of failing.
  const r = new sprite.SpriteRenderer(testSheet());
  const log = [];
  assert.equal(r.draw(recorder(log), sheetImage(1), 'idle', 0, { flash: true }), true);
  assert.equal(log.at(-1)[1].naturalHeight, 144);
});

test('sprite: figure keys map to their sheet ids; the manifest ships empty so nothing changes yet', () => {
  assert.equal(sprite.figureSpriteId('npc-kael-figure'), 'npc-kael');
  assert.equal(sprite.figureSpriteId('townsfolk-infernal-figure'), 'townsfolk-infernal');
  assert.equal(sprite.figureSpriteId('rivet-maw'), 'rivet-maw');
  assert.equal(spriteManifest.spriteFor('keeper'), null, 'no sheet imported: the rig stays');
});

test('canvas cues sit above their station or node, never on the floor band under the action bar', () => {
  const { engine } = fixture();
  const noop = () => {};
  const texts = [];
  engine.context = new Proxy({ globalAlpha: 1, measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    fillText: (text, x, y) => texts.push([text, y]) }, { get: (target, key) => key in target ? target[key] : noop, set: (target, key, value) => { target[key] = value; return true; } });
  const FLOOR = 610;
  // A hovered stall the Keeper is not standing at.
  const far = engine.places.find(station => Math.abs(station.x - engine.player.x) > 400);
  engine.setHover(far.id);
  engine.render();
  const hover = texts.find(([text]) => text === 'CLICK TO WALK HERE');
  assert.ok(hover, 'the hover cue is drawn');
  assert.ok(hover[1] <= FLOOR - 240, `hover cue at ${hover[1]}, above the stall hit box`);
  engine.setHover(null);
  // A gathering node in Ember Quarry, Keeper beside it.
  engine.setProgress({ equipped: true, restored: true });
  engine.player.x = stationX(engine, 'passage'); engine.player.y = FLOOR; engine.interact();
  assert.equal(engine.areaDef.id === 'ember-quarry' || engine.areaDef.name === 'Ember Quarry', true);
  // The world clock's nodes keep an hour (an eclipse-only one is not drawn by day); the cue rule is the same for them.
  for (const node of engine.areaDef.nodes.filter(n => n.when !== 'eclipse')) {
    engine.player.x = node.x; texts.length = 0;
    engine.render();
    const cue = texts.find(([text]) => /GATHER|^NEEDS |^GROWING BACK|^OPENS AT NIGHT/.test(text));
    assert.ok(cue, `${node.id}: a cue is drawn`);
    assert.ok(cue[1] < FLOOR - 100, `${node.id}: cue at ${cue[1]} sits above the node`);
    assert.ok(!texts.some(([, y]) => y > FLOOR + 40), `${node.id}: nothing drawn below the label line`);
  }
  engine.destroy();
});

function spriteEngine(sheets) {
  const { engine } = fixture(() => true, { sprite: id => sheets[id] ?? null });
  const noop = () => {};
  const drawn = [];
  const scaled = [];
  engine.context = new Proxy({
    globalAlpha: 1, measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    drawImage: (...args) => drawn.push(args), scale: (x) => scaled.push(['s', x]), translate: (x) => scaled.push(['t', x]),
  }, { get: (target, key) => key in target ? target[key] : noop, set: (target, key, value) => { target[key] = value; return true; } });
  return { engine, drawn, scaled };
}

test('sprite: with a sheet the Keeper plays its attack across the attack window and the weapon rides hand_front', () => {
  const sheet = testSheet();
  const { engine, drawn } = spriteEngine({ keeper: sheet });
  const image = sheetImage(1), sword = { complete: true, naturalWidth: 96, naturalHeight: 96 };
  engine.urlImages.set(sheet.src, image);
  engine.urlImages.set('assets/sword.webp', sword);
  let rigUsed = false;
  engine.keeperRig.render = () => { rigUsed = true; return true; };
  engine.setLoadout({ weapon: { art: 'assets/sword.webp' } });
  engine.hurtTime = 0; engine.attackTime = .1; // three quarters through the 0.4 s swing, past the strike glow
  const before = JSON.stringify({ p: engine.player, hp: engine.hp });
  engine.render();
  assert.equal(rigUsed, false, 'the sheet replaces the rig');
  const frames = drawn.filter(d => d[0] === image);
  assert.equal(frames.length, 1, 'one draw, no smear or rim at rest');
  assert.deepEqual(frames[0].slice(1), [4 * 48, 2 * 48, 48, 48, -24, -46, 48, 48], 'attack row, frame 4 of 6 at three quarters of the window');
  assert.ok(drawn.findIndex(d => d[0] === image) < drawn.findIndex(d => d[0] === sword), 'the weapon is drawn over the body');
  assert.deepEqual([engine.held.x, engine.held.y], [9, -23], 'the grip sits on hand_front of frame 4');
  assert.ok(Math.abs(engine.held.rotation - (loadout.aimFromBladeRotation(70 * Math.PI / 180) - loadout.WEAPON_DEFAULTS.tilt)) < 1e-9, 'aimed by the authored angle');
  // Mid-swing the strike glow adds one additive rim copy of the same frame.
  engine.attackTime = .2;
  drawn.length = 0; engine.render();
  assert.deepEqual(drawn.filter(d => d[0] === image).map(d => d[1]), [3 * 48, 3 * 48], 'frame 3 at half the window, plus its rim copy');
  engine.attackTime = .02;
  drawn.length = 0; engine.render();
  assert.deepEqual(drawn.find(d => d[0] === image).slice(1, 3), [5 * 48, 2 * 48], 'the last frame as the window closes');
  assert.equal(JSON.stringify({ p: engine.player, hp: engine.hp }), before, 'drawing never moves combat state');
  engine.destroy();
});

test('sprite: a creature sheet times windup and strike to the game, and mirrors to face', () => {
  const maw = {
    ...testSheet(), src: 'maw@1x.webp', src2x: 'maw@2x.webp', pivotX: 24, pivotY: 40,
    actions: { idle: { row: 0, frames: 6, fps: 8, loop: true }, windup: { row: 1, frames: 4, fps: 10, loop: false }, strike: { row: 2, frames: 4, fps: 14, loop: false } },
  };
  const sheets = {};
  const { engine, drawn, scaled } = spriteEngine(sheets);
  if (!engine.monsters.length) engine.enter(engine.town.hunts.find(h => h.monsters.length));
  const monster = engine.monsters[0];
  assert.ok(monster, 'the area has a monster');
  engine.monsters = [monster]; // one figure, so every scale() below is this one's
  sheets[monster.def.creature] = maw;
  const image = sheetImage(1);
  engine.urlImages.set(maw.src, image);
  engine.player.x = monster.x + 60;
  monster.phase = 'windup'; monster.timer = .85 / 2; monster.facing = 1;
  engine.render();
  const frame = drawn.find(d => d[0] === image);
  assert.ok(frame, 'the creature is drawn from its sheet');
  assert.deepEqual(frame.slice(1, 3), [2 * 48, 48], 'windup row, frame 2 of 4 at half the windup');
  monster.phase = 'strike'; monster.timer = .2 * .25;
  drawn.length = 0; engine.render();
  assert.deepEqual(drawn.find(d => d[0] === image).slice(1, 3), [3 * 48, 96], 'strike row, frame 3 of 4');
  // Facing: a sheet faces right, so a creature looking left is mirrored (a negative x scale).
  monster.phase = 'idle'; engine.player.x = monster.x - 60;
  // The scale right after the translate to the creature's feet is its own.
  const mirrored = () => { scaled.length = 0; engine.render(); const at = scaled.findIndex(e => e[0] === 't' && e[1] === monster.x); return scaled.slice(at).find(e => e[0] === 's')[1] < 0; };
  assert.equal(mirrored(), true, 'looking left mirrors the sheet');
  engine.player.x = monster.x + 60;
  assert.equal(mirrored(), false, 'looking right does not');
  engine.destroy();
});

test('sprite: no sheet means the rig and placeholders draw exactly as before', () => {
  const { engine } = spriteEngine({});
  let rigUsed = 0;
  engine.keeperRig.render = () => { rigUsed++; return true; };
  engine.keeperRig.blit = () => {};
  engine.render();
  assert.equal(rigUsed, 1, 'the Keeper still goes through the mesh rig');
  assert.equal(engine.sprites.get('keeper'), null, 'looked up once, cached as absent');
  // A sheet listed but not loaded yet also keeps the rig.
  const late = spriteEngine({ keeper: testSheet() });
  late.engine.keeperRig.render = () => { rigUsed++; return true; };
  late.engine.keeperRig.blit = () => {};
  late.engine.render();
  assert.equal(rigUsed, 2, 'still loading: the rig draws');
  engine.destroy(); late.engine.destroy();
});

test('sprite: town keepers and townsfolk use their sheets (idle/talk/walk) and fall back to the placeholder without one', () => {
  const { TownLife } = loadTs(path.resolve(__dirname, '../src/app/play/engine/town-life.ts'));
  const { INFERNAL_TOWN } = loadTs(path.resolve(__dirname, '../src/app/play/world/towns/infernal.ts'));
  const life = new TownLife();
  life.enter(INFERNAL_TOWN, INFERNAL_TOWN);
  const npc = {
    ...testSheet(), src: 'npc.webp', src2x: 'npc.webp',
    actions: { idle: { row: 0, frames: 6, fps: 8, loop: true }, talk: { row: 1, frames: 4, fps: 8, loop: true }, walk: { row: 2, frames: 6, fps: 10, loop: true } },
  };
  const renderer = new sprite.SpriteRenderer(npc);
  const image = sheetImage(1);
  const asked = [];
  const frame = {
    camera: 0, viewport: 99999, time: 0, reduced: false, playerX: -9999, pixelScale: 1,
    image: () => undefined, translate: key => key,
    sprite: id => { asked.push(id); return id === 'npc-kael' ? renderer : null; }, spriteImage: () => image,
  };
  const log = [];
  life.draw(recorder(log), frame);
  assert.ok(asked.includes('npc-kael') && asked.includes('townsfolk-infernal'), 'figure keys are looked up as sheet ids');
  const kael = life.keepers.findIndex(p => p.def.id === 'kael');
  assert.ok(kael >= 0);
  assert.equal(log.filter(e => e[0] === 'drawImage' && e[1] === image).length, 1, 'only Kael has a sheet; everyone else is the placeholder');
  assert.equal(log.find(e => e[0] === 'drawImage')[3], 0, 'idle row');
  // Talking: the chatter's speaker plays `talk`.
  life.chatter.speaker = kael; log.length = 0;
  life.draw(recorder(log), frame);
  assert.equal(log.find(e => e[0] === 'drawImage' && e[1] === image)[3], 48, 'talk row');
});

test('enemy bar: every creature has a play.creature.<id> name tag in EN + ES, and its English matches the data', () => {
  const { LIFE_I18N } = loadTs(path.resolve(__dirname, '../src/app/play/world/life.i18n.ts'));
  for (const town of Object.values(world.TOWNS).filter(Boolean)) {
    for (const area of [town, ...town.hunts]) {
      for (const monster of area.monsters) {
        const tag = LIFE_I18N[`play.creature.${monster.creature}`];
        assert.ok(tag, `${town.id}/${area.id}: ${monster.creature} has a name tag`);
        assert.equal(tag.en, monster.name, `${monster.creature}: EN matches the MonsterDef name`);
        assert.ok(tag.es && tag.es.trim(), `${monster.creature}: has Spanish`);
      }
    }
  }
  assert.ok(LIFE_I18N['play.creature.unknown'].es);
});

// ── Render budget and the hot draw path (docs/handoff/play-perf.md) ─────────
const budgetMod = loadTs(path.resolve(__dirname, '../src/app/play/engine/render-budget.ts'));

/** A context that counts gradient creations and records every nonzero shadowBlur written. */
function budgetContext() {
  const noop = () => {};
  const seen = { gradients: 0, blurs: [] };
  const target = {
    globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', shadowBlur: 0,
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => { seen.gradients++; return { addColorStop: noop }; },
    createRadialGradient: () => { seen.gradients++; return { addColorStop: noop }; },
  };
  const ctx = new Proxy(target, {
    get: (t, key) => key in t ? t[key] : noop,
    set: (t, key, value) => { if (key === 'shadowBlur' && value > 0) seen.blurs.push(value); t[key] = value; return true; },
  });
  return { ctx, seen };
}

test('render budget: a touch-first device gets the lite tier, a desktop the full one, and the option wins', () => {
  assert.deepEqual(budgetMod.renderBudget({ coarse: false }), budgetMod.FULL_BUDGET);
  assert.deepEqual(budgetMod.renderBudget({ coarse: true }), budgetMod.LITE_BUDGET);
  assert.equal(budgetMod.renderBudget({ coarse: true }, false).tier, 'full');
  assert.equal(budgetMod.renderBudget({ coarse: false }, true).tier, 'lite');
  assert.equal(budgetMod.FULL_BUDGET.maxPixelRatio, 2, 'desktop keeps its 2× backing store');
  assert.ok(budgetMod.FULL_BUDGET.glows, 'desktop keeps its glows');
  assert.equal(budgetMod.coarseDevice(undefined), false);
  assert.equal(budgetMod.coarseDevice({ matchMedia: q => ({ matches: q.includes('coarse') }) }), true);
  assert.equal(budgetMod.coarseDevice({ matchMedia: () => { throw new Error('no'); } }), false);
});

test('render budget: on a DPR-3 phone the canvas backing store is 1.5×, on desktop still 2×', () => {
  const was = browserWindow.devicePixelRatio;
  browserWindow.devicePixelRatio = 3;
  try {
    const sized = lite => {
      const canvas = {
        getContext: () => ({ setTransform() {} }),
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 596 }),
        parentElement: { clientWidth: 390, clientHeight: 596, getBoundingClientRect: () => ({ width: 390, height: 596 }) },
      };
      const engine = new Engine(canvas, { assets: {}, onInteract() {}, onState() {}, lite });
      const size = [canvas.width, canvas.height];
      engine.destroy();
      return size;
    };
    assert.deepEqual(sized(true), [585, 894]);
    assert.deepEqual(sized(false), [780, 1192]);
  } finally { browserWindow.devicePixelRatio = was; }
});

test('render budget: the lite tier draws no shadowBlur glow anywhere in a town or a hunt; desktop still does', () => {
  for (const lite of [true, false]) {
    const { engine } = fixture(() => true, { lite });
    const { ctx, seen } = budgetContext();
    engine.context = ctx;
    engine.frameDt = 1 / 60;
    for (const town of builtTowns()) {
      engine.setTown(town);
      for (let n = 0; n < 4; n++) { engine.update(1 / 60); engine.render(); }
      engine.goToStation('passage', true);
      for (let n = 0; n < 4; n++) { engine.update(1 / 60); engine.render(); }
    }
    if (lite) assert.deepEqual(seen.blurs, [], 'no glow on a phone');
    else assert.ok(seen.blurs.length > 0, 'the desktop look keeps its glows');
    engine.destroy();
  }
});

test('render budget: in the Delve a phone tints with plain alpha; desktop keeps the soft-light wash', () => {
  for (const lite of [true, false]) {
    const { engine } = fixture(() => true, { lite });
    const ops = [];
    const { ctx } = budgetContext();
    engine.context = new Proxy(ctx, { get: (t, k) => t[k], set: (t, k, v) => { if (k === 'globalCompositeOperation') ops.push(v); t[k] = v; return true; } });
    engine.player.x = stationX(engine, 'delve'); engine.player.y = 610; engine.interact();
    engine.frameDt = 1 / 60;
    for (let n = 0; n < 5; n++) { engine.update(1 / 60); engine.render(); }
    assert.equal(ops.includes('soft-light'), !lite, lite ? 'no soft-light read-back on a phone' : 'desktop look unchanged');
    engine.destroy();
  }
});

test('render budget: in the Delve the light grid is upscaled filtered; a phone folds its tint in and lays it through the half-res overlay unsmoothed', () => {
  const made = [];
  browserDocument.createElement = () => {
    const canvas = { width: 0, height: 0, ops: [], image: null };
    const ctx = {
      globalCompositeOperation: 'source-over', globalAlpha: 1, imageSmoothingEnabled: true,
      createImageData: (w, h) => (canvas.image = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      drawImage: (src) => canvas.ops.push(['drawImage', src, ctx.imageSmoothingEnabled]),
      putImageData: () => canvas.ops.push(['putImageData']),
    };
    canvas.getContext = () => new Proxy(ctx, {
      get: (t, k) => k in t ? t[k] : (...args) => { canvas.ops.push([k]); return { addColorStop() {} }; },
      set: (t, k, v) => { t[k] = v; return true; },
    });
    made.push(canvas);
    return canvas;
  };
  try {
    for (const lite of [true, false]) {
      made.length = 0;
      const { engine } = fixture(() => true, { lite });
      const { ctx } = budgetContext();
      const blits = [];
      engine.context = new Proxy(ctx, {
        get: (t, k) => k === 'drawImage' ? (src, ...rest) => { if (made.includes(src)) blits.push([src, t.imageSmoothingEnabled !== false]); }
          : t[k] ?? (() => {}),
        set: (t, k, v) => { t[k] = v; return true; },
      });
      engine.player.x = stationX(engine, 'delve'); engine.player.y = 610; engine.interact();
      // Deep enough to stand in a biome with a wash (Magma Halls), like the perf scene.
      const t = engine.terrain; engine.cameraY = t.top + 41 * 32 - 300;
      for (let n = 0; n < 3; n++) { engine.frameDt = 1 / 60; engine.render(); }
      const grid = made.find(c => c.ops.some(op => op[0] === 'putImageData'));
      assert.ok(grid, 'the light grid is written as pixels');
      assert.ok(!grid.ops.some(op => op[0] === 'createRadialGradient'), 'the grid needs no gradient');
      const overlay = made.find(c => c !== grid && c.ops.some(op => op[0] === 'drawImage' && op[1] === grid));
      const laid = blits.filter(([src]) => src === (lite ? overlay : grid)).map(([, smooth]) => smooth);
      assert.ok(laid.length > 0, 'the darkness is laid over the frame');
      if (lite) {
        assert.ok(overlay, 'a phone filters the grid into its half-res overlay');
        assert.ok(overlay.ops.filter(op => op[0] === 'drawImage').every(op => op[2] === true), '…smoothed');
        assert.ok(laid.every(smooth => smooth === false), 'and upscales the overlay unsmoothed');
      } else {
        assert.equal(overlay, undefined, 'desktop needs no overlay');
        assert.ok(laid.every(smooth => smooth === true), 'desktop upscales the grid smoothed');
      }
      assert.ok(ctx.imageSmoothingEnabled !== false, 'smoothing is restored for everything drawn after');
      // The biome's dark is laid as is on desktop; a phone folds the biome's (redder) wash under it.
      const darkRed = Number(t.biomeAt(t.rowAt(engine.cameraY + 360)).dark.split(',')[0]);
      const data = grid.image.data;
      let reddest = 0;
      for (let p = 0; p < data.length; p += 4) reddest = Math.max(reddest, data[p]);
      if (lite) assert.ok(reddest > darkRed, 'the phone tint rides inside the grid');
      else {
        // Unlit samples (the most opaque) are the plain dark: the wash is a soft-light pass of its own.
        let darkest = 0, at = 0;
        for (let p = 0; p < data.length; p += 4) if (data[p + 3] > darkest) { darkest = data[p + 3]; at = p; }
        assert.equal(data[at], darkRed, 'desktop lays the plain dark where nothing is lit');
      }
      // Lit ground takes on the lantern's warmth: some sample is warmer than the dark.
      assert.ok(reddest > darkRed + 20, 'the lantern warms what it lights');
      engine.destroy();
    }
  } finally { delete browserDocument.createElement; }
});

test('render budget: a phone bakes the town backdrop once and blits it; desktop draws it live as before', () => {
  const painting = { complete: true, naturalWidth: 1536, naturalHeight: 864 };
  const baked = [];
  browserDocument.createElement = () => {
    const canvas = { width: 0, height: 0, ops: [], images: [] };
    canvas.getContext = () => new Proxy({}, { get: (_, k) => (...args) => { canvas.ops.push(k); if (k === 'drawImage') canvas.images.push(args[0]); return { addColorStop() {} }; }, set: () => true });
    baked.push(canvas);
    return canvas;
  };
  try {
    for (const lite of [true, false]) {
      baked.length = 0;
      const { engine } = fixture(() => true, { lite });
      engine.lazyImages.set(engine.sceneKey, painting);
      const drawn = [];
      const { ctx } = budgetContext();
      engine.context = new Proxy(ctx, {
        get: (t, k) => k === 'drawImage' ? (...args) => drawn.push(args[0]) : t[k],
        set: (t, k, v) => { t[k] = v; return true; },
      });
      engine.frameDt = 1 / 60;
      for (let n = 0; n < 30; n++) { engine.setInput('right', n < 20); engine.update(1 / 60); engine.render(); }
      // The backdrop cache is the canvas the painting is drawn into (the pixel props and figures bake their own small sprites).
      const caches = baked.filter(c => c.images.includes(painting));
      if (lite) {
        assert.equal(caches.length, 1, 'one backdrop canvas, built once, walking or not');
        assert.deepEqual(caches[0].ops.filter(op => op === 'drawImage').length, 1, 'the painting was drawn into it once');
        assert.equal(drawn.filter(d => d === painting).length, 0, 'the painting is never scaled onto the screen');
        assert.equal(drawn.filter(d => d === caches[0]).length, 30, 'one blit per frame');
      } else {
        assert.equal(caches.length, 0, 'desktop bakes nothing');
        assert.equal(drawn.filter(d => d === painting).length, 30, 'desktop draws the painting live every frame, as before');
      }
      engine.destroy();
    }
  } finally { delete browserDocument.createElement; }
});

// ── Deep Delve on a phone (docs/handoff/delve-perf.md) ──────────────────────
test('delve perf: a phone lays the heat columns and halos inside the darkness overlay; desktop keeps them additive on the frame', () => {
  const made = [];
  browserDocument.createElement = () => {
    const canvas = { width: 0, height: 0, ops: [] };
    const ctx = {
      globalCompositeOperation: 'source-over', globalAlpha: 1, imageSmoothingEnabled: true, fillStyle: '#000',
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
      fillRect: () => canvas.ops.push(['fillRect', typeof ctx.fillStyle]),
      drawImage: (src) => canvas.ops.push(['drawImage', src]),
      putImageData: () => canvas.ops.push(['putImageData']),
    };
    canvas.getContext = () => new Proxy(ctx, { get: (t, k) => k in t ? t[k] : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
    made.push(canvas);
    return canvas;
  };
  try {
    for (const lite of [true, false]) {
      made.length = 0;
      const { engine } = fixture(() => true, { lite });
      const { ctx } = budgetContext();
      const onFrame = { bands: 0, ops: [] };
      engine.context = new Proxy(ctx, {
        get: (t, k) => k === 'fillRect' ? () => { if (typeof t.fillStyle !== 'string') onFrame.bands++; } : t[k],
        set: (t, k, v) => { t[k] = v; return true; },
      });
      engine.player.x = stationX(engine, 'delve'); engine.player.y = 610; engine.interact();
      // Stand the view in the biome with heat shimmer (the Magma Halls), as in the perf scene.
      const t = engine.terrain, row = [...Array(t.rows).keys()].find(r => t.biomeAt(r).shimmer);
      assert.ok(row !== undefined, 'a delve biome shimmers');
      const frames = 3;
      engine.reducedMotion = true;
      for (let n = 0; n < frames; n++) { engine.player.y = t.top + row * 32 + 220; engine.cameraY = engine.player.y - 720 * .58; engine.frameDt = 1 / 60; engine.render(); }
      assert.ok(t.biomeAt(t.rowAt(engine.cameraY + 360)).shimmer, 'the view is in the shimmering biome');
      const grid = made.find(c => c.ops.some(op => op[0] === 'putImageData'));
      const overlay = made.find(c => c !== grid && c.ops.some(op => op[0] === 'drawImage' && op[1] === grid));
      const overlayGradients = overlay ? overlay.ops.filter(op => op[0] === 'fillRect' && op[1] !== 'string').length : 0;
      if (lite) {
        assert.equal(onFrame.bands, 0, 'no gradient fill reaches the phone frame');
        assert.ok(overlayGradients >= 4 * frames, 'the four heat columns are drawn into the overlay every frame');
      } else {
        assert.ok(onFrame.bands >= 4 * frames, 'desktop draws the heat columns on the frame, as before');
        assert.equal(overlay, undefined, 'and needs no overlay');
      }
      engine.destroy();
    }
  } finally { delete browserDocument.createElement; }
});

test('delve perf: a creature on a floor above or below the view is neither drawn nor posed', () => {
  const { engine } = fixture();
  engine.player.x = stationX(engine, 'delve'); engine.player.y = 610; engine.interact();
  const { ctx } = budgetContext();
  engine.context = ctx;
  const t = engine.terrain;
  engine.cameraY = t.top + 20 * 32;
  const base = engine.monsters[0] ?? { def: { creature: 'rivet-maw', hp: 10 }, hp: 10, maxHp: 10, phase: 'idle', timer: 1, facing: -1, flash: 0, knock: 0, dying: 0, born: 0, shownHp: 10, recoil: 0, spawn: 0 };
  let drawn = 0;
  engine.creature = () => { drawn++; };
  engine.drawDeepCreature = () => { drawn++; };
  const at = floorY => ({ ...base, x: engine.player.x, hp: 10, maxHp: 10, dying: 0, born: 0, def: { ...base.def, floorY } });
  for (const [floorY, shown] of [[engine.cameraY + 400, true], [engine.cameraY - 400, false], [engine.cameraY + 720 + 800, false], [engine.cameraY + 720 + 300, true]]) {
    drawn = 0;
    engine.monsters = [at(floorY)];
    // render() recomputes the camera from the Keeper: stand the Keeper where the view should be.
    engine.player.y = engine.cameraY + 720 * .58;
    engine.frameDt = 1 / 60; engine.render();
    assert.equal(drawn > 0, shown, `floor at ${Math.round(floorY - engine.cameraY)} px from the view's top`);
  }
  engine.destroy();
});

test('delve perf: a phone bakes the Delve sky (painting and shade) once and copies it; desktop draws it live as before', () => {
  const painting = { complete: true, naturalWidth: 1536, naturalHeight: 1024 };
  const baked = [];
  browserDocument.createElement = () => {
    const canvas = { width: 0, height: 0, ops: [] };
    canvas.getContext = () => new Proxy({}, { get: (_, k) => (...args) => { canvas.ops.push(k); return { addColorStop() {} }; }, set: () => true });
    baked.push(canvas);
    return canvas;
  };
  try {
    for (const lite of [true, false]) {
      baked.length = 0;
      const { engine } = fixture(() => true, { lite });
      engine.player.x = stationX(engine, 'delve'); engine.player.y = 610; engine.interact();
      assert.ok(engine.terrain, 'in the Delve');
      engine.lazyImages.set(engine.sceneKey, painting);
      const drawn = [];
      let shades = 0;
      const { ctx } = budgetContext();
      engine.context = new Proxy(ctx, {
        get: (t, k) => k === 'drawImage' ? (...args) => drawn.push(args[0]) : k === 'fillRect' ? () => { if (typeof t.fillStyle !== 'string') shades++; } : t[k],
        set: (t, k, v) => { t[k] = v; return true; },
      });
      const frames = 20;
      let built = null;
      for (let n = 0; n < frames; n++) {
        engine.cameraY = 0; engine.setInput('right', true); engine.update(1 / 60); engine.frameDt = 1 / 60; engine.render();
        if (n === 0) built = new Map(baked.map(c => [c, c.ops.length]));
      }
      // The sky canvases: baked ones laid on the frame every frame.
      const sky = baked.filter(c => drawn.filter(d => d === c).length >= frames);
      if (lite) {
        assert.equal(drawn.filter(d => d === painting).length, 0, 'the painting is never scaled onto the frame');
        assert.equal(shades, 0, 'the shade is never shaded per pixel on the frame');
        assert.ok(sky.length >= 2, 'painting and shade are copied every frame');
        assert.ok(sky.some(c => c.ops.includes('drawImage')), 'the painting is pre-scaled into one');
        for (const c of sky) assert.equal(c.ops.length, built.get(c), 'built on the first frame, never repainted while walking');
      } else {
        assert.equal(engine.delveSky, null, 'desktop bakes no sky');
        assert.ok(drawn.filter(d => d === painting).length >= frames, 'desktop draws the painting live every frame, as before');
        assert.ok(shades >= frames, 'and shades it live');
      }
      engine.destroy();
    }
  } finally { delete browserDocument.createElement; }
});

test('hot draw path: after the first frames, a town, a hunt and the Delve render without building a gradient', () => {
  const { engine } = fixture();
  const { ctx, seen } = budgetContext();
  engine.context = ctx;
  engine.frameDt = 1 / 60;
  const frames = n => { for (let i = 0; i < n; i++) { engine.update(1 / 60); engine.render(); } };
  // Caches fill on first sight (a glow colour, the darkness hole), so walk the
  // same stretch twice: the second pass must build nothing at all.
  const pass = () => { engine.setInput('right', true); frames(60); engine.setInput('right', false); frames(30); };
  const steady = label => {
    const x = engine.player.x, y = engine.player.y;
    frames(3); pass();
    engine.player.x = x; engine.player.y = y; frames(3);
    const before = seen.gradients;
    pass();
    assert.equal(seen.gradients - before, 0, `${label}: 90 frames, walking and standing, built no gradient`);
  };
  for (const town of builtTowns()) {
    engine.setTown(town); steady(town.id);
    engine.goToStation('passage', true); steady(`${town.id} hunt`);
  }
  engine.setTown(world.TOWNS.infernal);
  engine.player.x = stationX(engine, 'delve'); engine.player.y = 610; engine.interact();
  steady('ember-delve');
  engine.destroy();
});

test('hot draw path: feedback motes are pooled, never reallocated, and capped', () => {
  const atmosphere = new atmosphereMod.Atmosphere();
  const list = atmosphere.motes;
  for (let n = 0; n < 40; n++) { atmosphere.burst(n, 0, n % 5 ? undefined : '+1'); atmosphere.update(1 / 60); }
  assert.ok(atmosphere.count <= atmosphereMod.FEEDBACK_CAP, 'capped');
  assert.equal(atmosphere.motes, list, 'one array for the life of the layer');
  for (let n = 0; n < 120; n++) atmosphere.update(1 / 60);
  assert.equal(atmosphere.count, 0, 'all faded');
  const pooled = atmosphere.spare.length;
  atmosphere.burst(0, 0);
  assert.equal(atmosphere.spare.length, pooled - 7, 'a burst reuses retired motes instead of allocating');
  assert.equal(atmosphere.motes[0].text, undefined, 'a reused mote does not keep an old caption');
});

// ── Delve: digging is never blocked, only the reward is rate-limited ────────
const rewardMod = loadTs(path.resolve(__dirname, '../src/app/play/delve-reward.ts'));
/**
 * The town seam's action economy, reduced to what the Delve asks of it: one
 * booked Mining operation per 2.5 s (MINING_RECOVERY_MS), idempotent by
 * mutation id, each worth its XP. `full` stands in for a full satchel.
 */
function fakeSeam(recoveryMs = 2500) {
  const ops = new Map(); let lastAt = null;
  const seam = {
    ops, full: false, xp: 0,
    recoveryRemainingMs: now => lastAt === null ? 0 : Math.max(0, lastAt + recoveryMs - now),
    resolve(mutationId, now) {
      if (ops.has(mutationId)) return { ok: true, replayed: true };
      if (lastAt !== null && now < lastAt + recoveryMs) return { ok: false, code: 'recovering' };
      if (seam.full) return { ok: false, code: 'capacity' };
      ops.set(mutationId, 2); seam.xp += 2; lastAt = now;
      return { ok: true, replayed: false };
    },
  };
  return seam;
}
/** The side-scroller's host rule (worldAction's mining branch), against the fake seam and a test clock. */
function delveHost(seam, clock) {
  const outcomes = [];
  const onWorldAction = e => {
    if (!(e.kind === 'mine' && e.discipline === 'mining')) return true;
    const settled = rewardMod.settleDelveMine(seam, e.mutationId, clock.now);
    outcomes.push({ id: e.mutationId, ...settled });
    return settled.outcome === 'resting' ? 'unpaid' : settled.outcome === 'paid';
  };
  return { onWorldAction, outcomes };
}

test('delve rock breaks on tool and swings alone: four Pickaxe I swings even during the seam\'s recovery, and XP is paid once', () => {
  const seam = fakeSeam(), clock = { now: 1_700_000_000_000 };
  const host = delveHost(seam, clock);
  const { engine, state } = enterDelve(host.onWorldAction);
  engine.setTools({ pickaxe: 1 });
  const t = engine.terrain;
  const rock = terrainMod.nodeIndex('scorched-basalt'), vein = terrainMod.nodeIndex('cinder-vein');
  assert.equal(terrainMod.TERRAIN_NODES['scorched-basalt'].hp, 4, 'four Pickaxe I swings of 1');
  /** Swing at one surface cell every `gap` ms of wall clock until it opens; the swing count. */
  const dig = (col, gap) => {
    engine.player.x = col * 32 - 30; engine.player.y = 610; engine.facing = 1;
    let swings = 0;
    while (t.solid(col, 0) && swings < 20) {
      clock.now += gap; engine.attackCooldown = 0; engine.strikeCell(col * 32 + 16, 626); swings++;
    }
    return swings;
  };
  setGenerated(t, 12, 0, rock); setGenerated(t, 14, 0, rock); setGenerated(t, 16, 0, vein);
  // A: the seam is fresh, so the break books an operation.
  assert.equal(dig(12, 650), 4);
  assert.equal(seam.xp, 2);
  assert.equal(host.outcomes.at(-1).outcome, 'paid');
  // B: dug straight after, well inside the 2.5 s breath. It still opens on the
  // fourth swing (before: refused until the breath ran out, 7 swings at 0.65 s).
  assert.equal(dig(14, 300), 4, 'the breath never adds swings');
  assert.equal(host.outcomes.at(-1).outcome, 'resting');
  assert.equal(seam.xp, 2, 'a cell dug during the breath pays no XP');
  assert.equal(seam.ops.has(host.outcomes.at(-1).id), false, 'and books nothing');
  // An ore vein during the breath: opens in three swings, no "gathered" line, no ore.
  assert.equal(dig(16, 300), 3);
  assert.equal(host.outcomes.at(-1).outcome, 'resting');
  assert.notEqual(state().messageKey, 'play.hud.eng.cellGathered', 'an unpaid vein says nothing was gathered');
  assert.equal(seam.xp, 2);
  // Every break was one ask: the engine never retried a cell (no refusals).
  assert.equal(host.outcomes.length, 3);
  assert.equal(new Set(host.outcomes.map(o => o.id)).size, 3);
  // A replayed grant (a second device, a retried write) never pays twice.
  clock.now += 10_000;
  const paidId = host.outcomes[0].id;
  assert.deepEqual(rewardMod.settleDelveMine(seam, paidId, clock.now), { outcome: 'paid', replayed: true });
  assert.equal(seam.xp, 2);
  // Once the breath is over, the next cell pays again.
  t.set(18, 0, rock);
  assert.equal(dig(18, 650), 4);
  assert.equal(host.outcomes.at(-1).outcome, 'paid');
  assert.equal(seam.xp, 4);
  engine.destroy();
});

test('delve rock: a full satchel still refuses the break (nothing lost), the breath alone never does', () => {
  const seam = fakeSeam(), clock = { now: 1_700_000_000_000 };
  const host = delveHost(seam, clock);
  const { engine } = enterDelve(host.onWorldAction);
  engine.setTools({ pickaxe: 1 });
  const t = engine.terrain;
  t.set(12, 0, terrainMod.nodeIndex('scorched-basalt'));
  engine.player.x = 12 * 32 - 30; engine.player.y = 610; engine.facing = 1;
  seam.full = true;
  for (let n = 0; n < 6; n++) { clock.now += 650; engine.attackCooldown = 0; engine.strikeCell(12 * 32 + 16, 626); }
  assert.equal(t.solid(12, 0), true, 'capacity: the cell stands, cracked');
  assert.equal(host.outcomes.at(-1).outcome, 'refused');
  seam.full = false; clock.now += 650; engine.attackCooldown = 0; engine.strikeCell(12 * 32 + 16, 626);
  assert.equal(t.solid(12, 0), false, 'room made: the next swing breaks it and pays');
  assert.equal(seam.xp, 2);
  engine.destroy();
});

test('the "+0 XP" cue shows at most once per window', () => {
  assert.equal(rewardMod.restCueDue(null, 1000), true);
  assert.equal(rewardMod.restCueDue(1000, 1000 + rewardMod.REST_CUE_GAP_MS - 1), false);
  assert.equal(rewardMod.restCueDue(1000, 1000 + rewardMod.REST_CUE_GAP_MS), true);
  assert.equal(rewardMod.restCueDue(5000, 1000), true, 'a clock that went back does not mute it forever');
});

// ── Tool tiers swing faster (Terraria "use time"); rewards stay capped ──────
const toolItems = loadTs(path.resolve(__dirname, '../src/app/shared/skills/tool-items.ts'));
const skillModel = loadTs(path.resolve(__dirname, '../src/app/shared/skills/skill.model.ts'));
/** A progress ledger at these skill levels (the least XP that reaches each). */
function progressAt(levels) {
  const xpFor = (skill, lvl) => {
    let lo = 0, hi = 1e9;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (skillModel.skillLevel({ xpByDiscipline: { [skill]: mid } }, skill) >= lvl) hi = mid; else lo = mid + 1;
    }
    return lo;
  };
  return { xpByDiscipline: Object.fromEntries(Object.entries(levels).map(([skill, lvl]) => [skill, xpFor(skill, lvl)])) };
}
const bag = ids => ({ items: ids.map(definitionId => ({ definitionId })), equipped: {} });

test('tool pace: starter 0.52 s, forged I-V 0.46/0.40/0.35/0.31/0.28, capped by the skill like the tier', () => {
  assert.equal(skillTools.STARTER_SWING_SECONDS, 0.52);
  assert.deepEqual({ ...skillTools.TOOL_SWING_SECONDS }, { 1: 0.46, 2: 0.40, 3: 0.35, 4: 0.31, 5: 0.28 });
  assert.deepEqual({ ...toolItems.parseToolId('starter-pickaxe') }, { family: 'pickaxe', tier: 1, starter: true });
  const starter = skillTools.toolTiers(bag(['starter-pickaxe', 'starter-axe', 'starter-sickle']));
  assert.deepEqual([starter.pickaxe, starter.axe, starter.sickle, starter.staff], [1, 1, 1, 0], 'the starter set works as tier I');
  assert.deepEqual({ ...starter.swing }, { pickaxe: 0.52, axe: 0.52, sickle: 0.52, staff: 0.52 });
  assert.equal(skillTools.toolTiers(bag([])).pickaxe, 0, 'no invisible floor: nothing held, nothing digs');
  for (const tier of [1, 2, 3, 4, 5]) {
    const t = skillTools.toolTiers(bag(['starter-pickaxe', `pickaxe-${tier}`]));
    assert.equal(t.pickaxe, tier); assert.equal(t.swing.pickaxe, skillTools.TOOL_SWING_SECONDS[tier]);
  }
  // A Pickaxe III at Mining 1 digs (and swings) like a Pickaxe I; the card says so.
  const low = progressAt({ mining: 1 });
  const capped = skillTools.toolTiers(bag(['pickaxe-3']), low);
  assert.equal(capped.pickaxe, 1); assert.equal(capped.swing.pickaxe, 0.46);
  const card = skillTools.toolCard('pickaxe-3', low);
  assert.equal(card.worksAs, 1); assert.equal(card.capUntil, 10);
  const lines = skillTools.toolCardLines(card, (key, vars) => `${key}${vars ? JSON.stringify(vars) : ''}`);
  assert.ok(lines.some(line => line.startsWith('toolStat.worksAs') && line.includes('"level":10')), lines.join('\n'));
  assert.equal(skillTools.toolCard('pickaxe-3', progressAt({ mining: 25 })).worksAs, null);
  const status = skillTools.toolStatus(bag(['starter-pickaxe', 'pickaxe-3']), low).find(s => s.family === 'pickaxe');
  assert.deepEqual([status.owned, status.tier, status.starter, status.swing, status.power, status.capUntil], [3, 1, false, 0.46, 1, 10]);
});

/** Hold the swing at one delve rock that grows back after each break, for `seconds`. */
function swingsIn(pace, seconds, onWorldAction = () => true, clock = null, tools = null) {
  const { engine } = enterDelve(onWorldAction);
  engine.setTools(tools ?? (pace ? { pickaxe: 1, swing: { pickaxe: pace } } : { pickaxe: 1 }));
  const t = engine.terrain;
  const rock = terrainMod.nodeIndex('scorched-basalt');
  const col = 12;
  engine.player.x = col * 32 - 30; engine.player.y = 610; engine.facing = 1;
  t.set(col, 0, rock);
  let swings = 0;
  const original = engine.hitCell.bind(engine);
  engine.hitCell = (...args) => { swings++; return original(...args); };
  const dt = 1 / 60;
  engine.attackCooldown = 0;
  for (let n = 0; n < Math.round(seconds / dt); n++) {
    if (clock) clock.now += dt * 1000;
    if (engine.attackCooldown <= 0) engine.strikeCell(col * 32 + 16, 626);
    engine.attackCooldown -= dt;
    if (!t.solid(col, 0)) t.set(col, 0, rock);
  }
  engine.attackCooldown = 0; engine.strikeCell(col * 32 + 16, 626);
  const cooldown = engine.attackCooldown;
  engine.destroy();
  return { swings, cooldown };
}

test('delve: a forged pickaxe swings faster, tier by tier; combat keeps its pace', () => {
  const base = swingsIn(null, 10);
  assert.equal(base.cooldown, 0.52, 'starter pace');
  const counts = [base.swings];
  for (const tier of [1, 2, 3, 4]) {
    const pace = skillTools.TOOL_SWING_SECONDS[tier];
    const run = swingsIn(pace, 10);
    assert.ok(Math.abs(run.cooldown - pace) < 1e-9, `tier ${tier}: cooldown ${run.cooldown}`);
    assert.ok(Math.abs(run.swings - Math.ceil(10 / pace)) <= 1, `tier ${tier}: ${run.swings} swings in 10 s at ${pace}`);
    counts.push(run.swings);
  }
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] > counts[i - 1], `strictly more swings per tier: ${counts}`);
  // Combat: a swing at a monster keeps the old 0.52 whatever the tools.
  const { engine } = fixture();
  engine.setTools({ pickaxe: 4, axe: 4, sickle: 4, swing: { pickaxe: 0.31, axe: 0.31, sickle: 0.31 } });
  killFirst(engine);
  assert.equal(engine.attackCooldown, 0.52);
  // A bad pace from a host is clamped, never instant.
  engine.setTools({ pickaxe: 1, swing: { pickaxe: 0.001 } });
  assert.equal(engine.swing.pickaxe, 0.25);
  engine.destroy();
});

test('delve rewards per second do not grow with the faster swing: the seam\'s breath caps paid XP', () => {
  const paid = pace => {
    const seam = fakeSeam(), clock = { now: 1_700_000_000_000 };
    const host = delveHost(seam, clock);
    const run = swingsIn(pace, 60, host.onWorldAction, clock);
    return { xp: seam.xp, breaks: host.outcomes.length, swings: run.swings };
  };
  const slow = paid(null), fast = paid(skillTools.TOOL_SWING_SECONDS[4]);
  assert.ok(fast.swings > slow.swings * 1.5, `faster swings (${fast.swings} vs ${slow.swings})`);
  assert.ok(fast.breaks > slow.breaks, 'more rock opened');
  // One booked op per 2.5 s: at most 60 / 2.5 + 1 = 25 in a minute, 2 XP each.
  assert.ok(fast.xp <= 25 * 2, `paid XP capped: ${fast.xp}`);
  assert.ok(slow.xp <= 25 * 2);
  assert.ok(fast.xp - slow.xp <= 2 * 2, `no more than a breath's rounding apart (${slow.xp} vs ${fast.xp})`);
});

test('gathering: a forged axe fells a sapling sooner, but a node still pays once per regrowth', () => {
  const run = pace => {
    let clock = 1_700_000_000_000;
    const start = clock;
    const { engine, calls } = enterThicket({ now: () => clock });
    engine.setTools(pace ? { axe: 1, swing: { axe: pace } } : { axe: 1 });
    standAt(engine, nodeX(engine, 'world-root-sapling'));
    engine.setInput('attack', true);
    let felledAt = null;
    for (let n = 0; n < 120 * 60; n++) {
      clock += 1000 / 60; engine.update(1 / 60);
      if (felledAt === null && calls.length) felledAt = clock - start;
    }
    engine.destroy();
    return { felledAt, paid: calls.length };
  };
  const slow = run(null), fast = run(skillTools.TOOL_SWING_SECONDS[4]);
  // Three hits: two cooldowns between the first swing and the break.
  assert.ok(Math.abs(slow.felledAt - 2 * 520) <= 40, `starter: felled at ${slow.felledAt} ms`);
  assert.ok(Math.abs(fast.felledAt - 2 * 310) <= 40, `Axe IV pace: felled at ${fast.felledAt} ms`);
  assert.equal(fast.paid, slow.paid, 'the same harvests in two minutes: regrowth is the cap');
  assert.ok(slow.paid >= 2);
});

// ── The skill level sharpens the tool: faster swings, harder hits; rewards stay capped ──
const toolLevel = loadTs(path.resolve(__dirname, '../src/app/shared/skills/tool-level.ts'));
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('tool level: swing × (1 − 0.25·(L−1)/98), power × (1 + 0.5·(L−1)/98), floored at 0.25 s; staff swing untouched', () => {
  assert.deepEqual({ ...toolLevel.TOOL_SKILL }, { pickaxe: 'mining', axe: 'woodcutting', sickle: 'foraging', staff: 'enchanting' });
  assert.equal(toolLevel.levelSwingFactor(1), 1); assert.equal(toolLevel.levelPowerFactor(1), 1);
  assert.equal(toolLevel.levelSwingFactor(99), 0.75); assert.equal(toolLevel.levelPowerFactor(99), 1.5);
  assert.equal(toolLevel.levelPowerFactor(0), 1);
  // Past 99 (uncapped levels) it keeps sharpening, half the extra by 199, never reaching 0.65 / x2.0.
  assert.ok(close(toolLevel.levelSwingFactor(199), 0.70)); assert.ok(close(toolLevel.levelPowerFactor(199), 1.75));
  assert.ok(close(toolLevel.levelSwingFactor(50), 1 - 0.25 * 49 / 98));
  const table = [];
  for (const tier of ['starter', 1, 2, 3, 4]) {
    const base = tier === 'starter' ? skillTools.STARTER_SWING_SECONDS : skillTools.TOOL_SWING_SECONDS[tier];
    const power = tier === 'starter' ? 1 : skillTools.toolPower(tier);
    for (const level of [1, 20, 50, 99]) {
      const swing = skillTools.levelSwing(base, level, 'mining');
      assert.ok(close(swing, Math.max(0.25, base * toolLevel.levelSwingFactor(level))));
      assert.ok(swing >= 0.25 && swing <= 0.52);
      table.push({ tier, level, swing: +swing.toFixed(3), power: +(power * toolLevel.levelPowerFactor(level)).toFixed(3) });
    }
  }
  assert.equal(table.find(r => r.tier === 4 && r.level === 99).swing, 0.25, 'Pickaxe IV at 99 hits the floor (0.31 × 0.75 = 0.2325)');
  assert.equal(skillTools.levelSwing(0.52, 99, 'enchanting'), 0.52, 'the staff blast keeps its pace');
  if (process.env.TOOL_LEVEL_TABLE) console.table(table);
  // toolTiers reads the level per family.
  const t = skillTools.toolTiers(bag(['starter-axe', 'pickaxe-4']), progressAt({ mining: 99, woodcutting: 50 }));
  assert.equal(t.swing.pickaxe, 0.25); assert.equal(t.toolSwing.pickaxe, 0.31); assert.equal(t.power.pickaxe, 1.5);
  assert.ok(close(t.swing.axe, 0.52 * toolLevel.levelSwingFactor(50))); assert.equal(t.toolSwing.axe, 0.52);
  assert.equal(t.power.sickle, 1, 'Foraging 1: no bonus');
});

test('tool level: the card and stats lines show the split above level 1, the plain lines at 1', () => {
  const t = (key, vars) => `${key}${vars ? JSON.stringify(vars) : ''}`;
  const at42 = skillTools.toolCard('pickaxe-2', progressAt({ mining: 42 }));
  assert.equal(at42.level, 42); assert.equal(at42.toolSwing, 0.40); assert.equal(at42.toolPower, 1.5);
  const lines = skillTools.toolCardLines(at42, t);
  assert.ok(lines[0].startsWith('toolStat.powerSplit') && lines[0].includes('"tool":"1.5"') && lines[0].includes('"pct":21'), lines[0]);
  assert.ok(lines[1].startsWith('toolStat.swingSplit') && lines[1].includes('"s":"0.36"') && lines[1].includes('"tool":"0.40"') && lines[1].includes('"pct":10'), lines[1]);
  const at1 = skillTools.toolCardLines(skillTools.toolCard('pickaxe-1', progressAt({ mining: 1 })), t);
  assert.ok(at1[0].startsWith('toolStat.power{') && at1[1].startsWith('toolStat.swing{'), at1.join('\n'));
  // The staff's power is split, its pace is not.
  const staff = skillTools.toolPaceLines({ skill: 'enchanting', starter: false, power: 1.25, swing: 0.46, toolPower: 1, toolSwing: 0.46, level: 50 }, t);
  assert.ok(staff[0].startsWith('toolStat.powerSplit') && staff[1].startsWith('toolStat.swing{'), staff.join('\n'));
  // The EN templates, filled.
  const { TOOLS_I18N } = loadTs(path.resolve(__dirname, '../src/app/shared/skills/tools.i18n.ts'));
  const en = (key, vars) => TOOLS_I18N[key].en.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars?.[k]));
  assert.deepEqual(skillTools.toolPaceLines(at42, en), ['Power ×1.81 (tool ×1.5 · Mining 42 +21%)', 'Swing 0.36 s (tool 0.40 · Mining 42 −10%)']);
  assert.deepEqual({ ...toolLevel.levelGain(41, 42) }, { swing: '0.3', power: '0.5' });
  // (The level-up line that read levelGain lived on the site's level-up banner, deleted with the game-only shell.)
  for (const key of ['toolStat.powerSplit', 'toolStat.swingSplit']) assert.ok(TOOLS_I18N[key].es, `${key} ES`);
});

// ── Uncapped levels, Tibia-style (docs/handoff/uncapped-levels.md) ──
const curve = loadTs(path.resolve(__dirname, '../src/app/shared/activity/mining-level.ts'));

test('uncapped levels: 1-99 unchanged, continuous at 99 -> 100, steepening, exact to level 1000', () => {
  // The 1-99 curve is exactly the old formula.
  for (let level = 2; level <= 99; level++) assert.equal(curve.xpForLevel(level), Math.floor(100 * Math.pow(level - 1, 2.2)), `level ${level}`);
  const step = level => curve.xpForLevel(level) - curve.xpForLevel(level - 1);
  assert.equal(curve.MASTERY_STEP, step(99));
  // Continuity: the step to 100 is within 3% of the step to 99.
  assert.ok(step(100) > step(99) && step(100) / step(99) < 1.03, `99->100 ${step(100)} vs 98->99 ${step(99)}`);
  // Monotonic, steepening, integer and safe all the way to 1000.
  for (let level = 100; level <= 1000; level++) {
    const xp = curve.xpForLevel(level);
    assert.ok(Number.isSafeInteger(xp), `level ${level} safe`);
    assert.ok(step(level) > 0 && step(level) >= step(level - 1), `level ${level} steepens`);
    assert.equal(curve.levelForXp(xp), level); assert.equal(curve.levelForXp(xp - 1), level - 1);
  }
  // Tibia's shape: the step grows with the square of the level.
  assert.ok(Math.abs(step(198) / step(99) - 4) < 0.1, `step at 198 ~4x the step at 99 (${(step(198) / step(99)).toFixed(2)})`);
  const v = curve.miningLevelView(curve.xpForLevel(300) + 10);
  assert.equal(v.level, 300); assert.equal(v.into, 10); assert.equal(v.next, curve.xpForLevel(301)); assert.equal(v.span, step(301));
  assert.equal(curve.miningLevelView(Number.MAX_SAFE_INTEGER).level, curve.LEVEL_SEARCH_LIMIT);
  assert.equal(curve.miningLevelView(NaN).level, 1);
  assert.deepEqual([999, 53_607, 240_000, 2_402_687, 50_079_060, 1_826_523_753].map(curve.formatXp), ['999', '53,607', '240K', '2.4M', '50.1M', '1.83B']);
});

test('uncapped levels: tool bonus grows past 99 toward its asymptote; the swing never beats 0.25 s', () => {
  let prevSwing = toolLevel.levelSwingFactor(99), prevPower = toolLevel.levelPowerFactor(99);
  for (let level = 100; level <= 1000; level++) {
    const swing = toolLevel.levelSwingFactor(level), power = toolLevel.levelPowerFactor(level);
    assert.ok(swing < prevSwing && swing > 0.65, `swing ${level}`);
    assert.ok(power > prevPower && power < toolLevel.MAX_LEVEL_POWER, `power ${level}`);
    // Diminishing: each level adds less than the one before.
    assert.ok(prevSwing - swing <= toolLevel.levelSwingFactor(level - 2) - prevSwing + 1e-12 || level === 100);
    prevSwing = swing; prevPower = power;
    for (const base of [skillTools.STARTER_SWING_SECONDS, ...Object.values(skillTools.TOOL_SWING_SECONDS)]) {
      assert.ok(skillTools.levelSwing(base, level, 'mining') >= 0.25, `floor at ${level}`);
    }
  }
  assert.equal(skillTools.levelSwing(skillTools.TOOL_SWING_SECONDS[4], 300, 'mining'), 0.25);
  assert.ok(toolLevel.levelPowerFactor(10_000) < 2);
  // The banner's per-level line past 300 shows two decimals rather than "0.0".
  assert.deepEqual({ ...toolLevel.levelGain(299, 300) }, { swing: '0.01', power: '0.06' });
});

/** Swings to open one cell of `nodeId` with a Pickaxe `tier` at Mining `level` (power from the level). */
function hitsToBreak(nodeId, tier, level) {
  const { engine } = enterDelve(() => true);
  engine.setTools({ pickaxe: tier, power: { pickaxe: toolLevel.levelPowerFactor(level) }, levels: { mining: level } });
  const t = engine.terrain;
  const col = 12;
  engine.player.x = col * 32 - 30; engine.player.y = 610; engine.facing = 1;
  t.set(col, 0, terrainMod.nodeIndex(nodeId));
  let hits = 0;
  while (t.solid(col, 0) && hits < 50) { engine.attackCooldown = 0; engine.strikeCell(col * 32 + 16, 626); hits++; }
  engine.destroy();
  return hits;
}

test('delve: a higher Mining level opens rock in fewer swings (fractional damage, the crack logic agrees)', () => {
  const rows = {};
  for (const [node, tier] of [['scorched-basalt', 1], ['hard-rock', 1], ['cinder-vein', 1], ['heartstone-vein', 3], ['grotto-stone', 1]]) {
    // A vein's own level gate comes first (Heartstone needs Mining 20).
    const levels = [1, 20, 50, 99].map(level => Math.max(level, terrainMod.TERRAIN_NODES[node].minLevel ?? 1));
    rows[node] = levels.map(level => hitsToBreak(node, tier, level));
    const hp = terrainMod.TERRAIN_NODES[node].hp, min = terrainMod.TERRAIN_NODES[node].tools.pickaxe;
    levels.forEach((level, i) => {
      const damage = (1 + (tier - min) / 2) * toolLevel.levelPowerFactor(level);
      assert.equal(rows[node][i], Math.ceil(hp / damage - 1e-3), `${node} at Mining ${level}: ${rows[node][i]} swings`);
    });
    for (let i = 1; i < 4; i++) assert.ok(rows[node][i] <= rows[node][i - 1], `${node}: never more swings at a higher level (${rows[node]})`);
  }
  if (process.env.TOOL_LEVEL_TABLE) console.log(rows);
  assert.deepEqual(rows['scorched-basalt'], [4, 4, 4, 3]);
  // A fractional hit cracks a cell to the right stage: 4 HP − 1.5 leaves 2.5 (62%: stage 2).
  const { engine } = enterDelve(() => true);
  engine.setTools({ pickaxe: 1, power: { pickaxe: 1.5 } });
  const t = engine.terrain; const col = 12;
  engine.player.x = col * 32 - 30; engine.player.y = 610; engine.facing = 1;
  t.set(col, 0, terrainMod.nodeIndex('scorched-basalt'));
  engine.attackCooldown = 0; engine.strikeCell(col * 32 + 16, 626);
  assert.ok(close(t.hp[t.index(col, 0)], 2.5, 1e-6)); assert.equal(t.stage(col, 0), 2);
  // A bad multiplier from a host is clamped to [1, 2] (x2.0 is the level bonus's asymptote).
  engine.setTools({ pickaxe: 1, power: { pickaxe: 9 } }); assert.equal(engine.power.pickaxe, toolLevel.MAX_LEVEL_POWER);
  engine.setTools({ pickaxe: 1, power: { pickaxe: 0.2 } }); assert.equal(engine.power.pickaxe, 1);
  engine.destroy();
});

test('combat is unchanged by the gathering levels', () => {
  const hit = power => {
    const { engine } = fixture();
    engine.setTools({ pickaxe: 4, axe: 4, sickle: 4, swing: { pickaxe: 0.25, axe: 0.25, sickle: 0.25 }, power });
    const monster = engine.monsters[0];
    engine.player.x = monster.x - 50; const before = monster.hp; strike(engine);
    const dealt = before - monster.hp, cooldown = engine.attackCooldown;
    engine.destroy();
    return { dealt, cooldown };
  };
  const plain = hit(undefined), sharp = hit({ pickaxe: 1.5, axe: 1.5, sickle: 1.5, staff: 1.5 });
  assert.deepEqual(sharp, plain); assert.equal(sharp.cooldown, 0.52); assert.ok(plain.dealt > 0);
});

test('rewards per minute do not rise with the level: delve paid XP and gathering harvests stay capped', () => {
  const tools = level => ({
    pickaxe: 4, levels: { mining: level },
    swing: { pickaxe: skillTools.levelSwing(skillTools.TOOL_SWING_SECONDS[4], level, 'mining') },
    power: { pickaxe: toolLevel.levelPowerFactor(level) },
  });
  const paid = level => {
    const seam = fakeSeam(), clock = { now: 1_700_000_000_000 };
    const host = delveHost(seam, clock);
    // Every break is a fresh cell (its own mutation id), so only the seam's breath can cap the pay.
    let cell = 0;
    const run = swingsIn(null, 60, e => host.onWorldAction({ ...e, mutationId: `${e.mutationId}:${cell++}` }), clock, tools(level));
    return { xp: seam.xp, breaks: host.outcomes.length, swings: run.swings };
  };
  const l1 = paid(1), l99 = paid(99), l300 = paid(300);
  if (process.env.TOOL_LEVEL_TABLE) console.log({ l1, l99, l300 });
  // Uncapped levels: level 300 swings at least as fast, and is paid exactly what 99 is.
  assert.ok(l300.swings >= l99.swings, `no slower at 300 (${l300.swings} vs ${l99.swings})`);
  assert.equal(l300.xp, l99.xp, `paid XP a minute at 300 equals 99 (${l300.xp} vs ${l99.xp})`);
  assert.ok(l99.swings > l1.swings, `faster swings at 99 (${l99.swings} vs ${l1.swings})`);
  assert.ok(l99.breaks >= l1.breaks, 'at least as much rock opened');
  // One booked op per 2.5 s: at most 25 in a minute, 2 XP each — at every level. Level 1 already reaches it.
  assert.ok(l1.xp <= 25 * 2 && l99.xp <= 25 * 2, `paid XP capped: ${l1.xp} / ${l99.xp}`);
  assert.ok(l1.xp >= 20 * 2, `level 1 already digs at the cap (${l1.xp})`);
  assert.ok(l99.xp - l1.xp <= 2 * 2, `no more than a breath's rounding apart (${l1.xp} vs ${l99.xp})`);

  const harvests = level => {
    let clock = 1_700_000_000_000;
    const { engine, calls } = enterThicket({ now: () => clock });
    engine.setTools({ axe: 1, swing: { axe: skillTools.levelSwing(0.52, level, 'woodcutting') }, power: { axe: toolLevel.levelPowerFactor(level) } });
    standAt(engine, nodeX(engine, 'world-root-sapling'));
    engine.setInput('attack', true);
    for (let n = 0; n < 120 * 60; n++) { clock += 1000 / 60; engine.update(1 / 60); }
    engine.destroy();
    return calls.length;
  };
  const w1 = harvests(1), w99 = harvests(99), w300 = harvests(300);
  if (process.env.TOOL_LEVEL_TABLE) console.log({ w1, w99, w300 });
  assert.equal(w300, w99, `the same harvests at Woodcutting 300 as at 99 (${w99})`);
  assert.equal(w99, w1, `the same harvests in two minutes at Woodcutting 1 and 99 (${w1}): regrowth is the cap`);
  assert.ok(w1 >= 2);
});

// ── Terraria-style terrain: auto-tiling, baked textures, light grid (docs/handoff/terraria-terrain.md) ──
const tileArt = loadTs(path.resolve(__dirname, '../src/app/play/engine/tile-art.ts'));
const caveMod = loadTs(path.resolve(__dirname, '../src/app/play/engine/cave-backdrop.ts'));

/** A solid() over a little ASCII map: '#' solid, '.' air; outside the map is solid (like the Delve's sides). */
function asciiSolid(rows) {
  return (col, row) => row < 0 || col < 0 || row >= rows.length || col >= rows[0].length || rows[row][col] === '#';
}

test('auto-tile: the mask names solid neighbours, and a diagonal only counts between two solid sides', () => {
  const { N, E, S, W, NE, SE, SW, NW, tileMask } = tileArt;
  const solid = asciiSolid([
    '#####',
    '##.##',
    '#####',
    '#.###',
    '#####',
  ]);
  assert.equal(tileMask(solid, 2, 2), E | S | W | SE, 'below one hole, NE of another: N open (so no NE or NW), SW open');
  assert.equal(tileMask(solid, 3, 1), N | E | S | NE | SE, 'right of the hole: W open, so SW and NW drop out');
  assert.equal(tileMask(solid, 3, 2), N | E | S | W | NE | SE | SW, 'diagonal to the hole: only the NW notch is missing');
  assert.equal(tileMask(solid, 0, 0), N | E | S | W | NE | SE | SW | NW, 'buried rock is fully joined');
  const lone = asciiSolid(['...', '.#.', '...']);
  assert.equal(tileMask(lone, 1, 1), 0, 'a lone block meets air on every side');
  // Diagonal-only solids never set a bit on their own.
  const corners = asciiSolid(['#.#', '...', '#.#']);
  assert.equal(tileMask(corners, 1, 1) & (NE | SE | SW | NW), 0);
});

test('auto-tile: the variant is fixed per cell, in range, and every variant is used', () => {
  const seen = new Set();
  for (let row = 0; row < 40; row++) for (let col = 0; col < 40; col++) {
    const v = tileArt.tileVariant(col, row);
    assert.ok(v >= 0 && v < tileArt.VARIANTS);
    assert.equal(tileArt.tileVariant(col, row), v, 'stable');
    seen.add(v);
  }
  assert.equal(seen.size, tileArt.VARIANTS, 'no variant is dead');
});

test('auto-tile: edges outline only the open sides, notch an open diagonal, and stay on the art-pixel grid', () => {
  const { N, E, S, W, NE, SE, SW, ART, paintEdges } = tileArt;
  const rects = [];
  const c = { fillStyle: '', globalAlpha: 1, fillRect: (x, y, w, h) => rects.push({ x, y, w, h, color: c.fillStyle }) };
  const palette = tileArt.nodePalette({ base: '#3a2b2c', dark: '#241a1c', light: '#5a4440', fleck: '#6b5148' });
  paintEdges(c, 64, 96, N | E | S | W | NE | SE | SW, palette);
  assert.deepEqual(rects, [{ x: 64, y: 96, w: ART, h: ART, color: palette[tileArt.P_DEEP] }], 'fully joined but the NW diagonal: one notch pixel');
  rects.length = 0;
  paintEdges(c, 64, 96, E | S | W | SE | SW, palette);
  const top = rects.filter(r => r.y === 96 && r.w === 32);
  assert.ok(top.some(r => r.color === palette[tileArt.P_DEEP]), 'an outline along the open top');
  assert.ok(rects.some(r => r.y === 96 + ART && r.color === palette[tileArt.P_HI]), 'a highlight bevel under it');
  assert.notEqual(palette[tileArt.P_HI], palette[tileArt.P_LIGHT], 'the highlight is a step above light');
  assert.notEqual(palette[tileArt.P_DEEP], '#000000', 'the outline is never pure black');
  assert.ok(!rects.some(r => r.y >= 96 + 32 - ART && r.h === ART && r.w === 32), 'no outline along the joined bottom');
  for (const r of rects) for (const v of [r.x, r.y, r.w, r.h]) assert.equal(v % ART, 0, 'whole art pixels');
});

test('auto-tile: each biome grows its own top face, from what it breathes', () => {
  const faces = { spore: 'moss', ash: 'ash', mote: 'lichen', ember: 'crust' };
  for (const [kind, face] of Object.entries(faces)) assert.equal(tileArt.topFaceOf({ particles: { kind, color: '#fff', count: 5 } }), face);
  assert.equal(tileArt.topFaceOf(terrainMod.DEFAULT_BIOME), null, 'the plain delve look keeps a bare bevel');
  const { EMBER_DELVE } = loadTs(path.resolve(__dirname, '../src/app/play/world/towns/infernal.ts'));
  assert.deepEqual(EMBER_DELVE.terrain.biomes.map(b => tileArt.topFaceOf(b)), ['moss', 'ash', 'lichen', 'crust'], 'Root Hollows, Basalt Caverns, Glowcap Grotto, Magma Halls');
});

test('tile textures: every node kind has a pattern; pixels are deterministic, varied, and ore has a lit nugget to sparkle on', () => {
  const { patternPixels, patternOf, TILE, VARIANTS, P_FLECK, P_SHINE } = tileArt;
  for (const node of terrainMod.TERRAIN_NODE_LIST) {
    if (!node.solid) continue;
    const pattern = patternOf(node);
    const a = patternPixels(pattern, node.id, 0), b = patternPixels(pattern, node.id, 0);
    assert.equal(a.px.length, TILE * TILE);
    assert.deepEqual(a.px, b.px, `${node.id}: same pixels every time`);
    // A cache and a solid prop (the Living World's ashberry bush) are one pixel map each.
    if (pattern !== 'cache' && pattern !== 'placed') for (let v = 1; v < VARIANTS; v++) assert.notDeepEqual(patternPixels(pattern, node.id, v).px, a.px, `${node.id}: variant ${v} differs`);
  }
  for (const id of ['cinder-vein', 'slag-vein', 'heartstone-vein', 'ember-rock']) {
    const node = terrainMod.TERRAIN_NODES[id];
    assert.equal(patternOf(node), 'ore', id);
    for (let v = 0; v < VARIANTS; v++) {
      const { px, sparkle } = patternPixels('ore', id, v);
      assert.ok(px.filter(p => p === P_FLECK).length >= 4, `${id}/${v}: clustered nugget pixels`);
      assert.equal(px[sparkle], P_SHINE, `${id}/${v}: the sparkle sits on the nugget's shine`);
      assert.equal(tileArt.sparkleOffset(terrainMod.nodeIndex(id), v), sparkle, 'memoised offset matches');
    }
  }
  assert.equal(patternOf(terrainMod.TERRAIN_NODES.rock), 'rock');
  assert.equal(tileArt.sparkleOffset(terrainMod.nodeIndex('rock'), 0), -1, 'plain rock does not sparkle');
});

test('tile textures: the atlas is one canvas, bakes each kind and each biome wall once, and never repaints', () => {
  const surfaces = [];
  let fills = 0;
  const atlas = new tileArt.TileAtlas((w, h) => {
    const surface = { canvas: { width: w, height: h }, context: { fillStyle: '', fillRect: () => fills++ } };
    surfaces.push(surface);
    return surface;
  });
  const rock = terrainMod.nodeIndex('rock'), ore = terrainMod.nodeIndex('cinder-vein');
  assert.equal(atlas.node(rock), rock, 'a node kind lives in its own row');
  const afterFirst = fills;
  assert.ok(afterFirst > 0);
  for (let n = 0; n < 50; n++) atlas.node(rock);
  assert.equal(fills, afterFirst, 'asking again paints nothing');
  atlas.node(ore);
  assert.equal(atlas.baked, tileArt.VARIANTS * 2, 'two kinds, every variant, once each');
  const biome = { id: 'magma-halls', wall: ['#1e0d0a', '#190a08', '#0b0403'] };
  const wallRow = atlas.wall(biome);
  assert.ok(wallRow >= terrainMod.TERRAIN_NODE_LIST.length, 'walls sit below the node rows');
  assert.equal(atlas.wall({ ...biome }), wallRow, 'keyed by biome id');
  assert.equal(atlas.baked, tileArt.VARIANTS * 3);
  assert.equal(surfaces.length, 1, 'one canvas for everything');
  assert.equal(surfaces[0].canvas.width, tileArt.TILE * tileArt.VARIANTS);
  assert.ok(surfaces[0].canvas.height >= (wallRow + 1) * tileArt.TILE, 'tall enough for every row');
  // No canvas (SSR, node): nothing is drawn, nothing throws, and it is not retried every call.
  let asked = 0;
  const none = new tileArt.TileAtlas(() => { asked++; return null; });
  assert.equal(none.node(rock), -1); assert.equal(none.wall(biome), -1); assert.equal(none.canvas, null);
  assert.equal(asked, 1);
});

test('terrain: digging a chunk-corner cell also redraws the diagonal chunk (its corner notch)', () => {
  const t = new terrainMod.Terrain(24, 24, 0);
  const before = Array.from(t.chunkRev);
  t.set(7, 7, 0); // the bottom-right corner cell of chunk (0, 0)
  const bumped = Array.from(t.chunkRev).map((v, i) => v - before[i]);
  const at = (cc, cr) => bumped[cr * t.chunkCols + cc];
  assert.equal(at(0, 0), 1); assert.equal(at(1, 0), 1); assert.equal(at(0, 1), 1);
  assert.equal(at(1, 1), 1, 'the diagonal neighbour chunk');
  const mid = Array.from(t.chunkRev);
  t.set(3, 3, 0);
  assert.deepEqual(Array.from(t.chunkRev).map((v, i) => v - mid[i]).filter(Boolean), [1], 'an inner cell touches only its own chunk');
});

test('light grid: samples match darknessAt, and rock shade dims light only inside the rock', () => {
  const pool = new lightMod.LightPool(4);
  pool.add(100, 80, 200, 1); pool.add(300, 200, 120, .8);
  const gw = 30, gh = 20, step = lightMod.LIGHT_STEP, out = new Float32Array(gw * gh);
  lightMod.lightGrid(out, gw, gh, 0, 0, step, pool.lights, pool.count, .9);
  for (let j = 0; j < gh; j += 3) for (let i = 0; i < gw; i += 4) {
    const expect = lightMod.darknessAt((i + .5) * step, (j + .5) * step, pool.lights, pool.count, .9);
    assert.ok(Math.abs(out[j * gw + i] - expect) < 1e-5, `sample ${i},${j}`);
  }
  // Shade: one cell deep in rock takes 0.8 of each light.
  const values = new Float32Array(20 * 20).fill(1);
  values[2 * 20 + 3] = tileArt.ROCK_DEEP1;
  const shaded = new Float32Array(gw * gh);
  lightMod.lightGrid(shaded, gw, gh, 0, 0, step, pool.lights, pool.count, .9, { values, cols: 20, rows: 20, top: 0 });
  const inRock = 4 * gw + 6; // sample centre (104, 72): cell (3, 2)
  assert.ok(shaded[inRock] > out[inRock], 'darker inside the rock');
  assert.equal(shaded[0], out[0], 'air untouched');
});

test('rock shade: rock touching air takes all the light, one cell in less, deeper less again; rebuilt only when a cell changes', () => {
  const t = new terrainMod.Terrain(12, 12, 0);
  t.kind.fill(terrainMod.nodeIndex('rock'));
  t.set(5, 5, 0);
  const shade = new tileArt.RockShade();
  shade.update(t);
  const v = (col, row) => shade.values[row * 12 + col];
  assert.equal(v(5, 5), 1, 'air');
  assert.equal(v(5, 4), 1, 'rock face');
  assert.equal(v(5, 3), Math.fround(tileArt.ROCK_DEEP1), 'one in');
  assert.equal(v(5, 2), Math.fround(tileArt.ROCK_DEEP2), 'deep');
  assert.equal(v(4, 2), Math.fround(tileArt.ROCK_DEEP2));
  const values = shade.values;
  shade.update(t);
  assert.equal(shade.values, values, 'same buffer');
  t.set(5, 3, 0);
  shade.update(t);
  assert.equal(v(5, 3), 1, 'dug: rebuilt');
  assert.equal(v(5, 2), 1, 'a new rock face');
  assert.equal(v(4, 2), Math.fround(tileArt.ROCK_DEEP1), 'and behind it, one in');
});

test('cave backdrop: both parallax layers tile seamlessly, the far one is opaque and the near one leaves the cavern open', () => {
  for (const layer of ['far', 'near']) {
    const px = caveMod.parallaxPixels(layer, 1234);
    assert.deepEqual(px, caveMod.parallaxPixels(layer, 1234), `${layer}: deterministic`);
    const w = layer === 'far' ? 128 : 160, h = px.length / w;
    const count = v => px.filter(p => p === v).length;
    if (layer === 'far') assert.equal(count(0), 0, 'far: no hole');
    else assert.ok(count(0) > px.length * .4, 'near: mostly open');
    assert.ok(count(1) + count(2) > 0, `${layer}: has rock`);
    // Seamless: across the wrap the hanging rock steps no more than between any two neighbouring columns inside.
    const depth = col => { let y = 0; while (y < h && px[y * w + col] !== 0 && px[y * w + col] !== 3) y++; return y; };
    let steepest = 0;
    for (let x = 0; x < w - 1; x++) steepest = Math.max(steepest, Math.abs(depth(x + 1) - depth(x)));
    assert.ok(Math.abs(depth(0) - depth(w - 1)) <= steepest + 2, `${layer}: wraps in x`);
  }
});

test('cave backdrop (phone, maskBackdrop): pattern only round the open cells, one flat fill under solid rock', () => {
  const T = terrainMod, CELL = T.CELL;
  const t = new T.Terrain(32, 40, 0);
  t.kind.fill(T.nodeIndex('rock'));
  const rects = [];
  const ctx = new Proxy({ fillStyle: '' }, {
    get: (o, k) => k === 'fillRect' ? (...a) => rects.push(a) : k in o ? o[k] : () => {},
    set: (o, k, v) => { o[k] = v; return true; },
  });
  const cave = new caveMod.CaveBackdrop();
  rects.length = 0; cave.draw(ctx, t, 0, 0, 10 * CELL, 20 * CELL, 1);
  assert.equal(rects.length, 1, 'all rock: only the flat fill');
  rects.length = 0; cave.draw(ctx, t, 0, 0, 10 * CELL, 20 * CELL, 0);
  assert.equal(rects.length, 1, 'unmasked (desktop): one full fill, as before');
  t.kind[t.index(5, 10)] = T.nodeIndex('air');
  rects.length = 0; cave.draw(ctx, t, 0, 0, 10 * CELL, 20 * CELL, 1);
  const runs = rects.slice(1);
  assert.equal(runs.length, 3, 'the open cell and a cell of margin round it: three row runs');
  for (const [x, y, w, h] of runs) {
    assert.equal(x, 4 * CELL); assert.equal(w, 3 * CELL); assert.equal(h, CELL);
    assert.ok(y >= 9 * CELL && y <= 11 * CELL);
  }
  // Columns outside the loaded span show the cave (nothing is drawn over them).
  t.colLo = 3;
  rects.length = 0; cave.draw(ctx, t, 0, 0, 10 * CELL, 20 * CELL, 1);
  assert.ok(rects.slice(1).some(([x, , w]) => x === 0 && w >= 3 * CELL), 'unloaded columns stay filled');
});

// ── Terrain pass 2: brightness, pixel placeables, imported sheets and parallax ──

test('light: a broad bright pool, and unlit depths stay short of black', () => {
  assert.equal(lightMod.lightFalloff(50, 100), .75, 'half way out, three quarters of the light');
  assert.equal(lightMod.lightFalloff(100, 100), 0);
  assert.ok(lightMod.ambientDarkness(10000) <= .82, 'deep down the floor is not black');
  assert.ok(lightMod.ambientDarkness(10000) >= .75, 'but darkness still matters away from light');
});

test('placeables are 16 x 16 pixel maps on the art grid, in their own palette, transparent around the object', () => {
  const ids = ['torch', 'ladder', 'platform', 'chest', 'camp', 'timber-support', 'basalt-support', 'blast-charge'];
  for (const id of ids) {
    const rows = tileArt.PLACED_ART[id];
    assert.ok(rows, `${id} has pixel art`);
    assert.equal(rows.length, tileArt.TILE, `${id}: 16 rows`);
    for (const row of rows) assert.match(row, /^[.odblhfs]{16}$/, `${id}: 16 known pixels a row`);
    const node = terrainMod.TERRAIN_NODE_LIST[terrainMod.nodeIndex(id)];
    assert.equal(tileArt.patternOf(node), 'placed', `${id} draws from its map`);
    assert.equal(tileArt.takesTopFace('placed'), false);
    const { px } = tileArt.patternPixels('placed', id, 0);
    assert.ok(px.includes(tileArt.P_CLEAR_INDEX), `${id}: the wall shows around it`);
  }
  // A ladder's rails and a platform's plank run on through the cell edges, so a run reads as one piece.
  const ladder = tileArt.PLACED_ART.ladder;
  assert.equal(ladder[0].replace(/h/g, 'l'), ladder[ladder.length - 1], 'ladder rails meet across cells');
  assert.ok(!tileArt.PLACED_ART.platform[0].includes('.'), 'the plank spans the cell');
});

test('auto-tile: the W7a piece follows the open sides (style guide 7.1)', () => {
  const { N, E, S, W, NE, SE, SW, NW, autoTilePiece } = tileArt;
  const all = N | E | S | W | NE | SE | SW | NW;
  assert.deepEqual(autoTilePiece(all, 5), [0, 1], 'interior, variant by hash');
  assert.deepEqual(autoTilePiece(all & ~NW, 0), [6, 0], 'inner NW');
  assert.deepEqual(autoTilePiece(all & ~SE, 0), [6, 3], 'inner SE');
  assert.deepEqual(autoTilePiece(E | S | W | SE | SW, 0), [1, 0], 'top');
  assert.deepEqual(autoTilePiece(E | S | SE, 0), [1, 2], 'top-left');
  assert.deepEqual(autoTilePiece(S | W | SW, 0), [1, 3], 'top-right');
  assert.deepEqual(autoTilePiece(N | E | W, 1), [2, 1], 'bottom B');
  assert.deepEqual(autoTilePiece(N | E | S, 0), [3, 0], 'left');
  assert.deepEqual(autoTilePiece(N | W | S, 1), [3, 3], 'right B');
  assert.deepEqual(autoTilePiece(E | W, 0), [4, 0], 'ledge');
  assert.deepEqual(autoTilePiece(N | S, 0), [4, 1], 'pillar');
  assert.deepEqual(autoTilePiece(0, 1), [4, 3], 'single B');
  assert.deepEqual(autoTilePiece(S, 0), [5, 0], 'pillar top');
  assert.deepEqual(autoTilePiece(N, 0), [5, 1], 'pillar foot');
  assert.deepEqual(autoTilePiece(E, 0), [5, 2], 'ledge left');
  assert.deepEqual(autoTilePiece(W, 0), [5, 3], 'ledge right');
});

test('RND-1: an imported W7a sheet draws the piece for each cell and replaces the procedural edges; none keeps the code tile', () => {
  const renderMod = loadTs(path.resolve(__dirname, '../src/app/play/engine/terrain-render.ts'));
  const images = [];
  global.Image = class { constructor() { images.push(this); this.naturalWidth = 0; this.naturalHeight = 0; } };
  try {
    const entry = { src: 'a@1x.webp', src2x: 'a@2x.webp', size: 32, variants: 4, autotile: true };
    const r = new renderMod.TerrainRenderer(id => id === 'rock' ? entry : null);
    const t = new terrainMod.Terrain(3, 3, 0);
    const rock = terrainMod.nodeIndex('rock');
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) t.set(col, row, rock);
    t.set(1, 0, terrainMod.nodeIndex("air"));
    r.attach(t);
    const calls = [];
    const ctx = { imageSmoothingEnabled: true, globalAlpha: 1, fillStyle: '', drawImage: (...a) => calls.push(['drawImage', ...a]), fillRect: (...a) => calls.push(['fillRect', ...a]) };
    r.draw(ctx, 0, 0, 96, 96, 1);
    assert.ok(!calls.some(c => c[0] === 'drawImage'), 'not loaded yet: the procedural tile stands in');
    const image = images.find(i => i.src === 'a@2x.webp');
    assert.ok(image, 'the authored sheet is requested');
    image.naturalWidth = 256; image.naturalHeight = 448; image.onload();
    calls.length = 0;
    r.draw(ctx, 0, 0, 96, 96, 1);
    const blits = calls.filter(c => c[0] === 'drawImage');
    assert.equal(blits.length, 8, 'every rock cell from the sheet');
    // The cell under the opening at (1, 0): its top is open, so a `top` piece (row 1, 64 px cells).
    const under = blits.find(c => c[6] === 32 && c[7] === 32);
    assert.equal(under[3], 64, 'row 1 of the sheet: a top piece');
  } finally { delete global.Image; }
});

test('RND-2: parallax layers draw only once every imported layer has loaded, snapped to art pixels', () => {
  const parallaxMod = loadTs(path.resolve(__dirname, '../src/app/play/engine/parallax.ts'));
  assert.equal(parallaxMod.parallaxOffset(0, .2, 1920), 0);
  const off = parallaxMod.parallaxOffset(1001, .45, 1920);
  assert.ok(off <= 0 && off > -1920 && off % 4 === 0, 'in range, whole art pixels');
  const none = new parallaxMod.ParallaxBackdrop(() => undefined, () => null);
  assert.equal(none.draw({}, 'infernal', 0, 1280, 610, false), false, 'nothing imported: the painting stays');
  const loaded = new Map();
  const lookup = (place, layer) => place === 'infernal' && (layer === 'sky' || layer === 'far') ? { src: `${layer}.webp`, src2x: `${layer}@2.webp`, width: 1920, height: 768 } : null;
  const backdrop = new parallaxMod.ParallaxBackdrop(url => loaded.get(url), lookup);
  const draws = [];
  const ctx = { imageSmoothingEnabled: true, drawImage: (img, x, y, w, h) => draws.push([img.name, x, y, w, h]) };
  loaded.set('sky.webp', { complete: true, naturalWidth: 1920, name: 'sky' });
  assert.equal(backdrop.draw(ctx, 'infernal', 0, 1280, 610, false), false, 'one layer still loading: nothing drawn');
  loaded.set('far.webp', { complete: true, naturalWidth: 1920, name: 'far' });
  assert.equal(backdrop.draw(ctx, 'infernal', 0, 1280, 610, false), true);
  assert.deepEqual(draws.map(d => d[0]), ['sky', 'far'], 'back to front');
  assert.ok(draws.every(d => d[2] === 610 - 768), 'bottom edge on the ground line');
  assert.equal(ctx.imageSmoothingEnabled, true, 'smoothing restored');
});

test('town ground strip: a deterministic pixel texture with a lit lip over an outline', () => {
  const groundMod = loadTs(path.resolve(__dirname, '../src/app/play/engine/ground-strip.ts'));
  for (const realm of Object.keys(groundMod.GROUND_PALETTES)) {
    const px = groundMod.groundPixels(realm);
    assert.deepEqual(px, groundMod.groundPixels(realm), `${realm}: deterministic`);
    for (let x = 0; x < 16; x++) assert.ok(px[x] >= 4 && px[16 + x] === 4, `${realm}: the lip is the top two rows`);
    assert.ok(px.slice(16 * 3).every(v => v <= 3), `${realm}: stone below`);
  }
});

// ── Delve navigation (Terraria): smart cursor, held use, movement, the map ──
// docs/handoff/delve-navigation.md. Client px = world px in these fixtures (1200×720, scale 1).
const mapMod = loadTs(path.resolve(__dirname, '../src/app/play/engine/delve-map.ts'));
const at = (engine, col, row) => [col * 32 + 16 - engine.camera, 610 + row * 32 + 16 - engine.cameraY];
const frames = (engine, n) => { for (let i = 0; i < n; i++) engine.update(1 / 60); };
/** memoryDelve that also keeps the map's explored cells, the way DelveSaveService does. */
function mappedDelve(seed) {
  const delve = memoryDelve(seed);
  const bits = new Map();
  const changed = delve.changed;
  delve.changed = (id, layout, index, kind) => { const seen = delve.save.areas[id]?.seen; changed(id, layout, index, kind); if (seen) delve.save.areas[id].seen = seen; };
  delve.seenCells = (id, layout, cells) => {
    const key = `${id}|${layout}`;
    if (!bits.has(key)) bits.set(key, saveMod.decodeSeen(delve.save.areas[id]?.layout === layout ? delve.save.areas[id].seen : '', cells));
    return bits.get(key);
  };
  delve.explored = (id, layout, b) => { delve.save.areas[id] ??= { layout, cells: '' }; delve.save.areas[id].seen = saveMod.encodeSeen(b); };
  /** A reload: the next engine decodes the save again. */
  delve.forget = () => bits.clear();
  return delve;
}

test('smart cursor: aims at any cell, digs one three cells away, never one out of reach', () => {
  const events = [];
  const { engine } = enterOwnDelve(memoryDelve(61), { onWorldAction: e => { events.push(e); return true; } });
  engine.setTools({ pickaxe: 1 });
  const t = buildRoom(engine), rock = terrainMod.nodeIndex('rock');
  t.set(33, 7, rock); t.set(37, 7, rock);
  engine.aimAt(...at(engine, 33, 7));
  assert.deepEqual({ ...engine.aimCell() }, { col: 33, row: 7, index: t.index(33, 7), inReach: true }, 'three cells away is in reach');
  engine.aimAt(...at(engine, 36, 7));
  assert.equal(engine.aimCell().inReach, false, 'six cells away is not');
  engine.aimAt(...at(engine, 30, 3));
  assert.equal(engine.aimCell().inReach, true, 'four up is (reach 4.5 cells from the chest)');
  // Held on the rock three away: it breaks at the tool's pace, no walking needed.
  const x = engine.player.x;
  engine.useHold(...at(engine, 33, 7), 'dig');
  for (let n = 0; n < 120 && t.solid(33, 7); n++) engine.update(1 / 60);
  assert.equal(t.solid(33, 7), false, 'dug from three cells away');
  assert.equal(engine.useRelease(), 2, 'two swings for basalt (2 HP) at Pickaxe I');
  assert.equal(engine.player.x, x, 'the Keeper did not walk');
  assert.equal(engine.facing, 1, 'turned to the target');
  assert.deepEqual(events.map(e => e.cellKey), ['33,7']);
  // Out of reach: the hold does nothing (the click that follows walks there instead).
  engine.useHold(...at(engine, 37, 7), 'dig');
  frames(engine, 60);
  assert.equal(engine.useRelease(), 0);
  assert.equal(t.solid(37, 7), true);
  // Nothing aimed: no cursor.
  engine.clearAim();
  assert.equal(engine.aimCell(), null);
  engine.destroy();
});

test('held use: never faster than the tool pace, and pays exactly what clicks pay', () => {
  const run = (pace, mode) => {
    const events = [], times = [];
    const { engine } = enterOwnDelve(memoryDelve(62), { onWorldAction: e => { events.push(e); return true; } });
    engine.setTools(pace ? { pickaxe: 4, swing: { pickaxe: pace } } : { pickaxe: 1 });
    const t = buildRoom(engine), rock = terrainMod.nodeIndex('ember-rock');
    const original = engine.hitCell.bind(engine);
    engine.hitCell = (...args) => { times.push(engine.elapsed); return original(...args); };
    for (const row of [5, 6, 7]) setGenerated(t, 32, row, rock);
    engine.random = () => 0; // the quarter-chance Ember Residue always drops: rewards compare like for like
    for (const row of [7, 6, 5]) {
      if (mode === 'hold') {
        engine.useHold(...at(engine, 32, row), 'dig');
        for (let n = 0; n < 600 && t.solid(32, row); n++) engine.update(1 / 60);
        engine.useRelease();
      } else {
        for (let n = 0; n < 600 && t.solid(32, row); n++) { engine.strikeAt(...at(engine, 32, row)); engine.update(1 / 60); }
      }
    }
    const gaps = times.slice(1).map((time, i) => time - times[i]);
    engine.destroy();
    return { gaps, rewards: events.map(e => ({ ...e, mutationId: e.mutationId.split(':').slice(2).join(':') })) };
  };
  for (const pace of [null, 0.31]) {
    const held = run(pace, 'hold'), clicked = run(pace, 'click');
    const floor = (pace ?? 0.52) - 1e-6;
    assert.ok(held.gaps.every(gap => gap >= floor), `held swings ${held.gaps.map(g => g.toFixed(3))} never beat ${pace ?? 0.52}`);
    assert.deepEqual(held.rewards, clicked.rewards, 'the same three breaks, the same pay, the same mutation ids');
    assert.equal(held.rewards.length, 3);
  }
  // A long hold on rock that grows back: swings fit the pace, ~10 s / 0.52 s.
  const { engine } = enterOwnDelve(memoryDelve(66), { onWorldAction: () => true });
  engine.setTools({ pickaxe: 1 });
  const t = buildRoom(engine), rock = terrainMod.nodeIndex('rock');
  let swings = 0;
  const original = engine.hitCell.bind(engine);
  engine.hitCell = (...args) => { swings++; return original(...args); };
  t.set(32, 7, rock);
  engine.useHold(...at(engine, 32, 7), 'dig');
  for (let n = 0; n < 600; n++) { engine.update(1 / 60); if (!t.solid(32, 7)) t.set(32, 7, rock); }
  assert.ok(swings <= Math.ceil(10 / 0.52) + 1 && swings >= Math.floor(10 / 0.52) - 1, `${swings} swings in 10 s`);
  engine.destroy();
});

test('held place: a drag lays one block per cell crossed, at a steady pace, while there are some left and in reach', () => {
  const placed = [];
  let left = 10;
  const { engine } = enterOwnDelve(memoryDelve(63), { onPlace: e => { if (left <= 0) return false; left--; placed.push({ cell: e.cellKey, at: engine.elapsed }); return true; } });
  const t = buildRoom(engine);
  for (let col = 31; col <= 36; col++) t.set(col, 9, 0); // a trench in the floor ahead
  engine.setPlaceable('dirt-block');
  engine.useHold(...at(engine, 31, 9), 'place');
  assert.equal(t.nodeAt(31, 9).id, 'packed-dirt', 'the pressed cell, at once');
  engine.aimAt(...at(engine, 36, 9)); // one fast drag across the trench
  frames(engine, 120);
  assert.deepEqual(placed.map(p => p.cell), ['31,9', '32,9', '33,9', '34,9'], 'every cell crossed, in order; 35 and 36 are out of reach');
  const gaps = placed.slice(1).map((p, i) => p.at - placed[i].at);
  assert.ok(gaps.every(gap => gap >= 0.25 - 1e-6), `one block per 0.25 s at most: ${gaps}`);
  assert.equal(engine.useRelease(), 4);
  // The count is respected: two left, two placed, then the hold ends.
  left = 2; placed.length = 0;
  for (let col = 31; col <= 34; col++) t.set(col, 9, 0);
  engine.useHold(...at(engine, 31, 9), 'place');
  engine.aimAt(...at(engine, 34, 9));
  frames(engine, 120);
  assert.deepEqual(placed.map(p => p.cell), ['31,9', '32,9']);
  assert.equal(t.nodeAt(33, 9).id, 'air');
  engine.useRelease();
  // A place press on a placed thing takes it back, once.
  const taken = [];
  engine.options.onTakeBack = e => { taken.push(e.cellKey); return true; };
  assert.equal(engine.placeCell(28, 8, 'torch'), true);
  engine.useHold(...at(engine, 28, 8), 'place');
  frames(engine, 30);
  assert.equal(engine.useRelease(), 1);
  assert.deepEqual(taken, ['28,8']);
  assert.equal(t.nodeAt(28, 8).id, 'air');
  engine.destroy();
});

test('movement: auto-step up a one-cell ledge while walking; a two-cell wall still stops', () => {
  const { engine } = enterOwnDelve(memoryDelve(64));
  const t = buildRoom(engine), rock = terrainMod.nodeIndex('rock');
  t.set(32, 8, rock); t.set(33, 8, rock);
  engine.input.add('right');
  for (let n = 0; n < 90 && engine.player.x < 32 * 32 + 16; n++) engine.update(1 / 60);
  assert.equal(engine.player.y, 610 + 8 * 32, 'stepped up, no jump pressed');
  assert.ok(engine.player.x >= 32 * 32 + 16);
  engine.input.delete('right');
  engine.player.x = 30 * 32 + 16; engine.player.y = 610 + 9 * 32; engine.player.vy = 0;
  t.set(32, 8, 0); t.set(33, 8, 0);
  t.set(31, 8, rock); t.set(31, 7, rock);
  engine.input.add('right');
  frames(engine, 60);
  engine.input.delete('right');
  assert.ok(engine.player.x <= 31 * 32 - 13 + 1e-6, 'the wall holds');
  assert.equal(engine.player.y, 610 + 9 * 32);
  engine.destroy();
});

test('movement: Down + Jump drops through a platform; a jump from below passes up through one', () => {
  const { engine } = enterOwnDelve(memoryDelve(67));
  const t = buildRoom(engine);
  for (let row = 9; row <= 11; row++) t.set(31, row, 0);
  t.set(31, 9, terrainMod.nodeIndex('platform'));
  engine.player.x = 31 * 32 + 16;
  frames(engine, 30);
  assert.equal(engine.player.y, 610 + 9 * 32, 'standing on the platform');
  engine.setInput('down', true); engine.setInput('jump', true);
  engine.setInput('jump', false); engine.setInput('down', false);
  assert.ok(engine.player.vy >= 0, 'no hop');
  frames(engine, 40);
  assert.equal(engine.player.y, 610 + 12 * 32, 'dropped to the bottom of the pit');
  // From below: a platform two cells over the floor is jumped through and landed on.
  engine.player.x = 28 * 32 + 16; engine.player.y = 610 + 9 * 32; engine.player.vy = 0;
  t.set(28, 7, terrainMod.nodeIndex('platform'));
  frames(engine, 5);
  engine.setInput('jump', true); engine.setInput('jump', false);
  frames(engine, 60);
  assert.equal(engine.player.y, 610 + 7 * 32, 'up through it and onto it');
  assert.equal(engine.player.grounded, true);
  engine.destroy();
});

test('ladders: Up beside one grabs it, and the climb is brisk', () => {
  const { engine } = enterOwnDelve(memoryDelve(68));
  const t = buildRoom(engine), ladder = terrainMod.nodeIndex('ladder');
  for (let row = 6; row <= 8; row++) t.set(31, row, ladder);
  engine.player.x = 31 * 32 - 6; // the body overlaps the ladder's column, its centre does not
  frames(engine, 5);
  assert.equal(terrainMod.onLadder(t, engine.player.x, engine.player.y, { halfWidth: 13, height: 90 }), false);
  engine.setInput('jump', true);
  assert.equal(engine.player.x, 31 * 32 + 16, 'stepped onto the ladder');
  assert.ok(engine.player.vy >= 0, 'grabbed, not jumped');
  const y0 = engine.player.y;
  frames(engine, 15);
  assert.ok(Math.abs((y0 - engine.player.y) - terrainMod.CLIMB_SPEED * .25) < 1, `climbed ${y0 - engine.player.y}px in 0.25 s`);
  assert.ok(terrainMod.CLIMB_SPEED >= 200, 'brisker than walking (191 px/s in a delve)');
  frames(engine, 60);
  engine.setInput('jump', false);
  frames(engine, 5);
  assert.equal(engine.player.y, 610 + 6 * 32, 'up and standing on the top rung');
  engine.destroy();
});

test('jumps: coyote time after walking off a ledge, and a press just before landing is kept', () => {
  const { engine } = enterOwnDelve(memoryDelve(69));
  const t = buildRoom(engine);
  for (let col = 31; col <= 40; col++) for (let row = 9; row <= 11; row++) t.set(col, row, 0);
  const offLedge = () => {
    engine.player.x = 30 * 32 + 16; engine.player.y = 610 + 9 * 32; engine.player.vy = 0; engine.player.grounded = true;
    frames(engine, 3);
    engine.input.add('right');
    let n = 0;
    while (engine.player.grounded && n++ < 120) engine.update(1 / 60);
    engine.input.delete('right');
  };
  offLedge();
  frames(engine, 4); // 0.067 s in the air
  engine.setInput('jump', true); engine.setInput('jump', false);
  assert.ok(engine.player.vy < 0, 'a late jump still counts');
  frames(engine, 90);
  offLedge();
  frames(engine, 12); // 0.2 s: too late
  engine.setInput('jump', true); engine.setInput('jump', false);
  assert.ok(engine.player.vy > 0, 'past the coyote window there is no air jump');
  frames(engine, 90);
  // Buffer: a press 0.05 s before landing jumps on landing; one 0.25 s early does not.
  const fallAndPress = height => {
    engine.player.x = 26 * 32 + 16; engine.player.y = 610 + 9 * 32 - 120; engine.player.vy = 0; engine.player.grounded = false;
    frames(engine, 8);
    let n = 0;
    while (610 + 9 * 32 - engine.player.y > height && n++ < 120) engine.update(1 / 60);
    engine.setInput('jump', true); engine.setInput('jump', false);
    let jumped = false;
    for (let i = 0; i < 30; i++) { engine.update(1 / 60); if (engine.player.vy < 0) jumped = true; }
    frames(engine, 60);
    return jumped;
  };
  assert.equal(fallAndPress(25), true, 'pressed just before landing: jumps on landing');
  assert.equal(fallAndPress(95), false, 'pressed long before: nothing');
  engine.destroy();
});

test('the map: fog of war is revealed round the Keeper, saved compactly with the delve, and survives a reload', () => {
  const delve = mappedDelve(65);
  const { engine } = enterOwnDelve(delve);
  const t = buildRoom(engine);
  engine.update(1 / 60);
  const source = engine.mapSource();
  assert.ok(source && source.t === t);
  assert.deepEqual({ ...source.keeper }, { col: 30, row: 7 });
  assert.equal(mapMod.isSeen(source.fog, t.index(30, 7)), true);
  assert.equal(mapMod.isSeen(source.fog, t.index(36, 7)), true, 'six cells round');
  assert.equal(mapMod.isSeen(source.fog, t.index(80, 40)), false, 'not the far side of the Delve');
  assert.deepEqual([...source.shafts], [3], 'the way back up');
  const seen = mapMod.seenCount(source.fog);
  // Walking reveals more; standing still never rewrites the save.
  let writes = 0; const explored = delve.explored;
  delve.explored = (...args) => { writes++; explored(...args); };
  frames(engine, 30);
  assert.equal(writes, 0, 'no new cell, no write');
  engine.input.add('right'); frames(engine, 60); engine.input.delete('right');
  assert.ok(writes > 0 && mapMod.seenCount(source.fog) > seen);
  const after = mapMod.seenCount(source.fog);
  const encoded = delve.save.areas['ember-delve'].seen;
  assert.ok(encoded.length < 600, `compact: ${encoded.length} chars for ${after} cells`);
  // Reload: the same explored cells, decoded from the save.
  engine.destroy(); delve.forget();
  const again = enterOwnDelve(delve);
  const back = again.engine.mapSource();
  assert.equal(mapMod.seenCount(back.fog), after);
  assert.equal(mapMod.isSeen(back.fog, t.index(30, 7)), true);
  again.engine.destroy();
});

test('the map: seen bits encode per 64-cell block, merge as a union, and draw only what was explored', () => {
  const bits = mapMod.createFog(6720);
  bits.fill(255, 0, 16); bits[20] = 0b101;
  const encoded = saveMod.encodeSeen(bits);
  assert.equal(encoded, '0,1,2.0000000005000000', 'whole blocks are one number');
  assert.deepEqual(Array.from(saveMod.decodeSeen(encoded, 6720)), Array.from(bits));
  assert.equal(saveMod.decodeSeen('zz9.nothex,-1,999999', 6720).every(b => b === 0), true, 'junk is skipped');
  // Merge: either device's exploring counts.
  const a = saveMod.newDelveSave(5, 1), b = saveMod.newDelveSave(5, 1);
  a.areas['ember-delve'] = { layout: 'L', cells: '', seen: '0' };
  b.areas['ember-delve'] = { layout: 'L', cells: '', seen: '1.ff00000000000000' };
  const merged = saveMod.mergeDelveSaves(a, b);
  assert.equal(merged.areas['ember-delve'].seen, '0,1.ff00000000000000');
  assert.equal(saveMod.coerceDelveSave(JSON.parse(JSON.stringify(merged))).areas['ember-delve'].seen, '0,1.ff00000000000000');
  // The picture: unexplored is fog, explored rock is its colour, a cavern the cave tone.
  const t = terrainMod.generateTerrain(delveSpec, 7);
  const fog = mapMod.createFog(t.kind.length);
  mapMod.revealAround(t, fog, 30, 7, 3);
  const data = new Uint8ClampedArray(t.kind.length * 4);
  mapMod.paintMap(t, fog, data);
  const px = (col, row) => Array.from(data.slice(t.index(col, row) * 4, t.index(col, row) * 4 + 4));
  assert.deepEqual(px(80, 40), [20, 10, 31, 255], 'fog');
  assert.notDeepEqual(px(30, 7), [20, 10, 31, 255]);
  // Markers: only explored ones, plus the shafts and the Keeper.
  t.set(31, 7, terrainMod.nodeIndex('camp')); t.set(90, 30, terrainMod.nodeIndex('chest'));
  const kinds = mapMod.mapMarkers(t, fog, { col: 30, row: 7 }, [3]).map(m => m.kind);
  assert.deepEqual(kinds, ['inscription', 'camp', 'shaft', 'keeper'], 'the carving at 28,7 and the camp; the unexplored chest is not shown');
});

test('the map: the way to camp follows explored open cells, or says there is none', () => {
  const t = terrainMod.generateTerrain(delveSpec, 7);
  const rock = terrainMod.nodeIndex('rock');
  for (let row = 0; row < 12; row++) for (let col = 16; col < 46; col++) t.set(col, row, rock);
  for (let col = 20; col <= 40; col++) t.set(col, 7, 0); // a corridor
  for (let row = 3; row <= 7; row++) t.set(40, row, 0);   // and a shaft up at its end
  const fog = mapMod.createFog(t.kind.length);
  fog.fill(255);
  const path = mapMod.pathThrough(t, fog, t.index(20, 7), t.index(40, 3));
  assert.equal(path.length - 1, 20 + 4, 'along the corridor, then up');
  assert.equal(path[0], t.index(20, 7)); assert.equal(path.at(-1), t.index(40, 3));
  // A cell of the corridor never explored: no known way.
  fog.fill(0); mapMod.revealAround(t, fog, 20, 7, 8); mapMod.revealAround(t, fog, 40, 3, 8);
  assert.equal(mapMod.pathThrough(t, fog, t.index(20, 7), t.index(40, 3)), null);
});

// ── Liquids (Phase 6.1/6.2): flow, reactions, saves, swimming ─────────────────
const liquidMod = loadTs(path.resolve(__dirname, '../src/app/play/engine/liquids.ts'));
const { LIQUID_WATER: WATER, LIQUID_LAVA: LAVA } = terrainMod;
/** A sealed box of bedrock with an open room: cols 1..w, rows 1..h. */
function liquidRoom(w = 12, h = 8) {
  const t = new terrainMod.Terrain(w + 2, h + 2, 0);
  const bedrock = terrainMod.nodeIndex('bedrock');
  for (let row = 0; row < h + 2; row++) for (let col = 0; col < w + 2; col++) {
    if (row === 0 || col === 0 || row === h + 1 || col === w + 1) t.set(col, row, bedrock);
  }
  return t;
}
function runTicks(sim, n) { for (let i = 0; i < n; i++) sim.tick(); }

test('liquids: water falls and spreads to rest, the same way every time, and conserves its volume', () => {
  const states = [];
  for (const chunk of [1 / 60, .05, .1]) {
    const t = liquidRoom();
    const sim = new liquidMod.LiquidSim(t);
    // A full column of water in the air at one side.
    for (let row = 1; row <= 4; row++) { t.liqType[t.index(2, row)] = WATER; t.liqLevel[t.index(2, row)] = 8; sim.wake(t.index(2, row)); }
    const volume = sim.volume(WATER);
    assert.equal(volume, 32);
    // 12 s of game time in different frame chunks: the same number of 10 Hz ticks.
    let ran = 0;
    for (let time = 0; time < 12 - 1e-9; time += chunk) ran += sim.step(chunk);
    assert.ok(Math.abs(ran - 120) <= 1, `${ran} ticks in 12 s`);
    runTicks(sim, 120 - ran);
    assert.equal(sim.volume(WATER), volume, 'nothing appears or vanishes while it flows');
    assert.equal(sim.settled, true, 'and then it sleeps');
    // Nothing floats: every wet cell sits on rock or on a full cell of water.
    for (let row = 1; row <= 7; row++) for (let col = 1; col <= 12; col++) {
      if (!t.levelAt(col, row)) continue;
      assert.ok(t.solid(col, row + 1) || t.levelAt(col, row + 1) === 8, `water at ${col},${row} rests on something`);
    }
    // The floor took it: no step of more than 2 between neighbours (the spread rule's rest).
    for (let col = 1; col < 12; col++) assert.ok(Math.abs(t.levelAt(col, 8) - t.levelAt(col + 1, 8)) <= 2);
    states.push(Array.from(t.liqLevel).join(','));
  }
  assert.equal(new Set(states).size, 1, 'deterministic: the same water whatever the frame rate');
});

test('liquids: a settled pool sleeps, a dig beside it wakes it, and it drains into the new hole', () => {
  const t = liquidRoom(10, 6);
  const rock = terrainMod.nodeIndex('rock');
  // A basin: rock floor at row 6 except one cell that will be dug.
  for (let col = 1; col <= 10; col++) t.set(col, 6, rock);
  for (let col = 3; col <= 6; col++) { t.liqType[t.index(col, 5)] = WATER; t.liqLevel[t.index(col, 5)] = 8; }
  for (const col of [2, 7]) t.set(col, 5, rock);
  const sim = new liquidMod.LiquidSim(t);
  sim.wakeAll(); runTicks(sim, 5);
  assert.equal(sim.settled, true, 'held in its basin, it settles at once');
  const before = Array.from(t.liqLevel);
  runTicks(sim, 50);
  assert.deepEqual(Array.from(t.liqLevel), before, 'asleep: nothing moves');
  assert.equal(sim.updates, 0, 'and no cell is even looked at');
  // Dig the basin floor under the middle: the 3x3 wakes and the water pours down.
  t.set(4, 6, 0); sim.wakeAround(4, 6);
  runTicks(sim, 80);
  assert.equal(sim.volume(WATER), 32, 'conserved through the drain');
  assert.ok(t.levelAt(4, 6) > 0, 'water ran down into the hole');
});

test('liquids: water meets lava and the smaller volume sets into obsidian; a made cell pays its block only', () => {
  const t = liquidRoom(6, 4);
  const sim = new liquidMod.LiquidSim(t, {});
  // Lava pool on the floor, water dropped on it.
  t.liqType[t.index(3, 4)] = LAVA; t.liqLevel[t.index(3, 4)] = 4;
  t.liqType[t.index(3, 3)] = WATER; t.liqLevel[t.index(3, 3)] = 8;
  sim.wake(t.index(3, 3)); sim.wake(t.index(3, 4));
  runTicks(sim, 3);
  assert.equal(t.nodeAt(3, 4).id, 'obsidian', 'the lava (4) was smaller than the water (8): it set');
  assert.equal(sim.volume(LAVA), 0);
  assert.equal(sim.volume(WATER), 4, 'the water lost the lava\'s volume');
  assert.equal(sim.urgent, true, 'a reaction is saved at once, not at the next settle');
  // Through the engine: the made cell breaks into its block, with no XP and no yield (farm-proof).
  const events = [];
  const { engine } = enterDelve(e => { events.push(e); return true; });
  engine.setTools({ pickaxe: 1 });
  const d = engine.terrain;
  d.set(12, 0, terrainMod.nodeIndex('obsidian'));
  engine.player.x = 12 * 32 - 30; engine.player.y = 610; engine.facing = 1;
  for (let n = 0; n < 10 && d.solid(12, 0); n++) { engine.attackCooldown = 0; engine.strikeCell(12 * 32 + 16, 626); }
  assert.equal(d.solid(12, 0), false);
  assert.equal(events.length, 1);
  assert.equal(events[0].xp, 0, 'no XP from a reaction\'s cell');
  assert.equal(events[0].materialId, undefined, 'no yield');
  assert.equal(events[0].block, 'obsidian-block', 'only the block');
  engine.destroy();
});

test('liquids: the core\'s lakes sit only in carved air, at rest, for every seed (no cell changes, no version bump)', () => {
  assert.equal(delveSpec.version, 2, 'the cells did not change');
  for (const seed of [delveSpec.seed, 424242, 7, 0xabcdef]) {
    const t = terrainMod.generateTerrain(delveSpec, seed);
    let wet = 0;
    for (let i = 0; i < t.kind.length; i++) {
      if (!t.liqLevel[i]) continue;
      wet++;
      assert.equal(terrainMod.TERRAIN_NODE_LIST[t.kind[i]].solid, false, `liquid only in open cells (${i})`);
    }
    assert.ok(wet >= 60, `the Mere, the seep, the flooded seam, the lamp's alcove and two lava pools (${wet} cells)`);
    assert.equal(t.liquidAt(30, 34), WATER, 'the Grotto Mere');
    assert.equal(t.liquidAt(33, 48), LAVA, 'a Magma Halls pool');
    assert.equal(t.liquidAt(87, 36), WATER, 'the drowned lamp\'s carving is under water');
    const sim = new liquidMod.LiquidSim(t);
    sim.wakeAll();
    const water = sim.volume(WATER), lava = sim.volume(LAVA);
    runTicks(sim, 30);
    assert.equal(sim.settled, true, `seed ${seed}: every lake is at rest as generated`);
    assert.deepEqual(Array.from(t.liqLevel), Array.from(t.baseLiqLevel), 'nothing moved');
    assert.equal(sim.volume(WATER), water); assert.equal(sim.volume(LAVA), lava);
  }
});

test('liquids: the settled diff round-trips through the save, merges per cell, and a new liquid version drops it', () => {
  const t = terrainMod.generateTerrain(delveSpec, 5);
  const sim = new liquidMod.LiquidSim(t);
  // Scoop a bucket from the Mere: the diff is exactly what changed.
  assert.equal(sim.scoop(t.index(30, 33)), WATER);
  const diff = terrainMod.liquidDiff(t);
  assert.ok(diff.size >= 1);
  const save = saveMod.newDelveSave(5, 1);
  const wet = terrainMod.liquidLayout(delveSpec, 5);
  save.areas['ember-delve'] = { layout: terrainMod.terrainLayout(delveSpec, 5), cells: '', wet, liquids: saveMod.encodeCells(diff) };
  const back = saveMod.coerceDelveSave(JSON.parse(JSON.stringify(save)));
  const fresh = terrainMod.generateTerrain(delveSpec, 5);
  terrainMod.applyLiquidDiff(fresh, saveMod.liquidsFor(back, 'ember-delve', wet));
  assert.deepEqual(Array.from(fresh.liqLevel), Array.from(t.liqLevel), 'the same water after a reload');
  assert.equal(saveMod.liquidsFor(back, 'ember-delve', `${wet}x`).size, 0, 'another liquid layout: dropped');
  // Merge: same layout, a per-cell union, local winning.
  const other = JSON.parse(JSON.stringify(save));
  const scooped = [...diff.keys()][0];
  other.areas['ember-delve'].liquids = saveMod.encodeCells(new Map([[1, 0x18], [scooped, 0x14]]));
  const merged = saveMod.mergeDelveSaves(other, save);
  const cells = saveMod.liquidsFor(saveMod.coerceDelveSave(merged), 'ember-delve', wet);
  assert.equal(cells.get(1), 0x18, 'the other device\'s cell kept');
  assert.equal(cells.get(scooped), diff.get(scooped), 'local wins a disagreeing cell');
  // A liquid diff never lands in rock: a cell dug full of a block since is skipped.
  const blocked = terrainMod.generateTerrain(delveSpec, 5);
  blocked.set(30, 33, terrainMod.nodeIndex('basalt-block'));
  terrainMod.applyLiquidDiff(blocked, new Map([[blocked.index(30, 33), 0x18]]));
  assert.equal(blocked.levelAt(30, 33), 0);
});

test('liquids: buckets scoop a full cell and pour it back; water poured on lava makes obsidian', () => {
  const t = liquidRoom(8, 4);
  const sim = new liquidMod.LiquidSim(t);
  for (let col = 1; col <= 4; col++) { t.liqType[t.index(col, 4)] = WATER; t.liqLevel[t.index(col, 4)] = 3; }
  // 12 joined levels: enough for one full bucket, taken evenly from the pool.
  assert.equal(sim.scoop(t.index(1, 4), true), WATER, 'a dry run only checks');
  assert.equal(sim.volume(WATER), 12);
  assert.equal(sim.scoop(t.index(1, 4)), WATER);
  assert.equal(sim.volume(WATER), 4);
  assert.equal(sim.scoop(t.index(1, 4)), 0, 'too shallow for another');
  // Pour onto lava: that cell sets.
  t.liqType[t.index(7, 4)] = LAVA; t.liqLevel[t.index(7, 4)] = 5;
  assert.equal(sim.pour(t.index(7, 4), WATER), true);
  assert.equal(t.nodeAt(7, 4).id, 'obsidian');
  assert.equal(t.levelAt(7, 3), 3, 'the rest of the pour lands on top');
  assert.equal(sim.pour(t.index(0, 0), WATER), false, 'never into rock');
});

test('liquids: the Keeper wades and swims, holds a breath that runs out, and lava burns unless warded', () => {
  const { engine, state } = enterDelve(() => true);
  const t = engine.terrain;
  // A pool round the Keeper: open cells, water three deep, on the surface ledge.
  const col = 20;
  for (let row = 0; row <= 4; row++) for (let c = col - 3; c <= col + 3; c++) t.set(c, row, 0);
  for (let c = col - 3; c <= col + 3; c++) t.set(c, 5, terrainMod.nodeIndex('bedrock'));
  for (let row = 2; row <= 4; row++) for (let c = col - 3; c <= col + 3; c++) { t.liqType[t.index(c, row)] = WATER; t.liqLevel[t.index(c, row)] = 8; }
  engine.liquid = new liquidMod.LiquidSim(t);
  engine.player.x = col * 32 + 16; engine.player.y = t.top + 5 * 32; engine.player.vy = 0;
  engine.update(1 / 60);
  assert.equal(state().liquid.in, 'water');
  // Walking through water is slower.
  engine.setInput('right', true);
  const x0 = engine.player.x; for (let n = 0; n < 6; n++) engine.update(1 / 60);
  engine.setInput('right', false);
  const waded = engine.player.x - x0;
  assert.ok(waded > 0 && waded < 265 * .72 * .7 * .1, `wading is slower (${waded.toFixed(1)} px in 0.1 s)`);
  // Head under water: the breath runs down; out of breath, it hurts.
  engine.player.x = col * 32 + 16; engine.player.y = t.top + 5 * 32;
  const hp0 = engine.hp;
  for (let n = 0; n < 60 * 4; n++) { engine.player.y = t.top + 5 * 32; engine.update(1 / 60); }
  assert.ok(state().liquid.breath < .55 && state().liquid.breath > .4, `half a breath after 4 s (${state().liquid.breath})`);
  assert.equal(engine.hp, hp0, 'no harm while there is breath');
  for (let n = 0; n < 60 * 6; n++) { engine.player.y = t.top + 5 * 32; engine.update(1 / 60); }
  assert.ok(engine.hp < hp0, 'drowning hurts');
  // Jump held swims up.
  engine.hp = engine.maxHp; engine.player.y = t.top + 5 * 32; engine.player.vy = 0;
  engine.setInput('jump', true);
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  engine.setInput('jump', false);
  assert.ok(engine.player.y < t.top + 5 * 32 - 20, 'rose through the water');
  // Lava burns; an Ember Elixir's ward holds it off for a while.
  for (let row = 2; row <= 4; row++) for (let c = col - 3; c <= col + 3; c++) t.liqType[t.index(c, row)] = LAVA;
  engine.hp = engine.maxHp; engine.player.y = t.top + 5 * 32; engine.player.vy = 0;
  engine.setWards({ lavaWard: 10 });
  for (let n = 0; n < 60; n++) { engine.player.y = t.top + 5 * 32; engine.update(1 / 60); }
  assert.equal(engine.hp, engine.maxHp, 'warded: one second in lava costs nothing');
  engine.setWards({});
  for (let n = 0; n < 60; n++) { engine.player.y = t.top + 5 * 32; engine.update(1 / 60); }
  assert.ok(engine.hp <= engine.maxHp * (1 - .14), `about 15% a second in lava (${engine.hp})`);
  assert.equal(state().liquid.burning, true);
  engine.destroy();
});

test('liquids: lava chars a wooden placed thing back into the satchel; a refused chest holds the lava back', () => {
  const taken = [];
  let refuse = false;
  const { engine } = enterDelve(() => true);
  engine.options.onTakeBack = e => { if (refuse) return false; taken.push(e); return true; };
  const t = engine.terrain;
  const col = 30, row = 3;
  for (let c = col - 2; c <= col + 2; c++) { t.set(c, row, 0); t.set(c, row + 1, terrainMod.nodeIndex('bedrock')); }
  t.set(col + 1, row, terrainMod.nodeIndex('torch'));
  t.liqType[t.index(col, row)] = LAVA; t.liqLevel[t.index(col, row)] = 6;
  engine.liquid = new liquidMod.LiquidSim(t, { char: i => { if (!engine.chars.has(i)) engine.chars.set(i, 3); } });
  engine.liquid.wake(t.index(col, row));
  engine.player.x = 200; engine.player.y = 610;
  for (let n = 0; n < 60 * 4; n++) engine.update(1 / 60);
  assert.equal(taken.length, 1, 'charred once, after 3 s');
  assert.equal(taken[0].item, 'torch');
  assert.ok(taken[0].mutationId.startsWith('delve-char:'));
  assert.equal(t.nodeAt(col + 1, row).id, 'air');
  for (let n = 0; n < 60 * 2; n++) engine.update(1 / 60);
  assert.ok(t.levelAt(col + 1, row) > 0, 'the lava flows on where it stood');
  // A chest the host will not take (it holds things): lava waits beside it, for good.
  refuse = true; taken.length = 0;
  t.liqLevel[t.index(col - 1, row)] = 0; t.liqType[t.index(col - 1, row)] = 0;
  t.set(col - 1, row, terrainMod.nodeIndex('chest'));
  for (let n = 0; n < 60 * 8; n++) engine.update(1 / 60);
  assert.equal(t.nodeAt(col - 1, row).id, 'chest');
  assert.equal(t.levelAt(col - 1, row), 0, 'never inside it');
  engine.destroy();
});

test('liquids: a parked (paused) loop runs no ticks, and resumes to exactly the continuous result', () => {
  const make = () => {
    const { engine } = enterDelve(() => true);
    const t = engine.terrain;
    for (let c = 40; c <= 50; c++) { t.set(c, 2, 0); t.set(c, 3, terrainMod.nodeIndex('bedrock')); }
    for (let c = 40; c <= 41; c++) { t.liqType[t.index(c, 2)] = WATER; t.liqLevel[t.index(c, 2)] = 8; }
    engine.liquid = new liquidMod.LiquidSim(t); engine.liquid.wakeAll();
    engine.player.x = 200; engine.player.y = 610;
    return engine;
  };
  const steady = make(), parked = make();
  for (let n = 0; n < 120; n++) steady.update(1 / 60);
  for (let n = 0; n < 60; n++) parked.update(1 / 60);
  const ticksBefore = parked.liquid.ticks;
  parked.setPaused(true);
  parked.render = () => {};
  for (let at = 1000; at < 6000; at += 16) parked.tick(at);
  assert.equal(parked.liquid.ticks, ticksBefore, 'no liquid time passes while parked');
  parked.setPaused(false);
  for (let n = 0; n < 60; n++) parked.update(1 / 60);
  assert.equal(parked.liquid.ticks, steady.liquid.ticks);
  assert.deepEqual(Array.from(parked.terrain.liqLevel), Array.from(steady.terrain.liqLevel), 'the same water as never parked');
  steady.destroy(); parked.destroy();
});

test('liquids: the tick budget caps cell updates, and a big flood still ends', () => {
  const t = liquidRoom(60, 12);
  const sim = new liquidMod.LiquidSim(t);
  for (let row = 1; row <= 8; row++) for (let col = 1; col <= 40; col++) { t.liqType[t.index(col, row)] = WATER; t.liqLevel[t.index(col, row)] = 8; sim.wake(t.index(col, row)); }
  let most = 0;
  for (let n = 0; n < 2000 && !sim.settled; n++) { sim.tick(); most = Math.max(most, sim.updates); }
  assert.ok(most <= liquidMod.TICK_BUDGET, `at most ${liquidMod.TICK_BUDGET} cells a tick (${most})`);
  assert.equal(sim.settled, true);
  assert.equal(sim.volume(WATER), 40 * 8 * 8);
});

// ── Fishing in the engine (Phase 6.3): cast, bite, hook, the host lands it ────
/** The Keeper on the Grotto Mere's west shore (the glowcap cavern), facing the water. */
function atTheMere(extra = {}) {
  const fished = [];
  const { engine, state } = enterDelve(() => true);
  engine.options.onFish = e => fished.push(e);
  Object.assign(engine.options, extra);
  const t = engine.terrain;
  // Stand on the cavern floor beside the lake: open the west wall so there is a shore.
  for (let row = 30; row <= 34; row++) for (let col = 16; col <= 19; col++) t.set(col, row, 0);
  for (let col = 16; col <= 19; col++) t.set(col, 35, terrainMod.nodeIndex('bedrock'));
  for (let row = 33; row <= 34; row++) for (let col = 16; col <= 19; col++) { t.liqType[t.index(col, row)] = 0; t.liqLevel[t.index(col, row)] = 0; }
  // A sill keeps the Mere where it is.
  t.set(19, 34, terrainMod.nodeIndex('bedrock')); t.set(19, 33, terrainMod.nodeIndex('bedrock'));
  engine.liquid = new liquidMod.LiquidSim(t);
  engine.player.x = 17 * 32 + 16; engine.player.y = t.top + 33 * 32; engine.player.vy = 0; engine.facing = 1;
  engine.update(1 / 60);
  return { engine, state, fished, t };
}

test('fishing: no rod, no cast; a rod casts at the water within six cells, and the HUD offers "Fish"', () => {
  const { engine, state } = atTheMere();
  engine.cast();
  assert.equal(state().fishing, null);
  assert.equal(state().messageKey, 'play.fish.noRod');
  engine.setFishing({ tier: 1, liquids: ['water'] });
  engine.update(1 / 60);
  assert.equal(state().canFish, 'water', 'the prompt can offer Fish here');
  assert.equal(engine.cast(), true);
  assert.equal(state().fishing.phase, 'wait');
  assert.equal(state().fishing.liquid, 'water');
  // Facing away from the lake: nothing to cast at.
  engine.reelIn(true); engine.facing = -1;
  assert.equal(engine.cast(), false);
  assert.equal(state().messageKey, 'play.fish.noWater');
  engine.destroy();
});

test('fishing: the bite comes in 3-9 s (faster with bite speed), a hook in the 0.6 s dip hands the fish to the host, a miss nibbles again', () => {
  for (const bite of [1, 2]) {
    const { engine, state, fished } = atTheMere();
    engine.random = () => .5;
    engine.setFishing({ tier: 1, liquids: ['water'], bite });
    assert.equal(engine.cast(), true);
    let t = 0;
    while (state().fishing.phase === 'wait' && t < 20) { engine.update(1 / 60); t += 1 / 60; }
    assert.ok(Math.abs(t - 6 / bite) < .05, `bite after ${t.toFixed(2)} s at bite speed ${bite}`);
    // Let the dip pass: nothing lost, it nibbles again.
    for (let n = 0; n < 40; n++) engine.update(1 / 60);
    assert.equal(state().fishing.phase, 'wait');
    assert.equal(fished.length, 0);
    while (state().fishing.phase === 'wait') engine.update(1 / 60);
    engine.interact(); // E during the dip
    assert.equal(state().fishing.phase, 'hooked');
    assert.equal(fished.length, 1);
    assert.equal(fished[0].biome, 'glowcap-grotto');
    assert.equal(fished[0].liquid, 'water');
    assert.equal(fished[0].auto, false);
    assert.ok(fished[0].castId.startsWith('fish:'));
    // Reeling holds the Keeper still: walking does nothing until the host lands it.
    const x = engine.player.x;
    engine.setInput('right', true); for (let n = 0; n < 20; n++) engine.update(1 / 60); engine.setInput('right', false);
    assert.equal(engine.player.x, x);
    engine.landFish();
    assert.equal(state().fishing, null);
    engine.destroy();
  }
});

test('fishing: holding Use is auto-fish (hooked at once at the Off grade, recast after landing); walking reels the line in', () => {
  const { engine, state, fished } = atTheMere();
  engine.random = () => 0;
  engine.setFishing({ tier: 1, liquids: ['water'] });
  engine.setUseHeld(true);
  engine.cast();
  for (let n = 0; n < 60 * 4 && !fished.length; n++) engine.update(1 / 60);
  assert.equal(fished.length, 1);
  assert.equal(fished[0].auto, true);
  engine.landFish();
  for (let n = 0; n < 60; n++) engine.update(1 / 60);
  assert.equal(state().fishing?.phase, 'wait', 'recast while Use is held');
  engine.setUseHeld(false);
  engine.setInput('left', true); engine.update(1 / 60); engine.setInput('left', false);
  assert.equal(state().fishing, null, 'walking pulls the line out');
  engine.destroy();
});

test('fishing: a Worn Rod cannot fish lava; a Seam Rod can, and the water drained from under the bob takes the line', () => {
  const { engine, state, t } = atTheMere();
  for (let row = 33; row <= 34; row++) for (let col = 20; col <= 44; col++) if (t.liqLevel[t.index(col, row)]) t.liqType[t.index(col, row)] = terrainMod.LIQUID_LAVA;
  engine.setFishing({ tier: 1, liquids: ['water'] });
  assert.equal(engine.cast(), false);
  engine.setFishing({ tier: 2, liquids: ['water', 'lava'] });
  assert.equal(engine.cast(), true);
  assert.equal(state().fishing.liquid, 'lava');
  const line = engine.line;
  t.liqLevel[t.index(line.col, line.row)] = 0;
  engine.update(1 / 60);
  assert.equal(state().fishing, null);
  assert.equal(state().messageKey, 'play.fish.waterGone');
  engine.destroy();
});

test('the Drowned Lamp: summoned once, veiled until a torch burns near it, felled for good', () => {
  const { engine, state } = atTheMere();
  const t = engine.terrain;
  const def = engine.areaDef.monsters.find(m => m.creature === 'drowned-lamp');
  assert.ok(def && def.summoned && def.veiled && def.once === 'drowned-lamp-defeated');
  assert.equal(engine.monsters.some(m => m.def === def), false, 'not there until summoned');
  assert.equal(engine.summon('drowned-lamp', 30 * 32), true);
  assert.equal(engine.summon('drowned-lamp', 30 * 32), false, 'one at a time');
  const lamp = engine.monsters.find(m => m.def === def);
  engine.hurtMonster(lamp, 50);
  assert.equal(lamp.hp, def.hp, 'veiled: the blow is swallowed');
  t.set(t.colAt(lamp.x), 32, terrainMod.nodeIndex('torch'));
  engine.hurtMonster(lamp, 500);
  assert.equal(lamp.hp, 0);
  assert.equal(engine.flagged('drowned-lamp-defeated'), true);
  assert.equal(engine.summon('drowned-lamp', 30 * 32), false, 'fallen for good');
  void state;
  engine.destroy();
});

test('buckets through the engine: the host swaps the stack first; scoop the Mere, pour it on lava, obsidian pays its block only', () => {
  const swaps = [];
  const { engine, t } = atTheMere({ onBucket: e => { swaps.push(e); return true; } });
  engine.setPlaceable('seam-bucket');
  const mere = t.index(21, 33);
  assert.equal(engine.useBucket('seam-bucket', mere), true);
  assert.deepEqual([swaps[0].from, swaps[0].to, swaps[0].liquid], ['seam-bucket', 'seam-bucket-water', 'water']);
  const lava = t.index(21, 31);
  t.set(21, 31, 0); t.liqType[lava] = terrainMod.LIQUID_LAVA; t.liqLevel[lava] = 4;
  assert.equal(engine.useBucket('seam-bucket-water', lava), true);
  assert.equal(t.nodeAt(21, 31).id, 'obsidian');
  assert.deepEqual([swaps[1].from, swaps[1].to], ['seam-bucket-water', 'seam-bucket']);
  // A refused swap moves nothing in the world.
  engine.options.onBucket = () => false;
  const before = t.levelAt(22, 33);
  assert.equal(engine.useBucket('seam-bucket', t.index(22, 33)), false);
  assert.equal(t.levelAt(22, 33), before);
  engine.destroy();
});

// ── A surface with height (world/heights.ts, engine/surface-body.ts) ─────────
const heightsMod = loadTs(path.resolve(__dirname, '../src/app/play/world/heights.ts'));
function enterQuarryHeights(extra = {}) {
  const { engine, state } = fixture(() => true, extra);
  engine.enter(world.TOWNS.infernal.hunts.find(h => h.id === 'ember-quarry'));
  engine.monsters.length = 0; // no Maws in these movement tests
  return { engine, state };
}
const HX0 = 560, HR = heightsMod.ROUTE;
function stepUntil(engine, done, max = 400) { for (let n = 0; n < max && !done(); n++) engine.update(1 / 60); return done(); }
function pressAgain(engine, action) { engine.setInput(action, false); engine.setInput(action, true); }

test('heights: every hunting ground has a route; the pieces are placed from one shape and the summit is the highest point', () => {
  for (const town of Object.values(world.TOWNS)) for (const hunt of town.hunts.filter(h => heightsMod.HUNT_HEIGHTS[h.id])) {
    const h = hunt.heights;
    assert.ok(h, `${hunt.id} has heights`);
    assert.equal(h.finds.length, 5);
    const summit = h.finds.find(f => f.kind === 'summit');
    assert.ok(h.finds.every(f => f.y >= summit.y), 'the summit is the top');
    assert.ok(h.top < summit.y - 300, 'the camera can see over the summit');
    assert.ok(h.solids.every(s => s.x + s.w < hunt.width - 60), 'inside the area');
    // Shelves that hang over the floor leave head room: the Keeper walks under every one.
    assert.ok(h.solids.every(s => s.y + s.h <= 610 - 168), `${hunt.id}: nothing blocks the floor`);
    assert.ok(hunt.monsters.some(m => m.floorY === HR.mesa.y), 'a creature perches on the mesa');
    assert.equal(new Set(h.finds.map(f => f.id)).size, 5);
  }
  const spec = () => ({ area: 'x', realm: 'umbral', x0: 500, perched: { creature: 'rivet-maw', name: 'M', hp: 1, spawnXs: [] } });
  assert.deepEqual(heightsMod.climbRoute(spec()), heightsMod.climbRoute(spec()), 'deterministic');
  assert.equal(heightsMod.hollisRealm(0), 'infernal'); assert.equal(heightsMod.hollisRealm(7), 'umbral');
});

test('heights: ledge grab — a jump into the low shelf catches its lip, and pushing on mantles onto it', () => {
  const { engine, state } = enterQuarryHeights();
  engine.player.x = HX0 - 60; engine.player.y = 610; engine.player.vy = 0; engine.player.grounded = true;
  engine.input.add('right'); pressAgain(engine, 'jump');
  assert.ok(stepUntil(engine, () => state().climbing === 'hang' || state().climbing === 'mantle', 90), 'caught the lip');
  assert.ok(stepUntil(engine, () => state().climbing === 'free' && engine.player.grounded, 90), 'mantled');
  assert.equal(engine.player.y, HR.low.y, 'standing on the shelf');
  assert.ok(engine.player.x > HX0 && engine.player.x < HX0 + HR.low.w);
  engine.destroy();
});

test('heights: hanging, Down lets go; a short hop does not reach the lip', () => {
  const { engine, state } = enterQuarryHeights();
  engine.player.x = HX0 - 60; engine.player.y = 610; engine.player.grounded = true;
  engine.input.add('right'); pressAgain(engine, 'jump');
  assert.ok(stepUntil(engine, () => state().climbing === 'hang', 90));
  engine.input.delete('right'); engine.setInput('jump', false); engine.setInput('down', true);
  stepUntil(engine, () => engine.player.grounded, 120);
  assert.equal(engine.player.y, 610, 'back on the floor');
  engine.setInput('down', false);
  // A tapped jump (released at once) is a short hop: it never gets the hands to the lip.
  engine.player.x = HX0 - 60;
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  engine.input.add('right'); engine.setInput('jump', true); engine.update(1 / 60); engine.setInput('jump', false);
  let caught = false;
  for (let n = 0; n < 90; n++) { engine.update(1 / 60); if (state().climbing !== 'free') caught = true; }
  assert.equal(caught, false, 'a hop does not catch');
  engine.destroy();
});

test('heights: Jump at a trunk climbs it into the canopy', () => {
  const { engine, state } = enterQuarryHeights();
  const tree = HX0 + HR.tree.dx;
  engine.player.x = tree + 10; engine.player.y = 610; engine.player.grounded = true;
  pressAgain(engine, 'jump');
  assert.equal(state().climbing, 'climb');
  assert.equal(engine.player.x, tree, 'onto the trunk');
  const y0 = engine.player.y;
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  assert.ok(Math.abs((y0 - engine.player.y) - 230 * .5) < 2, `climbs at 230 px/s (${y0 - engine.player.y})`);
  stepUntil(engine, () => state().climbing === 'free', 200);
  engine.setInput('jump', false);
  for (let n = 0; n < 10; n++) engine.update(1 / 60);
  assert.equal(engine.player.y, 610 - HR.tree.height, 'standing in the canopy');
  assert.ok(engine.player.grounded);
  engine.destroy();
});

test('heights: the summit route — snag, wall-jump onto the ruin block, slab, spire', () => {
  const { engine, state } = enterQuarryHeights();
  engine.player.x = HX0 + HR.snag.dx; engine.player.y = 610; engine.player.grounded = true;
  pressAgain(engine, 'jump');
  assert.ok(stepUntil(engine, () => engine.player.y <= HR.snag.top + .01, 300), 'up the snag');
  assert.equal(state().climbing, 'climb', 'a snag has no canopy: still holding on at its top');
  engine.input.add('right'); pressAgain(engine, 'jump');
  assert.ok(engine.player.vy < -600, 'kicked off');
  assert.ok(stepUntil(engine, () => state().climbing === 'free' && engine.player.grounded && engine.player.y === HR.block.y, 200), `on the ruin block (at ${engine.player.x},${engine.player.y})`);
  pressAgain(engine, 'jump');
  assert.ok(stepUntil(engine, () => engine.player.grounded && engine.player.y === HR.slab.y, 120), `on the slab (at ${engine.player.x},${engine.player.y})`);
  engine.setInput('jump', false);
  stepUntil(engine, () => engine.player.x >= HX0 + HR.spire.dx - 19, 120);
  pressAgain(engine, 'jump');
  assert.ok(stepUntil(engine, () => engine.player.grounded && engine.player.y === HR.spire.y, 150), `on the summit (at ${engine.player.x},${engine.player.y})`);
  engine.input.delete('right'); engine.setInput('jump', false);
  const s = state();
  assert.equal(s.nearby, 'height'); assert.equal(s.height.kind, 'summit');
  engine.destroy();
});

test('heights: at a snag top, Jump with no direction just clings', () => {
  const { engine, state } = enterQuarryHeights();
  engine.player.x = HX0 + HR.snag.dx; engine.player.y = 610; engine.player.grounded = true;
  pressAgain(engine, 'jump');
  stepUntil(engine, () => engine.player.y <= HR.snag.top + .01, 300);
  pressAgain(engine, 'jump');
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  assert.equal(state().climbing, 'climb'); assert.equal(engine.player.y, HR.snag.top);
  engine.destroy();
});

test('heights: random play never leaves the Keeper inside a solid, and the same inputs give the same path', () => {
  const run = () => {
    const { engine } = enterQuarryHeights();
    const rnd = terrainMod.seededRandom(0xc11b);
    const solids = engine.areaDef.heights.solids;
    const trail = [];
    engine.player.x = HX0 + 300;
    for (let n = 0; n < 4000; n++) {
      if (n % 9 === 0) {
        const r = rnd();
        for (const a of ['left', 'right', 'down']) engine.input.delete(a);
        if (r < .35) engine.input.add('left'); else if (r < .7) engine.input.add('right'); else if (r < .78) engine.input.add('down');
        if (rnd() < .4) pressAgain(engine, 'jump'); else if (rnd() < .3) engine.setInput('jump', false);
      }
      engine.update(1 / 60);
      const p = engine.player;
      for (const s of solids) {
        const inside = p.x + 17 > s.x && p.x - 17 < s.x + s.w && p.y - 1 > s.y && p.y - 167 < s.y + s.h;
        assert.ok(!inside, `frame ${n}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) inside the solid at ${s.x},${s.y}`);
      }
      if (n % 50 === 0) trail.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
    }
    engine.destroy();
    return trail.join(' ');
  };
  const a = run();
  assert.equal(a, run());
  assert.ok(new Set(a.split(' ').map(s => s.split(',')[1])).size > 3, 'it went up and down');
});

test('heights: a find asks the host; the host marks it found and the state says so', () => {
  const events = [];
  const { engine, state } = enterQuarryHeights({ onHeightFind: e => events.push(e) });
  const cache = engine.areaDef.heights.finds[0];
  engine.player.x = cache.x; engine.player.y = cache.y; engine.player.grounded = true;
  const s = state();
  assert.equal(s.nearby, 'height'); assert.equal(JSON.stringify(s.height), JSON.stringify({ id: cache.id, kind: 'cache', found: false }));
  engine.interact();
  assert.equal(JSON.stringify(events), JSON.stringify([{ areaId: 'ember-quarry', id: 'ember-quarry:low-cache', kind: 'cache', found: false }]));
  engine.setHeightsFound(new Set([cache.id]));
  assert.equal(state().height.found, true);
  engine.player.y = 610;
  assert.notEqual(state().nearby, 'height', 'out of reach from the floor below');
  engine.destroy();
});

test('heights: perched creatures stand down while the Keeper is on another level', () => {
  const { engine } = fixture(() => true);
  engine.enter(world.TOWNS.infernal.hunts.find(h => h.id === 'ember-quarry'));
  const perched = engine.monsters.find(m => m.def.floorY === HR.mesa.y);
  assert.ok(perched);
  engine.monsters.length = 0; engine.monsters.push(perched);
  engine.player.x = perched.x; engine.player.y = 610; engine.player.grounded = true;
  const hp = engine.hp;
  for (let n = 0; n < 240; n++) engine.update(1 / 60);
  assert.equal(perched.phase, 'idle'); assert.equal(engine.hp, hp, 'never struck from above');
  engine.destroy();
});

test('heights: a jump first and a push into the shelf after still catches its lip; Jump again mantles', () => {
  const { engine, state } = enterQuarryHeights();
  engine.player.x = HX0 - 70; engine.player.y = 610; engine.player.grounded = true;
  engine.setInput('jump', true);
  for (let n = 0; n < 12; n++) engine.update(1 / 60);
  engine.setInput('right', true);
  assert.ok(stepUntil(engine, () => state().climbing === 'hang', 90), 'hangs');
  engine.setInput('right', false);
  for (let n = 0; n < 20; n++) engine.update(1 / 60);
  assert.equal(state().climbing, 'hang', 'hangs on with no direction held');
  pressAgain(engine, 'jump');
  assert.ok(stepUntil(engine, () => engine.player.grounded && engine.player.y === HR.low.y, 60), 'mantled');
  engine.destroy();
});

// ── The tool in hand (shared/skills/held-tool.ts, docs/handoff/touch-and-tools.md) ──
const heldPiece = kind => ({ slot: 'weapon', kind, style: 'neutral', rarity: 'common' });
const ALL_TOOLS = { pickaxe: heldPiece('pickaxe'), axe: heldPiece('axe'), sickle: heldPiece('sickle'), rod: heldPiece('rod') };
/** Every monster of the area far off (a foe near keeps the weapon in hand). */
function clearFoes(engine) { for (const m of engine.monsters) { m.x = 1e6; m.spawn = 1e6; m.def = { ...m.def, range: [1e6, 1e6] }; } }
function idle(engine, seconds) { engine.setInput('attack', false); for (let n = 0; n < seconds * 60; n++) engine.update(1 / 60); }

test('tool in hand: a node puts its tool in hand, the weapon comes back 3 s after the work stops, and on a swing at air', () => {
  const swaps = [];
  const { engine } = enterThicket({ onHeldTool: tool => swaps.push(tool) });
  clearFoes(engine);
  engine.setTools({ sickle: 1, axe: 1, pickaxe: 1 });
  engine.setHeldTools(ALL_TOOLS);
  assert.equal(engine.heldTool, null, 'the weapon to start with');
  standAt(engine, nodeX(engine, 'starlight-clump') + 30);
  strike(engine);
  assert.equal(engine.heldTool, 'sickle', 'cutting starlight: the sickle');
  idle(engine, 2.5);
  assert.equal(engine.heldTool, 'sickle', 'still in hand just after the work');
  idle(engine, 1);
  assert.equal(engine.heldTool, null, 'the work stopped: the weapon is back');
  assert.deepEqual(swaps, ['sickle', null], 'one swap each way');
  // The sapling: the axe; then a swing at nothing is combat — the weapon at once.
  standAt(engine, nodeX(engine, 'world-root-sapling'));
  strike(engine);
  assert.equal(engine.heldTool, 'axe');
  let x = nodeX(engine, 'world-root-sapling');
  for (const dx of [400, -400, 700, -700]) { standAt(engine, x + dx); if (!engine.siteInReach()) break; }
  assert.equal(engine.siteInReach(), null, 'away from every node');
  strike(engine);
  assert.equal(engine.heldTool, null, 'a swing at the air: the weapon');
  engine.destroy();
});

test('tool in hand: a foe near puts the tool away and keeps it away', () => {
  const { engine } = enterThicket();
  clearFoes(engine);
  engine.setTools({ sickle: 1, axe: 1, pickaxe: 1 });
  engine.setHeldTools(ALL_TOOLS);
  standAt(engine, nodeX(engine, 'world-root-sapling'));
  strike(engine);
  assert.equal(engine.heldTool, 'axe');
  const foe = engine.monsters.find(m => m.hp > 0);
  assert.ok(foe, 'the thicket has a creature');
  foe.x = engine.player.x + 150; foe.spawn = foe.x; foe.def = { ...foe.def, range: [foe.x, foe.x] };
  engine.update(1 / 60);
  assert.equal(engine.heldTool, null, 'a foe near: the weapon');
  engine.attackCooldown = 0; engine.workSite(engine.siteInReach());
  assert.equal(engine.heldTool, null, 'working a node with a foe near keeps the weapon out');
  engine.destroy();
});

test('tool in hand: digging takes the pickaxe, a cast the rod (held while the line is out), and a new place the weapon', () => {
  const swaps = [];
  const { engine, state } = atTheMere({ onHeldTool: tool => swaps.push(tool) });
  clearFoes(engine);
  engine.setTools({ pickaxe: 1 });
  engine.setHeldTools(ALL_TOOLS);
  engine.setFishing({ tier: 1, liquids: ['water'] });
  const t = engine.terrain;
  t.set(15, 33, terrainMod.nodeIndex('hard-rock'));
  engine.facing = -1; engine.attackCooldown = 0;
  assert.equal(engine.strikeCell(15 * 32 + 16, t.top + 33 * 32 + 16), true);
  assert.equal(engine.heldTool, 'pickaxe', 'digging: the pickaxe');
  engine.facing = 1;
  assert.equal(engine.cast(), true);
  assert.equal(engine.heldTool, 'rod', 'a cast: the rod');
  engine.random = () => .99; // a slow bite: the line stays in
  idle(engine, 4);
  assert.ok(state().fishing, 'the line is still out');
  assert.equal(engine.heldTool, 'rod', 'the rod stays in hand while the line is out');
  engine.reelIn(true);
  idle(engine, 1.6 + 3.1);
  assert.equal(engine.heldTool, null, 'line in, work over: the weapon');
  engine.facing = 1; assert.equal(engine.cast(), true);
  assert.equal(engine.heldTool, 'rod');
  engine.enter(engine.areaDef);
  assert.equal(engine.heldTool, null, 'a new place: the weapon in hand');
  assert.deepEqual(swaps, ['pickaxe', 'rod', null, 'rod', null]);
  engine.destroy();
});

test('tool in hand: without the tool the weapon stays, and the hint is said once', () => {
  const { engine, state } = enterThicket();
  clearFoes(engine);
  engine.setHeldTools({ sickle: ALL_TOOLS.sickle });
  standAt(engine, nodeX(engine, 'world-root-sapling'));
  strike(engine);
  assert.equal(engine.heldTool, null);
  assert.equal(state().messageKey, 'play.hud.tool.missing.axe');
  strike(engine);
  assert.notEqual(state().messageKey, 'play.hud.tool.missing.axe', 'said once');
  engine.destroy();
});
