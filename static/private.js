(() => {
  const form = document.querySelector('#private-unlock');
  const content = document.querySelector('#private-content');
  const payloadNode = document.querySelector('#private-payload');
  if (!form || !content || !payloadNode || !window.crypto?.subtle) return;
  const from64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const equal = (a,b) => a.length === b.length && a.every((value,index) => value === b[index]);
  async function hmacBytes(keyBytes,data) {
    const key = await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC',key,data));
  }
  async function unlock(password) {
    const payload = JSON.parse(payloadNode.textContent);
    const salt=from64(payload.salt), nonce=from64(payload.nonce), cipher=from64(payload.cipher), expected=from64(payload.tag);
    const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const bits=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:200000},base,512));
    const signed=new Uint8Array(nonce.length+cipher.length); signed.set(nonce); signed.set(cipher,nonce.length);
    const actual=await hmacBytes(bits.slice(32),signed);
    if (!equal(actual,expected)) throw new Error('wrong password');
    const plain=new Uint8Array(cipher.length);
    for(let start=0,counter=0;start<cipher.length;start+=32,counter++) {
      const input=new Uint8Array(20); input.set(nonce); new DataView(input.buffer).setUint32(16,counter);
      const stream=await hmacBytes(bits.slice(0,32),input);
      for(let i=0;i<Math.min(32,cipher.length-start);i++) plain[start+i]=cipher[start+i]^stream[i];
    }
    return new TextDecoder().decode(plain);
  }
  async function openWith(password) {
    const error=document.querySelector('#private-error');
    const button=form.querySelector('button'); button.disabled=true; error.textContent='正在解鎖…';
    try {
      content.innerHTML=await unlock(password);
      form.closest('.private-lock').hidden=true; content.hidden=false;
      const source=document.currentScript?.src || [...document.scripts].find(x=>x.src.includes('/private.js'))?.src || '';
      const base=source ? new URL('.',source) : new URL('../static/',location.href);
      for (const file of ['app.js?v=1.4.4-layout-unlocked', ...(content.querySelector('#static-list')?['export.js?v=1.4.4-layout-unlocked']:[])]) {
        const script=document.createElement('script'); script.src=new URL(file,base); document.body.append(script);
      }
    } catch { error.textContent='密碼不正確，請重新輸入。'; button.disabled=false; }
  }
  form.addEventListener('submit',async event => {
    event.preventDefault();
    await openWith(new FormData(form).get('password'));
  });
  addEventListener('pagehide',()=>{ content.replaceChildren(); content.hidden=true; });
})();
