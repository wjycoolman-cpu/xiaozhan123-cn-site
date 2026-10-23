import * as formal from './native-synth.js';
import {createDesktopCanvasSurface} from './desktop-canvas-input.js';
const STORAGE_KEY='piano-desktop44-touch',DEFAULT_CONFIGURATION=Object.freeze({enabled:false,chord:0,pattern:0,bpm:60,measures:8,demonstration:false,freeOctave:4});
function restoreConfiguration(){try{const raw=globalThis.localStorage?.getItem(STORAGE_KEY);if(!raw||raw.length>1024)return{...DEFAULT_CONFIGURATION};const value=JSON.parse(raw);
 if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===7&&typeof value.enabled==='boolean'&&Number.isInteger(value.chord)&&value.chord>=0&&value.chord<=5&&[0,1].includes(value.pattern)&&Number.isInteger(value.bpm)&&value.bpm>=40&&value.bpm<=160&&Number.isInteger(value.measures)&&value.measures>=1&&value.measures<=16&&typeof value.demonstration==='boolean'&&Number.isInteger(value.freeOctave)&&value.freeOctave>=2&&value.freeOctave<=6)return{enabled:value.enabled,chord:value.chord,pattern:value.pattern,bpm:value.bpm,measures:value.measures,demonstration:value.demonstration,freeOctave:value.freeOctave};
 }catch(_){}return{...DEFAULT_CONFIGURATION};}
