// Desktop host for the original calculator, console and VisualStage renderers.
// The main piano remains the sole score, transport and audio owner.
const labels = ['7','8','9','÷','4','5','6','×','1','2','3','−','0','.','=','+'];
const shapes = ['双侧手柄','复古竖式','横式迷你','圆润双屏','街机面板'];
const games = ['跳台阶','接星星','节奏赛车','俄罗斯方块','飞船射击','旋律花园','数字合并','旋律贪吃蛇','音符打砖块'];
// These are the Android41 VisualStageView.STYLES ids, not the older two-style scene.
const styles = ['紫色浓雾','黑白雾幕','蓝金流光','青紫焰光','烈焰琴键','流体烟波','双彩流体','星旋涡流','分形辉光','星空光粒','金焰渐变','冰蓝星辉','彩纹飞丝','紫光粒瀑','立体琴键'];
const options = a => Object.freeze(a.map((label,value)=>Object.freeze({value,label})));
export const DESKTOP_SCENE_SCHEMA = Object.freeze({
  surfaces:Object.freeze(['calculator','handheld','music','visualizer']),
  calcCount:Object.freeze([9,12,16]), numbered:'boolean', shape:options(shapes), game:options(games), style:options(styles), musicStyle:options(['透视流动','平面谱面']),
  density:Object.freeze({min:.25,max:2,default:1}), reducedMotion:'boolean', showNotes:'boolean',
  preview:'boolean', tapDuration:'boolean', octave:Object.freeze({min:0,max:8,default:4}),
  firstPitch:Object.freeze({min:0,max:127,default:21}), whiteCount:Object.freeze({min:1,max:75,default:52})
});
const calculatorKeys = Object.freeze({
  Digit7:0,Numpad7:0,Digit8:1,Numpad8:1,Digit9:2,Numpad9:2,Slash:3,NumpadDivide:3,
  Digit4:4,Numpad4:4,Digit5:5,Numpad5:5,Digit6:6,Numpad6:6,KeyX:7,NumpadMultiply:7,
  Digit1:8,Numpad1:8,Digit2:9,Numpad2:9,Digit3:10,Numpad3:10,Minus:11,NumpadSubtract:11,
  Digit0:12,Numpad0:12,Period:13,NumpadDecimal:13,Backslash:14,NumpadEnter:14,Equal:15,NumpadAdd:15
});
const handheldKeys = Object.freeze({ArrowUp:0,ArrowRight:1,ArrowDown:2,ArrowLeft:3,KeyI:4,KeyL:5,KeyK:6,KeyJ:7});
export const DESKTOP_SCENE_KEYS = Object.freeze({calculator:calculatorKeys,handheld:handheldKeys,music:'piano-keyboard-adapter',visualizer:'piano-keyboard-adapter'});
const keyHints = ['7','8','9','/','4','5','6','X','1','2','3','−','0','.','\\','='];
const defaults = Object.freeze({calcCount:16,numbered:false,shape:0,game:0,style:0,musicStyle:0,density:1,reducedMotion:false,showNotes:true,preview:true,tapDuration:true,octave:4,firstPitch:21,whiteCount:52});
const sources = Object.freeze({
  calculator:new URL('../demo/assets/native/calculator/mechanical.html',import.meta.url).href,
  handheld:new URL('../demo/assets/native/handheld-model/renderer.html',import.meta.url).href,
  music:new URL('../demo/assets/native/music-visualizer/scene.html',import.meta.url).href,
  visualizer:new URL('./assets/native/visual-stage/scene.html',import.meta.url).href
});
let formalPromise;
const getFormal = () => formalPromise ||= import('./native-synth.js').catch(error=>{formalPromise=null;throw error;});
const finite = (v,fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const modeId = mode => mode==='auto'?1:mode==='follow'?2:0;
const pitches = list => Array.from(new Set((list||[]).map(n=>Number(typeof n==='object'?n.pitch:n)).filter(p=>Number.isInteger(p)&&p>=0&&p<=127)));
const layoutIds = count => count===9?[0,1,2,4,5,6,8,9,10]:count===12?[0,1,2,4,5,6,8,9,10,12,13,14]:Array.from({length:16},(_,i)=>i);
const noteName = p => ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][p%12]+(Math.floor(p/12)-1);
function degree(p){const text=['1','♯1','2','♯2','3','4','♯4','5','♯5','6','♯6','7'][p%12],octave=Math.floor(p/12)-5;return text+(octave>0?'̇'.repeat(Math.min(3,octave)):'̣'.repeat(Math.min(3,-octave)));}
function configuration(before,patch={}){
  const next={...before};
  for(const key of ['numbered','reducedMotion','showNotes','preview','tapDuration'])if(key in patch)next[key]=!!patch[key];
  if('calcCount' in patch){const count=Number(patch.calcCount);if(![9,12,16].includes(count))throw Error('计算器按键数必须是 9、12 或 16');next.calcCount=count;}
  for(const [key,lo,hi]of [['shape',0,4],['game',0,8],['style',0,14],['musicStyle',0,1],['octave',0,8],['firstPitch',0,127],['whiteCount',1,75]])if(key in patch){const value=Number(patch[key]);if(!Number.isInteger(value)||value<lo||value>hi)throw Error(`${key} 超出原场景支持范围`);next[key]=value;}
  if('density' in patch){const value=Number(patch.density);if(!Number.isFinite(value)||value<.25||value>2)throw Error('光影密度必须在 0.25 到 2 之间');next.density=value;}
  return next;
}
function groupAt(view){const groups=view.groups||[];if(!groups.length)return -1;if(view.mode==='follow')return clamp(Math.trunc(finite(view.groupIndex)),0,groups.length);let lo=0,hi=groups.length;while(lo<hi){const mid=(lo+hi)>>>1;if(finite(groups[mid].start)<=view.position)lo=mid+1;else hi=mid;}return Math.max(0,lo-1);}
function snapshot(view={}){return{...view,song:view.song||null,groups:view.groups||[],expected:view.expected||[],active:view.active||[],held:view.held||[],mode:view.mode||'free',position:Math.max(0,finite(view.position)),playing:!!view.playing,speed:Math.max(.1,finite(view.speed,1)),sampleEpochMs:finite(view.sampleEpochMs,Date.now())};}
const abortError = () => Object.assign(Error('场景操作已取消'),{name:'AbortError'});
const isAbort = error => error?.name==='AbortError';

