(() => {
  const holder = document.querySelector('.youtube-placeholder[data-youtube]');
  const offsetInput = document.querySelector('#offset');
  const offset = () => Math.max(-30, Math.min(30, +(offsetInput?.value || 0) || 0));
  let player = null;
  let timer = null;
  if (holder) {
    const load = holder.querySelector('.load-player');
    load?.addEventListener('click', () => {
      const id = holder.dataset.youtube;
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
      load.remove();
      const frame = document.createElement('iframe');
      frame.id = 'youtube-player';
      frame.src = `https://www.youtube.com/embed/${id}?enablejsapi=1&rel=0&origin=${encodeURIComponent(location.origin)}`;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.title = 'YouTube 語音直播影片播放器';
      frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';
      frame.allowFullscreen = true;
      holder.appendChild(frame);
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
      window.onYouTubeIframeAPIReady = () => {
        player = new YT.Player(frame, {events: {onReady: () => {
          timer = setInterval(() => {
            if (!player?.getCurrentTime) return;
            const t = player.getCurrentTime();
            const lines = [...document.querySelectorAll('.line[data-time]')];
            let active = null;
            for (const line of lines) if (+line.dataset.time + offset() <= t + .15) active = line;
            lines.forEach(line => line.classList.toggle('active', line === active));
          }, 350);
        }}});
      };
    });
  }
  document.querySelectorAll('.line[data-time]').forEach(line => line.addEventListener('click', () => {
    if (player?.seekTo) { player.seekTo(Math.max(0, +line.dataset.time + offset()), true); player.playVideo(); }
    else holder?.querySelector('.load-player')?.focus();
  }));
  const transcript = document.querySelector('#transcript');
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
  window.addEventListener('pagehide', () => { if (timer) clearInterval(timer); });
})();
