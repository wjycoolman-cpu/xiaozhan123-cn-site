const SHELL_INFO={"version":"b7fbce59c2ec21749cb0","files":[{"path":"index.html","bytes":920,"sha256":"1ec661a5c8dcb076727b54bc7d59931a8770e244892370ec8dbb1ac257e35488","accept":["text/html"]},{"path":"loader.css","bytes":3003,"sha256":"723efe1821bfe1cb0fdc6bc99ea65ddf696786bc8b7b3200f340eb3d9582d1ae","accept":["text/css"]},{"path":"loader.js","bytes":5798,"sha256":"71dfe638bd8e403f48f376075165e4395ff2a2d3890c810c266691fcccbf676a","accept":["text/javascript","application/javascript","application/ecmascript"]}]};
/* SHELL_INFO is inserted by prepare-web.mjs. No skipWaiting or forced reload. */
'use strict';
const SCOPE=self.registration.scope,PREFIX='electric-drive-web:'+new URL(SCOPE).pathname+':';
const META=PREFIX+'meta-v1',OBJECTS=PREFIX+'objects-v1',SHELL_CACHE=PREFIX+'shell-'+SHELL_INFO.version;
const key=s=>new URL('__ed/'+s,SCOPE).href,objectKey=sha=>key('objects/'+sha);
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const hex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
const digest=async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes));
const buildUrl=(id,path)=>new URL('builds/'+encodeURIComponent(id)+'/'+path.split('/').map(encodeURIComponent).join('/'),SCOPE).href;
const inFlight=new Map();let queue=Promise.resolve();
const serialize=fn=>{const result=queue.then(fn,fn);queue=result.catch(()=>{});return result;};
async function metaGet(name){try{const r=await(await caches.open(META)).match(key(name));return r?await r.json():null;}catch{return null;}}
async function metaPut(name,value){await(await caches.open(META)).put(key(name),json(value));}
async function state(){return await metaGet('state')||{active:null,previous:null,pending:null};}
function validId(id){return typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(id)&&!id.includes('..');}
function descriptor(release){
  if(release?.schema!==1||release.app!=='electric-drive'||!validId(release.build)||typeof release.version!=='string'||release.version.length>100)throw Error('版本信息不匹配');
  const m=release.manifest;
  if(!m||m.url!==`builds/${release.build}/manifest.json`||!Number.isSafeInteger(m.bytes)||m.bytes<=0||m.bytes>4000000||!/^[a-f0-9]{64}$/.test(m.sha256))throw Error('版本清单无效');
  return {schema:1,app:'electric-drive',build:release.build,version:release.version,manifest:{...m}};
}
function manifestShape(m,r){
  if(m?.schema!==1||m.app!=='electric-drive'||m.build!==r.build||m.version!==r.version||m.entry!=='index.html'||!Array.isArray(m.files)||m.files.length<1||m.files.length>10000)throw Error('构建信息不匹配');
  const paths=new Set();
  for(const f of m.files){if(typeof f.path!=='string'||!f.path||f.path.startsWith('/')||f.path.includes('\\')||f.path.split('/').some(s=>!s||s==='.'||s==='..')||/[?#%]/.test(f.path)||paths.has(f.path)||!Number.isSafeInteger(f.bytes)||f.bytes<0||!/^[a-f0-9]{64}$/.test(f.sha256)||!Array.isArray(f.accept)||!f.accept.length)throw Error('构建文件清单无效');paths.add(f.path);
    if(f.wire){const w=f.wire;if(w.path!==f.path+'.edz'||w.encoding!=='gzip'||f.bytes<65536||!Number.isSafeInteger(w.bytes)||w.bytes<=0||w.bytes>=f.bytes||!/^[a-f0-9]{64}$/.test(w.sha256)||!Array.isArray(w.accept)||!w.accept.length||w.accept.some(x=>!['application/octet-stream','application/gzip','application/x-gzip'].includes(x)))throw Error('压缩传输清单无效');}
  }
  for(const f of m.files)if(f.wire&&paths.has(f.wire.path))throw Error('压缩传输路径冲突');
  if(!paths.has('index.html'))throw Error('构建入口缺失');return m;
}
async function validated(response,file,storedObject=false){
  if(!response||response.status!==200||response.type==='opaque')throw Error('文件响应不可用');
  const type=storedObject?file.accept[0]:(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
  if(!file.accept.includes(type))throw Error('文件类型不匹配');
  const bytes=await response.arrayBuffer();if(bytes.byteLength!==file.bytes||await digest(bytes)!==file.sha256)throw Error('文件校验失败');
  const contentType=/^(text\/|application\/(?:json|javascript|ecmascript)$)/.test(type)?type+'; charset=utf-8':type;
  return new Response(bytes,{status:200,headers:{'Content-Type':contentType,'X-ED-SHA256':file.sha256}});
}
// This immutable public mirror contains the exact authenticated R10 payloads.
// Local fixtures and other builds keep their original route.
const R10_SOURCE='https://raw.githubusercontent.com/wjycoolman-cpu/xiaozhan123-cn-site/19e3f8fdc791214436ec5430e2314530b6d7098b/electric-drive/';
function downloadSources(url,file){
  const scope=new URL(SCOPE),prefix=new URL('builds/r10-20261018-01/',SCOPE).href;
  if(!file.wire||scope.origin!=='https://xiaozhan123.cn'||scope.pathname!=='/electric-drive/'||!url.startsWith(prefix))return [url];
  return [R10_SOURCE+url.slice(SCOPE.length),url];
}
async function download(url,file,onBytes){
  const sources=downloadSources(url,file);let lastError;
  for(let i=0;i<sources.length;i++){
    try{return await downloadFrom(sources[i],file,onBytes);}
    catch(error){lastError=error;}
  }
  throw lastError;
}
async function downloadFrom(url,file,onBytes){
  const wire=file.wire,transport=wire||file;
  if(wire&&typeof DecompressionStream!=='function')throw Error('此浏览器不支持 gzip 解压，请使用支持的浏览器后重试。');
  const controller=new AbortController();let timer=setTimeout(()=>controller.abort(),url.startsWith(R10_SOURCE)?4000:20000);
  const touch=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),45000);};
  try{
    const r=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
    if(r.status!==200||r.type==='opaque'||!transport.accept.includes((r.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase()))throw Error('服务器返回的文件类型或状态不匹配');
    // Fetch has already decoded HTTP Content-Encoding. Authenticate its body
    // against the application wire size/SHA below before gzip expansion.
    touch();const chunks=[];let count=0;
    if(r.body){const reader=r.body.getReader();for(;;){const {value,done}=await reader.read();if(done)break;touch();count+=value.byteLength;if(count>transport.bytes){controller.abort();throw Error('传输文件大小不匹配');}chunks.push(value);onBytes?.(value.byteLength);}}
    else {const b=new Uint8Array(await r.arrayBuffer());chunks.push(b);count=b.length;onBytes?.(count);}
    const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    if(!wire)return await validated(new Response(bytes,{status:200,headers:{'Content-Type':r.headers.get('Content-Type')}}),file);
    if(count!==wire.bytes||await digest(bytes)!==wire.sha256)throw Error('压缩传输校验失败，尚未保存。');
    // Wire integrity is verified before native decompression. Bound expanded data
    // to the authenticated logical size, then re-check raw SHA and logical MIME.
    let reader;try{reader=new Response(bytes).body.pipeThrough(new DecompressionStream('gzip')).getReader();}catch{throw Error('此浏览器不支持 gzip 解压，请重试。');}
    const expanded=[];let rawCount=0;
    try{for(;;){const {value,done}=await reader.read();if(done)break;touch();rawCount+=value.byteLength;if(rawCount>file.bytes){await reader.cancel();throw Error('解压文件大小不匹配');}expanded.push(value);}}
    catch{throw Error('gzip 解压内容无效或大小不匹配，尚未保存。');}
    const raw=new Uint8Array(rawCount);let rawOffset=0;for(const chunk of expanded){raw.set(chunk,rawOffset);rawOffset+=chunk.length;}
    return await validated(new Response(raw,{status:200,headers:{'Content-Type':file.accept[0]}}),file);
  }finally{clearTimeout(timer);controller.abort();}
}
async function readBuild(id,requireReady=true){
  if(!validId(id))return null;
  const saved=await metaGet('descriptor/'+id);if(!saved)return null;
  try{const r=descriptor(saved);if(requireReady&&!await metaGet('ready/'+id))return null;const cache=await caches.open(META),raw=await cache.match(new URL(r.manifest.url,SCOPE));const checked=await validated(raw,{...r.manifest,accept:['application/json','text/json']});return {release:r,manifest:manifestShape(await checked.json(),r)};}catch{return null;}
}
async function cached(file){const c=await caches.open(OBJECTS);try{return await validated(await c.match(objectKey(file.sha256)),file,true);}catch{await c.delete(objectKey(file.sha256));return null;}}
async function complete(build){for(const f of build.manifest.files)if(!await cached(f)){await(await caches.open(META)).delete(key('ready/'+build.release.build));return false;}return true;}
async function boot(){
  const s=await state();let repairRelease=null;
  for(const id of [s.active,s.previous].filter(Boolean)){const b=await readBuild(id,false);if(!b)continue;if(!repairRelease)repairRelease=b.release;if(await complete(b)){await metaPut('ready/'+id,{build:id,version:b.release.version});return {ready:{build:id,version:b.release.version},repairRelease:null};}}
  return {ready:null,repairRelease};
}
async function prepareInner(input,progress,repair){
  const r=descriptor(input),meta=await caches.open(META),manifestUrl=new URL(r.manifest.url,SCOPE).href;
  let raw=await meta.match(manifestUrl),checked;
  try{checked=await validated(raw,{...r.manifest,accept:['application/json','text/json']});}catch{checked=await download(manifestUrl,{...r.manifest,accept:['application/json','text/json']});await meta.put(manifestUrl,checked.clone());}
  const m=manifestShape(await checked.json(),r);await metaPut('descriptor/'+r.build,r);
  const p={repair,totalFiles:m.files.length,totalBytes:m.files.reduce((n,f)=>n+f.bytes,0),totalWireBytes:m.files.reduce((n,f)=>n+(f.wire?.bytes??f.bytes),0),completedFiles:0,completedBytes:0,rawSavedBytes:0,networkBytes:0,downloadedFiles:0,reusedFiles:0};
  progress?.({...p});const objects=await caches.open(OBJECTS);
  for(const f of m.files){
    let response=await cached(f);
    if(response){p.reusedFiles++;}
    else {
      await meta.delete(key('ready/'+r.build));
      response=await download(buildUrl(r.build,f.wire?.path||f.path),f,amount=>{p.networkBytes+=amount;progress?.({...p});});
      await objects.put(objectKey(f.sha256),response);p.downloadedFiles++;
    }
    p.completedFiles++;p.completedBytes+=f.bytes;p.rawSavedBytes=p.completedBytes;progress?.({...p});
  }
  // This final marker is written only after every resource passed MIME/bytes/SHA.
  await metaPut('ready/'+r.build,{build:r.build,version:r.version});
  const s=await state();if(s.active!==r.build)s.pending=r.build;await metaPut('state',s);
  return {build:r.build,version:r.version,...p};
}
function prepare(input,progress,repair=false){
  const id=descriptor(input).build;if(inFlight.has(id))return inFlight.get(id);
  const task=serialize(()=>prepareInner(input,progress,repair)).finally(()=>inFlight.delete(id));inFlight.set(id,task);return task;
}
async function clean(){
  const s=await state(),keep=new Set([s.active,s.previous,s.pending].filter(Boolean));
  for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){const u=new URL(client.url);if(u.href.startsWith(SCOPE)){const rel=u.pathname.slice(new URL(SCOPE).pathname.length),m=rel.match(/^builds\/([^/]+)\//);if(m)keep.add(decodeURIComponent(m[1]));}}
  const meta=await caches.open(META),refs=new Set();
  for(const id of keep){const b=await readBuild(id,false);if(b)for(const f of b.manifest.files)refs.add(objectKey(f.sha256));}
  const objects=await caches.open(OBJECTS);for(const request of await objects.keys())if(!refs.has(request.url))await objects.delete(request);
  for(const request of await meta.keys()){const u=new URL(request.url),rel=u.href.slice(SCOPE.length),a=rel.match(/^__ed\/(?:descriptor|ready)\/([^/?]+)$/),b=rel.match(/^builds\/([^/]+)\/manifest\.json$/);const id=a?.[1]||b?.[1];if(id&&!keep.has(decodeURIComponent(id)))await meta.delete(request);}
}
async function activateBuild(id){
  const b=await readBuild(id);if(!b||!await complete(b))throw Error('新版尚未完整保存，当前版本已保留');
  const s=await state();if(s.active!==id){s.previous=s.active;s.active=id;}if(s.pending===id)s.pending=null;await metaPut('state',s);await clean();return {build:id,version:b.release.version};
}
self.addEventListener('install',event=>event.waitUntil((async()=>{const c=await caches.open(SHELL_CACHE);for(const f of SHELL_INFO.files){const response=await download(new URL(f.path,SCOPE).href,f);await c.put(new URL(f.path,SCOPE).href,response);}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await self.clients.claim();for(const name of await caches.keys())if(name.startsWith(PREFIX+'shell-')&&name!==SHELL_CACHE)await caches.delete(name);})()));
self.addEventListener('message',event=>{
  if(event.data?.app!=='electric-drive'||!event.ports[0])return;const port=event.ports[0],d=event.data;
  const run=async()=>{switch(d.type){case 'BOOT':return boot();case 'PREPARE':return prepare(d.release,p=>port.postMessage({progress:p}),!!d.repair);case 'ACTIVATE':return serialize(()=>activateBuild(d.build));default:throw Error('未知缓存操作');}};
  event.waitUntil(run().then(result=>port.postMessage({ok:true,result}),error=>port.postMessage({ok:false,error:String(error.message||error).slice(0,300)})));
});
async function serveBuild(url){
  const rel=url.pathname.slice(new URL(SCOPE).pathname.length),match=rel.match(/^builds\/([^/]+)\/(.+)$/);if(!match)return fetch(url.href);
  const id=decodeURIComponent(match[1]),path=decodeURIComponent(match[2]);
  if(inFlight.has(id))await inFlight.get(id);
  let b=await readBuild(id);if(!b)throw Error('该构建尚未准备好，请从游戏入口重试');
  if(path==='manifest.json')return (await caches.open(META)).match(new URL(b.release.manifest.url,SCOPE));
  const f=b.manifest.files.find(f=>f.path===path);if(!f)throw Error('资源不在当前构建清单中');
  let response=await cached(f);
  if(!response){await(await caches.open(META)).delete(key('ready/'+id));await prepare(b.release,null,true);b=await readBuild(id);if(!b)throw Error('资源恢复尚未完成');response=await cached(f);}
  if(!response)throw Error('资源未能恢复');return response;
}
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==location.origin||!u.href.startsWith(SCOPE))return;
  const rel=u.pathname.slice(new URL(SCOPE).pathname.length);
  if(rel===''||rel==='index.html'||SHELL_INFO.files.some(f=>f.path===rel)){
    const path=rel===''?'index.html':rel;
    event.respondWith((async()=>{const f=SHELL_INFO.files.find(f=>f.path===path),cache=await caches.open(SHELL_CACHE);let r;try{r=await validated(await cache.match(new URL(path,SCOPE)),f);}catch{r=await download(new URL(path,SCOPE).href,f);await cache.put(new URL(path,SCOPE),r.clone());}return r;})());
  }else if(rel.startsWith('builds/'))event.respondWith(serveBuild(u).catch(error=>new Response(String(error.message),{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
});
