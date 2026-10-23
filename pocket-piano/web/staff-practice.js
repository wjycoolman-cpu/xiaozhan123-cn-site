/* Interactive notation adapter. Engraving remains the existing Java/TeaVM
   FullScoreDocument + bundled VexFlow. Audio and the main Guide stay in app.js. */
import * as formal from './native-synth.js';

const QUARTER_TICKS=96, GRID_TICKS=24;
const pitchOf=n=>Number(typeof n==='number'?n:n?.pitch);
const pitches=notes=>new Set((notes||[]).map(pitchOf).filter(Number.isFinite));
const noteKey=n=>`${Number(n.pitch)}:${Number(n.start)}:${Number(n.duration)}`;
const sameSlice=(a,b)=>a.boxes.length===b.boxes.length&&a.boxes.every((v,i)=>v.start===b.boxes[i].start&&v.end===b.boxes[i].end);
const quantizedSpan=(n,bpm)=>{
 const start=Math.round(n.start*bpm*QUARTER_TICKS/60000/GRID_TICKS)*GRID_TICKS;
 return [start,Math.max(start+GRID_TICKS,Math.round((n.start+n.duration)*bpm*QUARTER_TICKS/60000/GRID_TICKS)*GRID_TICKS)];
};

/** Enrich the published full-score payload with its original source events.
 * Source indices use Song's stable start/pitch/duration order, including unisons.
 * No new notation, voice allocation, or playback events are generated here. */
export function buildStaffModel(song,pages){
 const notes=song.notes.map(n=>({...n})).sort((a,b)=>a.start-b.start||a.pitch-b.pitch||a.duration-b.duration);
 const bpm=Number(pages[0]?.bpm||song.bpm), tickMs=60000/(bpm*QUARTER_TICKS);
 const durationMs=notes.reduce((end,n)=>Math.max(end,n.start+n.duration),Number(song.durationMs)||0);
 const byPitch=Array.from({length:128},()=>[]),byEvent=new Map(),unisons=new Map();
 let quantizedNoteCount=0,maximumQuantizationErrorMs=0;
 notes.forEach((n,i)=>{
  byPitch[n.pitch].push(i);
  const key=noteKey(n);if(!byEvent.has(key))byEvent.set(key,[]);byEvent.get(key).push(i);
  const [startTick,endTick]=quantizedSpan(n,bpm);
  const chordKey=`${n.pitch}:${n.start}:${endTick}`;
  if(!unisons.has(chordKey))unisons.set(chordKey,[]);unisons.get(chordKey).push(i);
  const error=Math.max(Math.abs(startTick*tickMs-n.start),Math.abs(endTick*tickMs-n.start-n.duration));
  maximumQuantizationErrorMs=Math.max(maximumQuantizationErrorMs,error);if(error>.51)quantizedNoteCount++;
 });
 const systems=[],voiceIds=new Map();
 for(const page of pages)for(const line of page.systems||[]){
  let system=systems[systems.length-1];
  if(!system||!sameSlice(system,line)){
   const boxes=line.boxes.map(b=>({...b,startMs:b.start*tickMs,endMs:b.end*tickMs}));
   system={boxes,rows:[],heads:[],height:0,y:0,startMs:boxes[0]?.startMs||0,endMs:boxes.at(-1)?.endMs||durationMs,parts:0};
   systems.push(system);
  }
  system.parts++;const yOffset=system.height;system.height+=Number(line.height)||0;
  for(const row of line.rows||[]){
   const voiceKey=row.clef+':'+String(row.label).replace(/续$/,'');
   if(!voiceIds.has(voiceKey))voiceIds.set(voiceKey,voiceIds.size);
   const cells=row.cells.map((cell,col)=>{
    let startTick=line.boxes[col].start;
    const tokens=cell.map(token=>{
     const t={...token,startTick,notes:token.notes.map(head=>{
      const raw=notes[head.source];
      if(!raw||raw.pitch!==head.pitch)throw Error('曲谱原始音符索引不一致');
      const n={...head,startMs:raw.start,durationMs:raw.duration};
      if(head.unisons>1){
       const [,endTick]=quantizedSpan(raw,bpm);
       const occurrences=unisons.get(`${raw.pitch}:${raw.start}:${endTick}`)||[];
       if(occurrences.length!==head.unisons)throw Error('同音事件与原始曲谱不一致');
       n.events=occurrences.map(i=>[i,notes[i].start,notes[i].duration]);
      }
      system.heads.push(...(n.events?n.events.map(e=>e[0]):[head.source]));return n;
     })};
     startTick+=token.ticks;return t;
    });
    if(startTick!==line.boxes[col].end)throw Error('曲谱片段时值不完整');return tokens;
   });
   system.rows.push({...row,voiceId:voiceIds.get(voiceKey),y:row.y-line.y+yOffset,staveY:row.staveY-line.y+yOffset,cells});
  }
 }
 const firstSystem=new Int32Array(notes.length);firstSystem.fill(-1);
 systems.forEach((s,i)=>{s.heads=[...new Set(s.heads)];for(const source of s.heads)if(firstSystem[source]<0)firstSystem[source]=i;});
 if(!systems.length)throw Error('没有可显示的五线谱');
 return {songId:song.id,title:pages[0]?.title||song.title,bpm,meter:pages[0]?.meter||'4/4',key:pages[0]?.key||'C',flats:!!pages[0]?.flats,
  approximate:true,notice:'演奏数据自动排谱 · 拍号、调号及声部分配为排版推定，非原版出版谱。',grid:'1/16',
  durationMs,sourceNoteCount:notes.length,quantizedNoteCount,maximumQuantizationErrorMs,notes,systems,firstSystem,byPitch,byEvent};
}

