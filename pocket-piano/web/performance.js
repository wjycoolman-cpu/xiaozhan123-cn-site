/* Passive, memory-only diagnostics for Pocket Piano. No network/storage/input capture.
 * Custom async-to-ready intervals are not INP, pixel paint, or audible latency.
 * References: https://web.dev/articles/custom-metrics and https://www.w3.org/TR/user-timing/
 */
export const PERFORMANCE_OPERATIONS = Object.freeze([
  'shell.ready','menu.open','view.ready','song.load','audio.ready','playback.start',
  'recording.start','export.ready','library.search','library.load','input.command','surface.ready'
]);
export const PERFORMANCE_LIMITS = Object.freeze({entries:112,perOperation:16,pending:12,inputAgeMs:1500,tokenAgeMs:300000});
const OPERATIONS = new Set(PERFORMANCE_OPERATIONS);
const OUTCOMES = new Set(['ready','failed','cancelled','empty','not_visible','unavailable','expired','stale']);
const BOUNDARIES = new Set(['async_to_ready','dom_ready','command_ready','paint_opportunity']);
const INPUT_TYPES = new Set(['click','pointerdown','pointerup','keydown','keyup','input','change']);
const ENUMS = {
  view:new Set(['keys','staff','waterfall']), mode:new Set(['free','follow','auto']),
  surface:new Set(['piano','calculator','pad','touch','scope','handheld','visualizer','music']),
  source:new Set(['builtin','custom','online','snapshot','legacy','unknown']),
  stage:new Set(['dom','command','data','paint_opportunity']),
  kind:new Set(['settings','help','export','json','wav','video','midi','eop']),
  trigger:new Set(['click','keydown','pointerdown','programmatic'])
};
const COUNTERS = ['evicted','perOperationEvicted','stale','expired','duplicateFinish','invalid','observerErrors','userTimingErrors','clockErrors'];
const read=(object,key)=>{try{return object?.[key];}catch(_){return undefined;}};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const numeric=(value,max=1e12)=>finite(value)&&value>=0&&value<=max?Math.round(value*10)/10:null;
const operation=name=>typeof name==='string'&&OPERATIONS.has(name)?name:'other';
const outcome=value=>OUTCOMES.has(value)?value:value==='canceled'?'cancelled':value==='error'?'failed':'unavailable';
const boundary=value=>BOUNDARIES.has(value)?value:'async_to_ready';
function cleanContext(value){
  const result={};
  for(const[key,allowed]of Object.entries(ENUMS)){const item=read(value,key);if(allowed.has(item))result[key]=item;}
  const count=read(value,'count');if(finite(count)&&count>=0&&count<=100000)result.count=Math.round(count);
  return result;
}
function cleanBuild(value){return typeof value==='string'&&/^(?:desktop|runtime)\d{1,3}(?:-(?:perf|port|build|r)\d{1,5})?$/.test(value)?value:'custom-build';}
const clone=value=>JSON.parse(JSON.stringify(value));
const MODULE_URL=new URL(import.meta.url);
const PIANO_PATH=MODULE_URL.pathname.replace(/\/web\/[^/]*$/,'/');
const TOP_ASSETS=new Set(['index.html','app.js','web.css','desktop-studio.css','desktop-workspaces.js','desktop-scenes.js','desktop-scenes.css','desktop-tools.js','desktop-presentation.js','desktop-presentation.css','desktop-recorder.js','desktop-recorder.css','desktop-canvas-input.js','desktop-instruments.css','desktop-audio-worklet.js','desktop-offline-audio.js','instruments.json','desktop-score.js','desktop-score-worker.js','desktop-score.css','print-score.html','print-score.js','print-score.css','keyboard-layout.js','keyboard-layout.css','performance.js','desktop-audio.js','library.js','library-vendor.js','library-search-worker.js','builtin-index.json','native-synth.js','native-video.js','native-pad.js','native-touch.js','native-scope.js','staff-practice.js','native.js','credits.html']);
const ENGINE_ASSETS=new Set(['audio.js','native-synth.js','native-gm.wasm','native-audio-worklet.js','native-search.js']);
function assetPath(value){
  if(typeof value!=='string'||value.length>4096)return null;
  try{
    const url=new URL(value,MODULE_URL);if(url.origin!==MODULE_URL.origin||url.protocol!==MODULE_URL.protocol||url.username||url.password)return null;
    const pathname=url.pathname;if(!pathname.startsWith(PIANO_PATH))return null;const path=pathname.slice(PIANO_PATH.length);
    if(path==='web/'||path==='web')return PIANO_PATH+'web/';
    if(path.startsWith('web/')&&TOP_ASSETS.has(path.slice(4)))return PIANO_PATH+path;
    if(path.startsWith('demo/')&&ENGINE_ASSETS.has(path.slice(5)))return PIANO_PATH+path;
    if(/^web\/assets\/native\/visual-stage\/(?:scene\.html|stage\.js|fluid\.js)$/.test(path)||path==='web/assets/delta-harmonica/body.png'||/^web\/full-score\/[a-z-]+\.(?:html|js|css)$/.test(path))return PIANO_PATH+path;
    if(/^web\/builtin\/\d{2}\.json$/.test(path))return PIANO_PATH+'web/builtin/[song].json';
    if(/^demo\/assets\/piano\/\d{3}\.bin$/.test(path))return PIANO_PATH+'demo/assets/piano/[sample].bin';
    if(/^demo\/assets\/offline\/pack-\d{4}\.ppack$/.test(path))return PIANO_PATH+'demo/assets/offline/[pack].ppack';
    if(/^demo\/assets\/details\/pack-\d{4}\.json\.gz$/.test(path))return PIANO_PATH+'demo/assets/details/[pack].json.gz';
    if(['demo/assets/catalog.json.gz','demo/assets/builtin.json','demo/assets/instruments.json','demo/assets/soundfont/TimGM6mb.sf2'].includes(path))return PIANO_PATH+path;
    if(/^demo\/vendor\/[a-z0-9.-]+\.(?:js|css|wasm)$/.test(path)&&!/%/.test(path))return PIANO_PATH+'demo/vendor/[library].'+path.split('.').at(-1);
  }catch(_){}return null;
}

