const config = window.textbookConfig || {};
const notice = document.getElementById("notice");
const authSection = document.getElementById("auth");
const dashboard = document.getElementById("dashboard");
const recovery = document.getElementById("recovery");
const loading = document.getElementById("loading");
const retry = document.getElementById("account-retry");
const refreshOverlay = document.getElementById("account-refresh-overlay");
const refreshButton = document.getElementById("account-refresh");
const authForm = document.getElementById("auth-form");
let mode = "login";
let currentUser = null;
let teacher = false;
let refreshVersion = 0;
let feedbackVersion = 0;
let authIdentity;
let authSession;
let accountEpoch = 0;
let authRefreshTimer;
let refreshTask;
let overlayToken;
let lastRefreshAt = 0;
let activeActions = 0;
let pendingFeedbackWrites = 0;
const activeButtons = new Set();
let client;

function message(text, error = false) {
  notice.textContent = text;
  notice.dataset.error = String(error);
  notice.hidden = !text;
}

function explain(error) {
  const text = error.message || String(error);
  const errors = {
    INVALID_GROUP_CODE: "Код группы не найден. Проверь его у преподавателя.",
    PROFILE_REQUIRED: "Сначала сохрани имя и фамилию в профиле.",
    INVALID_NAME: "Укажи имя длиной от 2 до 100 символов.",
    INVALID_GROUP_NAME: "Название группы должно содержать от 2 до 80 символов.",
    GROUP_ACCESS_DENIED: "Эта группа недоступна для управления.",
    TEACHER_REQUIRED: "Создавать группы может преподаватель.",
    AUTH_REQUIRED: "Войди в кабинет ещё раз."
  };
  for (const [key, value] of Object.entries(errors)) {
    if (text.includes(key)) return value;
  }
  if (/invalid login credentials/i.test(text)) return "Проверь почту и пароль.";
  if (/email not confirmed/i.test(text)) return "Подтверди почту по письму Supabase, затем войди.";
  if (/rate limit|too many requests/i.test(text)) return "Сервис временно ограничил запросы. Повтори позже.";
  if (/already registered/i.test(text)) return "Для этой почты уже есть аккаунт. Перейди ко входу.";
  if (/fetch|network/i.test(text)) return "Не удалось связаться с сервисом. Проверь подключение и повтори.";
  if (/schema cache|does not exist|permission denied/i.test(text)) {
    return "Не удалось открыть данные кабинета. Обратись к преподавателю.";
  }
  return "Действие не выполнено. Повтори попытку или обратись к преподавателю.";
}

async function action(form, task) {
  const buttons = [...form.querySelectorAll("button:not(:disabled)")];
  const epoch = accountEpoch;
  const current = () => epoch === accountEpoch;
  activeActions++;
  for (const button of buttons) {
    activeButtons.add(button);
    button.disabled = true;
  }
  refreshButton.disabled = true;
  message("");
  try {
    await task(current);
  } catch (error) {
    if (current()) message(explain(error), true);
  } finally {
    if (current()) {
      activeActions--;
      for (const button of buttons) {
        activeButtons.delete(button);
        button.disabled = false;
      }
      refreshButton.disabled = activeActions > 0;
    }
  }
}

function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function button(text, handler) {
  const element = node("button", text);
  element.type = "button";
  element.addEventListener("click", () => action(element.parentElement, handler));
  return element;
}

function setMode(next) {
  mode = next;
  const register = mode === "register";
  document.getElementById("name-label").hidden = !register;
  document.getElementById("code-label").hidden = !register;
  authForm.elements.full_name.required = register;
  authForm.elements.password.autocomplete = register ? "new-password" : "current-password";
  document.getElementById("auth-submit").textContent = register ? "Создать аккаунт" : "Войти";
  document.getElementById("login-tab").setAttribute("aria-pressed", String(!register));
  document.getElementById("register-tab").setAttribute("aria-pressed", String(register));
  document.getElementById("forgot").hidden = register;
  message("");
}

