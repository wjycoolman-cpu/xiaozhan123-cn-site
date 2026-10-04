(() => {
 'use strict';
 const $ = s => document.querySelector(s);
 let catalog, filter = 'all', selected, activeFeedback, toastTimer;
 const feedbackClient = window.AppCenterFeedback ? window.AppCenterFeedback.create() : Promise.reject(Error('client_unavailable'));
 feedbackClient.catch(() => {});
 let feedbackSequence = 0, draftSequence = 0;
 const busyFeedback = new Set();
 const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const size = n => n ? `${(n / 1048576).toFixed(1)} MB` : '待发布';
 function safeUrl(value) { if (!value) return ''; try { const u = new URL(value, location.href); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
 function ready(p) { return ['published','available'].includes(p.state) && !!safeUrl(p.kind === 'game' ? p.playUrl : p.downloadUrl); }
 function action(p) { const url = safeUrl(p.kind === 'game' ? p.playUrl : p.downloadUrl); return ready(p) ? `<a class="button primary" href="${esc(url)}" ${p.kind === 'app' ? `download="${esc(p.filename || p.id + '.apk')}" data-download="${esc(p.id)}"` : ''}>${p.kind === 'game' ? '开始游戏' : '下载 APK'}</a>` : `<button class="button disabled" disabled>${esc(p.statusText || '准备中')}</button>`; }
 function icon(p) {
  const drawings={
   skymyth:'<path d="M12 3 14.3 9.7 21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z"/>',
   'last-defense':'<path d="M12 3 20 6v6c0 5-5 8-8 10-3-2-8-5-8-10V6Z"/><path d="M8 12h8M12 8v8"/>',
   'pocket-piano':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 13v7m6-7v7M7 4v9h3V4m4 0v9h3V4"/>',
   mianji:'<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>',
   'question-bank':'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8.5 12l2.5 2.5 4.5-5"/>'
  };
  const symbol=p.id==='qingci'?'Aa':p.id==='kfc-order'?'K':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${drawings[p.id]||''}</svg>`;
  return `<div class="product-icon" aria-hidden="true">${symbol}</div>`;
 }
 function actions(p) { return `${action(p)}<button class="text-button more-button" data-detail="${esc(p.id)}" aria-label="${esc(p.name)}的详情、分享与反馈">详情</button>`; }
 function card(p) { return `<article class="product-card ${p.kind==='game'?'game-card':'app-card'} ${esc(p.theme)}" ${p.kind==='app'&&ready(p)?`draggable="true" data-drag="${esc(p.id)}"`:''}>${icon(p)}<div class="product-content"><div class="card-heading"><h3>${esc(p.name)}</h3></div><p class="summary">${esc(p.summary)}</p>${p.version?`<p class="app-meta">${esc(p.version)} · ${size(p.sizeBytes)}</p>`:''}<div class="card-actions">${actions(p)}</div></div></article>`; }
 function render() {
  const q = $('#search').value.trim().toLocaleLowerCase();
  const list = catalog.products.filter(p => (filter === 'all' || p.kind === filter) && [p.name,...(p.aliases || []),p.category].join(' ').toLocaleLowerCase().includes(q));
  $('#game-grid').innerHTML = list.filter(p => p.kind === 'game').map(card).join('');
  $('#app-grid').innerHTML = list.filter(p => p.kind === 'app').map(card).join('');
  $('#games').hidden = !list.some(p => p.kind === 'game'); $('#apps').hidden = !list.some(p => p.kind === 'app'); $('#empty').hidden = !!list.length;
 }
 function product(id) { return catalog.products.find(p => p.id === id); }
 function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 3000); }
 function detail(p) {
  selected = p; $('#detail-content').innerHTML = `<div class="detail-identity ${esc(p.theme)}">${icon(p)}<div><h2 id="detail-title" tabindex="-1">${esc(p.name)}</h2><span class="badge ${ready(p)?'available':''}">${esc(p.statusText)}</span></div></div><p class="muted">${esc(p.summary)}</p><dl class="detail-meta"><div><dt>版本</dt><dd>${esc(p.version || '待发布')}</dd></div><div><dt>大小</dt><dd>${size(p.sizeBytes)}</dd></div><div><dt>适用设备</dt><dd>${esc(p.compatibility)}</dd></div><div><dt>类型</dt><dd>${esc(p.category)}</dd></div></dl><h3>更新说明</h3><ul class="notes">${(p.releaseNotes || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul><div class="card-actions">${action(p)}<button class="button secondary" data-share="${esc(p.id)}">分享链接</button><button class="text-button" data-feedback="${esc(p.id)}">反馈问题</button></div>`; $('#detail-dialog').showModal();$('#detail-title').focus();
 }
 function shareUrl(p) { const base = safeUrl(catalog.site.canonicalUrl) || location.href; const u = new URL(base); u.hash = `product=${encodeURIComponent(p.id)}`; return u.href; }
 async function copy(text) { try { if (!navigator.clipboard) throw Error(); await navigator.clipboard.writeText(text); return true; } catch { return false; } }
 async function share(p) { const u = shareUrl(p); if (await copy(u)) { toast('链接已复制，分享给朋友吧'); return; } $('#share-url').value = u; $('#share-dialog').showModal(); $('#share-url').select(); }
 function feedbackEndpoint(p) { return window.AppCenterFeedback?.endpoint(p.feedback?.endpoint) || ''; }
 function renderFeedbackChannel(p) { const available=!!feedbackEndpoint(p);$('#feedback-channel').hidden=available;$('#feedback-channel').textContent=available?'':'反馈通道暂未开放，可以先保存草稿。'; }
 function feedbackError() { $('#feedback-status').className='form-status'; $('#feedback-status').textContent='暂时无法更新反馈保存状态。输入仍在当前页面，请保留内容后重试。'; }
 function renderFeedbackState(p, state) {
  if(activeFeedback?.id!==p.id)return;
  renderFeedbackChannel(p);
  $('#feedback-storage').textContent=state.storage.notice;
  $('#feedback-submit').disabled=!feedbackEndpoint(p)||busyFeedback.has(p.id);
  $('#feedback-submit').textContent=busyFeedback.has(p.id)?'正在发送…':'发送反馈';
  $('#feedback-history').hidden=!state.attempts.length;
  $('#feedback-pending').innerHTML=state.attempts.map(a=>{
   const text=Array.from(a.payload.message), preview=text.slice(0,60).join('')+(text.length>60?'…':'');
   const label=a.state==='conflict'?'编号冲突':a.state==='rejected'?'服务器拒绝':'尚未确认送达';
   return `<li><p>${esc(new Date(a.payload.createdAt).toLocaleString())} · ${label}</p><p class="pending-preview">${esc(preview)}</p><div class="pending-actions"><button type="button" class="text-button" data-view-request="${esc(a.payload.requestId)}">查看并编辑</button><button type="button" class="text-button" data-retry-request="${esc(a.payload.requestId)}" ${a.state!=='uncertain'||!feedbackEndpoint(p)||busyFeedback.has(p.id)?'disabled':''}>重试原反馈</button></div></li>`;
  }).join('');
 }
 function preserveDraft() {
  if(!activeFeedback)return Promise.resolve();
  const p=activeFeedback, ticket=++draftSequence, form=$('#feedback-form');
  if(form.elements.message.disabled)return Promise.resolve();
  const message=form.elements.message.value, contact=form.elements.contact.value;
  $('#feedback-storage').textContent='正在保存草稿…';
  return feedbackClient.then(client=>client.setDraft(p.id,message,contact)).then(state=>{if(activeFeedback?.id===p.id&&ticket===draftSequence)renderFeedbackState(p,state);}).catch(()=>{if(activeFeedback?.id===p.id)feedbackError();});
 }
 async function feedback(p) {
  const saved=preserveDraft(), ticket=++feedbackSequence;
  activeFeedback=p;
  const form=$('#feedback-form');form.reset();form.elements.message.disabled=true;form.elements.contact.disabled=true;$('#clear-draft').disabled=true;$('#clear-local-feedback').disabled=true;
  $('#feedback-title').textContent=`给${p.name}反馈`;renderFeedbackChannel(p);$('#feedback-status').textContent='正在恢复本机草稿…';$('#feedback-status').className='form-status';$('#feedback-submit').disabled=true;$('#feedback-history').hidden=true;
  if($('#detail-dialog').open)$('#detail-dialog').close();$('#feedback-dialog').showModal();$('#feedback-title').focus();
  try {
   await saved;const client=await feedbackClient,state=await client.get(p.id);
   if(ticket!==feedbackSequence||activeFeedback?.id!==p.id)return;
   form.elements.message.value=state.draft.message;form.elements.contact.value=state.draft.contact;form.elements.message.disabled=false;form.elements.contact.disabled=false;$('#clear-draft').disabled=false;$('#clear-local-feedback').disabled=false;
   $('#feedback-status').textContent='';renderFeedbackState(p,state);
  } catch {if(ticket===feedbackSequence){form.elements.message.disabled=false;form.elements.contact.disabled=false;$('#clear-draft').disabled=false;$('#clear-local-feedback').disabled=false;feedbackError();$('#feedback-submit').disabled=true;}}
 }
 function outcomeText(outcome) {
  if(outcome.kind==='accepted')return `网站已确认收到，编号：${outcome.payload.requestId}${outcome.clearedDraft?'':'。新的输入仍会保留。'}`;
  if(outcome.kind==='conflict')return '服务器报告编号内容冲突。这次提交已保留；请修改内容后发送新反馈。';
  if(outcome.kind==='rejected')return '这次提交被服务器拒绝。内容和旧请求已保留，请修改内容后发送新反馈。';
  if(outcome.kind==='invalid_input'&&outcome.reason==='message_bytes')return '反馈内容超过 12 KB，请减少内容后发送。草稿已保留。';
  if(outcome.kind==='invalid_input'&&outcome.reason==='body_bytes')return '这次反馈超过 16 KB，请减少内容后发送。草稿已保留。';
  if(outcome.kind==='invalid_input'&&['invalid_version','invalid_time','invalid_fields','invalid_identity'].includes(outcome.reason))return '这次提交的产品或时间信息无效。草稿已保留，暂未发送。';
  if(outcome.kind==='invalid_input'&&outcome.reason==='invalid_text')return '内容含有无法接收的控制字符，请删除这些字符后发送。草稿已保留。';
  if(outcome.kind==='invalid_input')return '请填写 3 至 4000 字的反馈；联系方式最多 160 字。草稿已保留。';
  if(outcome.kind==='queue_full')return '此产品已保留 20 条待确认反馈。请先查看和处理旧反馈，再提交新的内容。';
  if(outcome.kind==='busy')return '这条反馈正在等待回执。';
  if(outcome.reason==='timeout')return '等待回执超时，尚未确认送达。原编号和内容已保留，可重试。';
  if(outcome.reason==='ack_mismatch')return '回执与这次反馈不匹配，尚未确认送达。原编号和内容已保留，可重试。';
  return '暂时无法确认送达。原编号和内容已保留，可稍后重试。';
 }
 async function sendFeedback(p, operation) {
  if(busyFeedback.has(p.id)||!feedbackEndpoint(p))return;
  busyFeedback.add(p.id);const form=$('#feedback-form');$('#feedback-submit').disabled=true;document.querySelectorAll('#feedback-pending [data-retry-request]').forEach(button=>button.disabled=true);$('#feedback-submit').textContent='正在发送…';$('#feedback-status').textContent='';$('#feedback-status').className='form-status';
  try {
   const client=await feedbackClient,outcome=await operation(client);
   if(activeFeedback?.id===p.id){
    $('#feedback-status').textContent=outcomeText(outcome);$('#feedback-status').className=outcome.kind==='accepted'?'form-status success':'form-status';
    if(outcome.clearedDraft&&form.elements.message.value===outcome.payload.message&&form.elements.contact.value===outcome.payload.contact)form.reset();
   }
  } catch {if(activeFeedback?.id===p.id)feedbackError();}
  finally {
   busyFeedback.delete(p.id);
   try{const client=await feedbackClient,state=await client.get(p.id);renderFeedbackState(p,state);}catch{if(activeFeedback?.id===p.id)feedbackError();}
  }
 }
 document.addEventListener('click', e => { const el=e.target.closest('button'); if(!el)return; if(el.dataset.filter){ filter=el.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));render(); } if(el.dataset.detail) detail(product(el.dataset.detail)); if(el.dataset.share) share(product(el.dataset.share)); if(el.dataset.feedback) feedback(product(el.dataset.feedback)); if(el.dataset.close) { preserveDraft(); document.getElementById(el.dataset.close).close(); } });
 document.addEventListener('dragstart',e=>{const card=e.target.closest('[data-drag]');if(!card||!e.dataTransfer)return;const p=product(card.dataset.drag),u=safeUrl(p.downloadUrl);e.dataTransfer.setData('DownloadURL',`application/vnd.android.package-archive:${p.filename||p.id+'.apk'}:${u}`);e.dataTransfer.setData('text/uri-list',u);e.dataTransfer.setData('text/plain',u);e.dataTransfer.effectAllowed='copy';});
 $('#search').addEventListener('input',()=>catalog&&render());
 $('#search-toggle').addEventListener('click',()=>{const open=$('#search-panel').hidden;$('#search-panel').hidden=!open;$('#search-toggle').setAttribute('aria-expanded',String(open));if(open)$('#search').focus();else{$('#search').value='';if(catalog)render();}});
 $('#feedback-form').addEventListener('input',()=>{$('#feedback-status').textContent='';$('#feedback-status').className='form-status';preserveDraft();});
 $('#feedback-dialog').addEventListener('cancel',preserveDraft);
 $('#feedback-dialog').addEventListener('close',()=>{if(activeFeedback)document.querySelector(`[data-detail="${activeFeedback.id}"]`)?.focus();});
 $('#clear-draft').addEventListener('click',async()=>{const p=activeFeedback,ticket=++draftSequence;$('#feedback-form').reset();try{const client=await feedbackClient,state=await client.clearDraft(p.id);if(activeFeedback?.id===p.id&&ticket===draftSequence){renderFeedbackState(p,state);$('#feedback-status').textContent=state.attempts.length?'输入已清空，旧的待确认反馈仍保留。':'输入已清空。';}}catch{feedbackError();}});
 $('#clear-local-feedback').addEventListener('click',async()=>{const p=activeFeedback,ticket=++draftSequence;$('#feedback-form').reset();try{const client=await feedbackClient,state=await client.clearProduct(p.id);if(activeFeedback?.id===p.id&&ticket===draftSequence){renderFeedbackState(p,state);$('#feedback-status').textContent=state.localClearConfirmed?'已清除此产品的本机副本。这不会撤回网站可能已收到的反馈。':'当前页面内容已清空，本机加密副本暂无法确认清除。';}}catch{feedbackError();}});
 $('#feedback-pending').addEventListener('click',async e=>{const el=e.target.closest('button');if(!el||!activeFeedback)return;const p=activeFeedback;if(el.dataset.retryRequest){await preserveDraft();return sendFeedback(p,client=>client.retry(p.id,el.dataset.retryRequest,feedbackEndpoint(p)));}if(el.dataset.viewRequest){const saved=preserveDraft(),ticket=draftSequence;await saved;if(activeFeedback?.id!==p.id||ticket!==draftSequence)return;try{const client=await feedbackClient,state=await client.restoreAttempt(p.id,el.dataset.viewRequest);if(activeFeedback?.id===p.id&&ticket===draftSequence){const form=$('#feedback-form');form.elements.message.value=state.draft.message;form.elements.contact.value=state.draft.contact;renderFeedbackState(p,state);$('#feedback-status').textContent='已载入这次反馈。改写内容后会作为新的反馈发送，旧请求仍会保留。';}}catch{feedbackError();}}});
 $('#share-copy').addEventListener('click',async()=>{if(await copy($('#share-url').value)){toast('链接已复制');$('#share-dialog').close();}else{$('#share-url').select();toast('请长按或使用 Ctrl+C 复制链接');}});
 $('#feedback-form').addEventListener('submit',e=>{e.preventDefault();const p=activeFeedback;if(!p||!feedbackEndpoint(p))return;const form=$('#feedback-form'),message=form.elements.message.value,contact=form.elements.contact.value;return sendFeedback(p,client=>client.submit({productId:p.id,version:p.version||'',message,contact,endpoint:feedbackEndpoint(p)}));});
 fetch('./catalog/products.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('catalog');return r.json();}).then(data=>{catalog=data;render();document.title=data.site.name;const admin=safeUrl(data.site.adminUrl);if(admin){$('#admin-link').href=admin;$('#admin-link').hidden=false;}const match=location.hash.match(/^#product=(.+)$/);if(match){try{const p=product(decodeURIComponent(match[1]));if(p)detail(p);}catch{}}}).catch(()=>$('#load-error').hidden=false);
})();
