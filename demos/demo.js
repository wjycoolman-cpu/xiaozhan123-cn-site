(() => {
'use strict';
const id=new URLSearchParams(location.search).get('app')||'qingci';
const names={'pocket-piano':'弹钢琴',mianji:'眠迹',qingci:'词间','question-bank':'智能题库','stardew-farm':'星露谷自动农场助手'};
const screen=document.querySelector('#screen'),tabs=document.querySelector('#tabs');
if(!names[id]){screen.innerHTML='<h1>没有这个应用</h1><p>请返回小站，选择一个应用体验。</p>';return;}
document.title=names[id]+' · 在线体验';
const notes={qingci:'示例词汇可实际练习，进度只保存在当前浏览器。','question-bank':'使用示例题库，答题与错题记录只保存在当前浏览器。',mianji:'示例睡眠数据；网页不会监测手机或读取真实睡眠记录。','pocket-piano':'可实际弹奏，演示采用合成音色，正式应用的乐器与曲库以安装版本为准。','stardew-farm':'配置流程与农场动画演示；不会检测、安装或修改电脑上的游戏。'};
document.querySelector('#notice').textContent=notes[id];
let saved={};try{saved=JSON.parse(localStorage.getItem('xiaozhan-demo-'+id)||'{}')||{};}catch{}
let state={learned:0,wrong:[],answers:0,correct:0,records:[],mode:'开荒种田',limit:40,...saved},tab=0,wordIndex=0,revealed=false,qi=0,answered=false,practice=[],timer;
for(const k of ['learned','answers','correct'])state[k]=Number.isFinite(state[k])&&state[k]>=0?Math.floor(state[k]):0;
state.wrong=Array.isArray(state.wrong)?[...new Set(state.wrong.filter(n=>Number.isInteger(n)&&n>=0&&n<3))]:[];
state.records=Array.isArray(state.records)?state.records.filter(r=>r&&/^\d{2}:\d{2}$/.test(r.bed)&&/^\d{2}:\d{2}$/.test(r.wake)&&/^\d{1,2}\.\d$/.test(r.hours)).slice(0,100):[];
if(!['开荒种田','收益速进','观赏演示'].includes(state.mode))state.mode='开荒种田';
state.limit=Number.isFinite(state.limit)?Math.max(1,Math.min(200,state.limit)):40;
const words=[['discover','/dɪˈskʌvə/','发现；探索','We discover something new every day.'],['journey','/ˈdʒɜːni/','旅程；旅行','Learning is a journey.'],['improve','/ɪmˈpruːv/','改善；提高','Practice helps you improve.'],['patient','/ˈpeɪʃnt/','耐心的；病人','Be patient with yourself.'],['achieve','/əˈtʃiːv/','实现；达到','Small steps achieve great things.']];
const questions=[{q:'水在标准大气压下的沸点是多少？',a:['80°C','90°C','100°C','120°C'],ok:2,why:'标准大气压下，纯水在 100°C 沸腾。'},{q:'英语单词 discover 的含义是？',a:['忘记','发现','离开','等待'],ok:1,why:'discover 表示发现、探索。'},{q:'一个三角形的内角和是多少？',a:['90°','180°','270°','360°'],ok:1,why:'平面三角形的三个内角之和为 180°。'}];
function save(){try{localStorage.setItem('xiaozhan-demo-'+id,JSON.stringify(state));}catch{toast('浏览器未允许保存，本次仍可体验');}}
function toast(t){const el=document.querySelector('#message');el.textContent=t;el.style.display='block';clearTimeout(timer);timer=setTimeout(()=>el.style.display='none',2500);}
function btn(t,a,c='primary'){return `<button class="${c}" data-action="${a}">${t}</button>`;}
function header(t,sub){return `<div class="eyebrow">${names[id]}</div><h1>${t}</h1><p class="sub">${sub}</p>`;}
function nav(items){tabs.innerHTML=items.map((t,i)=>`<button data-tab="${i}" class="${tab===i?'active':''}" aria-current="${tab===i?'page':'false'}">${t}</button>`).join('');}
function render(){
stopNotes();
if(id==='qingci'){
nav(['今日','词书','统计']);
if(tab===0){if(revealed===null){const w=words[wordIndex%words.length];screen.innerHTML=header('学习一个新单词',`示例词书 · ${wordIndex%words.length+1} / ${words.length}`)+`<div class="panel word"><strong>${w[0]}</strong><p class="sub">${w[1]}</p><div class="meaning" id="meaning">点击查看释义</div><p id="example" hidden>${w[3]}</p></div>`+btn('查看释义','reveal')+btn('返回今日','home','secondary');}else screen.innerHTML=header('每天一点，慢慢积累','四级核心词汇 · 示例学习')+`<div class="panel hero"><span class="small">今日已学习</span><div class="big">${state.learned}<span class="sub"> / 20 词</span></div><div class="progress"><i data-width="${Math.min(100,state.learned*5)}"></i></div>${btn('开始学习','learn')}</div><div class="panel"><div class="row"><h2>当前词书</h2><span class="tag">四级</span></div><p class="sub">从常用词开始，逐步建立自己的词汇库。</p>${btn('浏览词书','books','secondary')}</div>`;}
if(tab===1)screen.innerHTML=header('我的词书','五个示例词，点开即可学习')+words.map((w,i)=>`<button class="option" data-word="${i}"><div class="row"><strong>${w[0]}</strong><span class="small">${w[2]}</span></div></button>`).join('');
if(tab===2)screen.innerHTML=header('学习统计','当前浏览器的演示学习记录')+`<div class="panel hero"><div class="big">${state.learned}</div><p>累计学习次数</p></div><div class="panel"><h2>继续积累</h2><p class="sub">回到今日，开始下一组单词。</p>${btn('继续学习','learn')}</div>`;
}
if(id==='question-bank'){
nav(['首页','题库','错题']);
if(practice.length){const q=questions[practice[qi]];screen.innerHTML=header(`练习 ${qi+1} / ${practice.length}`,'基础知识 · 示例题库')+`<div class="panel"><h2>${q.q}</h2>${q.a.map((a,i)=>`<button class="option" data-answer="${i}">${String.fromCharCode(65+i)}. ${a}</button>`).join('')}<p id="explanation" hidden></p><div id="next"></div></div>`+btn('退出练习','quit','secondary');}
else if(tab===0)screen.innerHTML=header('今天也进步一点','练习、复习，把知识留住')+`<div class="panel hero"><div class="row"><div><div class="big">${state.answers}</div><span class="small">已答题</span></div><div><div class="big">${state.wrong.length}</div><span class="small">待复习</span></div></div>${btn('开始练习','practice')}</div><div class="panel"><h2>最近题库</h2><p>基础知识示例题库</p><p class="sub">3 道单选题 · 含答案与解析</p>${btn('打开题库','bank','secondary')}</div>`;
else if(tab===1)screen.innerHTML=header('我的题库','先用示例题体验答题流程')+`<div class="panel"><h2>基础知识示例题库</h2><p class="sub">3 道题 · 单项选择</p>${btn('开始练习','practice')}</div><p class="sub">正式应用支持文档、图片与题库包导入。本演示仅使用示例题。</p>`;
else screen.innerHTML=header('错题复习','答错的题目会出现在这里')+(state.wrong.length?`<div class="panel"><h2>${state.wrong.length} 道待复习</h2>${btn('复习错题','review')}</div>`:'<p class="empty">暂时没有错题，去完成一组练习吧。</p>'+btn('开始练习','practice'));
}
if(id==='mianji'){
nav(['睡眠','趋势','记录']);
if(tab===0)screen.innerHTML=header('昨晚休息得怎么样','示例报告 · 非真实监测')+`<div class="panel hero"><span class="small">睡眠时长</span><div class="big">7<span class="sub"> 小时 </span>42<span class="sub"> 分</span></div><div class="row"><span>23:18 入睡</span><span>07:00 起床</span></div></div><div class="panel"><h2>记一晚睡眠</h2><label>入睡时间<input type="time" id="bed" value="23:00"></label><label>起床时间<input type="time" id="wake" value="07:00"></label>${btn('保存演示记录','record')}</div>`;
if(tab===1)screen.innerHTML=header('一周趋势','七晚示例数据')+`<div class="panel"><span class="small">平均时长</span><div class="big">7.4<span class="sub"> 小时</span></div><div class="bars">${[6.5,7.8,7.2,8,6.9,7.7,7.7].map((n,i)=>`<div class="bar"><span>${n}</span><i data-height="${n*9}"></i><span>${['一','二','三','四','五','六','日'][i]}</span></div>`).join('')}</div></div>`;
if(tab===2)screen.innerHTML=header('睡眠记录','你在演示中手动添加的记录')+(state.records.length?state.records.map(r=>`<div class="panel"><div class="row"><strong>${r.bed} → ${r.wake}</strong><span>${r.hours} 小时</span></div><p class="small">演示手动记录</p></div>`).join(''):'<p class="empty">尚未添加记录。</p>'+btn('添加一晚','home'));
}
if(id==='pocket-piano'){
nav(['键盘','跟弹']);screen.innerHTML=header(tab?'跟着旋律弹奏':'把旋律放在指尖',tab?'小星星 · 点击播放示范，或自己跟弹':'点击琴键，或使用电脑 A S D F G H J K')+`<div class="panel hero"><div class="row"><h2>钢琴</h2><span class="tag">C 大调</span></div><p id="note-label" class="sub">准备好，弹下第一个音</p></div><div class="keys">${[0,2,4,5,7,9,11,12].map((n,i)=>`<button class="key" data-note="${n}" aria-label="${['C4','D4','E4','F4','G4','A4','B4','C5'][i]}">${['C','D','E','F','G','A','B','C'][i]}</button>`).join('')}${[1,3,6,8,10].map((n,i)=>`<button class="key black" data-left="${[8.5,21,46,58.5,71][i]}" data-note="${n}" aria-label="升${['C','D','F','G','A'][i]}4"></button>`).join('')}</div>`+(tab?`<div class="panel"><h2>小星星</h2><p>1 1 5 5 6 6 5 · 4 4 3 3 2 2 1</p>${btn('播放示范','song')}${btn('停止','stop','secondary')}</div>`:`<p class="sub">支持多指触控；松开琴键结束当前音。</p>`);
}
if(id==='stardew-farm'){
nav(['配置','农场']);
if(tab===0)screen.innerHTML=header('让农场自己忙起来','配置器流程演示')+`<div class="panel"><h2>游戏环境</h2><p class="sub">示例路径：… / Stardew Valley</p><span class="tag">示例环境已准备</span><label>运行模式<select id="mode">${['开荒种田','收益速进','观赏演示'].map(t=>`<option ${state.mode===t?'selected':''}>${t}</option>`).join('')}</select></label><label>工作上限 <output id="limit-value">${state.limit}</output><input type="range" id="limit" min="1" max="200" value="${state.limit}"></label>${btn('应用演示配置','configure')}</div><p class="sub">正式配置器负责本机检测、安装和卸载；这里体验操作流程。</p>`;
else screen.innerHTML=header('农场工作中',state.mode+' · 示例动画')+`<div class="panel"><div class="row"><h2>第 1 天 · 春季</h2><span class="tag" id="farm-status">等待开始</span></div><div class="farm">${Array.from({length:40},()=>'<span class="tile">·</span>').join('')}</div>${btn('开始农场演示','farm')}${btn('暂停','pause','secondary')}</div>`;
}
screen.querySelectorAll('[data-width]').forEach(e=>e.style.width=e.dataset.width+'%');
screen.querySelectorAll('[data-height]').forEach(e=>e.style.height=e.dataset.height+'px');
screen.querySelectorAll('[data-left]').forEach(e=>e.style.left=e.dataset.left+'%');
}
let audio,voices=new Map(),songTimers=[],farmTimer;
function stopNotes(){voices.forEach(v=>v());voices.clear();songTimers.forEach(clearTimeout);songTimers=[];clearInterval(farmTimer);}
function note(n,key){if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=261.6256*Math.pow(2,n/12);g.gain.setValueAtTime(.0001,audio.currentTime);g.gain.exponentialRampToValueAtTime(.16,audio.currentTime+.015);g.gain.exponentialRampToValueAtTime(.035,audio.currentTime+1);o.connect(g);g.connect(audio.destination);o.start();key?.classList.add('pressed');const end=()=>{g.gain.cancelScheduledValues(audio.currentTime);g.gain.setTargetAtTime(.0001,audio.currentTime,.04);o.stop(audio.currentTime+.25);key?.classList.remove('pressed');};document.querySelector('#note-label').textContent='正在弹奏 · '+['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B','C'][n];return end;}
document.addEventListener('pointerdown',e=>{const k=e.target.closest('[data-note]');if(k){e.preventDefault();k.setPointerCapture(e.pointerId);voices.set(e.pointerId,note(Number(k.dataset.note),k));}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,e=>{voices.get(e.pointerId)?.();voices.delete(e.pointerId);});
const keys=['a','s','d','f','g','h','j','k'];document.addEventListener('keydown',e=>{if(id!=='pocket-piano'||e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;const i=keys.indexOf(e.key.toLowerCase());if(i<0||['INPUT','SELECT'].includes(e.target.tagName))return;e.preventDefault();const k=document.querySelectorAll('.key:not(.black)')[i];voices.set(e.code,note(Number(k.dataset.note),k));});document.addEventListener('keyup',e=>{voices.get(e.code)?.();voices.delete(e.code);});window.addEventListener('blur',stopNotes);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopNotes();});
document.addEventListener('input',e=>{if(e.target.id==='limit')document.querySelector('#limit-value').textContent=e.target.value;});
document.addEventListener('click',e=>{
const t=e.target.closest('[data-tab]');if(t){tab=Number(t.dataset.tab);practice=[];revealed=false;render();return;}
const w=e.target.closest('[data-word]');if(w){wordIndex=Number(w.dataset.word);tab=0;revealed=null;render();return;}
const ans=e.target.closest('[data-answer]');if(ans&&!answered){answered=true;const qidx=practice[qi],q=questions[qidx],a=Number(ans.dataset.answer);state.answers++;if(a===q.ok){state.correct++;state.wrong=state.wrong.filter(x=>x!==qidx);}else if(!state.wrong.includes(qidx))state.wrong.push(qidx);save();document.querySelectorAll('[data-answer]').forEach(b=>{b.disabled=true;if(Number(b.dataset.answer)===q.ok)b.classList.add('correct');else if(b===ans)b.classList.add('wrong');});const ex=document.querySelector('#explanation');ex.hidden=false;ex.textContent=(a===q.ok?'回答正确。':'再记住这个知识点。')+q.why;document.querySelector('#next').innerHTML=btn(qi+1===practice.length?'完成练习':'下一题','next');return;}
const a=e.target.closest('[data-action]')?.dataset.action;if(!a)return;
if(a==='home'){tab=0;revealed=false;}
if(a==='learn'){tab=0;revealed=null;}
if(a==='books')tab=1;
if(a==='reveal'){document.querySelector('#meaning').textContent=words[wordIndex%words.length][2];document.querySelector('#example').hidden=false;e.target.outerHTML=btn('记住了，下一个','remember')+btn('再看一次','again','secondary');return;}
if(a==='remember'){state.learned++;save();wordIndex++;revealed=null;}
if(a==='again'){toast('再读一遍单词与例句，再点击“记住了”');return;}
if(a==='practice'||a==='review'){practice=a==='review'?[...state.wrong]:[0,1,2];qi=0;answered=false;}
if(a==='bank')tab=1;
if(a==='quit'){practice=[];tab=0;}
if(a==='next'){qi++;answered=false;if(qi===practice.length){practice=[];tab=0;toast('本组练习已完成，进度已保存');}}
if(a==='record'){const bed=document.querySelector('#bed').value,wake=document.querySelector('#wake').value;if(!bed||!wake){toast('请填写入睡和起床时间');return;}const mins=s=>Number(s.slice(0,2))*60+Number(s.slice(3));const duration=(mins(wake)-mins(bed)+1440)%1440;if(duration===0){toast('入睡和起床时间不能相同');return;}state.records.unshift({bed,wake,hours:(duration/60).toFixed(1)});save();tab=2;}
if(a==='configure'){state.mode=document.querySelector('#mode').value;state.limit=Number(document.querySelector('#limit').value);save();tab=1;toast('演示配置已应用');}
if(a==='farm'){clearInterval(farmTimer);let count=0;document.querySelectorAll('.tile').forEach(t=>{t.classList.remove('grown');t.textContent='·';});farmTimer=setInterval(()=>{const tile=document.querySelectorAll('.tile')[count++];if(!tile){clearInterval(farmTimer);document.querySelector('#farm-status').textContent='示例工作完成';return;}tile.classList.add('grown');tile.textContent='🌱';document.querySelector('#farm-status').textContent=`已种植 ${count} / 40`;},180);return;}
if(a==='pause'){clearInterval(farmTimer);document.querySelector('#farm-status').textContent='已暂停';return;}
if(a==='song'){stopNotes();[0,0,7,7,9,9,7,5,5,4,4,2,2,0].forEach((n,i)=>songTimers.push(setTimeout(()=>{const k=document.querySelector(`[data-note="${n}"]`),end=note(n,k);voices.set('song'+i,end);songTimers.push(setTimeout(()=>{end();voices.delete('song'+i);},330));},i*420)));return;}
if(a==='stop'){stopNotes();return;}
render();
});
document.querySelector('#reset').addEventListener('click',()=>{state={learned:0,wrong:[],answers:0,correct:0,records:[],mode:'开荒种田',limit:40};save();tab=0;practice=[];revealed=false;wordIndex=0;render();toast('演示已重新开始');});
render();
})();