function sourcesFor(model,systemIndex,onset,wanted){
 if(!wanted.size||onset<0)return[];
 return model.systems[systemIndex].heads.filter(i=>{
  const n=model.notes[i];return n.start>=onset&&n.start<=onset+45&&wanted.has(n.pitch);
 });
}
function sourceForTarget(model,onset,wanted){
 let first=Infinity;
 for(const pitch of wanted){
  const indexes=model.byPitch[pitch]||[];let low=0,high=indexes.length;
  while(low<high){const mid=(low+high)>>>1;if(model.notes[indexes[mid]].start<onset)low=mid+1;else high=mid;}
  if(low<indexes.length&&model.notes[indexes[low]].start<=onset+45&&model.firstSystem[indexes[low]]>=0)first=Math.min(first,indexes[low]);
 }
 return Number.isFinite(first)?first:-1;
}
function systemAt(model,ms,source=-1){
 if(source>=0&&model.firstSystem[source]>=0)return model.firstSystem[source];
 let low=0,high=model.systems.length;
 while(low<high){const mid=(low+high)>>>1;if(model.systems[mid].startMs<=ms)low=mid+1;else high=mid;}
 return Math.max(0,low-1);
}

export function staffFrame(model,view,generation,frameId,exporting=false){
 const follow=view.mode==='follow',group=view.groups?.[view.groupIndex],next=view.groups?.[view.groupIndex+1];
 const all=pitches(group?.notes),pending=pitches(view.expected),accepted=new Set([...all].filter(p=>!pending.has(p)));
 const onset=group?.start??-1,source=follow?sourceForTarget(model,onset,all):-1;
 const ms=Math.max(0,Number(view.position)||0),index=systemAt(model,ms,source);
 let currentSources=follow?sourcesFor(model,index,onset,all):[];
 if(view.mode==='auto')currentSources=[...new Set((view.active||[]).flatMap(n=>model.byEvent.get(noteKey(n))||[]))];
 return {generation,frameId,systemIndex:index,ms,mode:follow?'FOLLOW':view.mode==='auto'?'AUTO':'FREE',playing:!!view.playing,speed:Number(view.speed)||1,
  sampleEpochMs:Number.isFinite(view.sampleEpochMs)?view.sampleEpochMs:Date.now(),exporting,targetTime:onset,focusSource:source,
  expected:[...pending],nextExpected:[...pitches(next?.notes)],held:[...pitches(view.held)],automatic:[...pitches(view.active)],
  currentSources,nextSources:follow?sourcesFor(model,index,next?.start??-1,pitches(next?.notes)):[],
  acceptedSources:follow?sourcesFor(model,index,onset,accepted):[]};
}
function systemPayload(model,index,generation){
 const system=model.systems[index];
 return {...model,notes:undefined,firstSystem:undefined,byPitch:undefined,byEvent:undefined,
  generation,systemIndex:index,systemCount:model.systems.length,startMs:system.startMs,endMs:system.endMs,
  width:595,height:system.height+16,sameTimePart:0,sameTimeParts:system.parts,sameTimePartsMerged:true,systems:[system]};
}

// The compiled Java module and its score cache are private to this worker.
// Loading notation therefore cannot reset the main app's Guide or audio engine.
const inWorker=typeof document==='undefined'&&typeof self!=='undefined';
if(inWorker)self.onmessage=event=>{
 const {generation,song}=event.data||{};
 try{
  formal.loadSong(JSON.stringify(song));formal.scorePrepare();
  const pages=[],count=formal.scorePages(1);
  for(let page=0;page<count;page++)pages.push(JSON.parse(formal.scoreStaff(page,generation)));
  self.postMessage({generation,model:buildStaffModel(song,pages)});
 }catch(error){self.postMessage({generation,error:String(error?.message||error).slice(0,400)});}
};

