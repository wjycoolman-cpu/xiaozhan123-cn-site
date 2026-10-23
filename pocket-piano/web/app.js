import {createKeyboardAdapter} from './keyboard-layout.js';
import {DesktopPianoAudio, pitchesForWindow} from './desktop-audio.js';
import {SongLibrary, normalizeWebSong} from './library.js';

// Optional diagnostics must never become a dependency of the piano. These
// fixed operation names/timestamps are buffered in memory while it downloads.
const PERFORMANCE_BUILD='desktop44-port1';
let measurements=null,recentInput=null;
const measurementQueue=[],measurementCounts=new Map(),pendingPaints=new Set();
function measureOperation(name,context={},startTime){
  const now=performance.now(),gesture=!Number.isFinite(startTime)&&recentInput&&now-recentInput.observedAt<100?recentInput:null,input=gesture?gesture.at:now;
  const begin=Number.isFinite(startTime)?startTime:input;let ended=false;
  return(outcome='ready',extra={},boundary='async_to_ready')=>{
    if(ended)return false;ended=true;
    const item={name,startTime:Math.max(0,begin),endTime:performance.now(),outcome,context:{...context,...extra,trigger:gesture?.type||'programmatic'},boundary};
    if(measurements)return measurements.ingest(item);
    const count=measurementCounts.get(name)||0;
    if(count<16&&measurementQueue.length<64){measurementQueue.push(item);measurementCounts.set(name,count+1);}
    return true;
  };
}
function measurePaint(finish,outcome='ready',context={},current=()=>true){
  let frame=null,ended=false;
  const settle=hidden=>{
    if(ended)return;ended=true;pendingPaints.delete(settle);if(frame!==null)cancelAnimationFrame(frame);
    finish(!current()?'canceled':hidden||document.visibilityState==='hidden'?'not_visible':outcome,{...context,stage:'paint_opportunity'},'paint_opportunity');
  };
  pendingPaints.add(settle);
  if(document.visibilityState==='hidden'){settle(true);return;}
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>settle(false));});
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')for(const settle of [...pendingPaints])settle(true);},{passive:true});
for(const type of ['click','keydown','pointerdown'])document.addEventListener(type,event=>{
  const now=performance.now(),stamp=Number(event.timeStamp);
  recentInput={at:Number.isFinite(stamp)&&stamp>=0&&stamp<=now?stamp:now,observedAt:now,type:event.type};measurements?.observeInput(event);
},{capture:true,passive:true});
const performanceReady=import('./performance.js').then(({createPerformanceRecorder})=>{
  measurements=createPerformanceRecorder({build:PERFORMANCE_BUILD});
  for(const item of measurementQueue)measurements.ingest(item);measurementQueue.length=0;measurementCounts.clear();return measurements;
}).catch(()=>null);
const shellTiming=measureOperation('shell.ready',{stage:'dom'},0);

// Additional instruments and score tools load only when selected. Free playing
// does not wait for a catalog, an engraving engine, or a song to be selected.
const $=selector=>document.querySelector(selector);
const all=selector=>[...document.querySelectorAll(selector)];
let audioErrors=0;
const audio=new DesktopPianoAudio(message=>{audioErrors++;status(message);});
const library=new SongLibrary();
const black=new Set([1,3,6,8,10]);
const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const SESSION='piano-web42-session', LAST_SONG='piano-web42-last-song';
const keyboard=$('#keyboard'), roll=$('#roll'), context=roll.getContext('2d');
let formal=null,formalPromise=null,adapter=null,staff=null,staffPromise=null;
let song=null,groups=[],groupIndex=0,position=0,playing=false,mode='free',view='keys';
let speed=1,base=36,whiteCount=36,playEpoch=0,selectionEpoch=0,modeEpoch=0;
let origin=0,nextIndex=0,endPrefix=[],lastPrefetch=-Infinity,pedalHeld=false;
let recording=false,recordStart=0,recordNotes=[],recordOwners=new Map(),recordingPreparing=false,recordingEpoch=0,recordingTiming=null;
const downs=new Map(),pointers=new Map(),keys=new Map(),rects=new Map();
let category='全部',results=[],page=0,searchEpoch=0,sessionReady=false,restoringSession=true,offlineSaved=null;
let lastVisual=0,lastStaff=0,rollDirty=true,loadingSongId='',exportBusy=false,statusTimer=0,pendingResume=null,viewEpoch=0;
let surfaceController=null,surfacePromise=null,toolsPromise=null,toneCatalogPromise=null,rangeDrag=null,presentationController=null,presentationPromise=null,recorderController=null,recorderPromise=null,screenCaptureBusy=false;
let loopState={enabled:false,a:0,b:0},graceStep=-1,graceDue=0;
const desktopOptions={rows:1,labels:'notes',transpose:0,velocity:85,pressure:false,drag:false,skin:0,palette:0,reducedMotion:false,collapse:false};
const practiceOptions={autoHelp:false,staffWaitForCorrect:true,adaptive:true,maximum:1800,hand:'both',split:60,voice:'all',difficulty:'normal'};
let practiceStats={correct:0,wrong:0,helped:0,completed:false};
const sourceAudioCache=new WeakMap();
const impacts=[];let expandedDuringPlay=false,effectsPainted=false;
const outputPitch=p=>Math.max(0,Math.min(127,p+desktopOptions.transpose));
let pointerVelocityOverride=null;
function pointerVelocity(event){const pressure=Number(event?.pressure);return desktopOptions.pressure&&['pen','touch'].includes(event?.pointerType)&&pressure>0&&pressure<=1&&!(event.pointerType==='touch'&&pressure===.5)?Math.max(1,Math.min(127,Math.round(pressure*127))):desktopOptions.velocity;}
function withPointerVelocity(event,callback){const previous=pointerVelocityOverride;pointerVelocityOverride=pointerVelocity(event);try{return callback();}finally{pointerVelocityOverride=previous;}}
function audioSong(value){
  if(!value||!desktopOptions.transpose)return value;
  let row=sourceAudioCache.get(value);if(!row||row.transpose!==desktopOptions.transpose){row={transpose:desktopOptions.transpose,song:{...value,notes:value.notes.map(n=>({...n,pitch:outputPitch(n.pitch)}))}};sourceAudioCache.set(value,row);}return row.song;
}
function applyAppearance(){document.body.dataset.skin=String(desktopOptions.skin);document.body.dataset.palette=String(desktopOptions.palette);document.body.dataset.motion=desktopOptions.reducedMotion?'reduced':'full';}
function surfaceView(){const state=currentView();if(!state.groups.length&&song){let cached=songTimeGroups.get(song);if(!cached){cached=[];for(const n of song.notes){let group=cached.at(-1);if(!group||n.start-group.start>45){group={start:n.start,notes:[]};cached.push(group);}group.notes.push(n);}songTimeGroups.set(song,cached);}return{...state,groups:cached};}return state;}
const songTimeGroups=new WeakMap();
const elapsed=ms=>`${Math.floor(Math.max(0,ms)/60000)}:${String(Math.floor(Math.max(0,ms)/1000)%60).padStart(2,'0')}`;
const noteName=p=>names[p%12]+(Math.floor(p/12)-1);
const duration=()=>song?Math.max(1,song.durationMs):1;
function cancelRestore(){
  if(!restoringSession)return;
  restoringSession=false;selectionEpoch++;loadingSongId='';
}