const calculatorDesktopCSS = `
body{background:transparent!important;font-family:system-ui,"Microsoft YaHei",sans-serif!important}
.stage{max-width:1400px!important;grid-template-columns:minmax(300px,40%) minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)!important;padding:22px!important;gap:24px!important;align-content:stretch!important;margin:0 auto!important;background:linear-gradient(145deg,#eef2f5,#d5dfe7)!important}
.compact-head{display:none!important}.keyboard{gap:14px!important;padding:16px!important}.column{gap:14px!important}.screen-pod{padding:24px 16px 16px!important}
.lcd.has-score,.lcd.has-score.tap-duration{grid-template-rows:24px minmax(0,1fr) 48px!important;gap:8px!important}.lcd.has-score .code{font-size:clamp(20px,2.8vw,34px)!important;line-height:1.25!important}.lcd.has-score .slot.chord .code{font-size:clamp(14px,1.8vw,23px)!important}.lcd.has-score .caption{font-size:13px!important;line-height:18px!important}.heading,.song{font-size:12px!important}.num,.duration{font-size:11px!important;line-height:15px!important}
.desktop-key-hint{position:absolute;left:8px;top:7px;z-index:6;padding:1px 4px;border:1px solid #63788b55;border-radius:3px;color:#536b7b;background:#fff7;font:11px system-ui,sans-serif;pointer-events:none}
@media(max-width:760px){.stage{padding:14px!important;gap:14px!important;grid-template-columns:minmax(240px,42%) minmax(0,1fr)!important}.keyboard{padding:10px!important;gap:9px!important}.column{gap:9px!important}.screen-pod{padding:22px 10px 10px!important}.lcd.has-score .code{font-size:22px!important}.lcd.has-score .slot.chord .code{font-size:15px!important}}
@media(max-width:560px){.stage{grid-template-columns:1fr!important;grid-template-rows:minmax(180px,38%) minmax(0,1fr)!important;padding:12px!important;gap:12px!important}.screen-pod{padding:18px 10px 10px!important}.lcd.has-score .code{font-size:23px!important}.lcd.has-score .caption{font-size:11px!important}.key .char{font-size:30px!important}}
`;
// The original calculator document already permits inline style. This owned
// rule hides desktop shortcut decoration only; expression/keycap labels remain.
const presentationHintCSS='body[data-presentation="clean"] .desktop-key-hint{display:none!important}';

