(() => {
 const path=location.pathname;
 const java=path.includes("/java/"),it=path.includes("/it/"),sql=path.includes("/lectures/");
 if(!java&&!it&&!sql)return;
 document.body.dataset.material=java?"java":it?"it":"sql";
 document.body.dataset.course=java?"java":it?"it":"sql";
 const summaries={
 "languages":"Язык программирования выбирают под задачу и среду выполнения. Синтаксис различается, но переменные, условия, циклы и функции встречаются во многих языках.",
 "intro":"Программа — это последовательность команд для решения задачи. В Java исходный код компилируется в байт-код, который выполняет JVM.",
 "first-program":"Java-программа начинает выполнение с метода main. Изменяй код небольшими шагами: напиши, запусти и проверь результат.",
 "types":"Тип задаёт, какие значения можно хранить и какие операции над ними допустимы. Объявление переменной связывает её имя, тип и значение.",
 "bitwise":"Поразрядные операции работают с отдельными битами целого числа. Не путай их с логическими операциями над условиями.",
 "conditions":"Условие выбирает, какой блок кода выполнить. if проверяет логическое выражение; else задаёт альтернативу.",
 "loops":"Цикл повторяет команды. Чтобы понять результат, отслеживай начальное состояние, условие, тело и изменение переменных на каждом шаге.",
 "arrays":"Массив хранит элементы одного типа и имеет фиксированную длину. Индексы начинаются с нуля. Переменная массива хранит ссылку, поэтому присваивание ссылки не копирует элементы.",
 "methods":"Метод объединяет команды в именованное действие. Параметры передают входные значения, а return возвращает результат вызывающему коду.",
 "references":"Ссылочная переменная хранит ссылку на объект. Две переменные могут указывать на один объект; изменение объекта через одну ссылку видно через другую.",
 "classes":"Класс описывает устройство и поведение объектов. У каждого объекта есть своё состояние, а методы работают с этим состоянием.",
 "constructors":"Конструктор задаёт начальное состояние нового объекта. Он вызывается при создании через new и помогает не оставлять объект в некорректном состоянии.",
 "static":"Член static принадлежит классу, а не отдельному объекту. Поля экземпляра хранят состояние конкретного объекта; static используется для общего состояния или действий класса.",
 "oop-summary":"Объекты объединяют состояние и поведение. Разделяй ответственность классов и управляй доступом к данным, чтобы программу было проще понимать и изменять."
 };
 function keyBox(text){const box=document.createElement("aside");box.className="learning-key";box.setAttribute("aria-label","Главное — запомнить");const title=document.createElement("strong");title.textContent="Главное — запомнить";const p=document.createElement("p");p.textContent=text;box.append(title,p);return box;}
 if(java){
  const id=path.split("/").pop().replace(/\.html$/,""), article=document.querySelector("main>article"), h1=article?.querySelector("h1");
  if(h1&&summaries[id]) h1.after(keyBox(summaries[id]));
  document.querySelectorAll(".term-legend").forEach(e=>e.open=false);
  document.querySelectorAll(".notes>summary").forEach(e=>e.textContent="Записать в тетрадь · Краткий конспект");
  document.querySelectorAll(".lesson-visual").forEach(e=>{const label=document.createElement("strong");label.className="learning-example-label";label.textContent="Разбор на интерактивном примере";e.prepend(label);});
  // Keep the lesson heading first, with the contents control beside it, not above it.
  const tools=document.querySelector(".tools");if(h1&&tools){h1.before(tools);tools.classList.add("lesson-tools");}
  document.querySelectorAll("main>article>p").forEach(p=>{if(p.textContent.startsWith("Официальные материалы:")){const d=document.createElement("details");d.className="learning-extra";const s=document.createElement("summary");s.textContent="Дополнительно · Источники и документация";p.before(d);d.append(s,p);}});
 }
 if(it){const article=document.querySelector("article.lesson");if(article){const note=[...article.querySelectorAll(":scope>p")].find(p=>p.textContent.startsWith("Под запись."));if(note){const h=document.querySelector(".lesson-head h1");if(h)h.after(keyBox(note.textContent.replace(/^Под запись\.\s*/,"")));}
 const legend=document.querySelector(".legend");if(legend){const d=document.createElement("details");d.className="term-legend";const summary=document.createElement("summary");summary.textContent="Как читать цвета в этой лекции";legend.before(d);d.append(summary,legend);}}}
 if(sql){
 document.querySelectorAll(".lecture-nav").forEach(nav=>{const contents=document.createElement("details");contents.className="sql-contents";const summary=document.createElement("summary");summary.textContent="Содержание темы";const list=document.createElement("div");while(nav.firstChild)list.append(nav.firstChild);contents.append(summary,list);nav.append(contents);list.addEventListener("click",e=>{if(e.target.closest("button"))contents.open=false;});});
 document.querySelectorAll(".hero h1 br").forEach(br=>br.replaceWith(document.createTextNode(" ")));
 document.querySelectorAll(".hero-meta").forEach(meta=>{const d=document.createElement("details"),summary=document.createElement("summary");d.className="lesson-meta";summary.textContent="О занятии · инструменты и время";meta.before(d);d.append(summary,meta);});
 const notes=["База данных хранит связанные сведения в таблицах. Первичный ключ однозначно определяет строку, а NULL обозначает отсутствие значения.","Внешний ключ связывает строки разных таблиц. Тип связи определяет, скольким объектам с каждой стороны могут соответствовать связанные объекты.","Нормализация разделяет данные по смыслу, чтобы избежать дублирования и ошибок при добавлении, изменении и удалении строк.","SELECT описывает, какие данные получить: FROM задаёт источник, WHERE отбирает строки, а группировка и агрегатные функции обобщают результат.","Транзакции объединяют изменения в целое; индексы помогают находить данные; права доступа ограничивают действия пользователей."];
 document.querySelectorAll(".lecture-panel").forEach((panel,i)=>{const hero=panel.querySelector(".hero");if(hero&&notes[i]){const h=hero.querySelector("h1");if(h)h.after(keyBox(notes[i]));}});}
})();
