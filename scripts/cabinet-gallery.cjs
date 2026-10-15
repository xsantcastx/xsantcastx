#!/usr/bin/env node
// The Lost Cabinets' art on one sheet (docs/handoff/lost-cabinets/gallery.svg):
// the cabinet's three frames (shut, shown with its latch glinting, open) beside
// every curio, the honeycomb, the hatbox and the loupe, from the same pixel
// sources the game paints (engine/cabinet-art.ts, shared/cabinets/curio-icons.ts).
//
//   node scripts/cabinet-gallery.cjs [out.svg]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const modules = new Map();
const context = vm.createContext({ console });
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} }; modules.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInContext(`(function(require,module,exports){${code}\n})`, context)((name) => load(path.resolve(path.dirname(file), `${name}.ts`)), module, module.exports);
  return module.exports;
}
const app = rel => load(path.resolve(__dirname, '../src/app', rel));
const art = app('play/engine/cabinet-art.ts');
const { CURIO_ICONS } = app('shared/cabinets/curio-icons.ts');
const { CABINET_ITEMS } = app('shared/cabinets/cabinets.model.ts');
const OUTLINE = '#140a1f';

const rects = [];
const px = (x, y, s, fill) => rects.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${fill}"/>`);
const text = (x, y, t) => rects.push(`<text x="${x}" y="${y}" font-family="monospace" font-size="11" fill="#e8c898">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`);

// The cabinet, three frames, 8 px per art px (the surface draws it at 4 world px; this is a close-up).
['shut', 'shown (latch glints)', 'open'].forEach((label, frame) => {
  const ox = 20 + frame * 150, oy = 20, s = 8;
  for (let y = 0; y < art.CABINET_H; y++) for (let x = 0; x < art.CABINET_W; x++) {
    const c = art.cabinetPixel(x, y, frame);
    if (c) px(ox + x * s, oy + y * s, s, c);
  }
  text(ox, oy + art.CABINET_H * s + 16, label);
});
// The things inside, 4 px per art px, four to a row.
CABINET_ITEMS.forEach((item, i) => {
  const icon = CURIO_ICONS[item.id];
  const ox = 20 + (i % 4) * 230, oy = 200 + Math.floor(i / 4) * 92, s = 4;
  icon.shape.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    px(ox + x * s, oy + y * s, s, ch === 'o' ? OUTLINE : icon.palette[ch] ?? icon.palette.b ?? '#888');
  }));
  text(ox + 70, oy + 30, item.name.length > 22 ? `${item.name.slice(0, 21)}…` : item.name);
});
const h = 200 + Math.ceil(CABINET_ITEMS.length / 4) * 92 + 10;
const out = process.argv[2] ?? path.resolve(__dirname, '../docs/handoff/lost-cabinets/gallery.svg');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${h}" viewBox="0 0 1000 ${h}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#16161f"/>${rects.join('')}</svg>\n`);
console.log(`wrote ${out}`);
