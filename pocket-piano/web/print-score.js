import {cleanScoreSVG} from './full-score/svg.js';
export class PrintScoreReceiver{
 constructor({document=globalThis.document,opener=globalThis.opener,origin=location.origin,job=new URL(location.href).searchParams.get('job'),print=()=>globalThis.print(),FontFace=globalThis.FontFace,requestFrame=globalThis.requestAnimationFrame}={}){
  this.document=document;this.opener=opener;this.origin=origin;this.job=job;this.printFunction=print;this.FontFace=FontFace;this.requestFrame=requestFrame;this.phase='waiting';this.expected=0;this.pages=new Map();this.generation=0;this.fontPromise=null;
  this.button=document.querySelector('#print-start');this.status=document.querySelector('#print-status');this.paper=document.querySelector('#print-pages');this.button.onclick=()=>this.preparePrint();
 }
 tell(value){this.status.textContent=value;}
 signal(){this.opener?.postMessage({type:'piano-score-print-ready',job:this.job},this.origin);}
 async receive(event){
  if(event.origin!==this.origin||event.source!==this.opener||event.data?.job!==this.job)return false;const data=event.data;
  if(data.type==='piano-score-print-start'){
   this.generation++;this.expected=Number.isInteger(data.count)&&data.count>0?data.count:0;this.pages.clear();this.paper.replaceChildren();this.phase='collecting';this.button.disabled=true;this.document.querySelector('#print-title').textContent=String(data.title||'完整曲谱');this.document.title=String(data.title||'完整曲谱')+' · 全曲打印';this.tell('正在接收全部 '+this.expected+' 页…');return true;
  }
  if(data.type==='piano-score-print-cancel'||data.type==='piano-score-print-error'){this.generation++;this.phase='error';this.button.disabled=true;this.tell(String(data.error||'曲谱准备已取消，请从演奏台重新打开打印'));return true;}
  if(data.type==='piano-score-print-page'){
   if(this.phase!=='collecting'||!Number.isInteger(data.page)||data.page<0||data.page>=this.expected||this.pages.has(data.page))return false;
   try{const page=this.document.createElement('section');page.className='score-print-page';page.dataset.page=String(data.page);page.setAttribute('aria-label','第 '+(data.page+1)+' 页');page.append(this.document.importNode(cleanScoreSVG(data.svg),true));this.pages.set(data.page,page);const next=[...this.pages.keys()].filter(p=>p>data.page).sort((a,b)=>a-b)[0];this.paper.insertBefore(page,next===undefined?null:this.pages.get(next));this.tell('已收到 '+this.pages.size+' / '+this.expected+' 页');return true;}
   catch(_){this.phase='error';this.button.disabled=true;this.tell('收到的谱页无效，请重新准备全曲打印');return false;}
  }
  if(data.type==='piano-score-print-complete'){
   if(this.phase!=='collecting'||!this.expected||this.pages.size!==this.expected){this.phase='error';this.button.disabled=true;this.tell('谱页尚未齐全，未开放打印，请重新准备');return false;}
   const generation=this.generation;await this.document.fonts?.ready;await new Promise(resolve=>this.requestFrame(()=>this.requestFrame(resolve)));if(generation!==this.generation||this.phase!=='collecting')return false;
   this.phase='pages_ready';this.button.disabled=false;this.button.textContent='加载开源字体并打印 / 另存 PDF（约 8MB）';this.tell('全部 '+this.expected+' 页已排好；下一步加载授权字体并打开浏览器打印对话框。');return true;
  }return false;
 }
 async preparePrint(){
  if(!['pages_ready','ready','font_error'].includes(this.phase))return false;const generation=this.generation;this.phase='font_loading';this.button.disabled=true;this.tell('正在加载 Noto Sans SC 开源中文字体，首次约 8MB…');
  try{
   if(!this.fontPromise)this.fontPromise=(async()=>{const face=new this.FontFace('PianoScorePrintSC',`url(${new URL('../demo/assets/native/full-score/NotoSansSC-Regular.otf',import.meta.url).href})`);this.document.fonts.add(face);await face.load();await this.document.fonts.ready;})();await this.fontPromise;
   if(generation!==this.generation)return false;this.document.body.classList.add('font-ready');await new Promise(resolve=>this.requestFrame(()=>this.requestFrame(resolve)));if(generation!==this.generation)return false;
   this.phase='ready';this.button.disabled=false;this.button.textContent='再次打开打印 / 另存 PDF';this.tell('全部 '+this.expected+' 页与授权字体已就绪，请在浏览器打印对话框选择全部页及“另存为 PDF”。');this.printFunction();return true;
  }catch(error){if(generation===this.generation){this.fontPromise=null;this.phase='font_error';this.button.disabled=false;this.button.textContent='重试加载字体并打印';this.tell('打印准备失败：'+String(error?.message||error));}return false;}
 }
 inspect(){return{phase:this.phase,pages:this.pages.size,expected:this.expected,readyForPrint:this.phase==='ready'};}
}
if(globalThis.document?.querySelector('#score-print-root')){
 const receiver=new PrintScoreReceiver();addEventListener('message',event=>{receiver.receive(event).catch(()=>{receiver.phase='error';receiver.button.disabled=true;receiver.tell('打印准备失败，请重新打开曲谱');});});receiver.signal();
}
