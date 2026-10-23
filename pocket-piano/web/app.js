import {createKeyboardAdapter} from './keyboard-layout.js';
import {DesktopPianoAudio, pitchesForWindow} from './desktop-audio.js';
import {SongLibrary, normalizeWebSong} from './library.js';

// The desktop shell has no mobile surface or score dependency. Free playing
// does not wait for a catalog, an engraving engine, or a song to be selected.
const $=selector=>document.querySelector(selector);
const all=selector=>[...document.querySelectorAll(selector)];
const audio=new DesktopPianoAudio(message=>status(message));
const library=new SongLibrary();
const black=new Set([1,3,6,8,10]);
const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const SESSION='piano-web42-session', LAST_SONG='piano-web42-last-song';
const keyboard=$('#keyboard'), roll=$('#roll'), context=roll.getContext('2d');
let formal=null,formalPromise=null,adapter=null,staff=null,staffPromise=null;
let song=null,groups=[],groupIndex=0,position=0,playing=false,mode='free',view='keys';
let speed=1,base=36,whiteCount=36,playEpoch=0,selectionEpoch=0,modeEpoch=0;
let origin=0,nextIndex=0,endPrefix=[],lastPrefetch=-Infinity,pedalHeld=false;
let recording=false,recordStart=0,recordNotes=[],recordOwners=new Map(),recordingPreparing=false,recordingEpoch=0;
const downs=new Map(),pointers=new Map(),keys=new Map(),rects=new Map();
let category='全部',results=[],page=0,searchEpoch=0,sessionReady=false,restoringSession=true,offlineSaved=null;
let lastVisual=0,lastStaff=0,rollDirty=true,loadingSongId='',exportBusy=false,statusTimer=0,pendingResume=null;
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
  const whites=[],pitches=[];let pitch=base;
  while(whites.length<whiteCount&&pitch<=108){pitches.push(pitch);if(!black.has(pitch%12))whites.push(pitch);pitch++;}
  const width=100/whites.length;
  for(const p of pitches){
    const isBlack=black.has(p%12),index=isBlack?whites.filter(v=>v<p).length:whites.indexOf(p);
    const button=document.createElement('button');button.type='button';button.className='key '+(isBlack?'black':'white');
    button.style.left=(isBlack?index*width-width*.31:index*width)+'%';button.style.width=width*(isBlack?.62:1)+'%';
    button.dataset.pitch=p;button.setAttribute('aria-label',noteName(p));button.tabIndex=-1;
    const label=document.createElement('span');label.className='label';
    const name=document.createElement('span');name.className='computer';name.textContent=noteName(p);
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
  formal.loadSong(JSON.stringify(song));groups=JSON.parse(formal.guideGroups(mode==='follow'&&$('#simple').checked));
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
    mode,playing,position,speed,held:[...downs.values()].map(n=>n.pitch)};
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
  if(!audio.node)audioState('音源准备中…','loading');
  const voice=await audio.on(owner,pitch,velocity,when);
  if(voice){audioState('钢琴已就绪','ready');if(length>0)audio.off(owner,false,Math.max(audio.context.currentTime,when)+length/1000);}
}
function noteDown(owner,pitch,velocity=85){
  cancelRestore();
  if(downs.has(owner))return;
  downs.set(owner,{pitch,velocity});
  if(recording)recordOwners.set(owner,{pitch,velocity,start:Math.round(performance.now()-recordStart)});
  const pending=playing&&mode==='follow'?expected():[];
  const note=pending.find(n=>n.pitch===pitch),step=groupIndex;
  if(note&&formal.guidePress(pitch)){
    if($('#simple').checked){
      const group=groups[step];
      for(const[i,n]of(group.accompaniment||[]).entries())playNote(`accompaniment-${playEpoch}-${step}-${i}`,n.pitch,n.velocity||85,
        (audio.context?.currentTime||0)+Math.max(0,n.start-group.start)/1000/speed,n.duration/speed);
      for(const n of group.notes)playNote(`follow-${playEpoch}-${step}-${n.pitch}`,n.pitch,n.velocity||velocity,0,n.duration/speed);
    }else playNote(owner,pitch,velocity);
    groupIndex=formal.guideIndex();
    if(groupIndex!==step){position=groups[groupIndex]?.start??duration();saveSession();if(groupIndex>=groups.length){playing=false;position=duration();transportState();status('练习完成，可以从头再弹一遍');}}
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
}
function pause(){
  cancelRecordingPreparation();playing=false;playEpoch++;$('#start').classList.remove('preparing');adapter?.releaseAll();releasePhysical();audio.stop();transportState();updateLights();saveSession();
}
function panic(){pause();setPedal(false);status('全部声音已停止');}
function seekTo(ms){cancelRestore();pause();position=Math.max(0,Math.min(duration(),Number(ms)||0));makeGroups();updateLights();updateTimeline();saveSession();}
function updateTimeline(){
  $('#time').textContent=elapsed(position);$('#duration').textContent=song?elapsed(duration()):'0:00';$('#seek').max=String(duration());
  if(document.activeElement!==$('#seek'))$('#seek').value=String(position);
  $('#seek').disabled=!song;
  $('#progress-detail').textContent=song?(mode==='follow'?`${Math.min(groupIndex,groups.length)} / ${groups.length} 组`:`${song.noteCount||song.notes.length} 个音符`):'选择歌曲开始练习';
}
async function start(){
  cancelRestore();
  if(playing){pause();return;}
  if(loadingSongId){status('曲谱正在载入，电脑键盘仍可自由弹奏');return;}
  if(mode==='free'){
    audioState('音源准备中…','loading');
    try{await audio.unlock();audioState('电脑键盘可演奏','ready');status('直接按电脑键盘，空格控制延音');}catch(error){status(error.message);audioState('点击或按键重试');}
    return;
  }
  if(!song){status('从左侧曲库选择一首歌曲');loadBuiltins();return;}
  const epoch=++playEpoch;$('#start').classList.add('preparing');status('正在准备起始音符，其他功能可继续使用');
  try{
    if(mode==='follow'){await engine();if(epoch!==playEpoch)return;if(!groups.length)makeGroups();}
    await audio.unlock();if(epoch!==playEpoch)return;
    if(position>=duration()){position=0;makeGroups();}
    const startAt=mode==='follow'?(groups[groupIndex]?.start??position):position;
    if(mode==='follow'){
      const current=groups[groupIndex],pitches=expected().map(n=>n.pitch);
      if($('#simple').checked)for(const n of current?.accompaniment||[])if(n.start<=startAt+110*speed)pitches.push(n.pitch);
      await audio.prepare(pitches);
    }else await audio.prepareWindow(song,startAt,{lookaheadMs:450,speed});
    if(epoch!==playEpoch)return;
    nextIndex=song.notes.findIndex(n=>n.start>=position);if(nextIndex<0)nextIndex=song.notes.length;
    origin=audio.context.currentTime-position/1000/speed;playing=true;lastPrefetch=-Infinity;
    if(mode==='auto')for(let i=firstOverlapping(position);i<nextIndex;i++){
      const n=song.notes[i];if(n.start+n.duration>position)playNote(`resume-${epoch}-${i}`,n.pitch,n.velocity||85,0,(n.start+n.duration-position)/speed);
    }
    audioState('钢琴已就绪','ready');status('');transportState();updateLights();
    audio.prefetchWindow(song,startAt,{lookaheadMs:4500,speed});
  }catch(error){status(error.message);audioState('音源未就绪，按键重试');}
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
adapter=createKeyboardAdapter({host:$('#computer-keyboard'),isEnabled:()=>!document.querySelector('dialog[open]')&&!$('.instrument').inert,
  onPress:noteDown,onRelease:noteUp,onReleaseAll:releasePhysical,onMappingChange:()=>{labels();saveSession();},
  onPedal:setPedal,onPanic:panic,onTransport:start});
addEventListener('keydown',event=>{if(adapter.handle(event,true))event.preventDefault();});
addEventListener('keyup',event=>{if(adapter.handle(event,false))event.preventDefault();});
function loseInput(){
  const active=document.activeElement;
  if(active?.tagName==='IFRAME'&&active.closest?.('#web-staff-layer')&&!document.hidden)return;
  pause();setPedal(false);
}
addEventListener('blur',()=>setTimeout(loseInput,0));
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();setPedal(false);}});
addEventListener('pagehide',()=>{pause();saveSession();});
keyboard.addEventListener('pointerdown',event=>{
  const button=event.target.closest('.key');if(!button)return;event.preventDefault();keyboard.setPointerCapture(event.pointerId);
  const pitch=Number(button.dataset.pitch);pointers.set(event.pointerId,pitch);noteDown('pointer-'+event.pointerId,pitch);
});
keyboard.addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId))return;
  const button=document.elementFromPoint(event.clientX,event.clientY)?.closest('.key');const pitch=button?Number(button.dataset.pitch):null;
  if(pitch===pointers.get(event.pointerId))return;noteUp('pointer-'+event.pointerId);pointers.set(event.pointerId,pitch);
  if(pitch!==null)noteDown('pointer-'+event.pointerId,pitch);
});
for(const type of['pointerup','pointercancel','lostpointercapture'])keyboard.addEventListener(type,event=>{noteUp('pointer-'+event.pointerId);pointers.delete(event.pointerId);});

