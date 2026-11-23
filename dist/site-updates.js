(() => {
  if (window.top !== window.self || document.getElementById("site-updates-root")) return;
  const scriptUrl = new URL(document.currentScript.src);
  const base = new URL("./", scriptUrl);
  const root = document.createElement("div");
  root.id = "site-updates-root";
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("site-updates.css" + scriptUrl.search, base).href;
  document.head.append(css);
  root.innerHTML = `
    <button class="su-launcher" type="button" aria-haspopup="dialog">Что нового <span class="su-badge" hidden>Новое</span></button>
    <aside class="su-toast" hidden aria-label="Обновление учебника">
      <p>В учебнике появились обновления</p>
      <button type="button" class="su-view">Посмотреть</button>
      <button type="button" class="su-dismiss" aria-label="Скрыть уведомление">×</button>
    </aside>
    <dialog class="su-dialog" aria-labelledby="su-title">
      <div class="su-top">
        <div class="su-head"><h2 id="su-title">Новости учебника</h2><button type="button" class="su-close" aria-label="Закрыть окно">×</button></div>
        <div class="su-tabs" role="group" aria-label="Новости и обратная связь">
          <button type="button" class="su-news-tab" aria-pressed="true" aria-controls="su-news">Что нового</button>
          <button type="button" class="su-feedback-tab" aria-pressed="false" aria-controls="su-form">Предложить идею</button>
        </div>
      </div>
      <div class="su-body" tabindex="0" role="region" aria-label="Содержимое окна">
        <div class="su-news" id="su-news"><p class="su-load">Загружаем обновления…</p></div>
        <form class="su-form" id="su-form" hidden>
          <p>Есть идея для учебника или что-то осталось непонятным? Расскажи об этом.</p>
          <label>О чём сообщение<select name="category"><option value="unclear">Непонятно в теме</option><option value="bug">Ошибка на сайте</option><option value="idea">Идея для учебника</option></select></label>
          <label>Сообщение<textarea name="message" required minlength="10" maxlength="3000" rows="4" placeholder="Что стоит добавить, исправить или объяснить подробнее?"></textarea></label>
          <label>Ссылка на тему <span>(необязательно)</span><input name="topic_url" type="url" maxlength="2048"></label>
          <label>Имя или группа <span>(необязательно)</span><input name="sender_name" maxlength="100" autocomplete="name"></label>
          <label class="su-trap" aria-hidden="true">Оставь пустым<input name="website" tabindex="-1" autocomplete="off"></label>
          <button class="su-send" type="submit">Отправить</button>
          <p class="su-result" role="status" aria-live="polite"></p>
        </form>
      </div>
    </dialog>`;
  document.body.append(root);
  const launcher = root.querySelector(".su-launcher");
  const badge = root.querySelector(".su-badge");
  const toast = root.querySelector(".su-toast");
  const dialog = root.querySelector("dialog");
  const scrollArea = root.querySelector(".su-body");
  const closeButton = root.querySelector(".su-close");
  const newsTab = root.querySelector(".su-news-tab");
  const feedbackTab = root.querySelector(".su-feedback-tab");
  const news = root.querySelector(".su-news");
  const form = root.querySelector("form");
  const result = root.querySelector(".su-result");
  const readKey = "textbook-updates-read";
  const toastKey = "textbook-updates-shown";
  let releases = [];
  let returnFocus;
  let submissionId = crypto.randomUUID();
  let submittedContent = null;
  let suggestedTopic = currentTopic();
  form.elements.topic_url.value = suggestedTopic;

  function currentTopic() {
    const topic = new URL(location.href);
    topic.search = "";
    if (topic.hash.includes("=") || topic.hash.includes("&")) topic.hash = "";
    return topic.href;
  }

  function stored(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function remember(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }
  function unread() {
    badge.hidden = !releases.length || stored(readKey) === releases[0].id;
    launcher.setAttribute("aria-label", badge.hidden ? "Что нового в учебнике" : "Что нового в учебнике — есть обновления");
  }
  function showTab(feedback) {
    news.hidden = feedback;
    form.hidden = !feedback;
    newsTab.setAttribute("aria-pressed", String(!feedback));
    feedbackTab.setAttribute("aria-pressed", String(feedback));
    scrollArea.scrollTop = 0;
    if (!feedback && releases.length) {
      remember(readKey, releases[0].id);
      unread();
    }
  }
  function open(feedback = false, restoreFocus = () => launcher.focus()) {
    if (dialog.open) return;
    returnFocus = restoreFocus;
    const nextTopic = currentTopic();
    if (form.elements.topic_url.value === suggestedTopic) form.elements.topic_url.value = nextTopic;
    suggestedTopic = nextTopic;
    toast.hidden = true;
    dialog.showModal();
    showTab(feedback);
    closeButton.focus();
  }
  window.textbookUpdates = {open};
  launcher.onclick = () => open();
  root.querySelector(".su-view").onclick = () => open();
  root.querySelector(".su-dismiss").onclick = () => { toast.hidden = true; };
  closeButton.onclick = () => dialog.close();
  dialog.addEventListener("close", () => returnFocus?.());
  newsTab.onclick = () => showTab(false);
  feedbackTab.onclick = () => showTab(true);
  window.addEventListener("storage", event => {
    if (event.key === readKey) unread();
  });

  fetch(new URL("site-updates.json", base), {cache: "no-cache"})
    .then(response => {
      if (!response.ok) throw new Error("feed");
      return response.json();
    })
    .then(feed => {
      releases = feed.releases.filter(release => typeof release.id === "string" && Array.isArray(release.items));
      news.replaceChildren();
      for (const release of releases) {
        const section = document.createElement("section");
        section.className = "su-release";
        const date = document.createElement("p");
        date.className = "su-date";
        date.textContent = new Intl.DateTimeFormat("ru-RU", {dateStyle:"long", timeZone:"UTC"})
          .format(new Date(release.date + "T00:00:00Z"));
        const heading = document.createElement("h3");
        heading.textContent = release.title;
        const list = document.createElement("ul");
        for (const item of release.items) {
          const li = document.createElement("li");
          li.textContent = item.text;
          if (item.url) {
            const url = new URL(item.url, base);
            if (url.origin === base.origin && url.pathname.startsWith(base.pathname)) {
              const link = document.createElement("a");
              link.href = url.href;
              link.textContent = "Открыть →";
              li.append(document.createTextNode(" "), link);
            }
          }
          list.append(li);
        }
        section.append(date, heading, list);
        news.append(section);
      }
      if (dialog.open && form.hidden && releases.length) remember(readKey, releases[0].id);
      unread();
      if (releases.length && stored(readKey) !== releases[0].id && stored(toastKey) !== releases[0].id) {
        remember(toastKey, releases[0].id);
        toast.hidden = false;
      }
    })
    .catch(() => {
      news.textContent = "Не удалось загрузить список изменений. Попробуй открыть страницу позже.";
    });

  async function configuration() {
    if (!window.textbookConfig) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL("account/config.js", base).href;
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    }
    const config = window.textbookConfig;
    if (!config?.url || !config.publishableKey) throw new Error("config");
    return config;
  }

  form.onsubmit = async event => {
    event.preventDefault();
    const submit = form.querySelector(".su-send");
    submit.disabled = true;
    result.textContent = "Отправляем…";
    try {
      const config = await configuration();
      const content = {
        p_category: form.elements.category.value,
        p_message: form.elements.message.value.trim(),
        p_topic_url: form.elements.topic_url.value.trim(),
        p_sender_name: form.elements.sender_name.value.trim(),
        p_website: form.elements.website.value
      };
      const fingerprint = JSON.stringify(content);
      if (submittedContent !== null && submittedContent !== fingerprint) submissionId = crypto.randomUUID();
      submittedContent = fingerprint;
      const response = await fetch(config.url + "/rest/v1/rpc/textbook_send_feedback", {
        method: "POST",
        headers: {"Content-Type": "application/json", apikey: config.publishableKey},
        body: JSON.stringify({
          p_id: submissionId,
          ...content
        })
      });
      if (!response.ok || await response.json() !== submissionId) throw new Error("send");
      form.elements.message.value = "";
      submissionId = crypto.randomUUID();
      submittedContent = null;
      result.textContent = "Спасибо, сообщение отправлено.";
    } catch {
      result.textContent = "Не удалось отправить. Текст остался в форме. Попробуй ещё раз.";
    } finally {
      submit.disabled = false;
    }
  };
})();