const deadline=(promise,ms,message)=>{
 let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));
};

export class StaffPractice{
 constructor(container){
  this.container=container;this.active=false;this.disposed=false;this.generation=0;this.frameId=0;this.frameRevision=0;
  this.loadedSystem=-1;this.model=null;this.song=null;this.latest=null;this.busy=false;this.offlineBusy=false;this.error='';this.errors=[];
  this.element=document.createElement('div');this.element.className='staff-practice-layer';
  Object.assign(this.element.style,{position:'absolute',inset:'0',overflow:'hidden',background:'#fffefb'});this.element.hidden=true;
  this.frame=document.createElement('iframe');this.frame.title='互动五线谱：演奏数据近似排版';
  Object.assign(this.frame.style,{display:'block',width:'100%',height:'100%',border:'0'});
  this.message=document.createElement('div');this.message.setAttribute('role','status');
  Object.assign(this.message.style,{position:'absolute',inset:'0',display:'none',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'12px',padding:'24px',color:'#304452',background:'#fffefb',font:'14px sans-serif'});
  this.messageText=document.createElement('span');this.retry=document.createElement('button');this.retry.type='button';this.retry.textContent='重新载入五线谱';
  this.retry.onclick=()=>{if(this.song){
   if(!this.frame.contentWindow?.StaffPractice||this.sceneFailed)this._loadScene();
   this.generation++;this.cancelPreparation?.();this.worker?.terminate();this.model=null;this.preparing=null;
   this._prepare().then(()=>this._pump()).catch(()=>{});
  }};
  this.message.append(this.messageText,this.retry);this.element.append(this.frame,this.message);container.append(this.element);
  this.boot=null;
 }
 _loadScene(){
  this.sceneFailed=false;this.loadedSystem=-1;
  this.boot=deadline(new Promise((resolve,reject)=>{
   this.frame.onload=()=>{
    const stage=this.frame.contentWindow?.StaffPractice;if(!stage){reject(Error('五线谱组件未能启动'));return;}
    const child=this.frame.contentWindow;
    for(const type of ['keydown','keyup'])child.addEventListener(type,event=>{
     if(this.disposed||!this.active)return;
     const forwarded=new KeyboardEvent(type,{code:event.code,key:event.key,location:event.location,repeat:event.repeat,
      ctrlKey:event.ctrlKey,altKey:event.altKey,shiftKey:event.shiftKey,metaKey:event.metaKey,cancelable:true});
     window.dispatchEvent(forwarded);if(forwarded.defaultPrevented)event.preventDefault();
    });
    stage.setActive(this.active);resolve(stage);
   };
   this.frame.onerror=()=>reject(Error('五线谱页面未能载入'));
  }),15000,'五线谱页面载入超时');this.boot.catch(error=>{this.sceneFailed=true;this._fail(error);});
  this.frame.src='/pocket-piano/web/staff-practice/scene.html';
 }
 _notice(text,retry=false){this.messageText.textContent=text;this.retry.hidden=!retry;this.message.style.display=text?'flex':'none';}
 _fail(error){
  if(this.disposed)return;this.error=String(error?.message||error);this.errors.push(this.error);this.errors=this.errors.slice(-12);
  this._notice('五线谱暂不可用：'+this.error,true);
 }
 async setSong(song){
  if(this.disposed)return false;
  const same=this.song===song||this.song?.id===song?.id&&this.song?.notes===song?.notes;
  if(!same){this.generation++;this.cancelPreparation?.();this.worker?.terminate();this.worker=null;this.song=song;this.model=null;this.snapshot=null;this.preparing=null;this.loadedSystem=-1;this.error='';}
  if(!song){this._notice('选择一首曲目后即可看谱演奏');return false;}
  if(!this.active)return false;await this._prepare();this._pump();return true;
 }
 _prepare(){
  if(this.model)return Promise.resolve(this.model);if(this.preparing)return this.preparing;
  if(!this.song||this.disposed)return Promise.resolve(null);
  const generation=this.generation;this._notice('正在准备五线谱…');this.error='';
  let worker;try{worker=new Worker(new URL('./staff-practice.js',import.meta.url),{type:'module',name:'piano-staff-layout'});}
  catch(error){this._fail(error);return Promise.reject(error);}this.worker=worker;
  this.preparing=deadline(new Promise((resolve,reject)=>{
   this.cancelPreparation=()=>resolve(null);
   worker.onmessage=event=>{
    if(event.data?.generation!==generation)return;
    if(event.data.error)reject(Error(event.data.error));else resolve(event.data.model);
   };
   worker.onerror=event=>reject(Error(event.message||'曲谱排版组件无法载入'));
   worker.postMessage({generation,song:this.song});
  }),25000,'曲谱准备超时，请重试').then(model=>{
   if(this.disposed||generation!==this.generation)return null;
   this.model=model;this.loadedSystem=-1;this._notice('');return model;
  }).catch(error=>{if(generation===this.generation)this._fail(error);throw error;}).finally(()=>{
   worker.terminate();if(this.worker===worker)this.worker=null;if(generation===this.generation){this.preparing=null;this.cancelPreparation=null;}
  });return this.preparing;
 }
 setActive(value){
  this.active=!!value&&!this.disposed;this.element.hidden=!this.active;
  if(this.active&&!this.boot)this._loadScene();
  this.frame.contentWindow?.StaffPractice?.setActive(this.active);
  if(this.active&&this.song)this._prepare().then(()=>this._pump()).catch(()=>{});
 }
 update(view){
  if(this.disposed||!view)return;this.latest={...view,sampleEpochMs:Date.now()};this.frameRevision++;
  if(view.song&&!(this.song===view.song||this.song?.id===view.song.id&&this.song?.notes===view.song.notes)){
   this.setSong(view.song).catch(()=>{});return;
  }
  if(this.active&&!this.model&&!this.preparing&&!this.error)this._prepare().then(()=>this._pump()).catch(()=>{});
  this._pump();
 }
 _pump(){
  if(this.busy||this.offlineBusy||!this.active||!this.model||!this.latest||this.error||this.disposed)return;
  if(this.latest.song?.id!==this.song?.id||this.latest.song?.notes!==this.song?.notes)return;
  const revision=this.frameRevision,view=this.latest;this.busy=true;
  this.rendering=this._render(view,false).catch(error=>{if(this.active)this._fail(error);}).finally(()=>{
   this.busy=false;if(revision!==this.frameRevision)this._pump();
  });
 }
 async _render(view,exporting){
  const model=this.model,generation=this.generation;if(!model)return null;
  if(!this.boot)this._loadScene();const stage=await this.boot;if(this.disposed||generation!==this.generation)return null;
  const frame=staffFrame(model,view,generation,++this.frameId,exporting);
  if(this.loadedSystem!==frame.systemIndex){
   await deadline(stage.loadSystem(systemPayload(model,frame.systemIndex,generation)),15000,'五线谱显示超时');
   if(this.disposed||generation!==this.generation)return null;
   const loaded=stage.inspect();if(!loaded.ready)throw Error(loaded.error||'五线谱未能显示');this.loadedSystem=frame.systemIndex;
  }
  if(this.disposed||generation!==this.generation)return null;
  await deadline(stage.frame(frame),5000,'五线谱同步超时');
  if(this.disposed||generation!==this.generation)return null;
  const snapshot=stage.inspect();if(snapshot.error)throw Error(snapshot.error);
  this.snapshot=snapshot;return snapshot;
 }
 async offlineFrame(ms,view=this.latest){
  if(!view)return null;this.offlineBusy=true;
  try{await this.rendering;await this._prepare();return await this._render({...view,position:ms,sampleEpochMs:0},true);}
  finally{this.offlineBusy=false;}
 }
 inspect(){
  const stage=this.frame.contentWindow?.StaffPractice?.inspect()||null;
  const failed=!!this.error||!!stage?.error;
  const ready=!!this.model&&!failed&&!!stage?.ready&&stage.loadedGeneration===this.generation&&
   stage.loadedSystemIndex===this.loadedSystem&&this.snapshot?.loadedGeneration===this.generation&&this.snapshot?.loadedSystemIndex===this.loadedSystem;
  return {version:'web-staff-practice-1',state:this.disposed?'disposed':failed?'failed':ready?'ready':this.preparing?'preparing':this.active?'loading':'inactive',
   active:this.active,disposed:this.disposed,preparing:!!this.preparing,modelReady:!!this.model,ready,failed,
   error:this.error||stage?.error||'',errors:[...this.errors],generation:this.generation,songId:this.song?.id||null,systemCount:this.model?.systems.length||0,
   sourceNoteCount:this.model?.sourceNoteCount||0,approximate:true,notice:this.model?.notice||'',snapshot:this.snapshot||null,
   stage};
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.active=false;this.generation++;this.cancelPreparation?.();this.worker?.terminate();this.worker=null;
  this.frame.contentWindow?.StaffPractice?.close();this.element.remove();this.model=null;this.latest=null;
 }
}
