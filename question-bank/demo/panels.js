// Native-source-aligned secondary panels. Network/device limitations stay at the operation.
const originalAction=action,originalRender=render;
let resultFilter='全部',expandedResults=new Set();
if(data.editedQuestions)data.editedQuestions.forEach((q,i)=>Object.assign(questions[i],q));
Object.assign(paths,{phone:'M6 2h12v20H6Z M10 19h4',feedback:'M3 3h18v14H8l-5 4Z M7 7h10 M7 11h6',school:'m2 8 10-5 10 5-10 5Z M5 10v7l7 4 7-4v-7 M22 8v10'});
action=function(a){const [kind,arg]=a.split(':');
if(kind==='public'){page='public';render();return}
if(kind==='publicScores'){page='scores';render();return}
if(kind==='publicBank'){page='publicBank';render();return}
if(kind==='refreshPublic'){notice('浏览器演示','本页面使用虚构本地公开题库和成绩，不连接真实全站服务。');return}
if(kind==='edit'){const q=questions[+arg];dialog('编辑题目',`<p>${q.type} · ${+arg+1}</p><label>题干<textarea id="editStem">${esc(q.stem)}</textarea></label><label>答案<input id="editAnswer" value="${esc(q.answer)}"></label><label>解析<textarea id="editAnalysis">${esc(q.analysis)}</textarea></label>`,btn('取消','dismiss')+btn('保存',`editSave:${arg}`));return}
if(kind==='editSave'){const stem=document.querySelector('#editStem').value.trim(),answer=document.querySelector('#editAnswer').value.trim();if(!stem||!answer)return;Object.assign(questions[+arg],{stem,answer,analysis:document.querySelector('#editAnalysis').value});data.editedQuestions=questions;save();modal.close();render();return}
if(kind==='resultFilter'){resultFilter=arg;render();return}
if(kind==='expandResult'){expandedResults.has(+arg)?expandedResults.delete(+arg):expandedResults.add(+arg);render();return}
if(kind==='filter'){dialog('筛选练习','<label>题型<select id="filterType"><option>全部题型</option><option>单选题</option><option>多选题</option><option>判断题</option><option>填空题</option><option>简答题</option></select></label><label>题目数量<input id="filterCount" type="number" min="1" max="5" value="5"></label>',btn('取消','dismiss')+btn('开始练习','filterStart'));return}
if(kind==='filterStart'){const type=document.querySelector('#filterType').value,count=+document.querySelector('#filterCount').value;const ids=questions.map((q,i)=>({q,i})).filter(({q})=>type==='全部题型'||q.type===type).slice(0,Math.max(1,count)).map(x=>x.i);modal.close();exam=false;start(ids);return}
if(kind==='publish'){dialog('公开发布这个题库？','<p>题目、标准答案、解析和配图会发布给所有全站用户。之后参与者的姓名和成绩汇总也会公开展示。请先确认题库内容可以公开。</p>',btn('取消','dismiss')+btn('确认发布','publishDemo'));return}
if(kind==='publishDemo'){notice('演示限制','本地演示题库不会上传或发布到真实全站服务。');return}
if(kind==='feedbackImage'){notice('添加图片','浏览器演示未接入正式信箱；图片不会选择或上传。');return}
return originalAction(a)};
render=function(){originalRender();const q=questions[order[index]];
app.className=!page&&root==='学习'?'learn':'';
if(!page&&root==='学习'&&section==='题库'&&!data.banks.length){const first=app.querySelector('.list');first.insertAdjacentHTML('afterend','<div class="empty"><strong>等待第一份题库</strong><p>可一次选择多份题表、文档或题目图片。</p></div>');}
if(!page&&root==='首页'&&!data.banks.length){const values=app.querySelectorAll('.metrics b');values[0].textContent='0';values[1].textContent='—';values[2].textContent='0';app.querySelector('main .stack').insertAdjacentHTML('beforeend','<div class="empty"><strong>还没有题库</strong><p>到“学习”导入题表、文档或题库包。</p></div>');}
if(!page&&root==='我的'){
const rows=app.querySelectorAll('.list');rows[0].querySelector('.icon').outerHTML=icon('phone');rows[0].querySelector('.chev').innerHTML=icon('lock');rows[1].querySelector('.icon').outerHTML=icon('feedback');
rows[0].classList.add('no-divider');rows[2].classList.add('no-divider');
if(data.updateMessage)rows[2].querySelector('p').textContent=data.updateMessage;
rows[2].querySelector('.chev').innerHTML=btn('检查','update');
rows[4].querySelector('.icon').remove();rows[4].querySelector('.chev').remove();rows[5].querySelector('.icon').remove();rows[5].querySelector('.chev').remove();
}
if(page==='practice'){app.querySelector('footer [data-action=prev]').disabled=index===0;app.querySelector('header [data-action=favorite]').innerHTML=icon(data.favorites.includes(order[index])?'starFilled':'star');
const main=app.querySelector('main');main.querySelector('p').textContent=`已答 ${Object.keys(answers).length}/${order.length}${exam?' · 已用时 00:00':''}`;
const stem=main.querySelector('h2');stem.insertAdjacentHTML('beforebegin',`<p class="type-label">${q.type}</p>`);stem.classList.add('question-stem');
main.querySelectorAll('.option').forEach((b,i)=>{let marker=q.type==='判断题'?(i===0?'√':'×'):String.fromCharCode(65+i);b.innerHTML=`<span class="option-marker">${marker}</span><span class="grow">${esc(q.options[i])}</span>${b.classList.contains('selected')?'✓':''}`});
}
if(page==='public'||page==='publicBank'||page==='scores'){
const title=page==='public'?'全站题库':page==='scores'?'答卷详情':'公开演示题库';let body;
if(page==='public')body=row('公开演示题库','5 道题 · 发布于 2026-09-26','publicBank','globe')+btn('查看答卷','publicScores');
if(page==='publicBank')body=`<h2>公开演示题库</h2><p>5 道题</p><p>交卷后，考生姓名和成绩汇总对所有浏览者可见。</p>${btn('开始模拟考试','exam','primary')}${btn('查看全站答卷','publicScores','outline')}<h3 class="section">题目</h3>${questions.map(q=>row(q.stem,q.type,'refreshPublic')).join('')}`;
if(page==='scores')body=`<div class="chips">${btn('我的答卷详情','refreshPublic','chip')}${btn('全站答卷详情','refreshPublic','chip selected')}</div><input aria-label="输入要搜索的人员" placeholder="输入要搜索的人员">${row('演示考生','答题时间：09月26日 13:49','refreshPublic','person')}<p>用时：1分钟 | 试卷题量：5 | 正确题：4</p><p>正确率：80% | 得分：80分</p>`;
app.innerHTML=`<header>${btn(icon('back'),'back')}<strong>${title}</strong>${btn('刷新','refreshPublic')}</header><main>${body}</main>`;
}
if(page==='result'){
const h=data.history[index];if(h){app.querySelector('header strong').textContent=h.exam?'考试结果':'练习结果';app.querySelector('main').innerHTML=`${h.exam?`<p>考生：${esc(h.name||'未记录')}</p>`:''}<h1 class="score">${h.score} 分 / 100${h.pending?'（暂计）':''}</h1><p style="color:var(--text)">自动判对 ${h.correct}/${h.order.length} · 未答 ${h.order.filter(i=>!h.answers[i]).length}${h.pending?` · ${h.pending} 题待人工核对`:''}</p><h3 class="section">答题回顾</h3><div class="chips" style="padding:0">${['全部','错题','未答'].map(s=>btn(s,`resultFilter:${s}`,`chip ${s===resultFilter?'selected':''}`)).join('')}</div>${h.order.filter(i=>resultFilter==='全部'||resultFilter==='未答'&&!h.answers[i]||resultFilter==='错题'&&i!==4&&(h.answers[i]||'')!==questions[i].answer).map(i=>`<div>${row(`${h.order.indexOf(i)+1}. ${questions[i].stem}`,!h.answers[i]?'未作答':i===4?'请自行核对':h.answers[i]===questions[i].answer?'回答正确':'回答错误',`expandResult:${i}`,h.answers[i]===questions[i].answer?'star':'error')}${expandedResults.has(i)?`<div class="answer">${(questions[i].options||[]).map((s,n)=>`<p>${String.fromCharCode(65+n)}. ${esc(s)}</p>`).join('')}<p>你的答案：${esc(h.answers[i]||'未作答')}</p><strong>参考答案：${esc(questions[i].answer)}</strong><p>${esc(questions[i].analysis)}</p></div>`:''}</div>`).join('')}${btn('完成并返回','back','primary')}`;}
}
};render();

