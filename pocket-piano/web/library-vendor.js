/* Optional import/online-library parsers never block the piano workspace. */
const pending=new Map();
export function loadLibraryVendor(name){
  const key=name==='midi'?'Midi':'fflate';
  if(window[key])return Promise.resolve(window[key]);
  if(!pending.has(key))pending.set(key,new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=new URL(`../demo/vendor/${name==='midi'?'midi':'fflate'}.js`,import.meta.url).href;
    script.onload=()=>window[key]?resolve(window[key]):reject(Error('曲谱解析组件未就绪'));
    script.onerror=()=>{script.remove();pending.delete(key);reject(Error('曲谱解析组件下载失败，请重试'));};
    document.head.append(script);
  }));
  return pending.get(key);
}
