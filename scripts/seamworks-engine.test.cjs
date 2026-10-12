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
function fixture(onLoot = () => true) {
  let state;
  const engine = new Engine({
    getContext: () => ({ setTransform() {} }),
    getBoundingClientRect: () => ({ width: 1200, height: 720 }),
    parentElement: { clientWidth: 1200, clientHeight: 720, getBoundingClientRect: () => ({ width: 1200, height: 720 }) },
  }, { assets: {}, onInteract() {}, onLoot, onState: value => { state = value; } });
  return { engine, state: () => { engine.report(); return state; } };
}
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
    engine.player.x = 2580; engine.player.y = 610; engine.interact();
    assert.equal(state().area, 'Ember Quarry'); assert.equal(state().complete, false);
    const before = state().x;
    engine.setInput('right', true); engine.update(.1); engine.setInput('right', false);
    assert.ok(state().x > before);
    engine.player.x = 110; engine.interact();
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
  engine.setProgress({ equipped: true, restored: true }); engine.player.x = 2580; engine.interact();
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
