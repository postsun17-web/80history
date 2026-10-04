from html.parser import HTMLParser
from pathlib import Path
import json,posixpath,re,argparse
from urllib.parse import urlsplit,unquote
class ArticleParser(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.skip=0;self.buf=[];self.paragraphs=[];self.images=[];self.title='';self.heading=False
 def flush(self):
  text=re.sub(r'\s+',' ',' '.join(self.buf)).strip();self.buf=[]
  if text and not text.startswith('©'):self.paragraphs.append(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag in ('script','style','head','footer'):self.skip+=1
  if self.skip:return
  if tag in ('p','div','h1','h2','h3','li','figcaption','br'):self.flush()
  if tag in ('h1','h2'):self.heading=True
  if tag=='img':
   raw=unquote(a.get('src',''));parts=urlsplit(raw)
   if parts.scheme or parts.netloc or '\\' in raw:return
   path=posixpath.normpath(parts.path if parts.path.startswith('/media/full/') else '/media/full/html/'+parts.path)
   if path.startswith('/media/full/') and path!=' /media/full/':self.images.append({'src':path,'alt':a.get('alt','')})
 def handle_endtag(self,tag):
  if tag in ('script','style','head','footer'):self.skip=max(0,self.skip-1);return
  if self.skip:return
  if tag in ('h1','h2'):
   if not self.title:self.title=re.sub(r'\s+',' ',' '.join(self.buf)).strip()
   self.heading=False
  if tag in ('p','div','h1','h2','h3','li','figcaption'):self.flush()
 def handle_data(self,text):
  if not self.skip:self.buf.append(text)
def build(source,output):
 result={}
 # Source page labels provide concise provenance-backed headings for body-only HTML.
 museum=json.loads((Path(__file__).resolve().parent.parent/'src/data/full-museum.json').read_text(encoding='utf-8'))
 titles={}
 for zone in museum['zones']:
  for page in zone['pages']:
   for hotspot in page['hotspots']:
    attrs={}
    for style in hotspot['attrs'].get('style','').split('|'):attrs.update(museum['styles'].get(style,{}))
    attrs.update(hotspot['attrs'])
    for key in re.findall(r'html/[\w-]+\.html',attrs.get('onclick','')+' '+attrs.get('onloaded','')):
     titles.setdefault(key,page['title'] or zone['title'])
 for path in sorted(Path(source).glob('*.html')):
  parser=ArticleParser();parser.feed(path.read_text(encoding='utf-8'));parser.flush();key='html/'+path.name
  title=parser.title if parser.title and len(parser.title)<=60 else titles.get(key,'역사 자료 · '+path.stem)
  result[key]={'path':key,'title':title,'paragraphs':parser.paragraphs,'images':parser.images}
 Path(output).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');Path(output).with_name('visitor-article-index.json').write_text(json.dumps({key:{'title':value['title']} for key,value in result.items()},ensure_ascii=False,indent=2),encoding='utf-8');print(f'Extracted {len(result)} articles')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',default='E:/CodexAssets/youngnak-full/html');p.add_argument('--output',default='src/data/visitor-articles.json');a=p.parse_args();build(a.source,a.output)
