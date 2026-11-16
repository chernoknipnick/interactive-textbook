(() => {
  const section = document.getElementById('admin-section');
  const find = id => document.getElementById(id);
  let client, sessionUser = null, generation = 0, userRequest = 0;
  let page = 1, query = '', directoryLoaded = false, validSession = () => false;
  const number = new Intl.NumberFormat('ru-RU');
  const date = new Intl.DateTimeFormat('ru-RU', {dateStyle:'medium', timeZone:'Europe/Moscow'});
  const check = result => { if (result.error) throw result.error; return result.data; };
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const count = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
  const current = ticket => ticket === generation && validSession() && sessionUser;

  function reset() {
    generation++; userRequest++; sessionUser = null; validSession = () => false;
    section.hidden = true; section.removeAttribute('aria-busy');
    for (const id of ['admin-metrics','admin-daily','admin-users']) find(id).replaceChildren();
    for (const id of ['admin-status','admin-users-status','admin-page']) find(id).textContent = '';
    find('admin-users-section').open = false;
    find('admin-search').reset(); directoryLoaded = false; page = 1; query = '';
    find('admin-previous').disabled = find('admin-next').disabled = true;
    find('admin-search').querySelector('button').disabled = false;
    find('admin-refresh').disabled = false;
  }

  async function statistics(ticket = generation) {
    if (!current(ticket)) return;
    find('admin-refresh').disabled = true;
    find('admin-status').textContent = 'Загружаем статистику…';
    section.setAttribute('aria-busy','true');
    try {
      const data = check(await client.rpc('textbook_admin_statistics'));
      if (!current(ticket)) return;
      const metrics = document.createDocumentFragment();
      for (const [key, label] of [['accounts','Всего аккаунтов'],['confirmed','Подтвердили почту'],['unconfirmed','Ждут подтверждения'],['new_7_days','Новых за 7 дней'],['groups','Учебных групп'],['group_members','Участников в группах']]) {
        const item = element('div');
        item.append(element('dt',label),element('dd',number.format(count(data[key]))));
        metrics.append(item);
      }
      find('admin-metrics').replaceChildren(metrics);
      const days = Array.isArray(data.daily) ? data.daily.slice(-14) : [];
      const maximum = Math.max(1,...days.map(day => count(day.count)));
      const daily = document.createDocumentFragment();
      for (const day of days) {
        const item = element('li');
        const amount = count(day.count);
        const label = /^\d{4}-\d{2}-\d{2}$/.test(day.date) ? day.date.slice(8)+'.'+day.date.slice(5,7) : '';
        const column = element('span',undefined,'admin-bar');
        column.style.height = (amount / maximum * 64) + 'px';
        column.setAttribute('aria-hidden','true');
        const bar = element('span',undefined,'admin-bar-space'); bar.append(column);
        item.append(element('b',number.format(amount)),bar,element('span',label));
        daily.append(item);
      }
      find('admin-daily').replaceChildren(daily);
      const updated = new Date(data.generated_at);
      const time = Number.isNaN(updated.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(updated);
      find('admin-status').textContent = 'Сегодня зарегистрировались: '+number.format(count(data.new_today))+(time?' · Обновлено в '+time+' МСК':'');
    } catch {
      if (current(ticket)) {
        find('admin-metrics').replaceChildren(); find('admin-daily').replaceChildren();
        find('admin-status').textContent = 'Не удалось загрузить статистику. Нажми «Обновить статистику», чтобы повторить.';
      }
    } finally {
      if (current(ticket)) { find('admin-refresh').disabled = false; section.removeAttribute('aria-busy'); }
    }
  }

  async function users(nextPage = page) {
    if (!current(generation)) return;
    const ticket = generation, request = ++userRequest;
    const fresh = () => current(ticket) && request === userRequest;
    find('admin-previous').disabled = find('admin-next').disabled = true;
    find('admin-search').querySelector('button').disabled = true;
    find('admin-users').replaceChildren(); find('admin-page').textContent = '';
    find('admin-users-status').textContent = 'Загружаем пользователей…';
    try {
      const data = check(await client.rpc('textbook_admin_users',{p_query:query,p_page:nextPage}));
      if (!fresh()) return;
      const total = count(data.total), size = count(data.page_size) || 25;
      const pages = Math.max(1,Math.ceil(total / size));
      if (nextPage > pages) { await users(pages); return; }
      page = nextPage; directoryLoaded = true;
      const rows = document.createDocumentFragment();
      for (const user of data.users || []) {
        const row = element('tr'), person = element('td');
        person.append(element('strong',user.full_name || 'Без имени'),element('span',user.email || 'Почта не указана','admin-email'));
        const created = new Date(user.created_at);
        row.append(person,element('td',Number.isNaN(created.getTime())?'—':date.format(created)),
          element('td',user.confirmed?'Подтверждена':'Не подтверждена'),
          element('td',({administrator:'Администратор',teacher:'Преподаватель',student:'Обучающийся'})[user.role] || 'Обучающийся'));
        rows.append(row);
      }
      find('admin-users').replaceChildren(rows);
      find('admin-users-status').textContent = total ? 'Найдено аккаунтов: '+number.format(total) : 'По этому запросу никого не найдено.';
      find('admin-page').textContent = total ? page+' / '+pages : '';
      find('admin-previous').disabled = page <= 1;
      find('admin-next').disabled = page >= pages;
    } catch {
      if (fresh()) { directoryLoaded = false; find('admin-users-status').textContent = 'Не удалось загрузить список. Повтори поиск или раскрой список заново.'; }
    } finally {
      if (fresh()) find('admin-search').querySelector('button').disabled = false;
    }
  }

  find('admin-refresh').onclick = () => statistics();
  find('admin-users-section').addEventListener('toggle', () => {
    if (find('admin-users-section').open && !directoryLoaded && !section.hidden) users(1);
  });
  find('admin-search').addEventListener('submit', event => {
    event.preventDefault(); query = find('admin-search').elements.query.value.trim(); users(1);
  });
  find('admin-previous').onclick = () => users(page-1);
  find('admin-next').onclick = () => users(page+1);

  window.textbookAdminPanel = {
    reset,
    cancel() { generation++; userRequest++; },
    async load(connection,user,guard) {
      if (sessionUser !== user.id) reset();
      const ticket = ++generation;
      client = connection; sessionUser = user.id; validSession = guard;
      try {
        const roles = check(await client.from('textbook_administrators').select('user_id').eq('user_id',user.id));
        if (!current(ticket)) return false;
        if (!roles.length) { reset(); return false; }
        section.hidden = false;
        await statistics(ticket);
        if (current(ticket) && find('admin-users-section').open) await users(page);
        return Boolean(current(ticket));
      } catch { if (current(ticket)) reset(); return false; }
    }
  };
})();
