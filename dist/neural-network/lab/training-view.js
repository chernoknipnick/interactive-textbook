(() => {
  'use strict';
  const format = (value, digits = 5) => value.toLocaleString('ru-RU', {maximumFractionDigits: digits});
  const percent = value => format(value * 100, 2) + '%';
  const winner = probabilities => probabilities.indexOf(Math.max(...probabilities));

  function capture(model, x, label, change) {
    const index = x.reduce((best, value, i) => value > x[best] ? i : best, 0);
    return {
      x: x.slice(), label, index, step: model.steps,
      oldWeight: change.before[index], newWeight: model.w1[0][index],
      gradient: change.dh * x[index],
      loss: change.loss, afterLoss: change.afterLoss, rate: change.rate,
      predicted: winner(change.probabilities), afterPredicted: winner(change.afterProbabilities),
      labelProbability: change.probabilities[label], afterLabelProbability: change.afterProbabilities[label]
    };
  }

  function render(trace, {runSize = 1, call, open = false} = {}) {
    const cells = trace.x.map((value, i) => `<span class="${i === trace.index ? 'trace-selected' : ''}" style="--brightness:${value.toFixed(3)}" title="Клетка ${i + 1}"> ${format(value, 2)} </span>`).join('');
    const row = Math.floor(trace.index / 8) + 1;
    const column = trace.index % 8 + 1;
    return `<details class="train-trace"${open ? ' open' : ''}>
      <summary>Что произошло при обучении? Данные, расчёт и код</summary>
      <p>${runSize > 1 ? `Набор из ${runSize} рисунков, 4 000 шагов. Ниже показан первый рисунок, который действительно выбрал алгоритм.` : `Шаг №${trace.step}. Ниже показаны данные и числа этого нажатия.`}</p>
      <ol class="trace-flow">
        <li><h3>Передали рисунок и метку</h3><div class="trace-input"><div class="trace-pixels" role="img" aria-label="64 яркости рисунка, выделена клетка ${row}, ${column}">${cells}</div><p><code>x</code> — 64 яркости клеток, по строкам сверху вниз.<br><code>label = ${trace.label}</code> — правильная цифра, с которой сравним ответ.</p></div></li>
        <li><h3>Посчитали прогноз и потерю</h3><p>Ответ до шага — <strong>${trace.predicted}</strong>. Оценка правильной цифры ${trace.label} — <strong>${percent(trace.labelProbability)}</strong>.</p><p>Потеря на рисунке: <strong>${format(trace.loss, 4)}</strong>. Она считается как −ln от оценки правильной цифры.</p></li>
        <li><h3>Обновили параметры</h3><p>По ошибке посчитали градиенты для обоих слоёв. Вот одна связь с первым скрытым нейроном: строка ${row}, столбец ${column} (яркость ${format(trace.x[trace.index], 2)}).</p><p>Старый вес − шаг × градиент ≈ новый вес:</p><p class="trace-equation">${format(trace.oldWeight)} − ${format(trace.rate)} × (${format(trace.gradient)}) ≈ <strong>${format(trace.newWeight)}</strong></p></li>
        <li><h3>Пересчитали тот же рисунок</h3><p>Ответ стал <strong>${trace.afterPredicted}</strong>. Оценка цифры ${trace.label}: <strong>${percent(trace.labelProbability)} → ${percent(trace.afterLabelProbability)}</strong>.</p><p>Потеря: <strong>${format(trace.loss, 4)} → ${format(trace.afterLoss, 4)}</strong>. Качество на других рисунках измеряем отдельной проверкой.</p></li>
      </ol>
      <h3>Где это в JavaScript</h3>
      <p>Вызов из интерфейса и ключевые строки из <a href="network.js" target="_blank" rel="noopener"><code>network.js</code></a>. В коде <code>j</code> — скрытый нейрон, <code>i</code> — клетка.</p>
      <pre><code>// Один обучающий пример: рисунок + правильная цифра
${call}

// Network.train: прогноз и градиенты
const f = this.forward(x);
const d = f.p.map((v,k) => v - (k === label ? 1 : 0));
const dh = f.h.map((v,j) => (1 - v*v) * d.reduce((s,dk,k) => s + dk*this.w2[k][j], 0));

// Внутри цикла по скрытым нейронам и клеткам
this.w1[j][i] -= rate * dh[j] * x[i];</code></pre>
    </details>`;
  }

  window.TrainingView = {capture, render};
})();
