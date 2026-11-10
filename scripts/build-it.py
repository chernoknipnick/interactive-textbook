"""Build the ОП.03 section from content/it. Requires Python Markdown."""

from html import escape, unescape
from pathlib import Path
import re

import markdown
from markdown.extensions.toc import slugify_unicode


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content/it"
OUTPUT = ROOT / "dist/it"
TOPICS = (
    ("01", "Информационные технологии", "Классификация, области применения, модели и средства", "19 ч лекций · 2 ч практики"),
    ("02", "Информационные процессы", "Извлечение, оценка, передача, обработка, хранение и использование", "19 ч лекций · 2 ч практики"),
    ("03", "Средства реализации", "Word, Excel, Access, Mathcad, презентации и распределённые системы", "10 ч лекций · 26 ч практики"),
)
TERMS = (
    ("global", "Глобальный уровень"),
    ("base", "Базовый уровень"),
    ("concrete", "Конкретный уровень"),
    ("source", "Источники и входные данные"),
    ("action", "Операции и процессы"),
    ("result", "Результаты и показатели"),
    ("software", "Программные средства"),
)
PRACTICE = (
    ("ПР01", "Классификация информационных технологий", 2, "Уже выдана. Отчёт с наблюдением в DevTools и его обоснованием", "01"),
    ("ПР02", "Методы количественной оценки информации", 2, "Исходные данные, вычисления, единицы и контрольный ответ", "13"),
    ("ПР03", "Текстовый процессор MS Word", 4, "Оглавление, таблица сценариев и оформленный документ", "20"),
    ("ПР04", "Табличный процессор MS Excel", 4, "Реестр, формула, сводная таблица и сверка итога", "21"),
    ("ПР05", "СУБД MS Access", 6, "Схема связей, запрос и результат", "22"),
    ("ПР06", "Математический пакет Mathcad", 8, "Расчётный лист, два сценария и ручная проверка", "23"),
    ("ПР07", "Подготовка компьютерных презентаций", 4, "Слайды, проверяемый вывод и защита", "24"),
)


def load_lessons():
    lessons = {}
    for topic, _, _, _ in TOPICS:
        text = (SOURCE / f"{topic}.md").read_text(encoding="utf-8")
        sections = re.split(r"^## (\d\d)\. (.+)$", text, flags=re.MULTILINE)
        if sections[0].strip():
            raise ValueError(f"Unexpected content before the first lecture in {topic}.md")
        for i in range(1, len(sections), 3):
            number, title, body = sections[i:i + 3]
            if number in lessons or not body.strip():
                raise ValueError(f"Duplicate or empty lecture {number}")
            html, outline = render_markdown(body)
            # Source headings are level three beneath the file's lecture delimiter.
            html = html.replace("<h3 ", "<h2 ").replace("</h3>", "</h2>")
            lessons[number] = (title, topic, html, outline)
    if list(lessons) != [f"{number:02d}" for number in range(1, 25)]:
        raise ValueError("Expected exactly 24 lectures in course order")
    return lessons


def render_markdown(source):
    converter = markdown.Markdown(
        extensions=["extra", "toc", "sane_lists"],
        extension_configs={"toc": {"slugify": slugify_unicode, "baselevel": 1}},
    )
    html = converter.convert(source)
    return html, [(item["id"], unescape(item["name"])) for item in converter.toc_tokens]


LESSONS = load_lessons()


def lecture_href(number):
    return f"lecture-{number}.html"


