import {loadLibraryVendor} from './library-vendor.js';
const DEMO=new URL('../demo/',import.meta.url).href;
import {nativeSearch,nativeOrder} from '../demo/native-search.js';
import {filterLibraryRows} from './library-search-worker.js';
const EMPTY_ROWS=Object.freeze([]);
const supersededSearch=()=>{const error=new Error('曲库搜索已被新的请求替代');error.name='AbortError';error.code='SEARCH_SUPERSEDED';return error;};
const searchMetadata=(row,slot,custom=false)=>({_slot:slot,id:row.id,title:row.title,author:row.author,category:row.category,notes:!!row.notes,builtinIndex:!!row.builtinIndex,builtinFile:row.builtinFile,_custom:custom});
export const normalize=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu,'');
// Earlier web recordings/JSON omitted velocity and sometimes bpm. Normalize at
// both load and import boundaries so existing local data remains playable.
export function normalizeWebSong(song){
 if(!song||!Array.isArray(song.notes)||!song.notes.length||song.notes.length>100000)throw Error('没有可用音符');
 const bpm=song.bpm===undefined?120:song.bpm;if(!Number.isInteger(bpm)||bpm<1||bpm>1000)throw Error('速度无效');
 const notes=song.notes.map(n=>{const velocity=n.velocity===undefined?85:n.velocity;if(!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127||!Number.isInteger(velocity)||velocity<1||velocity>127||!Number.isFinite(n.start)||!Number.isFinite(n.duration)||n.start<0||n.duration<1||n.start+n.duration>1800000)throw Error('音符范围或力度无效');return {...n,velocity,start:Math.round(n.start),duration:Math.max(1,Math.round(n.duration))};}).sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
 return {...song,bpm,notes,durationMs:notes.reduce((m,n)=>Math.max(m,n.start+n.duration),0),noteCount:notes.length};
}
const hot=['晴天','夜曲','花之舞','flowerdance','梦中的婚礼','riverflowsinyou','起风了','稻香','告白气球','卡农','天空之城','千与千寻','summer','rush','callofsilence','你的名字','周杰伦'];
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
function decodePCS(bytes,row){let at=4,start=0;const u8=()=>{if(at>=bytes.length)throw Error('曲谱数据不完整');return bytes[at++];};const variable=max=>{let n=0,f=1;for(let i=0;i<5;i++){const b=u8();n+=(b&127)*f;if(n>max)throw Error('曲谱超出安全范围');if(!(b&128))return n;f*=128;}throw Error('曲谱数字无效');};if(String.fromCharCode(...bytes.subarray(0,4))!=='PCS1')throw Error('不支持的曲谱格式');const bpm=variable(1000),count=variable(100000);if(!bpm||count>(bytes.length-at)/4)throw Error('曲谱头部无效');const notes=[];for(let i=0;i<count;i++){const pitch=u8(),velocity=u8();start+=variable(1800000);const duration=variable(1800000);if(pitch>127||!velocity||velocity>127||!duration||start+duration>1800000)throw Error('曲谱音符无效');notes.push({pitch,velocity,start,duration});}if(at!==bytes.length)throw Error('曲谱末尾数据无效');return{...row,bpm,notes};}
export class SongLibrary{
 _initSearch(){if(this._searchPending)return;this._searchPending=new Map();this._searchGeneration=0;this._searchRevision=0;this._searchRequest=0;this._searchWorker=null;this._searchWorkerFailure='';this._searchIndexedRevision=-1;this._searchMode='small';}
 _cancelSearch(){for(const pending of this._searchPending.values()){clearTimeout(pending.timer);pending.reject(supersededSearch());}this._searchPending.clear();}
 invalidateSearch(reason='changed',{rebuild=true}={}){this._initSearch();this._searchGeneration++;this._cancelSearch();if(rebuild)this._searchSource=null;this._searchChange=reason;}
 get searchState(){this._initSearch();return{mode:this._searchMode,reason:this._searchWorkerFailure,generation:this._searchGeneration,revision:this._searchRevision,pending:this._searchPending.size,lastChange:this._searchChange||''};}
 _searchSnapshot(){
  const entries=this.catalog?.entries||EMPTY_ROWS,local=[...this.rows,...this.custom];
  const signature=JSON.stringify(local.map(row=>[row.id,row.title,row.author,row.category,!!row.notes,!!row.builtinIndex,row.builtinFile]));
  const old=this._searchSource;
  if(old&&old.entries===entries&&old.entryCount===entries.length&&old.builtins===this.rows&&old.custom===this.custom&&old.signature===signature)return old;
  const allRows=[...entries,...local],revision=++this._searchRevision;
  return this._searchSource={entries,entryCount:entries.length,builtins:this.rows,custom:this.custom,signature,revision,allRows,
   catalog:entries.map((row,i)=>searchMetadata(row,i)),local:local.map((row,i)=>searchMetadata(row,entries.length+i,i>=this.rows.length))};
 }
 _disableSearchWorker(error){
  this._searchWorkerFailure=String(error?.message||error||'后台搜索不可用');this._searchMode='fallback';
  this._searchWorker?.terminate();this._searchWorker=null;this._searchIndexedRevision=-1;
  for(const pending of this._searchPending.values()){clearTimeout(pending.timer);pending.reject(Error(this._searchWorkerFailure));}this._searchPending.clear();
 }
 _ensureSearchWorker(){
  if(this._searchWorkerFailure)return null;if(this._searchWorker)return this._searchWorker;
  if(typeof Worker==='undefined'){this._disableSearchWorker(Error('此环境不支持后台搜索，已使用兼容搜索'));return null;}
  try{
   const worker=new Worker(new URL('./library-search-worker.js',import.meta.url),{type:'module',name:'piano-library-search'});this._searchWorker=worker;
   worker.onmessage=event=>{const data=event.data||{};if(data.type==='indexed')return;const pending=this._searchPending.get(data.requestId);if(!pending)return;
    this._searchPending.delete(data.requestId);clearTimeout(pending.timer);
    if(data.type==='error'){pending.reject(Error(data.error||'后台搜索失败'));return;}
    if(data.type!=='result'||data.generation!==pending.generation||data.revision!==pending.revision){pending.reject(supersededSearch());return;}
    pending.resolve(data.slots);
   };
   worker.onerror=event=>{event.preventDefault?.();this._disableSearchWorker(Error(event.message||'后台搜索组件无法加载'));};
   worker.onmessageerror=()=>this._disableSearchWorker(Error('后台搜索返回数据无效'));
   return worker;
  }catch(error){this._disableSearchWorker(error);return null;}
 }
 /** Latest request wins. Ignore AbortError/SEARCH_SUPERSEDED in result views. */
 async searchAsync(query='',category='全部'){
  this._initSearch();const generation=++this._searchGeneration;this._cancelSearch();const snapshot=this._searchSnapshot();
  const current=()=>{if(generation!==this._searchGeneration)throw supersededSearch();};
  if(snapshot.allRows.length<=256){this._searchMode='small';await Promise.resolve();current();return this.search(query,category);}
  const worker=this._ensureSearchWorker();
  if(worker){
   this._searchMode='worker';
   try{
    if(this._searchIndexedRevision!==snapshot.revision){worker.postMessage({type:'index',revision:snapshot.revision,catalog:snapshot.catalog,local:snapshot.local});this._searchIndexedRevision=snapshot.revision;}
    const requestId=++this._searchRequest;
    const slots=await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>this._disableSearchWorker(Error('后台搜索超时，已切换兼容搜索')),10000);
     this._searchPending.set(requestId,{resolve,reject,timer,generation,revision:snapshot.revision});
     try{worker.postMessage({type:'search',requestId,generation,revision:snapshot.revision,query,category,favorites:[...this.favorites]});}
     catch(error){clearTimeout(timer);this._searchPending.delete(requestId);reject(error);}
    });
    current();return Array.from(slots,index=>snapshot.allRows[index]);
   }catch(error){if(error.name==='AbortError')throw error;current();this._disableSearchWorker(error);}
  }
  // A worker failure is remembered for this instance: no retry loop. Yield
  // before the compatible synchronous search; callers can show searchState.reason.
  this._searchMode='fallback';await new Promise(resolve=>setTimeout(resolve,0));current();return this.search(query,category);
 }
 disposeSearch(){this._initSearch();this.invalidateSearch('disposed');this._searchWorker?.terminate();this._searchWorker=null;this._searchWorkerFailure='后台搜索已关闭';this._searchMode='fallback';}
 constructor(){
  this.rows=[];this.catalog=null;this.loading=null;this.cache=new Map();this.details=new Map();this.packs=new Map();this.custom=[];this.favorites=new Set();
  this._builtins=null;this._builtinLoads=new Map();
  try{this.custom=JSON.parse(localStorage.getItem('piano-web-songs')||'[]');this.favorites=new Set(JSON.parse(localStorage.getItem('piano-web-favorites')||'[]').map(id=>/^eop-[a-f0-9]{64}$/.test(id)?id.slice(0,20):id));}catch(_){}
 }
 // Compatibility access is deliberately lazy. The desktop metadata index and
 // a selected numbered file do not trigger this full historical bundle.
 get builtins(){
  if(!this._builtins)this._builtins=fetch(DEMO+'assets/builtin.json').then(response=>{if(!response.ok)throw Error('内置曲库加载失败');return response.json();}).then(rows=>{
   this.rows=rows.map((song,i)=>({...song,category:'本机曲谱',builtinIndex:true,builtinFile:`builtin/${String(i+1).padStart(2,'0')}.json`,subtitle:song.subtitle||'',durationMs:song.notes.reduce((end,note)=>Math.max(end,note.start+note.duration),0),noteCount:song.notes.length}));
   this.invalidateSearch('builtins');return this.rows;
  }).catch(error=>{this._builtins=null;throw error;});
  return this._builtins;
 }
 async _loadBuiltin(row){
  if(!/^builtin\/\d{2}\.json$/.test(row.builtinFile))throw Error('内置曲目路径无效');
  const file=row.builtinFile;
  if(!this._builtinLoads.has(file)){
   const pending=fetch(new URL(file,import.meta.url)).then(response=>{if(!response.ok)throw Error('内置曲目读取失败：'+response.status);return response.json();}).then(normalizeWebSong);
   this._builtinLoads.set(file,pending);pending.catch(()=>{if(this._builtinLoads.get(file)===pending)this._builtinLoads.delete(file);});
  }
  const selected=await this._builtinLoads.get(file);
  if(selected.id!==row.id)throw Error('内置曲目与目录不一致');
  return normalizeWebSong({...row,...selected,category:'本机曲谱',builtinIndex:true,builtinFile:file});
 }
 async all(){
  await loadLibraryVendor('fflate');if(this.catalog)return this.catalog;
  if(!this.loading)this.loading=(async()=>{
   const response=await fetch(DEMO+'assets/catalog.json.gz');if(!response.ok)throw Error('曲库加载失败，请重试');
   const data=window.fflate.gunzipSync(new Uint8Array(await response.arrayBuffer()));if(data.length>16000000)throw Error('曲库过大');
   const catalog=JSON.parse(new TextDecoder().decode(data));if(catalog.count!==catalog.entries.length||catalog.count>30000)throw Error('曲库目录无效');
   this.catalog=catalog;for(const pack of catalog.packs)this.packs.set(pack.name,pack);this.invalidateSearch('catalog');return catalog;
  })().catch(error=>{this.loading=null;throw error;});
  return this.loading;
 }
 search(query='',category='全部'){const entries=this.catalog?.entries||EMPTY_ROWS;if(this.orderSource!==entries){this.orderSource=entries;this.orderedRows=nativeOrder(entries);}return filterLibraryRows(nativeSearch([...this.orderedRows,...this.rows,...this.custom],query),category,this.favorites,new Set(this.custom));}
 async load(row){if(row.notes)return normalizeWebSong(row);if(row.builtinFile)return this._loadBuiltin(row);if(row.builtinIndex){const rows=await this.builtins;row=rows.find(s=>s.id===row.id);if(!row)throw Error('内置曲目未找到');return normalizeWebSong(row);}await loadLibraryVendor('fflate');if(!row.entry){const p=this.packs.get(row.pack);if(!p||!/^pack-\d{4}\.json\.gz$/.test(p.detail))throw Error('Invalid song detail path');let rows=this.details.get(row.pack);if(!rows){const response=await fetch(DEMO+'assets/details/'+p.detail);if(!response.ok)throw Error('Song detail download failed');const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==p.detailBytes||await hash(bytes)!==p.detailSha256)throw Error('Song detail integrity failed');const unpacked=window.fflate.gunzipSync(bytes);if(unpacked.length>2000000)throw Error('Song detail exceeds limit');rows=JSON.parse(new TextDecoder().decode(unpacked));if(rows.length!==p.entryCount)throw Error('Invalid song detail count');this.details.set(row.pack,rows);while(this.details.size>2)this.details.delete(this.details.keys().next().value);}const detail=rows[row.slot];if(!detail||detail.id.slice(0,20)!==row.id||detail.pack!==row.pack)throw Error('Song detail mismatch');row={...detail,...row};}if(!/^pack-\d{4}\.ppack$/.test(row.pack)||!/^[a-f0-9]{40}\.pcs$/.test(row.entry))throw Error('曲库文件路径无效');let bytes=this.cache.get(row.pack);if(!bytes){const r=await fetch(DEMO+'assets/offline/'+row.pack);if(!r.ok)throw Error('曲谱下载失败，请重试');bytes=new Uint8Array(await r.arrayBuffer());const p=this.packs.get(row.pack);if(!p||bytes.length!==p.byteSize||await hash(bytes)!==p.sha256)throw Error('曲谱分包校验失败');this.cache.set(row.pack,bytes);while(this.cache.size>2)this.cache.delete(this.cache.keys().next().value);}const result=window.fflate.unzipSync(bytes,{filter:f=>f.name===row.entry&&f.originalSize<=1536000}),pcs=result[row.entry];if(!pcs||await hash(pcs)!==row.compactSha256)throw Error('曲谱内容校验失败');return decodePCS(pcs,row);}
 favorite(id){if(this.favorites.has(id))this.favorites.delete(id);else this.favorites.add(id);this.invalidateSearch('favorites',{rebuild:false});try{localStorage.setItem('piano-web-favorites',JSON.stringify([...this.favorites]));}catch(_){}return this.favorites.has(id);}
 save(song){Object.assign(song,normalizeWebSong(song));song.category='我的';this.custom=this.custom.filter(s=>s.id!==song.id);this.custom.unshift(song);this.custom=this.custom.slice(0,30);this.invalidateSearch('custom');try{localStorage.setItem('piano-web-songs',JSON.stringify(this.custom));delete song.storageWarning;}catch(_){song.storageWarning='\u6d4f\u89c8\u5668\u5b58\u50a8\u7a7a\u95f4\u4e0d\u8db3\uff0c\u672c\u6b21\u4ecd\u53ef\u6f14\u594f\uff1b\u5237\u65b0\u540e\u9700\u91cd\u65b0\u5bfc\u5165';}return song;}
 async import(file){if(file.size>8*1024*1024)throw Error('文件请小于8 MB');let song;if(/\.eop$/i.test(file.name)){const bytes=new Uint8Array(await file.arrayBuffer()),digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),hash=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');const formalEop=await import('./native-synth.js');song=JSON.parse(formalEop.importEop(bytes,file.name.replace(/\.eop$/i,''),hash));}else if(/\.midi?$/i.test(file.name)){await loadLibraryVendor('midi');const m=new window.Midi(await file.arrayBuffer());const notes=m.tracks.flatMap(t=>t.notes.map(n=>({pitch:n.midi,velocity:Math.max(1,Math.round(n.velocity*127)),start:Math.round(n.time*1000),duration:Math.max(1,Math.round(n.duration*1000))}))).sort((a,b)=>a.start-b.start||a.pitch-b.pitch);song={id:'import-'+Date.now(),title:m.name||file.name.replace(/\.midi?$/i,''),bpm:Math.round(m.header.tempos[0]?.bpm||120),notes};}else song=JSON.parse(await file.text());if(!song||!Array.isArray(song.notes)||!song.notes.length||song.notes.length>100000)throw Error('没有可用音符');for(const n of song.notes)if(!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127||!Number.isFinite(n.start)||!Number.isFinite(n.duration)||n.start<0||n.duration<1||n.start+n.duration>1800000)throw Error('音符范围无效');song.id='import-'+Date.now();song.title=String(song.title||file.name).slice(0,120);song.notes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch);song.durationMs=song.notes.reduce((m,n)=>Math.max(m,n.start+n.duration),0);song.noteCount=song.notes.length;return this.save(song);}
}
