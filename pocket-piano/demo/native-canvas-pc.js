import * as formal from './native-synth.js';
const keys=['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM'];
export function bindCanvasKeyboard(canvas,type,pointer){
 const held=new Map();
 const release=code=>{const p=held.get(code);if(p){pointer(1,p.id,p.x,p.y);held.delete(code);}};
 const down=event=>{if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;const index=keys.indexOf(event.code);if(index<0)return;const bounds=JSON.parse(formal.canvasGeometry(type)).filter(v=>v[2]>v[0]);if(index>=bounds.length)return;event.preventDefault();const r=bounds[index],p={id:10000+index,x:(r[0]+r[2])/2,y:(r[1]+r[3])/2};held.set(event.code,p);pointer(0,p.id,p.x,p.y);};
 const up=event=>{if(held.has(event.code)){event.preventDefault();release(event.code);}};
 const blur=()=>{for(const code of [...held.keys()])release(code);};
 addEventListener('keydown',down);addEventListener('keyup',up);addEventListener('blur',blur);
 canvas.title='电脑按键依次对应各格：1–9、0、Q–P、A–L、Z–M；可同时按，松开释放';
 return()=>{blur();removeEventListener('keydown',down);removeEventListener('keyup',up);removeEventListener('blur',blur);};
}
