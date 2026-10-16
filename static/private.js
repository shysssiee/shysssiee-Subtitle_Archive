/* A reading gate for static POP Live pages, not an authentication boundary. */
(() => {
 'use strict';
 const form=document.querySelector('#private-unlock'),content=document.querySelector('#private-content'),template=document.querySelector('#pop-content-template'),canvas=document.querySelector('#pop-captcha');
 if(!form||!content||!template||!canvas)return;
 const field=form.elements.captcha,error=document.querySelector('#private-error'),lock=form.closest('.private-lock'),key='pop-live-navigation-once';
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let answer='',opened=false;
 const rand=n=>{const b=new Uint32Array(1);crypto.getRandomValues(b);return b[0]%n;};
 function challenge(){
  answer=Array.from({length:5},()=>alphabet[rand(alphabet.length)]).join('');field.value='';
  const ctx=canvas.getContext('2d');ctx.fillStyle='#f2edf8';ctx.fillRect(0,0,280,90);
  for(let i=0;i<8;i++){ctx.beginPath();ctx.strokeStyle='#bcb0cf';ctx.moveTo(rand(280),rand(90));ctx.lineTo(rand(280),rand(90));ctx.stroke();}
  [...answer].forEach((letter,i)=>{ctx.save();ctx.translate(32+i*49,48+rand(13));ctx.rotate((rand(15)-7)*Math.PI/180);ctx.fillStyle='#352b49';ctx.font='bold 34px sans-serif';ctx.fillText(letter,0,0);ctx.restore();});
 }
 async function open(){
  if(opened)return;opened=true;content.replaceChildren(template.content.cloneNode(true));lock.hidden=true;content.hidden=false;
  // Template scripts are inert. Initialize only content-specific scripts, once.
  content.querySelectorAll('script[src]').forEach(s=>s.remove());
  const source=[...document.scripts].find(s=>s.src.includes('/private.js'))?.src;
  const base=new URL('.',source||location.href),version=new URL(source||location.href).search;
  for(const file of ['app.js',...(content.querySelector('#static-list')?['export.js']:[]),'engagement.js']){
   await new Promise(resolve=>{const script=document.createElement('script');script.src=new URL(file+version,base).href;script.onload=script.onerror=resolve;document.body.append(script);});
  }
 }
 document.querySelector('#pop-captcha-refresh').addEventListener('click',()=>{challenge();error.textContent='';field.focus();});
 form.addEventListener('submit',event=>{event.preventDefault();if(field.value.trim().toUpperCase()!==answer){challenge();error.textContent='驗證碼不正確，已更換圖片，請再試一次。';field.focus();return;}error.textContent='';open();});
 // A one-use handoff permits list/article navigation, never a remembered login.
 content.addEventListener('click',e=>{const link=e.target.closest('a[href]');if(!link||link.target==='_blank'||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;const url=new URL(link.href);if(url.origin!==location.origin)return;if(!url.pathname.includes('/episode/')&&!url.pathname.includes('/pop-live/'))return;try{sessionStorage.setItem(key,JSON.stringify({url:url.href,at:Date.now()}));}catch{}});
 let pass=null;try{pass=JSON.parse(sessionStorage.getItem(key)||'null');sessionStorage.removeItem(key);}catch{}
 challenge();if(pass?.url===location.href&&Date.now()-pass.at>=0&&Date.now()-pass.at<10000)open();
 addEventListener('pagehide',()=>{content.hidden=true;lock.hidden=false;});
 addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
})();
