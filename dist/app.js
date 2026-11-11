const sqlTopics = [
  {id: "01", title: "Базовые понятия", detail: "Таблицы, ключи, типы данных и первый запрос."},
  {id: "02", title: "Связи между таблицами", detail: "Внешние ключи, типы связей и ER-диаграммы."},
  {id: "03", title: "Нормализация", detail: "Как убрать дублирование и навести порядок в данных."},
  {id: "04", title: "SELECT и запросы", detail: "Отбор, соединения таблиц, группировка и агрегаты."},
  {id: "05", title: "Продвинутый SQL", detail: "Подзапросы, транзакции, индексы и права доступа."}
];
const titles = Object.fromEntries(sqlTopics.map(topic => [topic.id, topic.title]));
Object.assign(titles, {setup: "Подготовка окружения", practice: "SQL-практикум"});
const javaTopics = window.javaLessons || [];
const javaWorks = window.javaPractices || [];
const javaByKey = Object.fromEntries([
  ...javaTopics.map(topic => ["java-" + topic.id, topic]),
  ...javaWorks.map(work => ["java-work-" + work.id, {...work, work: true}])
]);
const frame = document.getElementById("frame");
const status = document.getElementById("reader-status");
let lastSQL = "home";
let lastJava = "java";

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function topicCard(href, label, title, description, footer) {
  const card = document.createElement("a");
  card.className = "topic-card";
  card.href = href;
  const top = element("span", label, "card-number");
  top.append(element("b", "↗"));
  card.append(top, element("h3", title), element("p", description),
    element("span", footer, "card-bottom"));
  return card;
}

function sidebarLink(href, number, title, container) {
  const link = document.createElement("a");
  link.href = href;
  link.append(element("i", number), document.createTextNode(title));
  container.append(link);
}

for (const topic of sqlTopics) {
  document.getElementById("sql-topic-cards").append(topicCard(
    "#" + topic.id, "ЛЕКЦИЯ " + topic.id, topic.title, topic.detail, "Открыть лекцию →"
  ));
}
for (const topic of javaTopics) {
  const href = "#java-" + topic.id;
  sidebarLink(href, topic.number, topic.title, document.getElementById("java-topic-links"));
  document.getElementById("java-topic-cards").append(topicCard(
    href, "ТЕМА " + topic.number, topic.title,
    topic.full ? "Лекция, примеры и конспект под запись." : "Конспект под запись и основные понятия.",
    "Открыть тему →"
  ));
}
for (const work of javaWorks) {
  const href = "#java-work-" + work.id;
  sidebarLink(href, work.number, work.title, document.getElementById("java-work-links"));
  for (const id of ["java-work-cards", "all-java-work-cards"]) {
    document.getElementById(id).append(topicCard(
      href, work.number + " / JAVA", work.title,
      "Задание, варианты и ссылки на теорию.", "Перейти к работе →"
    ));
  }
}
document.getElementById("java-count").textContent = javaTopics.length + " тем · " + javaWorks.length + " работ";
document.getElementById("java-meta").textContent = javaTopics.length + " ТЕМ / ОТ ОСНОВ К ООП";

document.getElementById("course-select").onchange = event => {
  const course = event.target.value;
  if (course === "it") location.href = "it/";
  else location.hash = course === "java" ? lastJava : lastSQL;
};
document.getElementById("toggle-sidebar").onclick = event => {
  const mobile = matchMedia("(max-width: 900px)").matches;
  if (mobile) {
    const open = document.body.classList.toggle("course-menu-open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  } else {
    const hidden = document.body.classList.toggle("focus-view");
    event.currentTarget.setAttribute("aria-expanded", String(!hidden));
  }
};
frame.addEventListener("load", () => { status.hidden = true; });

function route() {
  let key = location.hash.slice(1) || "library";
  const courseAnchor = key === "courses";
  if (courseAnchor) key = "library";
  if (!["library", "home", "java", "java-practice", "all-practice"].includes(key) && !titles[key] && !javaByKey[key]) {
    key = "library";
  }
  const java = key === "java" || key === "java-practice" || Boolean(javaByKey[key]);
  const library = key === "library";
  const hub = key === "all-practice";
  const reader = Boolean(titles[key] || javaByKey[key]);
  if (java) lastJava = key;
  else if (!library && !hub) lastSQL = key;
  document.body.classList.toggle("library-view", library);
  document.body.classList.toggle("practice-hub-view", hub);
  document.body.classList.toggle("reading", reader);
  document.body.classList.remove("course-menu-open");
  if (!reader) document.body.classList.remove("focus-view");
  document.getElementById("sql-nav").hidden = java;
  document.getElementById("java-nav").hidden = !java;
  document.getElementById("course-select").value = java ? "java" : "sql";
  for (const [id, visible] of [
    ["library", library], ["home", key === "home"], ["java-home", key === "java"],
    ["java-practice-home", key === "java-practice"], ["all-practice", hub], ["reader", reader]
  ]) {
    document.getElementById(id).hidden = !visible;
  }
  document.querySelectorAll("#course-sidebar nav a").forEach(link => {
    const active = link.hash === "#" + key;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.getElementById("toggle-sidebar").setAttribute(
    "aria-expanded", String(!document.body.classList.contains("focus-view"))
  );
  if (reader) {
    const topic = javaByKey[key];
    const url = topic
      ? "java/" + (topic.work ? "work-" : "") + topic.id + ".html?v=20"
      : key === "practice" ? "practice.html?v=20"
      : key === "setup" ? "lectures/setup.html?v=20"
      : "lectures/course.html?v=20#" + key;
    if (frame.getAttribute("src") !== url) {
      status.hidden = false;
      frame.src = url;
    }
    frame.title = topic?.title || titles[key];
    document.getElementById("external").href = url;
    document.getElementById("reader-name").textContent = frame.title;
    document.getElementById("reader-back").href = topic?.work ? "#java-practice" : java ? "#java" : "#home";
  }
  document.title = (reader ? frame.title : library ? "Учебник" : hub ? "Практические работы" : java ? "Java" : "Базы данных и SQL") + " · От понимания к практике";
  window.scrollTo(0, 0);
  if (courseAnchor) requestAnimationFrame(() => document.getElementById("courses").scrollIntoView());
}
window.addEventListener("hashchange", route);
route();
