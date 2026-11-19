(() => {
  'use strict';
  const {Network, sample, shift, dataset, evaluate, score, rng} = DigitLab;
  const TRAINING_STEPS = 4000;
  const originals = dataset();
  const expanded = dataset(true);
  const main = document.querySelector('main');
  const header = document.querySelector('header');
  const launch = document.createElement('button');
  launch.className = 'primary';
  launch.textContent = 'Режим выступления';
  header.append(launch);

  const panel = document.createElement('section');
  panel.className = 'contest';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="contest-top"><span id="contest-progress"></span><button id="contest-exit">Выйти в практикум</button></div>
    <h1 id="contest-title" tabindex="-1"></h1>
    <p id="contest-lead"></p>
    <div id="contest-content" class="contest-content"></div>
    <section class="contest-scores" aria-label="Верных ответов на 60 контрольных рисунках">
      <p>Верно на 60 контрольных рисунках</p>
      <div class="contest-score-grid">
        <div><span>До обучения</span><strong id="contest-score-start">—</strong></div>
        <div><span>10 шаблонов</span><strong id="contest-score-base">—</strong></div>
        <div><span>40 примеров</span><strong id="contest-score-rich">—</strong></div>
      </div>
    </section>
    <p id="contest-status" role="status"></p>
    <div class="contest-actions"><button class="primary" id="contest-next"></button></div>`;
  main.after(panel);
  const get = id => panel.querySelector('#contest-' + id);
  const stages = [
    ['Создаём нейросеть за 20 минут', 'Узнает ли модель ту же цифру, если сдвинуть её на одну клетку? Сначала сделаем прогноз.', 'Создать сеть'],
    ['Сеть создана', '64 клетки рисунка передают числа 16 нейронам. На выходе 10 оценок, по одной для каждой цифры.', 'Проверить до обучения'],
    ['Первый ответ сети', 'Правильная цифра — 3. Сеть выбирает цифру с самой высокой оценкой.', 'Показать один шаг обучения'],
    ['Один шаг меняет веса', 'Показываем сети правильный ответ и вычисляем, как поправить связи. Посмотрим на одну из них.', 'Обучить на 10 шаблонах'],
    ['Сеть узнаёт знакомую тройку', 'Предскажите результат после сдвига. Затем попросите участника нажать кнопку.', 'Сдвинуть на клетку вправо'],
    ['А теперь та же цифра правее', 'Сравните ответ сети с правильной цифрой. Какие примеры помогли бы ей узнать такую тройку?', 'Обучить на 40 примерах'],
    ['Проверяем после второго обучения', 'Сравните три результата. Для всех проверок использовались одни и те же 60 контрольных рисунков.', 'Задать вопрос участникам'],
    ['Как узнать, что модель стала лучше?', 'Выскажите свою версию, затем выберите способ проверки.', 'Начать заново']
  ];
  let stage, model, drawing, result, update, busy, finalCheck, trainingTrace;
  const totals = {};
  const number = value => value.toLocaleString('ru-RU', {minimumFractionDigits:3, maximumFractionDigits:3});

  function reset() {
    stage = 0;
    model = null;
    drawing = sample(3);
    result = null;
    update = null;
    finalCheck = [];
    trainingTrace = null;
    busy = false;
    for (const key of ['start','base','rich']) delete totals[key];
    render();
  }

  function predict() {
    const estimates = model.forward(drawing).p;
    result = estimates.indexOf(Math.max(...estimates));
  }

  async function train(diverse) {
    model = new Network(42,16);
    const examples = diverse ? expanded : originals;
    const random = rng(431);
    for (let i = 0; i < TRAINING_STEPS; i++) {
      const example = examples[Math.floor(random() * examples.length)];
      const change = model.train(example.x, example.y);
      if (i === 0) trainingTrace = TrainingView.capture(model, example.x, example.y, change);
      if ((i+1)%250 === 0) {
        get('status').textContent = `Обучение: ${i+1} / ${TRAINING_STEPS} шагов`;
        await new Promise(resolve => setTimeout(resolve,0));
      }
    }
    const check = evaluate(model);
    totals[diverse ? 'rich' : 'base'] = check.filter(item => item.correct).length;
    if (diverse) finalCheck = check;
    predict();
  }

  function diagram() {
    const layers = [[64,'Клетки рисунка'],[model.hidden,'Скрытые нейроны'],[10,'Оценки цифр']];
    return '<div class="contest-layers">' + layers.map(([count,label]) =>
      `<div><strong>${count}</strong><span>${label}</span><div class="contest-dots" aria-hidden="true">${'<i></i>'.repeat(count)}</div></div>`
    ).join('') + '</div><p class="contest-detail">У каждой связи есть вес. Сейчас веса начальные, обучение ещё не запускалось.</p>';
  }

  function drawingView() {
    const grid = drawing.map(v => `<i class="${v ? 'lit' : ''}"></i>`).join('');
    return `<div class="contest-example"><div class="contest-pixels" role="img" aria-label="${stage >= 5 ? 'Сдвинутая тройка' : 'Тройка'}">${grid}</div>
      <div class="contest-answer"><span>Ответ сети</span><strong>${result}</strong><span>Правильный ответ: 3</span></div></div>`;
  }

  function pixelArt(pixels, label) {
    return `<span class="dataset-pixels" role="img" aria-label="${label}">${pixels.map(brightness =>
      `<i style="--pixel:${brightness.toFixed(3)}"></i>`
    ).join('')}</span>`;
  }

  function exampleCard(example, caption = '') {
    return `<figure class="dataset-tile">
      ${pixelArt(example.x, `Учебный рисунок с меткой ${example.y}`)}
      <figcaption>Метка <strong>${example.y}</strong>${caption ? `<small>${caption}</small>` : ''}</figcaption>
    </figure>`;
  }

  function datasetView(diverse) {
    const added = expanded.length - originals.length;
    const groups = [...new Set(expanded.map(example => example.variant))]
      .map(label => [label, expanded.filter(example => example.variant === label)]);
    const preview = diverse
      ? groups.map(([label, examples]) => exampleCard(examples.find(example => example.y === 3), label)).join('')
      : originals.map(example => exampleCard(example)).join('');
    return `<section class="dataset-board" aria-label="Обучающие рисунки">
      <h2>${diverse ? `${originals.length} исходных + ${added} сдвинутых = ${expanded.length} рисунков` : `${originals.length} размеченных рисунков`}</h2>
      <p>${diverse ? 'Вот четыре варианта тройки. У всех правильная метка — 3. Такие же варианты есть у каждой цифры от 0 до 9.' : 'По одному рисунку для каждой цифры. Метка под рисунком — правильный ответ, который получает модель при обучении.'}</p>
      <div class="dataset-grid ${diverse ? 'dataset-grid--variants' : ''}">${preview}</div>
      ${diverse ? `<details class="dataset-all"><summary>Посмотреть все ${expanded.length} рисунков с метками</summary>
        ${groups.map(([label, examples]) => `<section><h3>${label} · ${examples.length}</h3><div class="dataset-grid">${examples.map(example => exampleCard(example)).join('')}</div></section>`).join('')}
      </details>` : ''}
      <p class="dataset-note"><strong>4 000 шагов обучения:</strong> на каждом шаге случайно выбираем один рисунок из набора. Рисунки могут повторяться.</p>
    </section>`;
  }

  function checkView() {
    const errors = finalCheck.filter(item => !item.correct);
    const correct = finalCheck.length - errors.length;
    const tiles = errors.map(({pixels, digit, prediction}) => `<figure class="dataset-tile dataset-miss">
      ${pixelArt(pixels, `Контрольный рисунок цифры ${digit}`)}
      <figcaption>Метка <strong>${digit}</strong><small>Ответ сети: ${prediction}</small></figcaption>
    </figure>`).join('');
    return `<section class="dataset-board dataset-board--check" aria-label="Контрольные результаты">
      <h2>После обучения: ${correct} верно, ${errors.length} с ошибкой</h2>
      <p>Для проверки взяли ${finalCheck.length} отдельных рисунков. Их не использовали для обучения.</p>
      <div class="dataset-check-bar" aria-hidden="true">${finalCheck.map((_, index) => `<i class="${index < correct ? 'dataset-hit' : 'dataset-error'}"></i>`).join('')}</div>
      <p class="dataset-legend"><span class="dataset-hit">${correct} верно</span><span class="dataset-error">${errors.length} ошибок</span></p>
      ${errors.length ? `<details class="dataset-all"><summary>Посмотреть ${errors.length} ошибок модели</summary><div class="dataset-grid">${tiles}</div></details>` : ''}
    </section>`;
  }

  document.querySelector('#experience')?.insertAdjacentHTML('beforebegin', `<details class="dataset-board dataset-entry">
    <summary>На каких рисунках учится сеть?</summary>
    ${datasetView(false)}
    ${datasetView(true)}
    <p class="dataset-note">Мы измеряем результат на 60 отдельных контрольных рисунках. Запустите режим выступления, чтобы увидеть, какие цифры сеть всё ещё путает.</p>
  </details>`);

  function render() {
    const [title,lead,action] = stages[stage];
    get('progress').textContent = `Шаг ${stage+1} из ${stages.length}`;
    get('title').textContent = title;
    get('lead').textContent = lead;
    get('next').textContent = action;
    get('status').textContent = '';
    get('next').disabled = get('exit').disabled = busy;
    for (const key of ['start','base','rich']) {
      get('score-'+key).textContent = totals[key] === undefined ? '—' : `${totals[key]} / 60`;
    }
    const content = get('content');
    content.innerHTML = '';
    if (stage === 1) content.innerHTML = diagram();
    if ([2,4,5,6].includes(stage)) content.innerHTML = drawingView();
    if (stage === 3) content.innerHTML = `<div class="contest-update"><div><span>Вес одной связи</span><strong>${number(update.before)} → ${number(update.after)}</strong></div><div><span>Ошибка на тройке</span><strong>${number(update.loss)} → ${number(update.afterLoss)}</strong></div></div><p class="contest-detail">Один шаг показан на обучающем рисунке. Следующее обучение начнётся заново с исходных весов.</p>`;
    if (stage === 3) {
      content.insertAdjacentHTML('beforeend', TrainingView.render(update.trace, {call: 'model.train(drawing, 3);'}));
      content.insertAdjacentHTML('beforeend', datasetView(false));
    }
    if (stage === 4 || stage === 6) {
      const runSize = stage === 4 ? originals.length : expanded.length;
      content.insertAdjacentHTML('beforeend', TrainingView.render(trainingTrace, {runSize, call: 'model.train(example.x, example.y);'}));
    }
    if (stage === 5) content.insertAdjacentHTML('beforeend', datasetView(true));
    if (stage === 6) content.insertAdjacentHTML('beforeend', checkView());
    if (stage === 7) {
      content.innerHTML = '<div class="contest-quiz"><button data-answer="example">Ещё раз показать знакомую тройку</button><button data-answer="control">Проверить на новых размеченных рисунках</button><p aria-live="polite"></p></div>';
      content.querySelectorAll('button').forEach(button => button.onclick = () => {
        content.querySelector('p').textContent = button.dataset.answer === 'control'
          ? `Верно. Модель улучшилась на этой проверке, но ошиблась ещё ${60-totals.rich} раз из 60.`
          : 'Знакомая тройка показывает результат на одном примере. Для сравнения качества нужны отдельные контрольные рисунки.';
      });
    }
    get('title').focus({preventScroll:true});
    panel.scrollIntoView({block:'start'});
  }

  get('next').onclick = async () => {
    if (busy) return;
    if (stage === 7) { reset(); return; }
    busy = true;
    get('next').disabled = get('exit').disabled = true;
    try {
      if (stage === 0) {
        model = new Network(42,16);
        totals.start = score(model);
      }
      if (stage === 1) predict();
      if (stage === 2) {
        const change = model.train(drawing,3);
        const i = drawing.indexOf(1);
        update = {...change,before:change.before[i],after:model.w1[0][i],trace:TrainingView.capture(model,drawing,3,change)};
      }
      if (stage === 3) await train(false);
      if (stage === 4) { drawing = shift(drawing,1,0); predict(); }
      if (stage === 5) await train(true);
      stage++;
      busy = false;
      render();
    } catch (error) {
      busy = false;
      get('next').disabled = get('exit').disabled = false;
      get('status').textContent = 'Шаг не завершён. Попробуй снова.';
      console.error(error);
    }
  };
  launch.onclick = () => {
    main.hidden = header.hidden = true;
    panel.hidden = false;
    reset();
  };
  get('exit').onclick = () => {
    panel.hidden = true;
    main.hidden = header.hidden = false;
    launch.focus();
    header.scrollIntoView({block:'start'});
  };
})();