function status(message){
  clearTimeout(statusTimer);$('#status').textContent=message||'默认电脑键盘 · Enter 开始 / 暂停 · Esc 停止声音';
}
function audioState(message,kind=''){
  $('#audio-state').className='audio-state '+kind;
  $('#audio-state').replaceChildren(Object.assign(document.createElement('i'),{ariaHidden:'true'}),document.createTextNode(message));
}
function engine(){
  if(!formalPromise)formalPromise=import('./native-synth.js').then(module=>formal=module).catch(error=>{formalPromise=null;throw error;});
  return formalPromise;
}
function mapPitch(pitch){
  if(!keys.size)return null;
  const last=[...keys.keys()].at(-1);let mapped=pitch;
  while(mapped<base)mapped+=12;while(mapped>last)mapped-=12;
  return keys.has(mapped)?mapped:null;
}
function configureKeys(){
  releasePhysical();keyboard.replaceChildren();keys.clear();rects.clear();
  let low=128,high=-1;if(desktopOptions.rows===0&&song)for(const n of song.notes){low=Math.min(low,n.pitch);high=Math.max(high,n.pitch);}
  const rows=desktopOptions.rows===0?(high-low>36?2:1):desktopOptions.rows;
  const available=[];for(let p=21;p<=108;p++)if(!black.has(p%12))available.push(p);
  const maximum=available[Math.max(0,available.length-Math.min(available.length,whiteCount*rows))];
  base=Math.max(21,Math.min(maximum,Math.round(Number(base)||36)));while(black.has(base%12))base--;
  const whites=[],pitches=[];let pitch=base;
  while(whites.length<whiteCount*rows&&pitch<=108){pitches.push(pitch);if(!black.has(pitch%12))whites.push(pitch);pitch++;}
  const perRow=Math.min(whiteCount,Math.ceil(whites.length/rows)),width=100/perRow;
  for(const p of pitches){
    const isBlack=black.has(p%12),index=isBlack?whites.filter(v=>v<p).length:whites.indexOf(p);
    const button=document.createElement('button');button.type='button';button.className='key '+(isBlack?'black':'white');
    const row=Math.min(rows-1,Math.floor(Math.max(0,index-(isBlack?.01:0))/perRow)),column=index-row*perRow;
    button.style.left=(isBlack?column*width-width*.31:column*width)+'%';button.style.width=width*(isBlack?.62:1)+'%';button.style.top=row*100/rows+'%';button.style.height=(isBlack?64:100)/rows+'%';
    button.dataset.pitch=p;button.setAttribute('aria-label',noteName(p));button.tabIndex=-1;
    const label=document.createElement('span');label.className='label';
    const name=document.createElement('span');name.className='computer';name.textContent=desktopOptions.labels==='hidden'?'':desktopOptions.labels==='numbers'?['1','♯1','2','♯2','3','4','♯4','5','♯5','6','♯6','7'][p%12]:noteName(p);
    const computer=document.createElement('span');computer.className='name';computer.textContent=adapter?.labelForPitch(p)||'';
    label.append(name,computer);button.append(label);keyboard.append(button);keys.set(p,button);
  }
  $('#range-label').textContent=noteName(base)+' — '+noteName(pitches.at(-1));
  updateRects();updateLights();rollDirty=true;
}
function updateRects(){
  const area=keyboard.getBoundingClientRect();
  for(const[p,b]of keys){const r=b.getBoundingClientRect();rects.set(p,{left:r.left-area.left,width:r.width,black:black.has(p%12)});}
  rollDirty=true;
}
function labels(){for(const[p,b]of keys)b.querySelector('.name').textContent=adapter?.labelForPitch(p)||'';}
function makeGroups(){
  groups=[];endPrefix=[];groupIndex=0;
  if(!song)return;
  let end=0;for(const n of song.notes){end=Math.max(end,n.start+n.duration);endPrefix.push(end);}
  if(mode!=='follow'||!formal){rollDirty=true;return;}
  let guideSong=song;
  const split=practiceOptions.split,hand=practiceOptions.hand,voice=practiceOptions.difficulty==='easy'?'highest':practiceOptions.voice;
  if(hand!=='both'||voice!=='all'||($('#simple').checked&&split!==60)){
    let notes=song.notes.filter(n=>hand==='left'?n.pitch<split:hand==='right'||$('#simple').checked?n.pitch>=split:true);
    if(voice!=='all'){const reduced=[];for(const n of notes){const group=reduced.at(-1);if(!group||n.start-group.start>45)reduced.push({start:n.start,note:n});else if(voice==='lowest'?n.pitch<group.note.pitch:n.pitch>group.note.pitch)group.note=n;}notes=reduced.map(g=>g.note);}
    guideSong={...song,notes};
  }
  formal.loadSong(JSON.stringify(guideSong));groups=JSON.parse(formal.guideGroups(guideSong===song&&$('#simple').checked));
  if(guideSong!==song&&$('#simple').checked)for(const group of groups)group.accompaniment=song.notes.filter(n=>Math.abs(n.start-group.start)<=45&&!group.notes.some(target=>target.pitch===n.pitch&&target.start===n.start));
  groupIndex=groups.findIndex(g=>g.start>=position);if(groupIndex<0)groupIndex=groups.length;
  formal.guideSeek(groupIndex);rollDirty=true;
}
function expected(){
  const group=groups[groupIndex];if(!formal||!group)return[];
  const remaining=new Set(formal.guideExpected().split(',').filter(Boolean).map(Number));
  return group.notes.filter(n=>remaining.has(n.pitch));
}
function firstOverlapping(ms){
  let low=0,high=endPrefix.length;while(low<high){const mid=(low+high)>>>1;if(endPrefix[mid]<=ms)low=mid+1;else high=mid;}return low;
}
function activeNotes(){
  const found=[];if(!song)return found;
  for(let i=firstOverlapping(position);i<song.notes.length&&song.notes[i].start<=position;i++){
    const n=song.notes[i];if(n.start+n.duration>position)found.push(n);
  }return found;
}
function currentView(){
  return{song,groups,groupIndex,expected:expected(),active:mode==='auto'?activeNotes():[...downs.values()].map(n=>({pitch:n.pitch})),
    mode,playing,position,speed,transpose:desktopOptions.transpose,held:[...downs.values()].map(n=>n.pitch)};
}
function updateLights(){
  for(const b of keys.values())b.classList.remove('pressed','current','next');
  for(const n of downs.values())keys.get(mapPitch(n.pitch))?.classList.add('pressed');
  const target=playing&&mode==='follow'?expected():mode==='auto'&&(playing||offlineSaved)?activeNotes():[];
  for(const n of target)keys.get(mapPitch(n.pitch))?.classList.add('current');
  const next=groups[groupIndex+1];
  if(playing&&mode==='follow'&&$('#preview').checked)for(const n of next?.notes||[])keys.get(mapPitch(n.pitch))?.classList.add('next');
  adapter?.update({held:[...downs.values()].map(n=>n.pitch),expected:playing&&mode==='follow'?expected().map(n=>n.pitch):[],
    next:playing&&mode==='follow'&&$('#preview').checked?(next?.notes||[]).map(n=>n.pitch):[],
    automatic:mode==='auto'&&(playing||offlineSaved)?activeNotes().map(n=>n.pitch):[]});
  let instruction='直接按电脑键盘弹奏';
  if(mode==='follow'){
    const pending=expected();const label=pending.length?adapter?.labelForPitch(pending[0].pitch):'';
    instruction=playing?(pending.length?(label?'按 '+label+' · ':'')+($('#simple').checked?'点按亮键':'按下亮键，按住后松开'):'已完成'):'Enter 开始跟弹';
  }else if(mode==='auto')instruction=playing?'自动演奏中 · Enter 暂停':'Enter 播放示范';
  $('#instruction').textContent=instruction;rollDirty=true;
}
async function playNote(owner,pitch,velocity=85,when=0,length=0){
  const timing=!when&&!length?measureOperation('audio.ready',{stage:'command'}):null,beforeErrors=audioErrors;
  if(!audio.node)audioState('音源准备中…','loading');
  const voice=await audio.on(owner,outputPitch(pitch),velocity,when);
  if(voice){audioState('钢琴已就绪','ready');if(length>0)audio.off(owner,false,Math.max(audio.context.currentTime,when)+length/1000);}
  timing?.(voice?'ready':audioErrors>beforeErrors?'failed':'canceled',{},'command_ready');
}
function noteDown(owner,pitch,velocity=pointerVelocityOverride??desktopOptions.velocity){
  cancelRestore();
  if(mode==='free'&&String(owner).startsWith('touch-'))pitch=Math.max(0,Math.min(127,pitch+12*((window.App31Touch?.inspect().freeOctave||4)-4)));
  if(!Number.isInteger(pitch)||pitch<0||pitch>127)return;
  if(downs.has(owner))return;
  downs.set(owner,{pitch,velocity});
  if(desktopOptions.skin>0&&!desktopOptions.reducedMotion){impacts.push({pitch,at:performance.now(),seed:impacts.length%7});if(impacts.length>96)impacts.shift();}
  if(recording)recordOwners.set(owner,{pitch,velocity,start:Math.round(performance.now()-recordStart)});
  const pending=playing&&mode==='follow'?expected():[];
  const note=pending.find(n=>n.pitch===pitch),step=groupIndex;
  if(playing&&mode==='follow'&&pending.length){if(note)practiceStats.correct++;else practiceStats.wrong++;}
  if(note&&formal.guidePress(pitch)){
    if($('#simple').checked){
      const group=groups[step];
      for(const[i,n]of(group.accompaniment||[]).entries())playNote(`accompaniment-${playEpoch}-${step}-${i}`,n.pitch,n.velocity||85,
        (audio.context?.currentTime||0)+Math.max(0,n.start-group.start)/1000/speed,n.duration/speed);
      for(const n of group.notes)playNote(`follow-${playEpoch}-${step}-${n.pitch}`,n.pitch,n.velocity||velocity,0,n.duration/speed);
    }else playNote(owner,pitch,velocity);
    groupIndex=formal.guideIndex();
    if(groupIndex!==step){position=groups[groupIndex]?.start??duration();saveSession();if(loopState.enabled&&(position>=loopState.b||groupIndex>=groups.length)){seekTo(loopState.a);start();}else if(groupIndex>=groups.length){playing=false;position=duration();transportState();finishPractice();}}
  }else playNote(owner,pitch,velocity);
  updateLights();
}
function noteUp(owner){
  const note=downs.get(owner);if(!note)return;downs.delete(owner);
  if(formal&&![...downs.values()].some(n=>n.pitch===note.pitch))formal.guideRelease(note.pitch);
  audio.off(owner);
  const event=recordOwners.get(owner);
  if(event){recordOwners.delete(owner);recordNotes.push({...event,duration:Math.max(1,Math.round(performance.now()-recordStart)-event.start)});}
  updateLights();
}
function releasePhysical(){for(const owner of [...downs.keys()])noteUp(owner);pointers.clear();}
function setPedal(on){
  pedalHeld=on;audio.sustain=on||$('#sustain').checked;$('#pedal-state').classList.toggle('active',audio.sustain);
}
function transportState(){
  $('#start').textContent=playing?'Ⅱ':'▶';$('#start').classList.toggle('playing',playing);
  $('#start').setAttribute('aria-label',playing?'暂停演奏':'开始演奏');
  if(!playing)expandedDuringPlay=false;const collapsed=desktopOptions.collapse&&playing&&!expandedDuringPlay;document.body.classList.toggle('controls-collapsed',collapsed);$('#expand-controls').hidden=!collapsed;
}
function pause(){
  cancelRecordingPreparation();playing=false;playEpoch++;$('#start').classList.remove('preparing');adapter?.releaseAll();surfaceController?.releaseInput();releasePhysical();audio.stop();transportState();updateLights();saveSession();
}
function finishPractice(){practiceStats.completed=true;const total=practiceStats.correct+practiceStats.wrong+practiceStats.helped,score=Math.round(100*practiceStats.correct/Math.max(1,total));try{const key='piano-desktop44-best-'+song.id,prior=Number(localStorage.getItem(key)||0);if(score>prior)localStorage.setItem(key,String(score));}catch(_){}status('本次完成 · 准确率 '+score+'% · 正确 '+practiceStats.correct+' / 错音 '+practiceStats.wrong+' / 补奏 '+practiceStats.helped);}
function panic(){window.PianoWeb?.stopAuxiliary?.();pause();setPedal(false);status('全部声音已停止');}
function seekTo(ms){cancelRestore();pause();position=Math.max(0,Math.min(duration(),Number(ms)||0));makeGroups();updateLights();updateTimeline();saveSession();}
function updateTimeline(){
  $('#time').textContent=elapsed(position);$('#duration').textContent=song?elapsed(duration()):'0:00';$('#seek').max=String(duration());
  if(document.activeElement!==$('#seek'))$('#seek').value=String(position);
  $('#seek').disabled=!song;
  $('#progress-detail').textContent=song?(mode==='follow'?`${Math.min(groupIndex,groups.length)} / ${groups.length} 组`:`${song.noteCount||song.notes.length} 个音符`):'选择歌曲开始练习';
}
async function start(){
  cancelRestore();
  if(surfaceController?.inspect().surface==='touch'&&window.App31Touch?.guitarEnabled?.()){
    const running=window.App31Touch.guitarRunning();pause();if(running){window.App31Touch.action(1);return;}
    const epoch=++playEpoch;try{await audio.prepare([40,45,50,55,59,64].map(outputPitch));if(epoch!==playEpoch)return;window.App31Touch.action(0);$('#start').textContent='Ⅱ';$('#start').setAttribute('aria-label','暂停扫弦练习');}catch(error){status(error.message);}return;
  }
  if(playing){pause();return;}
  if(loadingSongId){measureOperation('playback.start',{mode})('canceled');status('曲谱正在载入，电脑键盘仍可自由弹奏');return;}
  if(mode==='free'){
    const timing=measureOperation('playback.start',{mode,stage:'command'}),epoch=++playEpoch;
    audioState('音源准备中…','loading');
    try{await audio.unlock();if(epoch!==playEpoch){timing('canceled');return;}audioState('电脑键盘可演奏','ready');status('直接按电脑键盘，空格控制延音');timing('ready',{},'command_ready');}catch(error){timing('failed');status(error.message);audioState('点击或按键重试');}
    return;
  }
  if(!song){status('从左侧曲库选择一首歌曲');loadBuiltins();return;}
  const timing=measureOperation('playback.start',{mode}),epoch=++playEpoch;$('#start').classList.add('preparing');status('正在准备起始音符，其他功能可继续使用');
  try{
    if(mode==='follow'){await engine();if(epoch!==playEpoch){timing('canceled');return;}if(!groups.length)makeGroups();if(!groups.length){timing('canceled');status('当前手别或声部没有可练习的音符，请在练习设置中调整');transportState();updateLights();return;}}
    await audio.unlock();if(epoch!==playEpoch){timing('canceled');return;}
    if(position>=duration()){position=0;makeGroups();}
    const startAt=mode==='follow'?(groups[groupIndex]?.start??position):position;
    if(mode==='follow'){
      const current=groups[groupIndex],pitches=expected().map(n=>n.pitch);
      if($('#simple').checked)for(const n of current?.accompaniment||[])if(n.start<=startAt+110*speed)pitches.push(n.pitch);
      await audio.prepare(pitches.map(outputPitch));
    }else await audio.prepareWindow(audioSong(song),startAt,{lookaheadMs:450,speed});
    if(epoch!==playEpoch){timing('canceled');return;}
    nextIndex=song.notes.findIndex(n=>n.start>=position);if(nextIndex<0)nextIndex=song.notes.length;
    origin=audio.context.currentTime-position/1000/speed;playing=true;lastPrefetch=-Infinity;
    if(mode==='auto')for(let i=firstOverlapping(position);i<nextIndex;i++){
      const n=song.notes[i];if(n.start+n.duration>position)playNote(`resume-${epoch}-${i}`,n.pitch,n.velocity||85,0,(n.start+n.duration-position)/speed);
    }
    audioState('钢琴已就绪','ready');status('');transportState();updateLights();
    measurePaint(timing,'ready',{},()=>epoch===playEpoch&&playing);
    audio.prefetchWindow(audioSong(song),startAt,{lookaheadMs:4500,speed});
  }catch(error){timing('failed');status(error.message);audioState('音源未就绪，按键重试');}
  finally{if(epoch===playEpoch)$('#start').classList.remove('preparing');}
}
function shiftRange(delta){
  const available=Array.from({length:88},(_,i)=>21+i).filter(p=>!black.has(p%12));
  const maximum=available[Math.max(0,available.length-whiteCount)];
  base=Math.max(21,Math.min(maximum,base+delta));while(black.has(base%12))base--;
  configureKeys();saveSession();
}

