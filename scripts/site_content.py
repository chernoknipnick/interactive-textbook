"""Metadata and searchable content derived from the actual static pages (stdlib only)."""
from html.parser import HTMLParser
from html import escape
from pathlib import Path
import re
from xml.sax.saxutils import escape as xml_escape

BASE="https://chernoknipnick.github.io/interactive-textbook/"
VOID={"meta","link","img","input","br","hr","source","wbr","area","base","embed","param","track","col"}
SKIP={"script","style","head","nav","header","footer","button","select"}
class Node:
    def __init__(self,tag="root",attrs=None): self.tag=tag;self.attrs=dict(attrs or []);self.children=[]
    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child,Node): yield from child.walk()
    def text(self,clean=True):
        if clean and (self.tag in SKIP or {"notes","term-legend"}.intersection(self.attrs.get("class","").split())): return ""
        return " ".join(c.text(clean) if isinstance(c,Node) else c for c in self.children)
class Document(HTMLParser):
    def __init__(self,source):
        super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root];self.feed(source)
    def handle_starttag(self,tag,attrs):
        node=Node(tag,attrs);self.stack[-1].children.append(node)
        if tag not in VOID:self.stack.append(node)
    def handle_startendtag(self,tag,attrs): self.handle_starttag(tag,attrs); self.handle_endtag(tag) if tag not in VOID else None
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:del self.stack[i:];break
    def handle_data(self,data):self.stack[-1].children.append(data)

def compact(text):return re.sub(r"\s+"," ",text).strip()
def read_page(source):
    root=Document(source).root
    title=next((compact(n.text(False)) for n in root.walk() if n.tag=="title"),"Учебник")
    paras=[compact(n.text()) for n in root.walk() if n.tag=="p" and len(compact(n.text()))>45]
    intro=next((p for p in paras if not p.startswith(("Цвет обозначает","Официальные материалы"))),"Учебные материалы, объяснения, примеры и задания для самостоятельной работы.")
    return title,intro,compact(root.text())

def prepare_metadata(output):
    urls=[];seen_titles=set();seen_desc=set()
    for page in sorted(output.rglob("*.html")):
        source=normalize_headings(page.read_text(encoding="utf-8"));rel=page.relative_to(output).as_posix()
        title,intro,_=read_page(source)
        if title in seen_titles:title += " · " + rel.removesuffix(".html").replace("/"," / ")
        seen_titles.add(title)
        desc=compact(title+". "+intro)[:160]
        if desc in seen_desc:desc=compact(title+" · "+rel+". "+intro)[:160]
        seen_desc.add(desc);url=BASE+rel
        source=re.sub(r"<title\b[^>]*>.*?</title>",lambda _:"<title>"+escape(title)+"</title>",source,flags=re.S|re.I)
        def remove_meta(match):
            attrs=dict(re.findall(r'([\w:-]+)=["\']([^"\']*)["\']',match[0]));name=attrs.get("name",attrs.get("property",""))
            return "" if name=="description" or name.startswith(("og:","twitter:")) else match[0]
        source=re.sub(r"<meta\b[^>]*>",remove_meta,source,flags=re.I)
        source=re.sub(r'<link\b[^>]*rel=["\']canonical["\'][^>]*>',"",source,flags=re.I)
        values=[("name","description",desc),("property","og:title",title),("property","og:description",desc),("property","og:type","article" if rel.startswith(("java/","it/","lectures/")) else "website"),("property","og:url",url),("name","twitter:card","summary")]
        tags="\n".join(f'<meta {attr}="{name}" content="{escape(value,quote=True)}">' for attr,name,value in values)
        tags+=f'\n<link rel="canonical" href="{url}">\n'
        source=source.replace("</head>",tags+"</head>",1);page.write_bytes(source.encode("utf-8"))
        if rel!="404.html":urls.append(url)
    sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+"".join("<url><loc>"+xml_escape(u)+"</loc></url>" for u in urls)+"</urlset>\n"
    (output/"sitemap.xml").write_bytes(sitemap.encode("utf-8"));(output/"robots.txt").write_bytes(("User-agent: *\nAllow: /\nSitemap: "+BASE+"sitemap.xml\n").encode())