def layout(title, main, *, topic=None, current=None, home=False):
    groups = "".join(
        f'<a class="section-link" href="./#topic-{key}"'
        + (' aria-current="location"' if key == topic else '')
        + f'><small>ТЕМА {key}</small>{escape(name)}</a>'
        for key, name, _, _ in TOPICS
    )
    lesson_list = ""
    if topic:
        numbers = (number for number, (_, group, _, _) in LESSONS.items() if group == topic or (topic == "02" and number == "10"))
        links = "".join(
            f'<li><a href="{lecture_href(number)}"'
            + (' aria-current="page"' if number == current else '')
            + f'><span>{number}</span>{escape(LESSONS[number][0])}</a></li>'
            for number in numbers
        )
        lesson_list = f'<nav class="lecture-menu" aria-label="Лекции темы"><p class="label">Лекции темы</p><ol>{links}</ol></nav>'
    active = ' aria-current="page"' if home else ''
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{escape(title)} · учебные материалы дисциплины ОП.03">
  <title>{escape(title)} · ОП.03</title>
  <link rel="stylesheet" href="course.css">
</head>
<body>
  <a class="skip" href="#main">К содержанию</a>
  <header class="site-header">
    <a class="brand" href="./"><b>ОП.03</b><span>Информационные технологии</span></a>
    <a class="library" href="../">← Все дисциплины</a>
  </header>
  <div class="layout">
    <aside>
      <nav class="section-menu" aria-label="Разделы дисциплины">
        <a class="section-link" href="./"{active}><small>ОП.03</small>Содержание курса</a>
        {groups}
        <a class="section-link" href="./#practice"><small>ПР01–ПР07</small>Практические работы</a>
        <a class="section-link supplement" href="./#extra"><small>ДОПОЛНИТЕЛЬНО</small>Git с нуля</a>
      </nav>
      {lesson_list}
    </aside>
    <main id="main">
      {main}
    </main>
  </div>
  <script src="course.js" defer></script>
