from pathlib import Path
import os,json,shutil,hashlib
from articles import ArticleParser
project=Path(__file__).resolve().parents[1]
source=Path(os.environ.get('YOUNGNAK_SOURCE',str(project.parent)))
data_path=project/'src/data/museum.json';manifest_path=project/'docs/source-map.json'
data=json.loads(data_path.read_text(encoding='utf-8'));manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
def copy(src):
 dest=project/'public/media/v1/articles'/Path(src).name;dest.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(source/'html'/src,dest)
 url='/media/v1/articles/'+dest.name
 manifest['assets'].append({'path':url,'source':'html/'+src,'kind':'local-copy','sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
 return url
for item in data['texts']:
 parser=ArticleParser(copy);parser.feed((source/item['source']).read_text(encoding='utf-8-sig'));item['html']=''.join(parser.parts)
data['scenes'][2]['ath']=180
manifest['assets']=list({a['path']:a for a in manifest['assets']}.values())
data_path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Articles refreshed; image count:',sum(t['html'].count('<img ') for t in data['texts']))
