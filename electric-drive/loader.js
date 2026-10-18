(() => {
  'use strict';
  const $=id=>document.getElementById(id),frame=$('game');
  const base=new URL('./',location.href),diag=window.__ED_BOOT__={stage:'starting',build:null,events:[]};
  let worker,playing=null,pending=null,status='unknown',checking=null,starting=false,updateText='';
  const safe=()=>status==='menu'||status==='over';
  const note=(stage,data={})=>{diag.stage=stage;Object.assign(diag,data);diag.events.push({stage,...data});};
  const updateUi=()=>{$('update').hidden=!playing||!safe()||!updateText;$('updateText').textContent=updateText;$('apply').hidden=!pending;};
  function rpc(type,payload={},onProgress){return new Promise((resolve,reject)=>{const ch=new MessageChannel();ch.port1.onmessage=({data})=>{if(data.progress){onProgress?.(data.progress);return;}ch.port1.close();data.ok?resolve(data.result):reject(Error(data.error||'资源准备失败'));};worker.postMessage({app:'electric-drive',type,...payload},[ch.port2]);});}
  function progress(p){
    diag.progress=p;$('progress').hidden=false;$('phase').textContent=playing?'正在准备新版':p.repair?'正在恢复已保存的公路':'首次准备公路';
    $('progress').value=p.totalBytes?Math.min(100,p.completedBytes/p.totalBytes*100):0;
    $('detail').textContent=`已准备 ${Math.floor(p.totalBytes?p.completedBytes/p.totalBytes*100:0)}% · 本次下载 ${(p.networkBytes/1000000).toFixed(1)} MB`;
    if(playing){updateText=`新版准备中 ${Math.floor(p.totalBytes?p.completedBytes/p.totalBytes*100:0)}%`;updateUi();}
  }
  async function release(){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);try{const r=await fetch(new URL('release.json',base),{cache:'no-store',signal:controller.signal});if(!r.ok||!(r.headers.get('content-type')||'').toLowerCase().includes('json'))throw Error('版本信息暂时不可用');const d=await r.json();if(d?.schema!==1||d.app!=='electric-drive'||typeof d.build!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(d.build)||d.build.includes('..')||typeof d.version!=='string'||d.version.length>100||d.manifest?.url!==`builds/${d.build}/manifest.json`||!Number.isSafeInteger(d.manifest.bytes)||d.manifest.bytes<=0||!/^[a-f0-9]{64}$/.test(d.manifest.sha256))throw Error('版本信息不匹配');return d;}finally{clearTimeout(timer);}}
  function enter(build){
    const target=new URL(`builds/${encodeURIComponent(build.build)}/index.html`,base);target.search=location.search;target.hash=location.hash;
    playing=build;pending=null;status='unknown';diag.build=build.build;diag.version=build.version;delete diag.pending;delete diag.updateError;
    frame.src=target.href;frame.hidden=false;$('loader').hidden=true;note('playing',{build:build.build,version:build.version});
    frame.onload=()=>{try{frame.contentWindow.focus();}catch{}};updateText='';updateUi();
  }
  async function checkForUpdate(manual=false){
    if(!worker||!playing)return;if(checking)return checking;
    checking=(async()=>{try{const latest=await release();if(latest.build===playing.build){updateText=manual?'已是当前版本':'';updateUi();return;}
      updateText='正在准备新版';updateUi();const prepared=await rpc('PREPARE',{release:latest},progress);
      if(latest.build===playing.build)return;pending=prepared;diag.pending=prepared;delete diag.updateError;updateText=`${prepared.version} 已准备好，当前记录保留`;updateUi();
    }catch(e){diag.updateError=String(e.message);updateText=manual?'更新暂未完成，当前版本仍可玩':'';updateUi();}finally{checking=null;}})();return checking;
  }
  async function start(){
    if(starting)return;starting=true;$('retry').hidden=true;$('progress').hidden=true;$('phase').textContent='正在打开公路';$('detail').textContent='';
    try{
      if(!isSecureContext||!navigator.serviceWorker||!window.caches)throw Error('请用支持离线保存的浏览器，通过 HTTPS 打开游戏。');
      let reg=await navigator.serviceWorker.getRegistration(base.href);
      if(reg?.scope!==base.href||!reg.active){await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'});reg=await navigator.serviceWorker.ready;}
      else {void reg.update().catch(()=>{});}
      worker=reg.active;if(!worker)throw Error('保存服务尚未准备好，请重试。');
      const boot=await rpc('BOOT');note('cache-checked',{boot});
      if(boot.ready){enter(boot.ready);void checkForUpdate();return;}
      let chosen=boot.repairRelease;
      if(!chosen)chosen=await release();
      note('preparing');const prepared=await rpc('PREPARE',{release:chosen,repair:!!boot.repairRelease},progress);
      await rpc('ACTIVATE',{build:prepared.build});enter(prepared);void checkForUpdate();
    }catch(e){note('error',{error:String(e.message)});$('phase').textContent='公路尚未准备完成';$('detail').textContent=e.message;$('retry').hidden=false;}
    finally{starting=false;}
  }
  $('retry').onclick=start;$('check').onclick=()=>checkForUpdate(true);
  $('apply').onclick=async()=>{if(!pending||!safe())return;const next=pending;try{await rpc('ACTIVATE',{build:next.build});enter(next);}catch(e){updateText='新版未能启用，当前版本已保留';diag.updateError=e.message;updateUi();}};
  addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.app!=='electric-drive'||e.data.type!=='GAME_STATE'||e.data.build!==playing?.build)return;status=e.data.status;diag.gameStatus=status;updateUi();});
  addEventListener('online',()=>checkForUpdate());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkForUpdate();});
  window.ElectricDriveWeb={checkForUpdate,diagnostics:diag};
  void start();
})();
