/* Lucian UX/UI Prompt #016 and #022 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/ */
function lucianRating(root,request){

  var wrap = root.querySelector('.u016-stars');
  var score = root.querySelector('.u016-score');
  var word = root.querySelector('.u016-word');
  var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gid = 'u016-g-' + Math.random().toString(36).slice(2, 7);
  root.querySelector('linearGradient').id = gid;
  var WORDS = ['選擇 1～5 星', '需要改進', '尚可', '不錯', '很有幫助', '非常有幫助'];
  var COLORS = ['var(--ux-ink-3)', '#E5484D', '#F07A3E', '#E8A317', '#2FB37A', '#7B61FF'];
  var STAR = 'M26 4.5l6.4 13.2 14.4 2-10.5 10.1 2.6 14.3L26 37.3l-12.9 6.8 2.6-14.3L5.2 19.7l14.4-2z';
  var stars = [];
  for (var i = 0; i < 5; i++) {
    var b = document.createElement('span');
    b.className = 'u016-s';
    var sparks = '';
    for (var k = 0; k < 5; k++) sparks += '<i style="--a:' + (k * 72) + 'deg"></i>';
    b.innerHTML = '<svg viewBox="0 0 52 52"><path class="bg" d="' + STAR + '" stroke-linejoin="round"/><path class="fg" d="' + STAR + '" style="fill:url(#' + gid + ')"/></svg>' + sparks;
    b.dataset.v = i + 1;
    wrap.appendChild(b);
    stars.push(b);
  }
  var val = 0;
  function preview(n) { stars.forEach(function (s, i) { s.classList.toggle('is-pre', i < n && i >= val); }); }
  function setWord(n) {
    var old = word.lastElementChild;
    var s = document.createElement('span');
    s.textContent = WORDS[n];
    s.style.color = COLORS[n];
    s.style.transform = 'translateY(100%)'; s.style.opacity = '0';
    word.appendChild(s);
    void s.offsetWidth;
    s.style.transform = 'none'; s.style.opacity = '1';
    old.style.transform = 'translateY(-100%)'; old.style.opacity = '0';
    setTimeout(function () { old.remove(); }, 500);
  }
  function set(n) {
    if (n === val) return;
    var prev = val;
    val = n;
    stars.forEach(function (s, i) {
      var on = i < n;
      s.classList.remove('is-pre');
      if (on && i >= prev) {
        setTimeout(function () {
          if (!root.isConnected || i >= val) return;
          s.classList.add('is-on');
          if (!rm) { s.classList.remove('is-pop'); void s.offsetWidth; s.classList.add('is-pop'); }
        }, rm ? 0 : (i - prev) * 70);
      } else if (!on) s.classList.remove('is-on', 'is-pop');
    });
    score.textContent = n.toFixed(1);
    score.style.color = n ? COLORS[n] : '';
    setWord(n);
    wrap.setAttribute('aria-valuenow', String(n));
    wrap.setAttribute('aria-valuetext', n ? n + ' 星，' + WORDS[n] : '尚未評分');
  }
  stars.forEach(function (s) {
    s.addEventListener('pointerenter', function () { preview(+s.dataset.v); });
    s.addEventListener('click', function () { request(+s.dataset.v); });
  });
  wrap.addEventListener('pointerleave', function () { preview(0); });
  wrap.addEventListener('keydown', function (e) {
    var d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (e.key === 'Home') { e.preventDefault(); request(1); }
    if (e.key === 'End') { e.preventDefault(); request(5); }
    if (d) { e.preventDefault(); request(Math.max(0, Math.min(5, val + d))); }
    if (/^[1-5]$/.test(e.key)) request(+e.key);
  });

 return {set,wrap};
}
function lucianHeart(root,request){

  var btn = root.querySelector('.u022-btn');
  var roll = root.querySelector('.u022-roll');
  var outline = root.querySelector('.u022-o');
  var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gid = 'u022-g-' + Math.random().toString(36).slice(2, 7);
  root.querySelector('linearGradient').id = gid;
  root.querySelector('.u022-f').style.fill = 'url(#' + gid + ')';
  var n = 0, on = false, ci = 0, t = 0;
  function rollTo(v, up) {
    var cur = roll.children[ci], nxt = roll.children[1 - ci];
    nxt.style.transition = 'none';
    nxt.textContent = v;
    nxt.style.transform = 'translateY(' + (up ? 100 : -100) + '%)'; nxt.style.opacity = '0';
    void nxt.offsetWidth;
    nxt.style.transition = '';
    nxt.style.transform = 'none'; nxt.style.opacity = '1';
    cur.style.transform = 'translateY(' + (up ? -100 : 100) + '%)'; cur.style.opacity = '0';
    ci = 1 - ci;
  }

 function paint(next,count,animate=false){
 on=next;n=count;root.classList.toggle('is-on',on);btn.setAttribute('aria-pressed',String(on));outline.style.stroke=on?'transparent':'';rollTo(n,on);root.classList.remove('is-pop');clearTimeout(t);
 if(on&&animate&&!rm){void root.offsetWidth;root.classList.add('is-pop');t=setTimeout(()=>root.classList.remove('is-pop'),900);}
 }
 btn.addEventListener('click',()=>request(!on));
 return {paint,btn};
}

