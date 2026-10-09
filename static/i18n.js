(() => {
  if (!document.body.classList.contains('public-page') || window.archiveI18n) return;
  const words = {
    '影音紀錄':['영상 기록','Video archive'], '首頁':['홈','Home'],
    '關於本站':['사이트 소개','About'], '問題回報':['문제 신고','Report an issue'],
    '團體專欄':['그룹별 모아보기','Browse by group'], '全部':['전체','All'],
    '搜尋':['검색','Search'], '搜尋影音紀錄':['영상 검색','Search videos'],
    '搜尋影音紀錄、成員或關鍵字':['영상, 멤버 또는 키워드 검색','Search videos, members or keywords'],
    '最新更新文章':['최근 게시글','Latest articles'], '全部文章':['전체 게시글','All articles'], '字幕外觀':['자막 모양','Subtitle appearance'], '字幕樣式':['자막 스타일','Subtitle style'], '底色透明度':['배경 투명도','Background transparency'], '字幕高度':['자막 높이','Subtitle height'], '白字／黑底':['흰 글자 / 검은 배경','White on black'], '黑字／白底':['검은 글자 / 흰 배경','Black on white'], '黃字／黑底':['노란 글자 / 검은 배경','Yellow on black'], '白字描邊／無底':['흰색 외곽선 / 배경 없음','Outlined white / no background'], '恢復預設':['기본값 복원','Reset defaults'], '最近更新':['최근 업데이트','Latest updates'], '隨機推薦':['랜덤 추천','Discover'],
    '換一批':['다시 추천','Shuffle'], '內容日期':['콘텐츠 날짜','Content date'],
    '最新優先':['최신순','Newest first'], '最舊優先':['오래된순','Oldest first'],
    '← 上一頁':['← 이전','← Previous'], '下一頁 →':['다음 →','Next →'],
    '前往第':['페이지','Page'], '頁':['',''], '前往':['이동','Go'],
    '输入頁碼':['페이지 번호 입력','Enter page number'], '輸入頁碼':['페이지 번호 입력','Enter page number'],
    '文章分頁':['페이지 탐색','Pagination'], '目前沒有符合的影音紀錄。':['조건에 맞는 영상이 없습니다.','No matching videos.'],
    '未填寫':['미지정','Not specified'], '繁中':['번체 중국어','Traditional Chinese'],
    '韓文':['한국어','Korean'], '雙語':['이중 언어','Bilingual'],
    '速度':['재생 속도','Speed'], '播放影片':['재생','Play'], '暫停播放':['일시 정지','Pause'],
    '載入 YouTube 播放器':['YouTube 플레이어 열기','Load YouTube player'],
    '載入並播放 YouTube 影片':['YouTube 영상 재생','Load and play YouTube video'],
    '在 YouTube 觀看原始影片':['YouTube에서 원본 보기','Watch original on YouTube'],
    '劇院模式':['영화관 모드','Theater mode'], '關閉劇院模式':['영화관 모드 닫기','Close theater mode'],
    '播放字幕語言':['자막 언어','Caption language'], '調整播放字幕字級':['자막 크기 조절','Caption size'],
    '縮小播放字幕':['자막 축소','Smaller captions'], '放大播放字幕':['자막 확대','Larger captions'],
    '快退 10 秒':['10초 뒤로','Back 10 seconds'], '快進 10 秒':['10초 앞으로','Forward 10 seconds'],
    '影片播放進度':['재생 진행률','Playback progress'], '雙語逐字稿':['이중 언어 대본','Bilingual transcript'],
    '展開雙語逐字稿':['대본 펼치기','Show transcript'], '收起雙語逐字稿':['대본 접기','Hide transcript'],
    '整理筆記':['정리 노트','Notes'], '分享這篇':['공유하기','Share'], '分享文章':['게시물 공유','Share article'],
    '複製網址':['링크 복사','Copy link'], '已複製文章網址':['링크를 복사했습니다','Link copied'],
    '無法自動複製，請從網址列複製':['주소창에서 링크를 복사해 주세요','Please copy the link from the address bar'],
    '影片翻譯評分':['번역 평가','Rate the translation'], '為影片翻譯評分':['번역 평가','Rate the translation'],
    '選擇 1～5 星':['별 1~5개 선택','Choose 1–5 stars'],
    '切換深色與淺色模式':['다크/라이트 모드 전환','Toggle dark/light mode'],
    '介面語言':['인터페이스 언어','Interface language'],
    '請先選擇團體':['그룹을 먼저 선택하세요','Choose a group first'], '全部成員':['모든 멤버','All members'],
    '成員':['멤버','Members'], '團體':['그룹','Group'],
    '開啟問題回報表單 ↗':['신고 양식 열기 ↗','Open report form ↗'],
    '請透過 Google 表單填寫問題或建議。':['Google 설문지로 문제나 의견을 보내 주세요.','Send issues or suggestions through the Google form.'],
    '管理員尚未設定表單收件服務。':['신고 양식이 아직 설정되지 않았습니다.','The report form is not configured yet.'],
    '密碼':['비밀번호','Password'], '解鎖':['잠금 해제','Unlock'], '正在解鎖…':['잠금 해제 중…','Unlocking…'],
    '密碼不正確，請重新輸入。':['비밀번호가 틀렸습니다. 다시 입력해 주세요.','Incorrect password. Please try again.'],
    '觀看密碼':['시청 비밀번호','Viewing password'], '進入 POP Live':['POP Live 입장','Enter POP Live'],
    '倒退 10 秒':['10초 뒤로','Back 10 seconds'], '播放速度':['재생 속도','Playback speed'],
    '繁體中文':['번체 중국어','Traditional Chinese'], '文章路徑':['게시물 경로','Article navigation'],
    '點擊查看完整內容':['전체 내용 보기','View full transcript'],
    '其他語音紀錄':['관련 영상','Related videos'], '逐字稿整理中。':['대본 준비 중입니다.','Transcript in progress.'],
    '「問題回報」':['문제 신고','Report an issue'],
    '在 YouTube 觀看原始影片 ↗':['YouTube에서 원본 보기 ↗','Watch original on YouTube ↗'],
    '分享至':['공유','Share to'], '分享至 Threads':['Threads에 공유','Share to Threads'],
    '分享到 Threads':['Threads에 공유','Share to Threads'], '分享到 Facebook':['Facebook에 공유','Share to Facebook'],
    '分享到 LINE':['LINE에 공유','Share to LINE'], '分享到 X':['X에 공유','Share to X']
  };
  const prefixes = {'文章發布':['게시글 게시일','Article published'], '發布日期':['게시일','Published'], '直播日期':['라이브 날짜','Live date'], '分類':['분류','Category']};
  let language='zh-Hant';
  try { const saved=localStorage.getItem('archive-ui-language'); if (['zh-Hant','ko','en'].includes(saved)) language=saved; } catch {}
  const originals=new WeakMap(), attributes=new WeakMap();
  const protectedSelector='script,style,.language-select,.brand,footer,.custom-page-content,.custom-page>h1,.pop-detail>h1,.breadcrumbs [aria-current=page],.nav-dropdown,.nav-submenu,.episode-row strong,.episode-tags,.episode-groups,.episode-article>h1,.episode-article>p,.about-page p,.hero p,.hero h1,.notes p,.words,.caption-zh,.caption-ko,#live-zh,#live-ko,[data-ui-preserve],a[href*="/page/"],option[data-group],[data-filter]:not([data-filter=""])';
  function source(value) {
    const trimmed=value.trim();
    for (const [original,pair] of Object.entries(words)) {
      if (trimmed && pair.includes(trimmed)) return value.replace(trimmed,original);
    }
    for (const [original,pair] of Object.entries(prefixes)) {
      for (const translated of pair) {
        if (trimmed.startsWith(translated+':')) return value.replace(trimmed,original+'：'+trimmed.slice(translated.length+1).trimStart());
      }
    }
    return value;
  }
  function translate(value) {
    value=source(value);
    if (language==='zh-Hant') return value;
    const index=language==='ko'?0:1;
    const trimmed=value.trim();
    let result=words[trimmed]?.[index];
    if (result===undefined) {
      for (const [prefix, pair] of Object.entries(prefixes)) {
        if (trimmed.startsWith(prefix+'：')) {result=pair[index]+': '+trimmed.slice(prefix.length+1); break;}
      }
    }
    if (result===undefined) {
      const rating=trimmed.match(/^妳的評分：(\d) 星$/);
      const star=trimmed.match(/^(\d) 星$/);
      if (rating) result=language==='ko'?`내 평가: 별 ${rating[1]}개`:`Your rating: ${rating[1]} stars`;
      else if (star) result=language==='ko'?`별 ${star[1]}개`:`${star[1]} stars`;
    }
    return result===undefined?value:value.replace(trimmed,result);
  }
  function apply() {
    document.documentElement.lang=language;
    document.querySelectorAll('.language-select').forEach(select=>{select.value=language;});
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node=walker.currentNode;
      if (!node.parentElement || node.parentElement.closest(protectedSelector)) continue;
      let record=originals.get(node);
      if (!record || node.nodeValue!==record.last) record={base:node.nodeValue,last:node.nodeValue};
      const next=translate(record.base);
      if (node.nodeValue!==next) node.nodeValue=next;
      record.last=next; originals.set(node,record);
    }
    document.querySelectorAll('[aria-label],[placeholder],[title]').forEach(element=>{
      if (element.closest(protectedSelector) && !element.matches('.language-select')) return;
      const records=attributes.get(element)||{};
      for (const attr of ['aria-label','placeholder','title']) {
        const current=element.getAttribute(attr); if (current===null) continue;
        let record=records[attr];
        if (!record || current!==record.last) record={base:current,last:current};
        const next=translate(record.base);
        if (current!==next) element.setAttribute(attr,next);
        record.last=next; records[attr]=record;
      }
      attributes.set(element,records);
    });
  }
  document.addEventListener('change',event=>{
    if (!event.target.matches('.language-select')) return;
    language=event.target.value;
    try {localStorage.setItem('archive-ui-language',language);} catch {}
    apply();
  });
  let pending=false;
  new MutationObserver(()=>{
    if (pending) return;
    pending=true;
    queueMicrotask(()=>{pending=false;apply();});
  }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder','title']});
  window.archiveI18n={apply};
  apply();
})();