async function renderGroup(user, isTeacher, group, version) {
  const card = node("section", null, "card group-card");
  const heading = node("div", null, "group-head");
  heading.append(node("h3", group.name));
  card.append(heading);
  if (isTeacher) {
    const [codeResult, membersResult] = await Promise.all([
      client.rpc("textbook_group_code", {p_group: group.id}),
      client.from("textbook_memberships").select("user_id,joined_at").eq("group_id", group.id).order("joined_at")
    ]);
    if (version !== refreshVersion) return;
    const code = checked(codeResult);
    const members = checked(membersResult);
    const invite = node("div", null, "invite");
    invite.append(node("p", "Код приглашения"), node("code", code));
    const controls = node("div", null, "group-actions");
    controls.append(button("Копировать код", async () => {
      try {
        await navigator.clipboard.writeText(code);
        message("Код скопирован. Передай его участникам группы.");
      } catch {
        message("Выдели и скопируй код из карточки группы.");
      }
    }));
    controls.append(button("Обновить код", async current => {
      if (!window.confirm("Создать новый код приглашения? Участникам, которые уже вступили, повторный вход в группу не потребуется.")) return;
      checked(await client.rpc("textbook_group_code", {p_group: group.id, p_rotate: true}));
      if (!current()) return;
      await refresh({restart: true});
      if (current()) message("Новый код готов. Используй его для следующих приглашений.");
    }));
    invite.append(controls);
    card.append(invite);

    const rename = document.createElement("form");
    rename.className = "group-name-form";
    const label = node("label", "Название группы");
    const input = document.createElement("input");
    input.name = "name";
    input.id = "group-name-" + group.id;
    input.defaultValue = group.name;
    input.required = true;
    input.minLength = 2;
    input.maxLength = 80;
    label.append(input);
    const save = node("button", "Переименовать");
    save.type = "submit";
    rename.append(label, save);
    rename.addEventListener("submit", event => {
      event.preventDefault();
      action(rename, async current => {
        const name = input.value.trim();
        const updated = checked(await client.from("textbook_groups")
          .update({name}).eq("id", group.id).select("id").single());
        if (!current()) return;
        if (!updated) throw new Error("GROUP_ACCESS_DENIED");
        if (input.value.trim() === name) input.value = name;
        input.defaultValue = name;
        await refresh({restart: true});
        if (current()) message("Название группы сохранено.");
      });
    });
    card.append(rename);

    heading.append(node("span", members.length + " участников", "badge"));
    if (members.length) {
      const profiles = checked(await client.from("textbook_profiles")
        .select("user_id,full_name").in("user_id", members.map(member => member.user_id)));
      if (version !== refreshVersion) return;
      const names = new Map(profiles.map(profile => [profile.user_id, profile.full_name]));
      const table = document.createElement("table");
      const header = document.createElement("thead");
      const headerRow = document.createElement("tr");
      for (const title of ["Студент", "Дата вступления", ""]) {
        const cell = node("th", title);
        cell.scope = "col";
        headerRow.append(cell);
      }
      header.append(headerRow);
      table.append(header);
      const body = document.createElement("tbody");
      for (const member of members) {
        const row = document.createElement("tr");
        row.append(node("td", names.get(member.user_id) || "Участник"));
        row.append(node("td", new Intl.DateTimeFormat("ru-RU").format(new Date(member.joined_at))));
        const controlsCell = document.createElement("td");
        controlsCell.append(button("Исключить", async current => {
          if (!window.confirm("Исключить участника из группы «" + group.name + "»?")) return;
          checked(await client.from("textbook_memberships").delete()
            .eq("group_id", group.id).eq("user_id", member.user_id));
          if (!current()) return;
          await refresh({restart: true});
          if (current()) message("Состав группы обновлён.");
        }));
        row.append(controlsCell);
        body.append(row);
      }
      table.append(body);
      card.append(table);
    } else {
      card.append(node("p", "Передай код студентам. После вступления они появятся здесь.", "muted"));
    }
  } else {
    const controls = node("div", null, "group-actions");
    controls.append(button("Выйти из группы", async current => {
      if (!window.confirm("Выйти из группы «" + group.name + "»? Для повторного вступления понадобится код.")) return;
      checked(await client.from("textbook_memberships").delete()
        .eq("group_id", group.id).eq("user_id", user.id));
      if (!current()) return;
      await refresh({restart: true});
      if (current()) message("Ты вышел из группы.");
    }));
    card.append(node("p", "Ты участник этой группы.", "muted"), controls);
  }
  return card;
}

