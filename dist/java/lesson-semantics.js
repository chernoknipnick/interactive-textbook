(() => {
  const groups = {
    type: new Set('Student String Phone Robot int boolean double byte char short long float'.split(' ')),
    data: new Set('anna boris partner learner energy battery name group first second numbers values createdCount MAX_ENERGY'.split(' ')),
    method: new Set('study rest isTired charge use isLow main print println getEnergy getCreatedCount checkEnergy move learn'.split(' ')),
    language: new Set('class new this super return if else for while do break continue switch case default yield static public private protected final abstract void null true false import package throw throws try catch finally instanceof extends implements interface enum record synchronized volatile transient native assert'.split(' '))
  };
  const titles = {type: 'Тип или класс', data: 'Данные: переменная, поле или параметр', method: 'Метод: действие или вычисление', language: 'Конструкция языка'};
  // Reuse the roles inferred from the lecture's declarations for animated code.
  for (const category of ['type', 'data', 'method']) {
    document.querySelectorAll('.term-' + category).forEach(token => {
      if (/^[A-Za-z_][A-Za-z_0-9]*$/.test(token.textContent)) groups[category].add(token.textContent);
    });
  }
  function highlightJavaTerms(node) {
    if (!node) return;
    const source = node.textContent;
    const fragment = document.createDocumentFragment();
    const pattern = /"(?:\\.|[^"\\])*"|[A-Za-z_][A-Za-z_0-9]*/g;
    let offset = 0;
    for (const match of source.matchAll(pattern)) {
      fragment.append(document.createTextNode(source.slice(offset, match.index)));
      const word = match[0];
      const isCall = /^\s*\(/.test(source.slice(match.index + word.length));
      const category = word.startsWith('"') ? null : groups.type.has(word) ? 'type' : groups.language.has(word) ? 'language' : isCall ? 'method' : groups.data.has(word) ? 'data' : groups.method.has(word) ? 'method' : null;
      if (category) {
        const token = document.createElement('span');
        token.className = 'term-' + category;
        token.title = titles[category];
        token.textContent = word;
        fragment.append(token);
      } else fragment.append(document.createTextNode(word));
      offset = match.index + word.length;
    }
    fragment.append(document.createTextNode(source.slice(offset)));
    node.replaceChildren(fragment);
  }
  window.highlightJavaTerms = highlightJavaTerms;
  document.querySelectorAll('[data-oop-code], [data-array-code], [data-condition-code], .visual-code code').forEach(highlightJavaTerms);
})();
