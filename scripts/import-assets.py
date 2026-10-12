#!/usr/bin/env python3
"""
import-assets.py — bring the approved Eclipse Realms art library into the app.

WHY THIS EXISTS
---------------
`build-scene-art.py` reads `~/Desktop/Game images/`, a directory that no longer
exists — the library was reorganised into `~/Desktop/Eclipse Realms/Assets/`.
So the only importer in the repo could not be re-run, and every asset produced
after the reorganisation stayed stranded. 159 of 232 approved files had never
reached the game; the UI compensated with emoji and two-letter text orbs.

This replaces that script's item half. Scene/hero art still belongs to
`build-scene-art.py` (it does genuine 3:4 art-direction crops, which is a
different job from re-encoding a collectible).

WHAT IT EMITS
-------------
Collectibles are 1254x1254 masters. A bag tile renders one at ~64px, so
shipping the master is why `src/assets/items/` is 45 MB. Each is emitted as
WebP at three widths — 96 (tile), 256 (inspect), 512 (hero/zoom) — and the
manifest carries a srcset so the browser picks one.

Transparency is preserved where it is real and dropped where it is not: a
constant alpha channel is 33 files' worth of wasted bytes.

GUARDS
------
Two failures this codebase has actually shipped, now caught at import time:

1. `sips -g hasAlpha` reports "yes" for art with a fully *painted* backdrop —
   the channel exists, it is just filled. `01-keeper-paper-doll.png` has an
   opaque near-white card baked in and rendered as a bright rectangle in the
   middle of a dark page for a whole release. Any file in a cut-out family
   whose corners are opaque is rejected.
2. Filenames with spaces or capitals (`The Arena.png`) violate the library's
   own kebab-case rule and need URL-encoding the moment they are served.

3. A character exported with a see-through body. `01-keeper-base.png` was 97%
   translucent and read as a ghost over every scene. Figure families (anything
   in OPAQUE_FIGURE_FAMILIES) are rejected when too little of what is painted
   is actually opaque. See `figure_opacity`.

Run from the repo root:  python3 scripts/import-assets.py [--check] [--only=<Family/Dir>]...
`--check` reports without writing, for CI.
Sprites (`Assets/Sprites/**`, the world layer) take a separate lossless path;
see "World-layer sprites" below.
`--commissions` lists every commissioned painting or sprite (docs/art-commissions/
commissions.csv) that is not in the library yet, and needs no Pillow.
Idempotent — it overwrites its own outputs and nothing else.
"""
import csv
import os
import re
import sys

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFilter
except ImportError:  # `--commissions` only reads filenames; everything else needs Pillow.
    Image = ImageChops = ImageDraw = ImageFilter = None

# The library moved off the Desktop into the projects folder. Its files are
# iCloud-backed and often evicted ("dataless"), so the first run after a while
# spends most of its time downloading masters, not encoding them.
LIBRARY = os.path.expanduser(
    os.environ.get('ER_ASSET_LIBRARY', '~/Documents/1. Projects/Eclipse Realms/Assets')
)
OUT_ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'game')

QUALITY = 88
# 96 is a bag tile, 256 is the Inspect panel (360-440px wide, art well inside
# that). A 512 tier was tried and was 63% of the total weight for a size nothing
# on the site actually renders — add it back only when a zoom view exists.
COLLECTIBLE_WIDTHS = (96, 256)
CHARACTER_WIDTHS = (512, 1024)
# An avatar is drawn at 28-48px in a header or a ladder row far more often than
# it is drawn large, and a srcset whose smallest rung is 512 makes every one of
# those rows download a 512px master. The two small rungs are added *below* the
# existing ones so no shipped filename changes.
AVATAR_WIDTHS = (96, 256) + CHARACTER_WIDTHS
# NPC and explorer portraits: an 80px orb in the dialogue widget, a 40-64px
# token on the Works map, a card in the roster. Nothing renders them at 1024.
PORTRAIT_WIDTHS = (96, 256, 512)