async function loadGroups(user, isTeacher, version) {
  const section = document.getElementById("groups");
  let query = client.from("textbook_groups").select("id,name,created_at").order("created_at");
  if (isTeacher) query = query.eq("owner_id", user.id);
  const groups = checked(await query);
  const container = document.createDocumentFragment();
  // Keep requests for large teaching accounts bounded.
  for (let index = 0; index < groups.length && version === refreshVersion; index += 4) {
    const cards = await Promise.all(groups.slice(index, index + 4)
      .map(group => renderGroup(user, isTeacher, group, version)));
    if (version !== refreshVersion) return;
    container.append(...cards);
  }
  if (version !== refreshVersion) return;
  if (!groups.length) {
    container.append(node("p", isTeacher ? "Создай первую группу и пригласи студентов по коду." : "Пока нет групп. Введи код, который дал преподаватель.", "muted"));
  }
  const active = document.activeElement;
  let restoreInput;
  for (const input of container.querySelectorAll(".group-name-form input")) {
    const previous = document.getElementById(input.id);
    if (!previous) continue;
    if (previous.value !== previous.defaultValue) input.value = previous.value;
    if (previous === active) restoreInput = input;
  }
  section.replaceChildren(container);
  if (restoreInput) {
    restoreInput.focus({preventScroll: true});
    restoreInput.setSelectionRange(active.selectionStart, active.selectionEnd);
  }
}

async function loadFeedback(version = refreshVersion) {
  const section = document.getElementById("feedback-section");
  if (!teacher || !currentUser) { section.hidden = true; return; }
  const ticket = ++feedbackVersion;
  const latest = () => version === refreshVersion && ticket === feedbackVersion;
  const entries = checked(await client.from("textbook_feedback")
    .select("id,category,message,topic_url,sender_name,status,created_at")
    .order("created_at", {ascending: false}).limit(100));
  if (!latest() || pendingFeedbackWrites) return;
  document.getElementById("feedback-count").textContent = entries.length === 100 ? "100 последних" : String(entries.length);
  document.getElementById("feedback-new-count").textContent = "Новых среди загруженных: " + entries.filter(entry => entry.status === "new").length;
  const content = document.createDocumentFragment();
  const categories = {unclear: "Непонятно в теме", bug: "Ошибка на сайте", idea: "Идея развития"};
  for (const entry of entries) {
    const article = node("article", null, "feedback-entry");
    article.append(node("h3", categories[entry.category] || "Сообщение"));
    const date = new Intl.DateTimeFormat("ru-RU", {dateStyle: "medium", timeStyle: "short"})
      .format(new Date(entry.created_at));
    article.append(node("small", date + (entry.sender_name ? " · " + entry.sender_name : ""), "muted"));
    article.append(node("p", entry.message));
    if (entry.topic_url) {
      try {
        const url = new URL(entry.topic_url);
        if (url.origin === location.origin && url.pathname.startsWith(new URL("../", location.href).pathname)) {
          const link = node("a", "Открыть тему →");
          link.href = url.href;
          article.append(link);
        }
      } catch {}
    }
    const label = node("label", "Состояние");
    const select = document.createElement("select");
    for (const [value, text] of [["new", "Новое"], ["planned", "В плане"], ["done", "Готово"]]) {
      const option = node("option", text);
      option.value = value;
      select.append(option);
    }
    select.value = entry.status;
    select.addEventListener("change", () => action(label, async current => {
      const status = select.value;
      select.disabled = true;
      pendingFeedbackWrites++;
      try {
        checked(await client.from("textbook_feedback").update({status})
          .eq("id", entry.id).select("id").single());
      } catch (error) {
        select.value = entry.status;
        throw error;
      } finally {
        if (current()) pendingFeedbackWrites--;
        select.disabled = false;
      }
      if (!current()) return;
      entry.status = status;
      if (latest() && !refreshTask) {
        document.getElementById("feedback-new-count").textContent = "Новых среди загруженных: " + entries.filter(item => item.status === "new").length;
      } else {
        try {
          await loadFeedback();
        } catch {
          if (current()) message("Состояние сохранено. Не удалось обновить список предложений.", true);
          return;
        }
      }
      if (current()) message("Состояние предложения сохранено.");
    }));
    label.append(select);
    article.append(label);
    content.append(article);
  }
  if (!entries.length) content.append(node("p", "Пока нет сообщений из формы сайта.", "muted"));
  document.getElementById("feedback-list").replaceChildren(content);
  section.hidden = false;
}

