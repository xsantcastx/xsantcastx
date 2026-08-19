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

Run from the repo root:  python3 scripts/import-assets.py [--check]
`--check` reports without writing, for CI.
Idempotent — it overwrites its own outputs and nothing else.
"""
import os
import sys

from PIL import Image

LIBRARY = os.path.expanduser(
    os.environ.get('ER_ASSET_LIBRARY', '~/Desktop/Eclipse Realms/Assets')
)
OUT_ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'game')

QUALITY = 88
# 96 is a bag tile, 256 is the Inspect panel (360-440px wide, art well inside
# that). A 512 tier was tried and was 63% of the total weight for a size nothing
# on the site actually renders — add it back only when a zoom view exists.
COLLECTIBLE_WIDTHS = (96, 256)
CHARACTER_WIDTHS = (512, 1024)

# source dir under LIBRARY -> (output family, width ladder, must be cut out)
FAMILIES = [
    ('Items/Runes',            'items/runes',        COLLECTIBLE_WIDTHS, True),
    ('Items/Runewords',        'items/runewords',    COLLECTIBLE_WIDTHS, True),
    ('Items/Artifacts',        'items/artifacts',    COLLECTIBLE_WIDTHS, True),
    ('Items/Materials',        'items/materials',    COLLECTIBLE_WIDTHS, True),
    ('Items/Consumables',      'items/consumables',  COLLECTIBLE_WIDTHS, True),
    ('Items/Quest',            'items/quest',        COLLECTIBLE_WIDTHS, True),
    ('Items/Portraits',        'items/portraits',    COLLECTIBLE_WIDTHS, True),
    ('Characters/equipment',   'items/equipment',    COLLECTIBLE_WIDTHS, True),
    ('Characters/avatars',     'characters/avatars', CHARACTER_WIDTHS,   True),
    ('Characters/portraits',   'characters/portraits', CHARACTER_WIDTHS, True),
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
    keep_alpha = has_real_alpha(img)
    if not keep_alpha:
        img = img.convert('RGB')

    stem = os.path.splitext(os.path.basename(src_path))[0]
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


def strip_index(stem: str) -> str:
    """`01-eclipse-longblade` -> `eclipse-longblade`."""
    parts = stem.split('-', 1)
    return parts[1] if len(parts) == 2 and parts[0].isdigit() else stem


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
    if not os.path.isdir(LIBRARY):
        print(f'error: asset library not found at {LIBRARY}', file=sys.stderr)
        print('       set ER_ASSET_LIBRARY to override.', file=sys.stderr)
        return 1

    problems: list[str] = []
    files = 0
    written = 0
    total = 0

    for src_rel, out_rel, widths, cutout in FAMILIES:
        src_dir = os.path.join(LIBRARY, src_rel)
        if not os.path.isdir(src_dir):
            problems.append(f'missing source dir: {src_rel}')
            continue
        out_dir = os.path.join(OUT_ROOT, out_rel)

        for name in sorted(os.listdir(src_dir)):
            if not name.lower().endswith('.png'):
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
