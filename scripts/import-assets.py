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

Run from the repo root:  python3 scripts/import-assets.py [--check] [--only=<Family/Dir>]...
`--check` reports without writing, for CI.
Idempotent — it overwrites its own outputs and nothing else.
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

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


def main() -> int:
    if '--manifest-only' in sys.argv:
        write_manifest()
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
    files = 0
    written = 0
    total = 0

    for src_rel, out_rel, widths, cutout in FAMILIES:
        if only and not any(src_rel == o or src_rel.startswith(o + '/') for o in only):
            continue
        src_dir = os.path.join(LIBRARY, src_rel)
        if not os.path.isdir(src_dir):
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

            n, b = emit(path, out_dir, widths, check)
            written += n
            total += b

    print(f'library:  {LIBRARY}')
    print(f'scanned:  {files} source files')
    print(f'emitted:  {written} webp files' + ('' if check else f' ({total/1024/1024:.1f} MB)'))
    if not check:
        write_manifest()
    if problems:
        print(f'\nrejected ({len(problems)}):')
        for p in problems:
            print(f'  - {p}')
    return 1 if (check and problems) else 0


if __name__ == '__main__':
    raise SystemExit(main())
