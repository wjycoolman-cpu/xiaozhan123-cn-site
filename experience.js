(() => {
 'use strict';
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const arrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>';
 window.XiaoZhanIntents={'pocket-piano':'音乐 演奏 旋律 钢琴 键盘','subtitle-studio':'创作 剪辑 视频 字幕 翻译','qingci':'学习 英语 词汇 背词 四六级','mianji':'生活 睡眠 作息 休息','question-bank':'学习 考试 练习 复习 刷题','resume-studio':'工作 求职 应聘 简历','yuji':'运动 羽毛球 比赛 计分','stardew-farm':'游戏 种田 农场 自动化','skymyth':'游戏 卡牌 冒险','electric-drive':'游戏 赛车 驾驶'};
 const tasks={
  piano:{product:'pocket-piano',label:'音乐创作',name:'从一个音符开始。',description:'双手演奏、五线谱跟弹、录下自己的旋律。',caption:'轻触琴键，或使用键盘 A S D F G H J K 演奏。'},
  word:{product:'qingci',label:'词汇学习',name:'学会，再记住。',description:'从一个词的意思开始，进入四六级词汇学习与复习。',caption:'选一个释义。答错也没关系，可以再试一次。'},
  subtitle:{product:'subtitle-studio',label:'视频创作',name:'让每一句，被看见。',description:'调整双语字幕、编辑时间轴，再导出自己的作品。',caption:'编辑文字、调整字号，字幕预览会立即变化。'},
  score:{product:'yuji',label:'运动记录',name:'专注每一分。',description:'羽毛球计分、对战日程与赛事同步，让记录更简单。',caption:'点击一方的数字加分，记错了可以撤销。'}
 };
 let task='piano', audio, voices=new Map(), noteTickets=new Map(), melodyTimers=[], sequence=0, wordIndex=0, wordSolved=false, scores=[0,0], scoreHistory=[];
 const panel=$('#live-panel');
 const words=[{word:'curiosity',phonetic:'/ˌkjʊəriˈɒsəti/',options:['好奇心','目的地','耐心','可能性'],correct:0},{word:'possibility',phonetic:'/ˌpɒsəˈbɪləti/',options:['能力','可能性','个性','责任'],correct:1},{word:'create',phonetic:'/kriˈeɪt/',options:['比较','解释','创造','决定'],correct:2}];
 function liveCopy(){const t=tasks[task];return `<aside class="live-copy"><span>${t.label}</span><h3>${t.name}</h3><p>${t.description}</p><button data-experience="${t.product}">打开${t.product==='subtitle-studio'?'字幕工坊':t.product==='qingci'?'背单词':t.product==='yuji'?'羽记':'弹钢琴'} ${arrow}</button></aside>`;}
 function renderTask(next){
  stopAudio(); task=next;sequence++;
  $$('.task-tabs [role=tab]').forEach(b=>{const on=b.dataset.task===task;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
  panel.setAttribute('aria-labelledby',`tab-${task}`);$('#live-description').textContent=tasks[task].caption;
  let widget='';
  if(task==='piano'){
   const white=[[0,'C','A'],[2,'D','S'],[4,'E','D'],[5,'F','F'],[7,'G','G'],[9,'A','H'],[11,'B','J'],[12,'C','K']];
   widget=`<div class="live-widget piano-widget"><div class="widget-top"><span>小站钢琴 · 一个八度</span><button id="melody-play" aria-pressed="false">试听一段</button></div><div class="piano-notes" aria-hidden="true"><span>♪</span><span>♩</span><span>♫</span><span>♩</span><span>♪</span><span>♬</span></div><div class="piano-keys" role="group" aria-label="可弹奏琴键">${white.map(([n,label,key])=>`<button class="piano-key" data-note="${n}" aria-label="演奏 ${label}${n===12?'5':'4'}，快捷键 ${key}" aria-pressed="false">${key}</button>`).join('')}${[1,3,6,8,10].map((n,i)=>`<button class="piano-key black" data-note="${n}" aria-label="演奏 ${['升C','升D','升F','升G','升A'][i]}4" aria-pressed="false"></button>`).join('')}</div><p class="widget-hint" id="piano-status" role="status">声音由你触发。按住琴键，松开即停。</p></div>`;
  }else if(task==='word'){
   const w=words[wordIndex%words.length];wordSolved=false;
   widget=`<div class="live-widget word-widget"><div class="widget-top"><span>词汇小练习</span><button id="word-next">换一个词</button></div><div class="word-face"><h4>${w.word}</h4><p>${w.phonetic}</p><div class="word-choices">${w.options.map((v,i)=>`<button data-word-choice="${i}">${v}</button>`).join('')}</div><p class="word-feedback" id="word-feedback" role="status">这个词的意思是？</p></div></div>`;
  }else if(task==='subtitle'){
   widget='<div class="live-widget subtitle-widget"><div class="widget-top"><span>字幕样式预览</span><button id="subtitle-reset">恢复示例</button></div><div class="subtitle-preview"><span>双语字幕 · 实时预览</span><div id="subtitle-lines" class="subtitle-lines subtitle-size-24"><p id="subtitle-chinese">把日常，变成灵感。</p><p>Find inspiration in the everyday.</p></div></div><div class="subtitle-controls"><label>中文字幕<input id="subtitle-text" maxlength="60" value="把日常，变成灵感。" aria-label="编辑中文字幕"></label><label>字号 <output id="subtitle-size-value">24</output> px<input id="subtitle-size" type="range" min="16" max="32" step="1" value="24" aria-label="调整字幕字号"></label></div></div>';
  }else{
   widget=`<div class="live-widget score-widget"><div class="score-court" aria-hidden="true"></div><div class="widget-top"><span>羽毛球计分 · 本页小体验</span><button id="score-reset">重新开始</button></div><div class="live-score"><div class="score-team"><span>我方</span><button data-score-team="0" aria-label="我方加一分">${scores[0]}</button></div><span>:</span><div class="score-team"><span>对方</span><button data-score-team="1" aria-label="对方加一分">${scores[1]}</button></div></div><button id="score-undo" class="score-undo" ${scoreHistory.length?'':'disabled'}>撤销上一分</button><p class="widget-hint" id="score-status" role="status">点击数字加分，比赛由你掌握。</p></div>`;
  }
  panel.innerHTML=`<div class="live-layout">${widget}${liveCopy()}</div>`;
 }
 async function startNote(n){
  if(task!=='piano'||document.hidden||$('#experience-dialog').open)return;
  endNote(n);const ticket=(noteTickets.get(n)||0)+1;noteTickets.set(n,ticket);
  try{
   audio??=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();
   if(task!=='piano'||$('#experience-dialog').open||document.hidden||noteTickets.get(n)!==ticket)return;
   const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
   osc.type='triangle';osc.frequency.value=261.6256*Math.pow(2,n/12);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.16,now+.014);gain.gain.exponentialRampToValueAtTime(.04,now+1.6);osc.connect(gain);gain.connect(audio.destination);osc.start();voices.set(n,{osc,gain});
   const key=panel.querySelector(`[data-note="${n}"]`);key?.classList.add('is-playing');key?.setAttribute('aria-pressed','true');
   // A lost pointer release must never leave sound playing indefinitely.
   const own=voices.get(n);setTimeout(()=>{if(voices.get(n)===own)endNote(n);},5000);
  }catch{if($('#piano-status'))$('#piano-status').textContent='浏览器未能播放声音，请进入弹钢琴网页版重试。';}
 }
 function endNote(n){noteTickets.set(n,(noteTickets.get(n)||0)+1);const v=voices.get(n);if(v){const now=audio.currentTime;v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(0,now,.025);v.osc.stop(now+.2);voices.delete(n);}const key=panel.querySelector(`[data-note="${n}"]`);key?.classList.remove('is-playing');key?.setAttribute('aria-pressed','false');}
 function stopAudio(){melodyTimers.forEach(clearTimeout);melodyTimers=[];[...noteTickets.keys()].forEach(endNote);const b=$('#melody-play');if(b){b.textContent='试听一段';b.setAttribute('aria-pressed','false');}}
 panel.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-note]');if(!b)return;e.preventDefault();b.focus({preventScroll:true});b.setPointerCapture(e.pointerId);startNote(Number(b.dataset.note));});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])panel.addEventListener(event,e=>{const b=e.target.closest('[data-note]');if(b)endNote(Number(b.dataset.note));});
 const keymap={a:0,s:2,d:4,f:5,g:7,h:9,j:11,k:12};
 document.addEventListener('keydown',e=>{
  if(task!=='piano'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable]')||document.querySelector('dialog[open]'))return;
  const n=keymap[e.key.toLowerCase()];if(n!==undefined){e.preventDefault();startNote(n);}
 });
 document.addEventListener('keyup',e=>{const n=keymap[e.key.toLowerCase()];if(n!==undefined)endNote(n);});
 window.addEventListener('blur',stopAudio);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio();});
 panel.addEventListener('click',e=>{
  const el=e.target.closest('button');if(!el)return;
  if(el.id==='melody-play'){
   if(melodyTimers.length){stopAudio();return;}stopAudio();el.textContent='停止试听';el.setAttribute('aria-pressed','true');
   [0,4,7,12,11,7,4,2,0].forEach((n,i)=>{melodyTimers.push(setTimeout(()=>startNote(n),i*280),setTimeout(()=>endNote(n),i*280+220));});melodyTimers.push(setTimeout(stopAudio,2680));
  }
  if(el.dataset.wordChoice!==undefined){
   if(wordSolved)return;const w=words[wordIndex%words.length],correct=Number(el.dataset.wordChoice)===w.correct;el.classList.add(correct?'correct':'wrong');$('#word-feedback').textContent=correct?`答对了，${w.word} 是“${w.options[w.correct]}”。`:'再想一想，试试另一个释义。';if(correct)wordSolved=true;
  }
  if(el.id==='word-next'){wordIndex++;renderTask('word');$('#word-next').focus({preventScroll:true});}
  if(el.id==='subtitle-reset'){$('#subtitle-text').value='把日常，变成灵感。';$('#subtitle-chinese').textContent=$('#subtitle-text').value;$('#subtitle-size').value='24';$('#subtitle-size-value').value='24';$('#subtitle-lines').className='subtitle-lines subtitle-size-24';}
  if(el.dataset.scoreTeam!==undefined){const n=Number(el.dataset.scoreTeam);scoreHistory.push([...scores]);scores[n]++;updateScore();$('#score-status').textContent=`${n===0?'我方':'对方'}得分，当前 ${scores[0]} 比 ${scores[1]}。`;}
  if(el.id==='score-undo'&&scoreHistory.length){scores=scoreHistory.pop();updateScore();$('#score-status').textContent=`已撤销，当前 ${scores[0]} 比 ${scores[1]}。`;}
  if(el.id==='score-reset'){scores=[0,0];scoreHistory=[];updateScore();$('#score-status').textContent='已重新开始，比分 0 比 0。';}
 });
 function updateScore(){$$('[data-score-team]').forEach(b=>b.textContent=scores[Number(b.dataset.scoreTeam)]);$('#score-undo').disabled=!scoreHistory.length;}
 panel.addEventListener('input',e=>{if(e.target.id==='subtitle-text')$('#subtitle-chinese').textContent=e.target.value||' ';if(e.target.id==='subtitle-size'){$('#subtitle-size-value').value=e.target.value;$('#subtitle-lines').className=`subtitle-lines subtitle-size-${Number(e.target.value)}`;}});
 $$('.task-tabs button').forEach(b=>{b.addEventListener('click',()=>renderTask(b.dataset.task));b.addEventListener('keydown',e=>{const tabs=$$('.task-tabs button');let i=tabs.indexOf(b);if(e.key==='ArrowRight')i=(i+1)%tabs.length;else if(e.key==='ArrowLeft')i=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=tabs.length-1;else return;e.preventDefault();renderTask(tabs[i].dataset.task);tabs[i].focus();});});
 renderTask('piano');
 // Actual product pages are created only after activation, one at a time.
 const dialog=$('#experience-dialog'), host=$('#experience-host'), loading=$('#experience-loading');
 let returnFocus,frame,loadTimer,openTicket=0,activeId;
 function productUrl(p){const value=p.kind==='game'?p.playUrl:p.demoUrl;if(!value)return null;try{const base=location.protocol==='file:'?'https://xiaozhan123.cn/':location.href,u=new URL(value,base);return u.origin===new URL(base).origin&&['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
 function launch(id){
  const p=window.XiaoZhanCatalog?.products.find(p=>p.id===id);if(!p)return;
  const url=productUrl(p);if(!url)return;
  stopAudio();returnFocus=$('#detail-dialog').open?document.querySelector(`.product-card [data-detail="${CSS.escape(id)}"]`):document.activeElement;activeId=id;
  if($('#detail-dialog').open)$('#detail-dialog').close();
  $('#experience-title').textContent=p.name;$('#experience-kind').textContent=p.kind==='game'?'网页游戏':p.demoUrl?.includes('/demo/')?'可操作网页演示':'网页应用';$('#experience-standalone').href=url;
  if(!dialog.open)dialog.showModal();$('#experience-close').focus({preventScroll:true});loadFrame(url,p);
 }
 function loadFrame(url,p){
  const ticket=++openTicket;clearTimeout(loadTimer);host.replaceChildren();loading.hidden=false;loading.querySelector('p').textContent=`正在打开${p.name}…`;loading.querySelector('small').textContent=p.kind==='game'?'首次游戏资源下载较多，请稍候。':'首次加载可能需要一些时间。';
  frame=document.createElement('iframe');frame.title=`${p.name}可操作体验`;frame.setAttribute('allow','autoplay; fullscreen');frame.setAttribute('allowfullscreen','');frame.referrerPolicy='no-referrer';
  frame.addEventListener('load',()=>{if(ticket!==openTicket)return;clearTimeout(loadTimer);loading.hidden=true;$('#experience-kind').textContent=p.kind==='game'?'网页游戏':p.demoUrl?.includes('/demo/')?'可操作网页演示':'网页应用';try{const d=frame.contentDocument;if(!d||/404|not found/i.test(d.title)||d.body?.innerText.trim()==='本地预览中没有此文件。'){loading.hidden=false;loading.querySelector('p').textContent='应用页面暂时没有打开。';loading.querySelector('small').textContent='可以重新加载，或使用右上角“独立打开”。';}}catch{loading.hidden=false;loading.querySelector('p').textContent='应用未能在当前页面打开。';loading.querySelector('small').textContent='请选择右上角“独立打开”。';}});
  frame.addEventListener('error',()=>{if(ticket!==openTicket)return;loading.hidden=false;loading.querySelector('p').textContent='应用加载失败。';loading.querySelector('small').textContent='请重新加载，或选择“独立打开”。';});
  frame.src=url;host.append(frame);
  loadTimer=setTimeout(()=>{if(ticket!==openTicket)return;loading.hidden=true;$('#experience-kind').textContent='仍在加载，可重试或独立打开';},16000);
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-experience]');if(b){e.preventDefault();launch(b.dataset.experience);}});
 $('#experience-close').addEventListener('click',()=>dialog.close());
 $('#experience-retry').addEventListener('click',()=>{const p=window.XiaoZhanCatalog?.products.find(p=>p.id===activeId);if(p){$('#experience-kind').textContent='重新加载中';loadFrame(productUrl(p),p);}});
 dialog.addEventListener('close',()=>{openTicket++;clearTimeout(loadTimer);host.replaceChildren();frame=null;activeId=null;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});else $('#catalog').focus({preventScroll:true});});
 $('#menu-toggle').addEventListener('click',()=>{const open=$('#menu-toggle').getAttribute('aria-expanded')!=='true';$('#menu-toggle').setAttribute('aria-expanded',String(open));$('#menu-toggle').setAttribute('aria-label',open?'收起导航':'展开导航');$('#site-nav').classList.toggle('is-open',open);});
 $('#site-nav').addEventListener('click',e=>{if(!e.target.closest('a'))return;$('#site-nav').classList.remove('is-open');$('#menu-toggle').setAttribute('aria-expanded','false');$('#menu-toggle').setAttribute('aria-label','展开导航');});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#site-nav').classList.remove('is-open');$('#menu-toggle').setAttribute('aria-expanded','false');}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!document.querySelector('dialog[open]')){e.preventDefault();$('#search-toggle').click();}});
 $$('[data-nav-filter]').forEach(a=>a.addEventListener('click',()=>document.querySelector(`.filter-tabs [data-filter="${a.dataset.navFilter}"]`)?.click()));
 $('#catalog-search').addEventListener('submit',e=>{e.preventDefault();$('#catalog').focus({preventScroll:true});$('#catalog').scrollIntoView({block:'start',behavior:document.documentElement.dataset.reducedMotion==='true'?'auto':'smooth'});});
})();
