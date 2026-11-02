"""Import student lectures from an Obsidian folder and build static Java pages.

Usage: python scripts/import-java.py [path-to-Obsidian-Java-folder]
Without an argument, rebuild from the tracked content/java copies.
Requires Python Markdown and Pygments.
"""
from pathlib import Path
import sys, re, json, html, shutil
import markdown
from pygments.formatters import HtmlFormatter

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / 'content/java'
OUT = ROOT / 'dist/java'
CONTENT.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
topics = [
 ('languages','00 Обзор языков программирования','Обзор языков программирования'),
 ('intro','0 Введение в курс','Введение в курс'),
 ('first-program','0.5 Первая программа на Java структура и запуск','Первая программа на Java'),
 ('types','1 Типы данных и операции','Типы данных и операции'),
 ('bitwise','1.1.2 Поразрядные операции','Поразрядные операции'),
 ('conditions','2 Условный оператор','Условный оператор'),
 ('loops','1.1.4 Циклы','Циклы'),
 ('arrays','1.1.5 Массивы','Массивы'),
 ('methods','3 Методы (процедуры и функции)','Методы: процедуры и функции'),
 ('references','1.1.7 Ссылки','Ссылки'),
 ('classes','1.2.1 Классы и объекты','Классы и объекты'),
 ('constructors','1.2.2 Конструкторы','Конструкторы'),
]
if len(sys.argv)>1:
    source=Path(sys.argv[1])
    for slug,base,title in topics:
        for suffix,variant in [('', 'lecture'),(' — Под запись','notes')]:
            p=source/(base+suffix+'.md')
            if p.exists(): shutil.copyfile(p,CONTENT/(slug+'-'+variant+'.md'))

aliases={}
for slug,base,title in topics:
    aliases[title]=slug
    aliases[re.sub(r'^[\d.]+\s+', '', base)]=slug
    for suffix in ['', ' — Под запись',' — Лекция преподавателю']:
        aliases[base+suffix]=slug

unresolved=set()
def render(text,prefix):
    # Vault tags and Obsidian links are presentation metadata, not instructions.
    text=re.sub(r'^#[^\s#]+(?:\s+#[^\s#]+)*\s*\n','',text,count=1)
    def wiki(m):
        target,_,label=m.group(1).partition('|')
        name=target.split('/')[-1].split('#')[0].removesuffix('.md').rstrip('.')
        label=label or name
        if name in aliases:
            return '<a target="_top" href="../#java-'+aliases[name]+'">'+html.escape(label)+'</a>'
        unresolved.add(name)
        return html.escape(label)
    text=re.sub(r'\[\[([^\]]+)\]\]',wiki,text)
    body=markdown.markdown(text,extensions=['extra','toc','sane_lists','codehilite'],extension_configs={'toc':{'permalink':False},'codehilite':{'guess_lang':False}})
    return re.sub(r'(<h[1-6] id=")([^"]+)',lambda m:m[1]+prefix+'-'+m[2],body)

lessons=[]
for i,(slug,base,title) in enumerate(topics):
    versions=[]
    for variant,label in [('lecture','Лекция'),('notes','Под запись')]:
        p=CONTENT/(slug+'-'+variant+'.md')
        if p.exists():versions.append((variant,label,render(p.read_text(encoding='utf-8'),variant)))
    if not versions:raise RuntimeError('Missing lecture: '+slug)
    lessons.append({'id':slug,'title':title,'number':f'{i+1:02d}','full':any(v[0]=='lecture' for v in versions)})
    sections=''
    for j,(variant,label,body) in enumerate(versions):
        if j==0: sections+='<article>'+body+'</article>'
        else:sections+='<details class="notes"><summary>Конспект · Под запись</summary><article>'+body+'</article></details>'
    prev=f'<a target="_top" href="../#java-{topics[i-1][0]}">← {html.escape(topics[i-1][2])}</a>' if i else '<a target="_top" href="../#java">← К программе Java</a>'
    nxt=f'<a target="_top" href="../#java-{topics[i+1][0]}">{html.escape(topics[i+1][2])} →</a>' if i+1<len(topics) else '<a target="_top" href="../#java">К программе Java →</a>'
    page=f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)} · Java</title><link rel="stylesheet" href="lecture.css?v=3"></head><body><main><div class="eyebrow">JAVA / ТЕМА {i+1:02d} ИЗ {len(topics)} · {versions[0][1].upper()}</div><div class="tools"><button id="outline-toggle" aria-expanded="false" aria-controls="outline">Содержание темы ↓</button><span>Авторские материалы из Obsidian</span></div><nav id="outline" hidden aria-label="Содержание темы"></nav>{sections}<footer>{prev}{nxt}</footer></main><script src="lecture.js?v=3"></script></body></html>'''
    (OUT/(slug+'.html')).write_text(page,encoding='utf-8')

(ROOT/'dist/java-lessons.js').write_text('window.javaLessons='+json.dumps(lessons,ensure_ascii=False)+';\n',encoding='utf-8')
(OUT/'highlight.css').write_text(HtmlFormatter(style='native').get_style_defs('.codehilite'),encoding='utf-8')
print(f'Built {len(lessons)} topics, {sum(x["full"] for x in lessons)} full lectures plus notes.')
print('References outside imported topics (rendered as text): '+', '.join(sorted(unresolved)))
