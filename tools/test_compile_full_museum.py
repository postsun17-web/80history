"""Boundary tests for imported source URLs, XML and HTML parser behavior."""
import unittest
from collections import Counter
import copy
import json
from pathlib import Path
import tempfile
import xml.etree.ElementTree as ET
from compile_full_museum import active_xml, asset_url, gallery_targets, menu_item, ArticleTitle, EbookCards, dimensions, compile_museum, PROJECT
from verify_full_museum import verify


@unittest.skipUnless((PROJECT / '.cache/full-source/tour.xml').exists(), 'Requires delivered source text cache')
class OriginalRoomRestorationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = PROJECT / '.cache/full-source'
        cls.data = compile_museum(cls.source, PROJECT / '.cache/runtime-styles.json')
        cls.originals = cls.xml('tour.xml').findall('scene') + cls.xml('outside.xml').findall('scene')

    @classmethod
    def xml(cls, name):
        return ET.fromstring(active_xml((cls.source / name).read_text(encoding='utf-8-sig')))

    def test_only_original_viewpoints_and_exact_direct_connections_are_compiled(self):
        scenes = self.data['scenes']
        self.assertEqual({s['id'] for s in scenes}, {s.get('name').lower() for s in self.originals})
        self.assertEqual(len(scenes), 62)
        self.assertEqual(sum(s['id'].startswith('scene_e-') for s in scenes), 8)
        expected = Counter((s.get('name').lower(), h.get('name'), h.get('linkedscene').lower())
                           for s in self.originals for h in s.findall('hotspot') if h.get('linkedscene'))
        actual = Counter((s['id'], h['name'], h['attrs']['linkedscene'].lower())
                         for s in scenes for h in s['hotspots'] if h['attrs'].get('linkedscene'))
        self.assertEqual(sum(expected.values()), 188)
        self.assertEqual(actual, expected)

    def test_original_floorplan_dimensions_and_every_source_point_are_restored(self):
        self.assertEqual(self.data['mapSize'], [1733, 2220])
        points = {n.get('erscena').lower(): n for n in self.xml('floorplan_SM/setting_FP.xml').iter('layer') if n.get('erscena')}
        actual = {s['id']: s['map'] for s in self.data['scenes'] if s.get('map')}
        self.assertEqual(len(actual), 51)
        self.assertEqual(set(actual), set(points))
        for scene, point in points.items():
            self.assertAlmostEqual(actual[scene]['x'], float(point.get('x')) / 1733 * 100)
            self.assertAlmostEqual(actual[scene]['y'], float(point.get('y')) / 2220 * 100)
            self.assertEqual(actual[scene]['heading'], float(point.get('heading2', '0')))

    def test_c02_uses_original_panorama_panel_and_all_eight_source_pages(self):
        scene = next(s for s in self.data['scenes'] if s['id'] == 'scene_c-s-e+1')
        self.assertEqual(scene['pano'], {'root': '/media/full/panos/scene_c-s-e+1', 'faceSize': 2048, 'tiles': 4, 'level': 2, 'ext': 'webp'})
        panel = next(h['attrs'] for h in scene['hotspots'] if h['name'] == 'sector_c02_01')
        for key, expected in {'ath': '90', 'atv': '15.91', 'width': '759.36', 'rx': '16.7', 'edge': 'bottom'}.items():
            self.assertEqual(panel[key], expected)
        zone = next(z for z in self.data['zones'] if z['id'] == 'c02')
        source = self.xml('list_c02_action.xml')
        self.assertEqual([p['number'] for p in zone['pages']], list(range(1, 9)))
        for page in zone['pages']:
            number = page['number']
            self.assertEqual(page['image'], f'/media/full/img/sector_c02_{number:02}.png.webp')
            self.assertEqual([h['attrs'] for h in page['hotspots']], [h.attrib for h in source.findall('hotspot') if h.get('tag') == f'{number}p'])
        self.assertEqual(sum(len(z['pages']) for z in self.data['zones']), 207)

    def test_verifier_rejects_reintroduced_rooms_portal_map_and_extra_connections(self):
        modified = copy.deepcopy(self.data)
        c02 = next(s for s in modified['scenes'] if s['id'] == 'scene_c-s-e+1')
        extension = copy.deepcopy(c02)
        extension['id'] = 'scene_ext-e-entry'
        modified['scenes'].append(extension)
        c02['pano']['root'] = '/media/v1/panos/c-right'
        c02['map']['x'] = 1433 / 2200 * 100
        modified['mapSize'] = [2200, 2220]
        c02['hotspots'].append({'name': 'invented-connection', 'attrs': {'name': 'invented-connection', 'linkedscene': 'scene_f-c-0'}})
        with tempfile.TemporaryDirectory(prefix='restoration-verifier-') as folder:
            root = Path(folder)
            (root / 'src/data').mkdir(parents=True)
            (root / 'src/data/full-museum.json').write_text(json.dumps(modified), encoding='utf-8')
            result = verify(root, self.source)
        categories = {error['category'] for error in result['errors']}
        self.assertTrue({'scenes', 'panoramas', 'floorplan', 'scene-links'}.issubset(categories), categories)


