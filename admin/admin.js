const names = Object.freeze({'skymyth':'天空传说','last-defense':'人类大战僵尸','pocket-piano':'掌上钢琴','kfc-order':'KFC自动点餐','qingci':'词间','question-bank':'智能题库'});
const statusNames = Object.freeze({new:'待处理',in_progress:'处理中',resolved:'已解决',rejected:'暂不采纳'});

export function mountAdmin(cloudbase, config) {
  const $ = id => document.getElementById(id);
  let app, auth, permissions, currentReport, nextCursor = null, requestEpoch = 0;
  const stateMessage = (message, bad=false) => { $('admin-status').textContent=message; $('admin-status').className='form-status'+(bad?' error':''); };
  const clearPrivateView = () => { ++requestEpoch; permissions=null;currentReport=null;nextCursor=null; $('report-list').replaceChildren();$('report-message').textContent='';$('report-contact').textContent='';$('account-id').value='';$('report-detail').hidden=true;$('inbox-panel').hidden=true;$('permission-panel').hidden=true; };
  const errorText = code => ({unauthenticated:'登录已失效，请重新登录。',forbidden:'此账号没有操作该产品的权限。',revision_conflict:'这条反馈已被其他管理员更新。请刷新后再处理。',not_found:'这条反馈已无法读取，请刷新列表。',validation:'请核对填写的处理结果。'}[code] || '服务暂时无法完成请求，请稍后重试。');
  async function call(data) {
    const response=await app.callFunction({name:config.functionName,data,parse:true});
    let body=response.result; if(typeof body==='string')body=JSON.parse(body);
    if(!body||body.ok!==true){const error=new Error('admin_request_failed');error.code=body?.error?.code||'unavailable';throw error;}return body;
  }
  function sourceOptions() {
    $('source-filter').replaceChildren(new Option('新信箱','website'));
    if($('product-filter').value==='qingci')$('source-filter').add(new Option('词间应用反馈','qingci'));
    if($('product-filter').value==='question-bank')$('source-filter').add(new Option('题库应用反馈','sqb'));
  }
  async function checkSession() {
    clearPrivateView(); const epoch=requestEpoch, {data,error}=await auth.getSession();
    if(epoch!==requestEpoch)return;
    if(error||!data?.session||!data?.user){$('login-panel').hidden=false;$('logout').hidden=true;return;}
    $('logout').hidden=false; const me=await call({action:'whoami'});
    if(epoch!==requestEpoch)return;
    if(!me.identity?.uid||!Array.isArray(me.permissions?.productIds))throw new Error('invalid_identity');
    permissions=me.permissions;
    $('login-panel').hidden=true;
    if(!permissions.productIds.length){$('permission-panel').hidden=false;$('account-id').value=me.identity.uid;stateMessage('账号已登录，管理权限尚未开通。');return;}
    $('product-filter').replaceChildren(...permissions.productIds.filter(id=>Object.hasOwn(names,id)).map(id=>new Option(names[id],id)));
    if(!$('product-filter').options.length)throw new Error('invalid_scope');
    $('inbox-panel').hidden=false;sourceOptions();stateMessage('');await list();
  }
  async function list(cursor=null) {
    const epoch=++requestEpoch;currentReport=null;$('report-detail').hidden=true;$('report-message').textContent='';$('report-contact').textContent='';$('report-list').replaceChildren();$('list-status').textContent='正在读取…';$('next-page').hidden=true;
    try{
      const body=await call({action:'list',productId:$('product-filter').value,source:$('source-filter').value,limit:20,...(cursor?{cursor}:{})});
      if(epoch!==requestEpoch)return;
      if(!Array.isArray(body.reports))throw new Error('invalid_list');
      for(const report of body.reports){if(report.productId!==$('product-filter').value||report.source!==$('source-filter').value)throw new Error('scope_mismatch');}
      for(const report of body.reports){
        const button=document.createElement('button');button.type='button';button.className='report-item';button.setAttribute('aria-pressed','false');
        const title=document.createElement('strong');title.textContent=String(report.message||'').slice(0,90);
        const meta=document.createElement('span');meta.textContent=`${statusNames[report.processing?.status]||'待处理'} · ${formatTime(report.createdAt)}`;
        button.append(title,meta);button.addEventListener('click',()=>detail(report,button));$('report-list').append(button);
      }
      nextCursor=typeof body.nextCursor==='string'&&body.nextCursor?body.nextCursor:null;$('next-page').hidden=!nextCursor;$('list-status').textContent=body.reports.length?'':'当前没有反馈。';
    }catch(error){if(epoch===requestEpoch)$('list-status').textContent=errorText(error.code);}
  }
  async function detail(report, button) {
    const epoch=++requestEpoch;currentReport=null;$('report-detail').hidden=true;$('report-message').textContent='';$('report-contact').textContent='';
    try{const body=await call({action:'detail',productId:report.productId,source:report.source,reportId:report.reportId});if(epoch!==requestEpoch)return;
      const value=body.report;if(!value||value.productId!==report.productId||value.source!==report.source||value.reportId!==report.reportId)throw new Error('identity_mismatch');
      currentReport=value;$('report-title').textContent=names[value.productId]+' · 反馈详情';$('report-meta').textContent=`${formatTime(value.createdAt)} · ${value.version?'版本 '+value.version:'版本未填写'}`;$('report-message').textContent=value.message||'';$('report-contact').textContent=value.contact?'联系方式：'+value.contact:'未留下联系方式';
      const form=$('process-form');form.elements.status.value=value.processing?.status||'new';form.elements.releaseVersion.value=value.processing?.releaseVersion||'';form.elements.evidenceRef.value=value.processing?.evidenceRef||'';form.querySelector('button').disabled=!permissions.actions?.includes('process');$('process-status').textContent='';$('report-detail').hidden=false;document.querySelectorAll('.report-item').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
    }catch(error){if(epoch===requestEpoch)stateMessage(errorText(error.code),true);}
  }
  $('process-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!currentReport||!permissions?.actions?.includes('process'))return;
    const report=currentReport,epoch=requestEpoch,form=event.currentTarget,button=form.querySelector('button');const status=form.elements.status.value,releaseVersion=form.elements.releaseVersion.value.trim(),evidenceRef=form.elements.evidenceRef.value.trim();
    if(status==='resolved'&&(!releaseVersion||!evidenceRef)){$('process-status').textContent='标记已解决时，请填写修复版本和验证记录。';return;}
    button.disabled=true;$('process-status').className='form-status';$('process-status').textContent='正在保存…';
    try{const body=await call({action:'process',productId:report.productId,source:report.source,reportId:report.reportId,expectedRevision:report.processing?.revision||0,status,releaseVersion,evidenceRef});if(epoch!==requestEpoch||currentReport!==report)return;
      if(!body.processing||body.processing.revision!==(report.processing?.revision||0)+1)throw new Error('invalid_processing');report.processing=body.processing;$('process-status').className='form-status success';$('process-status').textContent='处理结果已保存。';
    }catch(error){if(epoch===requestEpoch){$('process-status').className='form-status error';$('process-status').textContent=errorText(error.code);}}finally{if(epoch===requestEpoch)button.disabled=false;}
  });
  $('product-filter').addEventListener('change',()=>{sourceOptions();list();});$('source-filter').addEventListener('change',()=>list());$('refresh-inbox').addEventListener('click',()=>list());$('next-page').addEventListener('click',()=>nextCursor&&list(nextCursor));
  $('logout').addEventListener('click',async()=>{clearPrivateView();$('logout').hidden=true;$('login-panel').hidden=false;stateMessage('已退出。');try{await auth.signOut({options:{clearStorage:true}});}catch{stateMessage('已清空本页内容。退出请求未完成，请关闭本页后重试。',true);}});
  $('login-form').addEventListener('submit',async event=>{event.preventDefault();if(!config.enabled)return;const form=event.currentTarget,button=$('login-submit');button.disabled=true;stateMessage('正在登录…');
    try{const {error}=await auth.signInWithPassword({username:form.elements.username.value.trim(),password:form.elements.password.value});form.elements.password.value='';if(error)throw new Error('login_failed');await checkSession();}
    catch{form.elements.password.value='';clearPrivateView();$('login-panel').hidden=false;stateMessage('登录或权限验证未完成，请核对账号后重试。',true);}finally{button.disabled=false;}
  });
  if(!config.enabled){$('login-submit').disabled=true;stateMessage('管理信箱正在接入，暂未开放登录。');return;}
  app=cloudbase.init({env:config.environmentId,persistence:'session',debug:false,auth:{detectSessionInUrl:false}});auth=app.auth;
  checkSession().catch(()=>{clearPrivateView();$('login-panel').hidden=false;stateMessage('暂时无法验证登录状态，请稍后重试。',true);});
}
function formatTime(value){const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('zh-CN'):'时间未记录';}
