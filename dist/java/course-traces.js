document.querySelectorAll('[data-course-trace]').forEach(widget => {
  const frames = JSON.parse(widget.querySelector('[data-trace-model]').textContent);
  let step = 0;
  let timer = null;
  const find = selector => widget.querySelector(selector);
  function pause() {
    clearTimeout(timer);
    timer = null;
    window.lessonMotion?.pause(widget);
    find('[data-trace-action=play]').textContent = '▶ Проиграть';
    find('[data-trace-action=play]').setAttribute('aria-pressed', 'false');
  }
  function draw() {
    const frame = frames[step];
    const code = find('[data-trace-code]');
    const changedCode=code.textContent && code.textContent!==frame.code;
    code.textContent = frame.code;
    window.highlightJavaTerms?.(code);
    if(changedCode)window.lessonMotion?.step(widget,[code]);
    widget.querySelectorAll('[data-trace-cell]').forEach((cell, index) => {
      const changed = cell.textContent !== frame.cells[index];
      cell.textContent = frame.cells[index];
      cell.classList.toggle('trace-changed', changed);
      if(changed&&changedCode)window.lessonMotion?.step(widget,[cell]);
    });
    find('[data-trace-explanation]').textContent = frame.explanation;
    find('[data-trace-step]').textContent = `Шаг ${step + 1} из ${frames.length}`;
    find('[data-trace-action=back]').disabled = step === 0;
    find('[data-trace-action=next]').disabled = step === frames.length - 1;
  }
  widget.addEventListener('click', event => {
    const action = event.target.closest('[data-trace-action]')?.dataset.traceAction;
    if (!action) return;
    if (action === 'play') {
      if (timer) { pause(); return; }
      if (step === frames.length - 1) { step = 0; draw(); }
      find('[data-trace-action=play]').textContent = 'Ⅱ Пауза';
      find('[data-trace-action=play]').setAttribute('aria-pressed', 'true');
      widget.classList.add('is-playing');widget.classList.remove('is-paused');
      const tick=()=>{step+=1;draw();if(step===frames.length-1){pause();return;}timer=setTimeout(tick,1800);};
      timer=setTimeout(tick,1800);
      return;
    }
    pause();
    step = action === 'reset' ? 0 : Math.max(0, Math.min(frames.length - 1, step + (action === 'next' ? 1 : -1)));
    draw();
  });
  widget.addEventListener('lesson-pause',pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', pause);
  document.addEventListener('DOMContentLoaded',()=>window.lessonMotion?.reserve(widget,find('[data-trace-code]'),frames.map(f=>f.code)));
  find('[data-trace-code]').closest('pre').style.minHeight=(Math.max(...frames.map(f=>f.code.split('\n').length))*27+40)+'px';
  pause();draw();
});
