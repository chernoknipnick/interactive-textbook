(() => {
  const models = {
    references: [
      ['int[] first = {10, 20};', ['first → А', 'second: ещё нет', 'Массив А: [10, 20]', 'Массив Б: ещё нет'], [[0, 2]], [0, 2], 'Создали один массив А. Переменная first хранит ссылку на него.'],
      ['int[] second = first;', ['first → А', 'second → А', 'Массив А: [10, 20]', 'Массив Б: ещё нет'], [[0, 2], [1, 2]], [1, 2], 'Копируется ссылка. Две переменные ведут к одному объекту. Второй массив не появился.'],
      ['second[0] = 99;', ['first → А', 'second → А', 'Массив А: [99, 20]', 'Массив Б: ещё нет'], [[0, 2], [1, 2]], [2], 'Изменили общий массив через second. Через first теперь тоже читается 99. Обе стрелки остались на месте.'],
      ['second = new int[]{7, 8};', ['first → А', 'second → Б', 'Массив А: [99, 20]', 'Массив Б: [7, 8]'], [[0, 2], [1, 3]], [1, 3], 'Создан отдельный массив Б. Переназначили только second. first продолжает вести к А.'],
      ['second = null;', ['first → А', 'second: null', 'Массив А: [99, 20]', 'Массив Б: [7, 8]'], [[0, 2]], [1], 'У second теперь нет ссылки на объект. А всё ещё доступен через first. Б стал недостижим в этой модели; сборка мусора не обязана произойти немедленно.']
    ],
    classes: [
      ['class Student { String name; int energy; }', ['Student: описание типа', 'Анна: ещё не создана', 'Борис: ещё не создан', 'partner: ещё нет'], [], [0], 'Класс описывает устройство объектов. Само объявление класса не создало ни Анну, ни Бориса.'],
      ['Student anna = new Student();\nanna.name = "Анна"; anna.energy = 70;', ['Student: поля и методы', 'Анна: energy = 70', 'Борис: ещё не создан', 'partner: ещё нет'], [], [1], 'Создан первый экземпляр. В anna сохранена ссылка. У объекта собственные значения полей.'],
      ['Student boris = new Student();\nboris.name = "Борис"; boris.energy = 40;', ['Student: поля и методы', 'Анна: energy = 70', 'Борис: energy = 40', 'partner: ещё нет'], [], [2], 'Второй new создаёт второй объект. Энергия Бориса хранится отдельно от энергии Анны.'],
      ['anna.study();', ['Student: study() тратит 10', 'Анна: energy = 60', 'Борис: energy = 40', 'partner: ещё нет'], [], [1], 'Текущий объект метода — Анна. Меняется её энергия; Бориса этот вызов не затрагивает.'],
      ['Student partner = anna;\npartner.rest();', ['Student: rest() даёт +20', 'Анна: energy = 80', 'Борис: energy = 40', 'partner → Анна'], [[3, 1]], [1, 3], 'partner — вторая ссылка на Анну, а не третий объект. Отдых через partner меняет ту же Анну. Объектов Student всё ещё два.']
    ],
    constructors: [
      ['new Student("Анна", 70)', ['Аргументы: "Анна", 70', 'Поля: null и 0', 'Проверка: впереди', 'anna: ещё не присвоено'], [[0, 1]], [0, 1], 'Запросили создание объекта с начальными данными. Перед заполнением поля имеют значения по умолчанию. Показываем упрощённую модель нашего класса.'],
      ['checkEnergy(energy);', ['Параметр energy = 70', 'Поля: null и 0', '0 ≤ 70 ≤ 100: да', 'anna: ещё не присвоено'], [[0, 2]], [2], 'Проверяем входные данные до присваивания полям. 70 входит в разрешённый диапазон.'],
      ['this.name = name;\nthis.energy = energy;', ['Параметры: "Анна", 70', 'Поля: "Анна", 70', 'Проверка: пройдена', 'anna: ещё не присвоено'], [[0, 1]], [1], 'this.name — поле создаваемого объекта. name справа — параметр. Данные переходят из параметров в поля.'],
      ['Student anna = new Student("Анна", 70);', ['Параметры: завершён вызов', 'Готовый объект Анна', 'Проверка: пройдена', 'anna → готовый объект'], [[3, 1]], [1, 3], 'Конструктор нормально завершён. new даёт ссылку, и только теперь она присваивается anna.'],
      ['new Student("Ошибка", 150);', ['Другая попытка: 150', 'Анна осталась прежней', 'Проверка: исключение', 'Новой ссылки не получено'], [[0, 2]], [0, 2], 'Это отдельная неудачная попытка создания. 150 отклоняется исключением; готовая новая ссылка не возвращается. Ранее созданная Анна не меняется.']
    ],
    static: [
      ['Student.getCreatedCount();', ['Класс: createdCount = 0', 'Анна: ещё не создана', 'Борис: ещё не создан', 'partner: ещё нет'], [], [0], 'Общий счётчик принадлежит классу. Его можно прочитать, не выбирая объект Student.'],
      ['Student anna = new Student("Анна", 70);', ['Класс: createdCount = 1', 'Анна: energy = 70', 'Борис: ещё не создан', 'partner: ещё нет'], [], [0, 1], 'Успешно завершилось первое создание. У Анны личная энергия, а общий счётчик увеличен один раз.'],
      ['Student boris = new Student("Борис", 40);', ['Класс: createdCount = 2', 'Анна: energy = 70', 'Борис: energy = 40', 'partner: ещё нет'], [], [0, 2], 'Создали Бориса. Счётчик общий: 2. Энергия у каждого своя: 70 и 40.'],
      ['Student partner = anna;', ['Класс: createdCount = 2', 'Анна: energy = 70', 'Борис: energy = 40', 'partner → Анна'], [[3, 1]], [3], 'Присваивание ссылки не вызывает конструктор. Число созданий остаётся равным двум.'],
      ['anna.study();', ['Класс: createdCount = 2', 'Анна: energy = 60', 'Борис: energy = 40', 'partner → Анна'], [[3, 1]], [1], 'Экземплярный метод изменил только Анну. static-счётчик не обязан меняться при каждом действии объекта. Это счётчик созданий, а не живых объектов.']
    ]
  };
  const positions = [[20, 20], [510, 20], [20, 260], [510, 260]];
  const roles = {
    references: ['Переменная main', 'Переменная main', 'Объект-массив', 'Объект-массив'],
    classes: ['Описание типа', 'Экземпляр Student', 'Экземпляр Student', 'Ссылочная переменная'],
    constructors: ['Данные текущего вызова', 'Состояние объекта', 'Проверка входных данных', 'Результат создания'],
    static: ['Общие данные класса', 'Личные данные экземпляра', 'Личные данные экземпляра', 'Ссылочная переменная']
  };
  const paths = {
    '0-1': 'M460 110 L500 110', '0-2': 'M240 200 L240 250',
    '1-2': 'M730 200 C730 230 240 220 240 250',
    '1-3': 'M730 200 L730 250', '3-1': 'M730 260 L730 210'
  };
  document.querySelectorAll('[data-oop]').forEach((widget, widgetIndex) => {
    const frames = models[widget.dataset.oop];
    if (!frames) return;
    let step = 0;
    let timer = null;
    const find = selector => widget.querySelector(selector);
    const scene = find('svg');
    const namespace = 'http://www.w3.org/2000/svg';
    function element(tag, attributes, parent) {
      const node = document.createElementNS(namespace, tag);
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
      parent.appendChild(node);
      return node;
    }
    const defs = element('defs', {}, scene);
    const markerId = `oop-arrow-${widgetIndex}`;
    const marker = element('marker', {id: markerId, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse'}, defs);
    element('path', {d: 'M0 0 L10 5 L0 10 z', fill: '#e7a269'}, marker);
    const linkLayer = element('g', {}, scene);
    const nodes = positions.map(([left, top], index) => {
      const group = element('g', {class: 'oop-node', transform: `translate(${left} ${top})`}, scene);
      element('rect', {width: '440', height: '180', rx: '15'}, group);
      const label = element('text', {x: '20', y: '55', class: 'oop-title'}, group);
      const detail = element('text', {x: '20', y: '110'}, group);
      detail.textContent = roles[widget.dataset.oop][index];
      return {group, label};
    });
    function pause() {
      clearInterval(timer);
      timer = null;
      find('[data-oop-action=play]').textContent = '▶ Проиграть';
      find('[data-oop-action=play]').setAttribute('aria-pressed', 'false');
    }
    function draw(animate = true) {
      const [code, labels, links, active, explanation] = frames[step];
      find('[data-oop-code]').textContent = code;
      find('[data-oop-step]').textContent = `Шаг ${step + 1} из ${frames.length}`;
      find('[data-oop-explanation]').textContent = explanation;
      find('[data-oop-action=back]').disabled = step === 0;
      find('[data-oop-action=next]').disabled = step === frames.length - 1;
      nodes.forEach(({group, label}, index) => {
        label.textContent = labels[index];
        group.classList.toggle('is-active', active.includes(index));
        group.classList.toggle('is-muted', /ещё нет|ещё не создан|ещё не присвоено/.test(labels[index]));
        if (animate && active.includes(index) && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          group.animate([{opacity: .4}, {opacity: 1}], {duration: 450});
        }
      });
      linkLayer.replaceChildren();
      links.forEach(([from, to]) => element('path', {d: paths[`${from}-${to}`], class: 'oop-link', 'marker-end': `url(#${markerId})`}, linkLayer));
    }
    widget.addEventListener('click', event => {
      const action = event.target.closest('[data-oop-action]')?.dataset.oopAction;
      if (!action) return;
      if (action === 'play') {
        if (timer) { pause(); return; }
        if (step === frames.length - 1) { step = 0; draw(); }
        find('[data-oop-action=play]').textContent = 'Ⅱ Пауза';
        find('[data-oop-action=play]').setAttribute('aria-pressed', 'true');
        timer = setInterval(() => {
          step += 1;
          draw();
          if (step === frames.length - 1) pause();
        }, 2800);
        return;
      }
      pause();
      step = action === 'reset' ? 0 : Math.max(0, Math.min(frames.length - 1, step + (action === 'next' ? 1 : -1)));
      draw();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('pagehide', pause);
    draw(false);
  });
})();