// Physical keys are enabled by default. Search fields, modal dialogs, native
// button focus and browser shortcuts are still owned by the browser.
function pianoKeyboardActive(){const surface=surfaceController?.inspect();return view!=='keys'||!surface||!surface.ready||surface.needsPianoKeyboard;}
adapter=createKeyboardAdapter({host:$('#computer-keyboard'),isEnabled:()=>pianoKeyboardActive()&&!document.querySelector('dialog[open]')&&!$('.instrument').inert,
  onPress:noteDown,onRelease:noteUp,onReleaseAll:releasePhysical,onMappingChange:()=>{labels();saveSession();},
  onPedal:setPedal,onPanic:panic,onTransport:start});
function handlePhysical(event,down){
  if(recorderController?.handleKey(event,down))return true;
  if(!exportBusy&&!document.querySelector('dialog[open]')&&presentationController?.handleKey(event,down))return true;
  if(!down&&event.code==='Space'&&pedalHeld){setPedal(false);return true;}
  if(pianoKeyboardActive())return adapter.handle(event,down);
  const editable=/^(INPUT|SELECT|TEXTAREA)$/.test(event.target?.tagName)||event.target?.isContentEditable;
  if(down&&(event.ctrlKey||event.altKey||event.metaKey||editable||document.querySelector('dialog[open]')||$('.instrument').inert))return false;
  if(event.code==='Enter'){if(down&&!event.repeat)start();return true;}
  if(event.code==='Escape'){if(down)panic();return true;}
  if(event.code==='Space'){setPedal(down);return true;}
  return !!surfaceController?.handleKey(event,down);
}
addEventListener('keydown',event=>{if(handlePhysical(event,true))event.preventDefault();});
addEventListener('keyup',event=>{if(handlePhysical(event,false))event.preventDefault();});
function loseInput(){
  const active=document.activeElement;
  if(active?.tagName==='IFRAME'&&(active.closest?.('#web-staff-layer')||active.closest?.('#surface-stage'))&&!document.hidden)return;
  window.PianoWeb?.stopAuxiliary?.();pause();setPedal(false);
}
addEventListener('blur',()=>setTimeout(loseInput,0));
document.addEventListener('visibilitychange',()=>{if(document.hidden){window.PianoWeb?.stopAuxiliary?.();pause();setPedal(false);}});
addEventListener('pagehide',()=>{window.PianoWeb?.stopAuxiliary?.();pause();saveSession();});
keyboard.addEventListener('pointerdown',event=>{
  if(desktopOptions.drag&&event.altKey){event.preventDefault();rangeDrag={id:event.pointerId,x:event.clientX,base};keyboard.setPointerCapture(event.pointerId);return;}
  const button=event.target.closest('.key');if(!button)return;event.preventDefault();keyboard.setPointerCapture(event.pointerId);
  const pitch=Number(button.dataset.pitch);pointers.set(event.pointerId,pitch);noteDown('pointer-'+event.pointerId,pitch,pointerVelocity(event));
});
keyboard.addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId))return;
  const button=document.elementFromPoint(event.clientX,event.clientY)?.closest('.key');const pitch=button?Number(button.dataset.pitch):null;
  if(pitch===pointers.get(event.pointerId))return;noteUp('pointer-'+event.pointerId);pointers.set(event.pointerId,pitch);
  if(pitch!==null)noteDown('pointer-'+event.pointerId,pitch,pointerVelocity(event));
});
for(const type of['pointerup','pointercancel','lostpointercapture'])keyboard.addEventListener(type,event=>{noteUp('pointer-'+event.pointerId);pointers.delete(event.pointerId);});

