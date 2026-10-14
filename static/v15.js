// Lucian UX/UI Prompt #044 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#044
(function () {
  var root = document.querySelector('.about-v15 .u044'); if (!root) return;
  var items = Array.prototype.slice.call(root.querySelectorAll('.u044-it'));
  var qs = items.map(function (it) { return it.querySelector('.u044-q'); });
  var uid = 'u044-' + Math.random().toString(36).slice(2, 7);
  items.forEach(function (it, i) {
    var q = qs[i], body = it.querySelector('.u044-body');
    q.id = uid + '-q' + i; body.id = uid + '-a' + i;
    q.setAttribute('aria-controls', body.id); body.setAttribute('aria-labelledby', q.id);
  });
  function set(it, open) {
    it.classList.toggle('open', open);
    it.querySelector('.u044-q').setAttribute('aria-expanded', String(open));
    it.querySelectorAll('.u044-a a').forEach(function(a){a.tabIndex=open?0:-1;});
    it.querySelector('.u044-body').setAttribute('aria-hidden', String(!open));
  }
  items.forEach(function (it, i) {
    set(it, it.classList.contains('open'));
    qs[i].addEventListener('click', function () {
      var willOpen = !it.classList.contains('open');
      items.forEach(function (o) { if (o !== it) set(o, false); });
      set(it, willOpen);
    });
    qs[i].addEventListener('keydown', function (e) {
      var n = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? qs.length - 1 : -2;
      if (n === -2) return;
      e.preventDefault();
      qs[(n + qs.length) % qs.length].focus();
    });

  });
})();

(() => {
 const tabs=[...document.querySelectorAll('[data-about]')],panels=[...document.querySelectorAll('[data-about-panel]')];
 const choose=id=>{tabs.forEach(t=>t.setAttribute('aria-pressed',String(t.dataset.about===id)));panels.forEach(p=>p.hidden=p.dataset.aboutPanel!==id);};
 if(tabs.length){choose('site');tabs.forEach(t=>t.onclick=()=>choose(t.dataset.about));}
 const home=document.querySelector('.home-layout'),query=home?.querySelector('#static-query');if(!query)return;
 const pool=home.querySelector('#home-pool'),cards=pool?[...pool.content.querySelectorAll('.episode-row')]:[];
 const suggestions=document.createElement('datalist');suggestions.id='v15-search-suggestions';[...new Set(cards.map(c=>c.querySelector('strong')?.textContent.trim()).filter(Boolean))].forEach(title=>{const option=document.createElement('option');option.value=title;suggestions.append(option);});query.setAttribute('list',suggestions.id);query.after(suggestions);
 const status=document.createElement('div');status.className='home-filter-status';status.hidden=true;const label=document.createElement('span'),clear=document.createElement('button');clear.type='button';clear.textContent='清除篩選';status.append(label,clear);home.querySelector('#static-search').after(status);
 const update=e=>{const selected=home.querySelector('[data-filter].selected');const active=!!query.value.trim()||!!selected?.dataset.filter;status.hidden=!active;label.textContent=(selected?.dataset.filter?'目前團體：'+selected.textContent.trim()+' · ':'')+'找到 '+e.detail.count+' 篇文章';clear.hidden=!query.value&&!selected?.dataset.filter;};window.addEventListener('archive:filter',update);
 clear.onclick=()=>{query.value='';home.querySelector('[data-filter=""]')?.click();query.dispatchEvent(new Event('input'));};query.dispatchEvent(new Event('input'));
})();
