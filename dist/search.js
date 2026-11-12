(() => {
 const input=document.getElementById('material-search');if(!input)return;
 const panel=document.getElementById('search-panel'),summary=document.getElementById('search-summary'),results=document.getElementById('search-results'),clear=document.getElementById('clear-search');
 const normalize=s=>s.toLocaleLowerCase('ru').replaceAll('ё','е');
 const stem=s=>/[а-я]/.test(s)&&s.length>5?s.replace(/(иями|ами|ями|ого|ему|ыми|ими|ая|яя|ое|ее|ые|ие|ый|ий|ой|ов|ев|ам|ям|ах|ях|ом|ем|а|я|ы|и|у|ю|е|о|ь)$/,''):s;
 let data,pending,timer,active=-1,serial=0;
 function load(){
  if(data)return Promise.resolve(data);
  if(!pending)pending=fetch(new URL('search-index.json?v=27',document.currentScript?.src||location.href)).then(r=>{if(!r.ok)throw Error('index');return r.json();}).then(raw=>{
   let previous='';const terms=raw.lexicon.split('\n').map(line=>{const [prefix,suffix,posting]=line.split('|');const word=previous.slice(0,parseInt(prefix,16))+suffix;previous=word;let mask=0n;if(posting.startsWith('#'))mask=BigInt('0x'+posting.slice(1));else posting.split('.').forEach(id=>mask|=1n<<BigInt(parseInt(id,36)));return [word,mask];});
   data={docs:raw.documents,terms};return data;
  }).catch(e=>{pending=null;throw e;});
  return pending;
 }
 function highlight(container,text,queries){
  const normalized=normalize(text);let at=0;
  while(at<text.length){let best=-1,word='';for(const query of queries){const pos=normalized.indexOf(query,at);if(pos>=0&&(best<0||pos<best)){best=pos;word=query;}}
   if(best<0){container.append(document.createTextNode(text.slice(at)));break;}
   container.append(document.createTextNode(text.slice(at,best)));const mark=document.createElement('mark');mark.textContent=text.slice(best,best+word.length);container.append(mark);at=best+word.length;
  }
 }
 function select(index){const links=[...results.querySelectorAll('a')];if(!links.length)return;active=(index+links.length)%links.length;links.forEach((a,i)=>a.classList.toggle('search-selected',i===active));links[active].focus();}
 async function find(){
  const query=normalize(input.value.trim()),ticket=++serial;active=-1;clear.hidden=!query;panel.hidden=!query;results.replaceChildren();if(!query)return;
  summary.textContent='Ищем в материалах…';
  try{
   const index=await load();if(ticket!==serial)return;
   const started=performance.now();
   const tokens=(query.match(/[\p{L}\p{N}_]+/gu)||[]).map(stem);if(!tokens.length){summary.textContent='Введи слово или название темы.';return;}
   const matchedWords=new Map();let mask=(1n<<BigInt(index.docs.length))-1n;
   for(const token of tokens){let found=0n;for(const [word,posting] of index.terms){if(word.startsWith(token)){found|=posting;matchedWords.set(word,posting);}}mask&=found;}
   const found=index.docs.map((doc,i)=>({...doc,i})).filter(doc=>mask&(1n<<BigInt(doc.i))).map(doc=>{const title=normalize(doc.t);return {...doc,score:title.startsWith(query)?300:title.includes(query)?200:tokens.every(t=>title.includes(t))?150:50};}).sort((a,b)=>b.score-a.score||a.i-b.i);
   summary.textContent=found.length?'Найдено материалов: '+found.length+(found.length>30?' · показаны первые 30':''):'Ничего не найдено. Попробуй другое слово или выбери дисциплину ниже.';
   for(const doc of found.slice(0,30)){
    const a=document.createElement('a');a.className='search-result';a.href=doc.u;const label=document.createElement('small');label.textContent=doc.c+' · '+doc.k;const title=document.createElement('strong');highlight(title,doc.t,tokens);const snippet=document.createElement('p');snippet.className='search-snippet';highlight(snippet,doc.s,tokens);
    if(!tokens.every(t=>normalize(doc.s).includes(t))){const hits=[...matchedWords].filter(([word,bits])=>bits&(1n<<BigInt(doc.i))).map(([word])=>word).slice(0,4);const note=document.createElement('span');note.className='search-matches';note.append(document.createTextNode('В тексте: '));highlight(note,hits.join(', '),tokens);snippet.append(document.createElement('br'),note);}
    a.append(label,title,snippet);results.append(a);
   }
   performance.measure('textbook-search',{start:started,end:performance.now()});
  }catch{if(ticket===serial)summary.textContent='Не удалось загрузить поиск. Проверь соединение и введи запрос ещё раз. Разделы ниже доступны без поиска.';}
 }
 input.addEventListener('focus',()=>load().catch(()=>{}));input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(find,120);});
 input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();select(0);}if(event.key==='ArrowUp'){event.preventDefault();select(-1);}if(event.key==='Enter'){event.preventDefault();results.querySelector('a')?.click();}if(event.key==='Escape'){serial++;panel.hidden=true;}});
 results.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();select(active+(event.key==='ArrowDown'?1:-1));}if(event.key==='Escape'){event.preventDefault();panel.hidden=true;input.focus();}});
 clear.onclick=()=>{serial++;clearTimeout(timer);input.value='';panel.hidden=true;clear.hidden=true;results.replaceChildren();input.focus();};
 const query=new URLSearchParams(location.search).get('q');if(query){input.value=query;input.focus();find();}
})();
