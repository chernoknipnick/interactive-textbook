const outline=document.getElementById('outline');
document.querySelectorAll('main > article h2').forEach((heading,i)=>{
  if(heading.closest('.notes'))return;
  if(!heading.id)heading.id='section-'+i;
  const row=document.createElement('div');row.className='outline-row';
  const a=document.createElement('a');a.href='#'+heading.id;a.textContent=heading.textContent;
  a.addEventListener('click',()=>{if(window.parent!==window)window.parent.postMessage({type:'textbook-section',id:heading.id},location.origin);});
  const share=document.createElement('button');share.type='button';share.className='share-section';share.textContent='Ссылка';share.setAttribute('aria-label','Скопировать ссылку на раздел «'+heading.textContent+'»');
  share.onclick=async()=>{const url=new URL(location.href);url.search='';url.hash=heading.id;try{await navigator.clipboard.writeText(url.href);share.textContent='Скопировано';setTimeout(()=>share.textContent='Ссылка',1500);}catch{share.textContent='Копирование недоступно';}};
  row.append(a,share);outline.append(row);
});

document.getElementById('outline-toggle').onclick=e=>{outline.hidden=!outline.hidden;e.currentTarget.setAttribute('aria-expanded',String(!outline.hidden));};
document.querySelectorAll('.codehilite').forEach(block=>{
  const button=document.createElement('button');button.className='copy';button.textContent='Копировать';
  button.onclick=async()=>{try{await navigator.clipboard.writeText(block.querySelector('pre').innerText);button.textContent='Скопировано';setTimeout(()=>button.textContent='Копировать',1500);}catch(e){button.textContent='Выдели код для копирования';}};
  block.appendChild(button);
});

if (window.self === window.top) {
  const updates = document.createElement("script");
  updates.src = new URL("../site-updates.js?v=1", document.currentScript.src).href;
  document.head.append(updates);
}
