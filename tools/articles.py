"""Sanitize local article markup while retaining its source images."""
from html.parser import HTMLParser
from html import escape
from pathlib import PurePosixPath

class ArticleParser(HTMLParser):
 def __init__(self,copy_image):
  super().__init__();self.depth=0;self.parts=[];self.ignored=0;self.copy_image=copy_image
 def handle_starttag(self,tag,attrs):
  if tag=='main':self.depth+=1
  if not self.depth:return
  if tag in ('script','style'):self.ignored+=1
  if self.ignored:return
  allowed=('p','h1','h2','h3','h4','ul','ol','li','table','thead','tbody','tr','td','th','strong','em','br')
  if tag in allowed:self.parts.append('<'+tag+'>')
  if tag=='img':
   attrs=dict(attrs);src=attrs.get('src','');path=PurePosixPath(src)
   if src.startswith(('./photo/','photo/')) and '..' not in path.parts and path.suffix.lower() in ('.jpg','.png','.jpeg','.webp'):
    url=self.copy_image(str(path))
    self.parts.append('<img src="'+escape(url,quote=True)+'" alt="'+escape(attrs.get('alt',''),quote=True)+'" loading="lazy">')
 def handle_endtag(self,tag):
  if not self.depth:return
  if tag in ('script','style'):self.ignored=max(0,self.ignored-1);return
  if not self.ignored and tag in ('p','h1','h2','h3','h4','ul','ol','li','table','thead','tbody','tr','td','th','strong','em'):self.parts.append('</'+tag+'>')
  if tag=='main':self.depth-=1
 def handle_data(self,data):
  if self.depth and not self.ignored:self.parts.append(escape(data))