function resetAccount() {
  ++refreshVersion;
  ++accountEpoch;
  activeActions = 0;
  pendingFeedbackWrites = 0;
  refreshButton.disabled = false;
  for (const button of activeButtons) button.disabled = false;
  activeButtons.clear();
  refreshTask = null;
  lastRefreshAt = 0;
  currentUser = null;
  teacher = false;
  window.textbookAdminPanel.reset();
  dashboard.hidden = true;
  dashboard.inert = false;
  dashboard.removeAttribute("aria-busy");
  refreshOverlay.hidden = true;
  overlayToken = undefined;
  recovery.hidden = true;
  retry.hidden = true;
  const profileForm = document.getElementById("profile-form");
  profileForm.elements.full_name.defaultValue = "";
  profileForm.reset();
  document.getElementById("account-email").textContent = "";
  document.getElementById("join-form").reset();
  document.getElementById("group-form").reset();
  document.getElementById("groups").replaceChildren();
  const feedback = document.getElementById("feedback-section");
  feedback.hidden = true;
  feedback.open = false;
  document.getElementById("feedback-list").replaceChildren();
}

function showSignedOut() {
  authIdentity = null;
  authSession = null;
  loading.hidden = true;
  authSection.hidden = false;
  document.getElementById("intro").textContent = "Войди, чтобы открыть профиль и свои учебные группы.";
}

function describeAccount(isTeacher, isAdmin) {
  const role = isTeacher ? "Преподаватель" : "Обучающийся";
  document.getElementById("role").textContent = isAdmin
    ? (isTeacher ? "Администратор · Преподаватель" : "Администратор")
    : role;
  document.getElementById("intro").textContent = isAdmin
    ? "Статистика учебника, учебные группы и предложения."
    : (isTeacher ? "Учебные группы и их участники." : "Твой профиль, группы и учебные материалы.");
}

async function verifyUser() {
  const token = authSession?.expires_at > Date.now() / 1000 + 15 ? authSession.access_token : undefined;
  // A valid token lets Auth verify the identity without holding the session lock
  // while the parallel profile and permissions requests read the session.
  const result = await client.auth.getUser(token);
  return token && result.error?.status === 401 ? client.auth.getUser() : result;
}

async function loadAccount(identity, version, background) {
  const current = () => version === refreshVersion;
  try {
    if (mode === "recovery") {
      const {user} = checked(await verifyUser());
      if (!current()) return false;
      if (user?.id !== identity) throw new Error("AUTH_REQUIRED");
      recovery.hidden = false;
      return true;
    }

    const [auth, profileResult, rolesResult] = await Promise.all([
      verifyUser(),
      client.from("textbook_profiles").select("full_name").eq("user_id", identity).maybeSingle(),
      client.from("textbook_teachers").select("user_id").eq("user_id", identity)
    ]);
    if (!current()) return false;
    const {user} = checked(auth);
    if (user?.id !== identity) {
      resetAccount();
      showSignedOut();
      return false;
    }
    currentUser = user;
    let profile = checked(profileResult);
    const isTeacher = checked(rolesResult).length > 0;
    if (!profile && user.user_metadata?.full_name) {
      checked(await client.rpc("textbook_save_profile", {p_full_name: user.user_metadata.full_name}));
      if (!current()) return false;
      profile = {full_name: user.user_metadata.full_name};
    }

    const groups = document.getElementById("groups");
    const loadingGroups = dashboard.hidden || teacher !== isTeacher;
    if (loadingGroups) {
      groups.replaceChildren(node("p", "Загружаем группы…", "muted"));
    }
    teacher = isTeacher;
    describeAccount(teacher, !document.getElementById("admin-section").hidden);
    document.getElementById("account-email").textContent = user.email || "";
    const name = document.getElementById("profile-form").elements.full_name;
    if (name.value === name.defaultValue) name.value = profile?.full_name || "";
    name.defaultValue = profile?.full_name || "";
    document.getElementById("teacher-section").hidden = !teacher;
    document.getElementById("join-section").hidden = teacher;
    try {
      const pending = sessionStorage.getItem("textbook-pending-group");
      if (pending && profile && !teacher) {
        const code = document.getElementById("join-form").elements.code;
        if (!code.value) code.value = pending;
        sessionStorage.removeItem("textbook-pending-group");
        message("Нажми «Присоединиться», чтобы вступить по сохранённому коду.");
      }
    } catch {}
    dashboard.hidden = false;
    recovery.hidden = true;
    loading.hidden = true;

    const updates = await Promise.allSettled([
      loadGroups(user, isTeacher, version),
      loadFeedback(version),
      window.textbookAdminPanel.load(client, user, () => authIdentity === identity, background).then(({isAdmin, complete}) => {
        if (current()) describeAccount(isTeacher, isAdmin);
        return complete;
      })
    ]);
    if (!current()) return false;
    if (updates[0].status === "rejected" && loadingGroups) {
      groups.replaceChildren(node("p", "Не удалось загрузить группы. Попробуй обновить кабинет.", "muted"));
    }
    const complete = updates.every(update => update.status === "fulfilled" && update.value !== false);
    if (!complete && !background) message("Не удалось обновить все данные. Попробуй ещё раз.", true);
    return complete;
  } catch (error) {
    if (!current()) return false;
    if (error.name === "AuthSessionMissingError" || error.status === 401) {
      resetAccount();
      showSignedOut();
    } else if (!background) {
      message(explain(error), true);
      retry.hidden = !dashboard.hidden || !recovery.hidden;
    }
    return false;
  }
}