async function setNotation(next){
  const epoch=++viewEpoch,timing=measureOperation('view.ready',{view:['keys','staff','waterfall'].includes(next)?next:'keys'});
  view=['keys','staff','waterfall'].includes(next)?next:'keys';document.body.dataset.view=view;
  for(const button of all('.view-tabs button')){button.classList.toggle('selected',button.dataset.view===view);button.setAttribute('aria-pressed',String(button.dataset.view===view));}
  $('#computer-keyboard').hidden=view!=='keys';$('#web-staff-layer').hidden=view!=='staff';roll.hidden=view!=='waterfall';
  syncSurfaceVisibility();
  $('#workspace-hint').textContent=view==='keys'?'按住发声 · 松手释放':view==='staff'?'高低音谱表 · 原曲数据生成':'音符向琴键方向落下';
  staff?.setActive(view==='staff');rollDirty=true;saveSession();
  if(view!=='staff'||!song){measurePaint(timing,view==='staff'?'empty':'ready',{},()=>epoch===viewEpoch);return;}
  if(!staffPromise){
    $('#web-staff-layer').innerHTML='<div class="view-placeholder staff-loading">正在准备五线谱…</div>';
    staffPromise=import('./staff-practice.js').then(({StaffPractice})=>{
      $('#web-staff-layer').replaceChildren();staff=new StaffPractice($('#web-staff-layer'));PianoWeb.staffPractice=staff;return staff;
    }).catch(error=>{staffPromise=null;const box=$('#web-staff-layer');box.replaceChildren();const message=document.createElement('div');message.className='view-placeholder';message.textContent='五线谱暂未载入';const retry=document.createElement('button');retry.textContent='重试';retry.onclick=()=>setNotation('staff');message.append(retry);box.append(message);status(error.message);throw error;});
  }
  try{
    const renderer=await staffPromise;
    if(epoch!==viewEpoch){timing('canceled');return;}
    renderer.setActive(view==='staff');
    if(view==='staff'){
      await renderer.setSong(song);renderer.update(currentView());
      Promise.resolve(renderer.rendering).then(()=>{
        if(epoch!==viewEpoch)timing('canceled');
        else if(renderer.inspect()?.ready)measurePaint(timing,'ready',{},()=>epoch===viewEpoch);
        else timing('failed');
      },()=>timing('failed'));
    }
  }catch(_){timing('failed');/* Explicit retry remains available; keyboard input stays usable. */}
}
for(const button of all('.view-tabs button'))button.onclick=()=>setNotation(button.dataset.view);

async function choose(row,{restore=false,savedPosition=0}={}){
  if(screenCaptureBusy){status('录屏结束后可以切换曲目');return false;}
  if(offlineSaved){status('视频正在生成，完成后可以切换曲目');return false;}
  if(!restore)cancelRestore();
  const timing=measureOperation('song.load',{source:restore?'snapshot':row.builtinIndex?'builtin':row.notes?'custom':'online',stage:'data'},restore?performance.now():undefined);
  const epoch=++selectionEpoch;pause();loadingSongId=row.id;status('正在载入「'+row.title+'」…');renderRows();
  try{
    const selected=await library.load(row);if(mode==='follow')await engine();if(epoch!==selectionEpoch||offlineSaved){timing('canceled');return false;}
    pause();
    song=normalizeWebSong(selected);if(!restore){loopState={enabled:false,a:0,b:0};practiceStats={correct:0,wrong:0,helped:0,completed:false};if(Number.isInteger(song.instrumentPreset))setTone(song.instrumentPreset);}
    pendingResume=null;position=Math.max(0,Math.min(song.durationMs,savedPosition));nextIndex=0;
    makeGroups();if(desktopOptions.rows===0)configureKeys();$('#song-title').textContent=song.title;$('#song-kind').textContent='NOW PLAYING';
    $('#song-detail').textContent=[song.subtitle,`${song.bpm} BPM`,elapsed(song.durationMs)].filter(Boolean).join(' · ');
    loadingSongId='';status(song.storageWarning||'曲谱已就绪 · 选择跟弹或自动演奏，按 Enter 开始');
    renderRows();updateTimeline();updateLights();
    measurePaint(timing,'ready',{count:song.noteCount},()=>epoch===selectionEpoch&&!offlineSaved);
    audio.warmPitches(pitchesForWindow(audioSong(song),position,{lookaheadMs:450,speed}));
    if(view==='staff')setNotation('staff');
    if(!restore)saveSession();return true;
  }catch(error){timing('failed');if(epoch===selectionEpoch){loadingSongId='';renderRows();status(error.message);}return false;}
}
function renderRows(){
  const list=$('#songs');list.replaceChildren();
  const pages=Math.max(1,Math.ceil(results.length/30));page=Math.max(0,Math.min(pages-1,page));
  if(pendingResume&&page===0&&!$('#search').value){
    const resume=document.createElement('button');resume.className='resume-song';
    const title=document.createElement('strong');title.textContent='恢复上次的在线曲目';
    const detail=document.createElement('small');detail.textContent='从 '+elapsed(pendingResume.position)+' 继续 · 点击时读取';resume.append(title,detail);
    resume.onclick=async()=>{const saved=pendingResume;if(!saved)return;status('正在读取上次的曲目…');try{await library.all();const row=library.search('').find(r=>r.id===saved.songId);if(!row)throw Error('这首曲目暂未找到，原进度仍保留');await choose(row,{savedPosition:saved.position});}catch(error){status(error.message);}};
    list.append(resume);
  }
  if(!results.length){const empty=document.createElement('div');empty.className='library-empty';empty.textContent='没有找到曲目，换几个字试试';list.append(empty);}
  for(const row of results.slice(page*30,(page+1)*30)){
    const wrap=document.createElement('div');wrap.className='song-row';wrap.classList.toggle('active',song?.id===row.id);
    const button=document.createElement('button');button.className='song-select';
    const title=document.createElement('strong');title.textContent=row.title;
    const meta=document.createElement('small');meta.textContent=loadingSongId===row.id?'正在载入…':[row.author||row.subtitle||row.category,row.notes||row.builtinIndex?'内置 / 已保存':'在线曲谱'].filter(Boolean).join(' · ');
    button.append(title,meta);button.onclick=()=>choose(row);
    const favorite=document.createElement('button');favorite.className='favorite';favorite.classList.toggle('saved',library.favorites.has(row.id));
    favorite.textContent=library.favorites.has(row.id)?'★':'☆';favorite.setAttribute('aria-label',(library.favorites.has(row.id)?'取消收藏 ':'收藏 ')+row.title);
    favorite.onclick=()=>{library.favorite(row.id);search(false);};wrap.append(button,favorite);list.append(wrap);
  }
  $('#paging').hidden=pages<=1;$('#page-label').textContent=(page+1)+' / '+pages;$('#prev-page').disabled=page===0;$('#next-page').disabled=page===pages-1;
}
async function search(reset=true){
  const timing=measureOperation('library.search',{source:library.catalog?'online':'builtin'});
  const epoch=++searchEpoch;if(reset)page=0;
  try{
    const lookupCategory=category==='录制'?'我的':category;let found=library.searchAsync?await library.searchAsync($('#search').value,lookupCategory):library.search($('#search').value,lookupCategory);if(category==='录制')found=found.filter(row=>String(row.id).startsWith('record-'));
    if(epoch!==searchEpoch){timing('canceled');return;}results=found;renderRows();$('#library-status').textContent=results.length.toLocaleString()+' 首曲目';
    measurePaint(timing,'ready',{count:results.length},()=>epoch===searchEpoch);
  }catch(error){timing(error.name==='AbortError'?'canceled':'failed');if(error.name!=='AbortError'&&epoch===searchEpoch)$('#library-status').textContent=error.message;}
}
async function loadBuiltins(){
  $('#library-status').textContent='正在读取内置曲目…';
  try{await indexReady;if(!library.rows.length)await library.builtins;await search();}catch(error){$('#library-status').textContent='内置曲目暂不可用';status(error.message);}
}
async function loadCatalog(){
  const timing=measureOperation('library.load',{source:'online'});
  const button=$('#load-catalog');button.textContent='读取中…';$('#library-status').textContent='内置曲目仍可演奏';
  try{await library.all();button.textContent='在线曲库 ✓';await search();measurePaint(timing);}
  catch(error){timing('failed');button.textContent='重试在线曲库';status(error.message+'，内置与我的曲目仍可使用');}
}
$('#load-builtins').onclick=loadBuiltins;$('#load-catalog').onclick=loadCatalog;
$('#search').oninput=()=>search();
for(const button of all('[data-category]'))button.onclick=()=>{category=button.dataset.category;for(const b of all('[data-category]'))b.classList.toggle('selected',b===button);search();};
$('#prev-page').onclick=()=>{page--;renderRows();$('#songs').scrollTop=0;};$('#next-page').onclick=()=>{page++;renderRows();$('#songs').scrollTop=0;};
$('#import').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;status('正在导入「'+file.name+'」…');
  try{const selected=await library.import(file);await search();await choose(selected);}catch(error){status(error.message);}finally{event.target.value='';}
};

