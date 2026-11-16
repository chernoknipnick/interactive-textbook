(() => {
 const key='textbook-theme',root=document.documentElement,buttons=new Set();
 const read=()=>{try{return localStorage.getItem(key)==='dark'?'dark':'light';}catch{return 'light';}};
 function update(button){const dark=root.dataset.theme==='dark';button.setAttribute('aria-checked',String(dark));button.setAttribute('aria-label','Тёмная тема');button.title=dark?'Включить светлую тему':'Включить тёмную тему';button.querySelector('.tb-theme-label').textContent=dark?'Светлая':'Тёмная';button.querySelector('path').setAttribute('d',dark?'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5':'M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z');}
 function apply(value,persist=false){const theme=value==='dark'?'dark':'light';root.dataset.theme=theme;
  if(persist)try{localStorage.setItem(key,theme);}catch{}
  for(const button of buttons)update(button);
  let meta=document.querySelector('meta[name="theme-color"]');if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.append(meta);}meta.content=theme==='dark'?'#111927':'#f4f6fa';
  document.querySelectorAll('iframe').forEach(frame=>{try{frame.contentWindow?.postMessage({type:'textbook-theme',theme},location.origin);}catch{}});
 }
 let initial=read();try{if(window.parent!==window)initial=window.parent.document.documentElement.dataset.theme||initial;}catch{}apply(initial);
 window.textbookTheme={apply,bind(button){buttons.add(button);button.type='button';button.className='tb-theme-toggle';button.setAttribute('role','switch');button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="tb-theme-label"></span>';button.onclick=()=>apply(root.dataset.theme==='dark'?'light':'dark',true);update(button);}};
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(read());});
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='textbook-theme')apply(event.data.theme);});
})();