class SourceParserTests(unittest.TestCase):
    def test_gallery_zero_and_two_digit_indices_are_not_scene_names(self):
        self.assertEqual(gallery_targets("popup2('iframe','./photo/a07-2/index.html?startscene=0'); popup('iframe','photo/a06/index.html?startscene=12')"), {("a07-02", 0), ("a06", 12)})

    def test_scene_plus_sign_case_and_negative_arrival_view(self):
        node = ET.fromstring('<layer html="전시실[br]안내" onclick="loadscene(scene_A-s-w-1+, null, MERGE); lookto(-180,0,110);"/>')
        item = menu_item(node, {"scene_a-s-w-1+"})
        self.assertEqual(item["scene"], "scene_a-s-w-1+")
        self.assertEqual(item["look"], [-180, 0, 110])
        self.assertEqual(item["title"], "전시실 안내")

    def test_source_aliases_preserve_original_image_extension(self):
        self.assertEqual(asset_url("%SWFPATH%/images/abc.jpg"), "/media/full/images/abc.jpg.webp")
        self.assertEqual(asset_url("./html/a02_03.html?"), "/media/full/html/a02_03.html")

    def test_commented_scene_is_not_parsed(self):
        xml = ET.fromstring(active_xml('<krpano><!--<scene name="old"/>--><scene name="real"/></krpano>'))
        self.assertEqual([n.get("name") for n in xml.findall("scene")], ["real"])

    def test_book_nested_caption_and_wrapped_url(self):
        parser = EbookCards()
        parser.feed('<div class="gallery-item" data-cat="역사" onclick="window.open(\'https://heyzine.com/flip-book/abc.\nhtml\')"><img src="./images/a.jpg"><div class="caption">우리 <b>교회</b> 역사</div></div>')
        self.assertEqual(len(parser.cards), 1)
        self.assertEqual(parser.cards[0]["title"], "우리 교회 역사")
        self.assertEqual(parser.cards[0]["url"], "https://heyzine.com/flip-book/abc.html")

    def test_article_title_uses_heading_over_generic_document_title(self):
        parser = ArticleTitle()
        parser.feed('<title>영락교회</title><h2>교육의 <b>발전</b></h2><p>본문</p>')
        self.assertEqual(parser.result("fallback"), "교육의 발전")

    def test_source_misspelled_book_click_retains_available_reader(self):
        parser = EbookCards()
        parser.feed('<div class="gallery-item" nclick="window.open(\'https://heyzine.com/flip-book/9f793a219f.html\')"><img src="images/ebook15.jpg"><div>베들레헴찬양대</div></div>')
        self.assertEqual(parser.cards[0]["url"], "https://heyzine.com/flip-book/9f793a219f.html")

    def test_multires_flat_width_height_differ(self):
        self.assertEqual(dimensions(ET.fromstring('<flat multires="512,1024x718,3840x2688"/>')), (3840, 2688))

    @unittest.skipUnless((PROJECT / '.cache/full-source/tour.xml').exists(), 'Requires delivered source text cache')
    def test_medallion_typo_repair_preserves_source_planes_without_invented_clicks(self):
        source = PROJECT / '.cache/full-source'
        original = ET.fromstring(active_xml((source / 'tour.xml').read_text(encoding='utf-8-sig')))
        data = compile_museum(source, PROJECT / '.cache/runtime-styles.json')
        self.assertEqual(data['assets']['images/obob002-3.png'], '/media/full/images/ob002-3.png.webp')
        affected = 0
        for scene in original.findall('scene'):
            for node in scene.findall('hotspot'):
                if node.get('url') == '%FIRSTXML%/images/obob002-3.png':
                    compiled_scene = next(s for s in data['scenes'] if s['id'] == scene.get('name').lower())
                    copied = next(h for h in compiled_scene['hotspots'] if h['name'] == node.get('name'))
                    self.assertEqual(copied['attrs'], node.attrib)
                    self.assertNotIn('onclick', copied['attrs'])
                    affected += 1
        self.assertEqual(affected, 2)


if __name__ == "__main__":
    unittest.main()
