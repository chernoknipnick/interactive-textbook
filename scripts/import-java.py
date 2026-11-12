"""Import student lectures from an Obsidian folder and build static Java pages.

Usage: python scripts/import-java.py [path-to-Obsidian-Java-folder]
Without an argument, rebuild from the tracked content/java copies.
Requires Python Markdown and Pygments.
"""
from pathlib import Path
import re, json, html, shutil, argparse
import markdown
from pygments.formatters import HtmlFormatter
from lesson_presentation import diagram_markup, semantic_markup, legend

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / 'content/java'
OUT = ROOT / 'dist/java'
CONTENT.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
parser=argparse.ArgumentParser()
parser.add_argument('source',nargs='?')
parser.add_argument('--practice-source',help='Obsidian folder Лабораторные работы')
args=parser.parse_args()

def validate_student_copy(text):
    prose=re.sub(r'^```[^\n]*\n.*?^```\s*$', '', text, flags=re.M|re.S)
    directive=re.search(r'\[(?:ГОВОРЮ|ВОПРОС В ЗАЛ|НА ДОСКУ)\]|Попросите|Спросите у (?:группы|студентов)|На доске (?:написать|распределить)|Не (?:учить|требовать|давать весь синтаксис)|^## Организация занятия', prose, flags=re.I|re.M)
    if directive:
        raise ValueError('Student copy contains a teacher instruction: '+directive.group(0))
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
 ('static','1.2.3 Статические поля и методы','Статические поля и методы'),
 ('oop-summary','Основы ООП — заключение','Основы ООП — заключение'),
]
if args.source:
    source=Path(args.source)
    asset_source=source/'Схемы ООП'
    if asset_source.is_dir():
        asset_target=ROOT/'content/java-assets'
        asset_target.mkdir(exist_ok=True)
        for image in asset_source.glob('*.png'):
            shutil.copyfile(image,asset_target/image.name)
    for slug,base,title in topics:
        for suffix,variant in [('', 'lecture'),(' — Под запись','notes')]:
            p=source/(base+suffix+'.md')
            if p.exists():
                validate_student_copy(p.read_text(encoding='utf-8'))
                shutil.copyfile(p,CONTENT/(slug+'-'+variant+'.md'))

works=[
 ('lab01','ЛР01','Типы данных, логика и поразрядные операции','Блок 1/Лабы новые/Лаба 1 Блок 1/🧪 Лабораторная работа «Типы данных, логические выражения и поразрядные операции в Java».md',['first-program','types','bitwise']),
 ('lab02','ЛР02','Условный оператор и циклы','Блок 1/Лабы новые/Лаба 2 Блок 1/🧪 ЛР «Условный оператор и циклы в Java».md',['conditions','loops']),
 ('pr02','ПР02','Циклы, массивы и случайные числа','Блок 1/ПР02 Циклы и массивы — Задание студенту.md',['loops','arrays']),
 ('pr03','ПР03','Собственные методы','Блок 1/ПР03 Собственные методы — Задание студенту.md',['methods','arrays']),
 ('pr04','ПР04','Классы, объекты и ссылки','Блок 1/ПР04 Классы объекты и ссылки — Задание студенту.md',['classes','references','arrays']),
 ('pr05','ПР05','Конструкторы, инкапсуляция и static','Блок 1/ПР05 Конструкторы инкапсуляция и static — Задание студенту.md',['constructors','static','classes']),
 ('pr06','ПР06','Итоговая система объектов','Блок 1/ПР06 Итоговая система объектов — Задание студенту.md',['oop-summary','arrays','methods','static']),
]
practice_content=ROOT/'content/java-practice'
practice_content.mkdir(parents=True,exist_ok=True)
if args.practice_source:
    source=Path(args.practice_source)
    for slug,number,title,relative,related in works:
        p=source/relative
        if not p.is_file():raise FileNotFoundError(p)
        shutil.copyfile(p,practice_content/(slug+'.md'))

aliases={}
for slug,base,title in topics:
    aliases[title]=slug
    aliases[re.sub(r'^[\d.]+\s+', '', base)]=slug
    for suffix in ['', ' — Под запись',' — Лекция преподавателю']:
        aliases[base+suffix]=slug
for slug,number,title,relative,related in works:
    aliases[Path(relative).stem]='work-'+slug
aliases['Классы и объекты — Разбор каждой строки']='classes'

unresolved=set()
asset_source=ROOT/'content/java-assets'
if asset_source.is_dir():
    shutil.copytree(asset_source,OUT/'images',dirs_exist_ok=True)
