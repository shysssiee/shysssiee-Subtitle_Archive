(() => {
  'use strict';
  const frame=document.querySelector('#mv-player, #mv-admin-player');
  if (!frame) return;
  const $=id=>document.getElementById(id);
  let player,ready=false;
  const status=$('mv-status')||$('mv-admin-status');
  const tell=text=>{if(status)status.textContent=text;};
  const API=window.YT?.Player?Promise.resolve():new Promise(resolve=>{
    const old=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{old?.();resolve();};
    const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>tell('播放器尚未載入，請檢查網路或在 YouTube 觀看原片。');document.head.append(script);
  });
  function attach(){
    if(!/embed\/[A-Za-z0-9_-]{11}/.test(frame.src))return;
    API.then(()=>{player=new YT.Player(frame,{events:{onReady:()=>{ready=true;const progress=$('mv-progress');if(progress)progress.disabled=false;tell('');},onStateChange:event=>{const button=$('mv-play');if(button){button.setAttribute('aria-label',event.data===1?'暫停':'播放');button.innerHTML=event.data===1?'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4v16l14-8z"/></svg>';}} ,onError:()=>tell('這部影片目前無法內嵌播放，請試試「在 YouTube 觀看原始影片」。')}});});
  }
  attach();
  document.querySelector('input[name="source_url"]')?.addEventListener('change',event=>{
    const id=event.target.value.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/)?.[1];
    if(!id)return;
    if(ready)player.cueVideoById(id);else{frame.src=`https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&playsinline=1`;attach();}
  });
  const time=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const list=$('karaoke-list'),lines=[...(list?.querySelectorAll('.karaoke-line')||[])];
  const metadata=lines.map(line=>{
    const node=line.querySelector('.karaoke-ko'),text=node.textContent,chars=Array.from(text);
    let starts;try{starts=JSON.parse(line.dataset.wordTimes);}catch{starts=[];}
    if(starts.length!==chars.length)starts=chars.map((_,i)=>+line.dataset.time+(+line.dataset.end-+line.dataset.time)*i/Math.max(chars.length,1));
    node.replaceChildren();
    const spans=chars.map(char=>{const span=document.createElement('span');span.className='karaoke-char';span.textContent=char;node.append(span);return span;});
    return {line,starts,spans,start:+line.dataset.time,end:+line.dataset.end};
  }).sort((a,b)=>a.start-b.start);
  let active=null,manualUntil=0;
  const slug=location.pathname,key=`mv-offset:${slug}`;
  try{if($('mv-offset')){const stored=localStorage.getItem(key);const parsed=stored===null?0.1:Number(stored);$('mv-offset').value=String(Math.max(-30,Math.min(30,Number.isFinite(parsed)?parsed:0.1)));}}catch{}
  $('mv-offset')?.addEventListener('change',event=>{const value=Math.max(-30,Math.min(30,Number(event.target.value)||0));event.target.value=value;try{localStorage.setItem(key,String(value));}catch{}});
  list?.addEventListener('wheel',()=>manualUntil=Date.now()+3500,{passive:true});list?.addEventListener('touchstart',()=>manualUntil=Date.now()+3500,{passive:true});
  function center(item){if(item&&list){const rowTop=item.line.getBoundingClientRect().top-list.getBoundingClientRect().top+list.scrollTop;const top=Math.max(0,rowTop-(list.clientHeight-item.line.getBoundingClientRect().height)/2);list.scrollTo({top,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}
  function tick(){
    if(!ready||document.hidden)return;
    const current=player.getCurrentTime(),duration=player.getDuration();
    if($('mv-time'))$('mv-time').textContent=`${time(current)} / ${duration?time(duration):'--:--'}`;
    if($('mv-progress')&&duration)$('mv-progress').value=current/duration*1000;
    const t=current+(Number($('mv-offset')?.value)||0);
    // Pick the most recent start at or before playback time. SRT cues may overlap or leave gaps; scanning intervals from the front can reactivate an older lyric.
    let low=0,high=metadata.length-1,next=null;while(low<=high){const mid=(low+high)>>1;if(metadata[mid].start<=t){next=metadata[mid];low=mid+1;}else high=mid-1;}
    if(next!==active){if(active){active.line.classList.remove('active');active.line.setAttribute('aria-current','false');active.spans.forEach(span=>span.style.setProperty('--sung','0%'));}active=next;if(active){active.line.classList.add('active');active.line.setAttribute('aria-current','true');if($('mv-follow')?.checked&&Date.now()>manualUntil)center(active);}}
    active?.spans.forEach((span,i)=>{const end=active.starts[i+1]??active.end;const fill=Math.max(0,Math.min(1,(t-active.starts[i])/Math.max(.01,end-active.starts[i])));span.style.setProperty('--sung',`${fill*100}%`);});
  }
  if(list){setInterval(tick,80);lines.forEach(line=>line.addEventListener('click',()=>{if(ready){player.seekTo(+line.dataset.time,true);player.playVideo();manualUntil=0;tick();}}));
    const toggle=()=>{list.classList.toggle('hide-ko',!$('show-ko').checked);list.classList.toggle('hide-roman',!$('show-roman').checked);};$('show-ko')?.addEventListener('change',toggle);$('show-roman')?.addEventListener('change',toggle);$('mv-follow')?.addEventListener('change',()=>{manualUntil=0;if($('mv-follow').checked)center(active);});}
  $('mv-play')?.addEventListener('click',()=>{if(!ready){tell('播放器載入中，請稍候。');return;}player.getPlayerState()===1?player.pauseVideo():player.playVideo();});
  $('mv-progress')?.addEventListener('input',event=>{if(ready)player.seekTo(Number(event.target.value)/1000*player.getDuration(),true);});
  $('mv-speed')?.addEventListener('change',event=>{if(ready)player.setPlaybackRate(Number(event.target.value));});
  // Admin: timed line starts and per-character starts. No text is interpreted as HTML.
  const field=document.querySelector('textarea[name="ko_srt"]'),cues=$('mv-cues'),saved=$('mv-word-times');
  const toSeconds=value=>{const p=value.replace(',','.').split(':').map(Number);return p.reduce((a,b)=>a*60+b,0);};
  const stamp=seconds=>`${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')},${String(Math.floor((seconds%1)*1000+.00001)).padStart(3,'0')}`;
  function parse(){const result=[];const regex=/^(\d{1,}:\d{2}:\d{2}[,.]\d{3}|\d{1,2}:\d{2}[,.]\d{3})\s*(?:-->|,)\s*(\d{1,}:\d{2}:\d{2}[,.]\d{3}|\d{1,2}:\d{2}[,.]\d{3})[^\S\n]*\n([^]*?)(?=\n\s*\n|$)/gm;const text=field.value.replace(/\r\n?/g,'\n');let match;while((match=regex.exec(text))){const lyric=match[3].split('\n').map(x=>x.trim()).filter(Boolean).join(' ');if(lyric)result.push({start:toSeconds(match[1]),end:toSeconds(match[2]),text:lyric,at:match.index,original:match[1]});}return result;}
  let timings={};try{timings=JSON.parse(saved?.value||'{}');}catch{}
  function sync(){if(saved)saved.value=JSON.stringify(timings);}
  function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',action);return b;}
  function now(){if(!ready){tell('請先等待預覽影片載入。');return null;}return Math.round(player.getCurrentTime()*1000)/1000;}
  function paint(){if(!cues||!field)return;cues.replaceChildren();const rows=parse();const clean={};rows.forEach((cue,i)=>{const key=String(i),chars=Array.from(cue.text),end=Math.min(cue.end,rows[i+1]?.start??cue.end);if(timings[key]?.text===cue.text&&timings[key].times?.length===chars.length)clean[key]=timings[key];
      const box=document.createElement('details');box.className='mv-cue-editor';const summary=document.createElement('summary');summary.textContent=`${time(cue.start)} · ${cue.text}`;box.append(summary);
      const tools=document.createElement('div');tools.className='mv-cue-actions';tools.append(button('播放這句',()=>{if(ready){player.seekTo(cue.start,true);player.playVideo();}}),button('帶入目前秒數',()=>{const t=now();if(t===null)return;if(t>=end){tell('起點需早於這句結束時間。');return;}if(i&&t<rows[i-1].start){tell('起點不能早於上一句。');return;}field.value=field.value.replace(/\r\n?/g,'\n');field.setRangeText(stamp(t),cue.at,cue.at+cue.original.length,'preserve');delete timings[key];paint();tell('已更新句子起點，請儲存文章。');}));box.append(tools);
      const note=document.createElement('p');note.className='hint';note.textContent='展開後可依歌聲逐字帶入；時間須遞增且位於本句範圍。';box.append(note);
      const grid=document.createElement('div');grid.className='mv-word-grid';const inputs=[];
      const defaults=clean[key]?.times||chars.map((_,n)=>cue.start+(end-cue.start)*n/Math.max(1,chars.length));
      function commit(){const times=inputs.map(input=>Number(input.value));if(times.some((t,n)=>!Number.isFinite(t)||t<cue.start||t>end||(n&&t<times[n-1]))){tell('逐字時間須遞增且位於本句範圍，尚未套用。');return false;}timings[key]={text:cue.text,times};sync();tell('已套用逐字校時，請儲存文章。');return true;}
      chars.forEach((char,n)=>{const cell=document.createElement('label');const caption=document.createElement('span');caption.textContent=char===' '?'空格':char;const input=document.createElement('input');input.type='number';input.step='.001';input.min=cue.start;input.max=end;input.value=defaults[n].toFixed(3);input.setAttribute('aria-label',`第 ${i+1} 句第 ${n+1} 字 ${char} 秒數`);inputs.push(input);cell.append(caption,input,button('帶入',()=>{const t=now();if(t===null)return;if(t<cue.start||t>end||(n&&t<Number(inputs[n-1].value))){tell('時間需在本句範圍內，且不能早於上一字。');return;}input.value=t.toFixed(3);for(let k=n+1;k<inputs.length;k++)if(Number(inputs[k].value)<t)inputs[k].value=t.toFixed(3);commit();}));input.addEventListener('change',commit);grid.append(cell);});box.append(grid);
      box.append(button('套用逐字校時',commit),button('重設為平均進度',()=>{delete timings[key];paint();tell('已重設，請儲存文章。');}));cues.append(box);
    });timings=clean;sync();}
  if(field&&cues){field.addEventListener('input',paint);paint();document.querySelector('input[name="ko_file"]')?.addEventListener('change',async event=>{const file=event.target.files?.[0];if(file){field.value=(await file.text()).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');event.target.value='';paint();tell('已載入韓文歌詞，可先校時再儲存。');}});}
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready)player.pauseVideo();});window.addEventListener('pagehide',()=>{if(ready)player.pauseVideo();});
})();
