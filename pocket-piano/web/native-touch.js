import {bindCanvasKeyboard} from './native-canvas-pc.js';
let unbindPc=null;
import * as formal from './native-synth.js';
// Apply the original Android 4x5 ColorMatrix once per wood image/filter.
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
let canvas=null,loop=0,error='',frameTimes=[],last=0;
export function openTouch(){closeTouch();canvas=document.createElement('canvas');canvas.id='native-touch-canvas';canvas.setAttribute('aria-label','乐器演奏与固定音域，可同时按多个位置');document.querySelector('.instrument').append(canvas);unbindPc=bindCanvasKeyboard(canvas,1,formal.touchPointer);
 const activePointers=new Set();
 const input=(e,action)=>{e.preventDefault();const r=canvas.getBoundingClientRect();formal.touchPointer(action,e.pointerId,e.clientX-r.left,e.clientY-r.top);};canvas.onpointerdown=e=>{activePointers.add(e.pointerId);canvas.setPointerCapture(e.pointerId);input(e,0);};canvas.onpointermove=e=>{if(canvas.hasPointerCapture(e.pointerId))input(e,2);};canvas.onpointerup=e=>{if(!activePointers.delete(e.pointerId))return;input(e,1);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};canvas.onpointercancel=e=>{activePointers.clear();input(e,3);};canvas.onlostpointercapture=e=>{if(activePointers.delete(e.pointerId))input(e,1);};
 const draw=at=>{if(!canvas)return;try{const r=canvas.getBoundingClientRect(),d=devicePixelRatio;if(canvas.width!==Math.round(r.width*d)||canvas.height!==Math.round(r.height*d)){canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);}const c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);const s=PianoWeb.view();formal.touchDraw(c,Math.round(r.width),Math.round(r.height),Number(document.querySelector('#tone').value),s.mode==='free'?0:s.mode==='auto'?1:2,s.position,s.active.map(n=>n.pitch).join(','),s.speed);if(last)frameTimes.push(at-last);last=at;if(frameTimes.length>120)frameTimes.shift();loop=requestAnimationFrame(draw);}catch(e){error=e.message;document.querySelector('#status').textContent=e.message;}};loop=requestAnimationFrame(draw);
 window.App31Textures||={};const path='assets/native/guitar/wood_table_001_diff_1k.jpg';if(!App31Textures[path]){const img=new Image();img.onload=()=>{App31Textures[path]=img;};img.onerror=()=>{error='原吉他木纹资源加载失败';};img.src=path;}
}
export function closeTouch(){unbindPc?.();unbindPc=null;cancelAnimationFrame(loop);if(canvas){formal.guitarAction(1);formal.touchPointer(3,0,0,0);canvas.remove();canvas=null;}last=0;}
window.App31Touch={inspect(){return{open:!!canvas,error,frames:frameTimes.length,averageFrameMs:frameTimes.reduce((a,b)=>a+b,0)/Math.max(1,frameTimes.length)};}};
