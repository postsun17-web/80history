import unittest
from articles import ArticleParser

class ArticlesTest(unittest.TestCase):
 def test_images_retained_without_scripts_or_remote_urls(self):
  copied=[]
  def copy(src):copied.append(src);return '/media/v1/articles/'+src.split('/')[-1]
  parser=ArticleParser(copy)
  parser.feed('<header>omit</header><main><p>원문</p><img src="./photo/a02_04_01.jpg" alt="로스 성경" onerror="bad()"><script>bad()</script><img src="https://evil.test/x"><img src="../private.jpg"></main>')
  html=''.join(parser.parts)
  self.assertEqual(copied,['photo/a02_04_01.jpg'])
  self.assertIn('alt="로스 성경"',html)
  self.assertIn('/media/v1/articles/a02_04_01.jpg',html)
  for forbidden in ('script','onerror','evil','private','omit'):self.assertNotIn(forbidden,html)

if __name__=='__main__':unittest.main()
