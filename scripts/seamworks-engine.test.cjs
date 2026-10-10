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
  const context = vm.createContext({
    crypto, console,
    Image: class { set src(value) {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    window: { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} },
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
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
  return load(path.resolve(__dirname, '../src/app/play/engine/engine.ts')).SeamworksEngine;
}
const Engine = loadEngine();
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