# source dir under LIBRARY -> (output family, width ladder, must be cut out)
FAMILIES = [
    ('Items/Runes',            'items/runes',        COLLECTIBLE_WIDTHS, True),
    ('Items/Runewords',        'items/runewords',    COLLECTIBLE_WIDTHS, True),
    ('Items/Artifacts',        'items/artifacts',    COLLECTIBLE_WIDTHS, True),
    ('Items/Materials',        'items/materials',    COLLECTIBLE_WIDTHS, True),
    ('Items/Consumables',      'items/consumables',  COLLECTIBLE_WIDTHS, True),
    ('Items/Quest',            'items/quest',        COLLECTIBLE_WIDTHS, True),
    ('Items/Portraits',        'items/portraits',    COLLECTIBLE_WIDTHS, True),
    ('Items/ArtBible/Weapons',    'items/artbible/weapons',    COLLECTIBLE_WIDTHS, True),
    ('Items/ArtBible/Armor',      'items/artbible/armor',      COLLECTIBLE_WIDTHS, True),
    ('Items/ArtBible/Accessories', 'items/artbible/accessories', COLLECTIBLE_WIDTHS, True),
    ('Items/ArtBible/Tools',      'items/artbible/tools',      COLLECTIBLE_WIDTHS, True),
    ('Items/ArtBible/Runes',      'items/artbible/runes',      COLLECTIBLE_WIDTHS, True),
    ('Items/ArtBible/Artifacts',  'items/artbible/artifacts',  COLLECTIBLE_WIDTHS, True),
    ('Items/ArtBible/Consumables', 'items/artbible/consumables', COLLECTIBLE_WIDTHS, True),
    ('Items/ArtBible/Materials',  'items/artbible/materials',  COLLECTIBLE_WIDTHS, True),
    ('Items/ArtBible/Singular',   'items/artbible/singular',   COLLECTIBLE_WIDTHS, True),
    ('Characters/equipment',   'items/equipment',    COLLECTIBLE_WIDTHS, True),
    ('Characters/avatars',     'characters/avatars', AVATAR_WIDTHS,      True),
    ('Characters/portraits',   'characters/portraits', AVATAR_WIDTHS,    True),
    # Slot close-ups, one per equipment slot plus the Basalt Edge. They fill
    # the frame rather than registering over `01-keeper-base`, so they are
    # collectibles, not paper-doll layers, and take the collectible ladder.
    ('Characters/Overlays',    'characters/overlays', COLLECTIBLE_WIDTHS, True),
    # The six speaking characters (`npc-*`, npc.model.ts) and the eighteen
    # named explorers (`explorer-*`, explorer-archetypes.ts). Commissioned in
    # docs/art-commissions/; until a file lands the folder may not exist at all,
    # which is why both are in OPTIONAL_DIRS.
    ('Characters/npcs',        'characters/npcs',     PORTRAIT_WIDTHS,    True),
    ('Characters/explorers',   'characters/explorers', PORTRAIT_WIDTHS,   True),
    ('Creatures/Masters',      'creatures',          COLLECTIBLE_WIDTHS, True),
    ('Currencies',             'currencies',         COLLECTIBLE_WIDTHS, True),
    ('Currencies/realm-tokens', 'currencies/realm-tokens', COLLECTIBLE_WIDTHS, True),
    ('Guild/Crests',           'guild/crests',       COLLECTIBLE_WIDTHS, True),
    ('Guild/Banners',          'guild/banners',      COLLECTIBLE_WIDTHS, True),
    ('Guild/Ranks',            'guild/ranks',        COLLECTIBLE_WIDTHS, True),
    ('Market/Categories',      'market/categories',  COLLECTIBLE_WIDTHS, True),
    ('Market/Status',          'market/status',      COLLECTIBLE_WIDTHS, True),
    ('Market/Items/Automatons',   'market/automatons',   COLLECTIBLE_WIDTHS, True),
    ('Market/Items/Cosmetics',    'market/cosmetics',    COLLECTIBLE_WIDTHS, True),
    ('Market/Items/Enchantments', 'market/enchantments', COLLECTIBLE_WIDTHS, True),
    ('Market/Items/Expeditions',  'market/expeditions',  COLLECTIBLE_WIDTHS, True),
    ('Market/Items/Forge',        'market/forge',        COLLECTIBLE_WIDTHS, True),
    ('Market/Items/Hammers',      'market/hammers',      COLLECTIBLE_WIDTHS, True),
    ('Market/Items/Mastery',      'market/mastery',      COLLECTIBLE_WIDTHS, True),
    # Forge Thrall tiers and the `thrall-slot` upgrade (thrall.model.ts).
    ('Market/Items/Thralls',      'market/thralls',      COLLECTIBLE_WIDTHS, True),
    ('Effects/Forge',          'effects/forge',      COLLECTIBLE_WIDTHS, True),
    ('Effects/Rifts',          'effects/rifts',      COLLECTIBLE_WIDTHS, True),
    # The Keeper render the paper doll stands on. `01-keeper-base.png` is the
    # correct cut-out; `paper-doll/01-keeper-paper-doll.png` is the one with the
    # baked white card and is deliberately not imported.
    ('Characters',             'characters',         CHARACTER_WIDTHS,   True),
]


