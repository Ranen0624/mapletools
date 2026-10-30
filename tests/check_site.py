"""Static link/content validation. Does not launch a browser or preview server."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,hashlib,re,subprocess
ROOT=Path(__file__).resolve().parents[1]
PAGES=['index.html','demo.html','privacy.html','terms.html','download.html','coordi.html','updates.html','mystery.html']
class Page(HTMLParser):
 def __init__(self,text):
  super().__init__(convert_charrefs=True);self.ids=[];self.links=[];self.lang=None;self.headings=0;self.controls=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='html':self.lang=a.get('lang')
  if tag=='h1':self.headings+=1
  if tag=='iframe':assert a.get('title') and a.get('loading')=='lazy'
  if a.get('target')=='_blank':assert 'noopener' in a.get('rel','')
  if 'aria-controls' in a:self.controls.extend(a['aria-controls'].split())
  for key in ['src','href']:
   if key in a:self.links.append(a[key])
pages={name:Page((ROOT/name).read_text(encoding='utf-8')) for name in PAGES}
links=0
for name,p in pages.items():
 assert p.lang=='ko',name
 assert len(p.ids)==len(set(p.ids)),('duplicate id',name)
 if name!='download.html':assert p.headings==1,(name,p.headings)
 for target in p.controls:assert target in p.ids,(name,target)
 for link in p.links:
  u=urlsplit(link)
  assert u.scheme not in ('javascript','data'),(name,link)
  if u.scheme or u.netloc:continue
  dest=(ROOT/unquote(u.path).lstrip('/')).resolve() if u.path else ROOT/name
  assert dest.is_relative_to(ROOT) and dest.is_file(),(name,link)
  if u.fragment and dest.name in pages:assert u.fragment in pages[dest.name].ids,(name,link)
  links+=1
release=json.loads((ROOT/'releases.json').read_text(encoding='utf-8'))
public_files=set()
for key,version in [('public_windows','2.0.8'),('public_android','1.0.9')]:
 item=release[key]; data=(ROOT/item['file']).read_bytes()
 assert item['version']==version and item['public_download'] and item['requires_user_key']
 assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256']
 assert item['file'] in pages['index.html'].links
 public_files.add(item['file'])
assert release['web_demo_reference_version']=='2.0.4'
dev_manifest=ROOT/'developer-builds.json'
if dev_manifest.exists():
 item=json.loads(dev_manifest.read_text(encoding='utf-8'))['android'];data=(ROOT/item['file']).read_bytes()
 assert item['application_id']=='kr.mapletools.personal.dev' and item['requires_user_key']
 assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256']
 public_files.add(item['file'])
text=(ROOT/'index.html').read_text(encoding='utf-8')+(ROOT/'app.js').read_text(encoding='utf-8')
for term in ['장비','유니온','코디','전투력','HEXA','모아보기','2.0.8','1.0.9','제논','데몬어벤져']:assert term in text,term
for name in ['app.js','demo.js','demo-engine.js','coordi.js','coordi-engine.js','coordi-picker.js','data-mate.js','csv-worker.js','csv-statistics.js','mate-rig.js']:subprocess.run(['node','--check',str(ROOT/name)],check=True)
# Only verified public release files may be added under downloads.
changed=subprocess.check_output(['git','status','--porcelain','--no-renames','--untracked-files=all'],cwd=ROOT,text=True)
for line in changed.splitlines():
 name=line[3:]
 assert not name.endswith(('.jks','.keystore')) and 'PERSONAL' not in name.upper(),name
 if (name.startswith('downloads/') or name.endswith('.apk')) and line[:2].strip()!='D':assert name in public_files,name
assert not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(',''.join((ROOT/n).read_text(encoding='utf-8') for n in ['app.js','demo.js','demo-engine.js','data-mate.js','csv-worker.js','csv-statistics.js','mate-rig.js']))
print(json.dumps(dict(pages=len(pages),local_links_checked=links,unique_ids=True,version_scope=True,public_download_hashes=True,no_private_artifacts=True,javascript_syntax=True,no_character_api_requests=True,browser_visual_validation=False),ensure_ascii=False))