</body>
</html>
"""


def legend(html=None):
    terms = [(key, name) for key, name in TERMS if html is None or f'class="{key}"' in html]
    if not terms:
        return ""
    items = "".join(f'<li class="{key}">{name}</li>' for key, name in terms)
    return f'<ul class="legend" aria-label="Цветовые группы терминов">{items}</ul>'


def build_home():
    groups = []
    for topic, name, description, hours in TOPICS:
        links = "".join(
            f'<li><a href="{lecture_href(number)}"><span class="number">{number}</span>{escape(title)} <span class="arrow" aria-hidden="true">→</span></a></li>'
            for number, (title, group, _, _) in LESSONS.items() if group == topic
        )
        if topic == "01":
            transition = '<p class="muted">Лекция 10 завершает тему 1 и открывает тему 2.</p>'
        elif topic == "02":
            transition = '<p class="muted">Начало темы — во второй половине <a href="lecture-10.html">лекции 10</a>.</p>'
        else:
            transition = ""
        groups.append(
            f'<section class="topic" id="topic-{topic}"><p class="label">Тема {topic} · {hours}</p>'
            f'<h2>{escape(name)}</h2><p>{escape(description)}.</p>{transition}<ol>{links}</ol></section>'
        )
    practice_rows = "".join(
        '<tr><th scope="row">'
        + (f'<a href="practice-02.html">{number}</a>' if number == "ПР02" else number)
        + f'</th><td>{name}</td><td>{hours}</td><td>{result}</td><td><a href="{lecture_href(lecture)}">Лекция {lecture}</a></td></tr>'
        for number, name, hours, result, lecture in PRACTICE
    )
    main = f"""
      <section class="hero">
        <p class="label">Рабочая программа · 09.02.07.49 · 3 семестр</p>
        <h1>Информационные технологии</h1>
        <p class="lead">Проследи, как сообщение о сломанном компьютере становится заявкой, как его хранят и обрабатывают и как из данных получается решение.</p>
        <div class="stats"><span><b>24</b> лекции</span><span><b>48 ч</b> теории</span><span><b>30 ч</b> практики</span><span><b>2 ч</b> зачёта</span></div>
        <a class="primary" href="{lecture_href('01')}">Начать с лекции 01 →</a>
        <a class="primary" href="practice-02.html">Открыть ПР02 →</a>
      </section>
      <section class="key" aria-labelledby="key-title">
        <h2 id="key-title">Как читать выделения</h2>
        <p>Термины одной группы сохраняют цвет от лекции к лекции. Подписи в таблицах и легенде поясняют, что означает цвет.</p>
        {legend()}
      </section>
      <div class="topics">{''.join(groups)}</div>
      <section class="key" id="practice">
        <p class="label">Рабочая программа</p>
        <h2>Практические работы</h2>
        <p>Таблица связывает обязательные работы с лекциями и показывает, что можно предъявить в отчёте.</p>
        <div class="table-scroll" tabindex="0" role="region" aria-label="Практические работы">
          <table>
            <thead><tr><th scope="col">Код</th><th scope="col">Работа</th><th scope="col">Часы</th><th scope="col">Результат</th><th scope="col">Теория</th></tr></thead>
            <tbody>{practice_rows}</tbody>
          </table>
        </div>
      </section>
      <section class="key" id="extra">
        <p class="label">Дополнительный материал</p>
        <h2>Git с нуля</h2>
        <p>Локальный репозиторий, два коммита и мини-отчёт. Эту лекцию можно пройти после основных занятий по теме 1.</p>
        <a href="git.html">Открыть лекцию про Git →</a>
      </section>
    """
    (OUTPUT / "index.html").write_text(layout("Содержание курса", main, home=True), encoding="utf-8")


def article_content(title, body, outline, meta):
    toc = "".join(f'<li><a href="#{escape(anchor)}">{escape(label)}</a></li>' for anchor, label in outline)
    return f"""
      <div class="lesson-head">
        <a class="back" href="./">← Содержание ОП.03</a>
        <p class="label">{meta}</p>
        <h1>{escape(title)}</h1>
        {legend(body)}
      </div>
      <details class="outline"><summary>На этой странице</summary><ol>{toc}</ol></details>
      <article class="lesson">{body}</article>"""


def build_lecture(title, body, outline, *, number=None, topic=None):
    if number:
        label = "Темы 01–02" if number == "10" else f"Тема {topic}"
        meta = f"{label} · Лекция {number} · 2 академических часа"
        previous = f'<a href="{lecture_href(f"{int(number) - 1:02d}")}">← Лекция {int(number) - 1:02d}</a>' if number != "01" else '<a href="./">← Содержание курса</a>'
        following = f'<a href="{lecture_href(f"{int(number) + 1:02d}")}">Лекция {int(number) + 1:02d} →</a>' if number != "24" else '<a href="./#practice">К практическим работам →</a>'
    else:
        meta = "Дополнительный материал · 2 академических часа"
        previous = '<a href="./#extra">← Дополнительные материалы</a>'
        following = '<a href="lecture-01.html">К лекции 01 →</a>'
    main = article_content(title, body, outline, meta) + f"""
      <nav class="page-links" aria-label="Переходы между лекциями">{previous}{following}</nav>
    """
    filename = lecture_href(number) if number else "git.html"
    (OUTPUT / filename).write_text(layout(title, main, topic=topic, current=number), encoding="utf-8")


def build_practice():
    title = PRACTICE[1][1]
    body, outline = render_markdown((SOURCE / "practice-02.md").read_text(encoding="utf-8"))
    main = article_content(title, body, outline, "Тема 02 · ПР02 · 2 академических часа")
    main += '<nav class="page-links" aria-label="Навигация практикума"><a href="./#practice">← К списку работ</a></nav>'
    (OUTPUT / "practice-02.html").write_text(layout(f"ПР02. {title}", main, topic="02"), encoding="utf-8")


OUTPUT.mkdir(parents=True, exist_ok=True)
build_home()
build_practice()
for number, (title, topic, body, outline) in LESSONS.items():
    build_lecture(title, body, outline, number=number, topic=topic)
git_body = (SOURCE / "git.html").read_text(encoding="utf-8")
git_outline = re.findall(r'<h2 id="([^"]+)">([^<]+)</h2>', git_body)
build_lecture("Git с нуля. Как проект запоминает изменения", git_body, git_outline)
print("Built 24 scheduled lectures, practice 02, Git supplement, and course contents.")
