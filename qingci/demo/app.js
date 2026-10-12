/* Qingci CET4/CET6 — local learning; optional native pronunciation and signed self-updates. */
'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const app = $('#app'), modalRoot = $('#modal-root');
  const E = () => window.QingciEngine;
  // Persisted app state and dictionary entries contain JSON values only.
  const clone = typeof window.structuredClone === 'function' ? window.structuredClone.bind(window) : value => JSON.parse(JSON.stringify(value));
  const native = () => window.AndroidBridge || null;
  const STORE = 'qingci.cet4.state.v1';
  const APP_VERSION = '1.0.11';
  const BOOKS = [
    {id:'ecdict-cet4',name:'四级',code:'CET-4',file:'words.json'},
    {id:'ecdict-cet6',name:'六级',code:'CET-6',file:'words-cet6.json'},
  ];
  let dictionaries = {}, idsByBook = {}, searchIndexes = {}, wordMaps = {}, libraryState;
  let words = [], wordMap = new Map(), state, current = null, revealed = false;
  let page = 'study', mode = 'all', focus = false, extraNew = 0, undoItem = null;
  let query = '', filter = 'all', listLimit = 60, searchTimer, toastTimer, dueTimer;
  let modalType = null, detailId = null, loadError = null, storageError = false;
  let modalOpener = null, modalReturnTarget = null, filteredCache = null, statsCache = null, feedbackDraft = '';
  let dictionariesReady = false, queuedImport = null;
  let browserSpeechGeneration = 0;
  let updateStatus = {state:'idle',message:'可在这里查看更新进度'};
  const feedbackStatuses = new Map();
  const feedbackStates = new Set(['queued','sending','accepted','duplicate','permanent_failed','retryable_failed']);
  const feedbackIdPattern = /^qf_[0-9a-f]{32}$/;
  const VOICE_STORE = 'qingci.voice-profile';
  const VOICES = [
    {key:'us',accent:'en-US',profile:'female',name:'Heart 女声',detail:'美式英语'},
    {key:'us-male',accent:'en-US',profile:'male',name:'Fenrir 男声',detail:'美式英语'},
    {key:'us-bella',accent:'en-US',profile:'female',name:'Bella 女声',detail:'美式英语'},
    {key:'us-michael',accent:'en-US',profile:'male',name:'Michael',detail:'美式男声'},
    {key:'uk',accent:'en-GB',profile:'female',name:'Emma 女声',detail:'英式英语'},
    {key:'uk-male',accent:'en-GB',profile:'male',name:'Fable 男声',detail:'英式英语'},
  ];
  let voiceProfile = 'female';
  try {voiceProfile=(native()?.getVoiceProfile?.() || localStorage.getItem(VOICE_STORE))==='male'?'male':'female';}catch(_){}
  const voiceKeys = {};
  for(const accent of ['en-US','en-GB']) {
    try {voiceKeys[accent]=native()?.getVoiceKey?.(accent)||localStorage.getItem('qingci.voice-key.'+accent);}catch(_){}
  }
  const selectedVoice = () => VOICES.find(v=>v.accent===state.settings.accent && v.key===voiceKeys[v.accent])
    || VOICES.find(v=>v.accent===state.settings.accent && v.profile===voiceProfile) || VOICES[0];
  const SPEEDS = [{rate:.65,name:'慢速'},{rate:.8,name:'舒缓'},{rate:1,name:'正常'}];
  const SPEECH_STORE = 'qingci.speech-settings.v1';
  let speechSettings={rate:.8,repeats:1,gapMs:1200};
  try {
    const value=JSON.parse(native()?.getSpeechSettings?.()||localStorage.getItem(SPEECH_STORE)||'{}');
    if(Number.isFinite(value.rate)&&value.rate>=.6&&value.rate<=1)speechSettings.rate=value.rate;
    if([1,2,3].includes(value.repeats))speechSettings.repeats=value.repeats;
    if([500,1200,2000,3000].includes(value.gapMs))speechSettings.gapMs=value.gapMs;
  }catch(_){}
  const speedName = () => SPEEDS.find(v=>Math.abs(v.rate-speechSettings.rate)<.01)?.name || '自定速度';
  const activeBook = () => BOOKS.find(b=>b.id===libraryState?.activeWordbook) || BOOKS[0];
  const shapes = {
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    book:'<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1V5Z"/><path d="M12 6v14M6 9h3M15 9h3M6 12h3M15 12h3"/>',
    cards:'<rect x="4" y="4" width="15" height="16" rx="3"/><path d="M8 8h7M8 12h5M21 8v10"/>',
    chart:'<path d="M4 4v16h16M8 15v-3M13 15V8M18 15V5"/>',
    settings:'<path d="m9 3-.7 2-2 .9-2-.5-1.5 2.6 1.5 1.6v2.8L2.8 14l1.5 2.6 2-.5 2 .9.7 2h3l.7-2 2-.9 2 .5 1.5-2.6-1.5-1.6V9.6l1.5-1.6-1.5-2.6-2 .5-2-.9L12 3H9Z" transform="translate(1 1)"/><circle cx="11.5" cy="11.5" r="3"/>',
    sound:'<path d="m11 5-5 4H3v6h3l5 4V5ZM15 8c2 2 2 6 0 8M18 5c4 4 4 10 0 14"/>',
    star:'<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9L12 3Z"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    arrow:'<path d="m9 5 7 7-7 7"/>',
    check:'<path d="m5 12 4.5 4.5L19 7"/>',
    again:'<path d="M5 9a7 7 0 1 1 0 7M5 4v5h5"/>',
    hard:'<path d="M3 8c3-4 6 4 9 0s6 4 9 0M3 16c3-4 6 4 9 0s6 4 9 0"/>',
    undo:'<path d="m8 4-5 5 5 5M3 9h10a6 6 0 0 1 0 12"/>',
    focus:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    leaf:'<path d="M19 3c-8 0-14 4-14 10 0 4 4 7 8 5 5-2 6-8 6-15ZM5 21 15 8"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    export:'<path d="M5 14v6h14v-6M12 16V3m-4 4 4-4 4 4"/>',
    import:'<path d="M5 14v6h14v-6M12 3v13m-4-4 4 4 4-4"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
    down:'<path d="m7 10 5 5 5-5"/>',
  };
  const icon = (name, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" aria-hidden="true">${shapes[name] || shapes.book}</svg>`;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const round = (act, name, label, cls = '') => `<button type="button" class="round ${cls}" data-action="${act}" aria-label="${esc(label)}" title="${esc(label)}">${icon(name)}</button>`;
  const dateText = () => new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'short'}).format(new Date());
  const stats = () => {
    const second=Math.floor(Date.now()/1000);
    if(!statsCache || statsCache.state!==state || statsCache.words!==words || statsCache.second!==second)
      statsCache={state,words,second,value:E().summary(state,words,new Date())};
    return statsCache.value;
  };
  function activateSavedBook() {
    words=dictionaries[libraryState.activeWordbook];
    wordMap=wordMaps[libraryState.activeWordbook];
    state=libraryState.books[libraryState.activeWordbook];
  }

  function notify(text) {
    clearTimeout(toastTimer); const t = $('#toast'); t.textContent = text; t.classList.add('show');
    toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
  }
  window.onNativeMessage = notify;
  window.onNativeVoiceFallback = () => {
    const status=$('#voice-preview-status');if(status)status.textContent='这段词音暂时不可用，已尝试手机离线英语语音。';
  };
  window.onNativeExport = success => notify(success ? '文件已保存' : '未保存文件，学习记录仍在手机中');
  window.onNativeImport = text => {if(dictionariesReady)receiveImport(text);else queuedImport=text;};
  window.onNativeBack = () => window.handleBack();
  const updateStates = new Set(['idle','checking','current','downloading','verifying','awaiting-permission','awaiting-confirmation','installing','failed','disabled','unconfigured','cancelled']);
  window.onNativeUpdateStatus = value => {
    try {
      const data=typeof value==='string'?JSON.parse(value):value;
      if(!data || typeof data!=='object' || !updateStates.has(data.state))return;
      updateStatus={state:data.state,message:String(data.message||'').slice(0,240),versionName:String(data.versionName||'').slice(0,32),progress:Number.isFinite(data.progress)?Math.max(0,Math.min(100,Math.round(data.progress))):null};
      if(modalType==='version')renderUpdateStatus();
    }catch(_){/* A malformed supplementary update event cannot affect learning records. */}
  };
  function renderUpdateStatus() {
    const target=$('#update-status');if(!target)return;
    target.textContent=updateStatus.message||'可以检查是否有新版';
    const progress=$('#update-progress');
    if(progress){progress.hidden=updateStatus.progress===null||updateStatus.state!=='downloading';if(!progress.hidden)progress.value=updateStatus.progress;}
    const resume=$('#resume-update');if(resume)resume.hidden=!['awaiting-permission','awaiting-confirmation'].includes(updateStatus.state);
    const check=$('#check-update');if(check)check.disabled=['checking','downloading','verifying','awaiting-permission','awaiting-confirmation','installing'].includes(updateStatus.state);
  }
  function showVersion() {
    try {const status=native()?.getUpdateStatus?.();if(status)window.onNativeUpdateStatus(status);}catch(_){}
    const connected=Boolean(native()?.getUpdateStatus);
    openModal('版本与更新',`<p class="small">背单词 ${APP_VERSION}<br>四级与六级学习记录保存在手机中</p><p class="note">${connected?'更新来自小站官网。自动更新开启时，启动或回到应用会检查已发布的新版本。':'浏览器预览不安装应用；Android 安装版可检查官网更新。'}</p><p id="update-status" class="small" role="status" aria-live="polite"></p><progress id="update-progress" max="100" value="0" aria-label="新版下载进度" hidden></progress><button id="check-update" class="secondary" data-action="check-update">检查更新</button><button id="resume-update" class="outline" data-action="resume-update" hidden>继续系统安装</button>`,'version');
    renderUpdateStatus();
  }

  function applyTheme() {
    const selected = state?.settings.theme || 'system';
    const actual = selected === 'system' ? (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') : selected;
    document.body.dataset.theme = actual;
    $('meta[name="theme-color"]').content = actual === 'dark' ? '#151517' : '#ffffff';
    try { native()?.setTheme?.(actual); } catch (_) { /* System theme is supplementary to local UI. */ }
  }
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => {if(state) applyTheme();});

  function readSaved() {
    const bridge = native();
    if (bridge && typeof bridge.readState === 'function') {
      const text = bridge.readState();
      if (text === '__READ_ERROR__') throw new Error('无法读取手机中的学习记录');
      if(!text) return E().createLibraryState();
      try {return E().normalizeLibraryState(JSON.parse(text), idsByBook);}
      catch(error) {
        const fallback=bridge.readBackupState?.();
        if(fallback) {
          const restored=E().normalizeLibraryState(JSON.parse(fallback),idsByBook);
          setTimeout(()=>notify('已从本地备份恢复学习记录'),600);
          return restored;
        }
        throw error;
      }
    }
    const primary = localStorage.getItem(STORE), fallback = localStorage.getItem(STORE + '.backup');
    if (!primary && !fallback) return E().createLibraryState();
    try { if(primary) return E().normalizeLibraryState(JSON.parse(primary), idsByBook); } catch (_) {}
    if(fallback) {const old = E().normalizeLibraryState(JSON.parse(fallback), idsByBook); setTimeout(()=>notify('已从本地备份恢复学习记录'),600); return old;}
    throw new Error('本地学习记录损坏，已停止覆盖原记录');
  }
  function persistLibrary(next) {
    try {
      const text = JSON.stringify(next), bridge = native();
      if (bridge && typeof bridge.writeState === 'function') {
        const result = bridge.writeState(text);
        if (!(result === true || result === 'true')) throw new Error('手机存储写入失败');
      } else {
        const prev = localStorage.getItem(STORE);
        if(prev) localStorage.setItem(STORE + '.backup', prev);
        localStorage.setItem(STORE, text);
      }
      libraryState = next; activateSavedBook(); storageError = false; return true;
    } catch (_) { storageError = true; notify('记录保存失败，本次操作未生效。请先备份记录，再重试。'); return false; }
  }
  function persist(next) {
    try {return persistLibrary(E().setBookState(libraryState,activeBook().id,next,idsByBook[activeBook().id]));}
    catch(_){storageError=true;notify('记录未通过校验，本次操作未生效。请先备份记录。');return false;}
  }

  function nextWord() {
    const next = E().getNext(state,words,new Date(),mode,extraNew,mode==='all');
    if(!next) return null;
    return next.word ? next : {word:next,kind:state.cards[next.id] ? 'review' : 'new'};
  }
  function refreshCurrent() {current = nextWord(); revealed = false; scheduleDue();}
  function scheduleDue() {
    clearTimeout(dueTimer);
    if(!state || document.hidden || current) return;
    dueTimer = setTimeout(()=>{if(page==='study' && !current){refreshCurrent();render();}},15000);
  }
  function speak(word) {
    const bridge = native();
    if (bridge?.speak) {bridge.speak(word,state.settings.accent); return;}
    if ('speechSynthesis' in window) {
      stopSpeech();const generation=browserSpeechGeneration;
      const play=remaining=>{
        if(generation!==browserSpeechGeneration||document.hidden)return;
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = state.settings.accent; utterance.rate = speechSettings.rate; utterance.pitch = 1;
        const chosen = speechSynthesis.getVoices().find(v=>v.lang.toLowerCase()===utterance.lang.toLowerCase());
        if(chosen)utterance.voice=chosen;
        utterance.onend=()=>{if(remaining>0&&generation===browserSpeechGeneration)setTimeout(()=>play(remaining-1),speechSettings.gapMs);};
        utterance.onerror=ev=>{if(ev.error!=='canceled'&&ev.error!=='interrupted')notify('没有可用的英语语音，请在手机语音设置中添加英语语音包');};
        speechSynthesis.speak(utterance);
      };play(speechSettings.repeats-1);
    } else notify('当前环境不支持朗读，安卓安装版可调用手机英语语音');
  }
  function stopSpeech() {browserSpeechGeneration++;try{native()?.stopSpeech?.(); if('speechSynthesis' in window) speechSynthesis.cancel();}catch(_) {}}

  function topbar() {
    return `<header class="topbar"><div class="brand"><div class="brandmark"><img src="icon.svg" alt=""></div><div class="brand-title">背单词</div></div><div class="top-actions"><button class="book-switch" data-action="books" aria-label="切换词书，当前${activeBook().name}" aria-haspopup="dialog">${activeBook().name}${icon('down')}</button>${round('focus','focus','专注背词','plain')}${page==='study'?round('study-options','more','学习选项','plain study-options'):''}</div></header>`;
  }
  function navigation() {
    return `<nav class="nav" aria-label="主导航">${[['study','cards','背词'],['library','book','词库'],['progress','chart','进度'],['settings','settings','设置']].map(([id,glyph,label])=>`<button class="navbutton ${page===id?'active':''}" data-action="nav" data-page="${id}" ${page===id?'aria-current="page"':''}>${icon(glyph)}<span>${label}</span></button>`).join('')}</nav>`;
  }
  function render() {
    if(!state) return;
    applyTheme();
    app.setAttribute('aria-busy','false');
    app.innerHTML = `<div class="shell view-${page} ${focus && page==='study'?'focus':''}">${topbar()}<main id="main">${page==='study'?studyPage():page==='library'?libraryPage():page==='progress'?progressPage():settingsPage()}</main>${navigation()}</div>`;
    setBars();
  }
  function setBars() {
    document.querySelectorAll('.word-card .answer').forEach(answer => {
      const meaning=answer.querySelector('.meaning'), hint=answer.querySelector('.meaning-hint');
      if(hint) hint.hidden = !(meaning.scrollHeight > meaning.clientHeight + 1);
    });
    const s=stats(); const fill=$('.fill'); if(fill) fill.style.width = `${Math.min(100,s.newToday/Math.max(1,s.goal)*100)}%`;
    const maximum=Math.max(1,...(s.week||[]).map(d=>d.total));
    document.querySelectorAll('.day-bar').forEach(el=>{el.style.height=`${Math.max(4,Number(el.dataset.count)/maximum*82)}px`;});
  }
  function studyPage() {
    const s=stats();
    const focusHeader=focus?`<div class="focus-top"><button class="text-button" data-action="focus">${icon('close')}退出专注</button>${round('study-options','more','学习选项','plain study-options')}</div>`:'';
    if(!current)return `${focusHeader}${finishCard(s)}`;
    const w=current.word;
    let preview;
    try{preview=E().preview(state,w.id,new Date());}catch(_){preview={again:{label:'稍后'},hard:{label:'较早复习'},good:{label:'按记忆安排'}};}
    return `${focusHeader}<div class="study-stage"><section class="word-card quiet-word ${revealed?'revealed':''}" aria-label="单词学习卡"><div class="word-center"><h1 class="word ${w.word.length>15?'long':''}" lang="en">${esc(w.word)}</h1><p class="phonetic" lang="en">${esc(w.phonetic?'/'+w.phonetic.replace(/^\/|\/$/g,'')+'/':'')}</p><button class="audio" data-action="audio" aria-label="朗读 ${esc(w.word)}">${icon('sound')}${state.settings.accent==='en-GB'?'英式':'美式'}发音</button></div>${revealed?`<div class="answer"><div class="meaning">${esc(w.meaning)}</div><p class="meaning-hint" hidden>向上滑动，查看完整释义</p></div>`:''}</section></div><div class="actions study-actions">${revealed?`<div class="ratings" aria-label="评估记忆"><button class="grade again" data-action="rate" data-rating="again"><span class="grade-top">忘了</span><span>${esc(preview.again.label)}</span></button><button class="grade hard" data-action="rate" data-rating="hard"><span class="grade-top">模糊</span><span>${esc(preview.hard.label)}</span></button><button class="grade good" data-action="rate" data-rating="good"><span class="grade-top">记住</span><span>${esc(preview.good.label)}</span></button></div>`:'<button class="primary reveal-button" data-action="reveal">查看词义</button>'}</div>`;
  }
  function finishCard(s) {
    const onlyReview=mode==='review';
    const waiting=Object.values(state.cards).filter(c=>new Date(c.due)>new Date()&&(c.state===1||c.state===3)).sort((a,b)=>new Date(a.due)-new Date(b.due));
    const minutes=waiting.length?Math.max(1,Math.ceil((new Date(waiting[0].due)-Date.now())/60000)):0;
    const title=onlyReview?'当前复习已完成':'这里可以歇一会';
    const message=minutes?`${minutes<60?minutes+' 分钟':Math.ceil(minutes/60)+' 小时'}后还有词到期，回来时会接着出现。`:'下一批到期的词会出现在这里。';
    return `<section class="finished quiet-finish"><span class="quiet-check">${icon('check')}</span><h2>${title}</h2><p>${message}</p>${onlyReview?'<button class="primary" data-action="mode" data-mode="all">回到日常背词</button>':''}<button class="text-button" data-action="nav" data-page="progress">查看学习进度 ${icon('arrow')}</button></section>`;
  }
  function showStudyOptions() {
    const s=stats();
    const w=current?.word;
    const saved=w&&state.favorites.includes(w.id);
    openModal('学习选项',`<p class="small muted study-menu-progress">今日新词 ${s.newToday} / ${s.goal} · ${s.due} 词待复习</p><div class="study-menu">${w?`<button class="study-menu-row" data-action="detail" data-id="${esc(w.id)}"><span>${icon('book')}单词详情</span>${icon('arrow')}</button><button class="study-menu-row" data-action="favorite"><span>${icon('star')}${saved?'取消收藏':'收藏这个词'}</span>${saved?icon('check'):icon('arrow')}</button>`:''}<button class="study-menu-row" data-action="undo" ${!undoItem?'disabled':''}><span>${icon('undo')}撤销上一词</span></button></div><p class="settings-label menu-label">学习模式</p><div class="choice-grid study-mode-choices">${[['all','日常背词'],['review','只复习']].map(([value,label])=>`<button class="choice ${mode===value?'active':''}" data-action="mode" data-mode="${value}" aria-pressed="${mode===value}"><strong>${label}</strong></button>`).join('')}</div><button class="text-button menu-help" data-action="help">${icon('clock')}复习与评分说明</button><p class="note">每日目标是进度参考，达到后可继续背词。详情、收藏和撤销都在这里。</p>`,'study-options');
  }
  function filteredWords() {
    const q=query.trim().toLowerCase();
    if(filteredCache && filteredCache.words===words && filteredCache.state===state && filteredCache.q===q && filteredCache.filter===filter) return filteredCache.value;
    const favorites=new Set(state.favorites), difficult=new Set(state.difficult), exact=[], prefix=[], rest=[];
    const index=searchIndexes[activeBook().id];
    for(const w of words) {
      if(filter==='favorite' && !favorites.has(w.id))continue;
      if(filter==='difficult' && !difficult.has(w.id))continue;
      if(filter==='seen' && !state.cards[w.id])continue;
      const searchable=index.get(w.id);
      if(!q || searchable.word.includes(q) || searchable.meaning.includes(q)) {
        if(q && searchable.word===q)exact.push(w);
        else if(q && searchable.word.startsWith(q))prefix.push(w);
        else rest.push(w);
      }
    }
    const value=exact.concat(prefix,rest);
    filteredCache={words,state,q,filter,value};return value;
  }
  function libraryPage() {
    const s=stats();
    return `<div class="pagehead"><div><h1>我的词库</h1><p class="eyebrow">${activeBook().name}词书 · ${words.length.toLocaleString()} 词</p></div></div><div class="searchbox">${icon('search')}<input id="search" type="search" placeholder="搜索单词或中文释义" value="${esc(query)}" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="search" aria-label="搜索单词或中文释义"><button class="clear-search" data-action="clear-search" aria-label="清空搜索" ${query?'':'hidden'}>×</button></div><div class="filters">${[['all','全部',null],['favorite','收藏',s.favorites],['difficult','易忘',s.difficult||0],['seen','已学',s.seen]].map(([id,label,count])=>`<button class="pill ${filter===id?'active':''}" data-action="filter" data-filter="${id}">${label}${count!==null?` <span class="count">${count}</span>`:''}</button>`).join('')}</div><div id="list-results" aria-live="polite" aria-atomic="false">${libraryResults()}</div>`;
  }
  function updateSearchResults() {
    if(page!=='library')return;
    const results=$('#list-results');if(results)results.innerHTML=libraryResults();
    const clear=$('.clear-search');if(clear)clear.hidden=!query;
  }
  function libraryResults() {
    const list=filteredWords();
    if(!list.length) return `<div class="empty">${icon('book')}<h2>${query?'没有找到这个词':filter==='favorite'?'还没有收藏':filter==='difficult'?'暂时没有易忘词':'还没有学习记录'}</h2><p class="small">${query?'换个关键词，试试中文或英文。':filter==='favorite'?'背词时点星标，把想再看的词留下。':filter==='difficult'?'选择“忘了”的词会先留在这里，记牢后移出。':'从首页开始第一张词卡。'}</p></div>`;
    return `<div class="list-meta"><span>${list.length.toLocaleString()} 个词</span><span>点开查看完整释义</span></div><div class="word-list">${list.slice(0,listLimit).map(w=>`<button class="word-row" data-action="detail" data-id="${esc(w.id)}"><div><div class="row-word" lang="en">${esc(w.word)}</div><div class="row-meaning">${esc(w.meaning.replace(/\n/g,' · '))}</div></div><div class="row-indicator">${state.favorites.includes(w.id)?icon('star','star'):''}${icon('arrow')}</div></button>`).join('')}</div>${list.length>listLimit?`<button class="outline load-more" data-action="more">再看 ${Math.min(60,list.length-listLimit)} 个词</button>`:''}`;
  }
  function progressPage() {
    const s=stats();
    return `<div class="pagehead"><div><h1>学习进度</h1></div><div class="streak">已坚持 ${s.streak} 天</div></div><div class="stats-grid"><div class="stat-block"><p class="eyebrow">今天新学</p><p class="stat-value">${s.newToday}<small>/ ${s.goal} 词</small></p><p class="small muted">目标可以随时调整</p></div><div class="stat-block"><p class="eyebrow">今天复习</p><p class="stat-value">${s.reviewsToday}<small>词</small></p><p class="small muted">${s.due} 词现在待复习</p></div><div class="stat-block"><p class="eyebrow">累计接触</p><p class="stat-value">${s.seen}<small>词</small></p><p class="small muted">词书共 ${words.length.toLocaleString()} 词</p></div><div class="stat-block"><p class="eyebrow">易忘词</p><p class="stat-value">${s.difficult||0}<small>词</small></p><button class="text-button" data-action="open-difficult">去巩固 ${icon('arrow')}</button></div></div><section class="panel"><div class="section-title"><h2>最近 7 天</h2><span class="small muted">练习次数</span></div><div class="chart" aria-label="最近七天练习次数">${(s.week||[]).map((d,i)=>`<div class="day-column ${i===6?'today':''}"><span class="day-count">${d.total||'—'}</span><div class="day-bar" data-count="${d.total}"></div><small>${esc(d.label)}</small></div>`).join('')}</div></section><p class="note">“接触过”不等于“完全掌握”。按真实记忆选择按钮，让复习时间更适合你。</p>`;
  }
  const row = (title,caption,action,tail='') => `<button class="setting-row setting-button" data-action="${action}"><div><div class="setting-label">${title}</div>${caption?`<p class="setting-caption">${caption}</p>`:''}</div>${tail||icon('arrow')}</button>`;
  const switchRow = (title,caption,key) => `<div class="setting-row"><div><div class="setting-label">${title}</div><p class="setting-caption">${caption}</p></div><button class="toggle ${state.settings[key]?'on':''}" data-action="toggle" data-key="${key}" role="switch" aria-checked="${!!state.settings[key]}" aria-label="${title}"></button></div>`;
  function settingsPage() {
    const themes={system:'跟随系统',light:'浅色',dark:'深色'};
    return `<div class="pagehead"><div><h1>设置</h1></div></div><p class="settings-label">学习偏好</p><div class="settings-group">${row('每日新词',activeBook().name+'日常目标，到期复习优先','goal',`<span class="setting-value">${state.settings.dailyGoal} 词 / 天</span>`)}${row('口音与音色','英式或美式，六种独立声线可试听','accent',`<span class="setting-value">${selectedVoice().name}</span>`)}${row('语速与重复','慢速、舒缓、正常，设置朗读次数与停顿','speech',`<span class="setting-value">${speedName()} · ${speechSettings.repeats} 次</span>`)}${switchRow('自动朗读','翻开下一词时播放发音','autoSpeak')}${row('外观','浅色、深色或跟随系统','theme',`<span class="setting-value">${themes[state.settings.theme]}</span>`)}</div><p class="settings-label">学习记录</p><div class="settings-group">${row('导出备份','保存四级与六级的全部学习记录','export',icon('export'))}${row('恢复备份','预览后确认，保留当前记录的导出入口','import',icon('import'))}</div><p class="settings-label">帮助与反馈</p><div class="settings-group">${row('反馈与建议','主动发送，离线保留并重试','feedback',icon('mail'))}${row('记忆方法与复习','先回忆，再按记忆情况安排跨日复习','help')}${row('版本与更新',APP_VERSION+' · 官网更新','version')}${switchRow('自动检查更新','启动或回到应用时检查，可随时关闭','autoUpdate')}${switchRow('本地故障记录','只保留错误类型，最多 30 条，不上传','diagnosticsEnabled')}${row('词库来源与许可','ECDICT 四级与六级词集 · 开源许可','credits')}</div><p class="footnote">不登录 · 学习记录保存在本机<br>卸载应用前，建议先导出备份</p>`;
  }

  function openModal(title,html,type) {
    const sameModal=modalType===type;
    const priorScroll=sameModal?modalRoot.querySelector('.modal-content')?.scrollTop||0:0;
    const priorFocus=sameModal&&document.activeElement?.dataset?{...document.activeElement.dataset}:null;
    if(!modalType){modalOpener=document.activeElement;modalReturnTarget=modalOpener?.dataset?{...modalOpener.dataset}:null;}
    modalType=type;
    modalRoot.innerHTML=`<div class="modal-shade ${sameModal?'steady':''}" data-action="dismiss"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-handle"></div><div class="modal-header"><h2>${title}</h2>${round('close','close','关闭','plain')}</div><div class="modal-content">${html}</div></section></div>`;
    document.body.classList.add('modal-open');
    const preserved=priorFocus?.action?Array.from(modalRoot.querySelectorAll('[data-action]')).find(el=>Object.entries(priorFocus).every(([key,value])=>el.dataset[key]===value)):null;
    const first=preserved||modalRoot.querySelector('input,textarea,button');if(first) first.focus({preventScroll:true});
    if(sameModal)modalRoot.querySelector('.modal-content').scrollTop=priorScroll;
    app.setAttribute('inert','');app.setAttribute('aria-hidden','true');
  }
  function closeModal() {
    if(modalType==='import')pendingImport=null;
    modalRoot.innerHTML='';document.body.classList.remove('modal-open');app.removeAttribute('inert');app.removeAttribute('aria-hidden');
    modalType=null;detailId=null;stopSpeech();
    let returnTo=modalOpener?.isConnected?modalOpener:null;
    if(!returnTo && modalReturnTarget?.action)returnTo=Array.from(app.querySelectorAll('[data-action]')).find(el=>Object.entries(modalReturnTarget).every(([key,value])=>el.dataset[key]===value));
    if(returnTo)returnTo.focus({preventScroll:true});
    modalOpener=null;modalReturnTarget=null;
  }
  function showBooks() {
    openModal('选择词书',`<div class="book-choices">${BOOKS.map(b=>{
      const s=E().summary(libraryState.books[b.id],dictionaries[b.id],new Date());
      const selected=b.id===activeBook().id;
      return `<button class="book-choice ${selected?'active':''}" data-action="select-book" data-book="${b.id}" aria-pressed="${selected}"><span class="book-code">${b.code}</span><span class="book-info"><strong>${b.name}词书</strong><small>${dictionaries[b.id].length.toLocaleString()} 词 · 已学 ${s.seen} 词</small></span>${selected?icon('check'):icon('arrow')}</button>`;
    }).join('')}</div><p class="note">两套词书分别记录学习进度与每日目标。切换后继续背，原来的记录会保留。</p>`,'books');
  }
  function switchBook(id) {
    if(!BOOKS.some(b=>b.id===id))return;
    if(id===activeBook().id){closeModal();return;}
    const next=E().selectWordbook(libraryState,id);
    if(!persistLibrary(next))return;
    stopSpeech();undoItem=null;extraNew=0;mode='all';query='';filter='all';listLimit=60;
    closeModal();refreshCurrent();render();window.scrollTo(0,0);notify('已切换到'+activeBook().name+'词书');
    if(page==='study'&&state.settings.autoSpeak&&current)speak(current.word.word);
  }
  function showDetail(id) {
    const w=wordMap.get(id);if(!w) return;
    detailId=id;
    const saved=state.favorites.includes(id);
    openModal('单词详情',`<div class="word-center"><h2 class="word ${w.word.length>15?'long':''}" lang="en">${esc(w.word)}</h2><p class="phonetic" lang="en">${esc(w.phonetic?'/'+w.phonetic+'/':'')}</p><button class="audio" data-action="detail-audio" data-id="${esc(id)}">${icon('sound')}播放发音</button></div><div class="meaning">${esc(w.meaning)}</div>${w.forms?`<div class="forms">${esc(formatForms(w.forms))}</div>`:''}<button class="secondary" data-action="detail-favorite" data-id="${esc(id)}">${icon('star')}${saved?'已收藏 · 点此取消':'收藏这个词'}</button>${state.cards[id]?`<p class="small muted">下次复习：${new Date(state.cards[id].due).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>`:'<p class="small muted">还未开始学习</p>'}`,'detail');
  }
  function formatForms(raw) {
    const names={p:'过去式',d:'过去分词',i:'现在分词',3:'第三人称单数',s:'复数',r:'比较级',t:'最高级',0:'原形',1:'原形'};
    return raw.split('/').map(part=>{const index=part.indexOf(':'); if(index<0)return part;const tag=part.slice(0,index);return (names[tag]||'相关词形')+'：'+part.slice(index+1).replace(/,/g,' / ');}).join('\n');
  }
  function showChoices(which) {
    if(which==='goal') openModal('每天新学多少词？','<p class="small muted">复习优先，新词目标随时可改。建议从 20 词开始。</p><div class="choice-grid">'+[10,20,30,50].map(n=>`<button class="choice ${state.settings.dailyGoal===n?'active':''}" data-action="set-goal" data-value="${n}"><strong>${n} 词</strong><small>${n===10?'轻松起步':n===20?'日常积累':n===30?'多学一点':'集中学习'}</small></button>`).join('')+'</div>','goal');
    if(which==='accent') showVoices();
    if(which==='speech') showSpeech();
    if(which==='theme') openModal('选择外观','<div class="choice-grid">'+[['system','跟随系统'],['light','浅色'],['dark','深色']].map(([v,l])=>`<button class="choice ${state.settings.theme===v?'active':''}" data-action="set-theme" data-value="${v}"><strong>${l}</strong></button>`).join('')+'</div>','theme');
  }
  function showVoices() {
    const chosen=selectedVoice().key, accent=state.settings.accent;
    openModal('口音与音色',`<p class="small muted">选择口音，再试听喜欢的声音。</p><div class="speech-options accent-options" role="group" aria-label="口音">${[['en-US','美式'],['en-GB','英式']].map(([key,label])=>`<button class="speech-option ${accent===key?'active':''}" data-action="set-accent" data-value="${key}" aria-pressed="${accent===key}">${label}</button>`).join('')}</div><div class="voice-grid">${VOICES.filter(v=>v.accent===accent).map(v=>`<section class="voice-choice ${chosen===v.key?'active':''}"><button class="voice-select" data-action="set-voice" data-value="${v.key}" aria-pressed="${chosen===v.key}"><span class="voice-label"><strong>${v.name}</strong><small>${v.detail}</small></span><span class="voice-selected" aria-hidden="true">${chosen===v.key?icon('check'):''}</span></button><button class="voice-preview" data-action="preview-voice" data-value="${v.key}" aria-label="试听${v.name}">${icon('sound')}试听</button></section>`).join('')}</div><p id="voice-preview-status" class="small muted voice-status" role="status" aria-live="polite"></p><p class="note voice-note">试听只播放一次，使用当前语速。常用词可离线播放，其余词音首次联网后缓存；无法取得词音时使用手机离线英语语音。${native()?'':'浏览器预览的六种声线需在 Android 安装版中试听。'}</p>`,'accent');
  }
  function chooseVoice(key) {
    const voice=VOICES.find(v=>v.key===key && v.accent===state.settings.accent);if(!voice)return;
    let saved=false;
    try {
      if(native()) {const result=native().setVoiceKey?.(key);saved=result===true||result==='true';}
      else {localStorage.setItem('qingci.voice-key.'+voice.accent,key);saved=true;}
    }catch(_){}
    if(!saved){notify('声音设置未保存，请重试');return;}
    voiceKeys[voice.accent]=key;stopSpeech();render();showVoices();
  }
  function chooseAccent(accent) {
    if(!['en-US','en-GB'].includes(accent))return;
    const next=clone(state);next.settings.accent=accent;
    if(persist(next)){stopSpeech();render();showVoices();}
  }
  function showSpeech() {
    const options=(key,choices)=>`<div class="speech-options" role="group" aria-label="${key==='rate'?'语速':key==='repeats'?'朗读次数':'两次间隔'}">${choices.map(([value,label])=>`<button class="speech-option ${Math.abs(speechSettings[key]-value)<.01?'active':''}" data-action="set-speech" data-key="${key}" data-value="${value}" aria-pressed="${Math.abs(speechSettings[key]-value)<.01}">${label}</button>`).join('')}</div>`;
    openModal('语速与重复',`<h3 class="speech-heading">语速</h3>${options('rate',SPEEDS.map(v=>[v.rate,v.name]))}<p class="small muted">放慢自然词音时保持原音高。</p><h3 class="speech-heading">朗读次数</h3>${options('repeats',[[1,'1 次'],[2,'2 次'],[3,'3 次']])}<h3 class="speech-heading">两次朗读之间停顿</h3>${options('gapMs',[[500,'0.5 秒'],[1200,'1.2 秒'],[2000,'2 秒'],[3000,'3 秒']])}<button class="secondary speech-preview-button" data-action="preview-sequence">${icon('sound')}试听当前设置</button><p id="voice-preview-status" class="small muted voice-status" role="status" aria-live="polite"></p><p class="note">切换单词、关闭设置或离开应用会停止朗读。每次调整立即保存。</p>`,'speech');
  }
  function changeSpeech(key,value) {
    const allowed={rate:[.65,.8,1],repeats:[1,2,3],gapMs:[500,1200,2000,3000]};
    if(!allowed[key]?.includes(value))return;
    const next={...speechSettings,[key]:value};let saved=false;
    try {
      if(native()){const result=native().setSpeechSettings?.(next.rate,next.repeats,next.gapMs);saved=result===true||result==='true';}
      else{localStorage.setItem(SPEECH_STORE,JSON.stringify(next));saved=true;}
    }catch(_){}
    if(!saved){notify('播放设置未保存，请重试');return;}
    speechSettings=next;stopSpeech();render();showSpeech();
  }
  function previewVoice(key) {
    const voice=VOICES.find(v=>v.key===key);if(!voice)return;
    try {
      if(typeof native()?.previewVoice!=='function'){notify('这些声线可在 Android 安装版中试听');return;}
      stopSpeech();
      const result=native().previewVoice(key);
      if(result===false||result==='false'){notify('试听暂不可用，请重试');return;}
      const status=$('#voice-preview-status');if(status)status.textContent='试听 '+voice.name+'：state';
    }catch(_){notify('试听暂不可用，请重试');}
  }
  function changeSetting(key,value) {
    const next=clone(state);next.settings[key]=value;
    if(persist(next)) {
      try {if(key==='diagnosticsEnabled') native()?.setDiagnosticsEnabled?.(value);if(key==='autoUpdate') native()?.setAutoUpdate?.(value);}catch(_){notify('偏好已保存，系统功能将在下次打开时应用');}
      if(key==='dailyGoal') {extraNew=0;refreshCurrent();}
      closeModal();render();
    }
  }
  function exportFile(text,name='背单词-学习备份.json') {
    if(native()?.exportData) {native().exportData(text);return;}
    const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);notify('备份已生成，请查看下载文件');
  }
  function backup() {if(!state){notify('当前记录无法解析，先保留应用，再选择完整备份恢复');return;}exportFile(JSON.stringify(E().makeLibraryBackup(libraryState,new Date()),null,2));}
  let pendingImport=null;
  function receiveImport(text) {
    try {
      if(typeof text!=='string'||text.length>E().constants.MAX_BACKUP_BYTES) throw new Error('备份文件过大');
      let incoming=E().parseLibraryBackup(text,idsByBook);
      const legacy=JSON.parse(text).format===1;
      if(legacy && libraryState)incoming=E().setBookState(libraryState,BOOKS[0].id,incoming.books[BOOKS[0].id],idsByBook[BOOKS[0].id]);
      pendingImport=incoming;
      const counts=BOOKS.map(b=>{const s=E().summary(incoming.books[b.id],dictionaries[b.id],new Date());return `${b.name}：已学 ${s.seen} 词，收藏 ${s.favorites} 词`;}).join('<br>');
      openModal('确认恢复学习记录',`<p class="warning-note">${counts}<br>${legacy?'这是旧版四级备份，已有六级记录会保留。<br>':''}恢复会替换当前${legacy?'四级':'两套词书'}的学习记录。${state?'先导出当前记录，可以随时恢复。':'当前原记录无法解析，请确认选中了自己的完整备份。'}</p>${state?`<button class="outline" data-action="export">${icon('export')}先备份当前记录</button>`:''}<button class="primary" data-action="confirm-import">恢复这份备份</button><button class="text-button" data-action="close">取消，保留当前记录</button>`,'import');
    } catch(err) {pendingImport=null;notify('无法恢复：'+(err.message||'备份格式不正确')+'。当前记录保持完整。');}
  }
  function showFeedback() {
    readFeedbackStatuses();
    openModal('反馈与建议',`<p class="small muted">点击发送后，只上传这条反馈的文字、提交时间和应用版本。学习记录留在手机。离线时保留，联网后重试。</p><textarea id="feedback-text" placeholder="哪里不顺手，或希望加什么功能？\n请避免填写私人信息。" maxlength="2000" aria-label="反馈内容">${esc(feedbackDraft)}</textarea><button class="primary" data-action="send-feedback">发送反馈</button><button class="text-button feedback-save" data-action="save-feedback">仅保存到本机</button><p id="feedback-notice" class="small muted" role="status" aria-live="polite"></p><section id="feedback-history" class="section">${feedbackHistory()}</section>`,'feedback');
  }
  function feedbackStatusText(item) {
    const s=feedbackStatuses.get(item.id);
    if(!s)return '本地已保存，未发送';
    return ({queued:'已加入队列，等待送达',sending:'正在发送',accepted:'已送达',duplicate:'已送达',retryable_failed:'尚未送达，将自动重试',permanent_failed:'发送未成功，可重试'})[s.state];
  }
  function feedbackHistory() {
    const items=state.feedback||[];
    return items.length?`<h3>我的反馈 · ${items.length}</h3>${items.slice().reverse().map(i=>{
      const s=feedbackStatuses.get(i.id),finished=s&&['accepted','duplicate'].includes(s.state),busy=s&&['queued','sending'].includes(s.state);
      const action=s&&['retryable_failed','permanent_failed'].includes(s.state)?'retry-feedback':'send-saved-feedback';
      return `<div class="feedback-item" data-feedback-id="${esc(i.id)}"><p class="feedback-body">${esc(i.text)}</p><p class="feedback-meta" role="status">${new Date(i.createdAt).toLocaleDateString('zh-CN')} · ${feedbackStatusText(i)}</p><button class="text-button feedback-retry" data-action="${action}" data-id="${esc(i.id)}" ${finished||busy?'hidden':''}>${action==='retry-feedback'?'重试发送':'发送这条'}</button></div>`;
    }).join('')}`:'';
  }
  function applyFeedbackStatus(id,status) {
    if(!feedbackIdPattern.test(id)||!status||typeof status!=='object'||!feedbackStates.has(status.state))return;
    feedbackStatuses.set(id,{state:status.state});
  }
  function readFeedbackStatuses() {
    try {
      const text=native()?.getFeedbackStatuses?.();
      if(typeof text!=='string'||text.length>65536)return;
      const values=JSON.parse(text);if(!values||Array.isArray(values)||typeof values!=='object')return;
      for(const [id,s] of Object.entries(values))applyFeedbackStatus(id,s);
    }catch(_){}
  }
  function updateFeedbackStatusUI() {
    if(modalType!=='feedback')return;
    for(const row of modalRoot.querySelectorAll('[data-feedback-id]')){
      const item=state.feedback.find(i=>i.id===row.dataset.feedbackId);if(!item)continue;
      const s=feedbackStatuses.get(item.id),meta=row.querySelector('.feedback-meta'),button=row.querySelector('.feedback-retry');
      if(meta)meta.textContent=new Date(item.createdAt).toLocaleDateString('zh-CN')+' · '+feedbackStatusText(item);
      if(button){button.hidden=!!s&&['queued','sending','accepted','duplicate'].includes(s.state);button.dataset.action=s&&['retryable_failed','permanent_failed'].includes(s.state)?'retry-feedback':'send-saved-feedback';button.textContent=button.dataset.action==='retry-feedback'?'重试发送':'发送这条';}
    }
  }
  window.onNativeFeedbackStatus = value => {
    try {if(typeof value==='string'){if(value.length>16384)return;value=JSON.parse(value);}if(!value||typeof value!=='object')return;applyFeedbackStatus(value.id,value);updateFeedbackStatusUI();}catch(_){}
  };
  function feedbackNotice(text) {const el=$('#feedback-notice');if(el)el.textContent=text;}
  function newFeedbackId() {
    const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
    return 'qf_'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  }
  function sendFeedbackItem(item) {
    if(!native()?.submitFeedback){feedbackNotice('已保存在本机。请在 Android 安装版中发送。');return;}
    let outgoing=item;
    if(!feedbackIdPattern.test(item.id)||item.version!==APP_VERSION){
      const next=clone(state);outgoing={...item,id:newFeedbackId(),version:APP_VERSION};
      next.feedback[next.feedback.findIndex(i=>i.id===item.id)]=outgoing;
      if(!persist(next)){feedbackNotice('本地保存失败，尚未发送。');return;}
      const history=$('#feedback-history');if(history)history.innerHTML=feedbackHistory();
    }
    const payload={schema:'qingci-feedback/v1',packageName:'com.qingci.cet4',id:outgoing.id,text:outgoing.text,createdAt:outgoing.createdAt,version:outgoing.version};
    try {
      if(native().submitFeedback(JSON.stringify(payload))!==true){feedbackNotice('反馈仍在本机，未进入发送队列。可以稍后重试。');return;}
      if(!feedbackStatuses.has(outgoing.id))applyFeedbackStatus(outgoing.id,{state:'queued'});
      readFeedbackStatuses();feedbackNotice('已保存并加入发送队列，可在下方查看送达状态。');
    }catch(_){feedbackNotice('反馈仍在本机，暂时无法发送。');}
    const history=$('#feedback-history');if(history)history.innerHTML=feedbackHistory();
  }
  function saveFeedback(send) {
    const text=$('#feedback-text')?.value.trim();if(!text){feedbackNotice('先写一句反馈。');return;}
    if(Array.from(text).length>2000||new TextEncoder().encode(text).length>12288||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(text)){feedbackNotice('反馈最多 2,000 字，请移除无法显示的控制字符。');return;}
    if(state.feedback.length>=20){feedbackNotice('本地已保存 20 条，请暂时保留这段内容。');return;}
    const next=clone(state),item={id:newFeedbackId(),text,createdAt:new Date().toISOString(),version:APP_VERSION,status:'local'};
    next.feedback.push(item);
    if(!persist(next)){feedbackNotice('本地保存失败，尚未发送。内容仍保留在输入框。');return;}
    feedbackDraft='';const input=$('#feedback-text');if(input)input.value='';
    const history=$('#feedback-history');if(history)history.innerHTML=feedbackHistory();
    if(send)sendFeedbackItem(item);else feedbackNotice('已保存到本机，尚未发送。');
  }
  function help() {
    openModal('按真实记忆选择',`<p class="small">先想意思，再看答案：</p><div class="feedback-item"><strong>忘了</strong><p class="small muted">没有想起或想错了。词会较快回来，并加入易忘词。</p></div><div class="feedback-item"><strong>模糊</strong><p class="small muted">想对了，但费劲或不确定。比“记住”更早复习。</p></div><div class="feedback-item"><strong>记住</strong><p class="small muted">能正确想起。按学习历史安排下次复习。</p></div><p class="note">复习由离线 FSRS 引擎安排，到期复习优先。每日目标只作新词进度参考，达到后可继续背词；没有额外打卡或积分要求。</p>`,'help');
  }

  function rate(rating) {
    if(!current || !revealed) return;
    const previous={state:clone(state),current:clone(current),mode,extraNew};
    try {
      const next=E().rate(state,current.word.id,rating,new Date());
      const item=E().getNext(next,words,new Date(),mode,extraNew,mode==='all');
      next.session.lastId=item?.word?.id || item?.id || null;
      if(!persist(next)) return;
      undoItem=previous;stopSpeech();current=item?.word?item:item?{word:item,kind:next.cards[item.id]?'review':'new'}:null;revealed=false;
      render();scheduleDue();
      if(state.settings.autoSpeak && current) speak(current.word.word);
    }catch(err){notify('复习安排未保存，请重试。');collectError('schedule_failure');}
  }
  function collectError(code) {
    if(!state?.settings.diagnosticsEnabled) return;
    try {native()?.recordDiagnostic?.(code);}catch(_) {}
  }
  function navigate(to) {
    if(!['study','library','progress','settings'].includes(to))return;
    stopSpeech();closeModal();page=to;if(to==='study'&&!current)refreshCurrent();render();window.scrollTo(0,0);
  }
  function handleAction(button,event) {
    const act=button.dataset.action;
    if(act==='dismiss'){if(event.target===button)closeModal();return;}
    if(act==='close'){closeModal();return;}
    if(act==='nav'){navigate(button.dataset.page);return;}
    if(act==='books'){showBooks();return;}
    if(act==='select-book'){switchBook(button.dataset.book);return;}
    if(act==='focus'){if(page!=='study'){navigate('study');focus=true;}else focus=!focus;render();return;}
    if(act==='study-options'){showStudyOptions();return;}
    if(act==='mode'){closeModal();mode=button.dataset.mode;extraNew=0;refreshCurrent();render();return;}
    if(act==='reveal'){revealed=true;render();return;}
    if(act==='audio'){if(current)speak(current.word.word);return;}
    if(act==='rate'){rate(button.dataset.rating);return;}
    if(act==='favorite'){if(current && persist(E().toggleFavorite(state,current.word.id))){closeModal();render();}return;}
    if(act==='undo'){
      if(!undoItem)return;
      const restored=clone(undoItem.state);
      // Undo the rating transaction while preserving independent later choices.
      restored.favorites=clone(state.favorites);
      restored.settings=clone(state.settings);
      restored.feedback=clone(state.feedback);
      if(persist(restored)){closeModal();current=undoItem.current;mode=undoItem.mode;extraNew=undoItem.extraNew;revealed=true;undoItem=null;render();notify('已撤销上一词的学习记录');}
      return;
    }
    if(act==='extra'){extraNew+=10;refreshCurrent();render();return;}
    if(act==='detail'){showDetail(button.dataset.id);return;}
    if(act==='detail-audio'){const w=wordMap.get(button.dataset.id);if(w)speak(w.word);return;}
    if(act==='detail-favorite'){if(persist(E().toggleFavorite(state,button.dataset.id))){const id=button.dataset.id;render();showDetail(id);}return;}
    if(act==='filter'){filter=button.dataset.filter;listLimit=60;render();return;}
    if(act==='more'){listLimit+=60;$('#list-results').innerHTML=libraryResults();return;}
    if(act==='clear-search'){clearTimeout(searchTimer);query='';listLimit=60;$('#search').value='';updateSearchResults();$('#search').focus();return;}
    if(act==='open-difficult'){filter='difficult';query='';navigate('library');return;}
    if(['goal','accent','speech','theme'].includes(act)){showChoices(act);return;}
    if(act==='set-goal'){changeSetting('dailyGoal',Number(button.dataset.value));return;}
    if(act==='set-voice'){chooseVoice(button.dataset.value);return;}
    if(act==='set-accent'){chooseAccent(button.dataset.value);return;}
    if(act==='set-speech'){changeSpeech(button.dataset.key,Number(button.dataset.value));return;}
    if(act==='preview-sequence'){stopSpeech();speak('state');const status=$('#voice-preview-status');if(status)status.textContent='正在试听 '+speedName()+' · '+speechSettings.repeats+' 次';return;}
    if(act==='preview-voice'){previewVoice(button.dataset.value);return;}
    if(act==='set-theme'){changeSetting('theme',button.dataset.value);return;}
    if(act==='toggle'){const key=button.dataset.key;if(['autoSpeak','autoUpdate','diagnosticsEnabled'].includes(key))changeSetting(key,!state.settings[key]);return;}
    if(act==='export'){backup();return;}
    if(act==='import'){closeModal();if(native()?.importData)native().importData();else $('#import-file').click();return;}
    if(act==='confirm-import'){if(pendingImport && persistLibrary(pendingImport)){pendingImport=null;undoItem=null;extraNew=0;query='';filter='all';listLimit=60;mode='all';closeModal();refreshCurrent();render();notify('学习记录已恢复');}return;}
    if(act==='help'){help();return;}
    if(act==='feedback'){showFeedback();return;}
    if(act==='save-feedback'||act==='send-feedback'){saveFeedback(act==='send-feedback');return;}
    if(act==='send-saved-feedback'){const item=state.feedback.find(i=>i.id===button.dataset.id);if(item)sendFeedbackItem(item);return;}
    if(act==='retry-feedback'){try{if(native()?.retryFeedback?.(button.dataset.id)===true){applyFeedbackStatus(button.dataset.id,{state:'queued'});readFeedbackStatuses();updateFeedbackStatusUI();feedbackNotice('已重新加入发送队列。');}else feedbackNotice('暂时无法重试，反馈仍在本机。');}catch(_){feedbackNotice('暂时无法重试，反馈仍在本机。');}return;}
    if(act==='version'){showVersion();return;}
    if(act==='check-update'){if(native()?.checkUpdate)native().checkUpdate();else notify('请在 Android 安装版中检查更新');return;}
    if(act==='resume-update'){if(native()?.resumeUpdate)native().resumeUpdate();else notify('请在系统安装页面完成必要操作');return;}
    if(act==='credits'){openModal('词库与开源许可',`<p class="small">词库：ECDICT，skywind3000<br>四级词书 ${dictionaries[BOOKS[0].id].length.toLocaleString()} 词；六级词书 ${dictionaries[BOOKS[1].id].length.toLocaleString()} 词。保留中文释义、音标和词形。</p><p class="note">六级词书包含四级基础词与六级标签词，按词条去重。标签词集不代表官方完整考试大纲，也不保证每个词必考。音标来自词库。六种自然合成词音由 Kokoro 生成，未缓存时可回退手机离线英语语音。</p><p class="small">复习引擎：ts-fsrs（MIT）<br>词库许可：ECDICT（MIT）<br>自然合成发音：Kokoro（Apache-2.0 模型）<br>完整版权声明随应用打包保存。</p><button class="outline" data-action="license">查看版权声明</button>`,'credits');return;}
    if(act==='license'){fetch('licenses.txt').then(r=>{if(!r.ok)throw Error('read');return r.text();}).then(t=>openModal('版权声明',`<pre class="small">${esc(t)}</pre>`,'license')).catch(()=>notify('请查看源码包中的完整 LICENSE 文件'));return;}
    if(act==='reload'){location.reload();return;}
    if(act==='raw-export'){try{const text=native()?.readState?.()||localStorage.getItem(STORE);if(text)exportFile(text,'背单词-原记录恢复.json');else notify('没有可导出的记录');}catch(_){notify('无法读取原记录，请先保留应用');}return;}
  }
  document.addEventListener('click',ev=>{const button=ev.target.closest('[data-action]');if(!button||button.disabled)return;handleAction(button,ev);});
  document.addEventListener('input',ev=>{
    if(ev.target.id==='search'){query=ev.target.value;listLimit=60;clearTimeout(searchTimer);searchTimer=setTimeout(updateSearchResults,100);}
    if(ev.target.id==='feedback-text')feedbackDraft=ev.target.value;
  });
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'){if(window.handleBack())ev.preventDefault();}
    if(ev.key==='Tab'&&modalType){
      const controls=Array.from(modalRoot.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(el=>el.getClientRects().length);
      const first=controls[0],last=controls[controls.length-1];
      if(first && ev.shiftKey && (document.activeElement===first || !modalRoot.contains(document.activeElement))){ev.preventDefault();last.focus();}
      else if(first && !ev.shiftKey && (document.activeElement===last || !modalRoot.contains(document.activeElement))){ev.preventDefault();first.focus();}
    }
    if(ev.key==='Enter'&&ev.target.id==='search'){ev.preventDefault();clearTimeout(searchTimer);updateSearchResults();ev.target.blur();}
    if(ev.key===' ' && page==='study'&&!modalType&&!['INPUT','TEXTAREA','BUTTON'].includes(ev.target.tagName)){ev.preventDefault();if(!revealed){revealed=true;render();}}
  });
  $('#import-file').addEventListener('change',async ev=>{const file=ev.target.files[0];if(!file)return;try{if(file.size>E().constants.MAX_BACKUP_BYTES)notify('备份文件过大，未修改记录');else receiveImport(await file.text());}catch(_){notify('文件无法读取，当前记录保持完整。请重新选择备份。');}finally{ev.target.value='';}});
  window.handleBack = () => {if(modalType){closeModal();return true;}if(focus){focus=false;render();return true;}if(page!=='study'){navigate('study');return true;}return false;};
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){stopSpeech();clearTimeout(dueTimer);}
    else if(state){
      applyTheme();
      if(page==='study'&&!modalType){if(!revealed)refreshCurrent();render();}
      else if(page==='progress'&&!modalType)render();
      scheduleDue();
    }
  });
  window.addEventListener('error',()=>collectError('web_error'));
  window.addEventListener('unhandledrejection',()=>collectError('web_rejection'));

  async function boot() {
    try {
      if(!E())throw new Error('学习引擎未载入');
      await Promise.all(BOOKS.map(async b=>{
        const response=await fetch(b.file);if(!response.ok)throw new Error(b.name+'离线词库未载入');
        const entries=await response.json();if(!Array.isArray(entries)||!entries.length)throw new Error(b.name+'离线词库为空');
        dictionaries[b.id]=entries;idsByBook[b.id]=entries.map(w=>w.id);wordMaps[b.id]=new Map(entries.map(w=>[w.id,w]));
        searchIndexes[b.id]=new Map(entries.map(w=>[w.id,{word:w.word.toLowerCase(),meaning:w.meaning.toLowerCase()}]));
      }));
      dictionariesReady=true;
      libraryState=readSaved();activateSavedBook();
      try {native()?.setAutoUpdate?.(state.settings.autoUpdate);native()?.setDiagnosticsEnabled?.(state.settings.diagnosticsEnabled);}catch(_){}
      refreshCurrent();render();
      if(state.settings.autoSpeak&&current)speak(current.word.word);
    }catch(err){loadError=err;app.setAttribute('aria-busy','false');app.innerHTML=`<main class="error-page"><div class="brandmark"><img src="icon.svg" alt=""></div><h1>暂时无法打开词卡</h1><p class="note">${esc(err.message)}。为保护学习记录，应用不会覆盖已有数据。</p><button class="primary" data-action="reload">重新打开</button><button class="outline" data-action="import">选择备份恢复</button>${!native()?'<button class="text-button" data-action="raw-export">导出原记录</button>':''}</main>`;}
    finally{if(dictionariesReady&&queuedImport!==null){const text=queuedImport;queuedImport=null;receiveImport(text);}}
  }
  boot();
  // Local QA accessor: immutable snapshot, no state mutation or device operations.
  window.QingciDebug={snapshot:()=>({state:state?clone(state):null,library:libraryState?clone(libraryState):null,activeWordbook:activeBook().id,current:current?clone(current):null,page,mode,extraNew,revealed,storageError,loadError:loadError?.message})};
})();
