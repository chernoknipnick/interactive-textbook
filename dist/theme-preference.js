(() => {
  const key = "textbook-theme";
  const root = document.documentElement;
  const system = matchMedia("(prefers-color-scheme: dark)");
  const labels = {system: "Как в системе", light: "Светлая", dark: "Тёмная"};
  const icons = {
    system: "M4 5h16v11H4zM12 16v4m-4 0h8",
    light: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5",
    dark: "M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z"
  };
  const embedded = window.parent !== window;
  const controls = new Set();
  let preference;

  function readPreference() {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function update(control) {
    const summary = control.querySelector("summary");
    summary.setAttribute("aria-label", "Тема оформления: " + labels[preference]);
    summary.querySelector("span").textContent = preference === "system" ? "Авто" : labels[preference];
    summary.querySelector("path").setAttribute("d", icons[preference]);
    for (const button of control.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.value === preference));
    }
  }

  function apply(value, persist = false) {
    preference = Object.hasOwn(labels, value) ? value : "system";
    const theme = preference === "system" ? (system.matches ? "dark" : "light") : preference;
    root.dataset.theme = theme;
    root.dataset.themePreference = preference;
    if (persist) {
      try { localStorage.setItem(key, preference); } catch {}
    }
    for (const control of controls) update(control);
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.append(meta);
    }
    meta.content = theme === "dark" ? "#151819" : "#f4f6fa";
    for (const frame of document.querySelectorAll("iframe")) {
      frame.contentWindow?.postMessage({type: "textbook-theme", theme, preference}, location.origin);
    }
  }

  let initial = readPreference();
  try {
    if (embedded) {
      const parentTheme = window.parent.document.documentElement.dataset;
      initial = parentTheme.themePreference ?? parentTheme.theme ?? initial;
    }
  } catch {}
  apply(initial);

  window.textbookTheme = {
    apply,
    bind(control) {
      control.className = "tb-theme-picker";
      control.innerHTML = `
        <summary class="tb-theme-toggle">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="tb-theme-label"></span>
        </summary>
        <div class="tb-theme-options" role="group" aria-label="Тема оформления"></div>`;
      const summary = control.querySelector("summary");
      const options = control.querySelector(".tb-theme-options");
      for (const [value, text] of Object.entries(labels)) {
        const button = document.createElement("button");
        button.type = "button";
        button.value = value;
        button.textContent = text;
        button.onclick = () => {
          apply(value, true);
          control.open = false;
          summary.focus();
        };
        options.append(button);
      }
      control.addEventListener("keydown", event => {
        if (event.key !== "Escape" || !control.open) return;
        event.stopPropagation();
        control.open = false;
        summary.focus();
      });
      document.addEventListener("click", event => {
        if (!control.contains(event.target)) control.open = false;
      });
      control.addEventListener("focusout", event => {
        if (event.relatedTarget && !control.contains(event.relatedTarget)) control.open = false;
      });
      controls.add(control);
      update(control);
    }
  };
  system.addEventListener("change", () => {
    if (preference === "system") apply(preference);
  });
  window.addEventListener("storage", event => {
    if (event.key === key || event.key === null) apply(readPreference());
  });
  window.addEventListener("message", event => {
    if (embedded && event.origin === location.origin && event.source === window.parent && event.data?.type === "textbook-theme") {
      apply(event.data.preference ?? event.data.theme);
    }
  });
})();
