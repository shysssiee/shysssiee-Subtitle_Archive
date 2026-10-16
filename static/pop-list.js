(() => {
 const list=document.querySelector('#pop-list');if(!list)return;
 const cards=[...list.querySelectorAll('.pop-row')],chips=[...document.querySelectorAll('[data-pop-member]')],pager=document.querySelector('#pop-pages'),empty=document.querySelector('#pop-empty');let member='',page=1;
 function render(){
  const filtered=cards.filter(c=>!member||JSON.parse(c.dataset.popMembers).includes(member));const total=Math.max(1,Math.ceil(filtered.length/12));page=Math.min(page,total);
  cards.forEach(c=>c.hidden=true);filtered.slice((page-1)*12,page*12).forEach(c=>c.hidden=false);empty.hidden=filtered.length>0;
  chips.forEach(c=>{const on=c.dataset.popMember===member;c.classList.toggle('selected',on);c.setAttribute('aria-pressed',String(on));});pager.replaceChildren();
  if(total<2)return;
  function button(text,target,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=disabled;b.className=target===page?'page-number active':'page-button';if(target===page)b.setAttribute('aria-current','page');b.onclick=()=>{page=target;render();list.scrollIntoView({block:'start'});};pager.append(b);}
  button('← 上一頁',page-1,page===1);for(let n=Math.max(1,page-2);n<=Math.min(total,page+2);n++)button(String(n),n);button('下一頁 →',page+1,page===total);
 }
 chips.forEach(c=>c.addEventListener('click',()=>{member=c.dataset.popMember;page=1;render();}));render();
})();
