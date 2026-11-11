document.querySelectorAll(".lesson .codehilite pre code, .lesson pre code[class^='language-']").forEach(code => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy";
  button.textContent = "Копировать";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = "Скопировано";
    } catch {
      button.textContent = "Выдели текст для копирования";
    }
  });
  code.parentElement.after(button);
});

if (window.self === window.top) {
  const updates = document.createElement("script");
  updates.src = new URL("../site-updates.js?v=1", document.currentScript.src).href;
  document.head.append(updates);
}