function refresh({background = false, restart = false} = {}) {
  if (!authIdentity) return Promise.resolve(false);
  if (refreshTask && !restart) return refreshTask;
  const version = ++refreshVersion;
  lastRefreshAt = Date.now();
  retry.hidden = true;
  if (dashboard.hidden && recovery.hidden) loading.hidden = false;
  dashboard.setAttribute("aria-busy", "true");
  refreshTask = loadAccount(authIdentity, version, background).finally(() => {
    if (version !== refreshVersion) return;
    refreshTask = null;
    loading.hidden = true;
    dashboard.removeAttribute("aria-busy");
    lastRefreshAt = Date.now();
  });
  return refreshTask;
}

function refreshAfterReturn() {
  if (document.hidden || dashboard.hidden || mode === "recovery" || refreshTask || activeActions) return;
  if (Date.now() - lastRefreshAt >= 90_000) refresh({background: true});
}

window.addEventListener("focus", refreshAfterReturn);
window.addEventListener("pageshow", event => { if (event.persisted) refreshAfterReturn(); });
document.addEventListener("visibilitychange", refreshAfterReturn);

document.getElementById("login-tab").onclick = () => setMode("login");
document.getElementById("register-tab").onclick = () => setMode("register");
document.getElementById("feedback-refresh").onclick = () => action(
  document.getElementById("feedback-section"), () => loadFeedback()
);
function hideRefreshOverlay() {
  const restoreFocus = document.activeElement === refreshOverlay;
  overlayToken = undefined;
  refreshOverlay.hidden = true;
  dashboard.inert = false;
  if (restoreFocus && !dashboard.hidden) refreshButton.focus({preventScroll: true});
}
refreshOverlay.addEventListener("keydown", event => {
  if (event.key === "Escape") hideRefreshOverlay();
});
refreshButton.onclick = async () => {
  if (!refreshOverlay.hidden || dashboard.hidden || activeActions) return;
  message("");
  dashboard.inert = true;
  refreshOverlay.hidden = false;
  refreshOverlay.focus({preventScroll: true});
  const token = overlayToken = {};
  const completed = await refresh();
  if (overlayToken !== token) return;
  hideRefreshOverlay();
  if (completed) message("Кабинет обновлён.");
  else if (notice.hidden) message("Не удалось обновить кабинет. Попробуй ещё раз.", true);
};
retry.querySelector("button").onclick = () => {
  message("");
  refresh();
};

