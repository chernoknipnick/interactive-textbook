const outline=document.getElementById('outline');
document.querySelectorAll('main > article h2').forEach((heading,i)=>{
  if(!heading.id)heading.id='section-'+i;
  const a=document.createElement('a');a.href='#'+heading.id;a.textContent=heading.textContent;outline.appendChild(a);
});
document.getElementById('outline-toggle').onclick=e=>{outline.hidden=!outline.hidden;e.currentTarget.setAttribute('aria-expanded',String(!outline.hidden));};
document.querySelectorAll('.codehilite').forEach(block=>{
  const button=document.createElement('button');button.className='copy';button.textContent='Копировать';
  button.onclick=async()=>{try{await navigator.clipboard.writeText(block.querySelector('pre').innerText);button.textContent='Скопировано';setTimeout(()=>button.textContent='Копировать',1500);}catch(e){button.textContent='Выдели код для копирования';}};
  block.appendChild(button);
});
