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

/* Mobile/tablet navigation; desktop markup and styling remain intact. */
(() => {
 if(!document.body.classList.contains('public-page'))return;
 const header=document.querySelector('.shell>header'),nav=header?.querySelector('nav'),brand=header?.querySelector('.brand');if(!nav||!brand)return;
 const links=[...nav.querySelectorAll('a')],home=links[0]?.href,podcast=links[1]?.href,pop=links[2];if(!home||!podcast)return;
 const paths={home:'<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>',tv:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="m8 2 4 4 4-4M8 23h8"/>',wave:'<path d="M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h1m6 0h1m-8 3h1"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',mic:'<rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',report:'<path d="M21 11a9 9 0 0 1-9 9H7l-5 3 2-6a9 9 0 1 1 17-6Z"/><path d="M7 11h.01M12 11h.01M17 11h.01"/>',close:'<path d="m5 5 14 14M19 5 5 19"/>'};
 const icon=n=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[n]+'</svg>';
 const bottom=document.createElement('nav');bottom.className='mobile-bottom';bottom.setAttribute('aria-label','主要導覽');
 const videoURL=new URL(home);videoURL.hash='all-articles';
 function entry(label,symbol,url){const a=document.createElement('a');a.href=url;a.innerHTML=icon(symbol)+'<span>'+label+'</span>';bottom.append(a);return a;}
 const video=entry('影音','tv',videoURL.href),pod=entry('Podcast','wave',podcast),front=entry('首頁','home',home),calendar=entry('行事曆','calendar','https://shysssiee.github.io/virtualIdol_schedule/');calendar.target='_blank';calendar.rel='noopener noreferrer';calendar.setAttribute('aria-label','直播行事曆（另開分頁）');
 const more=document.createElement('button');more.type='button';more.innerHTML=icon('menu')+'<span>更多</span>';more.setAttribute('aria-haspopup','dialog');more.setAttribute('aria-expanded','false');bottom.append(more);
 const current=()=>{[video,pod,front].forEach(a=>a.removeAttribute('aria-current'));const podcastPage=location.pathname.includes('/podcast')||!!document.querySelector('.podcast-theme');const homepage=!!document.querySelector('.video-list-layout');const active=podcastPage?pod:homepage?(location.hash==='#all-articles'?video:front):document.querySelector('.video-theme')?video:null;active?.setAttribute('aria-current','page');};current();window.addEventListener('hashchange',current);
 const list=document.querySelector('.video-list-layout #static-list');if(list){const heading=list.previousElementSibling;heading.id='all-articles';if(location.hash==='#all-articles')requestAnimationFrame(()=>heading.scrollIntoView());}
 const dialog=document.createElement('dialog');dialog.className='mobile-drawer';dialog.id='mobile-menu';dialog.setAttribute('aria-labelledby','mobile-menu-title');more.setAttribute('aria-controls',dialog.id);
 const top=document.createElement('div');top.className='mobile-drawer-top';const logo=brand.cloneNode(true);logo.id='mobile-menu-title';const close=document.createElement('button');close.type='button';close.className='mobile-close';close.setAttribute('aria-label','關閉選單');close.innerHTML=icon('close');top.append(logo,close);
 const menu=document.createElement('div');menu.className='mobile-menu-links';const search=document.createElement('button');search.type='button';search.innerHTML=icon('search')+'<span>搜尋</span>';menu.append(search);
 function drawerLink(source,symbol){if(!source)return;const a=source.cloneNode(true);a.innerHTML=icon(symbol)+'<span></span>';a.querySelector('span').textContent=source.textContent;menu.append(a);}
 drawerLink(pop,'mic');links.slice(3).forEach(a=>drawerLink(a,a.href.includes('/about')?'info':a===links[links.length-1]?'report':'info'));
 const settings=document.createElement('div');settings.className='mobile-menu-settings';const lang=document.createElement('label');lang.textContent='介面語言';const theme=document.createElement('div');theme.className='mobile-theme-row';const themeLabel=document.createElement('span');themeLabel.textContent='淺色／深色';theme.append(themeLabel);settings.append(lang,theme);dialog.append(top,menu,settings);document.body.append(bottom,dialog);
 const controls=[nav.querySelector('.language-select'),nav.querySelector('.theme-switch')].filter(Boolean),anchors=controls.map(c=>{const marker=document.createComment('mobile setting origin');c.before(marker);return marker;});
 function dismiss(){dialog.close();}
 function show(){controls.forEach(c=>(c.matches('select')?lang:theme).append(c));dialog.showModal();document.body.classList.add('mobile-menu-open');more.setAttribute('aria-expanded','true');close.focus();}
 more.addEventListener('click',show);close.addEventListener('click',dismiss);dialog.addEventListener('click',e=>{if(e.target===dialog&&e.clientX>=dialog.getBoundingClientRect().right)dismiss();});dialog.addEventListener('close',()=>{controls.forEach((c,i)=>anchors[i].after(c));document.body.classList.remove('mobile-menu-open');more.setAttribute('aria-expanded','false');if(document.activeElement===document.body||dialog.contains(document.activeElement))more.focus();});
 search.addEventListener('click',()=>{const input=document.querySelector('#static-query');if(input){dismiss();input.scrollIntoView({block:'center',behavior:'smooth'});input.focus({preventScroll:true});}else{const url=new URL(home);url.hash='search';location.href=url.href;}});
 if(location.hash==='#search')requestAnimationFrame(()=>{const input=document.querySelector('#static-query');input?.scrollIntoView({block:'center'});input?.focus({preventScroll:true});});
 const mq=matchMedia('(max-width:1024px), (max-width:1366px) and (pointer:coarse)');mq.addEventListener('change',()=>{if(!mq.matches&&dialog.open)dismiss();});
 const keyboard=()=>document.body.classList.toggle('mobile-keyboard',!!window.visualViewport&&innerHeight-window.visualViewport.height>150&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName));window.visualViewport?.addEventListener('resize',keyboard);document.addEventListener('focusout',()=>setTimeout(keyboard,100));
 document.querySelectorAll('.group-columns .chips').forEach(chips=>{const edges=()=>{chips.classList.toggle('has-before',chips.scrollLeft>4);chips.classList.toggle('has-after',chips.scrollLeft+chips.clientWidth<chips.scrollWidth-4);};chips.addEventListener('scroll',edges,{passive:true});chips.addEventListener('click',e=>{const chip=e.target.closest('.chip');if(chip&&mq.matches)chip.scrollIntoView({block:'nearest',inline:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});});new ResizeObserver(edges).observe(chips);edges();});
})();
