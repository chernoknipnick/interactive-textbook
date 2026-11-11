(() => {
  const materialPath = location.pathname;
  if (materialPath.includes("/lectures/") || materialPath.endsWith("/practice.html")) {
    document.body.classList.add("tb-legacy-material");
  }
  if (window.self !== window.top) {
    document.body.classList.add("embedded-reader");
    return;
  }
  if (document.querySelector(".tb-header")) return;
  const base = new URL("./", document.currentScript.src);
  const header = document.createElement("header");
  header.className = "tb-header";
  const logo = document.createElement("a");
  logo.className = "tb-brand";
  logo.href = new URL("./#library", base).href;
  const icon = document.createElement("img");
  icon.src = new URL("favicon.svg", base).href;
  icon.alt = "";
  logo.append(icon, document.createTextNode("учебник"), Object.assign(document.createElement("span"), {textContent: "./"}));
  const topicToggle = document.createElement("button");
  topicToggle.className = "tb-topic-toggle";
  topicToggle.textContent = "Темы";
  topicToggle.type = "button";
  topicToggle.setAttribute("aria-expanded", "false");
  const menuToggle = document.createElement("button");
  menuToggle.className = "tb-mobile-toggle";
  menuToggle.type = "button";
  menuToggle.textContent = "Меню";
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-controls", "tb-global-nav");
  const nav = document.createElement("nav");
  nav.id = "tb-global-nav";
  nav.className = "tb-global-nav";
  nav.setAttribute("aria-label", "Основная навигация");
  for (const [number, title, path] of [
    ["01", "Дисциплины", "./#library"],
    ["02", "Практика", "./#all-practice"],
    ["03", "Личный кабинет", "account/"],
    ["04", "Поиск", "./#search"]
  ]) {
    const link = document.createElement("a");
    link.href = new URL(path, base).href;
    const label = document.createElement("small");
    label.textContent = number;
    link.append(label, document.createTextNode(title));
    nav.append(link);
  }
  const feedback = document.createElement("button");
  feedback.type = "button";
  feedback.className = "tb-contact";
  feedback.textContent = "Помощь и идеи";
  const news=document.createElement("button");news.type="button";news.className="tb-contact tb-news";news.textContent="Что нового";
  news.onclick=async()=>{closeMenus();await ensureUpdates();document.querySelector(".su-launcher")?.click();};
  nav.append(news,feedback);
  header.append(logo, topicToggle, menuToggle, nav);
  const oldHeader = document.querySelector("body > header");
  if (oldHeader) oldHeader.replaceWith(header);
  else document.body.prepend(header);
  const fog = document.createElement("div");
  fog.className = "tb-atmosphere";
  fog.setAttribute("aria-hidden", "true");
  document.body.prepend(fog);
  const scrim = document.createElement("div");
  scrim.className = "tb-scrim";
  document.body.append(scrim);
  document.body.classList.add("has-site-shell");
  const sidebar = document.querySelector("#course-sidebar, .layout > aside");
  if (sidebar) {
    sidebar.classList.add("tb-topics");
    if (!sidebar.id) sidebar.id = "tb-course-topics";
    document.body.classList.add("has-course-menu");
    topicToggle.setAttribute("aria-controls", sidebar.id);
  }
  function closeMenus(restoreFocus = false) {
    const opener = document.body.classList.contains("course-menu-open") ? topicToggle : menuToggle;
    if(restoreFocus) opener.focus();
    document.body.classList.remove("site-menu-open", "course-menu-open");
    topicToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-expanded", "false");
  }
  menuToggle.onclick = () => {
    const open = !document.body.classList.contains("site-menu-open");
    closeMenus();
    document.body.classList.toggle("site-menu-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
  };
  topicToggle.onclick = () => {
    const open = !document.body.classList.contains("course-menu-open");
    closeMenus();
    document.body.classList.toggle("course-menu-open", open);
    topicToggle.setAttribute("aria-expanded", String(open));
  };
  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => closeMenus()));
  function markSection() {
    const links = nav.querySelectorAll("a");
    const active = location.pathname.includes("/account/") ? 2
      : location.hash === "#search" ? 3 : location.hash.includes("practice") || location.hash.includes("java-work-") || location.pathname.includes("practice") ? 1 : 0;
    links.forEach((link, index) => {
      if (index === active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }
  markSection();
  window.addEventListener("hashchange", markSection);
  sidebar?.addEventListener("click", event => {
    if (event.target.closest("a")) closeMenus();
  });
  scrim.onclick = () => closeMenus(true);
  window.addEventListener("hashchange", () => closeMenus());
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && (document.body.classList.contains("site-menu-open") || document.body.classList.contains("course-menu-open"))) closeMenus(true);
  });
  // Shared orientation for standalone material pages.
  const main = document.querySelector("main"), isIT = location.pathname.includes("/it/");
  if(main && !document.getElementById("app-breadcrumb")) {
    const crumb = document.createElement("nav");crumb.className="tb-breadcrumb tb-standalone-crumb";crumb.setAttribute("aria-label","Путь к материалу");
    const addLink=(text,url)=>{const a=document.createElement("a");a.textContent=text;a.href=new URL(url,base).href;crumb.append(a);};
    const sep=()=>crumb.append(document.createTextNode(" / "));
    addLink("Дисциплины","./#library");sep();
    const title=main.querySelector("h1")?.textContent.trim()||document.title;
    if(isIT){addLink("Информационные технологии","it/");
      if(!location.pathname.endsWith("/it/")&&!location.pathname.endsWith("/it/index.html")){
        sep();const current=document.createElement("span");current.textContent=title;crumb.append(current);
        try{localStorage.setItem("textbook-last-material",JSON.stringify({href:"it/"+location.pathname.split("/").pop(),title,course:"Информационные технологии"}));}catch{}
      }
      const tabs=document.createElement("nav");tabs.className="course-tabs";tabs.setAttribute("aria-label","Материалы дисциплины");
      for(const [label,path] of [["Лекции","it/#topic-01"],["Практика","it/#practice"]]){const a=document.createElement("a");a.textContent=label;a.href=new URL(path,base).href;if((location.pathname.includes("practice") || location.hash==="#practice") === (label==="Практика")) a.setAttribute("aria-current","page");tabs.append(a);}
      main.prepend(tabs);
    }else{const current=document.createElement("span");current.textContent=location.pathname.includes("/account/")?"Личный кабинет":title;crumb.append(current);}
    main.prepend(crumb);
  }
  let updatesReady;
  function ensureUpdates() {
    if (document.getElementById("site-updates-root")) return Promise.resolve();
    if (!updatesReady) {
      updatesReady = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL("site-updates.js?v=22", base).href;
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    }
    return updatesReady;
  }
  feedback.onclick = async () => {
    closeMenus();
    try {
      await ensureUpdates();
      document.querySelector(".su-launcher").click();
      document.querySelector(".su-feedback-tab").click();
    } catch {
      location.href = new URL("it/", base).href;
    }
  };
  ensureUpdates().catch(() => {});
})();
