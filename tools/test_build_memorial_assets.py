import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from PIL import Image
import build_memorial_assets as builder
from build_memorial_assets import compile_catalog, original_tile_path, source_tile_jobs, target_levels


FIXTURE = '''<krpano><style name="object_button" url="%FIRSTXML%/images/object.png"/>
<scene name="scene_vr11" title="vr11" onstart="stopallsounds(); playsound(so1, '%VIEWER%/mp3/h01.mp3', false, 0.7);">
<view hlookat="90" vlookat="0" fov="120"/><image><cube url="panos/vr11.tiles/%s/l%l/%0v/l%l_%s_%0v_%0h.jpg" multires="512,640,1280,2560,5120"/></image>
<hotspot name="go" linkedscene="scene_vr11" ath="12" atv="4"/>
<hotspot name="obj" tooltip="템플턴 매달" onclick="popup2('iframe', 'https://spinzam.com/shot/?idx=519163', 800, 600, false);"/>
</scene></krpano>'''


class MemorialCompilerContracts(unittest.TestCase):
    def test_native_tiles_preserve_source_resolution_with_power_of_two_grid(self):
        levels = target_levels([1024, 2176, 4352, 8704])
        self.assertEqual([x['faceSize'] for x in levels], [1024, 2176, 4352, 8704])
        self.assertEqual([x['tiles'] for x in levels], [2, 4, 8, 16])
        self.assertTrue(all(x['faceSize'] % x['tiles'] == 0 for x in levels))
        self.assertEqual(target_levels([1152, 2304, 4608, 8960])[-1]['tiles'], 16)

    def test_source_rows_and_columns_are_one_based_two_digit(self):
        self.assertEqual(original_tile_path('panos/x.tiles/%s/l%l/%0v/l%l_%s_%0v_%0h.jpg', 'f', 4, 0, 16),
                         'panos/x.tiles/f/l4/01/l4_f_01_17.jpg')

    def test_partial_original_edge_tiles_are_not_padded_or_discarded(self):
        jobs = source_tile_jobs({'sizes': [8960], 'tileSize': 512,
                                 'pattern': 'panos/x/%s/%l/%0v_%0h.jpg'}, 'u', 1)
        self.assertEqual(len(jobs), 18 * 18)
        self.assertEqual(jobs[17], ('panos/x/u/1/01_18.jpg', (256, 512)))
        self.assertEqual(jobs[-1], ('panos/x/u/1/18_18.jpg', (256, 256)))

    def test_catalog_preserves_graph_and_narration_but_localizes_runtime_assets(self):
        catalog, sources = compile_catalog(FIXTURE)
        scene = catalog['scenes'][0]
        self.assertEqual(scene['view'], [90, 0, 120])
        self.assertEqual(scene['hotspots'][0]['attrs']['linkedscene'], 'scene_vr11')
        self.assertEqual(scene['narration'], {'src': '/media/memorial/mp3/h01.mp3', 'title': '한경직목사기념관 입구 해설', 'volume': 0.7})
        self.assertEqual(catalog['objects']['519163']['title'], '템플턴 메달')
        self.assertEqual(len(catalog['objects']['519163']['frames']), 36)
        self.assertEqual(catalog['styles']['object_button']['url'], '/media/memorial/images/object.png.webp')
        self.assertEqual(sources[0]['sizes'], [640, 1280, 2560, 5120])

    def test_resume_rebuilds_a_missing_tile_even_when_completion_marker_exists(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = {'id': 'test', 'sizes': [6], 'tileSize': 4,
                      'pattern': 'panos/x/%s/l%l/%0v_%0h.jpg',
                      'levels': [{'faceSize': 6, 'tiles': 2, 'level': 1}]}
            with patch.multiple(builder, SOURCE=root / 'source', OUTPUT=root / 'output'):
                for path, size in source_tile_jobs(source, 'f', 1):
                    destination = builder.SOURCE / path
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    with Image.new('RGB', size, '#be9d70') as tile:
                        tile.save(destination, 'JPEG')
                self.assertIn('converted 5', builder.build_face(source, 'f'))
                self.assertIn('cached', builder.build_face(source, 'f'))
                missing = builder.OUTPUT / 'panos/test/f/1/0_0.webp'
                missing.unlink()
                self.assertIn('converted 5', builder.build_face(source, 'f'))
                with Image.open(missing) as image:
                    self.assertEqual(image.size, (3, 3))


if __name__ == '__main__':
    unittest.main()
