import * as formal from './native-synth.js';
import {createDesktopCanvasSurface} from './desktop-canvas-input.js';
let surface=null,sequence=-1,lastError='';
const STORAGE_KEY='piano-desktop44-scope',DEFAULT_CONFIGURATION=Object.freeze({count:9,advanced:false,timebase:3,gain:1,frozen:false});
function restoreConfiguration(){try{const raw=globalThis.localStorage?.getItem(STORAGE_KEY);if(!raw||raw.length>1024)return{...DEFAULT_CONFIGURATION};const value=JSON.parse(raw);
 if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===5&&[9,12,16].includes(value.count)&&typeof value.advanced==='boolean'&&Number.isInteger(value.timebase)&&value.timebase>=0&&value.timebase<=5&&typeof value.gain==='number'&&Number.isFinite(value.gain)&&value.gain>=.5&&value.gain<=4&&typeof value.frozen==='boolean')return{count:value.count,advanced:value.advanced,timebase:value.timebase,gain:value.gain,frozen:value.frozen};
 }catch(_){}return{...DEFAULT_CONFIGURATION};}
let configuration=restoreConfiguration();
function saveConfiguration(){try{globalThis.localStorage?.setItem(STORAGE_KEY,JSON.stringify(configuration));}catch(_){}}
export function openScope(host){
 closeScope();sequence=-1;formal.scopeConfigure(configuration.count,configuration.advanced,configuration.timebase,configuration.gain,configuration.frozen);
 surface=createDesktopCanvasSurface({host,id:'native-scope-canvas',label:'科学仪器，电脑1至9演奏按键与正式声音波形',type:2,engine:formal,pointer:formal.scopePointer,
   draw(context,width,height){const s=window.PianoWeb.view(),audio=window.PianoWeb.audio;
     if(audio.pcm&&sequence!==audio.pcmSequence){sequence=audio.pcmSequence;formal.scopePcm(audio.pcm);}
     formal.scopeDraw(context,width,height,Number(document.querySelector('#tone')?.value)||0,s.mode==='free'?0:s.mode==='auto'?1:2,s.position||0,(s.active||[]).map(n=>n.pitch).join(','),s.speed||1,audio.volume);},
   extra:()=>({configuration:{...configuration},pcmSequence:sequence})});return surface;
}
export function closeScope(){if(surface){lastError=surface.inspect().error;surface.close();surface=null;}}
export function handleScopeKey(event,down){return surface?.handleKey(event,down)||false;}
export function releaseScopeInput(){surface?.releaseInput();}
export function configureScope(count,advanced,timebase,gain,frozen){
 configuration={count:[9,12,16].includes(Number(count))?Number(count):9,advanced:!!advanced,timebase:Math.max(0,Math.min(5,Math.round(Number(timebase)||0))),gain:Math.max(.5,Math.min(4,Number(gain)||1)),frozen:!!frozen};
 surface?.releaseInput();formal.scopeConfigure(configuration.count,configuration.advanced,configuration.timebase,configuration.gain,configuration.frozen);saveConfiguration();surface?.renderNow();return {...configuration};
}
window.App31Scope={inspect(){return surface?.inspect()||{open:false,error:lastError,configuration:{...configuration},pcmSequence:sequence};},configure:configureScope,releaseInput:releaseScopeInput};
