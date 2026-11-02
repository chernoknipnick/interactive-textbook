from pathlib import Path
from html.parser import HTMLParser
import html
import json
import re


ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / 'content/java-diagram-code.json').read_text(encoding='utf-8'))
CATEGORIES = {
    'type': 'Тип или класс',
    'data': 'Данные: переменная, поле или параметр',
    'method': 'Метод: действие или вычисление',
    'language': 'Конструкция языка',
    'object': 'Объект или ссылка на него',
}
KEYWORDS = set('class new this return if else for while static public private protected final void null true false'.split())
TYPES = set('int double boolean char byte short long float String Student Phone ObjectsDemo Robot Scanner Random System Math ИмяКласса ТипПоля ТипРезультата ТипПараметра'.split())
METHODS = set('study rest isTired use charge isLow println print main help getName getEnergy setEnergy checkEnergy isValidEnergy getCreatedCount equals clone sum average findMin findMax countMatching'.split())
DATA = set('anna boris partner learner first second firstText secondText firstPhone backup group numbers values name energy battery model createdCount MAX_ENERGY school args index studentId helper имяПеременной имяПоля имяПараметра значение аргументы'.split())
TERMS = {'класс': 'type', 'объект': 'object', 'экземпляр': 'object', 'ссылка': 'object', 'поле': 'data', 'переменная': 'data', 'параметр': 'data', 'аргумент': 'data', 'метод': 'method', 'конструктор': 'method'}


def diagram_markup(name, asset_source):
    if not (asset_source / name).is_file():
        raise FileNotFoundError('Missing lesson image: ' + name)
    entry = CATALOG.get(name)
    if entry is None:
        raise ValueError('Add explained Java code for diagram: ' + name)
    before = '\n\n<p class="diagram-code-caption">Код к следующей схеме</p>\n\n' + entry['context'] + '\n\n```java\n' + entry['code'] + '\n```\n\n'
    if entry.get('figure'):
        figure = (ROOT / 'content/java-visuals' / entry['figure']).read_text(encoding='utf-8')
    else:
        source = 'images/' + html.escape(name, quote=True)
        figure = '<figure class="lesson-diagram-frame"><img class="lesson-diagram" loading="lazy" src="' + source + '" alt="' + html.escape(Path(name).stem, quote=True) + '"><figcaption><a href="' + source + '" target="_blank" rel="noopener">Открыть схему целиком ↗</a></figcaption></figure>'
    return before + figure + '\n\n'


def legend():
    items = [('type', 'Типы и классы', 'какие значения и объекты описываем'), ('object', 'Объекты и ссылки', 'какой экземпляр и как его найти'), ('data', 'Переменные, поля, параметры', 'где находятся данные'), ('method', 'Методы и конструкторы', 'какое действие выполняем'), ('language', 'Конструкции Java', 'какие правила задаёт язык')]
    content = ''.join('<li><b class="term-' + category + '">' + title + '</b><span>' + description + '</span></li>' for category, title, description in items)
    return '<details class="term-legend" open><summary>Как читать цвета в этой лекции</summary><ul>' + content + '</ul><p>Цвет обозначает группу, а не заменяет объяснение. Наведи на выделенный фрагмент, чтобы увидеть подсказку. Имена полей, переменных и параметров находятся в одной группе данных; их точную роль определяй по объявлению и контексту. Текст в кавычках остаётся строковым значением.</p></details>'


class SemanticMarkup(HTMLParser):
    def __init__(self, body):
        super().__init__(convert_charrefs=False)
        self.output = []
        self.stack = []
        visible = html.unescape(re.sub(r'<[^>]*>', '', body))
        identifier = r'[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё_0-9]*'
        self.types = TYPES | set(re.findall(r'\b(?:class|new)\s+(' + identifier + ')', visible))
        self.methods = METHODS | set(re.findall(r'(' + identifier + r')\s*\(', visible))
        type_pattern = '|'.join(re.escape(name) for name in sorted(self.types, key=len, reverse=True))
        self.data = DATA | set(re.findall(r'\b(?:' + type_pattern + r')(?:\[\])?\s+(' + identifier + ')', visible))

    def handle_starttag(self, tag, attrs):
        self.output.append(self.get_starttag_text())
        if tag not in {'img', 'br', 'hr', 'input', 'meta', 'link', 'wbr', 'source'}:
            self.stack.append((tag, dict(attrs)))

    def handle_startendtag(self, tag, attrs):
        self.output.append(self.get_starttag_text())

    def handle_endtag(self, tag):
        self.output.append('</' + tag + '>')
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_entityref(self, name):
        self.output.append('&' + name + ';')

    def handle_charref(self, name):
        self.output.append('&#' + name + ';')

    def handle_data(self, data):
        tags = {tag for tag, attrs in self.stack}
        literal = any(tag == 'span' and re.fullmatch(r'(?:s\w*|c\w*)', attrs.get('class', '')) for tag, attrs in self.stack)
        code = bool({'code', 'pre'} & tags)
        strong = 'strong' in tags
        declared_method = any(tag == 'span' and attrs.get('class') == 'nf' for tag, attrs in self.stack)
        if literal or not (code or strong):
            self.output.append(data if code else re.sub(r'[ \t]+\n', '\n', data))
            return
        def token(match):
            value = match.group(0)
            if value.startswith('"'):
                return value
            category = None
            if code:
                if value in self.types:
                    category = 'type'
                elif value in KEYWORDS:
                    category = 'language'
                elif declared_method or value in self.methods or re.match(r'\s*\(', data[match.end():]):
                    category = 'method'
                elif value in self.data:
                    category = 'data'
            elif strong:
                category = TERMS.get(value.lower())
            if category:
                return '<span class="term-' + category + '" title="' + CATEGORIES[category] + '">' + value + '</span>'
            return value
        self.output.append(re.sub(r'"(?:\\.|[^"\\])*"|[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё_0-9]*', token, data))


def semantic_markup(body):
    parser = SemanticMarkup(body)
    parser.feed(body)
    return ''.join(parser.output)