const{freeOctave:initialFreeOctave,...initialConfiguration}=restoreConfiguration();
// Preserve the original Android ColorMatrix transformation and resource key.
const tintedTextures=new Map();
window.App31TintTexture=(image,matrix)=>{
 if(!matrix||matrix.length!==20)return image;
 const key=image.src+'|'+Array.from(matrix).join(',');
 if(tintedTextures.has(key))return tintedTextures.get(key);
 const result=document.createElement('canvas');result.width=image.naturalWidth;result.height=image.naturalHeight;
 const context=result.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
 const pixels=context.getImageData(0,0,result.width,result.height),data=pixels.data;
 for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];for(let row=0;row<4;row++){const offset=row*5;data[i+row]=matrix[offset]*r+matrix[offset+1]*g+matrix[offset+2]*b+matrix[offset+3]*a+matrix[offset+4];}}
 context.putImageData(pixels,0,0);tintedTextures.set(key,result);return result;
};
const TEXTURE_KEY='assets/native/guitar/wood_table_001_diff_1k.jpg';
export const GUITAR_TEXTURE_URL=new URL('../demo/'+TEXTURE_KEY,import.meta.url).href;
let surface=null,lastError='',textureImage=null,freeOctave=initialFreeOctave;
// Direct port of phone TouchInstrumentProfile and DeltaHarmonicaPainter. The
// source image is byte-identical; only its transparent padding is cropped.
export const DELTA_BODY_URL=new URL('./assets/delta-harmonica/body.png',import.meta.url).href;
export const DELTA_BODY_CROP=Object.freeze({x:11,y:131,width:2137,height:466});
const DELTA_PITCHES=[72,74,76,77,79,81,83,84];
const deltaContacts=new Map(),touchRoutes=new Map(),deltaLevels=new Float32Array(8);let lastDeltaAt=0;
let deltaKeys=[],deltaBody=null,pendingBody=null,lastPreset=-1;
const isDelta=()=>{const preset=Number(document.querySelector('#tone')?.value);return preset>=170&&preset<=175;};
const isGuitarFamily=()=>{const preset=Number(document.querySelector('#tone')?.value);return preset===6||preset>=58&&preset<=73;};
function deltaKeyForPitch(pitch){
 let selected=-1,distance=Infinity;
 for(let i=0;i<8;i++)if(DELTA_PITCHES[i]%12===pitch%12){const next=Math.abs(DELTA_PITCHES[i]-pitch);if(next<distance){distance=next;selected=i;}}
 if(selected<0)for(let i=0;i<8;i++){const next=Math.abs(DELTA_PITCHES[i]-pitch);if(next<distance){distance=next;selected=i;}}return selected;
}
function deltaPitch(key){
 const view=window.PianoWeb.view();let selected=-1,distance=Infinity;
 for(const note of view.mode==='follow'?(view.expected||[]):[]){const pitch=note.pitch;if(deltaKeyForPitch(pitch)!==key)continue;const next=Math.abs(DELTA_PITCHES[key]-pitch);if(next<distance||next===distance&&pitch<selected){distance=next;selected=pitch;}}
 return selected>=0?selected:DELTA_PITCHES[key];
}
function releaseDelta(id){const contact=deltaContacts.get(id);if(!contact)return;window.PianoWeb.release('touch-delta-'+id);deltaContacts.delete(id);}
function deltaPointer(action,id,x,y){
 if(action===3){for(const id of [...deltaContacts.keys()])releaseDelta(id);return;}
 if(action===1){releaseDelta(id);return;}
 const key=deltaKeys.findIndex(r=>x>=r[0]&&x<r[2]&&y>=r[1]&&y<r[3]);const previous=deltaContacts.get(id);
 if(previous?.key===key)return;if(previous)releaseDelta(id);if(key<0)return;
 const pitch=deltaPitch(key);deltaLevels[key]=1;deltaContacts.set(id,{key,pitch});window.PianoWeb.press('touch-delta-'+id,pitch);
}
function instrumentPointer(action,id,x,y){
 if(action===3){deltaPointer(3,id,x,y);formal.touchPointer(3,id,x,y);touchRoutes.clear();return;}
 if(action===0)touchRoutes.set(id,isDelta());const delta=touchRoutes.get(id)??isDelta();
 if(delta)deltaPointer(action,id,x,y);else formal.touchPointer(action,id,x,y);if(action===1)touchRoutes.delete(id);
}
function loadDeltaBody(){
 if(deltaBody||pendingBody)return;const current=surface,image=new Image();pendingBody=image;
 image.onload=()=>{if(surface!==current||!current.inspect().open)return;deltaBody=image;pendingBody=null;image.onload=image.onerror=null;current.renderNow();};
 image.onerror=()=>{lastError='原游戏口琴资源加载失败';pendingBody=null;image.onload=image.onerror=null;};image.src=DELTA_BODY_URL;
}
function drawDelta(context,width,height,view){
 const now=performance.now(),elapsed=lastDeltaAt?Math.max(0,now-lastDeltaAt):0;lastDeltaAt=now;for(let i=0;i<8;i++)deltaLevels[i]*=Math.exp(-elapsed/110);context.textBaseline='alphabetic';
 const d=Math.max(.8,Math.min(1.4,Math.min(width/760,height/360))),left=14*d,top=42*d,right=width-14*d,bottom=height-14*d;
 const keyHeight=Math.min(64*d,Math.max(48*d,(bottom-top)*.42)),keyTop=bottom-6*d-keyHeight,keyLeft=left+6*d,keyWidth=(right-left-12*d)/8;
 deltaKeys=Array.from({length:8},(_,i)=>[keyLeft+i*keyWidth,keyTop,keyLeft+(i+1)*keyWidth,keyTop+keyHeight]);
 const rounded=(x,y,w,h,r,fill)=>{context.fillStyle=fill;context.beginPath();context.roundRect(x,y,w,h,r);context.fill();};
 context.clearRect(0,0,width,height);rounded(0,0,width,height,0,'#111a19');context.font=`${12*d}px sans-serif`;context.textAlign='left';context.fillStyle='#e8e9e2';context.fillText('游戏口琴 · 八个数字键',left,24*d);context.font=`${10*d}px sans-serif`;context.textAlign='right';context.fillStyle='#b9c6ba';context.fillText('1–8 / 小键盘 1–8 · 按住保持，松手收音',right,24*d);rounded(left,top,right-left,bottom-top,16*d,'#171e19');
 const inset=Math.min(12*d,(right-left)*.035),bodyLeft=left+inset,bodyRight=right-inset,bodyTop=top+8*d,bodyBottom=keyTop-10*d,aspect=DELTA_BODY_CROP.width/DELTA_BODY_CROP.height;
 if(bodyRight>bodyLeft&&bodyBottom>bodyTop){const bodyWidth=Math.min(bodyRight-bodyLeft,(bodyBottom-bodyTop)*aspect),bodyHeight=bodyWidth/aspect,x=(bodyLeft+bodyRight-bodyWidth)/2,y=(bodyTop+bodyBottom-bodyHeight)/2;
  if(deltaBody)context.drawImage(deltaBody,DELTA_BODY_CROP.x,DELTA_BODY_CROP.y,DELTA_BODY_CROP.width,DELTA_BODY_CROP.height,x,y,bodyWidth,bodyHeight);else rounded(x,y,bodyWidth,bodyHeight,6*d,'#313a33');}
 const current=view.mode==='follow'?(view.expected||[]):view.mode==='auto'?(view.active||[]):[];
 const next=document.querySelector('#preview')?.checked===false?[]:(view.groups?.[view.groupIndex+1]?.notes||[]);
 const currentKeys=new Set(current.map(n=>deltaKeyForPitch(n.pitch))),nextKeys=new Set(next.map(n=>deltaKeyForPitch(n.pitch)));
 function number(i,x,baseline,size){context.font=`${size}px sans-serif`;context.textAlign='center';context.fillText(i===7?'1':String(i+1),x,baseline);if(i===7){context.beginPath();context.arc(x,baseline-(context.measureText(i===7?'1':String(i+1)).actualBoundingBoxAscent||size*.75)-Math.max(2*d,size*.121),Math.max(.85*d,size*.055),0,Math.PI*2);context.fill();}}
 for(let i=0;i<8;i++){const k=deltaKeys[i],gap=Math.min(2.5*d,keyWidth*.06),cx=(k[0]+k[2])/2,pressed=[...deltaContacts.values()].some(v=>v.key===i),current=pressed||currentKeys.has(i),mask=currentKeys.has(i)?1:nextKeys.has(i)?2:0;
  if(current||deltaLevels[i]>.02){const alpha=current?(pressed?86:52):Math.round(32*deltaLevels[i]);context.fillStyle=`rgba(226,228,220,${alpha/255})`;context.fillRect(k[0]+gap,k[1],keyWidth-gap*2,keyHeight);}
  const band=Math.min(16*d,Math.max(0,keyHeight-50*d));if(band>=13*d){context.fillStyle='#e8e9e2';number(i,cx,k[1]+band-d,12*d);}
  const capHeight=keyHeight-band,capWidth=Math.min(keyWidth-gap*2,capHeight*1.14),capX=cx-capWidth/2,capY=k[1]+band,shift=pressed?1.5*d:0;
  rounded(capX,capY,capWidth,capHeight,2*d,'#9ba398');rounded(capX,capY+shift,capWidth,capHeight-.5*d-shift,2*d,pressed?'#d9ddd4':current?'#fafbf4':'#e8ebe2');
  context.strokeStyle=pressed?'#b8beb4':'#f5f6ef';context.lineWidth=.7*d;context.beginPath();context.moveTo(capX+d,capY+shift+d);context.lineTo(capX+capWidth-d,capY+shift+d);context.stroke();context.fillStyle='#30362f';const size=Math.min(26*d,capWidth*.55,capHeight*.55);context.font=`${size}px sans-serif`;const metrics=context.measureText(i===7?'1':String(i+1)),ascent=metrics.actualBoundingBoxAscent||size*.75,descent=metrics.actualBoundingBoxDescent||size*.2;number(i,cx,capY+capHeight/2+(ascent-descent)/2+d,size);
  if(!current&&mask){context.strokeStyle='#b7bcb399';context.lineWidth=d;context.strokeRect(k[0]+gap+d*.5,k[1]+d*.5,keyWidth-gap*2-d,keyHeight-d);}
 }
}