export function createDesktopScenes({host,onStatus=()=>{}}={}){
  if(!host?.ownerDocument)throw Error('桌面场景需要有效的 host 容器');
  const document=host.ownerDocument,window=document.defaultView||globalThis.window;
  let config={...defaults},session=null,generation=0,frameSequence=0,sessionSequence=0,desiredActive=true,desiredPresentation=false,latestView=null;
  const piano = () => window.PianoWeb;
  const currentView = () => snapshot(piano()?.view?.()||latestView||{});
  const current = s => session===s&&!s.closed;
  const visible = s => current(s)&&s.active&&!document.hidden;
  const exporting = view => view?.exporting===true||document.body?.dataset?.exporting==='true';
  function status(message,state='ready') {try{onStatus(String(message),state);}catch(_){} }
  function deferred(s,timeout,label){let done=false,timer,resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});const entry={
    resolve(value){if(done)return;done=true;clearTimeout(timer);s.waiters.delete(entry);resolve(value);},
    reject(error){if(done)return;done=true;clearTimeout(timer);s.waiters.delete(entry);reject(error);}
  };s.waiters.add(entry);timer=setTimeout(()=>entry.reject(Error(label)),timeout);return{...entry,promise};}
  function assertCurrent(s){if(!current(s))throw abortError();}
  function childAPI(s){const w=s.frame.contentWindow;return s.surface==='calculator'?w:s.surface==='handheld'?w.HandheldScene:s.surface==='music'?w.MusicScene:w.VisualStage;}
  function restorePresentation(s,forget=false){
    const d=s.presentationDocument;if(!d)return;s.presentationStyle?.remove();s.presentationStyle=null;
    if(d.body){if(s.presentationOriginal===undefined)delete d.body.dataset.presentation;else d.body.dataset.presentation=s.presentationOriginal;}
    if(forget){s.presentationDocument=null;s.presentationOriginal=undefined;}
  }
  function syncPresentation(s,d=s.presentationDocument){
    if(!d?.body||!d.head)return false;
    if(s.presentationDocument!==d){restorePresentation(s,true);s.presentationDocument=d;s.presentationOriginal=d.body.dataset.presentation;}
    if(!desiredPresentation){restorePresentation(s);return true;}
    d.body.dataset.presentation='clean';
    if(s.surface==='calculator'&&!s.presentationStyle){const style=d.createElement('style');style.dataset.desktopPresentation='keyboard-hints';style.textContent=presentationHintCSS;d.head.append(style);s.presentationStyle=style;}
    return true;
  }
  function setPresentation(value){desiredPresentation=!!value;if(session?.presentationDocument)syncPresentation(session);return desiredPresentation;}
  function setRendererActive(s){try{const api=childAPI(s),active=visible(s)&&!s.failed;api?.setVisible?.(active);api?.setActive?.(active);}catch(_){} }
  function reportFailure(s,error){if(!current(s)||isAbort(error))return;const message=String(error?.message||error),repeated=s.failed&&s.error===message;s.error=message;s.failed=true;s.ready=false;s.loading=false;s.pendingView=null;for(const receipt of [...s.waiters])receipt.reject(error);releaseInput();setRendererActive(s);s.overlay.hidden=false;s.message.textContent=`${s.title}暂不可用：${s.error}`;s.retry.hidden=false;if(!repeated)status(s.message.textContent,'failed');}
  function ready(kind,token,error){const s=session;if(!s||!current(s)||kind!==s.surface||Number(token)!==s.generation)return false;if(error){s.loadReceipt?.reject(Error(String(error)));return false;}s.loadReceipt?.resolve(true);return true;}
  function painted(s,id,error){if(!current(s))return false;const receipt=s.paints.get(Number(id));if(!receipt){if(error)reportFailure(s,Error(String(error)));return false;}s.paints.delete(Number(id));error?receipt.reject(Error(String(error))):receipt.resolve(true);return true;}
  function geometry(value){const s=session;if(!s||!current(s)||s.surface!=='calculator')return false;s.geometry=value;return true;}
  function failed(message){if(session)reportFailure(session,Error(String(message)));}
  function connect(s){
    assertCurrent(s);const w=s.frame.contentWindow,d=w.document,guard=fn=>(...args)=>current(s)?fn(...args):false;
    w.NativeGeometry={ready:guard(raw=>{try{return geometry(typeof raw==='string'?JSON.parse(raw):raw);}catch(error){reportFailure(s,error);return false;}}),failed:guard(failed)};
    w.HandheldSceneReady={loaded:guard((token,error)=>ready('handheld',token,error)),painted:guard((id,error)=>painted(s,id,error)),submitted:()=>{},observed:()=>{},failed:guard(failed)};
    w.HandheldSceneTouch={down:guard(down),up:guard(up)};
    w.MusicSceneReady={loaded:guard((token,error)=>ready('music',token,error)),painted:guard((id,error)=>painted(s,id,error))};
    w.VisualStageReady={loaded:guard((token,error)=>ready('visualizer',token,error)),painted:guard((id,error)=>painted(s,id,error)),down:guard(down),up:guard(up)};
    if(s.surface==='calculator'){
      const style=d.createElement('style');style.dataset.desktopScene='calculator';style.textContent=calculatorDesktopCSS;d.head.append(style);
      // Capture before the legacy bridge: callbacks from a removed iframe must
      // never be routed into the next active instrument by a shared global.
      const pointer=event=>{
        const id=event.pointerId,old=s.contacts.get(id);
        const key=event.type==='pointermove'?d.elementFromPoint(event.clientX,event.clientY)?.closest?.('[data-key-index]'):event.target?.closest?.('[data-key-index]');
        if(event.type==='pointerup'||event.type==='pointercancel'||event.type==='lostpointercapture'){if(!old)return;event.stopImmediatePropagation();up(id);return;}
        if(!key&&!old)return;event.stopImmediatePropagation();event.preventDefault();if(!current(s))return;
        if(event.type==='pointermove'&&!old&&!event.buttons)return;
        const slot=key?Number(key.dataset.keyIndex):-1;if(old&&old.key!==slot)up(id);if(key&&(!old||old.key!==slot))down(id,slot);
        if(event.type==='pointerdown')try{key.setPointerCapture(id);}catch(_){}
      };
      for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])listen(s,d,type,pointer,true);
    }
    // Same-origin bridge events are forwarded through the root's single input
    // router. Enter, Space and the user's EOP mapping keep their main handlers.
    for(const type of ['keydown','keyup'])listen(s,w,type,event=>{event.stopImmediatePropagation();if(current(s))window.App31Surfaces?.key?.(event,type==='keydown');},true);
    listen(s,w,'blur',event=>{event.stopImmediatePropagation();if(current(s))releaseInput();},true);
    syncPresentation(s,d);setRendererActive(s);
  }
  function listen(s,target,type,listener,options){target?.addEventListener?.(type,listener,options);s.cleanups.push(()=>target?.removeEventListener?.(type,listener,options));}
  function enqueue(s,operation){const task=s.queue.then(()=>{assertCurrent(s);return operation();});s.queue=task.catch(()=>{});return task;}
  function resetManual(s){s.clockOrigin=performance.now();s.manual={epoch:++s.manualEpoch,total:0,trace:'',lastPitch:60,counts:Array(8).fill(0),lastAttackMs:-1000};s.started=false;s.attacks.clear();}
  function sameSong(s,view){return s.songLoaded&&s.song===view.song&&s.songNotes===(view.song?.notes||null)&&s.songId===(view.song?.id||'');}
  async function ensureSong(s,view){
    assertCurrent(s);if(sameSong(s,view))return;
    releaseInput();s.ready=false;s.loading=true;s.error='';s.failed=false;s.generation=++generation;resetManual(s);
    const notes=view.song?.notes||[],api=childAPI(s),payload={...(view.song||{}),id:view.song?.id||'__free__',title:view.song?.title||'自由演奏',duration:Math.max(0,finite(view.song?.durationMs)),durationMs:Math.max(0,finite(view.song?.durationMs)),generation:s.generation,shape:config.shape,game:config.game,mode:modeId(view.mode),tapDurationMode:config.tapDuration,octave:config.octave,staffAssignment:'pitch-split-60'};
    if(s.surface==='calculator'||s.surface==='handheld')s.formal=await getFormal();assertCurrent(s);
    if(s.surface==='handheld'||s.surface==='music')payload.notes=notes.map((n,source)=>({...n,start:finite(n.start??n.startMs),duration:Math.max(1,finite(n.duration??n.durationMs,1)),source,staff:n.pitch>=60?0:1}));
    else if(s.surface==='visualizer')payload.notes=notes.map(n=>({pitch:n.pitch,startMs:finite(n.start??n.startMs),durationMs:Math.max(1,finite(n.duration??n.durationMs,1)),velocity:finite(n.velocity,.8)}));
    if(s.surface!=='calculator'){
      const receipt=deferred(s,20000,'原场景曲谱准备超时，可重新打开重试');s.loadReceipt=receipt;
      try{const load=Promise.resolve().then(()=>api.load(payload)).then(value=>{if(value===false)throw Error('原场景拒绝载入曲谱');return value;});await Promise.all([load,receipt.promise]);}
      catch(error){receipt.reject(error);await receipt.promise.catch(()=>{});throw error;}
      finally{if(s.loadReceipt===receipt)s.loadReceipt=null;}
    }
    assertCurrent(s);s.song=view.song;s.songNotes=view.song?.notes||null;s.songId=view.song?.id||'';s.songLoaded=true;s.ready=true;s.loading=false;s.error='';s.failed=false;s.overlay.hidden=true;s.retry.hidden=true;setRendererActive(s);
  }
  function keyFor(s,pitch){return s.surface==='handheld'?s.formal.handheldKey(pitch):s.formal.calculatorKey(pitch,config.calcCount);}
  const manualClock = (s,view,offline) => offline?view.position:Math.max(0,performance.now()-s.clockOrigin);
  function calculatorFrame(s,view,offline){
    const formal=s.formal,index=groupAt(view),groups=view.groups,currentNotes=groups[index]?.notes||[],next=groups[index+1]?.notes||[],mode=modeId(view.mode),masks=Array(16).fill(0),hold=Array(16).fill(-1),actions=Array(16).fill('');
    const symbol=p=>config.numbered?degree(p):labels[keyFor(s,p)];
    for(const n of(mode===2?view.expected:currentNotes)){const slot=keyFor(s,n.pitch);if(slot>=0&&slot<16){masks[slot]|=1;actions[slot]='点一下';}}
    if(config.preview)for(const n of next){const slot=keyFor(s,n.pitch);if(slot>=0&&slot<16)masks[slot]|=2;}
    const now=performance.now();for(const [slot,at]of s.attacks){if(now-at>500)s.attacks.delete(slot);else if(!offline)hold[slot]=Math.round(100*(1-(now-at)/500));}
    const sequence=groups.length?Array.from({length:10},(_,slot)=>{const at=formal.scoreSlot(Math.max(0,index),slot,groups.length),g=groups[at],notes=g?.notes||[],duration=Math.max(0,...notes.map(n=>finite(n.duration??n.durationMs)));return{n:at>=0?at+1:0,key:notes.map(n=>symbol(n.pitch)).join('·'),duration:duration?(duration/1000/view.speed).toFixed(2)+'秒':'',current:at===index,done:at>=0&&at<index,hold:at===index&&mode===1?clamp((view.position-g.start)/Math.max(1,duration),0,1):-1,flag:at===index?(mode===1?'弹奏':'点按'):at<index?'完成':notes.length>1?'同按':at>0&&notes.some(n=>(groups[at-1]?.notes||[]).some(p=>keyFor(s,p.pitch)===keyFor(s,n.pitch)))?'再按':'',chord:notes.length>1};}):[];
    const active=pitches(view.active),heldPitches=offline?active:pitches(view.held),mask=list=>list.reduce((bits,p)=>{const slot=keyFor(s,p);return slot>=0&&slot<16?bits|(1<<slot):bits;},0);
    const held=mask(heldPitches)|(mode===1?mask(active):0);
    return{layoutKeys:layoutIds(config.calcCount),columns:config.calcCount===16?4:3,rows:config.calcCount===9?3:4,numbered:config.numbered,chromeExpanded:false,exporting:offline,mediaFrame:offline,battery:-1,charging:false,outputLevel:active.length?.1:0,tapDuration:config.tapDuration,held,target:mode===2?mask(pitches(view.expected)):0,sequenceMasks:masks,keyActions:actions,hold,sequence,heading:mode===0?'自由弹奏':(config.numbered?'简谱 · 1=C':'按键谱')+(mode===1?' · 自动':''),song:view.song?.title||'自由演奏',mode,label:currentNotes[0]?symbol(currentNotes[0].pitch):'♪',pitch:currentNotes[0]?noteName(currentNotes[0].pitch):'',caption:mode===0?'电脑数字键或鼠标弹奏':config.tapDuration?'点一下亮键 · 音长自动补足':'按下发音 · 松开发音结束',holdProgress:-1,page:groups.length?formal.scorePageLabel(Math.max(0,index),groups.length):'',preview:config.preview?next.map(n=>symbol(n.pitch)).join(' '):'',flowCurrent:currentNotes[0]?keyFor(s,currentNotes[0].pitch):-1,flowNext:config.preview&&next[0]?keyFor(s,next[0].pitch):-1};
  }
  function decorateCalculator(s){const d=s.frame.contentWindow.document;for(const cell of d.querySelectorAll('[data-key-index]'))if(!cell.querySelector('.desktop-key-hint')){const hint=d.createElement('kbd');hint.className='desktop-key-hint';hint.textContent=keyHints[Number(cell.dataset.keyIndex)]||'';cell.append(hint);}}
  function afterPaint(s){const receipt=deferred(s,5000,'场景布局绘制超时');const w=s.frame.contentWindow;if(typeof w.requestAnimationFrame!=='function'){receipt.reject(Error('场景缺少动画帧时钟'));return receipt.promise;}w.requestAnimationFrame(()=>w.requestAnimationFrame(()=>current(s)?receipt.resolve(true):receipt.reject(abortError())));return receipt.promise;}
  async function render(s,view,offline=false){
    await s.boot;assertCurrent(s);await ensureSong(s,view);assertCurrent(s);if(!offline&&!visible(s))return{skipped:true};
    const api=childAPI(s),index=groupAt(view),currentNotes=view.groups[index]?.notes||[],next=view.groups[index+1]?.notes||[],mode=modeId(view.mode),id=++frameSequence;
    s.started ||= view.playing||view.position>0;
    if(s.needsResize){s.needsResize=false;const w=s.frame.contentWindow;if(w.Event)w.dispatchEvent?.(new w.Event('resize'));}
    if(s.surface==='calculator'){
      api.updateMusic(calculatorFrame(s,view,offline));decorateCalculator(s);if(offline)await afterPaint(s);
    }else{
      let data;if(s.surface==='handheld')data={generation:s.generation,frameId:id,ms:view.position,playing:view.playing||offline,exporting:offline,mode,shape:config.shape,game:config.game,localVisualAnimation:!offline&&visible(s),captureVisualBarrier:false,started:mode===0||s.started||offline,waiting:mode!==0&&!s.started&&!offline,current:pitches(mode===2?view.expected:currentNotes),next:config.preview?pitches(next):[],active:pitches(view.active),previewCount:config.preview?2:0,tapDurationMode:config.tapDuration,manual:{...s.manual,counts:[...s.manual.counts],motionMs:manualClock(s,view,offline)},speed:view.speed,busy:false};
      else if(s.surface==='music')data={frameId:id,ms:mode===0&&!view.song?manualClock(s,view,offline):view.position,playing:view.playing||offline,energy:Math.min(1,pitches(view.active).length/8),style:config.musicStyle,reducedMotion:config.reducedMotion,exporting:offline,captureVisualBarrier:offline};
      else data={frameId:id,ms:view.position,playing:view.playing||offline,speed:view.speed,style:config.style,density:config.density,reducedMotion:config.reducedMotion,exporting:offline,captureVisualBarrier:offline,showNotes:config.showNotes,firstPitch:config.firstPitch,whiteCount:config.whiteCount,pressed:offline?[]:pitches(view.held),automaticPitches:mode===1?pitches(view.active):[],scoreDriven:mode===1,expected:mode===2&&view.playing?pitches(view.expected):[],sampleEpochMs:offline?0:view.sampleEpochMs};
      let receipt;if(offline){receipt=deferred(s,10000,'原场景离线帧未收到 painted 完成回执');s.paints.set(id,receipt);}
      try{const result=await api.frame(data);if(result===false||result?.ready===false)throw Error(result?.lastError||result?.error||'原场景帧绘制失败');if(receipt)await receipt.promise;}
      catch(error){receipt?.reject(error);if(receipt)await receipt.promise.catch(()=>{});throw error;}
      finally{s.paints.delete(id);}
    }
    assertCurrent(s);s.lastFrameId=id;s.lastPosition=view.position;s.frameCount++;return{frameId:id,generation:s.generation,surface:s.surface,painted:offline};
  }
  function schedule(s){if(!current(s)||s.liveQueued||!s.pendingView||!visible(s)||exporting(s.pendingView))return;s.liveQueued=true;
    const task=enqueue(s,()=>{const view=s.pendingView;s.pendingView=null;return view?render(s,view):null;});
    task.then(()=>{s.liveQueued=false;schedule(s);},error=>{s.liveQueued=false;s.pendingView=null;reportFailure(s,error);});
  }
  function update(view){latestView=view?snapshot(view):currentView();const s=session;if(!s||!current(s))return;s.pendingView=latestView;if(!s.failed)schedule(s);}
  function down(pointer,key,velocity=85){
    const s=session;if(!s||!visible(s)||!s.ready||s.failed||s.surface==='music'||s.contacts.has(pointer)||exporting())return false;
    key=Number(key);if(!Number.isInteger(key))return false;
    if(s.surface==='calculator'&&!layoutIds(config.calcCount).includes(key)||s.surface==='handheld'&&(key<0||key>7)||s.surface==='visualizer'&&(key<0||key>127))return false;
    const p=piano();if(!p?.press||!p.release||!p.view)return false;const before=snapshot(p.view()),pending=before.mode==='follow'&&before.playing?before.expected:[];
    const matches=pending.filter(n=>s.surface==='visualizer'?n.pitch===key:keyFor(s,n.pitch)===key).sort((a,b)=>a.pitch-b.pitch);
    const pitch=matches[0]?.pitch??(s.surface==='visualizer'?key:s.surface==='handheld'?[60,62,64,65,67,69,71,70][key]+(config.octave-4)*12:s.formal.calculatorFree(key,config.calcCount,config.octave));
    if(!Number.isInteger(pitch)||pitch<0||pitch>127)return false;
    const owner=`desktop-scene-${s.id}-${String(pointer)}`,contact={key,pitch,owner,piano:p};s.contacts.set(pointer,contact);s.attacks.set(key,performance.now());
    try{p.press(owner,pitch,clamp(Math.round(finite(velocity,85)),1,127));}catch(error){s.contacts.delete(pointer);try{p.release(owner);}catch(_){}reportFailure(s,error);return false;}
    const after=snapshot(p.view()),accepted=before.mode!=='follow'||!before.playing||pending.some(n=>n.pitch===pitch)&&(after.groupIndex!==before.groupIndex||after.expected.filter(n=>n.pitch===pitch).length<pending.filter(n=>n.pitch===pitch).length);
    if(accepted){s.manual.total++;s.manual.lastPitch=pitch;s.manual.lastAttackMs=manualClock(s,after,false);if(s.surface==='handheld'){s.manual.trace+=String(key);s.manual.counts[key]++;}s.started=true;}
    if(s.surface==='handheld')try{childAPI(s)?.press?.({pointer,slot:key,down:true,actualPitch:pitch});}catch(error){reportFailure(s,error);}
    update(after);return true;
  }
  function up(pointer){const s=session,contact=s?.contacts.get(pointer);if(!s||!contact)return false;s.contacts.delete(pointer);try{contact.piano.release(contact.owner);}catch(error){status(String(error.message||error),'failed');}if(s.surface==='handheld')try{childAPI(s)?.press?.({pointer,down:false});}catch(_){}if(current(s)&&s.active&&!s.releasing)update();return true;}
  function releaseInput(){const s=session;if(!s||s.releasing)return;s.releasing=true;for(const pointer of [...s.contacts.keys()])up(pointer);try{if(s.surface==='visualizer')childAPI(s)?.releaseTouches?.();}catch(_){}s.releasing=false;}
  function blocked(event){const target=event.target;if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return true;if(target?.isContentEditable||target?.closest?.('input,select,textarea,[contenteditable=""],[contenteditable="true"],[role="textbox"]'))return true;return !!document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]:not([hidden])');}
  function handleKey(event,on){const s=session;if(!s||!current(s))return false;const pointer=`pc-${event.code}`;
    if(!on&&s.contacts.has(pointer)){event.preventDefault?.();return up(pointer);}
    if(!visible(s)||!s.ready||s.failed||s.surface==='visualizer'||s.surface==='music'||blocked(event))return false;
    const key=(s.surface==='calculator'?calculatorKeys:handheldKeys)[event.code];if(key===undefined||s.surface==='calculator'&&!layoutIds(config.calcCount).includes(key))return false;
    event.preventDefault?.();if(on&&!event.repeat)down(pointer,key);return true;
  }
  function setActive(value){desiredActive=!!value;const s=session;if(!s)return;if(!desiredActive)releaseInput();s.active=desiredActive;setRendererActive(s);if(desiredActive)update();}
  function configure(patch={}){const next=configuration(config,patch);if(next.calcCount!==config.calcCount||next.octave!==config.octave||next.shape!==config.shape||next.game!==config.game)releaseInput();if(next.game!==config.game&&session)resetManual(session);config=next;update();return{...config};}
  function close(){const s=session;if(!s)return;releaseInput();restorePresentation(s,true);s.closed=true;s.active=false;for(const cleanup of s.cleanups.splice(0))try{cleanup();}catch(_){}for(const receipt of [...s.waiters])receipt.reject(abortError());s.paints.clear();s.pendingView=null;try{const api=childAPI(s);api?.setVisible?.(false);api?.setActive?.(false);api?.dispose?.();api?.close?.();}catch(_){}s.frame.onload=null;s.frame.onerror=null;s.shell.remove();session=null;}
  async function open(surface,patch={}){
    if(!DESKTOP_SCENE_SCHEMA.surfaces.includes(surface))throw Error(`不支持的桌面场景：${surface}`);const next=configuration(config,patch);close();config=next;
    if(!document.getElementById('desktop-scenes-style')){const link=document.createElement('link');link.id='desktop-scenes-style';link.rel='stylesheet';link.href=new URL('./desktop-scenes.css',import.meta.url).href;document.head.append(link);}
    const shell=document.createElement('section');shell.className=`desktop-scene-shell desktop-scene-${surface}`;
    const frame=document.createElement('iframe');frame.id='native-surface-frame';frame.className='desktop-scene-frame';frame.title=({calculator:'音乐计算器',handheld:'音乐掌机',music:'流光谱面',visualizer:'光影琴境'})[surface];frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.referrerPolicy='no-referrer';frame.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; autoplay 'none'");
    const overlay=document.createElement('div');overlay.className='desktop-scene-overlay';overlay.setAttribute('role','status');const message=document.createElement('p');message.textContent=`正在准备${frame.title}…`;const retry=document.createElement('button');retry.type='button';retry.textContent='重新加载';retry.hidden=true;overlay.append(message,retry);
    const hint=document.createElement('p');hint.className='desktop-scene-hint';hint.textContent=surface==='calculator'?'数字区与计算器排列一致 · X 乘号 / 除号 \\ 等号 = 加号 · 鼠标也可弹奏':surface==='handheld'?'方向键控制左侧 4 键 · I / L / K / J 控制右侧 4 键 · 玩法由按对音符驱动':'沿用当前电脑钢琴键位 · 鼠标点击琴键 · 空格延音 · Enter 播放 / 暂停';
    shell.append(frame,overlay,hint);const s=session={id:++sessionSequence,surface,title:frame.title,shell,frame,overlay,message,retry,active:desiredActive,closed:false,ready:false,loading:true,failed:false,error:'',generation:0,songLoaded:false,song:null,songNotes:null,songId:'',contacts:new Map(),attacks:new Map(),paints:new Map(),waiters:new Set(),cleanups:[],queue:Promise.resolve(),liveQueued:false,pendingView:null,geometry:null,lastFrameId:0,lastPosition:0,frameCount:0,manualEpoch:0,started:false,needsResize:false,releasing:false};resetManual(s);
    const boot=deferred(s,15000,'原场景页面准备超时，可重新加载');s.boot=boot.promise;
    frame.onload=()=>{try{assertCurrent(s);const api=childAPI(s);if(s.surface==='calculator'?typeof api?.updateMusic!=='function':typeof api?.load!=='function'||typeof api?.frame!=='function')throw Error('原场景接口未加载，可能有资源或 CSP 错误');connect(s);boot.resolve(true);}catch(error){boot.reject(error);}};
    frame.onerror=()=>boot.reject(Error('原场景页面未能载入'));
    listen(s,retry,'click',()=>{open(surface,{...config}).catch(error=>{if(!isAbort(error))status(error.message,'failed');});});
    listen(s,window,'blur',()=>{queueMicrotask(()=>{if(current(s)&&document.activeElement!==frame)releaseInput();});});
    listen(s,document,'visibilitychange',()=>{if(document.hidden)releaseInput();setRendererActive(s);if(!document.hidden&&s.active)update();});
    listen(s,window,'resize',()=>{if(!current(s))return;s.needsResize=true;update();});
    if(typeof window.ResizeObserver==='function'){const observer=new window.ResizeObserver(()=>{if(current(s)){s.needsResize=true;update();}});observer.observe(host);s.cleanups.push(()=>observer.disconnect());}
    // No untrusted message can select an instrument, change a song or operate
    // audio. This optional bridge accepts only this exact same-origin frame.
    listen(s,window,'message',event=>{if(!current(s)||event.source!==frame.contentWindow||event.origin!==new URL(frame.src).origin)return;const data=event.data;if(!data||data.type!=='pocket-piano-scene'||data.generation!==s.generation||data.surface!==s.surface)return;if(data.action==='painted')painted(s,data.frameId,data.error);});
    frame.src=sources[surface];host.append(shell);status(message.textContent,'loading');
    try{const initial=latestView=currentView();await enqueue(s,()=>render(s,initial));assertCurrent(s);status(`${s.title}已准备好`,'ready');return inspect();}
    catch(error){reportFailure(s,error);if(isAbort(error))return{canceled:true,surface};throw error;}
  }
  async function offlineFrame(view){const s=session;if(!s||!visible(s))return{skipped:true};const sample=snapshot(typeof view==='number'?{...currentView(),position:view}:view||currentView());s.pendingView=null;try{return await enqueue(s,()=>render(s,sample,true));}catch(error){reportFailure(s,error);throw error;}}
  function inspect(){const s=session;let renderer=null;if(s)try{renderer=childAPI(s)?.inspect?.()||null;}catch(error){renderer={error:String(error.message||error)};}return{surface:s?.surface||null,active:!!s?.active,ready:!!s?.ready&&!s?.failed,loading:!!s?.loading,failed:!!s?.failed,error:s?.error||'',presentation:desiredPresentation,presentationHintStyle:!!s?.presentationStyle,generation:s?.generation||generation,frameId:s?.lastFrameId||0,frames:s?.frameCount||0,position:s?.lastPosition||0,source:s?sources[s.surface]:null,configuration:{...config},needsPianoKeyboard:s?.surface==='visualizer'||s?.surface==='music',contacts:s?[...s.contacts.values()].map(({key,pitch,owner})=>({key,pitch,owner})):[],manual:s?{...s.manual,counts:[...s.manual.counts]}:null,geometry:s?.geometry||null,renderer,verification:'renderer model and bridge state; pixels, audio and hardware require browser validation'};}
  return{open,close,update,configure,inspect,offlineFrame,handleKey,releaseInput,setActive,setPresentation,down,up,key:handleKey,release:releaseInput,ready,geometry,failed};
}
