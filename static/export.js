(() => {
  const list = document.querySelector('#static-list');
  if (!list) return;
  const cards = [...list.querySelectorAll('.episode-row')];
  const empty = document.querySelector('#static-empty');
  const query = document.querySelector('#static-query');
  let group = new URLSearchParams(location.search).get('group') || '';
  const initialChip = [...document.querySelectorAll('[data-filter]')].find(button => button.dataset.filter === group);
  if (initialChip) {
    document.querySelectorAll('[data-filter]').forEach(button => button.classList.toggle('selected', button === initialChip));
  } else group = '';
  function filter() {
    const term = (query?.value || '').trim().toLocaleLowerCase();
    let visible = 0;
    for (const card of cards) {
      const show = (!group || card.dataset.group === group) && (!term || card.dataset.search.includes(term));
      card.hidden = !show;
      if (show) visible++;
    }
    if (empty) empty.hidden = visible > 0;
  }
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    group = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('selected', b === button));
    filter();
  }));
  query?.addEventListener('input', filter);
  document.querySelector('#static-search')?.addEventListener('submit', event => { event.preventDefault(); filter(); });
  filter();
})();
