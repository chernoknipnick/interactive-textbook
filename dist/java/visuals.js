document.querySelectorAll('[data-visual]').forEach(widget=>{
  let step=0,selected=null;
  const kind=widget.dataset.visual,total=kind==='array'?5:3;
  const find=s=>widget.querySelector(s);
  const launchText=[
    'Сначала есть только текст в Hello.java. Это исходный код: JVM запускает не этот текст, а результат компиляции.',
    'Команда javac Hello.java проверяет код и при успешной компиляции создаёт Hello.class с байт-кодом. При ошибке компиляции исправляем исходник.',
    'Команда java Hello запускает программу через JVM. Она загружает класс и выполняет программу. Строка «Привет!» появляется в консоли.'
  ];
  const arrayText=[
    'Создали массив из пяти чисел. Переменная a хранит ссылку на этот массив.',
    'b = a копирует ссылку. Обе переменные указывают на один массив A. Второго массива пока нет.',
    'Меняем b[1] на 9. Изменился общий массив: теперь и a[1], и b[1] равны 9.',
    'a.clone() создаёт отдельный массив B. Для этого int[] скопированы значения всех элементов. Теперь a и b указывают на разные массивы.',
    'Меняем b[1] на 7 в копии B. В исходном массиве a[1] остаётся 9. Изменения копии больше не меняют исходный массив.'
  ];
  const codes=['int[] a = {5, 3, 4, 2, 5};','int[] b = a;','b[1] = 9;','b = a.clone();','b[1] = 7;'];
  function draw(){
    find('[data-step]').textContent=`Шаг ${step+1} из ${total}`;
    find('[data-action=back]').disabled=step===0;
    find('[data-action=next]').disabled=step===total-1;
    widget.querySelectorAll('[data-node]').forEach(n=>n.classList.toggle('active',Number(n.dataset.node)===step));
    if(kind==='launch')find('[data-explanation]').textContent=launchText[step];
    if(kind==='condition'){
      const input=find('[data-score]'),score=input.valueAsNumber;
      const valid=input.value!==''&&Number.isInteger(score)&&score>=0&&score<=100;
      find('[data-action=next]').disabled=!valid||step===total-1;
      if(!valid){
        find('[data-input-value]').textContent='Введите баллы';find('[data-test]').textContent='score ≥ 60 ?';find('[data-comparison]').textContent='Нет допустимого значения';
        widget.querySelectorAll('[data-branch]').forEach(n=>n.classList.remove('chosen','skipped'));
        find('[data-explanation]').textContent='Введи целое число от 0 до 100.';return;
      }
      const passed=score>=60;
      find('[data-input-value]').textContent=`score = ${score}`;
      find('[data-test]').textContent=`${score} ≥ 60 ?`;
      find('[data-comparison]').textContent=step===0?'Пока не проверяли':String(passed);
      widget.querySelectorAll('[data-branch]').forEach(n=>{
        const chosen=(n.dataset.branch==='true')===passed;
        n.classList.toggle('chosen',step===2&&chosen);n.classList.toggle('skipped',step===2&&!chosen);
      });
      find('[data-explanation]').textContent=step===0?`Задано ${score} баллов. Проверим условие score >= 60.`:step===1?`${score} >= 60 — это ${passed}. ${score===60?'Знак >= включает границу: 60 тоже подходит.':''}`:`Выполняется только ветка ${passed?'if → «Сдано»':'else → «Не сдано»'}. Другая ветка пропущена. Попробуй 59 и 60.`;
    }
    if(kind==='array'){
      find('[data-array-code]').textContent=codes[step];
      window.highlightJavaTerms?.(find('[data-array-code]'));
      find('[data-b-ref]').textContent=step===0?'b — ещё не объявлена':step<3?'b → массив A (тот же объект)':'b → массив B (отдельная копия)';
      find('[data-copy]').hidden=step<3;
      if(!find('[data-array=b]').children.length){
        find('[data-array=a]').querySelectorAll('button').forEach(source=>{
          const button=source.cloneNode(true);button.setAttribute('aria-label',`Элемент b с индексом ${button.dataset.index}`);find('[data-array=b]').appendChild(button);
        });
      }
      const a=[5,step>=2?9:3,4,2,5],b=[5,step===4?7:9,4,2,5];
      widget.querySelectorAll('[data-array]').forEach(row=>{
        const values=row.dataset.array==='a'?a:b;
        row.querySelectorAll('[data-index]').forEach(button=>{
          const index=Number(button.dataset.index);button.querySelector('b').textContent=values[index];
          button.classList.toggle('changed',index===1&&step>=2);
          button.setAttribute('aria-pressed',String(selected===row.dataset.array+index));
        });
      });
      find('[data-explanation]').textContent=arrayText[step];
      if(selected){const isA=selected[0]==='a',index=Number(selected.slice(1));find('[data-readout]').textContent=`${isA?'a':'b'}[${index}] = ${(isA?a:b)[index]}`;}
      else find('[data-readout]').textContent='Индексы: 0, 1, 2, 3, 4. length = 5. Нажми на ячейку.';
    }
  }
  widget.addEventListener('click',e=>{
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action){step=action==='reset'?0:Math.max(0,Math.min(total-1,step+(action==='next'?1:-1)));selected=null;draw();}
    const cell=e.target.closest('[data-index]');
    if(cell){selected=cell.closest('[data-array]').dataset.array+cell.dataset.index;draw();}
  });
  find('[data-score]')?.addEventListener('input',()=>{step=0;draw();});
  draw();
});