async function setNotation(next){
  view=['keys','staff','waterfall'].includes(next)?next:'keys';document.body.dataset.view=view;
  for(const button of all('.view-tabs button')){button.classList.toggle('selected',button.dataset.view===view);button.setAttribute('aria-pressed',String(button.dataset.view===view));}
  $('#computer-keyboard').hidden=view!=='keys';$('#web-staff-layer').hidden=view!=='staff';roll.hidden=view!=='waterfall';
  $('#workspace-hint').textContent=view==='keys'?'按住发声 · 松手释放':view==='staff'?'高低音谱表 · 原曲数据生成':'音符向琴键方向落下';
  staff?.setActive(view==='staff');rollDirty=true;saveSession();
  if(view!=='staff'||!song)return;
  if(!staffPromise){
    $('#web-staff-layer').innerHTML='<div class="view-placeholder staff-loading">正在准备五线谱…</div>';
    staffPromise=import('./staff-practice.js').then(({StaffPractice})=>{
      $('#web-staff-layer').replaceChildren();staff=new StaffPractice($('#web-staff-layer'));PianoWeb.staffPractice=staff;return staff;
    }).catch(error=>{staffPromise=null;const box=$('#web-staff-layer');box.replaceChildren();const message=document.createElement('div');message.className='view-placeholder';message.textContent='五线谱暂未载入';const retry=document.createElement('button');retry.textContent='重试';retry.onclick=()=>setNotation('staff');message.append(retry);box.append(message);status(error.message);throw error;});
  }
  try{const renderer=await staffPromise;renderer.setActive(view==='staff');if(view==='staff'){await renderer.setSong(song);renderer.update(currentView());}}
  catch(_){/* An explicit retry stays in the view; keyboard input remains usable. */}
}
for(const button of all('.view-tabs button'))button.onclick=()=>setNotation(button.dataset.view);

