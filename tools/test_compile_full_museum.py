"""Boundary tests for imported source URLs, XML and HTML parser behavior."""
import unittest
import xml.etree.ElementTree as ET
from compile_full_museum import active_xml, asset_url, gallery_targets, menu_item, ArticleTitle, EbookCards, dimensions, compile_museum, PROJECT


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
        data = compile_museum(source, PROJECT / 'src/data/museum.json', PROJECT / '.cache/runtime-styles.json')
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