function download(name,body,type='application/json'){
  const url=URL.createObjectURL(body instanceof Blob?body:new Blob([body],{type})),link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function toggleRecording(){
  cancelRestore();
  if(recordingPreparing){cancelRecordingPreparation();status('已取消录制准备');return;}
  if(!recording){
    pause();audioState('音源准备中…','loading');
    const timing=measureOperation('recording.start'),epoch=++recordingEpoch;recordingTiming=timing;recordingPreparing=true;$('#record').setAttribute('aria-busy','true');$('#record').replaceChildren(document.createElement('span'),document.createTextNode('取消准备'));
    try{await audio.unlock();if(epoch!==recordingEpoch){timing('canceled');return;}recordingPreparing=false;recordingTiming=null;$('#record').setAttribute('aria-busy','false');recordNotes=[];recordOwners.clear();recordStart=performance.now();recording=true;$('#record').setAttribute('aria-pressed','true');$('#record').replaceChildren(document.createElement('span'),document.createTextNode('停止录制'));status('正在录制你的弹奏 · 再点录制结束并保存');measurePaint(timing,'ready',{},()=>recording&&epoch===recordingEpoch);}
    catch(error){timing('failed');if(epoch===recordingEpoch){cancelRecordingPreparation();status(error.message);}}return;
  }
  releasePhysical();recording=false;$('#record').setAttribute('aria-pressed','false');$('#record').replaceChildren(document.createElement('span'),document.createTextNode('录制'));
  if(!recordNotes.length){status('还没有录到音符');return;}
  recordNotes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
  const recordingSong={id:'record-'+Date.now(),title:'我的演奏 '+new Date().toLocaleString(),bpm:120,notes:recordNotes,instrumentPreset:audio.tone,
    durationMs:recordNotes.reduce((end,n)=>Math.max(end,n.start+n.duration),0),noteCount:recordNotes.length};
  library.save(recordingSong);download('我的演奏.json',JSON.stringify(recordingSong));await search();status(recordingSong.storageWarning||'已保存在我的曲目，并下载曲谱文件');
}
function cancelRecordingPreparation(){
  if(!recordingPreparing)return;recordingTiming?.('canceled');recordingTiming=null;recordingEpoch++;recordingPreparing=false;$('#record').setAttribute('aria-busy','false');
  $('#record').replaceChildren(document.createElement('span'),document.createTextNode('录制'));
}
function showDialog(id){
  const kind={'#settings-dialog':'settings','#help-dialog':'help','#export-dialog':'export'}[id],timing=measureOperation('menu.open',{kind});
  pause();const dialog=$(id);if(!dialog.open)dialog.showModal();
  measurePaint(timing,'ready',{},()=>dialog.open);
}
function syncSurfaceVisibility(){
  const active=surfaceController?.inspect().surface||'piano',native=active!=='piano'&&view==='keys';
  $('#surface-stage').hidden=!native;$('#computer-keyboard').hidden=view!=='keys'||native;
  surfaceController?.setActive(native);
}
function setTone(preset,label){
  preset=Math.max(0,Math.min(175,Number(preset)||0));let option=[...$('#tone').options].find(item=>Number(item.value)===preset);
  if(!option){option=new Option(label||'音色 '+preset,String(preset));$('#tone').append(option);}else if(label)option.textContent=label;
  $('#tone').value=String(preset);$('#tone').dispatchEvent(new Event('change'));
}
async function workspaces(){
  if(!surfacePromise)surfacePromise=import('./desktop-workspaces.js').then(({createDesktopWorkspaces})=>{
    surfaceController=createDesktopWorkspaces({host:$('#surface-stage'),onStatus:status,setTone,onChange:state=>{
      document.body.dataset.surface=state.surface;$('#instrument-name').textContent=state.title;$('#surface-title').textContent=state.title;
      $('#surface-config').hidden=state.surface==='piano';adapter?.releaseAll();syncSurfaceVisibility();
      for(const card of all('#instruments-dialog [data-surface]'))card.setAttribute('aria-pressed',String(card.dataset.surface===state.surface&&(!card.dataset.preset||Number(card.dataset.preset)===audio.tone)));
    }});return surfaceController;
  }).catch(error=>{surfacePromise=null;throw error;});return surfacePromise;
}
let surfaceSelection=0;
async function selectSurface(name,preset){
  if(exportBusy||offlineSaved||screenCaptureBusy){status('导出或录屏结束后可以切换乐器');return false;}
  const token=++surfaceSelection,timing=measureOperation('surface.ready',{surface:name,stage:'dom'});pause();$('#instruments-dialog').close();
  try{const controller=await workspaces();if(token!==surfaceSelection){timing('canceled');return false;}await setNotation('keys');await controller.select(name,{preset});if(token!==surfaceSelection){timing('canceled');return false;}const snapshot=controller.inspect();if(snapshot.error){timing('failed');return false;}measurePaint(timing,'ready',{},()=>token===surfaceSelection);saveSession();return true;}
  catch(error){timing('failed');status(error.message);return false;}
}
async function openTools(section='main'){
  showDialog('#tools-dialog');$('#tools-content').textContent='正在准备工具…';
  try{if(!toolsPromise)toolsPromise=import('./desktop-tools.js').then(module=>{const tools=module.createDesktopTools({host:$('#tools-content'),dialog:$('#tools-dialog'),status,download,openTones,openScore,setTone,workspaces});PianoWeb.stopAuxiliary=()=>tools.stop();return tools;}).catch(error=>{toolsPromise=null;throw error;});const tools=await toolsPromise;tools.open(section);}catch(error){$('#tools-content').textContent=error.message;}
}
function toneCatalog(){if(!toneCatalogPromise)toneCatalogPromise=fetch(new URL('./instruments.json',import.meta.url)).then(response=>{if(!response.ok)throw Error('音色目录暂未载入');return response.json();}).catch(error=>{toneCatalogPromise=null;throw error;});return toneCatalogPromise;}
let toneCategory='全部',toneRows=[];
function dedicatedTone(id){
  if(id>=170)return true;
  const gm=id-34;
  return id>=34&&id<=161?(gm===22||gm>=24&&gm<=79||gm>=104&&gm<=119):[2,6,7,8,9,20,26,27,30,31,32,33].includes(id);
}
function renderTones(){
  const query=$('#tone-search').value.trim().toLowerCase(),rows=toneRows.filter(row=>(toneCategory==='全部'||row.category===toneCategory)&&(!query||(row.name+' '+row.detail).toLowerCase().includes(query)));
  $('#tone-list').replaceChildren();for(const row of rows){const button=document.createElement('button'),image=document.createElement('img');image.alt='';image.loading='lazy';image.src=new URL('../demo/assets/instrument-icons/'+Math.min(169,row.id)+'.svg',import.meta.url).href;const text=document.createElement('span');text.textContent=row.name;const detail=document.createElement('small');detail.textContent=row.detail||row.category;text.append(detail);button.append(image,text);button.onclick=()=>{setTone(row.id,row.name);$('#tones-dialog').close();const native=$('#tone-surface-mode')?.value==='instrument'&&dedicatedTone(row.id);if(native||surfaceController?.inspect().surface!=='piano'&&surfaceController)selectSurface(native?'touch':'piano',row.id);};$('#tone-list').append(button);}$('#tone-status').textContent=rows.length+' 个音色';
}
async function openTones(){
  showDialog('#tones-dialog');$('#tone-status').textContent='正在读取完整音色目录…';
  try{toneRows=await toneCatalog();$('#tone-categories').replaceChildren();for(const category of ['全部',...new Set(toneRows.map(row=>row.category))]){const button=document.createElement('button');button.textContent=category;button.classList.toggle('selected',category===toneCategory);button.onclick=()=>{toneCategory=category;for(const item of $('#tone-categories').children)item.classList.toggle('selected',item===button);renderTones();};$('#tone-categories').append(button);}renderTones();}catch(error){$('#tone-status').textContent=error.message;const retry=document.createElement('button');retry.textContent='重试';retry.onclick=openTones;$('#tone-list').replaceChildren(retry);}
}
let scorePromise=null;
async function openScore(){
  if(!song){status('选择歌曲后可以打开完整曲谱');return;}
  pause();try{if(!scorePromise)scorePromise=import('./desktop-score.js').catch(error=>{scorePromise=null;throw error;});const module=await scorePromise;await module.openDesktopScore(song);}catch(error){status(error.message);}
}
async function ensurePresentation(){
  if(!presentationPromise)presentationPromise=import('./desktop-presentation.js').then(({createPresentationMode})=>{presentationController=createPresentationMode({button:$('#clean-mode'),exitButton:$('#presentation-exit'),releaseInput(){adapter?.releaseAll();surfaceController?.releaseInput();releasePhysical();setPedal(false);},onChange(enabled){surfaceController?.setPresentation(enabled);rollDirty=true;updateRects();}});$('#clean-mode').onclick=null;return presentationController;}).catch(error=>{presentationPromise=null;throw error;});
  return presentationPromise;
}
async function setPresentation(enabled){const controller=await ensurePresentation();return controller.set(enabled);}
$('#clean-mode').onclick=async()=>{if(exportBusy)return;try{(await ensurePresentation()).toggle();}catch(error){status(error.message);}};
async function playAutomaticForCapture(){
  if(!song)throw Error('选择曲目后可以自动弹奏并录屏');
  if(mode!=='auto'){pause();mode='auto';$('#mode').value='auto';makeGroups();saveSession();}
  await start();if(!playing)throw Error($('#status').textContent||'自动演奏未能开始');
}
async function ensureRecorder(){
  if(!recorderPromise)recorderPromise=import('./desktop-recorder.js').then(({createDesktopRecorder})=>recorderController=createDesktopRecorder({piano:window.PianoWeb,root:$('.instrument'),download,setPresentation,getPresentation:()=>presentationController?.inspect().enabled||false,onStatus:status,playAutomatic:playAutomaticForCapture,onState(state){screenCaptureBusy=!!state.busy;if(state.isRecording)document.body.dataset.screenRecording='true';else delete document.body.dataset.screenRecording;$('#screen-record').textContent=state.isRecording?'停止录屏':state.busy?'录屏准备中…':'纯净录屏';$('#clean-mode').disabled=screenCaptureBusy;$('#surface-entry').disabled=screenCaptureBusy;$('#presentation-exit').disabled=screenCaptureBusy||exportBusy;}})).catch(error=>{recorderPromise=null;throw error;});
  return recorderPromise;
}
async function openRecorder(){if(exportBusy){status('视频生成结束后可以开始录屏');return;}try{const controller=await ensureRecorder();if(controller.inspect().busy)await controller.stop();else controller.open();}catch(error){status(error.message);}}
$('#screen-record').onclick=openRecorder;
for(const button of all('[data-close]'))button.onclick=()=>button.closest('dialog').close();
$('#settings').onclick=()=>showDialog('#settings-dialog');$('#help').onclick=()=>showDialog('#help-dialog');
$('#surface-entry').onclick=()=>showDialog('#instruments-dialog');
for(const button of all('#instruments-dialog [data-surface]'))button.onclick=()=>selectSurface(button.dataset.surface,button.dataset.preset===undefined?undefined:Number(button.dataset.preset));
$('#tools').onclick=()=>openTools();$('#surface-config').onclick=()=>openTools('surface');$('#tone-picker').onclick=openTones;$('#tone-search').oninput=renderTones;$('#score').onclick=openScore;
$('#download-diagnostics').onclick=async()=>{
  status('正在准备本地性能记录，演奏功能可继续使用');
  const recorder=await performanceReady;if(!recorder){status('性能记录组件暂未就绪，演奏功能不受影响');return;}
  download('弹钢琴-性能记录.json',JSON.stringify(recorder.snapshot({audioContext:audio.context}),null,2));status('性能记录已下载到本机，未上传');
};
$('#export-entry').onclick=()=>{const guitar=surfaceController?.inspect().surface==='touch'&&window.App31Touch?.guitarEnabled?.();$('#export-description').textContent=guitar?'当前导出：吉他扫弦节奏，保留当前音色和移调。':song?'当前曲目：'+song.title:'选择一首曲目后，可以导出曲谱、音频和实际演奏画面。';showDialog('#export-dialog');};
$('#export-json').onclick=()=>{if(!song){$('#export-status').textContent='请先从曲库选择歌曲';return;}download(song.title+'.json',JSON.stringify(song));$('#export-status').textContent='曲谱已下载';};
async function exportMedia(kind){
  if(screenCaptureBusy){$('#export-status').textContent='请先结束当前录屏';return;}
  if(exportBusy)return;const guitar=surfaceController?.inspect().surface==='touch'&&window.App31Touch?.guitarEnabled?.();
  if(!song&&!guitar){$('#export-status').textContent='请先从曲库选择歌曲';return;}
  if(loadingSongId){$('#export-status').textContent='请等当前曲目载入后再导出';return;}
  const exportSong=guitar?JSON.parse(window.App31Touch.guitarSong()):song,originalSong=song;
  const timing=measureOperation('export.ready',{kind:kind==='wav'?'wav':'video',stage:'data'});
  const previousPresentation=presentationController?.inspect().enabled||false;
  exportBusy=true;for(const b of all('.export-options button'))b.disabled=true;$('#presentation-exit').disabled=true;
  $('#export-status').textContent='正在准备'+(kind==='wav'?'音频':'视频')+'资源…';
  try{
    if(kind==='video'&&$('#video-clean').checked)await setPresentation(true);
    const module=await import('./native-video.js');
    if(song!==originalSong||loadingSongId)throw Error('曲目已改变，请重新选择导出');
    const portrait=$('#video-aspect')?.value==='portrait';
    const blob=kind==='wav'?await module.exportActualWav():await module.exportActualVideo(portrait?{width:1080,height:1920}:{width:1920,height:1080});
    download(exportSong.title+'.'+(kind==='wav'?'wav':'mp4'),blob);$('#export-status').textContent='已生成，请查看浏览器下载';timing('ready');
  }catch(error){timing('failed');$('#export-status').textContent=error.message;status(error.message);}
  finally{presentationController?.set(previousPresentation);$('#presentation-exit').disabled=false;exportBusy=false;for(const b of all('.export-options button'))b.disabled=false;}
}
$('#export-wav').onclick=()=>exportMedia('wav');$('#export-video').onclick=()=>exportMedia('video');
$('#video-aspect').onchange=saveSession;$('#video-clean').onchange=saveSession;
$('#start').onclick=start;$('#restart').onclick=()=>{seekTo(0);status('已回到开头 · Enter 开始');};$('#panic').onclick=panic;
$('#lower').onclick=()=>shiftRange(-12);$('#higher').onclick=()=>shiftRange(12);$('#record').onclick=toggleRecording;
$('#seek').oninput=event=>seekTo(event.target.value);
$('#mode').onchange=async event=>{cancelRestore();const epoch=++modeEpoch;pause();mode=event.target.value;if(song){try{if(mode==='follow')await engine();if(epoch!==modeEpoch)return;makeGroups();}catch(error){status(error.message);}}updateLights();saveSession();};
$('#speed').onchange=event=>{pause();speed=Number(event.target.value);saveSession();};
$('#tone').onchange=event=>{surfaceController?.releaseInput();releasePhysical();audio.stop();audio.tone=Number(event.target.value);audio.warmPitches([outputPitch(60)]);saveSession();};
$('#volume').oninput=event=>{audio.setVolume(Number(event.target.value));saveSession();};
$('#simple').onchange=()=>{pause();makeGroups();surfaceController?.configure({tapDuration:$('#simple').checked});updateLights();saveSession();};
$('#preview').onchange=()=>{surfaceController?.configure({preview:$('#preview').checked});updateLights();saveSession();};$('#sustain').onchange=()=>{setPedal(pedalHeld);saveSession();};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(_){status('浏览器未允许全屏，仍可在当前窗口演奏');}};
$('#expand-controls').onclick=()=>{expandedDuringPlay=true;transportState();};
for(const[id,label]of [[17,'电子合成器'],[29,'电子鼓组']])if(![...$('#tone').options].some(option=>Number(option.value)===id))$('#tone').append(new Option(label,String(id)));
keyboard.addEventListener('pointermove',event=>{if(!rangeDrag||rangeDrag.id!==event.pointerId)return;const step=Math.round((rangeDrag.x-event.clientX)/Math.max(8,keyboard.clientWidth/whiteCount));let pitch=rangeDrag.base;const direction=Math.sign(step);for(let count=0;count<Math.abs(step);count++){pitch+=direction;while(black.has(((pitch%12)+12)%12))pitch+=direction;}PianoWeb.setRange(pitch);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])keyboard.addEventListener(type,event=>{if(rangeDrag?.id===event.pointerId)rangeDrag=null;});