async function choose(row,{restore=false,savedPosition=0}={}){
  if(offlineSaved){status('视频正在生成，完成后可以切换曲目');return false;}
  if(!restore)cancelRestore();
  const epoch=++selectionEpoch;pause();loadingSongId=row.id;status('正在载入「'+row.title+'」…');renderRows();
  try{
    const selected=await library.load(row);if(mode==='follow')await engine();if(epoch!==selectionEpoch||offlineSaved)return false;
    pause();
    song=normalizeWebSong(selected);pendingResume=null;position=Math.max(0,Math.min(song.durationMs,savedPosition));nextIndex=0;
    makeGroups();$('#song-title').textContent=song.title;$('#song-kind').textContent='NOW PLAYING';
    $('#song-detail').textContent=[song.subtitle,`${song.bpm} BPM`,elapsed(song.durationMs)].filter(Boolean).join(' · ');
    loadingSongId='';status(song.storageWarning||'曲谱已就绪 · 选择跟弹或自动演奏，按 Enter 开始');
    renderRows();updateTimeline();updateLights();
    audio.warmPitches(pitchesForWindow(song,position,{lookaheadMs:450,speed}));
    if(view==='staff')setNotation('staff');
    if(!restore)saveSession();return true;
  }catch(error){if(epoch===selectionEpoch){loadingSongId='';renderRows();status(error.message);}return false;}
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
  const epoch=++searchEpoch;if(reset)page=0;
  try{
    const found=library.searchAsync?await library.searchAsync($('#search').value,category):library.search($('#search').value,category);
    if(epoch!==searchEpoch)return;results=found;renderRows();$('#library-status').textContent=results.length.toLocaleString()+' 首曲目';
  }catch(error){if(error.name!=='AbortError'&&epoch===searchEpoch)$('#library-status').textContent=error.message;}
}
async function loadBuiltins(){
  $('#library-status').textContent='正在读取内置曲目…';
  try{await indexReady;if(!library.rows.length)await library.builtins;await search();}catch(error){$('#library-status').textContent='内置曲目暂不可用';status(error.message);}
}
async function loadCatalog(){
  const button=$('#load-catalog');button.textContent='读取中…';$('#library-status').textContent='内置曲目仍可演奏';
  try{await library.all();button.textContent='在线曲库 ✓';await search();}
  catch(error){button.textContent='重试在线曲库';status(error.message+'，内置与我的曲目仍可使用');}
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
    const epoch=++recordingEpoch;recordingPreparing=true;$('#record').setAttribute('aria-busy','true');$('#record').replaceChildren(document.createElement('span'),document.createTextNode('取消准备'));
    try{await audio.unlock();if(epoch!==recordingEpoch)return;recordingPreparing=false;$('#record').setAttribute('aria-busy','false');recordNotes=[];recordOwners.clear();recordStart=performance.now();recording=true;$('#record').setAttribute('aria-pressed','true');$('#record').replaceChildren(document.createElement('span'),document.createTextNode('停止录制'));status('正在录制你的弹奏 · 再点录制结束并保存');}
    catch(error){if(epoch===recordingEpoch){cancelRecordingPreparation();status(error.message);}}return;
  }
  releasePhysical();recording=false;$('#record').setAttribute('aria-pressed','false');$('#record').replaceChildren(document.createElement('span'),document.createTextNode('录制'));
  if(!recordNotes.length){status('还没有录到音符');return;}
  recordNotes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
  const recordingSong={id:'record-'+Date.now(),title:'我的演奏 '+new Date().toLocaleString(),bpm:120,notes:recordNotes,
    durationMs:recordNotes.reduce((end,n)=>Math.max(end,n.start+n.duration),0),noteCount:recordNotes.length};
  library.save(recordingSong);download('我的演奏.json',JSON.stringify(recordingSong));await search();status(recordingSong.storageWarning||'已保存在我的曲目，并下载曲谱文件');
}
function cancelRecordingPreparation(){
  if(!recordingPreparing)return;recordingEpoch++;recordingPreparing=false;$('#record').setAttribute('aria-busy','false');
  $('#record').replaceChildren(document.createElement('span'),document.createTextNode('录制'));
}
function showDialog(id){
  pause();const dialog=$(id);if(!dialog.open)dialog.showModal();
}
for(const button of all('[data-close]'))button.onclick=()=>button.closest('dialog').close();
$('#settings').onclick=()=>showDialog('#settings-dialog');$('#help').onclick=()=>showDialog('#help-dialog');
$('#export-entry').onclick=()=>{$('#export-description').textContent=song?'当前曲目：'+song.title:'选择一首曲目后，可以导出曲谱、音频和实际演奏画面。';showDialog('#export-dialog');};
$('#export-json').onclick=()=>{if(!song){$('#export-status').textContent='请先从曲库选择歌曲';return;}download(song.title+'.json',JSON.stringify(song));$('#export-status').textContent='曲谱已下载';};
async function exportMedia(kind){
  if(exportBusy)return;if(!song){$('#export-status').textContent='请先从曲库选择歌曲';return;}
  if(loadingSongId){$('#export-status').textContent='请等当前曲目载入后再导出';return;}
  const exportSong=song;
  exportBusy=true;for(const b of all('.export-options button'))b.disabled=true;
  $('#export-status').textContent='正在准备'+(kind==='wav'?'音频':'视频')+'资源…';
  try{
    const module=await import('./native-video.js');
    if(song!==exportSong||loadingSongId)throw Error('曲目已改变，请重新选择导出');
    const blob=kind==='wav'?await module.exportActualWav():await module.exportActualVideo();
    download(exportSong.title+'.'+(kind==='wav'?'wav':'mp4'),blob);$('#export-status').textContent='已生成，请查看浏览器下载';
  }catch(error){$('#export-status').textContent=error.message;status(error.message);}
  finally{exportBusy=false;for(const b of all('.export-options button'))b.disabled=false;}
}
$('#export-wav').onclick=()=>exportMedia('wav');$('#export-video').onclick=()=>exportMedia('video');
$('#start').onclick=start;$('#restart').onclick=()=>{seekTo(0);status('已回到开头 · Enter 开始');};$('#panic').onclick=panic;
$('#lower').onclick=()=>shiftRange(-12);$('#higher').onclick=()=>shiftRange(12);$('#record').onclick=toggleRecording;
$('#seek').oninput=event=>seekTo(event.target.value);
$('#mode').onchange=async event=>{cancelRestore();const epoch=++modeEpoch;pause();mode=event.target.value;if(song){try{if(mode==='follow')await engine();if(epoch!==modeEpoch)return;makeGroups();}catch(error){status(error.message);}}updateLights();saveSession();};
$('#speed').onchange=event=>{pause();speed=Number(event.target.value);saveSession();};
$('#tone').onchange=event=>{releasePhysical();audio.stop();audio.tone=Number(event.target.value);audio.warmPitches([60]);saveSession();};
$('#volume').oninput=event=>{audio.setVolume(Number(event.target.value));saveSession();};
$('#simple').onchange=()=>{pause();makeGroups();updateLights();saveSession();};
$('#preview').onchange=()=>{updateLights();saveSession();};$('#sustain').onchange=()=>{setPedal(pedalHeld);saveSession();};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('.desktop-app').requestFullscreen();}catch(_){status('浏览器未允许全屏，仍可在当前窗口演奏');}};

