/* Optional import/online-library parsers never block the piano workspace. */
const pending=new Map();
export function loadLibraryVendor(name){
  const key=name==='midi'?'Midi':'fflate';
  if(window[key])return Promise.resolve(window[key]);
  if(!pending.has(key)){
    let script;
    const request=new Promise((resolve,reject)=>{
      script=document.createElement('script');
      script.src=new URL(`../demo/vendor/${name==='midi'?'midi':'fflate'}.js`,import.meta.url).href;
      script.onload=()=>window[key]?resolve(window[key]):reject(Error('曲谱解析组件未就绪'));
      script.onerror=()=>reject(Error('曲谱解析组件下载失败，请重试'));
      document.head.append(script);
    });
    // A successful HTTP load may still omit its expected global. Every failure
    // must release this cache entry, not just the network onerror branch.
    const retryable=request.catch(error=>{
      if(pending.get(key)===retryable)pending.delete(key);
      if(script){script.onload=script.onerror=null;try{script.remove();}catch(_){}}
      throw error;
    });
    pending.set(key,retryable);
  }
  return pending.get(key);
}