function saveSession(){
  if(!sessionReady||restoringSession||offlineSaved)return;
  try{
    localStorage.setItem(SESSION,JSON.stringify({version:44,songId:song?.id||pendingResume?.songId||null,mode,position:song?position:pendingResume?.position||0,base,whiteCount,speed,tone:audio.tone,volume:audio.volume,
      sustain:$('#sustain').checked,simple:$('#simple').checked,preview:$('#preview').checked,videoAspect:$('#video-aspect').value,cleanVideo:$('#video-clean').checked,desktopOptions,practiceOptions,loopState}));
    if(song&&song.notes.length<=30000)localStorage.setItem(LAST_SONG,JSON.stringify(song));
  }catch(_){/* Stored songs/favorites are not removed when a session exceeds quota. */}
}
function readStored(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}}
async function restoreSession(){
  const saved=readStored(SESSION)||readStored('piano-web41-session'),epoch=selectionEpoch;
  if(saved){
    speed=Number.isFinite(saved.speed)&&saved.speed>=.25&&saved.speed<=2?saved.speed:1;if(![...$('#speed').options].some(option=>Number(option.value)===speed))$('#speed').append(new Option(speed+'×',String(speed)));$('#speed').value=String(speed);
    base=Math.max(21,Math.min(108,Number(saved.base)||36));while(black.has(base%12))base--;
    // The old mobile eight-white-key preference does not become the desktop default.
    whiteCount=saved.version===44?Math.max(7,Math.min(52,Number(saved.whiteCount)||36)):36;$('#simple').checked=!!saved.simple;$('#sustain').checked=!!saved.sustain;$('#preview').checked=saved.preview!==false;
    if(saved.version===44){if(saved.desktopOptions&&typeof saved.desktopOptions==='object')setDisplay(saved.desktopOptions);if(saved.practiceOptions&&typeof saved.practiceOptions==='object')setPractice(saved.practiceOptions);if(['landscape','portrait'].includes(saved.videoAspect))$('#video-aspect').value=saved.videoAspect;if(typeof saved.cleanVideo==='boolean')$('#video-clean').checked=saved.cleanVideo;}
    audio.tone=Number.isInteger(saved.tone)&&saved.tone>=0&&saved.tone<176?saved.tone:0;if(![...$('#tone').options].some(option=>Number(option.value)===audio.tone))$('#tone').append(new Option('已保存音色 '+audio.tone,String(audio.tone)));$('#tone').value=String(audio.tone);
    audio.setVolume(Number.isFinite(saved.volume)?saved.volume:.72);$('#volume').value=String(audio.volume);setPedal(false);
  }
  sessionReady=true;applyAppearance();configureKeys();
  // A previous online song snapshot can resume without re-downloading a catalog.
  if(!saved?.songId)return;
  const snapshot=readStored(LAST_SONG);let row=snapshot?.id===saved.songId?snapshot:null;
  if(!row){try{await indexReady;}catch(_){}if(epoch!==selectionEpoch)return;row=[...library.rows,...library.custom].find(r=>r.id===saved.songId);}
  if(epoch!==selectionEpoch)return;
  if(!row){pendingResume={songId:saved.songId,position:Number(saved.position)||0};renderRows();return;}
  if(saved.version>=42&&['free','follow','auto'].includes(saved.mode)){mode=saved.mode;$('#mode').value=mode;}
  await choose(row,{restore:true,savedPosition:Number(saved.position)||0});
  if(saved.version===44&&saved.loopState?.enabled){try{setLoop(true,saved.loopState.a,saved.loopState.b);}catch(_){}}
}
function setLoop(enabled,a,b){if(enabled===undefined)return{...loopState};if(!enabled){loopState={enabled:false,a:0,b:0};saveSession();return{...loopState};}if(!song||!Number.isFinite(a)||!Number.isFinite(b)||a<0||b>duration()||b-a<500)throw Error('循环范围至少 0.5 秒，且应在当前曲目内');loopState={enabled:true,a,b};saveSession();return{...loopState};}
function setDisplay(values){
  pause();
  if('rows'in values&&[0,1,2].includes(Number(values.rows)))desktopOptions.rows=Number(values.rows);
  if('labels'in values&&['notes','numbers','hidden'].includes(values.labels))desktopOptions.labels=values.labels;
  for(const[key,min,max]of [['transpose',-24,24],['velocity',1,127],['skin',0,3],['palette',0,5]])if(Number.isFinite(Number(values[key])))desktopOptions[key]=Math.max(min,Math.min(max,Math.round(Number(values[key]))));
  for(const key of ['pressure','drag','reducedMotion','collapse'])if(typeof values[key]==='boolean')desktopOptions[key]=values[key];
  if('whiteCount'in values)whiteCount=Math.max(7,Math.min(52,Math.round(Number(values.whiteCount)||36)));
  applyAppearance();configureKeys();saveSession();return{...desktopOptions,whiteCount};
}
function setPractice(values){
  pause();for(const key of ['autoHelp','staffWaitForCorrect','adaptive'])if(typeof values[key]==='boolean')practiceOptions[key]=values[key];
  if(Number.isFinite(Number(values.maximum)))practiceOptions.maximum=Math.max(500,Math.min(5000,Number(values.maximum)));
  if(Number.isFinite(Number(values.split)))practiceOptions.split=Math.max(21,Math.min(108,Math.round(Number(values.split))));
  for(const[key,allowed]of [['hand',['both','left','right']],['voice',['all','highest','lowest']],['difficulty',['easy','normal','advanced']]])if(allowed.includes(values[key]))practiceOptions[key]=values[key];
  makeGroups();updateLights();saveSession();return{...practiceOptions};
}