export function createPerformanceRecorder(options={}){
  const perf=read(options,'performance')??globalThis.performance;
  const requestFrame=read(options,'requestFrame')??globalThis.requestAnimationFrame;
  const cancelFrame=read(options,'cancelFrame')??globalThis.cancelAnimationFrame;
  const PO=read(options,'PerformanceObserver')??globalThis.PerformanceObserver;
  const visibility=read(options,'visibility')??(()=>globalThis.document?.visibilityState||'unknown');
  const visibilityTarget=read(options,'visibilityTarget')??globalThis.document;
  const build=cleanBuild(read(options,'build')??'desktop42-perf1');
  const counters=Object.fromEntries(COUNTERS.map(key=>[key,0]));
  const history=[],active=new Map(),tokens=new WeakMap(),paints=new Map(),observers=[],seen=new Set();
  const ownedMeasures=new Set(),ownedMarks=new Set();
  let disposed=false,serial=0,frameScheduled=false,frameId=null,lastInput=null;
  let clockAvailable=typeof read(perf,'now')==='function';
  let timingEnabled=['mark','measure','clearMarks','clearMeasures'].every(key=>typeof read(perf,key)==='function');
  const capabilities={userTiming:timingEnabled?'available':'unavailable',navigation:'unavailable',resource:'unavailable',blocking:'unavailable'};
  const bump=key=>{counters[key]=Math.min(2147483647,counters[key]+1);};
  function now(){try{const value=perf?.now?.();if(finite(value)&&value>=0){clockAvailable=true;return value;}}catch(_){}clockAvailable=false;bump('clockErrors');return null;}
  function visible(){try{return visibility()==='visible';}catch(_){return false;}}
  function disableTiming(){timingEnabled=false;capabilities.userTiming='failed';bump('userTimingErrors');}
  function clearMark(name){if(!name)return;try{perf.clearMarks(name);ownedMarks.delete(name);}catch(_){disableTiming();}}
  function clearMeasure(name){if(!name)return;try{perf.clearMeasures(name);ownedMeasures.delete(name);}catch(_){disableTiming();}}
  function mark(name,time){if(!timingEnabled)return null;try{perf.mark(name,{startTime:time});ownedMarks.add(name);return name;}catch(_){disableTiming();return null;}}
  function measure(token,end){
    if(!timingEnabled||!token.startMark){clearMark(token.startMark);return null;}
    const endMark=mark(token.markBase+':end',end);if(!endMark){clearMark(token.startMark);return null;}
    let measured=null;
    try{perf.measure(token.markBase,{start:token.start,end});ownedMeasures.add(token.markBase);measured=token.markBase;}catch(_){disableTiming();}
    clearMark(token.startMark);clearMark(endMark);return measured;
  }
  function remove(index,reason){const[entry]=history.splice(index,1);seen.delete(entry._signature);if(entry._measure)clearMeasure(entry._measure);bump(reason);}
  function add(entry){
    if(disposed)return;
    const signature=[entry.type,entry.operation||entry.path||'',entry.startTimeMs,entry.durationMs,entry.outcome||''].join('|');
    if(seen.has(signature)){if(entry._measure)clearMeasure(entry._measure);return;}entry._signature=signature;
    if(entry.type==='operation')while(history.filter(item=>item.type==='operation'&&item.operation===entry.operation).length>=PERFORMANCE_LIMITS.perOperation)remove(history.findIndex(item=>item.type==='operation'&&item.operation===entry.operation),'perOperationEvicted');
    const categoryLimit=entry.type==='resource'?40:entry.type==='navigation'?2:entry.type==='blocking'?32:null;
    if(categoryLimit)while(history.filter(item=>item.type===entry.type).length>=categoryLimit)remove(history.findIndex(item=>item.type===entry.type),'evicted');
    while(history.length>=PERFORMANCE_LIMITS.entries)remove(0,'evicted');history.push(entry);seen.add(signature);
  }
  function settlePaint(token,value){const pending=paints.get(token);if(pending){paints.delete(token);pending.resolve(value);} }
  function invalidate(token,reason){if(token.done)return;token.done=true;token.invalid=reason;if(active.get(token.operation)===token)active.delete(token.operation);clearMark(token.startMark);settlePaint(token,false);bump(reason==='expired'?'expired':'stale');}
  function expire(time){if(time===null)return;for(const token of active.values())if(time-token.start>PERFORMANCE_LIMITS.tokenAgeMs)invalidate(token,'expired');if(lastInput&&time-lastInput.observedAt>PERFORMANCE_LIMITS.inputAgeMs)lastInput=null;}
  function makeToken(name,start,context,timingSource='recorder_performance_clock'){
    const id=++serial,op=operation(name);const token={id,operation:op,start,context:cleanContext(context),timingSource,done:false,invalid:null,markBase:'piano-perf:'+op+':'+id};token.startMark=mark(token.markBase+':start',start);return token;
  }
  function finishToken(token,result='ready',context,extra={}){
    try{
      if(disposed||token.invalid)return false;if(token.done){bump('duplicateFinish');return false;}
      const time=now();if(time===null){invalidate(token,'stale');return false;}expire(time);if(token.invalid)return false;
      if(active.get(token.operation)!==token){invalidate(token,'stale');return false;}
      token.done=true;active.delete(token.operation);
      const entry={type:'operation',operation:token.operation,startTimeMs:numeric(token.start),durationMs:numeric(Math.max(0,time-token.start)),outcome:outcome(result),boundary:boundary(extra.boundary),timingSource:token.timingSource,context:{...token.context,...cleanContext(context)}};
      if(token.input)entry.interaction={type:token.input.type,inputDelayMs:numeric(Math.max(0,token.start-token.input.timeStamp)),inputToReadyMs:numeric(Math.max(0,time-token.input.timeStamp)),meaning:'custom_command_interval_not_INP'};
      if(extra.paint)entry.paintOpportunity=extra.paint;
      entry._measure=measure(token,time);add(entry);settlePaint(token,true);return true;
    }catch(_){bump('invalid');settlePaint(token,false);return false;}
  }
  function begin(name,settings={}){
    try{
      const time=now();if(disposed||time===null)return()=>false;expire(time);
      const op=operation(name);if(active.has(op))invalidate(active.get(op),'stale');
      const supplied=read(settings,'startTime');const start=finite(supplied)&&supplied>=0&&supplied<=time?supplied:time;
      const token=makeToken(op,start,read(settings,'context'));active.set(op,token);
      if(read(settings,'interaction')===true&&lastInput&&time-lastInput.observedAt<=PERFORMANCE_LIMITS.inputAgeMs&&lastInput.timeStamp<=start)token.input={type:lastInput.type,timeStamp:lastInput.timeStamp};
      const finish=(result='ready',context)=>finishToken(token,result,context);tokens.set(finish,token);return finish;
    }catch(_){bump('invalid');return()=>false;}
  }
  function finishPaint(token,pending,result,reason){
    return finishToken(token,result,pending.context,{boundary:'paint_opportunity',paint:{frames:pending.frames,status:reason,meaning:'rendering_opportunity_only_no_pixel_confirmation'}});
  }
  function flushInvisible(){if(visible())return;for(const[token,pending]of [...paints])finishPaint(token,pending,'not_visible','not_visible');}
  function queueFrame(){
    if(frameScheduled||!paints.size||disposed)return;
    if(typeof requestFrame!=='function'){for(const[token,pending]of [...paints])finishPaint(token,pending,'unavailable','raf_unavailable');return;}
    frameScheduled=true;
    try{frameId=requestFrame.call(globalThis,()=>{
      frameScheduled=false;frameId=null;if(disposed)return;
      for(const[token,pending]of [...paints]){
        if(token.done||token.invalid){settlePaint(token,false);continue;}
        if(!visible()){finishPaint(token,pending,'not_visible','not_visible');continue;}
        pending.frames++;if(pending.frames>=2)finishPaint(token,pending,pending.result,'double_raf_observed');
      }queueFrame();
    });}catch(_){frameScheduled=false;frameId=null;for(const[token,pending]of [...paints])finishPaint(token,pending,'unavailable','raf_failed');}
  }
  function afterPaint(finish,result='ready',context){
    try{
      const token=typeof finish==='function'?tokens.get(finish):null;if(disposed||!token||token.done||token.invalid)return Promise.resolve(false);
      if(paints.has(token))return paints.get(token).promise;
      let resolve;const promise=new Promise(done=>resolve=done);const pending={promise,resolve,result:outcome(result),context:cleanContext(context),frames:0};paints.set(token,pending);
      if(!visible())finishPaint(token,pending,'not_visible','not_visible');else queueFrame();return promise;
    }catch(_){bump('invalid');return Promise.resolve(false);}
  }
  function observeInput(event){
    try{
      if(disposed)return false;const type=read(event,'type');if(!INPUT_TYPES.has(type))return false;
      const observedAt=now();if(observedAt===null)return false;let timeStamp=read(event,'timeStamp');if(!finite(timeStamp))return false;
      const origin=read(perf,'timeOrigin');if(timeStamp>observedAt+1&&finite(origin)&&origin>0)timeStamp-=origin;
      if(timeStamp<0||timeStamp>observedAt+1||observedAt-timeStamp>60000)return false;lastInput={type,timeStamp,observedAt};return true;
    }catch(_){bump('invalid');return false;}
  }
  function ingest(value){
    try{
      if(disposed)return false;const time=now(),start=read(value,'startTime'),end=read(value,'endTime');
      if(time===null||!finite(start)||!finite(end)||start<0||end<start||end>time){bump('invalid');return false;}
      const token=makeToken(read(value,'name'),start,read(value,'context'),'caller_performance_clock');const edge=boundary(read(value,'boundary'));
      let result=outcome(read(value,'outcome')??'ready');if(edge==='paint_opportunity'&&!visible()&&result==='ready')result='not_visible';
      const entry={type:'operation',operation:token.operation,startTimeMs:numeric(start),durationMs:numeric(end-start),outcome:result,boundary:edge,timingSource:token.timingSource,context:token.context};
      if(edge==='paint_opportunity')entry.paintOpportunity={frames:null,status:'caller_reported_opportunity',meaning:'rendering_opportunity_only_no_pixel_confirmation'};
      entry._measure=measure(token,end);add(entry);return true;
    }catch(_){bump('invalid');return false;}
  }
  function resource(entry){
    const path=assetPath(read(entry,'name'));if(!path)return;
    const start=numeric(read(entry,'startTime')),duration=numeric(read(entry,'duration'));if(start===null||duration===null)return;
    const row={type:'resource',path,startTimeMs:start,durationMs:duration};
    const initiator=read(entry,'initiatorType');row.initiator=['script','link','css','img','fetch','xmlhttprequest','iframe','audio','video','other'].includes(initiator)?initiator:'other';
    for(const field of ['transferSize','encodedBodySize','decodedBodySize']){const value=numeric(read(entry,field),1e10);if(value!==null)row[field]=value;}
    const delivery=read(entry,'deliveryType');row.cacheHint=delivery==='cache'?'reported_cache':row.transferSize===0&&row.decodedBodySize>0?'local_cache_or_unreported':row.transferSize>0?'transfer_reported':'unreported';
    add(row);
  }
  function navigation(entry){
    const path=assetPath(read(entry,'name'));if(path!==PIANO_PATH+'web/'&&path!==PIANO_PATH+'web/index.html')return;
    const start=numeric(read(entry,'startTime')),duration=numeric(read(entry,'duration'));if(start===null||duration===null)return;
    const row={type:'navigation',path:PIANO_PATH+'web/',startTimeMs:start,durationMs:duration};
    const kind=read(entry,'type');row.navigationType=['navigate','reload','back_forward','prerender'].includes(kind)?kind:'unknown';
    for(const field of ['responseEnd','domInteractive','domContentLoadedEventEnd','loadEventEnd','transferSize','encodedBodySize','decodedBodySize']){const value=numeric(read(entry,field));if(value!==null)row[field]=value;}add(row);
  }
  function blocking(entry,type){
    const start=numeric(read(entry,'startTime')),duration=numeric(read(entry,'duration'));if(start===null||duration===null)return;
    const row={type:'blocking',source:type,startTimeMs:start,durationMs:duration};
    if(type==='long-animation-frame')for(const field of ['blockingDuration','renderStart','styleAndLayoutStart']){const value=numeric(read(entry,field));if(value!==null)row[field]=value;}add(row);
  }
  function collect(list,type){
    if(disposed)return;try{
      const values=list?.getEntries?list.getEntries():list;if(!Array.isArray(values))return;
      for(const entry of values.slice(-256)){if(type==='resource')resource(entry);else if(type==='navigation')navigation(entry);else blocking(entry,type);}
    }catch(_){bump('observerErrors');}
  }
  function observe(type){
    if(typeof PO!=='function')return false;let observer;
    try{observer=new PO(list=>collect(list,type));observer.observe({type,buffered:true});observers.push({observer,type});return true;}
    catch(_){try{observer?.disconnect();}catch(_){}bump('observerErrors');return false;}
  }
  function fallbackEntries(type){try{const getter=read(perf,'getEntriesByType');if(typeof getter==='function')collect(getter.call(perf,type),type);}catch(_){bump('observerErrors');}}
  try{
    const supported=read(PO,'supportedEntryTypes');
    for(const type of ['navigation','resource']){if((!Array.isArray(supported)||supported.includes(type))&&observe(type))capabilities[type]='observing';else if(typeof read(perf,'getEntriesByType')==='function'){capabilities[type]='snapshot_fallback';fallbackEntries(type);}}
    const preferred=Array.isArray(supported)&&supported.includes('long-animation-frame')?'long-animation-frame':'longtask';
    if((!Array.isArray(supported)||supported.includes(preferred))&&observe(preferred))capabilities.blocking=preferred;
    else if(preferred==='long-animation-frame'&&(!Array.isArray(supported)||supported.includes('longtask'))&&observe('longtask'))capabilities.blocking='longtask';
    visibilityTarget?.addEventListener?.('visibilitychange',flushInvisible,{passive:true});
  }catch(_){bump('observerErrors');}
  function snapshot({audioContext}={}){
    try{
      const time=now();expire(time);if(!disposed)for(const{observer,type}of observers){try{collect(observer.takeRecords?.()||[],type);}catch(_){bump('observerErrors');}}
      if(!disposed)for(const type of ['navigation','resource'])if(capabilities[type]==='snapshot_fallback')fallbackEntries(type);
      const entries=history.map(entry=>{const copy={...entry};delete copy._signature;delete copy._measure;return clone(copy);});
      const result={schema:'piano-local-performance-v1',build,collection:'passive_memory_only',disposed,clock:{available:clockAvailable,unit:'milliseconds_relative_to_page_performance_clock',capturedAtMs:numeric(time)},
        limits:{...PERFORMANCE_LIMITS},capabilities:{...capabilities},counters:{...counters},entries,pending:[...active.values()].map(token=>({operation:token.operation,startTimeMs:numeric(token.start)})),
        interpretation:{customIntervals:'DOM or command readiness supplied by the application; not INP.',input:'Trigger labels and recent-input correlation are caller hints, not verified trusted interactions or INP.',paint:'Two requestAnimationFrame callbacks provide a rendering opportunity, not proof of pixels shown.',audio:'Audio command readiness is not proof of audible output or end-to-end latency.',ingested:'Caller performance-clock start/end times are imported without replaying the operation.',cache:'Resource transfer/cache hints do not certify cold or warm starts.',privacy:'Fixed names/enums, relative times and sanitized same-origin piano asset paths only. No content, identity, storage data, or automatic upload.'}};
      if(audioContext){const audio={};const state=read(audioContext,'state');if(['running','suspended','closed','interrupted'].includes(state))audio.state=state;
        for(const field of ['sampleRate','baseLatency','outputLatency']){const item=read(audioContext,field);if(finite(item)&&item>=0&&item<=(field==='sampleRate'?384000:60))audio[field]=field==='sampleRate'?Math.round(item):Math.round(item*1000000)/1000000;}result.audioContext=audio;}
      return result;
    }catch(_){return{schema:'piano-local-performance-v1',build,collection:'passive_memory_only',unavailable:true,entries:[]};}
  }
  function dispose(){
    if(disposed)return;disposed=true;lastInput=null;
    for(const token of active.values()){token.done=true;token.invalid='disposed';clearMark(token.startMark);settlePaint(token,false);}active.clear();
    if(frameScheduled&&typeof cancelFrame==='function')try{cancelFrame.call(globalThis,frameId);}catch(_){}frameScheduled=false;
    for(const{observer}of observers)try{observer.disconnect();}catch(_){}observers.length=0;
    try{visibilityTarget?.removeEventListener?.('visibilitychange',flushInvisible);}catch(_){}
    for(const name of [...ownedMarks])clearMark(name);for(const name of [...ownedMeasures])clearMeasure(name);
  }
  return Object.freeze({begin,afterPaint,observeInput,ingest,snapshot,dispose});
}
