import * as formal from './native-synth.js';
import {openPad,closePad} from './native-pad.js';
import {openTouch,closeTouch} from './native-touch.js';
import {openScope,closeScope} from './native-scope.js';
const q=s=>document.querySelector(s);
let surface='piano',frame=null,loadedSong='',generation=0,frameId=0,geometry=null,sceneReady=false,beforePad=null;
const preferredTones={piano:0,calculator:16,handheld:162,visualizer:0,pad:29,touch:30,scope:21};
let calcCount=16,numbered=false,shape=0,game=0,style=0,manualTotal=0,manualTrace='',lastPitch=60,epoch=0,started=false;
const contacts=new Map(),attacks=new Map(),labels=['7','8','9','÷','4','5','6','×','1','2','3','−','0','.','=','+'];
const layoutIds=()=>calcCount===9?[0,1,2,4,5,6,8,9,10]:calcCount===12?[0,1,2,4,5,6,8,9,10,12,13,14]:Array.from({length:16},(_,i)=>i);
const keyFor=p=>surface==='handheld'?formal.handheldKey(p):formal.calculatorKey(p,calcCount);
const symbol=p=>numbered?degree(p):labels[formal.calculatorKey(p,calcCount)];
function degree(p){const d=['1','♯1','2','♯2','3','4','♯4','5','♯5','6','♯6','7'][p%12],o=Math.floor(p/12)-5;return d+(o>0?'̇'.repeat(Math.min(3,o)):'̣'.repeat(Math.min(3,-o)));}
const noteName=p=>['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][p%12]+(Math.floor(p/12)-1);
function release(){for(const id of [...contacts.keys()])up(id);}
function down(pointer,key){if(contacts.has(pointer))return;const s=window.PianoWeb.view(),expected=s.mode==='follow'?s.expected:[],matches=expected.filter(n=>keyFor(n.pitch)===key).sort((a,b)=>a.pitch-b.pitch);
 const pitch=matches[0]?.pitch??(surface==='handheld'?[60,62,64,65,67,69,71,70][key]:formal.calculatorFree(key,calcCount,4));
 if(pitch===undefined||pitch<0)return;const owner='surface-'+pointer;contacts.set(pointer,{key,pitch,owner});attacks.set(key,performance.now());lastPitch=pitch;
 const before=s.groupIndex;window.PianoWeb.press(owner,pitch);const after=window.PianoWeb.view();
 if(s.mode!=='follow'||!s.playing||after.groupIndex!==before){manualTotal++;manualTrace+=String(key);started=true;}
 frame?.contentWindow.HandheldScene?.press({pointer,slot:key,down:true,actualPitch:pitch});update();
}
function up(pointer){const v=contacts.get(pointer);if(!v)return;contacts.delete(pointer);window.PianoWeb.release(v.owner);frame?.contentWindow.HandheldScene?.press({pointer,down:false});update();}
const calcKeys={Digit7:0,Digit8:1,Digit9:2,Slash:3,Digit4:4,Digit5:5,Digit6:6,KeyX:7,Digit1:8,Digit2:9,Digit3:10,Minus:11,Digit0:12,Period:13,Enter:14,Equal:15};
const handheldKeys={ArrowUp:0,ArrowRight:1,ArrowDown:2,ArrowLeft:3,KeyI:4,KeyL:5,KeyK:6,KeyJ:7};
function key(e,on){const k=(surface==='handheld'?handheldKeys:calcKeys)[e.code];if(k===undefined){if(e.code==='Space'&&on&&!e.repeat){e.preventDefault();q('#start').click();}return;}e.preventDefault();if(on&&!e.repeat)down('pc-'+e.code,k);if(!on)up('pc-'+e.code);}
function failed(message){q('#status').textContent=String(message);}
function ready(kind,token,error){if(error)failed(error);else if(token===generation){sceneReady=true;update();}}
window.App31Surfaces={down,up,key,release,ready,update,geometry(value){geometry=value;update();},failed,inspect(){return{surface,generation,geometry,contacts:[...contacts.values()],calcCount,numbered,shape,game,style};}};
function groupAt(s){if(s.mode==='follow')return s.groupIndex;let i=0;while(i+1<s.groups.length&&s.groups[i+1].start<=s.position)i++;return i;}
async function update(){if(!frame?.contentWindow||surface==='piano')return;const s=window.PianoWeb?.view();if(!s?.song)return;const w=frame.contentWindow;
 if(loadedSong!==s.song.id){loadedSong=s.song.id;generation++;epoch++;manualTotal=0;manualTrace='';started=false;sceneReady=false;
  const payload={...s.song,duration:s.song.durationMs,generation,notes:s.song.notes.map((n,i)=>({...n,source:i,staff:n.pitch>=60?0:1})),shape,game,octave:4,staffAssignment:'pitch-split-60'};
  if(surface==='handheld')w.HandheldScene?.load(payload).catch(e=>failed(e.message));
  if(surface==='visualizer')w.MusicScene?.load(payload);
 }
 const index=groupAt(s),current=s.groups[index]?.notes||[],next=s.groups[index+1]?.notes||[],active=s.active.map(n=>n.pitch),mode=s.mode==='free'?0:s.mode==='auto'?1:2;
 if(surface==='calculator'&&w.updateMusic){const ids=layoutIds(),masks=Array(16).fill(0),hold=Array(16).fill(-1),actions=Array(16).fill('');for(const n of (mode===2?s.expected:current)){const k=keyFor(n.pitch);masks[k]|=1;actions[k]='点一下';}if(q('#preview').checked)for(const n of next)masks[keyFor(n.pitch)]|=2;
  const now=performance.now();for(const [k,at]of attacks){if(now-at>500)attacks.delete(k);else hold[k]=Math.max(0,Math.round(100*(1-(now-at)/500)));}
  const sequence=Array.from({length:10},(_,slot)=>{const at=formal.scoreSlot(index,slot,s.groups.length),g=s.groups[at],notes=g?.notes||[],d=Math.max(0,...notes.map(n=>n.duration));return{n:at>=0?at+1:0,key:notes.map(n=>symbol(n.pitch)).join('·'),duration:d?(d/1000/s.speed).toFixed(2)+'秒':'',current:at===index,done:at>=0&&at<index,hold:at===index&&mode===1?Math.min(1,Math.max(0,(s.position-g.start)/Math.max(1,d))):-1,flag:at===index?(mode===1?'弹奏':'点按'):at<index?'完成':notes.length>1?'同按':at>0&&notes.some(n=>(s.groups[at-1]?.notes||[]).some(previous=>keyFor(previous.pitch)===keyFor(n.pitch)))?'再按':'',chord:notes.length>1};});
  const held=[...contacts.values()].reduce((m,v)=>m|(1<<v.key),0)|(mode===1?active.reduce((m,p)=>m|(1<<keyFor(p)),0):0);
  w.updateMusic({layoutKeys:ids,columns:calcCount===16?4:3,rows:calcCount===9?3:4,numbered,chromeExpanded:!document.body.classList.contains('chrome-collapsed'),exporting:false,mediaFrame:false,battery:-1,charging:false,outputLevel:active.length?.1:0,tapDuration:q('#simple').checked,held,target:mode===2?s.expected.reduce((m,n)=>m|(1<<keyFor(n.pitch)),0):0,sequenceMasks:masks,keyActions:actions,hold,sequence,heading:mode===0?'自由弹奏':(numbered?'简谱 · 1=C':'按键谱')+(mode===1?' · 自动':''),song:s.song.title,mode,label:current[0]?symbol(current[0].pitch):'♪',pitch:current[0]?noteName(current[0].pitch):'',caption:'点一下亮键 · 音长自动补足',holdProgress:-1,page:formal.scorePageLabel(index,s.groups.length),preview:next.map(n=>symbol(n.pitch)).join(' '),flowCurrent:current[0]?keyFor(current[0].pitch):-1,flowNext:next[0]?keyFor(next[0].pitch):-1});
 }else if(surface==='handheld'&&w.HandheldScene&&sceneReady){started||=s.playing||s.position>0;await w.HandheldScene.frame({frameId:++frameId,generation,ms:s.position,playing:s.playing||!!document.body.dataset.exporting,exporting:!!document.body.dataset.exporting,mode,localVisualAnimation:true,captureVisualBarrier:!!document.body.dataset.exporting,started:mode===0||started,waiting:mode!==0&&!started,current:(mode===2?s.expected:current).map(n=>n.pitch),next:next.map(n=>n.pitch),active,previewCount:2,tapDurationMode:q('#simple').checked,manual:{epoch,total:manualTotal,lastPitch,counts:Array(8).fill(0),motionMs:s.position,lastAttackMs:s.position,trace:manualTrace},speed:s.speed,busy:false}).catch(e=>failed(e.message));
 }else if(surface==='visualizer'&&w.MusicScene&&sceneReady)await w.MusicScene.frame({frameId:++frameId,ms:s.position,playing:s.playing||!!document.body.dataset.exporting,energy:active.length?.15:0,style,reducedMotion:false,exporting:!!document.body.dataset.exporting,captureVisualBarrier:!!document.body.dataset.exporting});
}
export async function setSurface(name,preset=null){window.PianoWeb.pause();release();closePad();closeTouch();closeScope();const prior=surface;preferredTones[surface]=Number(q('#tone').value);if(preset!==null)preferredTones[name]=preset;surface=name;loadedSong='';geometry=null;sceneReady=false;document.body.dataset.surface=name;q('#surface-entry').textContent=({piano:'钢琴',calculator:'计算器',handheld:'掌机',visualizer:'可视化',pad:'打击垫',touch:'乐器',scope:'仪器'})[name]+' ▾';
 q('.performance').hidden=name!=='piano';q('.keyboard-shell').hidden=name!=='piano';
 if(frame){frame.remove();frame=null;}if(name==='pad')openPad();else if(name==='touch')openTouch();else if(name==='scope')openScope();else if(name!=='piano'){frame=document.createElement('iframe');frame.id='native-surface-frame';frame.title=({calculator:'音乐计算器',handheld:'音乐掌机',visualizer:'音乐可视化'})[name];frame.src='assets/native/'+({calculator:'calculator/mechanical.html',handheld:'handheld-model/renderer.html',visualizer:'music-visualizer/scene.html'})[name];frame.onload=()=>{loadedSong='';update();};q('.instrument').append(frame);}q('#tone').value=String(preferredTones[name]);q('#tone').dispatchEvent(new Event('change'));
 PianoWeb.audio.sustain=!['handheld','touch'].includes(name)&&(name!=='pad'||!App31Pad.inspect().configuration.percussion)&&q('#sustain').checked;
 if(name==='pad'&&prior!=='pad'&&App31Pad.inspect().configuration.percussion){const s=PianoWeb.view();beforePad={song:s.song.id,mode:s.mode};await PianoWeb.selectSong('pad-beat-neon119');q('#mode').value='free';q('#mode').dispatchEvent(new Event('change'));}
 else if(prior==='pad'&&beforePad){await PianoWeb.selectSong(beforePad.song);q('#mode').value=beforePad.mode;q('#mode').dispatchEvent(new Event('change'));}
 if(name==='visualizer'||name==='handheld'){q('#mode').value=name==='visualizer'?'auto':'follow';q('#mode').dispatchEvent(new Event('change'));}
 q('#range-entry').hidden=name!=='piano';q('#mode-entry').textContent=({free:'自由',auto:'自动',follow:'跟弹'})[q('#mode').value]+' ▾';q('#score').textContent=name==='piano'?'简谱':'谱面';
 PianoWeb.syncKeyboard();
}
export function settings(){return{configureCalculator(count,showNumbered){release();calcCount=count;numbered=showNumbered;update();},configureHandheld(nextShape,nextGame){release();shape=nextShape;game=nextGame;loadedSong='';update();},configureVisualizer(nextStyle){style=nextStyle;update();}};}
addEventListener('keydown',e=>{if(!['piano','pad','touch','scope'].includes(surface)&&!document.querySelector('dialog[open]')&&!e.target.matches('input,select,textarea'))key(e,true);});addEventListener('keyup',e=>{if(!['piano','pad','touch','scope'].includes(surface))key(e,false);});
setInterval(update,50);
