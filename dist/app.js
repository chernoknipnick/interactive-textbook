const titles={'01':'Базовые понятия','02':'Связи между таблицами','03':'Нормализация','04':'SELECT и запросы','05':'Продвинутый SQL',setup:'Подготовка окружения',practice:'SQL-практикум'};
const javaTopics=window.javaLessons||[];
const javaWorks=window.javaPractices||[];
const javaByKey=Object.fromEntries([
  ...javaTopics.map(t=>['java-'+t.id,t]),
  ...javaWorks.map(t=>['java-work-'+t.id,{...t,work:true}])
]);
for(const topic of javaTopics){
  const link=document.createElement('a');link.href='#java-'+topic.id;
  const number=document.createElement('i');number.style.setProperty('--c','#ffb77c');number.textContent=topic.number;
  const label=document.createElement('span');label.textContent=topic.title;
  link.append(number,label);document.getElementById('java-topic-links').appendChild(link);
  const card=document.createElement('a');card.href=link.href;card.style.setProperty('--c','#ffb77c');
  const top=document.createElement('div');top.className='card-top';top.textContent='ТЕМА '+topic.number+' ↗';
  const title=document.createElement('h3');title.textContent=topic.title;
  const detail=document.createElement('p');detail.textContent=topic.full?'Полная лекция и конспект под запись':'Конспект под запись';
  const footer=document.createElement('footer');footer.textContent='Открыть материал →';
  card.append(top,title,detail,footer);document.getElementById('java-topic-cards').appendChild(card);
}
for(const work of javaWorks){
  const link=document.createElement('a');link.href='#java-work-'+work.id;
  const number=document.createElement('i');number.style.setProperty('--c','#ffb77c');number.textContent=work.number;
  const label=document.createElement('span');label.textContent=work.title;
  link.append(number,label);document.getElementById('java-work-links').appendChild(link);
  const card=document.createElement('a');card.href=link.href;card.style.setProperty('--c','#ffb77c');
  const top=document.createElement('div');top.className='card-top';top.textContent=work.number+' / '+(work.number.startsWith('ЛР')?'ЛАБОРАТОРНАЯ':'ПРАКТИЧЕСКАЯ');
  const title=document.createElement('h3');title.textContent=work.title;
  const detail=document.createElement('p');detail.textContent='Задание студенту · теория, варианты и примеры';
  const footer=document.createElement('footer');footer.textContent='Перейти к заданиям →';
  card.append(top,title,detail,footer);document.getElementById('java-work-cards').appendChild(card);
}
let lastSQL='home',lastJava='java';
document.getElementById('toggle-sidebar').addEventListener('click',e=>{
  const collapsed=document.body.classList.toggle('focus-view');
  e.currentTarget.setAttribute('aria-expanded',String(!collapsed));
});
function route(){
  let key=location.hash.slice(1)||'home';
  if(!titles[key]&&key!=='java'&&key!=='java-practice'&&!javaByKey[key])key='home';
  const java=key==='java'||key==='java-practice'||Boolean(javaByKey[key]);
  if(!java)lastSQL=key;else lastJava=key;
  document.body.classList.toggle('java-course',java);
  document.getElementById('course-brand').textContent=java?'Java':'SQL';
  document.querySelector('.brand').href=java?'#java':'#home';
  document.title=(java?'Java':'SQL')+' · Интерактивный учебник';
  document.getElementById('sql-nav').hidden=java;
  document.getElementById('java-nav').hidden=!java;
  document.getElementById('switch-sql').href='#'+lastSQL;
  document.getElementById('switch-java').href='#'+lastJava;
  for(const name of ['sql','java']){
    const link=document.getElementById('switch-'+name);
    if((name==='java')===java)link.setAttribute('aria-current','true');
    else link.removeAttribute('aria-current');
  }
  document.getElementById('course-heading').textContent=java?'Программирование на Java':'ОП.08 / Базы данных и SQL';
  const practiceLink=document.getElementById('header-practice');
  practiceLink.hidden=false;
  practiceLink.href=java?'#java-practice':'#practice';
  practiceLink.textContent=java?'Практические работы ↗':'Открыть песочницу ↗';
  document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+key));
  document.getElementById('home').hidden=key!=='home';
  document.getElementById('java-home').hidden=key!=='java';
  document.getElementById('java-practice-home').hidden=key!=='java-practice';
  const reader=Boolean(titles[key]||javaByKey[key]);
  document.body.classList.toggle('reading',reader);
  if(!reader){document.body.classList.remove('focus-view');document.getElementById('toggle-sidebar').setAttribute('aria-expanded','true');}
  document.getElementById('reader').hidden=!reader;
  if(reader){
    const topic=javaByKey[key];
    const url=topic?'java/'+(topic.work?'work-':'')+topic.id+'.html?v=8':key==='practice'?'practice.html?v=5':key==='setup'?'lectures/setup.html?v=5':'lectures/course.html?v=5#'+key;
    document.getElementById('frame').src=url;
    document.getElementById('external').href=url;
    document.getElementById('reader-name').textContent=javaByKey[key]?.title||titles[key];
    document.getElementById('reader-back').href=topic?.work?'#java-practice':java?'#java':'#home';
  }
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
route();
