// Each fictional bank owns stable question IDs; snapshots protect completed results.
const demoTemplate=structuredClone(questions.slice(0,5));
if(data.questionStore){questions.length=0;questions.push(...data.questionStore);}
let nextQuestionId=questions.length;
data.banks.forEach((b,i)=>{b.id ||= `demo-bank-${i+1}`;if(!b.questionIds){if(i===0)b.questionIds=[0,1,2,3,4];else b.questionIds=demoTemplate.map(q=>{const n=nextQuestionId++;questions[n]=structuredClone(q);return n});}b.count=b.questionIds.length;});
const saveBeforeBanks=save;
save=function(){data.questionStore=questions;delete data.editedQuestions;saveBeforeBanks();};
let selectedBankId=data.banks[0]?.id||null;
const availableIds=()=>data.banks.flatMap(b=>b.questionIds);
const getBank=()=>data.banks.find(b=>b.id===selectedBankId)||data.banks[0];
const normalize=q=>q.answer.replaceAll('|','');
const grade=(q,answer)=>!answer?false:q.type==='简答题'?null:answer===normalize(q);
data.history.forEach(h=>{h.snapshot ||= Object.fromEntries(h.order.map(i=>[i,structuredClone(questions[i])]));h.correctByQuestion ||= Object.fromEntries(h.order.map(i=>[i,grade(h.snapshot[i],h.answers[i]||'')]));});
const beforeBanksAction=action,beforeBanksRender=render;
const startBeforeBanks=start;
start=function(ids){startBeforeBanks(ids||getBank()?.questionIds||[]);};
action=function(a){const [kind,arg]=a.split(':');
 if(kind==='bank'){selectedBankId=data.banks[Number(arg)]?.id;}
 if(kind==='start'){if(arg!==undefined)selectedBankId=data.banks[Number(arg)]?.id;exam=false;start(arg!==undefined||page==='bank'?getBank()?.questionIds:availableIds());return;}
 if(kind==='resume'&&data.draft){selectedBankId=data.draft.bankId||selectedBankId;}
 if(kind==='commit'){
  const id=`demo-bank-${Date.now()}`,questionIds=demoTemplate.map(q=>{const n=nextQuestionId++;questions[n]=structuredClone(q);return n});
  data.banks.push({id,name:`演示题库 ${data.banks.length+1}`,questionIds,count:questionIds.length});save();page='';root='学习';section='题库';render();return;
 }
 if(kind==='exam'){
  dialog('设置模拟考试',`<input id="name" aria-label="考生姓名" placeholder="考生姓名"><p>选题范围</p><input id="examBank" type="hidden" value=""><div class="exam-bank-chips">${btn('全部题库','examScope:','chip selected')}${data.banks.map(b=>btn(esc(b.name),`examScope:${b.id}`,'chip')).join('')}</div><p id="examCount">共 ${availableIds().length} 题，全部纳入考试并打乱顺序；交卷后按 100 分制查看成绩。</p>`,btn('取消','dismiss')+btn('开始考试','examStart'));modal.className='exam-dialog';const field=modal.querySelector('#name'),go=modal.querySelector('[data-action=examStart]');go.disabled=true;field.addEventListener('input',()=>{go.disabled=!field.value.trim()});field.blur();return;
 }
 if(kind==='examScope'){document.querySelector('#examBank').value=arg||'';modal.querySelectorAll('[data-action^="examScope:"]').forEach(e=>e.classList.toggle('selected',e.dataset.action===a));const ids=arg?data.banks.find(b=>b.id===arg).questionIds:availableIds();document.querySelector('#examCount').textContent=`共 ${ids.length} 题，全部纳入考试并打乱顺序；交卷后按 100 分制查看成绩。`;return;}
 if(kind==='edit'){const q=questions[Number(arg)],b=getBank(),n=b.questionIds.indexOf(Number(arg))+1;dialog('编辑题目',`<p class="edit-type">${q.type} · q${String(n).padStart(4,'0')}</p><fieldset class="edit-field"><legend>题干</legend><textarea id="editStem" aria-label="题干">${esc(q.stem)}</textarea></fieldset><fieldset class="edit-field"><legend>答案</legend><input id="editAnswer" aria-label="答案" value="${esc(q.answer)}"></fieldset><fieldset class="edit-field analysis-field"><legend>解析</legend><textarea id="editAnalysis" aria-label="解析">${esc(q.analysis)}</textarea></fieldset>`,btn('取消','dismiss')+btn('保存',`editSave:${arg}`,'filled-action'));modal.className='edit-dialog';return;}
 if(kind==='examStart'){
  name=document.querySelector('#name').value.trim();if(!name)return;
  const id=document.querySelector('#examBank').value,ids=[...(id?data.banks.find(b=>b.id===id).questionIds:availableIds())];
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  exam=true;modal.close();start(ids);return;
 }
 if(kind==='finish'){
  modal.close();const correctByQuestion={},snapshot={};order.forEach(i=>{snapshot[i]=structuredClone(questions[i]);correctByQuestion[i]=grade(questions[i],answers[i]||'');});
  const correct=Object.values(correctByQuestion).filter(x=>x===true).length,pending=Object.values(correctByQuestion).filter(x=>x===null).length;
  const now=new Date(),pad=n=>String(n).padStart(2,'0'),completedLabel=`${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  data.history.unshift({order:[...order],answers:{...answers},correctByQuestion,snapshot,correct,pending,score:Math.floor(correct*100/order.length),exam,name,completedLabel});data.draft=null;save();index=0;page='result';render();return;
 }
 if(kind==='deleteConfirm'){
  const removed=new Set(getBank().questionIds);data.banks=data.banks.filter(b=>b.id!==selectedBankId);
  data.favorites=data.favorites.filter(i=>!removed.has(i));
  data.history=data.history.map(h=>{const ids=h.order.filter(i=>!removed.has(i));if(!ids.length)return null;const copy={...h,order:ids,answers:{...h.answers},correctByQuestion:{...h.correctByQuestion},snapshot:{...h.snapshot}};for(const i of removed){delete copy.answers[i];delete copy.correctByQuestion[i];delete copy.snapshot[i];}copy.correct=ids.filter(i=>copy.correctByQuestion[i]===true).length;copy.pending=ids.filter(i=>copy.correctByQuestion[i]===null).length;copy.score=Math.floor(copy.correct*100/ids.length);return copy;}).filter(Boolean);
  if(data.draft){const d=data.draft,oldCurrent=d.order[d.index];d.order=d.order.filter(i=>!removed.has(i));for(const i of removed)delete d.answers[i];d.index=Math.max(0,d.order.indexOf(oldCurrent));if(!d.order.length)data.draft=null;}
  selectedBankId=data.banks[0]?.id||null;save();modal.close();page='';root='学习';section='题库';render();return;
 }
 if(kind==='favorites'){if(!data.favorites.length)return notice('收藏练习','还没有收藏题目。');exam=false;start([...data.favorites]);return;}
 if(kind==='wrong'){const ids=[...new Set(data.history.flatMap(h=>h.order.filter(i=>h.correctByQuestion[i]===false)))];if(!ids.length)return notice('错题库','暂无错题');exam=false;start(ids);return;}
 if(kind==='filterStart'){const type=document.querySelector('#filterType').value,count=Number(document.querySelector('#filterCount').value),ids=availableIds().filter(i=>type==='全部题型'||questions[i].type===type).slice(0,Math.max(1,count));if(!ids.length)return notice('暂无匹配题目','请换一个题型。');modal.close();exam=false;start(ids);return;}
 beforeBanksAction(a);
};
render=function(){
 const h=page==='result'?data.history[index]:null,originals={};
 if(h?.snapshot)for(const i of h.order){originals[i]=questions[i];questions[i]=h.snapshot[i];}
 try{beforeBanksRender();
  if(page==='bank'){
   const b=getBank();app.innerHTML=`<header>${btn(icon('back'),'back')}<strong>${esc(b.name)}<small>${b.questionIds.length} 道题</small></strong>${btn(icon('rename'),'rename')}${btn(icon('delete'),'delete')}</header><main><div class="stack bank-stack"><div>${btn(icon('play')+' 练习这个题库','start','primary')}${btn(icon('globe')+' 发布到全站','publish','outline bank-publish')}<h3 class="section">题目</h3></div><div>${b.questionIds.map((i,n)=>`<div class="list bank-question" role="button" tabindex="0" data-action="edit:${i}"><span class="question-number">${String(n+1).padStart(3,'0')}</span><div class="grow"><strong>${esc(questions[i].stem)}</strong><p>${questions[i].type} · 答案 ${esc(questions[i].type==='判断题'?(questions[i].answer==='A'?'TRUE':'FALSE'):questions[i].type==='多选题'?questions[i].answer.split('').join('|'):questions[i].answer)}</p></div>${icon('edit')}</div>`).join('')}</div></div></main>`;
  }
  if(!page&&root==='学习'&&section==='记录'&&data.history.some(h=>Object.values(h.answers).some(Boolean)))app.querySelector('.progress-track').classList.add('has-answers');
  if(page==='result'&&h?.correctByQuestion){app.querySelectorAll('main .list').forEach(el=>{const i=Number(el.dataset.action.split(':')[1]),v=h.correctByQuestion[i];const detail=el.nextElementSibling;if(detail?.classList.contains('answer')){detail.querySelectorAll('p').forEach((p,n)=>{p.style.color='var(--text)';if(n<(questions[i].options||[]).length&&normalize(questions[i]).includes(String.fromCharCode(65+n)))p.style.color='var(--primary)'});}el.querySelector('p').textContent=!h.answers[i]?'未作答':v===true?'回答正确':v===false?'回答错误':'请自行核对';});}
  if(!page&&root==='学习'&&section==='记录'){app.querySelectorAll('main .list').forEach(el=>{const item=data.history[Number(el.dataset.action.split(':')[1])];el.querySelector('.chev').remove();el.querySelector('p').textContent=`${item.exam?item.score+' 分 / 100'+(item.pending?'（暂计）':'')+' · ':''}${item.order.length} 道题 · ${item.completedLabel||'未记录时间'} · 查看结果`;});}
 }finally{for(const i in originals)questions[i]=originals[i];}
};
const draftBeforeBanks=draft;draft=function(){draftBeforeBanks();data.draft.bankId=selectedBankId;save();};
save();render();

