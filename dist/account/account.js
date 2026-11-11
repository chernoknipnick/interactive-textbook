const config = window.textbookConfig || {};
const notice = document.getElementById("notice");
const authSection = document.getElementById("auth");
const dashboard = document.getElementById("dashboard");
const recovery = document.getElementById("recovery");
const loading = document.getElementById("loading");
const authForm = document.getElementById("auth-form");
let mode = "login";
let currentUser = null;
let teacher = false;
let refreshVersion = 0;
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
  const buttons = Array.from(form.querySelectorAll("button"));
  buttons.forEach(button => button.disabled = true);
  message("");
  try {
    await task();
  } catch (error) {
    message(explain(error), true);
  } finally {
    buttons.forEach(button => button.disabled = false);
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

async function renderGroups(user, isTeacher, groups, version) {
  const container = document.createDocumentFragment();
  for (const group of groups) {
    const card = node("section", null, "card group-card");
    const heading = node("div", null, "group-head");
    heading.append(node("h3", group.name));
    card.append(heading);
    if (isTeacher) {
      const code = checked(await client.rpc("textbook_group_code", {p_group: group.id}));
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
      controls.append(button("Обновить код", async () => {
        if (!window.confirm("Создать новый код приглашения? Участникам, которые уже вступили, повторный вход в группу не потребуется.")) return;
        checked(await client.rpc("textbook_group_code", {p_group: group.id, p_rotate: true}));
        await refresh();
        message("Новый код готов. Используй его для следующих приглашений.");
      }));
      invite.append(controls);
      card.append(invite);

      const rename = document.createElement("form");
      rename.className = "group-name-form";
      const label = node("label", "Название группы");
      const input = document.createElement("input");
      input.name = "name";
      input.value = group.name;
      input.required = true;
      input.minLength = 2;
      input.maxLength = 80;
      label.append(input);
      const save = node("button", "Переименовать");
      save.type = "submit";
      rename.append(label, save);
      rename.addEventListener("submit", event => {
        event.preventDefault();
        action(rename, async () => {
          const updated = checked(await client.from("textbook_groups")
            .update({name: input.value.trim()}).eq("id", group.id).select("id").single());
          if (!updated) throw new Error("GROUP_ACCESS_DENIED");
          await refresh();
          message("Название группы сохранено.");
        });
      });
      card.append(rename);

      const members = checked(await client.from("textbook_memberships")
        .select("user_id,joined_at").eq("group_id", group.id).order("joined_at"));
      heading.append(node("span", members.length + " участников", "badge"));
      if (members.length) {
        const profiles = checked(await client.from("textbook_profiles")
          .select("user_id,full_name").in("user_id", members.map(member => member.user_id)));
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
          controlsCell.append(button("Исключить", async () => {
            if (!window.confirm("Исключить участника из группы «" + group.name + "»?")) return;
            checked(await client.from("textbook_memberships").delete()
              .eq("group_id", group.id).eq("user_id", member.user_id));
            await refresh();
            message("Состав группы обновлён.");
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
      controls.append(button("Выйти из группы", async () => {
        if (!window.confirm("Выйти из группы «" + group.name + "»? Для повторного вступления понадобится код.")) return;
        checked(await client.from("textbook_memberships").delete()
          .eq("group_id", group.id).eq("user_id", user.id));
        await refresh();
        message("Ты вышел из группы.");
      }));
      card.append(node("p", "Ты участник этой группы.", "muted"), controls);
    }
    container.append(card);
  }
  if (!groups.length) {
    container.append(node("p", isTeacher ? "Создай первую группу и пригласи студентов по коду." : "Пока нет групп. Введи код, который дал преподаватель.", "muted"));
  }
  if (version === refreshVersion) document.getElementById("groups").replaceChildren(container);
}

async function refresh() {
  const version = ++refreshVersion;
  try {
    const {user} = checked(await client.auth.getUser());
    if (version !== refreshVersion) return;
    currentUser = user;
    authSection.hidden = Boolean(user);
    dashboard.hidden = true;
    recovery.hidden = mode !== "recovery" || !user;
    if (!user) return;
    if (mode === "recovery") {
      dashboard.hidden = true;
      return;
    }
    let profile = checked(await client.from("textbook_profiles")
      .select("full_name").eq("user_id", user.id).maybeSingle());
    if (!profile && user.user_metadata?.full_name) {
      checked(await client.rpc("textbook_save_profile", {p_full_name: user.user_metadata.full_name}));
      profile = {full_name: user.user_metadata.full_name};
    }
    const roles = checked(await client.from("textbook_teachers").select("user_id").eq("user_id", user.id));
    teacher = roles.length > 0;
    if (version !== refreshVersion) return;
    document.getElementById("intro").textContent = teacher ? "Учебные группы и их участники." : "Твой профиль, группы и учебные материалы.";
    document.getElementById("role").textContent = teacher ? "Преподаватель" : "Обучающийся";
    document.getElementById("account-email").textContent = user.email || "";
    document.getElementById("profile-form").elements.full_name.value = profile?.full_name || "";
    document.getElementById("teacher-section").hidden = !teacher;
    document.getElementById("join-section").hidden = teacher;
    const pending = sessionStorage.getItem("textbook-pending-group");
    if (pending && profile && !teacher) {
      document.getElementById("join-form").elements.code.value = pending;
      sessionStorage.removeItem("textbook-pending-group");
      message("Подтверждение входа получено. Нажми «Присоединиться», чтобы вступить по сохранённому коду.");
    }
    let query = client.from("textbook_groups").select("id,name,created_at").order("created_at");
    if (teacher) query = query.eq("owner_id", user.id);
    const groups = checked(await query);
    await renderGroups(user, teacher, groups, version);
    if (version === refreshVersion) dashboard.hidden = false;
  } catch (error) {
    if (version !== refreshVersion) return;
    if (error.name === "AuthSessionMissingError") {
      currentUser = null;
      authSection.hidden = false;
      dashboard.hidden = true;
      recovery.hidden = true;
      document.getElementById("intro").textContent = "Войди, чтобы открыть профиль и свои учебные группы.";
    } else {
      message(explain(error), true);
    }
  } finally {
    if (version === refreshVersion) loading.hidden = true;
  }
}

document.getElementById("login-tab").onclick = () => setMode("login");
document.getElementById("register-tab").onclick = () => setMode("register");

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
    await refresh();
  });
});

document.getElementById("profile-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  action(form, async () => {
    checked(await client.rpc("textbook_save_profile", {p_full_name: form.elements.full_name.value.trim()}));
    await refresh();
    message("Профиль сохранён.");
  });
});

document.getElementById("join-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  action(form, async () => {
    checked(await client.rpc("textbook_join_group", {p_code: form.elements.code.value.trim()}));
    form.reset();
    await refresh();
    message("Ты присоединился к группе.");
  });
});

document.getElementById("group-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  action(form, async () => {
    checked(await client.rpc("textbook_create_group", {p_name: form.elements.name.value.trim()}));
    form.reset();
    await refresh();
    message("Группа создана. Теперь можно передать код студентам.");
  });
});

document.getElementById("logout").onclick = () => action(dashboard, async () => {
  checked(await client.auth.signOut());
  mode = "login";
  document.getElementById("groups").replaceChildren();
  await refresh();
  message("Ты вышел из кабинета.");
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
  action(form, async () => {
    checked(await client.auth.updateUser({password: form.elements.password.value}));
    form.reset();
    mode = "login";
    await refresh();
    message("Новый пароль сохранён.");
  });
});

if (config.url && config.publishableKey && window.supabase) {
  client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: {storageKey: "textbook-account-session"}
  });
  client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") mode = "recovery";
    setTimeout(refresh, 0);
  });
  refresh();
} else {
  loading.hidden = true;
  message("Кабинет подключается. Учебные материалы доступны по ссылке вверху.", true);
}
