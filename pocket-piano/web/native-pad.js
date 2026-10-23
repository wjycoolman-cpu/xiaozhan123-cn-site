import * as formal from './native-synth.js';
import {createDesktopCanvasSurface} from './desktop-canvas-input.js';
let surface=null,lastError='';
const STORAGE_KEY='piano-desktop44-pad',DEFAULT_CONFIGURATION=Object.freeze({count:16,percussion:true,effect:0});
function restoreConfiguration(){try{const raw=globalThis.localStorage?.getItem(STORAGE_KEY);if(!raw||raw.length>1024)return{...DEFAULT_CONFIGURATION};const value=JSON.parse(raw);
 if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===3&&[9,16].includes(value.count)&&typeof value.percussion==='boolean'&&Number.isInteger(value.effect)&&value.effect>=0&&value.effect<=2)return{count:value.count,percussion:value.percussion,effect:value.effect};
 }catch(_){}return{...DEFAULT_CONFIGURATION};}
let configuration=restoreConfiguration();
function saveConfiguration(){try{globalThis.localStorage?.setItem(STORAGE_KEY,JSON.stringify(configuration));}catch(_){}}
function selectPadTone(){const tone=document.querySelector('#tone');if(!tone)return;const value=String(configuration.percussion?29:17),before=tone.value;
 if(!tone.querySelector(`option[value="${value}"]`)){const option=document.createElement('option');option.value=value;option.textContent=configuration.percussion?'电子鼓组':'清脆计算器音';tone.append(option);}
 tone.value=value;if(before!==value)tone.dispatchEvent(new Event('change'));
}
export function drumPadDemoSong(){
 const notes=[],fill=[41,43,45,38];
 for(let step=0;step<32;step++){const start=step*150;notes.push({pitch:step%8===7?46:42,velocity:step%2===0?67:49,start,duration:90});if(step%8===0||step%8===4)notes.push({pitch:36,velocity:90,start,duration:190});if(step%8===2||step%8===6)notes.push({pitch:38,velocity:78,start,duration:140});if(step>=28)notes.push({pitch:fill[step-28],velocity:78,start,duration:140});}
 notes.push({pitch:49,velocity:80,start:4800,duration:700});return{id:'pad-beat-neon119',title:'霓虹节拍',subtitle:'原创打击垫示范 · 电子鼓组',bpm:100,instrumentPreset:29,durationMs:5500,notes};
}
export function openPad(host){
  closePad();formal.padConfigure(configuration.count,configuration.percussion,configuration.effect);selectPadTone();
  if(window.PianoWeb?.audio)window.PianoWeb.audio.sustain=!configuration.percussion&&!!document.querySelector('#sustain')?.checked;
  surface=createDesktopCanvasSurface({host,id:'native-pad-canvas',label:'多彩打击垫，鼠标或电脑按键可同时演奏多个格',type:0,engine:formal,pointer:formal.padPointer,
    draw(context,width,height){const s=window.PianoWeb.view();formal.padDraw(context,width,height,s.mode==='free'?0:s.mode==='auto'?1:2,s.position||0,(s.active||[]).map(n=>n.pitch).join(','),s.speed||1);},
    extra:()=>({configuration:{...configuration}})});
  return surface;
}
export function closePad(){if(surface){lastError=surface.inspect().error;surface.close();surface=null;}}
export function handlePadKey(event,down){return surface?.handleKey(event,down)||false;}
export function releasePadInput(){surface?.releaseInput();}
export function configurePad(count,percussion,effect){
  const changed=configuration.percussion!==!!percussion;configuration={count:Number(count)===9?9:16,percussion:!!percussion,effect:Math.max(0,Math.min(2,Math.round(Number(effect)||0)))};
  surface?.releaseInput();formal.padConfigure(configuration.count,configuration.percussion,configuration.effect);
  saveConfiguration();
  if(changed)selectPadTone();
  if(window.PianoWeb?.audio)window.PianoWeb.audio.sustain=!configuration.percussion&&!!document.querySelector('#sustain')?.checked;surface?.renderNow();
  return {...configuration};
}
window.App31Pad={inspect(){return surface?.inspect()||{open:false,error:lastError,configuration:{...configuration},frames:0,averageFrameMs:0};},configure:configurePad,releaseInput:releasePadInput,
 async demo(){configurePad(16,true,configuration.effect);return window.PianoWeb.playDemoSong(drumPadDemoSong());}};
