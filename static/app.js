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
      const group = +(groupSelect?.value || 0);
      const needle = input.value.trim().toLocaleLowerCase();
      catalog.filter(x => x.group === group && !tags.includes(x.name) && (!needle || x.name.toLocaleLowerCase().includes(needle))).slice(0,8).forEach(x => {
        const option = document.createElement('button'); option.type = 'button'; option.textContent = x.name;
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
    groupSelect?.addEventListener('change', paintSuggestions);
    episodeForm.addEventListener('submit', event => {
      commit();
      const status = episodeForm.querySelector('select[name="status"]').value;
      if (status === 'published' && episodeForm.dataset.wasStatus !== 'published') {
        if (!window.confirm('確定公開發布這篇文章嗎？公開後會出現在網站上。')) { event.preventDefault(); return; }
        episodeForm.querySelector('input[name="confirm_publish"]').value = '1';
      }
    });
    paintTags(); paintSuggestions();
  }
  document.querySelectorAll('.delete-form').forEach(form => form.addEventListener('submit', event => {
    if (!window.confirm('確定刪除這篇文章嗎？後台無法直接復原，請先下載資料庫備份。')) event.preventDefault();
    else form.querySelector('input[name="confirm_delete"]').value = '1';
  }));
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
  const captionSizeKey = 'voice-archive-caption-size';
  let captionSize = 12;
  try {
    const saved = Number(localStorage.getItem(captionSizeKey));
    if (Number.isInteger(saved) && saved >= 12 && saved <= 16) captionSize = saved;
  } catch { /* Private browsing. */ }
  function setCaptionSize(size) {
    captionSize = Math.max(12, Math.min(16, size));
    captionBox?.style.setProperty('--caption-size', `${captionSize}pt`);
    if (captionSizeValue) captionSizeValue.textContent = `${captionSize}pt`;
    document.querySelectorAll('[data-caption-size]').forEach(button => {
      button.disabled = button.dataset.captionSize === '-1' ? captionSize === 12 : captionSize === 16;
    });
    try { localStorage.setItem(captionSizeKey, String(captionSize)); } catch { /* Private browsing. */ }
  }
  if (captionBox) {
    setCaptionSize(captionSize);
    captionBox.querySelectorAll('[data-caption-size]').forEach(button => button.addEventListener('click', () => setCaptionSize(captionSize + Number(button.dataset.captionSize))));
  }
  const offset = () => Math.max(-30, Math.min(30, +(offsetInput?.value || 0) || 0));
  let player, ready = false, playing = false, timer, pendingPlay = false, pendingSeek = null, activeLine = null, scrubbing = false;
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
    const float = ready && playing && anchor.getBoundingClientRect().bottom < 0;
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
