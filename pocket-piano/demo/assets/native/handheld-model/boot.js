/* The synchronous facade exists before onPageFinished. 3D is an enhancement;
 * failed capabilities/models recover into the same music and input protocol. */
(()=>{
 'use strict';let impl,payload,lastFrame,disposed=false,pending;
 const info={mode:'loading',reason:''};
 window.HandheldCompatibility={deferErrors:true,info};
 const bounded=(p,ms)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('3D preparation timeout')),ms);p.then(v=>{clearTimeout(t);resolve(v)},e=>{clearTimeout(t);reject(e)});});
 async function compatible(reason){
  if(disposed)throw Error('Scene disposed');info.reason=String(reason||'');info.mode='compatible';
  try{impl?.dispose?.();}catch(_){}document.querySelectorAll('canvas').forEach(c=>c.remove());
  const m=await import('./compatible.js');impl=m.createCompatibleScene(info);window.HandheldScene=facade;return impl;
 }
 async function initialize(){
  if(new URLSearchParams(location.search).has('compatible'))return compatible('Selected compatibility mode');
  try{const probe=document.createElement('canvas'),gl=probe.getContext('webgl2');if(!gl)throw Error('WebGL2 unavailable');gl.getExtension('WEBGL_lose_context')?.loseContext();
   await bounded(import('./renderer.js'),8000);impl=window.HandheldScene;window.HandheldScene=facade;info.mode='3d';
   document.querySelector('canvas')?.addEventListener('webglcontextlost',async e=>{e.preventDefault();if(disposed||info.mode==='compatible')return;await compatible('Graphics context lost');if(payload)await impl.load(payload);if(lastFrame)await impl.frame(lastFrame);},{once:true});return impl;
  }catch(e){return compatible(e);}
 }
 const facade={async load(data){payload=data;try{await pending;return await bounded(impl.load(data),8000);}catch(e){if(disposed||payload!==data)return false;await compatible(e);return impl.load(data);}},async frame(data){lastFrame=data;await pending;return impl.frame(data);},press(data){return impl?.press(data)||false},inspect(){return impl?.inspect()||{ready:false,error:'',compatibility:info}},setVisible(v){impl?.setVisible(v)},setAtlas(v){return impl?.setAtlas?.(v)},reset(){impl?.reset()},dispose(){disposed=true;impl?.dispose()}};
 window.HandheldScene=facade;pending=initialize();pending.catch(e=>{document.getElementById('status').textContent='掌机准备失败，请重新打开';console.error(e);});
})();
