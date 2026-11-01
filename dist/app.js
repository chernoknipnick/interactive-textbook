const titles={'01':'Базовые понятия','02':'Связи между таблицами','03':'Нормализация','04':'SELECT и запросы','05':'Продвинутый SQL',setup:'Подготовка окружения',practice:'SQL-практикум'};
let lastSQL='home';
function route(){
  let key=location.hash.slice(1)||'home';
  if(!titles[key]&&key!=='java')key='home';
  const java=key==='java';
  if(!java)lastSQL=key;
  document.body.classList.toggle('java-course',java);
  document.getElementById('course-brand').textContent=java?'Java':'SQL';
  document.querySelector('.brand').href=java?'#java':'#home';
  document.title=(java?'Java':'SQL')+' · Интерактивный учебник';
  document.getElementById('sql-nav').hidden=java;
  document.getElementById('java-nav').hidden=!java;
  document.getElementById('switch-sql').href='#'+lastSQL;
  for(const name of ['sql','java']){
    const link=document.getElementById('switch-'+name);
    if((name==='java')===java)link.setAttribute('aria-current','true');
    else link.removeAttribute('aria-current');
  }
  document.getElementById('course-heading').textContent=java?'Программирование на Java':'ОП.08 / Базы данных и SQL';
  document.getElementById('header-practice').hidden=java;
  document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+key));
  document.getElementById('home').hidden=key!=='home';
  document.getElementById('java-home').hidden=!java;
  const reader=Boolean(titles[key]);
  document.getElementById('reader').hidden=!reader;
  if(reader){
    const url=key==='practice'?'practice.html':key==='setup'?'lectures/setup.html':'lectures/course.html#'+key;
    document.getElementById('frame').src=url;
    document.getElementById('external').href=url;
    document.getElementById('reader-name').textContent=titles[key];
  }
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
route();