function drawRoll(){
  if(view!=='waterfall')return;
  const w=roll.clientWidth,h=roll.clientHeight,d=Math.min(2,devicePixelRatio||1);
  if(!w||!h)return;
  if(roll.width!==Math.round(w*d)||roll.height!==Math.round(h*d)){roll.width=Math.round(w*d);roll.height=Math.round(h*d);updateRects();}
  context.setTransform(d,0,0,d,0,0);context.fillStyle='#202f2c';context.fillRect(0,0,w,h);
  const ratio=w/(keyboard.clientWidth||w);context.strokeStyle='#a7c7b610';context.lineWidth=1;
  for(const r of rects.values())if(!r.black){context.beginPath();context.moveTo(r.left*ratio,0);context.lineTo(r.left*ratio,h);context.stroke();}
  if(song){
    const scale=h/2400,look=position+2400;let count=0;
    for(let i=firstOverlapping(position);i<song.notes.length&&song.notes[i].start<=look&&count<350;i++){
      const n=song.notes[i],r=rects.get(mapPitch(n.pitch));if(!r)continue;count++;
      const bottom=h-(n.start-position)*scale,top=Math.max(0,bottom-n.duration*scale),height=Math.min(h,bottom)-top-2;
      if(height<=0)continue;
      const target=playing&&mode==='follow'&&expected().some(e=>e.pitch===n.pitch&&e.start===n.start);
      context.fillStyle=target?'#d9eab4':n.pitch<60?'#72b8aa':'#bba17a';
      context.beginPath();context.roundRect((r.left+2)*ratio,top,Math.max(2,(r.width-4)*ratio),height,Math.min(3,height/2));context.fill();
      if(height>20){context.fillStyle='#203b2a';context.font='10px Segoe UI, sans-serif';context.textAlign='center';context.fillText(adapter.labelForPitch(n.pitch)||noteName(n.pitch),(r.left+r.width/2)*ratio,top+14);}
    }
  }else{
    context.fillStyle='#a6c1ae';context.font='13px Segoe UI, sans-serif';context.textAlign='center';context.fillText('从左侧选一首曲目，查看音符落向琴键',w/2,h/2);
  }
  context.fillStyle='#a0c5ae';context.fillRect(0,h-2,w,2);rollDirty=false;
}
function drawKeyEffects(now){
  if(!desktopOptions.skin||desktopOptions.reducedMotion||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){impacts.length=0;if(!effectsPainted)return;}
  if(!impacts.length&&!effectsPainted)return;
  const canvas=$('#key-effects'),ctx=canvas.getContext('2d'),w=keyboard.clientWidth,h=keyboard.clientHeight;
  if(!w||!h)return;const ratio=Math.min(2,devicePixelRatio||1);
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  effectsPainted=impacts.length>0;if(!effectsPainted)return;
  const colors=['151,208,190','135,207,238','184,153,225','228,166,174','113,202,169','226,186,111'],color=colors[desktopOptions.palette||({1:1,2:2,3:5}[desktopOptions.skin])];
  for(let i=impacts.length-1;i>=0;i--){const impact=impacts[i],age=(now-impact.at)/900;if(age>1){impacts.splice(i,1);continue;}const rect=rects.get(mapPitch(impact.pitch));if(!rect)continue;const x=rect.left+rect.width/2,y=h*.78,alpha=(1-age)*.6;
    if(desktopOptions.skin===1){const glow=ctx.createRadialGradient(x,y,0,x,y,Math.max(20,rect.width*2));glow.addColorStop(0,`rgba(${color},${alpha})`);glow.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=glow;ctx.fillRect(x-rect.width*2,0,rect.width*4,h);}
    else if(desktopOptions.skin===2){ctx.fillStyle=`rgba(${color},${alpha})`;for(let n=0;n<6;n++){const drift=Math.sin(impact.seed+n*1.7)*rect.width*age;ctx.beginPath();ctx.arc(x+drift,y-age*h*(.4+n*.08),1+n%2,0,Math.PI*2);ctx.fill();}}
    else {const beam=ctx.createLinearGradient(0,h,0,0);beam.addColorStop(0,`rgba(${color},${alpha})`);beam.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=beam;ctx.fillRect(x-rect.width*.35,0,rect.width*.7,h);}
  }
}
function frame(now){
  if(surfaceController&&!offlineSaved)surfaceController.update(surfaceView());
  drawKeyEffects(now);
  if(now-lastVisual>=65){
    lastVisual=now;
    if(playing||offlineSaved){updateTimeline();updateLights();}
    if(view==='waterfall'&&(playing||rollDirty))drawRoll();
    if(view==='staff'&&staff&&song&&now-lastStaff>=65){lastStaff=now;staff.update(currentView());}
  }
  requestAnimationFrame(frame);
}
setInterval(()=>{
  if(!playing||!song||!audio.context)return;
  if(mode==='auto'){
    position=(audio.context.currentTime-origin)*1000*speed;
    if(loopState.enabled&&position>=loopState.b){seekTo(loopState.a);start();return;}
    const cutoff=Math.min(position+110*speed,loopState.enabled?loopState.b:Infinity),epoch=playEpoch;
    while(nextIndex<song.notes.length&&song.notes[nextIndex].start<=cutoff){const i=nextIndex++,n=song.notes[i];playNote(`auto-${epoch}-${i}`,n.pitch,n.velocity||85,origin+n.start/1000/speed,n.duration/speed);}
    if(position>=duration()+250){pause();position=duration();updateTimeline();saveSession();status('播放完成');return;}
  }
  if(performance.now()-lastPrefetch>900){lastPrefetch=performance.now();audio.prefetchWindow(audioSong(song),mode==='follow'?(groups[groupIndex]?.start??position):position,{lookaheadMs:4500,speed});}
},25);
setInterval(()=>{
  if(!playing||mode!=='follow'||!$('#simple').checked||recording||document.hidden||groupIndex>=groups.length){graceStep=-1;return;}
  const now=performance.now();if(graceStep!==groupIndex){if(graceStep>=0)formal.graceObserve(Math.max(0,now-graceDue),false);graceStep=groupIndex;graceDue=now;}
  if((view==='staff'&&practiceOptions.staffWaitForCorrect)||!practiceOptions.autoHelp||now<graceDue+formal.graceTimeout(practiceOptions.adaptive,practiceOptions.maximum))return;
  const group=groups[groupIndex];for(const[i,n]of [...group.notes,...group.accompaniment||[]].entries())playNote('help-'+playEpoch+'-'+groupIndex+'-'+i,n.pitch,n.velocity||85,0,n.duration/speed);
  practiceStats.helped+=expected().length;formal.guideHelp();formal.graceObserve(now-graceDue,true);groupIndex=formal.guideIndex();position=groups[groupIndex]?.start??duration();graceStep=-1;
  if(loopState.enabled&&(position>=loopState.b||groupIndex>=groups.length)){seekTo(loopState.a);start();}else if(groupIndex>=groups.length){pause();position=duration();finishPractice();}updateLights();saveSession();
},50);
addEventListener('resize',()=>{updateRects();rollDirty=true;});

