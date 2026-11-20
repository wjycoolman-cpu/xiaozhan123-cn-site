// CloudBase PG adapter. All privileged database and storage actions are enforced by RLS.
(() => {
  const config=window.TEAM_CLOUDBASE_CONFIG || {};
  let app, member=false;
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
  let pendingRead=null;
  async function fetchBoth(){
    const [versions,messages,links]=await Promise.all([
      all('team_releases'),member?all('team_feedback'):Promise.resolve([]),
      member?all('team_release_feedback','release_id'):Promise.resolve([])
    ]);
    const releases=versions.map(r=>({...r,id:Number(r.id),parent_id:r.parent_id===null?null:Number(r.parent_id),
      feedback_ids:links.filter(x=>Number(x.release_id)===Number(r.id)).map(x=>Number(x.feedback_id))}));
    const feedback=messages.map(f=>({...f,id:Number(f.id),releases:links.filter(x=>Number(x.feedback_id)===Number(f.id))
      .map(x=>releases.find(r=>r.id===Number(x.release_id))).filter(Boolean).map(r=>({id:r.id,name:r.name}))})).reverse();
    return {releases,feedback};
  }
  function readBoth(){
    if(!pendingRead) pendingRead=fetchBoth().finally(()=>{pendingRead=null;});
    return pendingRead;
  }
  async function signIn(username,password){
    const current=ready(), result=await current.auth.signInWithPassword({username,password});
    checked(result);
    try{
      const members=checked(await current.rdb().from('team_members').select('user_id').limit(1)) || [];
      if(!members.length) throw new Error('该账号尚未获得班组成员授权');
      const admins=checked(await current.rdb().from('team_admins').select('user_id').limit(1)) || [];
      member=true;
      return {isAdmin:admins.length>0};
    }catch(e){member=false;await current.auth.signOut();throw e;}
  }
  async function signOut(){if(app){const result=await app.auth.signOut();if(result) checked(result);}member=false;}
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
    if(path==='/api/releases' && !options.method) return {releases:(await readBoth()).releases};
    if(path==='/api/feedback' && !options.method) return {feedback:(await readBoth()).feedback};
    const payload=options.body instanceof FormData ? options.body : JSON.parse(options.body||'{}');
    if(path==='/api/feedback' && options.method==='POST'){
      if(!member) throw new Error('请先使用班组成员账号登录');
      const result=await ready().rdb().from('team_feedback').insert({author:String(payload.author||'').trim()||'匿名',content:String(payload.content||'').trim()}).select('id');
      const rows=checked(result); return {id:Number(rows?.[0]?.id)};
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
