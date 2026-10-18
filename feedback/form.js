(function () {
  'use strict';
  // Read then erase private URL content before any asynchronous setup or fetch.
  const privateFragment = location.hash;
  let fragmentClearFailed = false;
  if (privateFragment) {
    try { const clean = new URL(location.href); clean.hash = ''; history.replaceState(null, '', clean.pathname + clean.search); }
    catch { fragmentClearFailed = true; }
  }
  const ENDPOINT = 'https://xiaozhan-feedback-d1d5oh63be3b3b.api.tcloudbasegateway.com/v1/functions/qingci-feedback';
  const IDs = new Set(['website', 'skymyth', 'pocket-piano', 'mianji', 'qingci', 'question-bank', 'stardew-farm', 'resume-studio', 'yuji', 'subtitle-studio', 'electric-drive']);
  const $ = id => document.getElementById(id);
  const form = $('form'), select = $('product'), message = $('answer'), contact = $('contact'), submit = $('submit');
  const versions = new Map(), states = new Map();
  const count = text => Array.from(text).length;
  const encoder = new TextEncoder();
  const controlsInText = value => /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value);
  const controlsInLine = value => /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value);
  function unicodeValid(value) {
    for(let i=0;i<value.length;i++) { const code=value.charCodeAt(i); if(code>=0xd800&&code<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return false;}else if(code>=0xdc00&&code<=0xdfff)return false; }
    return true;
  }
  function strictStringObject(raw) {
    let at=0;const result=Object.create(null),seen=new Set();
    const whitespace=()=>{while(/[\t\r\n ]/.test(raw[at]||'\0'))at++;};
    const string=()=>{if(raw[at]!== '"')throw Error('invalid_handoff');const start=at++;while(at<raw.length){const char=raw[at++];if(char==='"'){const value=JSON.parse(raw.slice(start,at));if(!unicodeValid(value))throw Error('invalid_handoff');return value;}if(char==='\\')at++;else if(char.charCodeAt(0)<32)throw Error('invalid_handoff');}throw Error('invalid_handoff');};
    whitespace();if(raw[at++]!=='{')throw Error('invalid_handoff');whitespace();
    if(raw[at]!=='}')while(true){whitespace();const key=string();if(seen.has(key)||!['schema','productId','text','contact','version','source'].includes(key))throw Error('invalid_handoff');seen.add(key);whitespace();if(raw[at++]!==':')throw Error('invalid_handoff');whitespace();result[key]=string();whitespace();if(raw[at]==='}')break;if(raw[at++]!==',')throw Error('invalid_handoff');}
    at++;whitespace();if(at!==raw.length||seen.size!==6)throw Error('invalid_handoff');return result;
  }
  function incomingFragment(query, legacy, value=privateFragment, clearFailed=fragmentClearFailed) {
    if(!value)return null;
    if(clearFailed)throw Error('fragment_clear_failed');
    if(value.length>65570)throw Error('invalid_handoff');
    const fragment=new URLSearchParams(value.slice(1));
    if(fragment.has('handoff')) {
      if([...fragment.keys()].length!==1||fragment.getAll('handoff').length!==1||query.getAll('product').length!==1||!IDs.has(query.get('product')))throw Error('invalid_handoff');
      const encoded=fragment.get('handoff');if(!encoded||encoded.length>21846||!/^[A-Za-z0-9_-]+$/.test(encoded)||encoded.length%4===1)throw Error('invalid_handoff');
      const binary=atob(encoded.replace(/-/g,'+').replace(/_/g,'/'));if(binary.length>16384||btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')!==encoded)throw Error('invalid_handoff');
      const raw=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0))),value=strictStringObject(raw);
      if(value.schema!=='website-feedback-handoff/v1'||value.productId!==query.get('product')||value.source!=='app'||count(value.text)>4000||encoder.encode(value.text).length>12288||controlsInText(value.text)||count(value.contact)>160||controlsInLine(value.contact)||count(value.version)>80||controlsInLine(value.version))throw Error('invalid_handoff');
      return value;
    }
    if(fragment.has('answer')) {
      if([...fragment.keys()].length!==1||fragment.getAll('answer').length!==1||query.getAll('product').length>1)throw Error('invalid_handoff');
      const productId=query.get('product')||(legacy?'qingci':'website'),text=fragment.get('answer');
      if(!IDs.has(productId)||!unicodeValid(text)||count(text)>4000||encoder.encode(text).length>12288||controlsInText(text))throw Error('invalid_handoff');
      return {schema:'legacy-answer',productId,text,contact:'',version:'',source:'app-center'};
    }
    return null;
  }
  let client, active = '', busy = false, switching = false, saveTimer, dirty = false, queue = Promise.resolve();

  function status(text, kind = '') { $('status').textContent = text; $('status').className = 'status' + (kind ? ' ' + kind : ''); }
  function fieldError(name, text) {
    const field = name === 'message' ? message : name === 'contact' ? contact : select;
    const note = $(name + '-error'); note.textContent = text; note.hidden = !text;
    if (text) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
  }
  function counters() { $('message-count').textContent = count(message.value) + ' / 4000'; }
  function controls() {
    select.disabled = !client || busy || switching;
    message.readOnly = contact.readOnly = busy || switching || !active;
    submit.disabled = !client || !active || busy || switching;
    $('clear-draft').disabled = !client || !active || busy || switching || (!message.value && !contact.value);
    submit.textContent = busy ? '正在确认送达…' : switching ? '正在恢复草稿…' : '发送反馈';
  }
  function storage(state, saved = false) {
    if (!state?.storage) return;
    $('draft-state').textContent = (saved && state.storage.mode === 'encrypted' ? '草稿已加密保存。' : '') + state.storage.notice;
  }
  function updateVersion() {
    const native=states.get(active)?.draft?.context;
    if(native?.source==='app'){ $('product-version').textContent='来自产品的实际版本：'+(native.version||'未提供');return; }
    const version = versions.get(active) || '';
    $('product-version').textContent = active === 'website' ? '关于网站访问、下载或整体体验。' : active ? (version ? '网站当前版本：' + version : '版本暂未读取，反馈仍可发送。') : '';
  }
  function reasonText(reason) {
    if (reason === 'timeout') return '连接超时，尚未确认送达。';
    if (reason === 'network') return '网络连接中断，尚未确认送达。';
    if (reason === 'ack_mismatch') return '未取得与这条反馈匹配的收件回执。';
    if (reason === 'http_429') return '服务繁忙，尚未确认送达。';
    return '尚未取得收件确认。';
  }
  function renderPending(state) {
    const list = $('pending-list'); list.replaceChildren();
    const attempts = state?.attempts || [], savedDrafts=state?.savedDrafts||[]; $('pending').hidden = !attempts.length&&!savedDrafts.length;
    for(const saved of savedDrafts){
      const item=document.createElement('article');item.className='pending-item';const title=document.createElement('h3');title.textContent='保留的其他草稿';
      const details=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('pre');summary.textContent='查看保留内容';text.textContent=saved.message;details.append(summary,text);
      const restore=document.createElement('button');restore.type='button';restore.textContent='切换到这份草稿';restore.disabled=busy||switching;
      restore.addEventListener('click',async()=>{if(busy||switching||!client)return;switching=true;controls();try{await flush();display(await client.restoreSavedDraft(active),true);updateVersion();status('已切换草稿，上一份仍加密保留；尚未发送。');}catch(error){failure(error);}finally{switching=false;controls();renderPending(states.get(active));}});
      item.append(title,details,restore);list.append(item);
    }
    for (const attempt of attempts.slice().reverse()) {
      const item = document.createElement('article'); item.className = 'pending-item';
      const title = document.createElement('h3'); title.textContent = attempt.state === 'uncertain' ? '送达未确认' : attempt.state === 'conflict' ? '编号冲突' : '服务未接收';
      const note = document.createElement('p'); note.textContent = attempt.state === 'uncertain' ? reasonText(attempt.reason) : attempt.state === 'conflict' ? '同一编号对应的内容有冲突，请先编辑内容后再发送。旧记录仍保留。' : '这次请求被服务拒绝，内容仍保留。请检查内容后再发送。';
      const id = document.createElement('code'); id.textContent = attempt.payload.requestId;
      const details = document.createElement('details'), summary = document.createElement('summary'), text = document.createElement('pre');
      summary.textContent = '查看这条反馈'; text.textContent = attempt.payload.message; details.append(summary, text);
      const actions = document.createElement('div'); actions.className = 'pending-actions';
      if (attempt.state === 'uncertain') {
        const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '使用原编号重试'; retry.disabled = busy || switching;
        retry.addEventListener('click', () => retryAttempt(attempt.payload.requestId)); actions.append(retry);
      }
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = '用这份内容编辑'; edit.disabled = busy || switching;
      edit.addEventListener('click', () => restoreAttempt(attempt)); actions.append(edit);
      item.append(title, note, id, details, actions); list.append(item);
    }
  }
  function display(state, fill = false) {
    if (!state) return;
    states.set(active, state);
    if (fill) { message.value = state.draft.message; contact.value = state.draft.contact; dirty = false; }
    storage(state); renderPending(state); counters(); controls();
    updateVersion();
  }
  function saveDraft(productId = active, text = message.value, address = contact.value) {
    if (!client || !productId) return Promise.resolve();
    const next = queue.then(() => client.setDraft(productId, text, address)).then(state => {
      states.set(productId, state);
      if (active === productId) { storage(state, true); renderPending(state); }
      if (active === productId && message.value === text && contact.value === address) dirty = false;
      return state;
    });
    queue = next.catch(() => { if (active === productId) status('草稿暂时未能保存，文字仍保留在当前页面。请勿刷新。', 'error'); });
    return next;
  }
  async function flush() { clearTimeout(saveTimer); if (dirty) await saveDraft(); await queue; }
  function validate() {
    const messageLength = count(message.value), contactLength = count(contact.value);
    const productError = active ? '' : '请选择反馈对应的网站或产品。';
    const messageError = !message.value.trim() || messageLength < 3 || messageLength > 4000 ? '请填写 3–4000 字的反馈内容。' : '';
    const contactError = contactLength > 160 ? '联系方式不能超过 160 字。' : '';
    fieldError('product', productError); fieldError('message', messageError); fieldError('contact', contactError);
    if (productError || messageError || contactError) {
      status('内容尚未发送，请按提示检查后重试。', 'error');
      (productError ? select : messageError ? message : contact).focus(); return false;
    }
    return true;
  }
  function handleOutcome(result) {
    if (result.state) display(result.state);
    if (result.kind === 'accepted') {
      $('receipt').hidden = false;
      $('receipt-id').textContent = result.payload.requestId;
      $('receipt-message').textContent = result.receiptStatus === 'duplicate' ? '这条反馈已经收到，本次没有重复收件。' : '谢谢，你的反馈已保存到开发者信箱。';
      if (result.clearedDraft) { message.value = ''; contact.value = ''; dirty = false; }
      status('已收到，反馈编号见上方。', 'success');
      $('receipt').focus();
    } else if (result.kind === 'uncertain') {
      status(reasonText(result.reason) + '文字和原编号仍保留，请使用原编号重试。', 'error');
    } else if (result.kind === 'conflict') {
      status('编号冲突，当前内容尚未确认接收。请编辑内容后再发送，原记录仍保留。', 'error');
    } else if (result.kind === 'rejected') {
      status('服务未接收这条反馈。内容仍保留，请检查反馈文字后再发送。', 'error');
    } else if (result.kind === 'invalid_input') {
      const issue = result.reason === 'contact_length' ? '联系方式不能超过 160 字。' : result.reason === 'invalid_text' ? '请移除文字中的不可见控制字符。' : result.reason === 'message_bytes' || result.reason === 'body_bytes' ? '反馈含有较多特殊字符，请缩短后再发送。' : '请检查文字长度与字符，反馈最多 4000 字。';
      status(issue + '本次尚未发送，内容仍保留。', 'error');
    } else if (result.kind === 'queue_full') {
      status('待确认记录已达到本机保存上限，请先重试已有记录。当前草稿仍保留。', 'error');
    } else if (result.kind === 'busy') {
      status('这条反馈正在确认送达，请稍候。');
    } else {
      status('尚未确认送达，内容仍保留，请稍后重试。', 'error');
    }
    counters();
  }
  function failure(error) {
    status(error?.message === 'endpoint_unavailable' ? '反馈服务暂时不可用，内容仍保留。请稍后重试。' : '暂时无法完成操作，内容仍保留。请稍后重试。', 'error');
  }
  async function retryAttempt(id) {
    if (busy || switching || !client || !active) return;
    busy = true; controls(); renderPending(states.get(active)); status('正在使用原编号确认送达…');
    try { await flush(); handleOutcome(await client.retry(active, id, ENDPOINT)); }
    catch (error) { failure(error); }
    finally { busy = false; controls(); renderPending(states.get(active)); }
  }
  async function restoreAttempt(attempt) {
    if (busy || switching || !client || !active) return;
    if ((message.value || contact.value) && (message.value !== attempt.payload.message || contact.value !== attempt.payload.contact)) {
      status('请先复制或清空当前草稿，再用这条内容编辑；当前文字已保留。', 'error'); return;
    }
    switching = true; controls();
    try {
      await flush();
      if (client.restoreAttempt) display(await client.restoreAttempt(active, attempt.payload.requestId), true);
      else { message.value = attempt.payload.message; contact.value = attempt.payload.contact; dirty = true; await saveDraft(); counters(); }
      status('已恢复这条内容。编辑后发送会使用新的编号，旧待确认记录仍保留。');
      message.focus();
    } catch (error) { failure(error); }
    finally { switching = false; controls(); renderPending(states.get(active)); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || switching || !client || !validate()) return;
    busy = true; controls(); $('receipt').hidden = true; renderPending(states.get(active)); status('正在发送，请等候收件确认…');
    try {
      await flush();
      const native=states.get(active)?.draft?.context;
      handleOutcome(await client.submit({ productId: active, version: native?.source==='app'?native.version:versions.get(active)||'', source:native?.source==='app'?'app':'app-center', message: message.value, contact: contact.value, endpoint: ENDPOINT }));
    } catch (error) { failure(error); }
    finally { busy = false; controls(); renderPending(states.get(active)); }
  });
  for (const field of [message, contact]) field.addEventListener('input', () => {
    dirty = true; clearTimeout(saveTimer); fieldError(field === message ? 'message' : 'contact', ''); counters(); controls();
    if (client && active) { $('draft-state').textContent = '正在保存草稿…'; saveTimer = setTimeout(() => saveDraft().catch(() => {}), 200); }
  });
  select.addEventListener('change', async () => {
    if (busy || switching || !client) return;
    const previous = active, next = IDs.has(select.value) ? select.value : '';
    switching = true; controls(); $('receipt').hidden = true;
    try {
      await flush(); active = next;
      $('source-note').hidden = true;
      if (next) { const nextState=await client.get(next);display(await client.setDraft(next,nextState.draft.message,nextState.draft.contact,null),true); }
      else { message.value = ''; contact.value = ''; $('pending').hidden = true; $('draft-state').textContent = ''; }
      fieldError('product', ''); updateVersion();
      const url = new URL(location.href); if (next) url.searchParams.set('product', next); else url.searchParams.delete('product');
      history.replaceState(null, '', url.pathname + url.search); status('');
    } catch (error) { active = previous; select.value = previous; failure(error); }
    finally { switching = false; controls(); renderPending(states.get(active)); }
  });
  $('clear-draft').addEventListener('click', async () => {
    if (busy || switching || !client || !active) return;
    switching = true; controls();
    try { await flush(); display(await client.clearDraft(active), true); status('当前草稿已清空，待确认与未发送的反馈仍保留。'); }
    catch (error) { failure(error); }
    finally { switching = false; controls(); renderPending(states.get(active)); }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty) { clearTimeout(saveTimer); saveDraft().catch(() => {}); } });
  window.addEventListener('beforeunload', event => {
    if (busy || dirty || ((message.value || contact.value) && states.get(active)?.storage?.mode !== 'encrypted')) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('hashchange', async () => {
    const raw=location.hash;if(!raw)return;let clearingFailed=false;
    try{const clean=new URL(location.href);clean.hash='';history.replaceState(null,'',clean.pathname+clean.search);}catch{clearingFailed=true;}
    let incoming;
    try{incoming=incomingFragment(new URLSearchParams(location.search),document.body.dataset.legacyFeedback==='qingci',raw,clearingFailed);}
    catch{status('来自产品或链接的草稿格式、长度或反馈对象不匹配，未导入也未发送。','error');return;}
    if(!incoming)return;
    const apply=async()=>{
      if(!client||busy||switching){status('当前操作仍在进行，这份 APP 草稿尚未导入。请稍候点击重新导入。','error');return false;}
      if(active!==incoming.productId){status('请先选择原 APP 对应的反馈对象，再重新导入。','error');return false;}
      switching=true;controls();
      try{await flush();display(await client.importDraft(active,incoming.text,incoming.contact,incoming.version,incoming.source),true);$('source-note').hidden=false;$('source-note').textContent='已带入 APP 草稿，请核对后点击发送。';status(states.get(active)?.storage?.mode==='encrypted'?'草稿已加密导入，尚未发送。':'草稿已带入当前页面，但此浏览器未能加密保存；关闭前请复制保留。尚未发送。');return true;}
      catch(error){status(error?.message==='protected_draft_limit'?'已有一份保留草稿，当前内容仍保留。请先发送或清空当前草稿，再重新导入 APP 草稿。':'草稿未能导入，原内容仍保留，请重试。','error');return false;}
      finally{switching=false;controls();renderPending(states.get(active));}
    };
    if(!await apply()){
      $('source-note').hidden=false;$('source-note').textContent='APP 草稿尚未导入，原内容没有被覆盖。';
      const retry=document.createElement('button');retry.type='button';retry.textContent='重新导入 APP 草稿';retry.addEventListener('click',async()=>{if(await apply())retry.remove();});$('source-note').append(retry);
    }
  });

  async function catalog() {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('/catalog/products.json', { credentials: 'omit', cache: 'no-cache', signal: controller.signal });
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data.products)) return;
      for (const product of data.products) {
        const value = typeof product.webVersion === 'string' ? product.webVersion : product.version;
        if (IDs.has(product.id) && typeof value === 'string' && count(value) <= 80 && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value)) versions.set(product.id, value);
      }
    } catch {} finally { clearTimeout(timer); }
    updateVersion();
  }
  async function init() {
    const query = new URLSearchParams(location.search), requested = query.get('product');
    const legacy = document.body.dataset.legacyFeedback === 'qingci';
    let incoming=null, incomingProblem='';
    try { incoming=incomingFragment(query,legacy); }
    catch { incomingProblem='来自产品或链接的草稿格式、长度或反馈对象不匹配，未导入也未发送。'; }
    active = requested === null ? (legacy ? 'qingci' : 'website') : query.getAll('product').length===1&&IDs.has(requested) ? requested : '';
    select.value = active;
    if (legacy || query.get('source') === 'beidanci-qr') {
      $('source-note').hidden = false; $('source-note').textContent = active === 'qingci' ? '从背单词旧二维码进入，反馈对象已选为背单词。你也可以切换到其他产品。' : '从背单词旧二维码进入，请核对下方反馈对象。';
    } else if (query.get('source') === 'product') {
      $('source-note').hidden = false; $('source-note').textContent = '从产品体验页进入；其他产品也可以在下方切换。';
    }
    if (!active) fieldError('product', '这个产品标识已失效，请重新选择反馈对象。');
    const catalogReady = catalog();
    try {
      if (!window.AppCenterFeedback?.create) throw new Error('client_unavailable');
      client = await window.AppCenterFeedback.create();
      await catalogReady;
      // Wait for browser form restoration before filling from the encrypted vault.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (active) {
        const restoredMessage = message.value, restoredContact = contact.value, state = await client.get(active);
        if(incoming&&incoming.productId===active) {
          try {
            display(await client.importDraft(active,incoming.text,incoming.contact,incoming.version,incoming.source),true);
            $('source-note').hidden=false;$('source-note').textContent=incoming.source==='app'?'已从 APP 带入草稿，请核对后点击发送。':'已带入旧链接的反馈草稿，请核对后点击发送。';
            incomingProblem=states.get(active)?.storage?.mode==='encrypted'?'草稿已加密导入，尚未发送。':'草稿已带入当前页面，但此浏览器未能加密保存；关闭前请复制保留。尚未发送。';
          } catch(error) {
            display(state,true);
            incomingProblem=error?.message==='protected_draft_limit'?'已有一份保留草稿，当前内容已保留。请先发送或清空当前草稿，再用下方入口重新导入 APP 草稿。':'草稿尚未导入，原浏览器内容仍保留，请重试。';
            $('source-note').hidden=false;$('source-note').textContent='新 APP 草稿尚未导入，当前浏览器草稿没有被覆盖。';
            const retry=document.createElement('button');retry.type='button';retry.textContent='重新导入 APP 草稿';
            retry.addEventListener('click',async()=>{if(busy||switching)return;if(active!==incoming.productId){status('请先选择原 APP 对应的反馈对象，再重新导入。','error');return;}switching=true;controls();try{await flush();display(await client.importDraft(active,incoming.text,incoming.contact,incoming.version,incoming.source),true);status(states.get(active)?.storage?.mode==='encrypted'?'APP 草稿已加密导入，尚未发送。':'APP 草稿仅保留当前页面，尚未加密保存或发送。');retry.remove();}catch(error){failure(error);}finally{switching=false;controls();renderPending(states.get(active));}});
            $('source-note').append(retry);
          }
        } else if(incomingProblem) display(state,true);
        else if (restoredMessage || restoredContact) { dirty = true; await saveDraft(active, restoredMessage, restoredContact); display(states.get(active)); }
        else display(state, true);
      }
      status(incomingProblem||(active ? '' : '请选择反馈对象后填写内容。'),incomingProblem&&incoming===null?'error':'');
      if (legacy) {
        const url = new URL(location.href); url.pathname = '/feedback/'; if (active) url.searchParams.set('product', active); url.searchParams.set('source', 'beidanci-qr');
        history.replaceState(null, '', url.pathname + url.search);
      }
    } catch { status('反馈表单暂时未能准备好，当前文字尚未发送。请稍后重新打开。', 'error'); $('draft-state').textContent = '当前文字只在这个页面，关闭前请自行复制保留。'; }
    finally { counters(); updateVersion(); controls(); }
  }
  init();
})();