window.PianoWeb={audio,library,press:noteDown,release:noteUp,pause,view:currentView,setNotation,staffPractice:null,pointerVelocity,withPointerVelocity,playAutomatic:playAutomaticForCapture,
  async playDemoSong(value){if(screenCaptureBusy||exportBusy)throw Error('请先结束录屏或导出');const demo=library.save(normalizeWebSong(value));await choose(demo);return playAutomaticForCapture();},
  engine,handleKey:handlePhysical,selectSurface,surface:()=>surfaceController?.inspect()||{surface:'piano',ready:true,needsPianoKeyboard:true},setPresentation,presentation:()=>presentationController?.inspect()||{enabled:false},openRecorder,recorder:()=>recorderController?.inspect()||{phase:'idle',busy:false,isRecording:false},desktopOptions:()=>({...desktopOptions,whiteCount}),setDisplay,setDrag:enabled=>setDisplay({drag:!!enabled}),practiceOptions,setPractice,practiceStats:()=>({...practiceStats,best:song?Number(localStorage.getItem('piano-desktop44-best-'+song.id)||0):0}),loop:setLoop,seek:seekTo,outputSong:(value=song)=>audioSong(value),
  setSpeed(value){value=Number(value);if(!Number.isFinite(value)||value<.25||value>2)throw Error('速度应在 0.25–2 倍之间');if(![...$('#speed').options].some(option=>Number(option.value)===value))$('#speed').append(new Option(value+'×',String(value)));$('#speed').value=String(value);$('#speed').dispatchEvent(new Event('change'));},
  showCategory(value){category=value;for(const button of all('[data-category]'))button.classList.toggle('selected',button.dataset.category===value);return search();},
  diagnosticsSnapshot:()=>measurements?.snapshot({audioContext:audio.context})||{schema:'piano-local-performance-v1',available:false,build:PERFORMANCE_BUILD},
  async selectSong(id){await indexReady;let row=library.search('').find(r=>r.id===id);if(!row){await library.all();row=library.search('').find(r=>r.id===id);}if(!row)throw Error('曲目不存在');return choose(row);},
  setRange(pitch){base=Math.max(21,Math.min(108,Number(pitch)||36));while(black.has(base%12))base--;configureKeys();saveSession();return base;},
  inspect(){return{edition:'desktop44',build:PERFORMANCE_BUILD,song:song?.id||null,mode,playing,position,base,keyCount:whiteCount,downOwners:[...downs.keys()],audio:audio.inspect(),
    groupIndex,groupCount:groups.length,catalogCount:library.catalog?.count||0,recording,notation:view,keyboardAdapter:adapter.inspect(),staff:staff?.inspect(),sessionReady};},
  webReady:()=>sessionReady&&!!adapter,
  beginOffline(override=null){cancelRestore();selectionEpoch++;loadingSongId='';pause();renderRows();offlineSaved={position,mode,song,groups,groupIndex,endPrefix,expected:expected().map(n=>n.pitch)};mode='auto';if(override){song=normalizeWebSong(override);makeGroups();$('#song-title').textContent=song.title;}document.body.dataset.exporting='true';return{song:audioSong(song),speed,preset:audio.tone,volume:audio.volume,sustain:audio.sustain};},
  async offlineFrame(ms){position=ms;updateTimeline();updateLights();drawRoll();if(view==='staff'&&staff)await staff.offlineFrame(ms,currentView());await surfaceController?.offlineFrame({...surfaceView(),position:ms,exporting:true});},
  endOffline(){if(offlineSaved){const saved=offlineSaved;({position,mode,song,groups,groupIndex,endPrefix}=saved);offlineSaved=null;if(mode==='follow'&&formal&&song){makeGroups();groupIndex=saved.groupIndex;formal.guideSeek(groupIndex);const pending=new Set(saved.expected);for(const pitch of new Set(groups[groupIndex]?.notes.map(n=>n.pitch)||[]))if(!pending.has(pitch)){formal.guidePress(pitch);formal.guideRelease(pitch);}}$('#song-title').textContent=song?.title||'自由演奏';}delete document.body.dataset.exporting;updateLights();updateTimeline();}
};
audio.sustain=false;configureKeys();updateTimeline();requestAnimationFrame(frame);measurePaint(shellTiming);
addEventListener('pagehide',event=>{for(const settle of [...pendingPaints])settle(true);if(!event.persisted)measurements?.dispose();});
addEventListener('pagehide',()=>{recorderController?.dispose();recorderController=null;recorderPromise=null;});
const indexReady=fetch(new URL('./builtin-index.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('内置目录未载入');return r.json();}).then(index=>{
  if(!library.rows.length)library.rows=index;search();
}).catch(()=>{});
restoreSession().catch(error=>status(error.message)).finally(()=>{restoringSession=false;if(song)saveSession();});
// Cache only the core and middle C in the background, never the entire piano
// or song. Browser gesture requirements are still honored by unlock().
setTimeout(()=>{audio.warmCore();audio.warmPitches([60]);},350);
