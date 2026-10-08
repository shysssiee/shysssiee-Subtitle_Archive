(() => {
  const themeKey = 'voice-archive-theme';
  const switcher = document.querySelector('.theme-switch');
  function applyTheme(value) {
    document.documentElement.dataset.theme = value;
    switcher?.setAttribute('aria-checked', String(value === 'dark'));
  }
  try { applyTheme(localStorage.getItem(themeKey) || 'light'); } catch { applyTheme('light'); }
  switcher?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(themeKey, next); } catch { /* Private browsing. */ }
  });
  const disclosure = document.querySelector('.transcript-disclosure');
  disclosure?.addEventListener('toggle', () => {
    const label = disclosure.querySelector('summary');
    if (label) label.firstChild.textContent = disclosure.open ? '收起雙語逐字稿 ' : '展開雙語逐字稿 ';
  });
  const memberEditor = document.querySelector('.member-editor');
  const episodeForm = document.querySelector('.episode-form');
  if (memberEditor && episodeForm) {
    const field = memberEditor.querySelector('input[name="member"]');
    const input = document.querySelector('#member-input');
    const suggestions = document.querySelector('#member-suggestions');
    const chips = document.querySelector('#member-chips');
    const groupSelect = document.querySelector('#group-select');
    const catalog = JSON.parse(memberEditor.dataset.catalog || '[]');
    let tags = [...new Set((field.value || '').split(/[,，;；\n]+/).map(x => x.trim()).filter(Boolean))];
    function paintTags() {
      field.value = tags.join(', ');
      chips.replaceChildren();
      tags.forEach(name => {
        const chip = document.createElement('span');
        chip.className = 'member-chip';
        chip.append(document.createTextNode(name));
        const remove = document.createElement('button');
        remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `移除 ${name}`);
        remove.addEventListener('click', () => { tags = tags.filter(x => x !== name); paintTags(); input.focus(); });
        chip.append(remove); chips.append(chip);
      });
    }
    function paintSuggestions() {
      suggestions.replaceChildren();
      const groups = [...(groupSelect?.querySelectorAll("input:checked") || [])].map(input => +input.value);
      const needle = input.value.trim().toLocaleLowerCase();
      catalog.filter(x => groups.includes(x.group) && !tags.includes(x.name) && (!needle || x.name.toLocaleLowerCase().includes(needle))).slice(0,8).forEach(x => {
        const option = document.createElement('button'); option.type = 'button'; option.textContent = x.display || x.name;
        option.addEventListener('click', () => { input.value = x.name; commit(); input.focus(); });
        suggestions.append(option);
      });
    }
    function commit() {
      const names = input.value.split(/[,，;；\n]+/).map(x => x.trim()).filter(Boolean);
      for (const name of names) if (!tags.includes(name) && tags.length < 30) tags.push(name.slice(0,80));
      input.value = ''; paintTags(); paintSuggestions();
    }
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ',' || event.key === '，') { event.preventDefault(); commit(); }
    });
    input.addEventListener('input', () => { if (/[,，]$/.test(input.value)) commit(); else paintSuggestions(); });
    memberEditor.querySelectorAll('[data-add-member]').forEach(button => button.addEventListener('click', () => {
      input.value = button.dataset.addMember; commit(); input.focus();
    }));
    groupSelect?.addEventListener('change', paintSuggestions);
    episodeForm.addEventListener('submit', event => {
      commit();
      const status = episodeForm.querySelector('select[name="status"]').value;
      if (['published','private'].includes(status) && episodeForm.dataset.wasStatus !== status) {
        const message = status === 'private' ? '確定將這篇文章設為私密嗎？匯出網站時需要設定共用密碼。' : '確定公開發布這篇文章嗎？公開後會出現在網站上。';
        if (!window.confirm(message)) { event.preventDefault(); return; }
        episodeForm.querySelector('input[name="confirm_publish"]').value = '1';
      }
    });
    paintTags(); paintSuggestions();
  }
  document.querySelectorAll('[data-confirm="page-delete"]').forEach(form => form.addEventListener('submit', event => {
    if (!window.confirm('確定刪除這個分頁嗎？若它有子分頁，底下的子分頁也會一併刪除。')) { event.preventDefault(); return; }
    form.querySelector('input[name="confirm_delete"]').value='1';
  }));
  document.querySelectorAll('.delete-form').forEach(form => form.addEventListener('submit', event => {
    if (!window.confirm('確定將這篇文章移入回收區嗎？30 天內可復原。')) event.preventDefault();
    else form.querySelector('input[name="confirm_delete"]').value = '1';
  }));
  document.querySelectorAll('.category-delete').forEach(form => form.addEventListener('submit', event => {
    const count=Number(form.dataset.categoryCount || 0);
    if (!window.confirm(`確定刪除這個分類嗎？${count} 篇文章將改成未分類，文章本身會保留。`)) { event.preventDefault();return; }
    form.querySelector('input[name="confirm_delete"]').value='1';
  }));
  document.querySelectorAll('[data-delete-member]').forEach(button => button.addEventListener('click', event => {
    if (!window.confirm('確定刪除這位成員嗎？文章中的既有成員文字不會刪除，但前台篩選選單將不再顯示。')) { event.preventDefault(); return; }
    button.form.querySelector('input[name="confirm_delete"]').value='1';
  }));
  document.querySelector('[data-confirm="compact"]')?.addEventListener('submit', event => {
    if (!window.confirm('整理前請先下載資料庫備份。確定已完成備份並開始整理嗎？')) { event.preventDefault(); return; }
    let field=event.currentTarget.querySelector('input[name="confirm_compact"]');
    if (!field) { field=document.createElement('input'); field.type='hidden'; field.name='confirm_compact'; event.currentTarget.append(field); }
    field.value='1';
  });
  document.querySelectorAll('.report-link').forEach(link => {
    try {
      const target = new URL(link.href, location.href);
      if (target.origin === location.origin) target.searchParams.set('article', location.href.split('#')[0]);
      link.href = target.href;
    } catch { /* Keep the plain report link if URL parsing is unavailable. */ }
  });
  const coverInput=document.querySelector('input[name="cover_file"]');
  const coverDialog=document.querySelector('#article-cover-dialog');
  const sharedCoverId=document.querySelector('#selected-cover-id');
  const coverPreview=document.querySelector('#current-cover-preview');
  const coverEmpty=document.querySelector('#current-cover-empty');
  const removeCover=document.querySelector('#remove-article-cover');
  const coverStatus=document.querySelector('#cover-upload-status');
  const coverItems=[...document.querySelectorAll('.cover-select-item')];
  let coverPage=1, previewUrl=null, coverBeforeRemoval=null;
  function renderCoverPage() {
    const total=Math.max(1,Math.ceil(coverItems.length/20));
    coverPage=Math.max(1,Math.min(total,coverPage));
    coverItems.forEach((item,index)=>{ item.hidden=index<(coverPage-1)*20 || index>=coverPage*20; });
    const pageText=document.querySelector('#cover-picker-page');
    if(pageText) pageText.textContent=`第 ${coverPage} / ${total} 頁`;
    const prev=document.querySelector('#cover-picker-prev'),next=document.querySelector('#cover-picker-next');
    if(prev)prev.disabled=coverPage===1;
    if(next)next.disabled=coverPage===total;
  }
  function previewCover(src) {
    if(coverPreview){if(src)coverPreview.src=src;else coverPreview.removeAttribute('src');coverPreview.hidden=!src;}
    if(coverEmpty)coverEmpty.hidden=!!src;
  }
  document.querySelector('#cover-picker-open')?.addEventListener('click',()=>{
    const selected=coverItems.findIndex(item=>item.dataset.coverId===sharedCoverId?.value);
    coverPage=selected<0?1:Math.floor(selected/20)+1;
    renderCoverPage();coverDialog?.showModal();
  });
  document.querySelector('#cover-picker-close')?.addEventListener('click',()=>coverDialog?.close());
  coverDialog?.addEventListener('click',event=>{if(event.target===coverDialog){const rect=coverDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)coverDialog.close();}});
  document.querySelector('#cover-picker-prev')?.addEventListener('click',()=>{coverPage--;renderCoverPage();document.querySelector('.cover-dialog-scroll')?.scrollTo(0,0);});
  document.querySelector('#cover-picker-next')?.addEventListener('click',()=>{coverPage++;renderCoverPage();document.querySelector('.cover-dialog-scroll')?.scrollTo(0,0);});
  coverItems.forEach(item=>item.addEventListener('click',()=>{
    if(sharedCoverId)sharedCoverId.value=item.dataset.coverId;
    if(coverInput)coverInput.value='';
    if(removeCover)removeCover.checked=false;
    if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
    if(coverStatus)coverStatus.textContent='已選擇共用封面；儲存文章後生效。';
    coverItems.forEach(choice=>choice.setAttribute('aria-pressed',String(choice===item)));
    previewCover(item.dataset.coverSrc);coverDialog?.close();
  }));
  document.querySelector('#upload-cover-open')?.addEventListener('click',()=>coverInput?.click());
  coverInput?.addEventListener('change',()=>{
    const file=coverInput.files?.[0];if(!file)return;
    if(sharedCoverId)sharedCoverId.value='';
    if(removeCover)removeCover.checked=false;
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    previewUrl=URL.createObjectURL(file);previewCover(previewUrl);
    if(coverStatus)coverStatus.textContent='已選擇新封面；儲存文章後生效。';
    coverItems.forEach(choice=>choice.setAttribute('aria-pressed','false'));
  });
  removeCover?.addEventListener('change',()=>{
    if(removeCover.checked){
      coverBeforeRemoval={src:coverPreview?.getAttribute('src')||'',status:coverStatus?.textContent||''};
      previewCover('');if(coverStatus)coverStatus.textContent='儲存文章後移除封面。';
    }else if(coverBeforeRemoval){previewCover(coverBeforeRemoval.src);if(coverStatus)coverStatus.textContent=coverBeforeRemoval.status;}
  });
  renderCoverPage();

  coverInput?.addEventListener('change', () => {
    const file=coverInput.files?.[0]; if (!file || !file.type.startsWith('image/')) return;
    const image=new Image(); const url=URL.createObjectURL(file);
    image.onload=() => {
      URL.revokeObjectURL(url);
      if (file.size<500000 && image.width<=1200 && image.height<=630) return;
      const scale=Math.min(1,1200/image.width,630/image.height), canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.width*scale)); canvas.height=Math.max(1,Math.round(image.height*scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      canvas.toBlob(blob => {
        if (!blob || coverInput.files?.[0] !== file) return; const transfer=new DataTransfer();
        transfer.items.add(new File([blob],file.name.replace(/\.[^.]+$/,'.webp'),{type:'image/webp'})); coverInput.files=transfer.files;
      },'image/webp',.82);
    };
    image.src=url;
  });
  const holder = document.querySelector('.youtube-placeholder[data-youtube]');
  const article = document.querySelector('.episode-article');
  const transcript = document.querySelector('#transcript');
  const lines = [...document.querySelectorAll('.line[data-time]')];
  const offsetInput = document.querySelector('#offset');
  const playButton = document.querySelector('#play-toggle');
  const seekBack = document.querySelector('#seek-back');
  const seekForward = document.querySelector('#seek-forward');
  const progress = document.querySelector('#seek-progress');
  const timeDisplay = document.querySelector('#time-display');
  const follow = document.querySelector('#auto-follow');
  const rate = document.querySelector('#playback-rate');
  const box = document.querySelector('#player-box');
  const anchor = document.querySelector('#player-anchor');
  const captionBox = document.querySelector('.live-caption');
  const captionSizeValue = document.querySelector('#caption-size-value');
  const captionSizeKey = 'voice-archive-caption-percent';
  const sizeSlider = document.querySelector('#caption-size-slider');
  const positionSelect = document.querySelector('#caption-position');
  const theaterButton = document.querySelector('.theater-toggle');
  const theaterClose = document.querySelector('.theater-close');
  const captionDisplay = document.createElement('div');
  captionDisplay.className = 'caption-display';
  const captionOverlay = document.createElement('div');
  captionOverlay.className = 'caption-overlay';
  captionBox?.querySelectorAll('.caption-row').forEach(row => captionDisplay.append(row));
  captionBox?.prepend(captionDisplay);
  holder?.append(captionOverlay);
  let captionSize = 20;
  try {
    const saved = localStorage.getItem(captionSizeKey);
    if (saved !== null && Number.isFinite(Number(saved))) captionSize = Number(saved);
    else {
      const legacy = Number(localStorage.getItem('voice-archive-caption-size'));
      if (legacy >= 12 && legacy <= 16) captionSize = Math.round((legacy - 8) / 20 * 100);
    }
  } catch { /* Storage may be unavailable. */ }
  function setCaptionSize(size) {
    captionSize = Math.round(Math.max(0, Math.min(100, Number(size) || 0)));
    box?.style.setProperty('--caption-size', `${8 + captionSize * .2}pt`);
    captionDisplay.hidden = captionSize === 0;
    if (captionSizeValue) captionSizeValue.textContent = `${captionSize}%`;
    if (sizeSlider) sizeSlider.value = String(captionSize);
    try { localStorage.setItem(captionSizeKey, String(captionSize)); } catch { /* Storage may be unavailable. */ }
  }
  function setCaptionPosition(value) {
    const mode = value === 'overlay' ? 'overlay' : 'below';
    (mode === 'overlay' ? captionOverlay : captionBox)?.prepend(captionDisplay);
    box?.setAttribute('data-caption-position', mode);
    if (positionSelect) positionSelect.value = mode;
    try { localStorage.setItem('voice-archive-caption-position', mode); } catch { /* Storage may be unavailable. */ }
  }
  let captionPosition = 'below';
  try { captionPosition = localStorage.getItem('voice-archive-caption-position') || 'below'; } catch { /* Storage may be unavailable. */ }
  setCaptionPosition(captionPosition);
  positionSelect?.addEventListener('change', () => setCaptionPosition(positionSelect.value));
  sizeSlider?.addEventListener('input', () => setCaptionSize(sizeSlider.value));
  document.querySelector('#player-fullscreen')?.addEventListener('click', async () => {
    if (!box) return;
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    setTheater(false);
    box.classList.remove('floating-player');
    document.body.classList.remove('has-floating-player');
    if (anchor) anchor.style.minHeight = '';
    try { await box.requestFullscreen(); }
    catch { setTheater(true); }
  });
  if (captionBox) {
    setCaptionSize(captionSize);
    captionBox.querySelectorAll('[data-caption-size]').forEach(button => button.addEventListener('click', () => setCaptionSize(captionSize + Number(button.dataset.captionSize))));
    const langKey = 'voice-archive-caption-language';
    function setLanguage(value) {
      const lang = ['zh','ko','both'].includes(value) ? value : 'zh';
      captionBox.dataset.language = lang;
      captionOverlay.dataset.language = lang;
      captionBox.querySelectorAll('[data-caption-lang]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.captionLang === lang)));
      try { localStorage.setItem(langKey, lang); } catch { /* Private browsing. */ }
    }
    let language = 'zh';
    try { language = localStorage.getItem(langKey) || 'zh'; } catch { /* Private browsing. */ }
    setLanguage(language);
    captionBox.querySelectorAll('[data-caption-lang]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.captionLang)));
  }
  const offset = () => Math.max(-30, Math.min(30, +(offsetInput?.value || 0) || 0));
  let player, ready = false, playing = false, timer, pendingPlay = false, pendingSeek = null, activeLine = null, scrubbing = false;
  function setTheater(open) {
    if (!box) return;
    box.classList.toggle('theater-player', open);
    document.body.classList.toggle('has-theater-player', open);
    theaterButton?.setAttribute('aria-pressed', String(open));
    if (open && box.classList.contains('floating-player')) {
      box.classList.remove('floating-player'); document.body.classList.remove('has-floating-player');
      if (anchor) anchor.style.minHeight = '';
    }
  }
  theaterButton?.addEventListener('click', () => setTheater(!box?.classList.contains('theater-player')));
  theaterClose?.addEventListener('click', () => setTheater(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setTheater(false); });
  const symbols = {
    play: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>'
  };
  function clock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const n = Math.floor(seconds);
    return n >= 3600 ? `${Math.floor(n/3600)}:${String(Math.floor(n%3600/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}` : `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
  }
  function updateTime() {
    if (!ready || !player?.getCurrentTime) return;
    const current = player.getCurrentTime() || 0;
    const duration = player.getDuration?.() || 0;
    if (timeDisplay) timeDisplay.textContent = `${clock(scrubbing && duration ? +progress.value / 1000 * duration : current)} / ${duration ? clock(duration) : '--:--'}`;
    if (progress) { progress.disabled = !duration; if (duration && !scrubbing) progress.value = String(Math.round(Math.min(1,current/duration)*1000)); }
  }

  function dock() {
    if (!box || !anchor) return;
    const float = ready && playing && !document.fullscreenElement && !box.classList.contains('theater-player') && anchor.getBoundingClientRect().bottom < 0;
    if (float && !box.classList.contains('floating-player')) {
      anchor.style.minHeight = `${box.offsetHeight}px`;
      box.classList.add('floating-player');
      document.body.classList.add('has-floating-player');
    } else if (!float && box.classList.contains('floating-player')) {
      box.classList.remove('floating-player');
      document.body.classList.remove('has-floating-player');
      anchor.style.minHeight = '';
    }
  }
  function setPlaying(value) {
    playing = value;
    if (playButton) { playButton.innerHTML = symbols[value ? 'pause' : 'play']; playButton.setAttribute('aria-label', value ? '暫停播放' : '播放影片'); }
    dock();
  }
  function centerActiveLine() {
    if (follow?.checked && activeLine && disclosure?.open && transcript) {
      transcript.scrollTo({top: activeLine.offsetTop - transcript.clientHeight / 2 + activeLine.clientHeight / 2, behavior:'smooth'});
    }
  }
  follow?.addEventListener('change', centerActiveLine);
  disclosure?.addEventListener('toggle', centerActiveLine);
  function caption() {
    if (!ready || !player?.getCurrentTime) return;
    let current = null;
    const time = player.getCurrentTime();
    for (const line of lines) if (+line.dataset.time + offset() <= time + .15) current = line;
    updateTime();
    if (current === activeLine) return;
    activeLine?.classList.remove('active');
    current?.classList.add('active');
    activeLine = current;
    const ko = document.querySelector('#live-ko');
    const zh = document.querySelector('#live-zh');
    if (ko) ko.textContent = current?.querySelector('.ko')?.textContent || '';
    if (zh) zh.textContent = current?.querySelector('.zh')?.textContent || (current ? '' : '等待字幕開始…');
    centerActiveLine();
  }
  function loadPlayer(autoPlay = false) {
    if (!holder || holder.querySelector('iframe')) {
      if (autoPlay && ready) player?.playVideo();
      return;
    }
    const id = holder.dataset.youtube;
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    pendingPlay = autoPlay;
    holder.querySelector('.load-player')?.remove();
    const frame = document.createElement('iframe');
    frame.id = 'youtube-player';
    frame.src = `https://www.youtube.com/embed/${id}?enablejsapi=1&rel=0&origin=${encodeURIComponent(location.origin)}${autoPlay ? '&autoplay=1' : ''}`;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.title = 'YouTube 語音直播影片播放器';
    frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    holder.appendChild(frame);
    const init = () => {
      player = new YT.Player(frame, {events: {
        onReady: () => {
          ready = true;
          updateTime();
          if (pendingSeek !== null) { player.seekTo(pendingSeek, true); pendingSeek = null; }
          if (rate?.value) player.setPlaybackRate(+rate.value);
          if (pendingPlay && !document.hidden) player.playVideo();
          pendingPlay = false;
          timer = window.setInterval(caption, 350);
        },
        onStateChange: event => {
          if (event.data === YT.PlayerState.PLAYING) setPlaying(true);
          if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) setPlaying(false);
        },
        onError: () => setPlaying(false),
        onPlaybackRateChange: event => { if (rate) rate.value = String(event.data); }
      }});
    };
    if (window.YT?.Player) init();
    else {
      window.onYouTubeIframeAPIReady = init;
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  }
  holder?.querySelector('.load-player')?.addEventListener('click', () => loadPlayer(true));
  playButton?.addEventListener('click', () => {
    if (!ready) { loadPlayer(true); return; }
    if (playing) player.pauseVideo(); else player.playVideo();
  });
  for (const [button,delta] of [[seekBack,-10],[seekForward,10]]) button?.addEventListener('click', () => {
    if (!ready) { pendingSeek = Math.max(0,(pendingSeek || 0)+delta); loadPlayer(true); return; }
    player.seekTo(Math.max(0,Math.min(player.getDuration?.() || Infinity,player.getCurrentTime()+delta)),true);
    updateTime(); caption();
  });
  progress?.addEventListener('input', () => { scrubbing = true; updateTime(); });
  progress?.addEventListener('change', () => {
    const duration = player?.getDuration?.() || 0;
    if (ready && duration) player.seekTo(+progress.value / 1000 * duration,true);
    scrubbing = false; updateTime(); caption();
  });
  rate?.addEventListener('change', () => {
    if (!ready) return;
    const allowed = player.getAvailablePlaybackRates?.() || [1];
    if (allowed.includes(+rate.value)) player.setPlaybackRate(+rate.value);
    else rate.value = String(player.getPlaybackRate());
  });
  lines.forEach(line => line.addEventListener('click', () => {
    const time = Math.max(0, +line.dataset.time + offset());
    if (ready) { player.seekTo(time, true); player.playVideo(); caption(); }
    else { pendingSeek = time; loadPlayer(true); }
  }));
  window.addEventListener('scroll', dock, {passive:true});
  window.addEventListener('resize', dock);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pendingPlay = false; if (ready) player.pauseVideo(); setPlaying(false); }
  });
  window.addEventListener('pagehide', () => {
    pendingPlay = false;
    if (ready) player.pauseVideo();
    if (timer) clearInterval(timer);
  });

  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    transcript?.classList.remove('mode-ko', 'mode-zh');
    if (button.dataset.mode !== 'both') transcript?.classList.add(`mode-${button.dataset.mode}`);
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === button));
  }));
  let size = parseInt(getComputedStyle(document.body).fontSize, 10) || 17;
  document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => {
    size = button.dataset.size === '0' ? parseInt(getComputedStyle(document.body).fontSize, 10) : Math.max(15, Math.min(24, size + +button.dataset.size));
    transcript?.style.setProperty('--transcript-size', `${size}px`);
  }));

  if (article) {
    const url = location.href.replace(/index\.html(?:[?#].*)?$/, '').split('#')[0];
    const title = article.dataset.title || document.title;
    const encoded = encodeURIComponent(url);
    const links = {
      threads: `https://www.threads.com/intent/post?text=${encodeURIComponent(title)}&url=${encoded}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
      line: `https://social-plugins.line.me/lineit/share?url=${encoded}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encoded}`
    };
    document.querySelectorAll('[data-share]').forEach(a => { a.href = links[a.dataset.share]; });
    document.querySelector('#copy-url')?.addEventListener('click', async () => {
      const status = document.querySelector('#copy-status');
      try { await navigator.clipboard.writeText(url); if (status) status.textContent = '已複製文章網址'; }
      catch { if (status) status.textContent = '無法自動複製，請從網址列複製'; }
    });
    const key = `voice-rating:${article.dataset.slug}`;
    const stars = [...document.querySelectorAll('[data-rating]')];
    const ratingStatus = document.querySelector('#rating-status');
    function paint(value) {
      stars.forEach(button => {
        button.textContent = +button.dataset.rating <= value ? '★' : '☆';
        button.setAttribute('aria-pressed', String(+button.dataset.rating === value));
      });
      if (value && ratingStatus) ratingStatus.textContent = `妳的評分：${value} 星`;
    }
    try { paint(+(localStorage.getItem(key) || 0)); } catch { /* Storage may be disabled. */ }
    stars.forEach(button => button.addEventListener('click', () => {
      const value = +button.dataset.rating;
      try { localStorage.setItem(key,String(value)); } catch { /* Selection still works until reload. */ }
      paint(value);
    }));
  }
})();

// r16: keep sorting separate from member editing forms.
(() => {
  const form=document.querySelector('#group-order-form'),list=document.querySelector('#group-order-list');
  if(!form||!list)return;
  let dragging=null;
  function sync(changed=false){
    const rows=[...list.children];form.elements.order.value=rows.map(row=>row.dataset.groupOrderId).join(',');
    rows.forEach((row,i)=>{row.querySelector('[data-order-up]').disabled=i===0;row.querySelector('[data-order-down]').disabled=i===rows.length-1;});
    if(changed)document.querySelector('#group-order-status').textContent='順序已調整，請按「儲存排序」。';
  }
  list.addEventListener('click',event=>{
    const up=event.target.closest('[data-order-up]'),down=event.target.closest('[data-order-down]');if(!up&&!down)return;
    const row=event.target.closest('li');
    if(up&&row.previousElementSibling)list.insertBefore(row,row.previousElementSibling);
    if(down&&row.nextElementSibling)list.insertBefore(row.nextElementSibling,row);
    sync(true);
  });
  list.addEventListener('dragstart',event=>{
    if(!event.target.closest('.group-drag-handle')){event.preventDefault();return;}
    dragging=event.target.closest('li');event.dataTransfer.setData('text/plain',dragging.dataset.groupOrderId);event.dataTransfer.effectAllowed='move';dragging.classList.add('dragging');
  });
  list.addEventListener('dragover',event=>{
    if(!dragging)return;event.preventDefault();event.dataTransfer.dropEffect='move';
    const row=event.target.closest('li');if(!row||row===dragging)return;
    const box=row.getBoundingClientRect();list.insertBefore(dragging,event.clientY<box.top+box.height/2?row:row.nextSibling);sync(true);
  });
  list.addEventListener('drop',event=>{if(dragging){event.preventDefault();sync(true);}});
  list.addEventListener('dragend',()=>{dragging?.classList.remove('dragging');dragging=null;});
  form.addEventListener('submit',()=>sync());sync();
})();