let configuration=initialConfiguration;
function saveConfiguration(){try{globalThis.localStorage?.setItem(STORAGE_KEY,JSON.stringify({...configuration,freeOctave}));}catch(_){}}
export function openTouch(host){
 closeTouch();lastError='';formal.guitarConfigure(configuration.enabled,configuration.chord,configuration.pattern,configuration.bpm,configuration.measures,configuration.demonstration);
 surface=createDesktopCanvasSurface({host,id:'native-touch-canvas',label:'乐器按弦、吹吸音孔与音条，支持鼠标和电脑键盘',type:1,engine:formal,pointer:instrumentPointer,geometry:()=>isDelta()?deltaKeys:JSON.parse(formal.canvasGeometry(1)),
   onRelease:()=>formal.guitarAction(1),
   onClose:()=>{if(textureImage){textureImage.onload=textureImage.onerror=null;textureImage=null;}if(pendingBody){pendingBody.onload=pendingBody.onerror=null;pendingBody=null;}},
   draw(context,width,height){const s=window.PianoWeb.view(),preset=Number(document.querySelector('#tone')?.value)||0;if(lastPreset!==preset){surface?.releaseInput();lastPreset=preset;}if(isDelta()){drawDelta(context,width,height,s);return;}formal.touchDraw(context,width,height,Number(document.querySelector('#tone')?.value)||0,s.mode==='free'?0:s.mode==='auto'?1:2,s.position||0,(s.active||[]).map(n=>n.pitch).join(','),s.speed||1);},
   extra:()=>({configuration:{...configuration},guitarEnabled:isGuitarFamily()&&!!formal.guitarEnabled(),guitarRunning:isGuitarFamily()&&!!formal.guitarRunning()})});
 if(isDelta()){loadDeltaBody();return surface;}
 window.App31Textures||={};if(!window.App31Textures[TEXTURE_KEY]){
   const current=surface,image=new Image();textureImage=image;
   image.onload=()=>{if(surface!==current)return;window.App31Textures[TEXTURE_KEY]=image;image.onload=image.onerror=null;textureImage=null;current.renderNow();};
   image.onerror=()=>{if(surface===current)lastError='原吉他木纹资源加载失败';image.onload=image.onerror=null;textureImage=null;};image.src=GUITAR_TEXTURE_URL;
 }
 return surface;
}
export function closeTouch(){if(textureImage){textureImage.onload=textureImage.onerror=null;textureImage=null;}if(pendingBody){pendingBody.onload=pendingBody.onerror=null;pendingBody=null;}if(surface){lastError=surface.inspect().error||lastError;surface.close();surface=null;}formal.guitarAction(1);}
export function handleTouchKey(event,down){return surface?.handleKey(event,down)||false;}
export function releaseTouchInput(){surface?.releaseInput();formal.guitarAction(1);}
export function configureTouch(enabled,chord,pattern,bpm,measures,demonstration){
 configuration={enabled:!!enabled,chord:Math.max(0,Math.min(5,Math.round(Number(chord)||0))),pattern:Number(pattern)===1?1:0,
   bpm:Math.max(40,Math.min(160,Math.round(Number(bpm)||60))),measures:Math.max(1,Math.min(16,Math.round(Number(measures)||8))),demonstration:!!demonstration};
 surface?.releaseInput();formal.guitarConfigure(configuration.enabled,configuration.chord,configuration.pattern,configuration.bpm,configuration.measures,configuration.demonstration);saveConfiguration();surface?.renderNow();return {...configuration};
}
window.App31Touch={inspect(){const s=surface?.inspect()||{open:false,error:lastError,frames:0,averageFrameMs:0};return{...s,error:s.error||lastError,freeOctave,configuration:{...configuration},guitarEnabled:isGuitarFamily()&&!!formal.guitarEnabled(),guitarRunning:isGuitarFamily()&&!!formal.guitarRunning()};},
 setOctave(value){freeOctave=Math.max(2,Math.min(6,Math.round(Number(value)||4)));releaseTouchInput();saveConfiguration();return freeOctave;},
 configure:configureTouch,action:action=>isGuitarFamily()?formal.guitarAction(action):false,guitarEnabled:()=>isGuitarFamily()&&formal.guitarEnabled(),guitarRunning:()=>isGuitarFamily()&&formal.guitarRunning(),guitarStep:formal.guitarStep,guitarSong:formal.guitarSong,releaseInput:releaseTouchInput};
