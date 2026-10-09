/** The only slot/symbol/pitch-class source consumed by real button labels, game prompts and input. */
export const KEYS=Object.freeze([
 {slot:0,symbol:'↑',side:'left',direction:'up',free:0},
 {slot:1,symbol:'←',side:'left',direction:'left',free:2},
 {slot:2,symbol:'→',side:'left',direction:'right',free:4},
 {slot:3,symbol:'↓',side:'left',direction:'down',free:5},
 {slot:4,symbol:'△',side:'right',direction:'up',free:7},
 {slot:5,symbol:'□',side:'right',direction:'left',free:9},
 {slot:6,symbol:'○',side:'right',direction:'right',free:11},
 {slot:7,symbol:'×',side:'right',direction:'down',free:10},
]);
const FOR_CLASS=[0,0,1,1,2,3,3,4,4,5,7,6];
export const keyForPitch=p=>Number.isInteger(p)&&p>=0&&p<=127?FOR_CLASS[p%12]:-1;
export function resolvePitch(slot,expected=[],octave=4){
 if(!KEYS[slot])return -1;const free=Math.min(127,(Math.max(1,Math.min(7,octave))+1)*12+KEYS[slot].free);
 return expected.filter(p=>keyForPitch(p)===slot).sort((a,b)=>Math.abs(a-free)-Math.abs(b-free)||a-b)[0]??free;
}
export function drawSymbol(ctx,slot,x,y,size,color='#eef3fa'){
 const key=KEYS[slot];if(!key)return;const a=size*.38;ctx.save();ctx.translate(x,y);ctx.strokeStyle=color;ctx.lineWidth=size*.10;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
 if(slot<4){const dx=slot===1?-1:slot===2?1:0,dy=slot===0?-1:slot===3?1:0;
  ctx.moveTo(-dx*a,-dy*a);ctx.lineTo(dx*a,dy*a);ctx.moveTo(dx*a-dx*a*.6-dy*a*.6,dy*a-dy*a*.6+dx*a*.6);ctx.lineTo(dx*a,dy*a);ctx.lineTo(dx*a-dx*a*.6+dy*a*.6,dy*a-dy*a*.6-dx*a*.6);
 }else if(slot===4){ctx.moveTo(0,-a);ctx.lineTo(a,a);ctx.lineTo(-a,a);ctx.closePath();}
 else if(slot===5)ctx.rect(-a,-a,a*2,a*2);else if(slot===6)ctx.arc(0,0,a,0,Math.PI*2);
 else{ctx.moveTo(-a,-a);ctx.lineTo(a,a);ctx.moveTo(-a,a);ctx.lineTo(a,-a);}
 ctx.stroke();ctx.restore();
}
