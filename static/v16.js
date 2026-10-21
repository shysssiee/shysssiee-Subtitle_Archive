/* Lucian UX/UI Prompt #040 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#040 */
/* Lucian UX/UI Prompt #025 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#025 */
(() => {
 const home=document.querySelector('.home-featured');
 if(home&&new URLSearchParams(location.search).get('group')){const target=new URL('videos/',location.href);target.search=location.search;target.hash=location.hash;location.replace(target.href);return;}
 if(home){const pool=[...home.querySelector('#featured-pool').content.querySelectorAll('.episode-row')];home.querySelector('#home-shuffle')?.addEventListener('click',()=>{const choices=pool.slice();for(let i=choices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}home.querySelector('#recommend-list').replaceChildren(...choices.slice(0,2).map(c=>c.cloneNode(true)));});home.querySelector('#home-shuffle')?.click();}
 const clock=document.querySelector('#admin-clock');if(clock){const update=()=>{clock.textContent=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',weekday:'long',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());};update();const timer=setInterval(update,1000);addEventListener('pagehide',()=>clearInterval(timer),{once:true});}
 // Notched floating label, ported from #025; validation stays native to the real form.
 const filters=document.querySelector('.admin-filters');if(filters){filters.classList.add('ux','u025');const input=filters.querySelector('input[name=q]'),old=input?.parentElement;
 if(input&&old){const box=document.createElement('div');box.className='u025-f';const frame=document.createElement('div');frame.className='u025-box';input.classList.add('u025-in');input.id='admin-query';input.placeholder='';const lab=document.createElement('label');lab.className='u025-lab';lab.htmlFor=input.id;lab.textContent='搜尋標題或關鍵字';const line=document.createElement('span');line.className='u025-line';line.innerHTML='<i class="l"></i><i class="g"></i><i class="r"></i>';old.replaceWith(box);frame.append(input,line,lab);box.append(frame);
 const lift=()=>{const up=document.activeElement===input||input.value.length>0;box.classList.toggle('is-up',up);line.style.setProperty('--gap',up?(lab.offsetWidth*.8+2)+'px':'0px');};input.addEventListener('focus',()=>{box.classList.add('is-focus');lift();});input.addEventListener('blur',()=>{box.classList.remove('is-focus');lift();});input.addEventListener('input',lift);lift();}}
 const choices=[...document.querySelectorAll('.palette-choice')],form=choices[0]?.closest('form');if(form){
  const fields=['accent','secondary','background','text_color'];const props={accent:'--accent',secondary:'--secondary',background:'--bg',text_color:'--ink'};
  const preview=()=>fields.forEach(k=>document.body.style.setProperty(props[k],form.elements[k].value));
  choices.forEach(b=>b.addEventListener('click',()=>{const colors=JSON.parse(b.dataset.colors);fields.forEach(k=>form.elements[k].value=colors[k]);form.elements.palette_preset.value=b.dataset.palette;choices.forEach(c=>c.setAttribute('aria-pressed',String(c===b)));preview();document.querySelector('#palette-preview-status').textContent='正在預覽「'+b.querySelector('strong').textContent+'」，儲存後套用。';}));
  fields.forEach(k=>form.elements[k].addEventListener('input',()=>{form.elements.palette_preset.value='custom';choices.forEach(c=>c.setAttribute('aria-pressed','false'));preview();}));
 }
})();
