// CloudBase PG adapter. All privileged database and storage actions are enforced by RLS.
(() => {
  const config=window.TEAM_CLOUDBASE_CONFIG || {};
  let app, member=false, transientToken='';
  function receiptToken(){
    const key='team-board-anonymous-feedback-receipt-v1';
    try { const old=localStorage.getItem(key); if(/^[0-9a-f]{64}$/.test(old || '')) return old; } catch (_) {}
    if(!transientToken){const bytes=crypto.getRandomValues(new Uint8Array(32));transientToken=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
    try {localStorage.setItem(key,transientToken);} catch (_) {}
    return transientToken;
  }
  async function myFeedback(){
    const rows=checked(await ready().rdb().rpc('team_read_anon_feedback',{p_token:receiptToken()})) || [];
    return rows.map(f=>({...f,id:Number(f.id),author:'匿名',releases:(f.releases||[]).map(r=>({id:Number(r.id),name:r.name}))}));
  }
  const checked = result => {
    if(result.error) throw new Error(result.error.message || '云端操作失败');
    return result.data;
  };
  function ready(){
    if(!window.cloudbase || !config.env || !config.publishableKey) throw new Error('CloudBase 尚未配置');
    if(!app) app=window.cloudbase.init({env:config.env,accessKey:config.publishableKey});
    return app;
  }
  async function all(table,order='id'){
    const db=ready().rdb(), collected=[];
    for(let offset=0;;offset+=500){
      let query=db.from(table).select('*').order(order,{ascending:true});
      if(table==='team_release_feedback') query=query.order('feedback_id',{ascending:true});
      const rows=checked(await query.range(offset,offset+499)) || [];
      collected.push(...rows);
      if(rows.length<500) break;
    }
    return collected;
  }
  // Fetch the public versions and the permitted feedback independently.
  let pendingVersions=null, pendingFeedback=null, feedbackEpoch=0;
  let latestVersions=[], latestFeedback=[];
  function reconcileLinks(){
    const versions=new Map(latestVersions.map(v=>[v.id,v]));
    for(const f of latestFeedback){
      f.releases=(f.releases||[]).map(v=>({id:Number(v.id),name:versions.get(Number(v.id))?.name || v.name || ('版本 #'+v.id)}));
    }
    for(const v of latestVersions){
      v.feedback_ids=latestFeedback.filter(f=>(f.releases||[]).some(r=>Number(r.id)===v.id)).map(f=>f.id);
    }
  }
  function readVersions(){
    if(!pendingVersions) pendingVersions=(async()=>{
      const versions=await all('team_releases');
      latestVersions=versions.map(r=>({...r,id:Number(r.id),parent_id:r.parent_id===null?null:Number(r.parent_id),feedback_ids:[]}));
      reconcileLinks();
      return latestVersions;
    })().finally(()=>{pendingVersions=null;});
    return pendingVersions;
  }
  function readFeedback(){
    const epoch=feedbackEpoch, isMember=member;
    if(!pendingFeedback || pendingFeedback.epoch!==epoch){
      const promise=(async()=>{
        let feedback;
        if(isMember){
          const [messages,links]=await Promise.all([all('team_feedback'),all('team_release_feedback','release_id')]);
          feedback=messages.map(f=>({...f,id:Number(f.id),releases:links.filter(x=>Number(x.feedback_id)===Number(f.id)).map(x=>({id:Number(x.release_id)}))})).reverse();
        } else feedback=await myFeedback();
        if(epoch!==feedbackEpoch) throw new Error('登录状态已改变，请重新读取留言');
        latestFeedback=feedback;reconcileLinks();
        return feedback;
      })().finally(()=>{if(pendingFeedback?.promise===promise) pendingFeedback=null;});
      pendingFeedback={epoch,promise};
    }
    return pendingFeedback.promise;
  }
  function resetFeedback(){feedbackEpoch++;latestFeedback=[];reconcileLinks();}
  async function signIn(username,password){
    const current=ready(), result=await current.auth.signInWithPassword({username,password});
    checked(result);
    try{
      const members=checked(await current.rdb().from('team_members').select('user_id').limit(1)) || [];
      if(!members.length) throw new Error('该账号尚未获得班组成员授权');
      const admins=checked(await current.rdb().from('team_admins').select('user_id').limit(1)) || [];
      member=true;resetFeedback();
      return {isAdmin:admins.length>0};
    }catch(e){member=false;resetFeedback();await current.auth.signOut();throw e;}
  }
  async function signOut(){if(app){const result=await app.auth.signOut();if(result) checked(result);}member=false;resetFeedback();}
  async function addMember(userId,displayName){
    if(!userId || userId.length>64 || displayName.length>40) throw new Error('请填写有效的用户 ID 和称呼');
    checked(await ready().rdb().from('team_members').insert({user_id:userId,display_name:displayName||'班组成员'}));
  }
  async function publish(form){
    const f=form.get('file');
    if(!f || !(f instanceof File) || !/\.(zip|html)$/i.test(f.name) || !f.size || f.size>80*1024*1024) throw new Error('请选择不超过 80 MB 的 ZIP 或 HTML 文件');
    const ids=JSON.parse(String(form.get('feedback_ids')||'[]'));
    if(!Array.isArray(ids)||ids.length>100||ids.some(x=>!Number.isInteger(x))) throw new Error('关联留言无效');
    const key='releases/'+crypto.randomUUID()+f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    const bucket=ready().storage.from(config.bucket || 'team-releases');
    checked(await bucket.upload(key,f,{contentType:'application/octet-stream'}));
    try{
      const id=checked(await ready().rdb().rpc('team_publish_release',{
        p_name:String(form.get('name')||'').trim(),p_parent:form.get('parent_id')?Number(form.get('parent_id')):null,
        p_status:String(form.get('status')||''),p_notes:String(form.get('notes')||'').trim(),
        p_storage_key:key,p_display_name:f.name,p_feedback_ids:ids
      }));
      if(!id) throw new Error('版本登记没有返回结果');
      return {id:Number(id)};
    }catch(e){
      // This key was generated solely for this failed upload; never remove an existing version.
      try{await bucket.remove([key]);}catch(_){}
      throw e;
    }
  }
  async function api(path,options={}){
    if(path==='/api/health'){
      checked(await ready().rdb().from('team_releases').select('id').limit(1));
      return {service:'team-board',ready:true};
    }
    if(path==='/api/releases' && !options.method) return {releases:await readVersions()};
    if(path==='/api/feedback' && !options.method) return {feedback:await readFeedback()};
    const payload=options.body instanceof FormData ? options.body : JSON.parse(options.body||'{}');
    if(path==='/api/feedback' && options.method==='POST'){
      const id=checked(await ready().rdb().rpc('team_submit_anon_feedback',{p_content:String(payload.content||'').trim(),p_token:receiptToken()}));
      return {id:Number(id)};
    }
    let m=path.match(/^\/api\/admin\/feedback\/(\d+)$/);
    if(m && options.method==='POST'){
      checked(await ready().rdb().rpc('team_set_feedback',{p_id:Number(m[1]),p_status:payload.status,p_response:payload.response||''}));
      return {ok:true};
    }
    m=path.match(/^\/api\/admin\/releases\/(\d+)\/status$/);
    if(m && options.method==='POST'){
      checked(await ready().rdb().rpc('team_set_release_status',{p_id:Number(m[1]),p_status:payload.status}));
      return {ok:true};
    }
    if(path==='/api/admin/releases' && options.method==='POST') return publish(payload);
    throw new Error('不支持的操作');
  }
  async function download(item){
    if(!item || !item.storage_key) throw new Error('版本文件不可用');
    if(['seed/baseline.html','seed/current.zip'].includes(item.storage_key)){
      const response=await fetch(item.storage_key,{cache:'no-store'});
      if(!response.ok) throw new Error('版本文件暂不可用');
      return response.blob();
    }
    if(!item.storage_key.startsWith('releases/')) throw new Error('版本文件路径无效');
    return checked(await ready().storage.from(config.bucket || 'team-releases').download(item.storage_key));
  }
  window.teamCloudbase={api,signIn,signOut,addMember,download};
})();
