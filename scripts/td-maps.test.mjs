/**
 * td-maps.test.mjs — every hand-drawn level (src/app/play/td/maps/*.ts) can be walked: from its way in, every way
 * out, every creature's spawn and every boss is reachable (a single rock tile once cut floor 1's stairs off).
 * Reads the maps' character rows as text, the way they are drawn. Run: node --test scripts/td-maps.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const DIR = 'src/app/play/td/maps';
const BLOCKED = new Set('#~eoOTCB'.split(''));
const WAYS_IN = ['^', '<', 'D'];
const MUST_REACH = ['>', '<', '^', 'D', 'm', 'b', 'i', 'W', 'C', 's', 'a', 'g', 'w', 'X'];

for (const file of readdirSync(DIR).filter(f => f.endsWith('.ts'))) {
  const text = readFileSync(`${DIR}/${file}`, 'utf8');
  for (const [, name, block] of text.matchAll(/export const (\w+): TdMapDef = \{([\s\S]*?)\n\};/g)) {
    test(`${file} ${name}: every way out, spawn and boss can be walked to`, () => {
      const rows = [...block.matchAll(/^ {4}'([^']*)',$/gm)].map(m => m[1]);
      const width = Math.max(...rows.map(r => r.length));
      const grid = rows.map(r => r.padEnd(width, '#'));
      const start = grid.flatMap((row, r) => [...row].map((ch, c) => (WAYS_IN.includes(ch) ? [c, r] : null))).find(Boolean);
      assert.ok(start, `${name} has a way in (^, < or a door D)`);
      const key = (c, r) => `${c},${r}`;
      const seen = new Set([key(...start)]), queue = [start];
      while (queue.length) {
        const [c, r] = queue.pop();
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = [c + dc, r + dr];
          if (n[1] < 0 || n[1] >= grid.length || n[0] < 0 || n[0] >= width || seen.has(key(...n)) || BLOCKED.has(grid[n[1]][n[0]])) continue;
          seen.add(key(...n)); queue.push(n);
        }
      }
      grid.forEach((row, r) => [...row].forEach((ch, c) => {
        if (!MUST_REACH.includes(ch)) return;
        const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => seen.has(key(c + dc, r + dr)));
        assert.ok(near, `${name}: '${ch}' at ${c},${r} cannot be reached`);
      }));
    });
  }
}
