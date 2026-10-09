// Fixes grounded in the isolated formal 1.3.24 synthetic fixture.
questions[3].type='简答题';
const beforeParityAction=action,beforeParityRender=render;
const normalizedAnswer=i=>questions[i].answer.replaceAll('|','');
const manualQuestion=i=>questions[i].type==='简答题';
let examsOnly=false;
action=function(a){
 const [kind,arg]=a.split(':');
 if(!data.banks.length&&['start','exam','filter','favorites'].includes(kind))return;
 if(kind==='historyFilter'){examsOnly=arg==='exam';render();return}
 if(kind==='palette'){page='palette';render();return}
 if(kind==='jump'&&page==='palette'){index=Number(arg);page='practice';draft();render();return}
 if(kind==='back'&&page==='palette'){page='practice';render();return}
 if(kind==='back'&&page==='publicBank'){page='public';render();return}
 if(kind==='back'&&page==='scores'){page='publicBank';render();return}
 if(kind==='start'&&!data.banks.length){notice('还没有可练习的题目','请先导入题库。');return}
 if(kind==='filterStart'){
  const type=document.querySelector('#filterType').value,count=Number(document.querySelector('#filterCount').value);
  const ids=questions.map((q,i)=>({q,i})).filter(({q})=>type==='全部题型'||q.type===type).map(x=>x.i).slice(0,Math.max(1,count));
  if(!ids.length){notice('暂无匹配题目','请换一个题型。');return}
 }
 if(kind==='finish'){
  modal.close();const correct=order.filter(i=>!manualQuestion(i)&&(answers[i]||'')===normalizedAnswer(i)).length;
  const pending=order.filter(i=>manualQuestion(i)&&answers[i]).length;
  data.history.unshift({order:[...order],answers:{...answers},correct,pending,score:Math.floor(correct*100/order.length),exam,name});
  data.draft=null;save();index=0;page='result';render();return;
 }
 if(kind==='deleteConfirm'&&data.banks.length===1){data.history=[];data.draft=null;data.favorites=[];}
 beforeParityAction(a);
};
render=function(){
 beforeParityRender();
 if(page==='public'){
  app.innerHTML=`<header>${btn(icon('back'),'back')}<strong>全站题库</strong>${btn(icon('refresh'),'refreshPublic')}</header><main style="padding-top:18px"><p style="color:#ba1a1a">CloudBase 请求失败 404</p>${btn('重试','refreshPublic','text')}</main>`;
 }
 if(page==='palette'){
  app.innerHTML=`<header>${btn(icon('back'),'back')}<strong>选择题目</strong></header><main><p>已答 ${Object.keys(answers).length}/${order.length} · 可返回修改答案</p><div class="grid palette-grid">${order.map((q,i)=>btn(`${i+1}`,`jump:${i}`,answers[q]?'selected':'outline')).join('')}</div></main><footer>${btn('交卷并看结果','submit','primary')}</footer>`;
 }
 if(!page&&root==='我的'){app.className='profile';app.querySelectorAll('.list')[2].querySelector('.icon').outerHTML=icon('update');}
 if(!page&&root==='学习'&&section==='题库'){app.querySelector('[data-action=formats]').innerHTML=icon('help')+' 支持哪些文件？';}
 if(!page&&root==='首页'){
  const answered=data.history.reduce((n,h)=>n+Object.values(h.answers).filter(Boolean).length,0);
  const correct=data.history.reduce((n,h)=>n+h.correct,0),metrics=app.querySelectorAll('.metrics b');
  metrics[0].textContent=answered;metrics[1].textContent=answered?`${Math.floor(correct*100/answered)}%`:'—';metrics[2].textContent=data.history.length;
 }
 if(!page&&root==='学习'&&section==='记录'){
  const answered=data.history.reduce((n,h)=>n+Object.values(h.answers).filter(Boolean).length,0),correct=data.history.reduce((n,h)=>n+h.correct,0);
  const sessions=data.history.map((h,i)=>({h,i})).filter(({h})=>!examsOnly||h.exam);
  app.querySelector('main').innerHTML=`<h2>学习概览</h2><div class="metrics" style="margin-top:12px"><div><b>${answered}</b><span>已作答</span></div><div><b>${answered?Math.floor(correct*100/answered)+'%':'—'}</b><span>正确率</span></div><div><b>0</b><span>待复习</span></div></div><div class="progress-track"></div><h3 class="section" style="margin-top:18px">完成记录</h3><div class="chips history-filters">${btn('全部','historyFilter:all',!examsOnly?'chip selected':'chip')}${btn('模拟考试','historyFilter:exam',examsOnly?'chip selected':'chip')}</div>${sessions.length?sessions.map(({h,i})=>row(h.exam?`模拟考试 · ${h.name}`:'日常练习',`${h.exam?h.score+' 分 / 100 · ':''}${h.order.length} 道题 · 查看结果`,`result:${i}`,'history')).join(''):`<div class="empty"><strong>${examsOnly?'还没有考试记录':'还没有练习记录'}</strong><p>完成后会显示在这里。</p></div>`}`;
 }
 if(!page&&root==='学习'&&section==='练习'&&!data.banks.length){
  app.className='learn practice-section';
  app.querySelector('h2').textContent='还没有可练习的题目';app.querySelector('main>p').textContent='请先到“题库”导入内容。';
  app.querySelector('[data-action=wrong] p').textContent='0 道 · 查看并练习';
  app.querySelectorAll('main [data-action]').forEach(e=>{if(e.dataset.action!=='wrong'){e.setAttribute('aria-disabled','true');if(e.tagName==='BUTTON')e.disabled=true;}});
  for(const [a,ico] of [['exam','exam'],['filter','filter'],['favorites','starFilled']]){const e=app.querySelector(`[data-action=${a}]`);e.querySelector('.icon').outerHTML=icon(ico);e.querySelector('.chev').remove();e.classList.add('disabled-row');}
 }
 if(page==='preview'){app.className='preview';
  app.querySelector('header strong').textContent='导入预览';app.querySelector('header button').innerHTML=icon('close');
  app.querySelector('main').innerHTML=`<h1>已选择 1 个文件</h1><div class="metrics preview-counts"><div><b>1</b><span>题库</span></div><div><b>0</b><span>资料</span></div><div><b>0</b><span>失败</span></div></div><p>5 道可练习题 · 1 条需核对 · 0 个图片附件</p><div class="preview-file"><div class="row">${icon('check')}<div><strong>demo2</strong><p>5 道题 · TXT · UTF-8 BOM · 智能分段</p></div></div><p class="warning">第 3 行：自动识别置信度 65%：紧凑字母答案按多选识别，请核对；请在导入前核对这道题</p></div>${btn('查看支持的格式','formats','text')}<div style="height:12px"></div>${btn('查看脱敏样本并提交分析','diagnostic','text')}<p>只发送格式结构和英文字母占位符；原题、答案、图片、文件名和路径都留在本机。</p>`;
 }
 if(page==='result'){
  app.className='result';
  app.querySelector('header button').innerHTML=icon('close');
  const h=data.history[index];if(h){
   const rows=app.querySelectorAll('main .list');
   rows.forEach(rowEl=>{const i=Number(rowEl.dataset.action.split(':')[1]);const status=manualQuestion(i)&&h.answers[i]?'help':h.answers[i]===normalizedAnswer(i)?'check':'cancel';rowEl.querySelector('.icon').outerHTML=icon(status);if(status==='cancel')rowEl.querySelector('.icon').style.color='#ba1a1a';if(status==='help')rowEl.querySelector('.icon').style.color='#805f00';rowEl.querySelector('.chev').remove();
    if(manualQuestion(i)&&h.answers[i])rowEl.querySelector('p').textContent='请自行核对';});
  }
 }
};
const beforeDiagnosticAction=action;
action=a=>{if(a==='diagnostic'){notice('脱敏分析','浏览器演示不读取文件、不生成或上传诊断样本。请在 Android 应用中查看脱敏后的内容。');return}beforeDiagnosticAction(a)};
render();


