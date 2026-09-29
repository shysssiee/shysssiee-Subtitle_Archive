(() => {
  const list = document.querySelector('#static-list');
  if (!list) return;
  const cards = [...list.querySelectorAll('.episode-row')];
  const empty = document.querySelector('#static-empty');
  const query = document.querySelector('#static-query');
  const sort = document.querySelector('#date-sort');
  const pager = document.querySelector('#home-pages');
  const recommendations = document.querySelector('.recommendations');
  const recommended = document.querySelector('#recommend-list');
  const params = new URLSearchParams(location.search);
  let group = params.get('group') || '';
  let page = 1;
  const pageSize = 20;
  if (query) query.value = params.get('q') || '';
  const buttons = [...document.querySelectorAll('[data-filter]')];
  if (!buttons.some(button => button.dataset.filter === group)) group = '';
  function shuffle() {
    if (!recommended) return;
    const pool = cards.filter(card => !group || card.dataset.group === group);
    const choices = (pool.length > 2 ? pool.slice(1) : pool).slice();
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    recommended.replaceChildren(...choices.slice(0, 2).map(card => {
      const clone = card.cloneNode(true); clone.hidden = false; return clone;
    }));
    recommendations.hidden = choices.length === 0;
  }
  function filter() {
    buttons.forEach(button => button.classList.toggle('selected', button.dataset.filter === group));
    const term = (query?.value || '').trim().toLocaleLowerCase();
    const filtered = cards.filter(card => (!group || card.dataset.group === group) && (!term || card.dataset.search.includes(term)));
    filtered.sort((a,b) => {
      if (!a.dataset.date || !b.dataset.date) return a.dataset.date ? -1 : b.dataset.date ? 1 : 0;
      return a.dataset.date.localeCompare(b.dataset.date) * (sort?.value === 'asc' ? 1 : -1);
    });
    cards.forEach(card => { card.hidden = true; });
    filtered.forEach((card, index) => { list.append(card); card.hidden = index < (page-1)*pageSize || index >= page*pageSize; });
    empty.hidden = filtered.length > 0;
    const total = Math.max(1, Math.ceil(filtered.length/pageSize));
    pager.replaceChildren();
    if (total > 1) {
      const previous = document.createElement('button'); previous.textContent = '上一頁'; previous.disabled = page === 1;
      const next = document.createElement('button'); next.textContent = '下一頁'; next.disabled = page === total;
      const label = document.createElement('span'); label.textContent = page + ' / ' + total;
      previous.onclick = () => { page--; filter(); list.scrollIntoView({block:'start'}); };
      next.onclick = () => { page++; filter(); list.scrollIntoView({block:'start'}); };
      pager.append(previous,label,next);
    }
  }
  buttons.forEach(button => button.addEventListener('click', () => { group = button.dataset.filter; page = 1; filter(); shuffle(); }));
  query?.addEventListener('input', () => { page = 1; filter(); });
  sort?.addEventListener('change', () => { page = 1; filter(); });
  document.querySelector('#static-search')?.addEventListener('submit', event => { event.preventDefault(); page = 1; filter(); });
  document.querySelector('#shuffle-recommend')?.addEventListener('click', shuffle);
  filter(); shuffle();
})();
