(() => {
  const groups = {
    type: new Set('Student String Phone Robot int boolean double byte char short long float'.split(' ')),
    data: new Set('anna boris partner learner energy battery name group first second numbers values createdCount MAX_ENERGY'.split(' ')),
    method: new Set('study rest isTired charge use isLow main print println getEnergy getCreatedCount checkEnergy move learn'.split(' ')),
    language: new Set('class new this return if else for while static final public private void null true false'.split(' '))
  };
  const titles = {type: 'Тип или класс', data: 'Данные: переменная, поле или параметр', method: 'Метод: действие или вычисление', language: 'Конструкция языка'};
  function highlightJavaTerms(node) {
    if (!node) return;
    const source = node.textContent;
    const fragment = document.createDocumentFragment();
    const pattern = /"(?:\\.|[^"\\])*"|[A-Za-z_][A-Za-z_0-9]*/g;
    let offset = 0;
    for (const match of source.matchAll(pattern)) {
      fragment.append(document.createTextNode(source.slice(offset, match.index)));
      const word = match[0];
      const category = word.startsWith('"') ? null : Object.keys(groups).find(key => groups[key].has(word));
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
  document.querySelectorAll('[data-oop-code], [data-array-code]').forEach(highlightJavaTerms);
})();