authForm.addEventListener("submit", event => {
  event.preventDefault();
  action(authForm, async () => {
    const email = authForm.elements.email.value.trim();
    const password = authForm.elements.password.value;
    if (mode === "register") {
      const code = authForm.elements.group_code.value.trim();
      if (code) sessionStorage.setItem("textbook-pending-group", code);
      const result = checked(await client.auth.signUp({
        email, password,
        options: {
          data: {full_name: authForm.elements.full_name.value.trim()},
          emailRedirectTo: new URL("./", location.href).href
        }
      }));
      authForm.elements.password.value = "";
      if (!result.session) {
        message("Проверь почту и подтверди регистрацию по письму. После подтверждения открой кабинет.");
        return;
      }
    } else {
      checked(await client.auth.signInWithPassword({email, password}));
      authForm.elements.password.value = "";
    }
    // SIGNED_IN schedules the initial load once, outside the Auth lock.
  });
});

document.getElementById("profile-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  action(form, async current => {
    const input = form.elements.full_name;
    const name = input.value.trim();
    checked(await client.rpc("textbook_save_profile", {p_full_name: name}));
    if (!current()) return;
    if (input.value.trim() === name) input.value = name;
    input.defaultValue = name;
    await refresh({restart: true});
    if (current()) message("Профиль сохранён.");
  });
});

document.getElementById("join-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  action(form, async current => {
    checked(await client.rpc("textbook_join_group", {p_code: form.elements.code.value.trim()}));
    if (!current()) return;
    form.reset();
    await refresh({restart: true});
    if (current()) message("Ты присоединился к группе.");
  });
});

document.getElementById("group-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  action(form, async current => {
    checked(await client.rpc("textbook_create_group", {p_name: form.elements.name.value.trim()}));
    if (!current()) return;
    form.reset();
    await refresh({restart: true});
    if (current()) message("Группа создана. Теперь можно передать код студентам.");
  });
});

document.getElementById("logout").onclick = () => action(dashboard, async () => {
  checked(await client.auth.signOut());
  if (!authIdentity) {
    setMode("login");
    message("Ты вышел из кабинета.");
  }
});

document.getElementById("forgot").onclick = () => action(authSection, async () => {
  const emailInput = authForm.elements.email;
  if (!emailInput.reportValidity()) return;
  checked(await client.auth.resetPasswordForEmail(emailInput.value.trim(), {
    redirectTo: new URL("./", location.href).href
  }));
  message("Если аккаунт существует, на указанную почту придёт письмо для восстановления.");
});

document.getElementById("recovery-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  action(form, async current => {
    checked(await client.auth.updateUser({password: form.elements.password.value}));
    if (!current()) return;
    form.reset();
    mode = "login";
    recovery.hidden = true;
    await refresh({restart: true});
    if (current()) message("Новый пароль сохранён.");
  });
});

if (config.url && config.publishableKey && window.supabase) {
  client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: {storageKey: "textbook-account-session"}
  });
  client.auth.onAuthStateChange((event, session) => {
    // Supabase may emit SIGNED_IN when a tab/window regains focus. Token
    // rotation and a repeated identity do not invalidate loaded account data.
    if (event === "TOKEN_REFRESHED") {
      if (session?.user?.id === authIdentity) authSession = session;
      return;
    }
    if (event === "USER_UPDATED") {
      if (session?.user && session.user.id === currentUser?.id) {
        currentUser = session.user;
        document.getElementById("account-email").textContent = currentUser.email || "";
      }
      return;
    }
    if (!["INITIAL_SESSION","SIGNED_IN","SIGNED_OUT","PASSWORD_RECOVERY"].includes(event)) return;
    const identity = session?.user?.id || null;
    authSession = session;
    if (event !== "PASSWORD_RECOVERY" && identity === authIdentity) return;
    authIdentity = identity;
    clearTimeout(authRefreshTimer);
    resetAccount();
    authSection.hidden = Boolean(identity);
    if (event === "PASSWORD_RECOVERY") mode = "recovery";
    else if (mode === "recovery") mode = "login";
    if (identity) {
      loading.hidden = false;
      authRefreshTimer = setTimeout(refresh, 0);
    } else {
      showSignedOut();
    }
  });
  // INITIAL_SESSION is the sole boot-time load (also covers email redirects).
} else {
  loading.hidden = true;
  message("Кабинет подключается. Учебные материалы доступны по ссылке вверху.", true);
}
