(() => {
 function reveal(target){
  const view=target.ownerDocument.defaultView,panel=target.closest('.lecture-panel');
  if(panel&&typeof view.switchLecture==='function'){view.switchLecture(panel.id.replace('panel-',''));const section=target.closest('.section');if(section&&typeof view.show==='function')view.show(section.id,null);}
  for(let node=target.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
 }
 const frame=document.getElementById('frame');
 if(!frame){
  if(window.self!==window.top||!/(\/java\/|\/lectures\/|\/it\/lecture-|\/it\/practice-|\/practice\.html)/.test(location.pathname))return;
  const storageKey=()=> 'tb-scroll:standalone:'+location.pathname+(location.pathname.endsWith('/course.html')?location.hash:'');let key=storageKey();let timer,cancelled=false,ready=false,saved=0;try{saved=Number(localStorage.getItem(key))||0;}catch{}
  const save=()=>{try{localStorage.setItem(key,String(scrollY));}catch{}};
  const restore=()=>{if(cancelled)return;let id='';try{id=decodeURIComponent(location.hash.slice(1));}catch{}const target=id?document.getElementById(id):null;
   if(target){reveal(target);target.scrollIntoView({block:'start',behavior:'instant'});}
   else{scrollTo({top:saved,behavior:'instant'});}ready=true;
  };
  for(const event of ['wheel','touchstart','keydown'])document.addEventListener(event,()=>cancelled=true,{once:true,passive:true});
  window.addEventListener('scroll',()=>{if(!ready)return;clearTimeout(timer);timer=setTimeout(save,180);},{passive:true});window.addEventListener('pagehide',save);
  if(location.pathname.endsWith('/course.html'))window.addEventListener('hashchange',()=>{clearTimeout(timer);key=storageKey();try{saved=Number(localStorage.getItem(key))||0;}catch{saved=0;}cancelled=false;requestAnimationFrame(restore);});
  if(document.readyState==='complete')requestAnimationFrame(restore);else window.addEventListener('load',()=>requestAnimationFrame(restore),{once:true});return;
 }

 let current='',doc=null,win=null,throttle,restoreSerial=0,detach=()=>{};
 const parse=()=>{const [key,...parts]=location.hash.slice(1).split('/');let section='';try{section=decodeURIComponent(parts.join('/'));}catch{}return {key,section};};
 const getStore=key=>{try{return Number(localStorage.getItem('tb-scroll:'+key))||0;}catch{return 0;}};
 function save(){if(!current||!win)return;try{
 const headings=[...doc.querySelectorAll('main>article h2[id]')].filter(h=>h.getBoundingClientRect().top<=120);if(headings.length)updateExternal(headings.at(-1).id);
localStorage.setItem('tb-scroll:'+current,String(Math.max(0,win.scrollY)));}catch{}}
 function updateExternal(id=''){
  const a=document.getElementById('external');if(!a||!doc)return;
  const url=new URL(doc.URL);url.search='';if(id)url.hash=id;a.href=url.href;
 }
 function restore(){
  const {key,section}=parse();if(!document.body.classList.contains('reading')){detach();restoreSerial++;current='';return;}if(!key||!frame.getAttribute('src'))return;
  let nextDoc,nextWin;try{nextDoc=frame.contentDocument;nextWin=frame.contentWindow;if(!nextDoc||nextDoc.readyState!=='complete')return;const expected=new URL(frame.src,location.href),actual=new URL(nextDoc.URL);if(expected.pathname!==actual.pathname||expected.search!==actual.search)return;}catch{return;}
  detach();clearTimeout(throttle);current=key;doc=nextDoc;win=nextWin;const serial=++restoreSerial,savedPosition=getStore(key);
  let cancelled=false;const cancel=()=>{cancelled=true;};const scroll=()=>{clearTimeout(throttle);throttle=setTimeout(save,180);};
  win.addEventListener('scroll',scroll,{passive:true});for(const event of ['wheel','touchstart','keydown'])doc.addEventListener(event,cancel,{passive:true});
  detach=()=>{win?.removeEventListener('scroll',scroll);for(const event of ['wheel','touchstart','keydown'])nextDoc.removeEventListener(event,cancel);};
  const apply=()=>{if(serial!==restoreSerial||cancelled)return;
   const target=section?doc.getElementById(section):null;
   if(target){reveal(target);target.scrollIntoView({block:'start',behavior:'instant'});updateExternal(section);}
   else {win.scrollTo({top:savedPosition,behavior:'instant'});updateExternal();}
  };
  win.requestAnimationFrame(()=>win.requestAnimationFrame(apply));
  Promise.all([...doc.images].filter(img=>!img.complete).map(img=>new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}))).then(apply);
 }
 frame.addEventListener('load',restore);
 window.addEventListener('hashchange',()=>{save();setTimeout(restore,0);});
 window.addEventListener('pagehide',save);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
 window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.type!=='textbook-section'||typeof event.data.id!=='string')return;
  const id=event.data.id;if(!frame.contentDocument?.getElementById(id))return;
  const {key}=parse();history.replaceState(null,'','#'+key+'/'+encodeURIComponent(id));updateExternal(id);save();
 });
 setTimeout(restore,0);
})();