def render(text,prefix):
    validate_student_copy(text)
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
    def picture(match):
        name=match.group(1).split('|')[0].split('/')[-1]
        return diagram_markup(name,asset_source)
    text=re.sub(r'!\[\[([^\]]+)\]\]',picture,text)
    text=re.sub(r'\[\[([^\]]+)\]\]',wiki,text)
    body=markdown.markdown(text,extensions=['extra','toc','sane_lists','codehilite'],extension_configs={'toc':{'permalink':False},'codehilite':{'guess_lang':False}})
    body=semantic_markup(body)
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
        visual=ROOT/'content/java-visuals'/(slug+'.html')
        if j==0 and visual.is_file():
            body=re.sub(r'</h1>',lambda m:m[0]+visual.read_text(encoding='utf-8'),body,count=1)
        if j==0:
            body=re.sub(r'</h1>',lambda match:match[0]+legend(),body,count=1)
        if j==0: sections+='<article>'+body+'</article>'
        else:sections+='<details class="notes"><summary>Конспект · Под запись</summary><article>'+body+'</article></details>'
    prev=f'<a target="_top" href="../#java-{topics[i-1][0]}">← {html.escape(topics[i-1][2])}</a>' if i else '<a target="_top" href="../#java">← К программе Java</a>'
    nxt=f'<a target="_top" href="../#java-{topics[i+1][0]}">{html.escape(topics[i+1][2])} →</a>' if i+1<len(topics) else '<a target="_top" href="../#java">К программе Java →</a>'
    page=f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)} · Java</title><link rel="stylesheet" href="lecture.css?v=5"></head><body><main><div class="eyebrow">JAVA / ТЕМА {i+1:02d} ИЗ {len(topics)} · {versions[0][1].upper()}</div><div class="tools"><button id="outline-toggle" aria-expanded="false" aria-controls="outline">Содержание темы ↓</button><span>Авторские материалы из Obsidian</span></div><nav id="outline" hidden aria-label="Содержание темы"></nav>{sections}<footer>{prev}{nxt}</footer></main><script src="lecture.js?v=3"></script></body></html>'''
    page=page.replace('</head>','<link rel="stylesheet" href="lesson-semantics.css?v=1"></head>').replace('</body>','<script src="lesson-semantics.js?v=2"></script></body>')
    if (ROOT/'content/java-visuals'/(slug+'.html')).is_file():
        page=page.replace('</head>','<link rel="stylesheet" href="visuals.css?v=6"></head>').replace('</body>','<script src="visuals.js?v=8"></script></body>')
    if slug in {'references','classes','constructors','static'}:
        page=page.replace('</head>','<link rel="stylesheet" href="oop-visuals.css?v=1"></head>').replace('</body>','<script src="oop-visuals.js?v=2"></script></body>')
    if 'data-course-trace=' in page:
        page=page.replace('</head>','<link rel="stylesheet" href="course-traces.css?v=1"></head>').replace('</body>','<script src="course-traces.js?v=1"></script></body>')
    if slug == 'oop-summary':
        page=page.replace('</head>','<link rel="stylesheet" href="oop-summary.css?v=1"></head>')
    (OUT/(slug+'.html')).write_text(page,encoding='utf-8')

(ROOT/'dist/java-lessons.js').write_text('window.javaLessons='+json.dumps(lessons,ensure_ascii=False)+';\n',encoding='utf-8')
practice=[]
for i,(slug,number,title,relative,related) in enumerate(works):
    p=practice_content/(slug+'.md')
    if not p.exists():continue
    body=render(p.read_text(encoding='utf-8'),'work-'+slug)
    if not re.search(r'<h1\b',body):body='<h1>'+html.escape(title)+'</h1>'+body
    practice_visual=ROOT/'content/java-practice-visuals'/(slug+'.html')
    if practice_visual.is_file():
        body=re.sub(r'</h1>',lambda match:match[0]+practice_visual.read_text(encoding='utf-8'),body,count=1)
    body=re.sub(r'</h1>',lambda match:match[0]+legend(),body,count=1)
    related_links=''.join('<a target="_top" href="../#java-'+t+'">'+html.escape(next(x[2] for x in topics if x[0]==t))+'</a>' for t in related)
    previous=f'<a target="_top" href="../#java-work-{works[i-1][0]}">← {html.escape(works[i-1][1])}</a>' if i else '<a target="_top" href="../#java-practice">← Все практические работы</a>'
    following=f'<a target="_top" href="../#java-work-{works[i+1][0]}">{html.escape(works[i+1][1])} →</a>' if i+1<len(works) else '<a target="_top" href="../#java-practice">Все практические работы →</a>'
    page=f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{number}. {html.escape(title)} · Java</title><link rel="stylesheet" href="lecture.css?v=5"></head><body><main><div class="eyebrow">JAVA / ПРАКТИКА / {number} · ЗАДАНИЕ СТУДЕНТУ</div><div class="tools"><button id="outline-toggle" aria-expanded="false" aria-controls="outline">Содержание работы ↓</button><span>Авторские материалы из Obsidian</span></div><nav id="outline" hidden aria-label="Содержание работы"></nav><div class="related"><strong>Повторить перед работой</strong>{related_links}</div><article>{body}</article><footer>{previous}{following}</footer></main><script src="lecture.js?v=3"></script></body></html>'''
    page=page.replace('</head>','<link rel="stylesheet" href="lesson-semantics.css?v=1"></head>')
    if practice_visual.is_file():
        page=page.replace('</head>','<link rel="stylesheet" href="course-traces.css?v=1"></head>').replace('</body>','<script src="lesson-semantics.js?v=2"></script><script src="course-traces.js?v=1"></script></body>')
    (OUT/('work-'+slug+'.html')).write_text(page,encoding='utf-8')
    practice.append({'id':slug,'number':number,'title':title,'related':related})
(ROOT/'dist/java-practices.js').write_text('window.javaPractices='+json.dumps(practice,ensure_ascii=False)+';\n',encoding='utf-8')
(OUT/'highlight.css').write_text(HtmlFormatter(style='native').get_style_defs('.codehilite'),encoding='utf-8')
print(f'Built {len(lessons)} topics, {sum(x["full"] for x in lessons)} full lectures plus notes.')
print(f'Built {len(practice)} student practical/lab assignments.')
print('References outside imported topics (rendered as text): '+', '.join(sorted(unresolved)))


