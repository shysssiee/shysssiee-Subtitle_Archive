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
  let member = '';
  let page = 1;
  const pageSize = 12;
  if (query) query.value = params.get('q') || '';
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const memberButtons = [...document.querySelectorAll('[data-member]')];
  const podcastMember = document.querySelector('#podcast-member-filter');
  const memberOptions = podcastMember ? [...podcastMember.querySelectorAll('option[data-group]')].map(option => ({value:option.value,label:option.textContent,group:option.dataset.group})) : [];
  if (!buttons.some(button => button.dataset.filter === group)) group = '';
  function renderPodcastMembers() {
    if (!podcastMember) return;
    podcastMember.replaceChildren(new Option(group ? '全部成員' : '請先選擇團體',''));
    memberOptions.filter(option => group && option.group === group).forEach(option => podcastMember.add(new Option(option.label,option.value)));
    podcastMember.disabled=!group;
    if (![...podcastMember.options].some(option => option.value === member)) member='';
    podcastMember.value=member;
  }
  renderPodcastMembers();
  function shuffle() {
    if (!recommended) return;
    const pool = cards.filter(card => (!group || (card.dataset.groups || card.dataset.group || '').split(',').includes(group)) && (!member || (card.dataset.member || '').split(',').map(x=>x.trim()).includes(member)));
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
    memberButtons.forEach(button => button.classList.toggle('selected', button.dataset.member === member));
    const term = (query?.value || '').trim().toLocaleLowerCase();
    const filtered = cards.filter(card => (!group || (card.dataset.groups || card.dataset.group || '').split(',').includes(group)) && (!member || (card.dataset.member || '').split(',').map(x=>x.trim()).includes(member)) && (!term || card.dataset.search.includes(term)));
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
      if (page > total) page = total;
      const previous = document.createElement('button'); previous.className='page-button'; previous.textContent = '← 上一頁'; previous.disabled = page === 1;
      const next = document.createElement('button'); next.className='page-button'; next.textContent = '下一頁 →'; next.disabled = page === total;
      previous.onclick = () => { page--; filter(); list.scrollIntoView({block:'start'}); };
      next.onclick = () => { page++; filter(); list.scrollIntoView({block:'start'}); };
      pager.append(previous);
      const start=Math.max(1,page-2), end=Math.min(total,page+2);
      for (let n=start;n<=end;n++) {
        const button=document.createElement('button'); button.className='page-number'+(n===page?' active':''); button.textContent=String(n);
        button.setAttribute('aria-current',n===page?'page':'false'); button.onclick=()=>{page=n;filter();list.scrollIntoView({block:'start'});}; pager.append(button);
      }
      pager.append(next);
      const jump=document.createElement('form'); jump.className='page-jump';
      const label=document.createElement('label'); label.append('前往第 ');
      const input=document.createElement('input'); input.type='number'; input.min='1'; input.max=String(total); input.value=String(page); input.inputMode='numeric'; input.setAttribute('aria-label','輸入頁碼');
      label.append(input,' 頁'); const go=document.createElement('button'); go.textContent='前往'; jump.append(label,go);
      jump.onsubmit=event=>{event.preventDefault();const target=Math.max(1,Math.min(total,Number(input.value)||page));page=target;filter();list.scrollIntoView({block:'start'});}; pager.append(jump);
    }
  }
  buttons.forEach(button => button.addEventListener('click', () => { group = button.dataset.filter; member=''; page = 1; renderPodcastMembers(); filter(); shuffle(); }));
  memberButtons.forEach(button => button.addEventListener('click', () => {
    member = button.dataset.member;
    group = member ? (button.dataset.memberGroup || '') : '';
    page = 1; filter(); shuffle();
  }));
  podcastMember?.addEventListener('change', () => { member=podcastMember.value; page=1; filter(); shuffle(); });
  query?.addEventListener('input', () => { page = 1; filter(); });
  sort?.addEventListener('change', () => { page = 1; filter(); });
  document.querySelector('#static-search')?.addEventListener('submit', event => { event.preventDefault(); page = 1; filter(); });
  document.querySelector('#shuffle-recommend')?.addEventListener('click', shuffle);
  filter(); shuffle();
})();
