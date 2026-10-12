#!/usr/bin/env python3
"""
import-assets.test.py — fixture tests for the importer's `Sprites/Tiles` family.

Run from the repo root:  python3 scripts/import-assets.test.py
Needs Pillow (as the importer does); skips cleanly without it. Every write goes
to a temporary library and output tree: the repo's assets and manifests are
never touched.
"""
import importlib.util
import json
import os
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('import_assets', os.path.join(HERE, 'import-assets.py'))
ia = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ia)
Image = ia.Image


@unittest.skipIf(Image is None, 'Pillow is not installed')
class TileFamily(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = self.tmp.name
        self.saved = {k: getattr(ia, k) for k in ('LIBRARY', 'OUT_ROOT', 'TILE_MANIFEST_OUT', 'SPRITE_MANIFEST_OUT')}
        ia.LIBRARY = os.path.join(root, 'lib')
        ia.OUT_ROOT = os.path.join(root, 'out')
        ia.TILE_MANIFEST_OUT = os.path.join(root, 'tile-manifest.generated.ts')
        ia.SPRITE_MANIFEST_OUT = os.path.join(root, 'sprite-manifest.generated.ts')
        self.tiles = os.path.join(ia.LIBRARY, 'Sprites', 'Tiles')
        os.makedirs(self.tiles)

    def tearDown(self):
        for k, v in self.saved.items():
            setattr(ia, k, v)
        self.tmp.cleanup()

    def strip(self, name, size=(256, 64), alpha=255, hole=None, sidecar=True):
        """An opaque W7 strip (4 variants of 64x64), optionally with a see-through pixel."""
        img = Image.new('RGBA', size, (42, 32, 39, alpha))
        for v in range(size[0] // 64):  # a different fleck per variant
            img.putpixel((v * 64 + 10 + v, 20), (87, 71, 79, alpha))
        if hole:
            img.putpixel(hole, (0, 0, 0, 0))
        img.save(os.path.join(self.tiles, name))
        if sidecar:
            frames = size[0] // 64
            with open(os.path.join(self.tiles, name[:-4] + '.json'), 'w') as fh:
                json.dump({'scale': 2, 'frame': {'w': 64, 'h': 64},
                           'actions': [{'name': 'tile', 'frames': frames, 'fps': 0, 'loop': False}]}, fh)

    def run_tiles(self, check=False):
        problems, pending = [], []
        files = ia.import_tiles(check, [], problems, pending)
        return files, problems, pending

    def test_opaque_strip_is_accepted_despite_opaque_corners(self):
        self.strip('04-tile-rock.png')
        self.strip('01-tile-dirt.png', sidecar=False)  # W7 layout inferred from the sheet
        img = Image.open(os.path.join(self.tiles, '04-tile-rock.png')).convert('RGBA')
        self.assertTrue(ia.corners_opaque(img), 'the fixture would fail the cut-out guard')
        files, problems, _ = self.run_tiles()
        self.assertEqual(files, 2)
        self.assertEqual(problems, [])
        out = os.path.join(ia.OUT_ROOT, 'sprites', 'tiles')
        for stem in ('04-tile-rock', '01-tile-dirt'):
            for suffix in ('@2x.webp', '@1x.webp', '.json'):
                self.assertTrue(os.path.isfile(os.path.join(out, stem + suffix)), stem + suffix)
        one = Image.open(os.path.join(out, '04-tile-rock@1x.webp'))
        self.assertEqual(one.size, (128, 32), '1x is an exact halving: 4 cells of the 32 px grid')
        # Lossless: the authored pixels come back exactly.
        two = Image.open(os.path.join(out, '04-tile-rock@2x.webp')).convert('RGBA')
        self.assertEqual(two.getpixel((10, 20)), (87, 71, 79, 255))
        self.assertEqual(two.getpixel((0, 0)), (42, 32, 39, 255))

    def test_manifest_entries_and_tile_for(self):
        self.strip('04-tile-rock.png')
        self.run_tiles()
        self.assertEqual(ia.write_tile_manifest(), 1)
        with open(ia.TILE_MANIFEST_OUT) as fh:
            ts = fh.read()
        self.assertIn("'tile-rock': { src: 'assets/game/sprites/tiles/04-tile-rock@1x.webp', "
                      "src2x: 'assets/game/sprites/tiles/04-tile-rock@2x.webp', size: 32, variants: 4 },", ts)
        self.assertIn('export function tileFor(nodeId: string | undefined | null): TileEntry | null', ts)
        self.assertIn('`tile-${nodeId}`', ts)
        # Tiles are not sprites: the sprite manifest never lists them.
        ia.write_sprite_manifest()
        with open(ia.SPRITE_MANIFEST_OUT) as fh:
            self.assertNotIn('tile-rock', fh.read())

    def test_empty_manifest_when_no_tiles(self):
        self.assertEqual(ia.write_tile_manifest(), 0)
        with open(ia.TILE_MANIFEST_OUT) as fh:
            self.assertIn('export const TILES: Readonly<Record<string, TileEntry>> = {\n};', fh.read())

    def test_see_through_tile_is_rejected(self):
        self.strip('15-tile-cinder-vein.png', hole=(100, 40))
        _, problems, _ = self.run_tiles()
        self.assertEqual(len(problems), 1)
        self.assertIn('15-tile-cinder-vein.png: tile is not opaque', problems[0])
        self.assertFalse(os.path.exists(os.path.join(ia.OUT_ROOT, 'sprites', 'tiles', '15-tile-cinder-vein@1x.webp')))

    def test_off_grid_and_misnamed_strips_are_rejected(self):
        self.strip('07-tile-bedrock.png', size=(192, 48), sidecar=False)  # 48 px cells are off the 32 px grid
        self.strip('Tile Rock.png')
        with open(os.path.join(self.tiles, '05-tile-hard-rock.json'), 'w') as fh:
            json.dump({'scale': 2, 'frame': {'w': 64, 'h': 64},
                       'actions': [{'name': 'idle', 'frames': 4, 'fps': 0, 'loop': False}]}, fh)
        Image.new('RGBA', (256, 64), (1, 2, 3, 255)).save(os.path.join(self.tiles, '05-tile-hard-rock.png'))
        _, problems, _ = self.run_tiles()
        text = '\n'.join(problems)
        self.assertIn('07-tile-bedrock.png: sheet is 192x48', text)
        self.assertIn('Tile Rock.png: not kebab-case', text)
        self.assertIn("05-tile-hard-rock.png: a tile strip has exactly one action, 'tile'", text)

    def test_check_mode_writes_nothing_and_missing_folder_is_pending(self):
        self.strip('04-tile-rock.png')
        files, problems, _ = self.run_tiles(check=True)
        self.assertEqual((files, problems), (1, []))
        self.assertFalse(os.path.exists(os.path.join(ia.OUT_ROOT, 'sprites', 'tiles')))
        os.remove(os.path.join(self.tiles, '04-tile-rock.png'))
        os.remove(os.path.join(self.tiles, '04-tile-rock.json'))
        os.rmdir(self.tiles)
        files, problems, pending = self.run_tiles(check=True)
        self.assertEqual((files, problems, pending), (0, [], ['Sprites/Tiles']))

    def test_other_sprite_families_keep_the_cut_out_guard(self):
        props = os.path.join(ia.LIBRARY, 'Sprites', 'Props')
        os.makedirs(props)
        Image.new('RGBA', (64, 64), (9, 9, 9, 255)).save(os.path.join(props, '22-tile-torch.png'))
        problems, pending = [], []
        ia.import_sprites(True, [], problems, pending)
        self.assertEqual(len(problems), 1)
        self.assertIn('22-tile-torch.png: opaque corners', problems[0])


if __name__ == '__main__':
    unittest.main()