function saveSession(){
  if(!sessionReady||restoringSession||offlineSaved)return;
  try{
    localStorage.setItem(SESSION,JSON.stringify({version:42,songId:song?.id||pendingResume?.songId||null,mode,position:song?position:pendingResume?.position||0,base,whiteCount,speed,tone:audio.tone,volume:audio.volume,
      sustain:$('#sustain').checked,simple:$('#simple').checked,preview:$('#preview').checked}));
    if(song&&song.notes.length<=30000)localStorage.setItem(LAST_SONG,JSON.stringify(song));
  }catch(_){/* Stored songs/favorites are not removed when a session exceeds quota. */}
}
function readStored(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}}
async function restoreSession(){
  const saved=readStored(SESSION)||readStored('piano-web41-session'),epoch=selectionEpoch;
  if(saved){
    speed=[.5,.75,1,1.25,1.5].includes(saved.speed)?saved.speed:1;$('#speed').value=String(speed);
    base=Math.max(21,Math.min(48,Number(saved.base)||36));while(black.has(base%12))base--;
    // The old mobile eight-white-key preference does not become the desktop default.
    whiteCount=36;$('#simple').checked=!!saved.simple;$('#sustain').checked=!!saved.sustain;$('#preview').checked=saved.preview!==false;
    audio.tone=[...$('#tone').options].some(o=>Number(o.value)===Number(saved.tone))?Number(saved.tone):0;$('#tone').value=String(audio.tone);
    audio.setVolume(Number.isFinite(saved.volume)?saved.volume:.72);$('#volume').value=String(audio.volume);setPedal(false);
  }
  sessionReady=true;configureKeys();
  // A previous online song snapshot can resume without re-downloading a catalog.
  if(!saved?.songId)return;
  const snapshot=readStored(LAST_SONG);let row=snapshot?.id===saved.songId?snapshot:null;
  if(!row){try{await indexReady;}catch(_){}if(epoch!==selectionEpoch)return;row=[...library.rows,...library.custom].find(r=>r.id===saved.songId);}
  if(epoch!==selectionEpoch)return;
  if(!row){pendingResume={songId:saved.songId,position:Number(saved.position)||0};renderRows();return;}
  if(saved.version===42&&['free','follow','auto'].includes(saved.mode)){mode=saved.mode;$('#mode').value=mode;}
  await choose(row,{restore:true,savedPosition:Number(saved.position)||0});
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
function frame(now){
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
    const cutoff=position+110*speed,epoch=playEpoch;
    while(nextIndex<song.notes.length&&song.notes[nextIndex].start<=cutoff){const i=nextIndex++,n=song.notes[i];playNote(`auto-${epoch}-${i}`,n.pitch,n.velocity||85,origin+n.start/1000/speed,n.duration/speed);}
    if(position>=duration()+250){pause();position=duration();updateTimeline();saveSession();status('播放完成');return;}
  }
  if(performance.now()-lastPrefetch>900){lastPrefetch=performance.now();audio.prefetchWindow(song,mode==='follow'?(groups[groupIndex]?.start??position):position,{lookaheadMs:4500,speed});}
},25);
addEventListener('resize',()=>{updateRects();rollDirty=true;});

