/* Each score window owns this dedicated Worker and therefore its own formal
 * module state. It never imports or changes window.PianoWeb / the main Guide. */
import * as formal from './native-synth.js';
const workerScope=typeof document==='undefined'&&typeof self!=='undefined';
let measuringContext=null;
function measurementContext(){
 if(measuringContext)return measuringContext;
 if(typeof OffscreenCanvas!=='function')throw Error('此浏览器缺少独立简谱所需的 OffscreenCanvas，请使用新版桌面浏览器');
 const context=new OffscreenCanvas(1,1).getContext('2d');if(!context)throw Error('浏览器未提供独立简谱文字测量');return measuringContext=context;
}
/* The compiled numbered-score painter only needs document.createElement for
 * measureText. In this isolated Worker, bridge that one operation to the real
 * OffscreenCanvas API; no DOM, rasterization, or main Guide is involved. Never
 * substitute guessed glyph widths when the browser lacks that API. */
if(workerScope)Object.defineProperty(globalThis,'document',{value:Object.freeze({createElement(tag){
 if(tag!=='canvas')throw Error('独立排版仅提供 Canvas 文字测量');const context=measurementContext();
 return{getContext(type){if(type!=='2d')return null;return{set font(value){context.font=String(value).replace(/ScoreSC/g,'sans-serif');},get font(){return context.font;},measureText(value){return context.measureText(value);}};}};
}})});
let currentDocument=null;
export function validateScoreSong(song){
 if(!song||!Array.isArray(song.notes)||!song.notes.length||song.notes.length>100000)throw Error('没有可用曲谱，音符数需为 1–100000');
 const bpm=song.bpm===undefined?120:song.bpm;if(!Number.isInteger(bpm)||bpm<1||bpm>1000)throw Error('曲谱速度无效');
 const notes=song.notes.map(n=>{const velocity=n.velocity===undefined?85:n.velocity;if(!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127||!Number.isInteger(velocity)||velocity<1||velocity>127||!Number.isFinite(n.start)||n.start<0||!Number.isFinite(n.duration)||n.duration<1||n.start+n.duration>1800000)throw Error('曲谱音符无效');return{pitch:n.pitch,velocity,start:Math.round(n.start),duration:Math.round(n.duration)};}).sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
 return{id:String(song.id||'local-score').slice(0,200),title:String(song.title||'完整曲谱').slice(0,160),subtitle:String(song.subtitle||'').slice(0,200),bpm,notes};
}
export function handleScoreRequest(request){
 const {id,documentId,command}=request||{};
 try{
  if(!Number.isInteger(id)||!Number.isInteger(documentId))throw Error('曲谱请求无效');
  if(command==='prepare'){
   const song=validateScoreSong(request.song);formal.loadSong(JSON.stringify(song));formal.scorePrepare();currentDocument=documentId;
   return{id,documentId,type:'prepared',title:song.title,noteCount:song.notes.length,pages:[formal.scorePages(0),formal.scorePages(1)],notice:'演奏数据自动排谱；拍号、调号、时值量化与声部分配为排版推定，非原版出版谱。'};
  }
  if(documentId!==currentDocument)throw Error('曲谱已更换，请使用当前曲目');
  const style=request.style;if(command!=='page'||![0,1].includes(style)||!Number.isInteger(request.page))throw Error('曲谱页面请求无效');
  const count=formal.scorePages(style),page=request.page;if(page<0||page>=count)throw Error('曲谱页码超出范围');
  if(style===0&&workerScope)measurementContext(); // keep unsupported-API errors outside the compiled Java exception wrapper
  return{id,documentId,type:'page',style,page,count,...(style===0?{svg:formal.scoreNumbered(page)}:{staff:JSON.parse(formal.scoreStaff(page,documentId))})};
 }catch(error){return{id,documentId,type:'error',error:String(error?.message||error).slice(0,300)};}
}
if(workerScope)self.onmessage=event=>self.postMessage(handleScoreRequest(event.data));