# Paintings that are byte-identical to an earlier entry in the same family.
#
# `051-rune-of-eclipse` and `049-rune-of-hollow` are the same file, as are
# `052-rune-of-meridian` and `050-rune-of-erasure` — the Art Bible names four
# runes and the library delivered two paintings. Importing all four would put
# the Hollow render on the Eclipse rune, which is exactly the kind of quiet
# mismatch the cut-out guard above exists to stop. The two names without art of
# their own get no item definition either, so nothing in the game points at a
# painting that does not depict it.
SKIP_FILES = {
    'Items/ArtBible/Runes/051-rune-of-eclipse.png',
    'Items/ArtBible/Runes/052-rune-of-meridian.png',
}


# Families commissioned ahead of their first painting. A missing folder here is
# the expected state, not a broken library, so it is reported as pending rather
# than failing `--check`.
OPTIONAL_DIRS = {
    'Characters/npcs',
    'Characters/explorers',
    'Market/Items/Thralls',
}

# Cut-out families that depict a body — a person, a creature, a building. These
# must be opaque *inside* their outline. Objects (weapons, runes, smoke, effect
# layers) are left out: a glow or a wisp of void-smoke is meant to be see-through.
OPAQUE_FIGURE_FAMILIES = {
    'Characters',
    'Characters/avatars',
    'Characters/portraits',
    'Characters/npcs',
    'Characters/explorers',
    'Creatures/Masters',
    'Market/Items/Thralls',
}
# Share of painted pixels (alpha > 8) that must be solid (alpha > 240). Every
# approved avatar and creature master measures 0.81-0.98; the ghost Keeper
# measured 0.04. Halfway leaves room for a soft rim, smoke or a glow.
MIN_FIGURE_OPACITY = 0.5


def figure_opacity(img) -> float:
    """Fraction of the painted area that is fully opaque."""
    hist = img.split()[3].histogram()
    painted = sum(hist[9:])
    return sum(hist[241:]) / painted if painted else 1.0


def slug_ok(name: str) -> bool:
    stem = os.path.splitext(name)[0]
    return stem == stem.lower() and ' ' not in stem


def corners_opaque(img: Image.Image) -> bool:
    """A painted backdrop, not a cut-out. See GUARDS above."""
    if img.mode != 'RGBA':
        return True
    w, h = img.size
    pts = [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)]
    return all(img.getpixel(p)[3] > 240 for p in pts)


# Cut-outs exported with a see-through body. `01-keeper-base.png` was ~97%
# translucent (56% of its painted pixels under alpha 64, 3% opaque), so the
# Keeper read as a ghost over every scene. The colour under that alpha is real
# paint, so `solidify` makes the figure opaque inside its own outline and keeps
# only the outer rim feathered. Add a stem here only for the same defect.
SOLIDIFY = {'01-keeper-base'}