window.PianoWeb={audio,library,press:noteDown,release:noteUp,pause,view:currentView,setNotation,staffPractice:null,
  async selectSong(id){await indexReady;let row=library.search('').find(r=>r.id===id);if(!row){await library.all();row=library.search('').find(r=>r.id===id);}if(!row)throw Error('曲目不存在');return choose(row);},
  setRange(pitch){base=Math.max(21,Math.min(48,Number(pitch)||36));while(black.has(base%12))base--;configureKeys();},
  inspect(){return{edition:'desktop42',song:song?.id||null,mode,playing,position,base,keyCount:whiteCount,downOwners:[...downs.keys()],audio:audio.inspect(),
    groupIndex,groupCount:groups.length,catalogCount:library.catalog?.count||0,recording,notation:view,keyboardAdapter:adapter.inspect(),staff:staff?.inspect(),sessionReady};},
  webReady:()=>sessionReady&&!!adapter,
  beginOffline(){cancelRestore();selectionEpoch++;loadingSongId='';pause();renderRows();offlineSaved={position,mode};mode='auto';document.body.dataset.exporting='true';return{song,speed,preset:audio.tone,volume:audio.volume,sustain:audio.sustain};},
  async offlineFrame(ms){position=ms;updateTimeline();updateLights();drawRoll();if(view==='staff'&&staff)await staff.offlineFrame(ms,currentView());},
  endOffline(){if(offlineSaved){position=offlineSaved.position;mode=offlineSaved.mode;offlineSaved=null;}delete document.body.dataset.exporting;updateLights();updateTimeline();}
};
audio.sustain=false;configureKeys();updateTimeline();requestAnimationFrame(frame);
const indexReady=fetch(new URL('./builtin-index.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('内置目录未载入');return r.json();}).then(index=>{
  if(!library.rows.length)library.rows=index;search();
}).catch(()=>{});
restoreSession().catch(error=>status(error.message)).finally(()=>{restoringSession=false;if(song)saveSession();});
// Cache only the core and middle C in the background, never the entire piano
// or song. Browser gesture requirements are still honored by unlock().
setTimeout(()=>{audio.warmCore();audio.warmPitches([60]);},350);