(() => {
 'use strict';
 const cfg=window.ARCHIVE_ENGAGEMENT;if(!cfg?.enabled)return;
 const local=['localhost','127.0.0.1',''].includes(location.hostname),article=document.querySelector('.episode-article'),slug=article?.dataset.slug;
 const chart='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 20v-7m5 7V7m5 13V3m5 17V10"/></svg>';
 const headers={apikey:cfg.key,'Content-Type':'application/json'},fmt=n=>Number(n||0).toLocaleString('zh-TW');
 let visitor='';try{visitor=localStorage.getItem('archive-engagement-visitor')||'';if(!/^[a-f0-9]{32}$/.test(visitor)){visitor=[...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');localStorage.setItem('archive-engagement-visitor',visitor);}}catch{/* Disabled storage still permits a temporary session, not durable identity. */}
 if(!visitor)visitor=[...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');
 async function post(url,body){const res=await fetch(url,{method:'POST',headers:url.includes('/functions/')?{...headers,Authorization:'Bearer '+cfg.functionBearer}:headers,body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});if(!res.ok)throw new Error(res.status===429?'操作太頻繁，請稍後再試':'目前無法連線，請稍後再試');return res.json();}
 // Keep a ten-minute view snapshot across page visits; interactions stay live.
 const viewSnapshots=new Map(),viewTTL=10*60*1000,viewPrefix='archive-view-snapshot-v1:';
 function snapshotViews(row){
  if(document.querySelector('.article-admin-table'))return row;
  let saved=viewSnapshots.get(row.slug);
  if(!saved){try{saved=JSON.parse(localStorage.getItem(viewPrefix+row.slug)||'null');}catch{}}
  const now=Date.now();
  if(!saved||!Number.isFinite(saved.at)||saved.at>now||now-saved.at>=viewTTL||!Number.isFinite(saved.views)||saved.views<0){
   saved={at:now,views:Number(row.views)||0};
   try{localStorage.setItem(viewPrefix+row.slug,JSON.stringify(saved));}catch{}
  }
  viewSnapshots.set(row.slug,saved);
  return {...row,views:saved.views};
 }
 const summary=async slugs=>(await post(cfg.url+'/rest/v1/rpc/archive_engagement_summary',{p_slugs:slugs})).map(snapshotViews);
 const action=(page,op,value)=>post(cfg.url+'/functions/v1/'+cfg.functionName,{slug:page,visitor,action:op,value});
 let heart,rating,last={liked:false,rating:null,likes:0},busy=false,localTouched=false,ready=local,loadedState=false;
 const panel=article?.querySelector('.engagement-panel'),status=panel?.querySelector('.engagement-status');
 if(article&&article.dataset.engagementPublic==='0'){if(panel)panel.hidden=true;return;}
 function showError(message){if(status)status.textContent=message;}
 function paint(data,animate=false){last={...last,...data};if(!panel)return;heart.paint(!!last.liked,fmt(data.likes),animate);if(!localTouched)rating.set(Number(last.rating||0));panel.querySelector('.engagement-average').textContent=Number(data.rating_count)?'平均 '+Number(data.rating_average).toFixed(1)+'／5 · '+fmt(data.rating_count)+' 人評分':'尚無評分，歡迎分享你的感受';}
 async function commit(op,value){
  if(busy)return;if(!ready){showError('正在載入，請稍候。');return;}if(local){localTouched=true;if(op==='like'){heart.paint(value===1,fmt(last.likes),true);last.liked=value===1;}else{last.rating=value;rating.set(value);}showError('本機預覽：這次操作不會送出，也不會計入正式統計。');return;}
  busy=true;heart.btn.disabled=true;rating.wrap.setAttribute('aria-disabled','true');showError('正在儲存…');
  try{const saved=await action(slug,op,value);loadedState=true;paint(saved,op==='like'&&value===1);showError(op==='like'?(value?'已按讚':'已取消按讚'):'你的評分：'+value+'／5');}
  catch(e){showError(e.message+'，這次操作尚未儲存。');}
  finally{busy=false;heart.btn.disabled=false;rating.wrap.setAttribute('aria-disabled','false');}
 }
 if(panel){
  const likeRoot=panel.querySelector('.u022'),rateRoot=panel.querySelector('.u016');
  heart=lucianHeart(likeRoot,on=>commit('like',on?1:0));rating=lucianRating(rateRoot,n=>commit('rate',n));
  // No sample numbers: show unavailable until the live service answers.
  panel.querySelector('.engagement-preview').textContent=local?'本機預覽・不計數':'';
  summary([slug]).then(rows=>{if(rows[0]){article.querySelector('[data-view-count]').textContent=fmt(rows[0].views);if(!loadedState)paint(rows[0]);}else throw new Error('此文章的統計尚未啟用');}).catch(e=>{panel.querySelector('.engagement-average').textContent='統計暫時無法載入';showError('目前無法讀取統計，請稍後再試。');});
  if(!local)action(slug,'state').then(data=>{loadedState=true;paint(data);}).catch(()=>showError('目前無法讀取你的互動紀錄，仍可稍後重試。')).finally(()=>{ready=true;});
 }
 // Require eight visible seconds. Local author previews never submit views.
 if(!local&&document.body.classList.contains('public-page')){
  let visibleMs=0;const timer=setInterval(()=>{if(document.visibilityState!=='visible')return;visibleMs+=1000;if(visibleMs<8000)return;clearInterval(timer);action('site-total','view').catch(()=>{});if(slug&&panel)action(slug,'view').catch(()=>{});},1000);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 }
 if(document.querySelector('#admin-site-views'))post(cfg.url+'/rest/v1/rpc/archive_site_views',{}).then(total=>{document.querySelector('#admin-site-views').textContent=fmt(total);}).catch(()=>document.querySelector('#admin-site-views').textContent='暫時無法載入');
 const cache=new Map();let pendingTimer;
 let featuredStatsSent=false;
 async function refreshCards(){
  const cards=[...document.querySelectorAll('a.episode-row[data-slug],.admin-table-row[data-stat-slug]:not([data-stat-slug=""])')];const pool=document.querySelector('#featured-pool');if(pool)cards.push(...pool.content.querySelectorAll('a.episode-row[data-slug]'));const missing=[...new Set(cards.map(c=>c.dataset.slug||c.dataset.statSlug).filter(s=>!cache.has(s)))];
  if(missing.length){try{for(let i=0;i<missing.length;i+=200){const rows=await summary(missing.slice(i,i+200));rows.forEach(r=>cache.set(r.slug,r));}}catch{return;}}
  if(pool&&!featuredStatsSent){featuredStatsSent=true;window.dispatchEvent(new CustomEvent('archive:featured-stats',{detail:[...cache.values()]}));}
  cards.forEach(card=>{if(card.classList.contains('featured-cover-card'))return;const data=cache.get(card.dataset.slug||card.dataset.statSlug);if(!data)return;if(card.matches('.admin-table-row')){const cell=card.querySelector('.admin-stat-cell');if(cell){cell.textContent=fmt(data.views)+'／'+fmt(data.likes);cell.setAttribute('aria-label','流量 '+fmt(data.views)+'，讚 '+fmt(data.likes));cell.title='流量 '+fmt(data.views)+'／讚 '+fmt(data.likes);}return;}let slot=card.querySelector('.card-engagement');if(!slot){slot=document.createElement('small');slot.className='card-engagement';const info=card.matches('.admin-table-row')?card.querySelector('strong'):card.querySelector(':scope>span:nth-child(2)');if(!info)return;info.append(slot);}const text=fmt(data.views)+' 次瀏覽 · '+fmt(data.likes)+' 人喜歡';if(slot.getAttribute('aria-label')===text)return;slot.setAttribute('aria-label',text);slot.innerHTML='<span class="metric-views">'+chart+'<span class="metric-number">'+fmt(data.views)+'</span><span class="metric-unit">次瀏覽</span></span><span class="metric-likes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg><span class="metric-number">'+fmt(data.likes)+'</span></span>';if(card.matches('.admin-table-row'))slot.append(document.createTextNode(' · ★ '+(data.rating_count?Number(data.rating_average).toFixed(1)+'／5（'+fmt(data.rating_count)+' 人）':'尚無評分')));});
 }
 if(document.querySelector('#static-list,.article-admin-table,.home-featured')){refreshCards();const observer=new MutationObserver(records=>{if(!records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.episode-row')||n.querySelector?.('.episode-row')))))return;clearTimeout(pendingTimer);pendingTimer=setTimeout(refreshCards,80);});observer.observe(document.querySelector('main'),{childList:true,subtree:true});}
})();
