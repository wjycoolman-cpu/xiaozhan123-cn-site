import {loadLibraryVendor} from './library-vendor.js';

const CHORDS=Object.freeze([
  ['C 大三和弦',[60,64,67]],['D 小三和弦',[62,65,69]],['E 小三和弦',[64,67,71]],
  ['F 大三和弦',[65,69,72]],['G 大三和弦',[67,71,74]],['A 小三和弦',[69,72,76]]
]);
const SKINS=['原款','霜晶玻璃','星夜流光','暖金舞台'];
const PALETTES=['随皮肤','冰蓝银白','紫金星夜','玫瑰香槟','翡翠月光','黑金剧场'];
const names={main:'演奏工具',surface:'当前乐器设置',volume:'音色与音量',keyboard:'电脑键盘与音域',practice:'跟弹设置',appearance:'钢琴外观',chords:'一指和弦',metronome:'节拍器',midi:'MIDI 文件与外部键盘',loop:'A–B 循环',progress:'速度与进度',info:'曲目信息',stats:'练习成绩',guitar:'节奏与扫弦'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const numbered=(values,offset=0)=>values.map((name,i)=>[i+offset,name]);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const duration=song=>Math.max(0,finite(song?.durationMs,song?.notes?.reduce((max,n)=>Math.max(max,n.start+n.duration),0)||0));
const guitarTone=preset=>preset===6||preset>=58&&preset<=65;
// The bundled SMF writer serializes one byte per character. Preserve Unicode
// as explicit UTF-8 bytes with a BOM, which the import consumer can identify
// without guessing the encoding of unrelated legacy MIDI files.
function midiText(value){const text=String(value);return /[^\x20-\x7e]/.test(text)?Array.from(new TextEncoder().encode('\uFEFF'+text),byte=>String.fromCharCode(byte)).join(''):text;}
let tonesPromise;
function toneCatalog(){if(!tonesPromise)tonesPromise=fetch(new URL('./instruments.json',import.meta.url),{signal:AbortSignal.timeout(15000)}).then(response=>{if(!response.ok)throw Error('音色目录下载失败，请重试');return response.json();}).then(rows=>{if(!Array.isArray(rows)||rows.length!==176||rows.some(row=>!Number.isInteger(row.id)||row.id<0||row.id>175||typeof row.name!=='string'))throw Error('完整音色目录校验失败');return rows;}).catch(error=>{tonesPromise=null;throw error;});return tonesPromise;}

// No audio context, MIDI permission request or instrument module is started by
// importing this optional panel. The root remains the only application owner.
export function createDesktopTools({host,dialog,status=()=>{},download,openTones,openScore,setTone,workspaces}={}){
  if(!host?.ownerDocument||!dialog)throw Error('演奏工具需要有效的内容容器和对话框');
  const document=host.ownerDocument,window=document.defaultView||globalThis.window,q=selector=>document.querySelector(selector),piano=()=>window.PianoWeb;
  let disposed=false,pageEpoch=0,resourceEpoch=0,section='main',feedback=null,metronomeTimer=0,metronomeRun=0,bpm=100,beat=0,metronomeEnabled=false,metroToggle=null,metroLabel=null;
  let midiAccess=null,midiAccessCleanup=null,midiPending=false,midiChannel=-1,midiVelocity=true,midiList=null,midiRequestButton=null,midiRun=0,guitarRun=0;
  const chordContacts=new Map(),midiNotes=new Map(),midiInputs=new Map(),portQueues=new WeakMap(),portLeases=new WeakMap(),cleanups=[];
  const live=token=>!disposed&&pageEpoch===token&&!!dialog.open;
  function report(error){const text=String(error?.message||error);if(feedback)feedback.textContent=text;try{status(text);}catch(_){}return text;}
  function node(tag,text,className){const item=document.createElement(tag);if(text!==undefined)item.textContent=String(text);if(className)item.className=className;return item;}
  function guarded(fn){const token=pageEpoch;return async event=>{if(!live(token))return;try{return await fn(event);}catch(error){if(!disposed&&pageEpoch===token)report(error);}};}
  function button(parent,label,action,key){const item=node('button',label);item.type='button';if(key)item.dataset.toolAction=key;item.onclick=guarded(action);parent.append(item);return item;}
  function note(parent,text){const item=node('p',text,'dialog-note');parent.append(item);return item;}
  function row(parent,label,description){const item=node('label',undefined,'setting'),text=node('span',label);if(description)text.append(node('small',description));item.append(text);parent.append(item);return item;}
  function select(parent,label,values,value,change,key){const r=row(parent,label),input=node('select');if(key)input.dataset.toolKey=key;for(const [value,name]of values){const option=node('option',name);option.value=String(value);input.append(option);}input.value=String(value);input.onchange=guarded(()=>change(input.value));r.append(input);return input;}
  function toggle(parent,label,value,change,key,description){const r=row(parent,label,description),input=node('input');input.type='checkbox';input.checked=!!value;if(key)input.dataset.toolKey=key;input.onchange=guarded(()=>change(input.checked));r.append(input);return input;}
  function number(parent,label,value,min,max,step,change,key){const r=row(parent,label),input=node('input');input.type='number';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(value);if(key)input.dataset.toolKey=key;let prior=input.value;input.onchange=guarded(async()=>{const value=Number(input.value);if(!Number.isFinite(value)||value<min||value>max){input.value=prior;throw Error(`${label}应在 ${min}–${max} 之间`);}await change(value);prior=input.value;});r.append(input);return input;}
  function control(parent,id,label){const original=q('#'+id);if(!original){note(parent,`${label}暂不可用`);return null;}const r=row(parent,label),copy=original.cloneNode(true);copy.removeAttribute('id');copy.value=original.value;copy.checked=original.checked;copy.dataset.toolKey=id;
    const send=async type=>{original.value=copy.value;original.checked=copy.checked;original.dispatchEvent(new window.Event(type,{bubbles:true}));if(type==='change'&&(id==='simple'||id==='preview')){const controller=await workspaces();controller.configure({[id==='simple'?'tapDuration':'preview']:copy.checked});}};
    copy.oninput=guarded(()=>send('input'));copy.onchange=guarded(()=>send('change'));r.append(copy);return copy;
  }
  function closeDialog(){stop();dialog.close?.();}
  function handoff(action){closeDialog();return action?.();}
  function trigger(id){const item=q('#'+id);if(!item)throw Error('当前页面尚未提供此操作');return item.click();}
  function requireSong(){const song=piano()?.view?.().song;if(!song||!Array.isArray(song.notes)||!song.notes.length)throw Error('请先从曲库选择一首曲目');return song;}
  function ownedRelease(owners){for(const [owner,p]of owners)try{p.release(owner);}catch(error){report(error);} }
  function releaseChord(id){const owners=chordContacts.get(id);if(!owners)return;chordContacts.delete(id);ownedRelease(owners);}
  function stopMetronome(){++metronomeRun;clearTimeout(metronomeTimer);metronomeTimer=0;metronomeEnabled=false;if(metroToggle)metroToggle.checked=false;if(metroLabel)metroLabel.textContent='已停止 · 4 拍一组，第一拍重音';}
  function releaseMidiNotes(portId=null,channel=null){for(const [id,note]of [...midiNotes])if((portId===null||note.portId===portId)&&(channel===null||note.channel===channel)){midiNotes.delete(id);try{note.piano.release(note.owner);}catch(error){report(error);}}}
  function portOperation(input,operation){const pending=(portQueues.get(input)||Promise.resolve()).catch(()=>{}).then(operation);portQueues.set(input,pending);return pending;}
  function closePort(input,lease){return portOperation(input,()=>{if(portLeases.get(input)!==lease)return;portLeases.delete(input);return input.close?.();}).catch(error=>{if(!disposed&&dialog.open)report(error);});}
  function disconnectPort(id){const entry=midiInputs.get(id);if(!entry)return;midiInputs.delete(id);entry.cleanup?.();releaseMidiNotes(id);closePort(entry.input,entry.lease);}
  function stopMidi(){++midiRun;midiPending=false;if(midiRequestButton)midiRequestButton.disabled=false;midiAccessCleanup?.();midiAccessCleanup=null;for(const id of [...midiInputs.keys()])disconnectPort(id);releaseMidiNotes();midiAccess=null;if(midiList)midiList.replaceChildren();}
  function stop(){++resourceEpoch;++guitarRun;for(const id of [...chordContacts.keys()])releaseChord(id);stopMetronome();stopMidi();}
  function listen(target,type,handler){target.addEventListener(type,handler);cleanups.push(()=>target.removeEventListener(type,handler));}
  listen(dialog,'close',stop);listen(dialog,'cancel',stop);
  listen(window,'blur',()=>{if(dialog.open)stop();});
  listen(document,'visibilitychange',()=>{if(document.hidden)stop();});

  function main(){
    const grid=node('div',undefined,'tools-grid');host.append(grid);
    for(const [title,entries]of[
      ['乐器与声音',[['当前乐器设置','surface'],['音色与音量','volume'],['节拍器','metronome'],['一指和弦','chords'],['MIDI 文件与外部键盘','midi']]],
      ['键盘与跟弹',[['键盘宽度与单双排','keyboard'],['跟弹与难度','practice'],['钢琴皮肤与配色','appearance'],['完整简谱 / 五线谱',()=>{requireSong();return handoff(openScore);}]]],
      ['曲目与录制',[['速度与进度','progress'],['A–B 循环','loop'],['录自己的演奏',()=>handoff(()=>trigger('record'))],['我的录制',()=>handoff(()=>piano().showCategory('录制'))],['曲目信息','info'],['本曲练习成绩','stats']]]
    ]){const group=node('section',undefined,'tools-section');group.append(node('h3',title));for(const [label,action]of entries)button(group,label,typeof action==='string'?()=>open(action):action,typeof action==='string'?action:undefined);grid.append(group);}
    const actions=node('div',undefined,'tool-row');button(actions,'导入 MIDI / EOP / JSON',()=>handoff(()=>trigger('import')),'import');button(actions,'导出当前曲目 WAV',()=>{requireSong();return handoff(()=>trigger('export-wav'));},'wav');button(actions,'音频与演奏视频导出',()=>handoff(()=>trigger('export-entry')),'exports');host.append(actions);
  }
  function volume(){button(host,'打开全部 176 项音色',()=>handoff(openTones),'tones');control(host,'volume','当前演奏音量');control(host,'sustain','默认延音');note(host,'电脑空格键可临时踩下延音踏板。');}
  function keyboard(){const p=piano(),values=p.desktopOptions();
    number(host,'显示白键数量',values.whiteCount,7,52,1,value=>p.setDisplay({whiteCount:Math.round(value)}),'whiteCount');
    select(host,'键盘排布',[[0,'自动 · 大跨度双排接续'],[1,'固定单排'],[2,'固定双排']],values.rows,value=>p.setDisplay({rows:Number(value)}),'rows');
    select(host,'琴键音名',[['notes','音名 C / D / E'],['numbers','唱名 1 / 2 / 3'],['hidden','隐藏']],values.labels,value=>p.setDisplay({labels:value}),'labels');
    number(host,'整体移调（半音）',values.transpose,-24,24,1,value=>p.setDisplay({transpose:Math.round(value)}),'transpose');
    number(host,'电脑输入固定力度',values.velocity,1,127,1,value=>p.setDisplay({velocity:Math.round(value)}),'velocity');
    toggle(host,'使用笔或触屏提供的压力力度',values.pressure,value=>p.setDisplay({pressure:value}),'pressure','鼠标和实体电脑键盘保持固定力度；设备未提供有效压力时也使用固定力度。');
    toggle(host,'Alt + 拖动琴键调整音域',values.drag,value=>p.setDisplay({drag:value}),'drag','按住 Alt 再用鼠标拖动；普通拖动继续滑音。');
    const moves=node('div',undefined,'tool-row');button(moves,'低一个八度',()=>trigger('lower'),'lower');button(moves,'高一个八度',()=>trigger('higher'),'higher');host.append(moves);
    const first=number(host,'可见音区起点（MIDI）',p.inspect?.().base||36,21,108,1,value=>{p.setRange(Math.round(value));first.value=String(p.inspect?.().base??Math.round(value));},'firstKey');
    note(host,'移调改变发声音高；单双排与音域控制可见琴键。电脑键位仍可在主界面的键位设置中编辑。');
  }
  function practice(){const p=piano(),values=p.practiceOptions;
    toggle(host,'五线谱始终等待按对',values.staffWaitForCorrect,value=>p.setPractice({staffWaitForCorrect:value}),'staffWaitForCorrect','开启后，五线谱练习不自动补奏；其他视图仍按自动补奏设置执行。');
    select(host,'跟弹难度',[['easy','简单 · 旋律最高音'],['normal','标准'],['advanced','进阶']],values.difficulty,value=>p.setPractice({difficulty:value}),'difficulty');
    select(host,'练习声部',[['both','双手 / 全部'],['right','右手'],['left','左手']],values.hand,value=>p.setPractice({hand:value}),'hand');
    number(host,'左右手分界（MIDI）',values.split,21,108,1,value=>p.setPractice({split:Math.round(value)}),'split');
    select(host,'目标音筛选',[['all','和弦全音'],['highest','每组最高音'],['lowest','每组最低音']],values.voice,value=>p.setPractice({voice:value}),'voice');
    toggle(host,'超时后自动补奏',values.autoHelp,value=>p.setPractice({autoHelp:value}),'autoHelp');
    toggle(host,'按反应速度调整接奏缓冲',values.adaptive,value=>p.setPractice({adaptive:value}),'adaptive');
    number(host,'等待上限（毫秒）',values.maximum,500,5000,100,value=>p.setPractice({maximum:value}),'maximum');
    control(host,'simple','轻点自动补足音长与伴奏');control(host,'preview','显示下一步淡轮廓');
    note(host,'关闭自动补奏时，按对目标音后才推进；和弦要完成当前组，重复音需要松开再按。');
  }
  function appearance(){const p=piano(),values=p.desktopOptions();select(host,'钢琴皮肤',numbered(SKINS),values.skin,value=>p.setDisplay({skin:Number(value)}),'skin');select(host,'配色',numbered(PALETTES),values.palette,value=>p.setDisplay({palette:Number(value)}),'palette');toggle(host,'减少钢琴动态效果',values.reducedMotion,value=>p.setDisplay({reducedMotion:value}),'reducedMotion');toggle(host,'弹奏时收起工具栏',values.collapse,value=>p.setDisplay({collapse:value}),'collapse');note(host,'流光谱面与光影琴境的动态设置在各自的当前乐器设置中。');}
  function chords(){const page=pageEpoch;note(host,'按住发声，松开、移出捕获、关闭工具或切出窗口后释放。支持鼠标与聚焦按钮后的 Enter / 空格。');const grid=node('div',undefined,'tools-grid');host.append(grid);
    CHORDS.forEach(([label,pitches],index)=>{const item=button(grid,label,()=>{},'chord-'+index);item.setAttribute('aria-label',label+'，按住弹奏');
      const prefix=page+'-'+index+'-';
      const attack=(id,event)=>{if(chordContacts.has(id)||!live(page))return;const p=piano(),owners=[];chordContacts.set(id,owners);try{for(let n=0;n<pitches.length;n++){const owner=`tool-chord-${id}-${n}`;owners.push([owner,p]);p.press(owner,pitches[n],p.desktopOptions?.().velocity||85);}}catch(error){releaseChord(id);report(error);}event.preventDefault?.();};
      item.onpointerdown=event=>{if(event.button!==undefined&&event.button!==0)return;const id=prefix+'pointer-'+event.pointerId;attack(id,event);try{item.setPointerCapture(event.pointerId);}catch(_){};};
      for(const type of ['pointerup','pointercancel','lostpointercapture'])item['on'+type]=event=>releaseChord(prefix+'pointer-'+event.pointerId);
      item.onkeydown=event=>{if(!['Enter','Space'].includes(event.code))return;event.preventDefault();if(!event.repeat)attack(prefix+'keyboard-'+event.code,event);};
      item.onkeyup=event=>{if(['Enter','Space'].includes(event.code)){event.preventDefault();releaseChord(prefix+'keyboard-'+event.code);}};
      item.onblur=()=>{for(const id of [...chordContacts.keys()])if(id.startsWith(prefix+'keyboard-'))releaseChord(id);};
    });
  }
  async function startMetronome(){const run=++metronomeRun,resources=resourceEpoch,page=pageEpoch;clearTimeout(metronomeTimer);metronomeTimer=0;metronomeEnabled=true;if(metroToggle)metroToggle.checked=true;if(metroLabel)metroLabel.textContent='正在准备节拍音色…';
    try{await piano().audio.unlock();if(run!==metronomeRun||resources!==resourceEpoch||!live(page)||!metronomeEnabled)return;beat=0;let due=performance.now();
      const tick=()=>{if(run!==metronomeRun||resources!==resourceEpoch||!live(page)||!metronomeEnabled)return;try{const port=piano().audio.node?.port;if(!port?.postMessage)throw Error('正式音源节拍器尚未就绪');port.postMessage({type:'tick',accent:beat%4===0});if(metroLabel)metroLabel.textContent=Array.from({length:4},(_,i)=>i===beat%4?'●':'○').join(' ')+' · '+bpm+' BPM';beat++;due=Math.max(due+60000/bpm,performance.now());metronomeTimer=setTimeout(tick,Math.max(1,due-performance.now()));}catch(error){stopMetronome();report(error);}};tick();
    }catch(error){if(run===metronomeRun){stopMetronome();report(error);}}
  }
  let bpmRestored=false;
  function metronome(){if(!bpmRestored){bpmRestored=true;try{const stored=Number(localStorage.getItem('piano-desktop44-metronome'));if(Number.isFinite(stored)&&stored>=40&&stored<=240)bpm=Math.round(stored);}catch(_){}}metroToggle=toggle(host,'开启节拍器',false,value=>value?startMetronome():stopMetronome(),'metronome');number(host,'速度（BPM）',bpm,40,240,1,value=>{bpm=Math.round(value);try{localStorage.setItem('piano-desktop44-metronome',String(bpm));}catch(_){}if(metronomeEnabled)return startMetronome();},'bpm');metroLabel=note(host,'已停止 · 4 拍一组，第一拍重音');}
  function progress(){const p=piano(),view=p.view();number(host,'演奏速度（倍）',view.speed,.25,2,.05,value=>p.setSpeed(value),'speed');if(view.song){number(host,'定位（秒）',(view.position/1000).toFixed(2),0,duration(view.song)/1000,.1,value=>p.seek(value*1000),'position');note(host,'时长 '+(duration(view.song)/1000).toFixed(1)+' 秒 · 定位会暂停当前演奏。');}else note(host,'从左侧曲库选择曲目后，可定位到指定时间。');}
  function loop(){const p=piano(),view=p.view();if(!view.song){note(host,'请选择一首曲目后设置循环区间。');return;}const state=p.loop(),enabled=toggle(host,'启用 A–B 循环',state.enabled,()=>{},'loopEnabled');const a=number(host,'A 起点（秒）',(state.a||0)/1000,0,duration(view.song)/1000,.1,()=>{},'loopA'),b=number(host,'B 终点（秒）',(state.b||duration(view.song))/1000,0,duration(view.song)/1000,.1,()=>{},'loopB');
    const actions=node('div',undefined,'tool-row');button(actions,'应用循环',()=>{const current=requireSong();if(current!==view.song)throw Error('曲目已改变，请重新打开循环设置');const start=Number(a.value)*1000,end=Number(b.value)*1000;if(enabled.checked&&(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>duration(current)||end-start<500))throw Error('循环范围至少 0.5 秒，且应在当前曲目内');p.loop(enabled.checked,start,end);report(enabled.checked?'循环范围已保存':'循环已关闭');},'applyLoop');button(actions,'用当前位置设为 A',()=>{a.value=(p.view().position/1000).toFixed(2);},'loopHere');host.append(actions);
  }
  async function exportMidi(){const song=requireSong(),page=pageEpoch;const Midi=await loadLibraryVendor('midi');if(!live(page))return;const midi=new (Midi||window.Midi)();midi.name=midiText(song.title||'未命名曲目');midi.header.setTempo(clamp(finite(song.bpm,120),1,1000));const track=midi.addTrack();track.name=midi.name;for(const n of song.notes)track.addNote({midi:n.pitch,time:n.start/1000,duration:n.duration/1000,velocity:clamp(finite(n.velocity,85),1,127)/127});const title=String(song.title||'曲目').replace(/[\u0000-\u001f\\/:*?"<>|]/g,'_').trim()||'曲目';download(title+'.mid',midi.toArray(),'audio/midi');report('MIDI 曲谱已生成');}
  function midiMessage(input,lease,event){if(disposed||!dialog.open||portLeases.get(input)!==lease||!midiInputs.has(input.id))return;const bytes=event.data;if(!bytes||bytes.length<3)return;const status=Number(bytes[0]),pitch=Number(bytes[1]),velocity=Number(bytes[2]),kind=status&240,channel=status&15;if(!Number.isInteger(status)||status<128||status>239||!Number.isInteger(pitch)||pitch<0||pitch>127||!Number.isInteger(velocity)||velocity<0||velocity>127)return;
    if(kind===176&&(pitch===120||pitch===123)){releaseMidiNotes(input.id,channel);return;}
    if(kind!==128&&kind!==144)return;const id=input.id+'-'+channel+'-'+pitch,old=midiNotes.get(id);if(kind===128||velocity===0){if(old){midiNotes.delete(id);old.piano.release(old.owner);}return;}
    if(midiChannel!==-1&&channel!==midiChannel)return;const p=piano();if(old){midiNotes.delete(id);old.piano.release(old.owner);}const owner=`tool-midi-${midiRun}-${id}`;const value=midiVelocity?velocity:clamp(finite(p.desktopOptions?.().velocity,85),1,127);midiNotes.set(id,{owner,piano:p,portId:input.id,channel,pitch});try{p.press(owner,pitch,value);}catch(error){midiNotes.delete(id);try{p.release(owner);}catch(_){}report(error);}
  }
  async function connectMidi(input){const run=midiRun,page=pageEpoch,resources=resourceEpoch;if(midiInputs.has(input.id))return;const lease={run,input};portLeases.set(input,lease);
    const audio=piano().audio.unlock();try{await Promise.all([audio,portOperation(input,()=>portLeases.get(input)===lease?input.open():null)]);if(!live(page)||run!==midiRun||resources!==resourceEpoch||portLeases.get(input)!==lease){closePort(input,lease);return;}
      const listener=event=>midiMessage(input,lease,event);let cleanup;if(input.addEventListener){input.addEventListener('midimessage',listener);cleanup=()=>input.removeEventListener('midimessage',listener);}else{const prior=input.onmidimessage;input.onmidimessage=listener;cleanup=()=>{if(input.onmidimessage===listener)input.onmidimessage=prior||null;};}
      midiInputs.set(input.id,{input,lease,cleanup});renderMidiInputs();report('已连接 MIDI：'+(input.name||input.id));
    }catch(error){closePort(input,lease);if(live(page)&&run===midiRun)report(error);}
  }
  function renderMidiInputs(){if(!midiList||!midiAccess||section!=='midi')return;midiList.replaceChildren();const inputs=[...midiAccess.inputs.values()];if(!inputs.length){note(midiList,'当前没有可用的 MIDI 输入，请接入设备后重试。');return;}for(const input of inputs){const connected=midiInputs.has(input.id),item=button(midiList,(input.name||input.id)+(input.state==='disconnected'?' · 已断开':connected?' · 已连接（点击断开）':' · 点击连接'),()=>connected?(disconnectPort(input.id),renderMidiInputs()):connectMidi(input),'midi-input-'+input.id);item.disabled=input.state==='disconnected';}}
  async function requestMidi(){if(midiPending)return;if(midiAccess){renderMidiInputs();return;}if(!window.navigator?.requestMIDIAccess)throw Error('此浏览器不支持外部 MIDI 输入；MIDI 文件导入导出仍可使用');const run=++midiRun,page=pageEpoch,resources=resourceEpoch;midiPending=true;if(midiRequestButton)midiRequestButton.disabled=true;
    try{const access=await window.navigator.requestMIDIAccess({sysex:false});if(!live(page)||run!==midiRun||resources!==resourceEpoch)return;midiAccessCleanup?.();midiAccess=access;
      const changed=event=>{if(access!==midiAccess)return;const input=event.port;if(input?.state==='disconnected')disconnectPort(input.id);renderMidiInputs();};
      if(access.addEventListener){access.addEventListener('statechange',changed);midiAccessCleanup=()=>access.removeEventListener('statechange',changed);}else{const prior=access.onstatechange;access.onstatechange=changed;midiAccessCleanup=()=>{if(access.onstatechange===changed)access.onstatechange=prior||null;};}
      renderMidiInputs();report('请选择一个 MIDI 输入端口连接');
    }finally{if(run===midiRun){midiPending=false;if(midiRequestButton)midiRequestButton.disabled=false;}}
  }
  function midi(){const files=node('div',undefined,'tool-row');button(files,'导入 MIDI / EOP / JSON',()=>handoff(()=>trigger('import')),'import');button(files,'导出当前曲谱 MIDI',exportMidi,'exportMidi');host.append(files);
    select(host,'接收通道',[[-1,'全部通道'],...Array.from({length:16},(_,i)=>[i,'通道 '+(i+1)])],midiChannel,value=>{releaseMidiNotes();midiChannel=Number(value);},'midiChannel');toggle(host,'使用 MIDI 键盘原始力度',midiVelocity,value=>{midiVelocity=value;},'midiVelocity','关闭时使用电脑键盘设置中的固定力度。');
    const actions=node('div',undefined,'tool-row');midiRequestButton=button(actions,'查找外部 MIDI 键盘',requestMidi,'requestMidi');button(actions,'停止连接并释放音符',()=>{stopMidi();report('MIDI 连接已停止');},'stopMidi');host.append(actions);midiList=node('div',undefined,'tool-row');host.append(midiList);note(host,'点击查找后才请求浏览器的 MIDI 访问权限。关闭工具、切换页面或设备断开后停止监听并释放发音。');
  }
  function info(){const song=piano().view().song;if(!song){note(host,'尚未选择曲目。可以直接自由弹奏，也可从左侧曲库选择歌曲。');return;}host.append(node('h3',song.title||'未命名曲目'));for(const text of [song.subtitle,song.author?'作者：'+song.author:'',`${song.notes?.length||0} 个音符 · ${(duration(song)/1000).toFixed(1)} 秒 · ${finite(song.bpm,120)} BPM`,song.category?'分类：'+song.category:''])if(text)note(host,text);button(host,'打开完整简谱 / 五线谱',()=>handoff(openScore),'score');button(host,'查看本曲成绩',()=>open('stats'),'stats');}
  function stats(){const song=piano().view().song;if(!song){note(host,'请选择一首曲目后查看跟弹成绩。');return;}const values=piano().practiceStats(),total=values.correct+values.wrong+values.helped,accuracy=total?Math.round(100*values.correct/total):0;host.append(node('h3',song.title));for(const text of [`正确 ${values.correct} · 错音 ${values.wrong} · 自动补奏 ${values.helped}`,`本次准确率 ${accuracy}% · ${values.completed?'本次已完成':'练习尚未完成'}`,`本曲最佳成绩 ${finite(values.best)}%`])note(host,text);button(host,'刷新成绩',()=>open('stats'),'refreshStats');}
  async function contextTones(parent,filter,page){const surface=piano().surface?.().surface,rows=await toneCatalog();if(!live(page))return;const current=Number(q('#tone')?.value)||0;select(parent,'当前乐器音色',rows.filter(filter).map(r=>[r.id,r.name]),current,value=>{if(surface!==piano().surface?.().surface)throw Error('乐器已切换，请重新打开设置');const id=Number(value),row=rows.find(row=>row.id===id);setTone(id,row?.name);},'instrumentTone');}
  async function surface(){const page=pageEpoch,controller=await workspaces();if(!live(page))return;const state=controller.inspect(),surface=state.surface||'piano',config=controller.configuration?.()||state.configuration||{};
    const apply=values=>{if(controller.inspect().surface!==surface)throw Error('乐器已切换，请重新打开设置');return controller.configure(values);};
    if(['calculator','handheld','music','visualizer'].includes(surface)){
      const {DESKTOP_SCENE_SCHEMA:schema}=await import('./desktop-scenes.js');if(!live(page))return;
      if(surface==='calculator'){select(host,'计算器按键数',[[9,'9 键 · 3 × 3'],[12,'12 键 · 3 × 4'],[16,'16 键 · 4 × 4']],config.calcCount,v=>apply({calcCount:Number(v)}),'calcCount');toggle(host,'使用简谱（1=C）',config.numbered,v=>apply({numbered:v}),'numbered');await contextTones(host,row=>row.id>=16&&row.id<=28,page);}
      if(surface==='handheld'){for(const key of ['shape','game'])select(host,key==='shape'?'掌机外形':'音乐游戏',schema[key].map(o=>[o.value,o.label]),config[key],value=>apply({[key]:Number(value)}),key);select(host,'自由演奏八度',[2,3,4,5,6].map(o=>[o,String(o)]),config.octave,value=>apply({octave:Number(value)}),'octave');button(host,'跟弹与难度',()=>open('practice'),'practice');await contextTones(host,row=>row.id>=162&&row.id<=169,page);}
      if(surface==='music')select(host,'记谱风格',[[0,'流光紫金 · 透视双行'],[1,'正面清晰 · 双行五线谱']],config.musicStyle,value=>apply({musicStyle:Number(value)}),'musicStyle');
      if(surface==='visualizer'){select(host,'光影风格',schema.style.map(o=>[o.value,o.label]),config.style,value=>apply({style:Number(value)}),'style');number(host,'光影浓度（%）',Math.round(config.density*100),25,200,5,value=>apply({density:value/100}),'density');select(host,'可见白键数量',[[14,'14 白键'],[22,'22 白键'],[52,'52 白键 · 完整 88 键']],config.whiteCount,value=>apply({whiteCount:Number(value)}),'stageKeys');number(host,'音域起点（MIDI）',config.firstPitch,0,127,1,value=>apply({firstPitch:Math.round(value)}),'stageFirst');toggle(host,'显示曲目下落音符',config.showNotes,value=>apply({showNotes:value}),'showNotes');}
      if(surface==='music'||surface==='visualizer')toggle(host,'减少动态',config.reducedMotion,value=>apply({reducedMotion:value}),'sceneReduced');
    }else if(surface==='pad'){
      const pad=window.App31Pad;if(!pad?.configure)throw Error('打击垫尚未准备好');const values=pad.inspect().configuration,applyPad=patch=>{if(controller.inspect().surface!=='pad')throw Error('乐器已切换，请重新打开设置');const c={...pad.inspect().configuration,...patch};return pad.configure(c.count,c.percussion,c.effect);};
      select(host,'打击垫格数',[[9,'9 格'],[16,'16 格']],values.count,value=>applyPad({count:Number(value)}),'padCount');toggle(host,'使用电子鼓组',values.percussion,value=>applyPad({percussion:value}),'percussion');select(host,'击打光效',[[0,'轻量击打光环'],[1,'多彩击打'],[2,'星光击打']],values.effect,value=>applyPad({effect:Number(value)}),'effect');button(host,'选择旋律音色',()=>handoff(openTones),'tones');button(host,'载入并演示原创节拍',()=>handoff(()=>pad.demo()),'padDemo');
    }else if(surface==='scope'){
      const scope=window.App31Scope;if(!scope?.configure)throw Error('科学仪器尚未准备好');const values=scope.inspect().configuration,applyScope=patch=>{if(controller.inspect().surface!=='scope')throw Error('乐器已切换，请重新打开设置');const c={...scope.inspect().configuration,...patch};return scope.configure(c.count,c.advanced,c.timebase,c.gain,c.frozen);};
      select(host,'仪器按键数',[[9,'9 键'],[12,'12 键'],[16,'16 键']],values.count,value=>applyScope({count:Number(value)}),'scopeCount');toggle(host,'显示专业旋钮',values.advanced,value=>applyScope({advanced:value}),'advanced');select(host,'波形时间范围',numbered(['1 ms','2 ms','5 ms','10 ms','20 ms','50 ms']),values.timebase,value=>applyScope({timebase:Number(value)}),'timebase');number(host,'显示增益',values.gain,.5,4,.25,value=>applyScope({gain:value}),'gain');toggle(host,'保持当前波形',values.frozen,value=>applyScope({frozen:value}),'frozen');await contextTones(host,row=>[21,22,23,28].includes(row.id),page);
    }else if(surface==='touch'){
      const touch=window.App31Touch;if(!touch?.inspect)throw Error('当前触感乐器尚未准备好');const preset=Number(q('#tone')?.value)||0;if(guitarTone(preset))button(host,'六弦吉他节奏与扫弦',()=>open('guitar'),'guitar');
      if(typeof touch.setOctave==='function')select(host,'自由演奏音域',[[2,'降低两个八度'],[3,'降低一个八度'],[4,'原乐器音域'],[5,'提高一个八度'],[6,'提高两个八度']],touch.inspect().freeOctave||4,value=>touch.setOctave(Number(value)),'touchOctave');
      await contextTones(host,row=>row.delta||[2,6,7,8,9,20,26,27,30,31,32,33].includes(row.id)||row.sampled&&(row.gmProgram===22||row.gmProgram>=24&&row.gmProgram<=79||row.gmProgram>=104&&row.gmProgram<=119),page);
      note(host,'鼠标按住保持音长，拖动可连续换音；电脑键盘按当前乐器格键演奏。');
    }else{button(host,'电脑键盘与音域',()=>open('keyboard'),'keyboard');button(host,'钢琴皮肤与配色',()=>open('appearance'),'appearance');}
    if(!live(page))return;control(host,'simple','轻点自动补足音长');control(host,'preview','显示下一步');button(host,'音色与音量',()=>open('volume'),'volume');button(host,'完整简谱 / 五线谱',()=>{requireSong();return handoff(openScore);},'score');button(host,'录自己的弹奏',()=>handoff(()=>trigger('record')),'record');button(host,'演奏页面视频与音频导出',()=>handoff(()=>trigger('export-entry')),'exports');
  }
  async function guitar(){const p=piano(),state=p.surface?.()||{},preset=Number(q('#tone')?.value);if(state.surface!=='touch'||!guitarTone(preset)){note(host,'请先选择木吉他或采样六弦吉他，再打开节奏与扫弦。');return;}const touch=window.App31Touch;if(!touch?.configure||!touch.action)throw Error('扫弦引擎尚未准备好');const apply=patch=>{if(p.surface?.().surface!=='touch'||Number(q('#tone')?.value)!==preset)throw Error('乐器已切换，请重新打开扫弦设置');const c={...touch.inspect().configuration,...patch};return touch.configure(c.enabled,c.chord,c.pattern,c.bpm,c.measures,c.demonstration);},values=touch.inspect().configuration;
    toggle(host,'显示扫弦练习面板',values.enabled,value=>apply({enabled:value}),'guitarEnabled');select(host,'和弦',numbered(['C','G','Am','F','D','Em']),values.chord,value=>apply({chord:Number(value)}),'guitarChord');select(host,'节奏型',[[0,'八分扫弦'],[1,'切音节奏']],values.pattern,value=>apply({pattern:Number(value)}),'pattern');number(host,'扫弦速度（BPM）',values.bpm,40,160,1,value=>apply({bpm:Math.round(value)}),'guitarBpm');select(host,'练习长度',[1,4,8,16].map(value=>[value,value+' 小节']),values.measures,value=>apply({measures:Number(value)}),'measures');toggle(host,'自动示范',values.demonstration,value=>apply({demonstration:value}),'demonstration');
    const actions=node('div',undefined,'tool-row');button(actions,'开始扫弦练习',async()=>{const page=pageEpoch,resources=resourceEpoch,run=++guitarRun;const preparation=p.audio.prepare([40,45,50,55,59,64]);await Promise.all([preparation,p.engine()]);if(!live(page)||resources!==resourceEpoch||run!==guitarRun)return;apply({enabled:true});touch.action(0);closeDialog();},'guitarStart');button(actions,'暂停',()=>{++guitarRun;touch.action(1);},'guitarPause');button(actions,'从头等待开始',()=>{++guitarRun;touch.action(2);},'guitarReset');button(actions,'退出并返回指板',()=>{++guitarRun;touch.action(1);apply({enabled:false});return open('surface');},'guitarExit');host.append(actions);button(host,'导出扫弦示范视频',()=>handoff(()=>trigger('export-entry')),'guitarExport');note(host,'进入练习后按箭头横向扫过六根弦，切音位置按提示操作；歌曲、模式与音色由主工作台继续管理。');
  }
  async function open(next='main'){
    if(disposed)return;stop();++pageEpoch;section=({width:'keyboard',range:'keyboard',sound:'volume',recordings:'main'})[next]||next;if(!names[section])section='main';feedback=null;metroToggle=metroLabel=midiList=midiRequestButton=null;host.replaceChildren();if(!dialog.open)dialog.showModal?.();
    const title=dialog.querySelector?.('h2');if(title)title.textContent=names[section];if(section!=='main')button(host,'‹ 返回演奏工具',()=>open('main'),'back').className='tools-back';feedback=node('p','','dialog-note');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');host.append(feedback);const token=pageEpoch;
    try{await({main,surface,volume,keyboard,practice,appearance,chords,metronome,midi,loop,progress,info,stats,guitar})[section]();}catch(error){if(live(token))report(error);}return{section};
  }
  function dispose(){if(disposed)return;stop();disposed=true;++pageEpoch;for(const cleanup of cleanups.splice(0))cleanup();host.replaceChildren();}
  function inspect(){return{section,open:!!dialog.open,disposed,chords:chordContacts.size,metronome:{enabled:metronomeEnabled,bpm,beat,pending:!!metronomeTimer},midi:{requestPending:midiPending,access:!!midiAccess,ports:[...midiInputs.keys()],notes:midiNotes.size,channel:midiChannel,velocity:midiVelocity}};}
  return{open,stop,dispose,inspect};
}