def normalize_headings(source):
    # Notes are subordinate to the lecture; preserve anchors and relative levels.
    def notes(match):
        if not re.search(r"<h1\b",match[0]):return match[0]
        return re.sub(r"(<\/?h)([1-5])(\b)",lambda m:m[1]+str(int(m[2])+1)+m[3],match[0])
    source=re.sub(r'<details\b[^>]*class="notes"[^>]*>.*?</article></details>',notes,source,flags=re.S)
    first=True;level=1
    def heading(match):
        nonlocal first,level
        closing=bool(match[1]);attrs=match[2]
        if not closing:
            level=1 if first else 2;first=False
            if "data-page-heading" not in attrs:attrs+=' data-page-heading=""'
        return '<'+('/' if closing else '')+'h'+str(level)+attrs+'>'
    # Avoid matching sample HTML inside scripts/styles.
    chunks=re.split(r'(<script\b.*?</script>|<style\b.*?</style>)',source,flags=re.S|re.I)
    return ''.join(chunk if re.match(r'<(?:script|style)\b',chunk,re.I) else re.sub(r'<(/?)h1([^>]*)>',heading,chunk,flags=re.I) for chunk in chunks)


def build_search_index(output):
    import json
    records=[]
    for page in sorted(output.rglob("*.html")):
        rel=page.relative_to(output).as_posix()
        if rel in {"index.html","404.html","it/index.html","account/index.html","lectures/course.html"}:continue
        if not rel.startswith(("java/","it/","lectures/")) and rel!="practice.html":continue
        source=page.read_text(encoding="utf-8");title,intro,text=read_page(source)
        if rel.startswith("java/"):course="Java";url="#java-"+page.stem;kind="Практика" if page.stem.startswith("work-") else "Лекция"
        elif rel.startswith("it/"):course="Информационные технологии";url=rel;kind="Практика" if "practice" in rel else "Лекция"
        else:course="Базы данных и SQL";url="#practice" if rel=="practice.html" else "#setup";kind="Практика" if rel=="practice.html" else "Инструкция"
        records.append({"t":title,"u":url,"c":course,"k":kind,"s":intro[:200],"text":text})
    sql=(output/"lectures/course.html").read_text(encoding="utf-8")
    panels=re.split(r'<div class="lecture-panel(?: active)?" id="panel-(\d+)">',sql)
    names=["Базовые понятия","Связи между таблицами","Нормализация","SELECT и запросы","Продвинутый SQL"]
    for i in range(1,len(panels),2):
        number=panels[i];text=compact(Document(panels[i+1].split('<script',1)[0]).root.text());records.append({"t":names[int(number)-1],"u":"#"+number,"c":"Базы данных и SQL","k":"Лекция","s":text[:200],"text":text})
    # A shared word dictionary with document bitsets avoids repeating the full lectures.
    terms={}
    for index,record in enumerate(records):
        for word in set(re.findall(r"[\w]+",record.pop("text").lower().replace("ё","е"))):
            if len(word)>1:terms[word]=terms.get(word,0)|(1<<index)
    previous="";packed=[]
    alphabet="0123456789abcdefghijklmnopqrstuvwxyz"
    def base36(value):
        return alphabet[value] if value<36 else base36(value//36)+alphabet[value%36]
    for word,bits in sorted(terms.items()):
        prefix=0
        while prefix<min(len(word),len(previous)) and word[prefix]==previous[prefix]:prefix+=1
        postings=".".join(base36(i) for i in range(len(records)) if bits&(1<<i))
        mask="#"+format(bits,"x")
        packed.append(format(prefix,"x")+"|"+word[prefix:]+"|"+(mask if len(mask)<len(postings) else postings));previous=word
    payload={"documents":records,"lexicon":"\n".join(packed)}
    encoded=json.dumps(payload,ensure_ascii=False,separators=(",",":")).encode("utf-8")
    if len(encoded)>150_000:raise RuntimeError("Search index exceeded 150 KB")
    (output/"search-index.json").write_bytes(encoded)
    print(f"Search: {len(records)} materials, {len(terms)} terms, {len(encoded)} bytes")