def solidify(img: Image.Image, th: int = 6, close: int = 9, feather: int = 7) -> Image.Image:
    """Opaque inside the figure's outline, enclosed holes filled, rim feathered.
    Never lowers the painting's own alpha; gaps open to the outside (between
    the legs, under the cape) stay open."""
    r, g, b, a = img.split()
    m = a.point(lambda v: 255 if v > th else 0)
    m = m.filter(ImageFilter.MaxFilter(close)).filter(ImageFilter.MinFilter(close))
    pad = Image.new('L', (m.size[0] + 2, m.size[1] + 2), 0)
    pad.paste(m, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    filled = pad.crop((1, 1, m.size[0] + 1, m.size[1] + 1)).point(lambda v: 0 if v == 128 else 255)
    core = filled.filter(ImageFilter.MinFilter(feather)).filter(ImageFilter.GaussianBlur(feather / 2))
    return Image.merge('RGBA', (r, g, b, ImageChops.lighter(a, core)))


def has_real_alpha(img: Image.Image) -> bool:
    if img.mode != 'RGBA':
        return False
    lo, hi = img.split()[3].getextrema()
    return lo < 255


def emit(src_path: str, out_dir: str, widths, check: bool) -> tuple[int, int]:
    """Returns (files_written, bytes_written)."""
    img = Image.open(src_path)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    stem = os.path.splitext(os.path.basename(src_path))[0]
    if stem in SOLIDIFY:
        img = solidify(img)
    keep_alpha = has_real_alpha(img)
    if not keep_alpha:
        img = img.convert('RGB')

    written = 0
    total = 0
    for w in widths:
        if w > img.size[0]:
            continue
        h = round(img.size[1] * w / img.size[0])
        out = os.path.join(out_dir, f'{stem}-{w}.webp')
        if not check:
            os.makedirs(out_dir, exist_ok=True)
            img.resize((w, h), Image.LANCZOS).save(
                out, 'WEBP', quality=QUALITY, method=4
            )
            total += os.path.getsize(out)
        written += 1
    return written, total


MANIFEST_OUT = os.path.join(
    os.path.dirname(__file__), '..', 'src', 'app', 'shared', 'art', 'art-manifest.generated.ts'
)

MANIFEST_HEADER = '''/**
 * art-manifest.generated.ts — DO NOT EDIT BY HAND.
 *
 * Written by `scripts/import-assets.py` from the approved asset library.
 * Re-run that script after adding art; do not hand-add entries here.
 *
 * Keys are the catalogue id with the painter's two-digit prefix stripped, so
 * `01-eclipse-longblade.png` is reachable as `eclipse-longblade` — the same id
 * `ITEM_DEFINITIONS` uses. Each entry carries a srcset so a 64px bag tile does
 * not download a 512px master.
 *
 * Pure data, no browser APIs, safe to import from an SSR path.
 */

export interface ArtEntry {
  /** Smallest variant — a sensible `src` for a tile. */
  src: string;
  /** Full ladder for `srcset`, widths ascending. */
  srcset: string;
  width: number;
  height: number;
}
'''


# The library names a collectible after the state it is painted in, and the
# inventory only ever renders the idle one. Carrying `-idle` into the key would
# mean every Art Bible id in `ITEM_DEFINITIONS` had to end in it too.
STATE_SUFFIXES = ('-idle',)


def strip_index(stem: str) -> str:
    """`01-eclipse-longblade` -> `eclipse-longblade`, `001-dawnrender-idle` -> `dawnrender`."""
    parts = stem.split('-', 1)
    key = parts[1] if len(parts) == 2 and parts[0].isdigit() else stem
    for suffix in STATE_SUFFIXES:
        if key.endswith(suffix):
            return key[: -len(suffix)]
    return key


def write_manifest() -> int:
    """Scan the emitted tree and write one typed id -> art map."""
    families: dict[str, dict[str, list[tuple[int, str, int]]]] = {}
    for root, _dirs, names in os.walk(OUT_ROOT):
        if os.path.relpath(root, OUT_ROOT).replace(os.sep, '/').split('/')[0] == SPRITE_OUT:
            continue
        webps = [n for n in names if n.endswith('.webp')]
        if not webps:
            continue
        family = os.path.relpath(root, OUT_ROOT).replace(os.sep, '/')
        bucket: dict[str, list[tuple[int, str, int]]] = {}
        for n in webps:
            stem, _ = os.path.splitext(n)
            base, _, w = stem.rpartition('-')
            if not w.isdigit():
                continue
            img = Image.open(os.path.join(root, n))
            bucket.setdefault(strip_index(base), []).append(
                (int(w), f'assets/game/{family}/{n}', img.size[1])
            )
        if bucket:
            families[family] = bucket

    lines = [MANIFEST_HEADER]
    total = 0
    all_ids: list[str] = []
    for family in sorted(families):
        const = 'ART_' + family.upper().replace('/', '_').replace('-', '_')
        lines.append(f'\nexport const {const}: Readonly<Record<string, ArtEntry>> = {{')
        for key in sorted(families[family]):
            variants = sorted(families[family][key])
            w0, src0, h0 = variants[0]
            srcset = ', '.join(f'{p} {w}w' for w, p, _ in variants)
            lines.append(
                f"  '{key}': {{ src: '{src0}', srcset: '{srcset}', width: {w0}, height: {h0} }},"
            )
            total += 1
            all_ids.append(key)
        lines.append('};')

    lines.append('\n/** Every family, in one lookup. Later families win on an id clash. */')
    lines.append('export const ART_ALL: Readonly<Record<string, ArtEntry>> = {')
    for family in sorted(families):
        const = 'ART_' + family.upper().replace('/', '_').replace('-', '_')
        lines.append(f'  ...{const},')
    lines.append('};')
    lines.append('\nexport function artFor(id: string): ArtEntry | null {')
    lines.append('  return ART_ALL[id] ?? null;')
    lines.append('}')
    lines.append('')

    os.makedirs(os.path.dirname(MANIFEST_OUT), exist_ok=True)
    with open(MANIFEST_OUT, 'w') as fh:
        fh.write('\n'.join(lines))
    print(f'manifest: {total} entries across {len(families)} families')
    return total


# ─────────────────────────────────────────────────────────────────────────────
# World-layer sprites
# ─────────────────────────────────────────────────────────────────────────────
#
# The world (the side-scroller and the towns) is drawn with stylised sprites;
# menus keep the paintings above. A sprite is not a collectible: it must not be
# resized down a width ladder (that blurs a 2px outline into mush) and must not
# be SOLIDIFIED (its alpha is authored edge-for-edge). So sprites get their own
# path through this script:
#
#   Assets/Sprites/<Family>/NN-<id>.png    the sheet, authored at `scale` (2x)
#   Assets/Sprites/<Family>/NN-<id>.json   its sidecar (schema: docs/art-commissions/README.md)
#
# Each sheet is emitted as lossless WebP twice — at its authored scale and at
# 1x, reduced by an exact integer factor in premultiplied alpha so edges do
# not pick up a dark fringe — plus a normalised copy of the sidecar. The
# sidecars are then folded into `sprite-manifest.generated.ts`, in logical
# (1x) pixels. A prop with no sidecar is a single still frame whose pivot is
# its bottom-centre.
#
# Additive: no existing family, output or manifest key changes.
SPRITE_FAMILIES = [
    ('Sprites/Characters', 'sprites/characters'),
    ('Sprites/Creatures',  'sprites/creatures'),
    ('Sprites/NPCs',       'sprites/npcs'),
    ('Sprites/Buildings',  'sprites/buildings'),
    ('Sprites/Props',      'sprites/props'),
    ('Sprites/Equipment',  'sprites/equipment'),
]
# Sprite families that depict a body and must be opaque inside the outline.
OPAQUE_SPRITE_FAMILIES = {'Sprites/Characters', 'Sprites/Creatures', 'Sprites/NPCs', 'Sprites/Buildings'}
SPRITE_OUT = 'sprites'
SPRITE_MANIFEST_OUT = os.path.join(
    os.path.dirname(__file__), '..', 'src', 'app', 'shared', 'art', 'sprite-manifest.generated.ts'
)


def load_sidecar(png_path: str, img) -> tuple[dict | None, list[str]]:
    """Read and validate the sidecar next to a sheet. Returns (meta, errors).

    The returned meta is normalised to the authored scale; nothing is
    converted to 1x until the manifest is written."""
    import json
    errs: list[str] = []
    side = os.path.splitext(png_path)[0] + '.json'
    w, h = img.size
    if not os.path.isfile(side):
        return ({'scale': 1 if w < 64 else 2, 'frame': {'w': w, 'h': h},
                 'pivot': {'x': w // 2, 'y': h},
                 'actions': [{'name': 'idle', 'frames': 1, 'fps': 0, 'loop': False}]}, [])
    try:
        with open(side) as fh:
            meta = json.load(fh)
    except ValueError as e:
        return None, [f'sidecar is not valid JSON ({e})']
    scale = meta.get('scale', 2)
    frame = meta.get('frame') or {}
    fw, fh_ = frame.get('w'), frame.get('h')
    actions = meta.get('actions') or []
    if scale not in (1, 2, 3, 4):
        errs.append(f'scale must be 1-4, got {scale!r}')
    if not (isinstance(fw, int) and isinstance(fh_, int) and fw > 0 and fh_ > 0):
        errs.append('frame.w and frame.h must be positive integers')
        return None, errs
    if fw % scale or fh_ % scale:
        errs.append(f'frame {fw}x{fh_} is not divisible by scale {scale}')
    if not actions:
        errs.append('actions is empty')
    cols = max((a.get('frames', 0) for a in actions), default=0)
    if (w, h) != (cols * fw, len(actions) * fh_):
        errs.append(f'sheet is {w}x{h}, layout needs {cols * fw}x{len(actions) * fh_} '
                    f'({cols} frames x {len(actions)} action rows of {fw}x{fh_})')
    names = set()
    for a in actions:
        n, f = a.get('name'), a.get('frames')
        if not n or n in names:
            errs.append(f'action name missing or repeated: {n!r}')
        names.add(n)
        if not isinstance(f, int) or f < 1:
            errs.append(f'action {n!r}: frames must be >= 1')
            continue
        for anchor, pts in (a.get('anchors') or {}).items():
            if any(not isinstance(pt, list) or len(pt) not in (2, 3) for pt in pts):
                errs.append(f'action {n!r}: anchor {anchor!r} points must be [x, y] or [x, y, deg]')
            elif len(pts) != f:
                errs.append(f'action {n!r}: anchor {anchor!r} has {len(pts)} points for {f} frames')
    piv = meta.get('pivot') or {'x': fw // 2, 'y': fh_}
    meta['pivot'] = piv
    meta['scale'] = scale
    return meta, errs


def emit_sprite(img, meta: dict, out_dir: str, stem: str, check: bool) -> int:
    """Lossless WebP at the authored scale and at 1x. Returns files written."""
    import json
    scale = meta['scale']
    outs = [(img, f'{stem}@{scale}x.webp')]
    if scale != 1:
        one = img.convert('RGBa').reduce(scale).convert('RGBA')
        outs.append((one, f'{stem}@1x.webp'))
    if check:
        return len(outs)
    os.makedirs(out_dir, exist_ok=True)
    for im, name in outs:
        im.save(os.path.join(out_dir, name), 'WEBP', lossless=True, quality=100, method=6, exact=True)
    with open(os.path.join(out_dir, f'{stem}.json'), 'w') as fh:
        json.dump(meta, fh, indent=1, sort_keys=True)
    return len(outs)


def import_sprites(check: bool, only: list[str], problems: list[str], pending: list[str]) -> int:
    files = 0
    sheets = 0
    for src_rel, out_rel in SPRITE_FAMILIES:
        if only and not any(src_rel == o or src_rel.startswith(o + '/') for o in only):
            continue
        src_dir = os.path.join(LIBRARY, src_rel)
        if not os.path.isdir(src_dir):
            pending.append(src_rel)
            continue
        for name in sorted(os.listdir(src_dir)):
            if not name.lower().endswith('.png'):
                continue
            files += 1
            if not slug_ok(name):
                problems.append(f'{src_rel}/{name}: not kebab-case')
                continue
            path = os.path.join(src_dir, name)
            img = Image.open(path)
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            if corners_opaque(img):
                problems.append(f'{src_rel}/{name}: opaque corners — sprite sheets need a transparent background')
                continue
            meta, errs = load_sidecar(path, img)
            if errs:
                problems.extend(f'{src_rel}/{name}: {e}' for e in errs)
                continue
            if src_rel in OPAQUE_SPRITE_FAMILIES:
                solid = figure_opacity(img)
                if solid < MIN_FIGURE_OPACITY:
                    problems.append(f'{src_rel}/{name}: sprite is see-through — only {solid:.0%} opaque '
                                    f'(needs {MIN_FIGURE_OPACITY:.0%}); sprites are never SOLIDIFIED, re-export')
                    continue
            stem = os.path.splitext(name)[0]
            emit_sprite(img, meta, os.path.join(OUT_ROOT, SPRITE_OUT, out_rel.split('/', 1)[1]), stem, check)
            sheets += 1
    print(f'sprite sheets: {sheets} ok')
    return files


SPRITE_MANIFEST_HEADER = """/**
 * sprite-manifest.generated.ts — DO NOT EDIT BY HAND.
 *
 * Written by `scripts/import-assets.py` from `Assets/Sprites/**` and each
 * sheet's sidecar JSON (schema: docs/art-commissions/README.md). World-layer
 * sprites only; menu paintings are in art-manifest.generated.ts.
 *
 * Every number here is in logical (1x) pixels. `src` is the 1x sheet and
 * `src2x` the authored one (the same file when a sheet was authored at 1x).
 * A sheet is a uniform grid: action N is row `row`, frames run left to right.
 *
 * Pure data, no browser APIs, safe to import from an SSR path.
 */

export interface SpriteAction {
  row: number;
  frames: number;
  /** Frames per second; 0 for a still. */
  fps: number;
  loop: boolean;
  /**
   * Per-frame attachment points (e.g. `hand_front`), cell-relative, 1x px. An
   * optional third number is the held item's angle in degrees, clockwise from
   * pointing straight up.
   */
  anchors?: Readonly<Record<string, readonly (readonly [number, number] | readonly [number, number, number])[]>>;
}

export interface SpriteEntry {
  src: string;
  src2x: string;
  frameW: number;
  frameH: number;
  /** Ground contact / rotation origin inside a cell, 1x px. */
  pivotX: number;
  pivotY: number;
  actions: Readonly<Record<string, SpriteAction>>;
}
"""


def write_sprite_manifest() -> int:
    import json
    root = os.path.join(OUT_ROOT, SPRITE_OUT)
    entries: dict[str, str] = {}
    for dirpath, _dirs, names in os.walk(root):
        for n in sorted(names):
            if not n.endswith('.json'):
                continue
            stem = n[:-5]
            with open(os.path.join(dirpath, n)) as fh:
                meta = json.load(fh)
            sc = meta['scale']
            rel = os.path.relpath(dirpath, OUT_ROOT).replace(os.sep, '/')
            key = meta.get('id') or strip_index(stem)
            acts = []
            for row, a in enumerate(meta['actions']):
                parts = [f"row: {row}", f"frames: {a['frames']}", f"fps: {a.get('fps', 8)}",
                         f"loop: {'true' if a.get('loop', True) else 'false'}"]
                if a.get('anchors'):
                    an = ', '.join(
                        f"'{k}': [" + ', '.join(
                            f'[{pt[0] / sc:g}, {pt[1] / sc:g}' + (f', {pt[2]:g}' if len(pt) > 2 else '') + ']'
                            for pt in pts) + ']'
                        for k, pts in sorted(a['anchors'].items()))
                    parts.append(f'anchors: {{ {an} }}')
                acts.append(f"'{a['name']}': {{ {', '.join(parts)} }}")
            entries[key] = (
                f"  '{key}': {{ src: 'assets/game/{rel}/{stem}@1x.webp', "
                f"src2x: 'assets/game/{rel}/{stem}@{sc}x.webp', "
                f"frameW: {meta['frame']['w'] // sc}, frameH: {meta['frame']['h'] // sc}, "
                f"pivotX: {meta['pivot']['x'] / sc:g}, pivotY: {meta['pivot']['y'] / sc:g}, "
                f"actions: {{ {', '.join(acts)} }} }},"
            )
    lines = [SPRITE_MANIFEST_HEADER,
             'export const SPRITES: Readonly<Record<string, SpriteEntry>> = {']
    lines += [entries[k] for k in sorted(entries)]
    lines += ['};', '',
              '/** A world sprite by id, or null until its sheet has been imported. */',
              'export function spriteFor(id: string | undefined | null): SpriteEntry | null {',
              '  return (id && SPRITES[id]) || null;',
              '}', '']
    with open(SPRITE_MANIFEST_OUT, 'w') as fh:
        fh.write('\n'.join(lines))
    print(f'sprites:  {len(entries)} entries')
    return len(entries)


ART_TS = os.path.join(os.path.dirname(__file__), '..', 'src', 'app', 'shared', 'art', 'art.ts')


def report_retired_pending() -> None:
    """Name the ART_PENDING lines a fresh import has just made stale.

    `artFor()` never consults ART_PENDING, and ART_PENDING drops painted ids by
    itself, so a stale line breaks nothing. It is still debt that has been paid,
    and deleting the line is what keeps the list honest.
    """
    try:
        with open(ART_TS) as fh:
            src = fh.read()
        with open(MANIFEST_OUT) as fh:
            keys = set(re.findall(r"^  '([a-z0-9-]+)': \{ src:", fh.read(), re.M))
    except OSError:
        return
    block = re.search(r'export const ART_PENDING_DECLARED[^=]*=\s*\[(.*?)\];', src, re.S)
    if not block:
        return
    aliases = dict(re.findall(r"'([a-z0-9-]+)':\s*'([a-z0-9-]+)'", src.split('ART_PENDING')[0]))
    ids = re.findall(r"'([a-z0-9-]+)'", block.group(1))
    painted = [i for i in ids if aliases.get(i, i) in keys]
    if painted:
        print(f'\nnow painted — delete these lines from ART_PENDING_DECLARED in art.ts ({len(painted)}):')
        for i in painted:
            print(f'  - {i}')


COMMISSIONS_CSV = os.path.join(
    os.path.dirname(__file__), '..', 'docs', 'art-commissions', 'commissions.csv'
)


def commissions(strict: bool) -> int:
    """List commissioned paintings that have not landed in the library yet."""
    with open(COMMISSIONS_CSV, newline='') as fh:
        rows = list(csv.DictReader(fh))
    missing = [r for r in rows if not os.path.isfile(os.path.join(LIBRARY, r['library_path']))]
    landed = len(rows) - len(missing)
    print(f'library:      {LIBRARY}')
    print(f'commissioned: {len(rows)}  landed: {landed}  missing: {len(missing)}')
    for prio in sorted({r['priority'] for r in missing}):
        group = [r for r in missing if r['priority'] == prio]
        print(f'\n{prio} ({len(group)})')
        for r in group:
            print(f"  {r.get('layer', ''):14s} {r['id']:34s} {r['library_path']}")
    if landed:
        print('\nlanded — run `python3 scripts/import-assets.py` (and build-scene-art.py for Locations/):')
        for r in rows:
            if r not in missing:
                print(f"  {r.get('layer', ''):14s} {r['id']:34s} {r['library_path']}")
    return 1 if (strict and missing) else 0


def main() -> int:
    if '--commissions' in sys.argv:
        return commissions(strict='--strict' in sys.argv)
    if Image is None:
        print('error: Pillow is required (pip install Pillow)', file=sys.stderr)
        return 1
    if '--manifest-only' in sys.argv:
        write_manifest()
        write_sprite_manifest()
        return 0
    check = '--check' in sys.argv
    # `--only Characters/avatars` limits the run to families whose source dir
    # starts with that prefix. Re-encoding the whole library rewrites hundreds
    # of byte-different WebPs when Pillow's encoder version moves, which is a
    # diff nobody can review; import what changed and regenerate the manifest.
    only = [a.split('=', 1)[1] for a in sys.argv if a.startswith('--only=')]
    if not os.path.isdir(LIBRARY):
        print(f'error: asset library not found at {LIBRARY}', file=sys.stderr)
        print('       set ER_ASSET_LIBRARY to override.', file=sys.stderr)
        return 1

    problems: list[str] = []
    pending_dirs: list[str] = []
    files = 0
    written = 0
    total = 0

    for src_rel, out_rel, widths, cutout in FAMILIES:
        if only and not any(src_rel == o or src_rel.startswith(o + '/') for o in only):
            continue
        src_dir = os.path.join(LIBRARY, src_rel)
        if not os.path.isdir(src_dir):
            if src_rel in OPTIONAL_DIRS:
                pending_dirs.append(src_rel)
            else:
                problems.append(f'missing source dir: {src_rel}')
            continue
        out_dir = os.path.join(OUT_ROOT, out_rel)

        for name in sorted(os.listdir(src_dir)):
            if not name.lower().endswith('.png'):
                continue
            if f'{src_rel}/{name}' in SKIP_FILES:
                continue
            path = os.path.join(src_dir, name)
            files += 1

            if not slug_ok(name):
                problems.append(f'{src_rel}/{name}: not kebab-case')
                continue

            img = Image.open(path)
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            if cutout and corners_opaque(img):
                problems.append(
                    f'{src_rel}/{name}: opaque corners — backdrop is baked into '
                    f'the art, not a cut-out'
                )
                continue
            if src_rel in OPAQUE_FIGURE_FAMILIES:
                stem = os.path.splitext(name)[0]
                solid = figure_opacity(solidify(img) if stem in SOLIDIFY else img)
                if solid < MIN_FIGURE_OPACITY:
                    problems.append(
                        f'{src_rel}/{name}: figure is see-through — only '
                        f'{solid:.0%} of it is opaque (needs {MIN_FIGURE_OPACITY:.0%}); '
                        f're-export with a solid body, or add the stem to SOLIDIFY'
                    )
                    continue

            n, b = emit(path, out_dir, widths, check)
            written += n
            total += b

    files += import_sprites(check, only, problems, pending_dirs)

    print(f'library:  {LIBRARY}')
    print(f'scanned:  {files} source files')
    print(f'emitted:  {written} webp files' + ('' if check else f' ({total/1024/1024:.1f} MB)'))
    if pending_dirs:
        print(f'pending:  {len(pending_dirs)} commissioned folder(s) not created yet: '
              + ', '.join(pending_dirs))
    if not check:
        write_manifest()
        write_sprite_manifest()
        report_retired_pending()
    if problems:
        print(f'\nrejected ({len(problems)}):')
        for p in problems:
            print(f'  - {p}')
    return 1 if (check and problems) else 0


if __name__ == '__main__':
    raise SystemExit(main())
