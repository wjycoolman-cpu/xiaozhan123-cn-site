import {cleanScoreSVG,serializeScoreSVG,toDataURL} from './full-score/svg.js';
let current=null;
const ORIGIN=new URL(import.meta.url).origin;
const FONT=new URL('../demo/assets/native/full-score/NotoSansSC-Regular.otf',import.meta.url).href;
const LICENSE=new URL('../demo/assets/native/full-score/NOTO-OFL.txt',import.meta.url).href;
let embeddedFont=null;
const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const filename=value=>String(value||'曲谱').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,80);
function download(name,blob){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function portableSVG(source,embed){
 const svg=cleanScoreSVG(source);if(!embed)return serializeScoreSVG(svg);
 if(!embeddedFont)embeddedFont=Promise.all([fetch(FONT).then(r=>{if(!r.ok)throw Error('开源中文字体加载失败');return r.arrayBuffer();}),fetch(LICENSE).then(r=>{if(!r.ok)throw Error('字体许可未载入');return r.text();})]).catch(error=>{embeddedFont=null;throw error;});
 const[bytes,license]=await embeddedFont;let binary='';const data=new Uint8Array(bytes);for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
 const ns='http://www.w3.org/2000/svg',style=document.createElementNS(ns,'style');style.textContent=`@font-face{font-family:PianoScoreExportSC;src:url(data:font/otf;base64,${btoa(binary)})}text{font-family:PianoScoreExportSC}`;
 const metadata=document.createElementNS(ns,'metadata');metadata.textContent='Embedded Noto Sans SC; SIL Open Font License 1.1\n'+license;svg.prepend(style,metadata);return serializeScoreSVG(svg);
}
export class DesktopScoreWindow{
 constructor(){
  if(!document.querySelector('link[data-desktop-score]')){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./desktop-score.css',import.meta.url).href;css.dataset.desktopScore='true';document.head.append(css);}
  this.epoch=0;this.serial=0;this.renderEpoch=0;this.pending=new Map();this.cache=new Map();this.worker=null;this.closed=false;this.style=0;this.page=0;this.zoom=1;this.phase='idle';this.error='';this.printJob=null;
  this.dialog=document.createElement('dialog');this.dialog.id='desktop-full-score';this.dialog.innerHTML='<div class="ds-heading"><div><small>完整分页曲谱</small><h2 data-title>正在准备曲谱</h2></div><button data-close aria-label="关闭完整曲谱">关闭</button></div><div class="ds-toolbar"><label>谱面 <select data-style><option value="0">简谱</option><option value="1">五线谱</option></select></label><button data-prev>上一页</button><span data-page>—</span><button data-next>下一页</button><label>缩放 <select data-zoom><option value="0.5">50%</option><option value="0.75">75%</option><option value="1" selected>100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option></select></label><button data-svg>当页 SVG</button><button data-png>当页 PNG</button><button data-print>全曲打印 / 另存 PDF</button></div><p class="ds-status" data-status role="status"></p><p class="ds-options"><label><input data-embed type="checkbox"> SVG / PNG 导出嵌入开源中文字体（约 8MB，仅勾选后下载）</label><button data-retry hidden>重新准备曲谱</button></p><div class="ds-viewport"><div class="ds-paper" data-paper></div></div><p class="ds-notice">演奏数据自动排谱，非原版出版谱。PDF 使用浏览器打印对话框；打印前按需加载 Noto Sans SC（OFL），屏显使用系统字体与 Bravura 记谱字形。</p>';
  document.body.append(this.dialog);this.q=selector=>this.dialog.querySelector(selector);this.paper=this.q('[data-paper]');
  this.q('[data-close]').onclick=()=>this.close();this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});this.dialog.addEventListener('close',()=>this.close());
  this.q('[data-style]').onchange=()=>{this.style=Number(this.q('[data-style]').value);this.page=0;this.render();};this.q('[data-prev]').onclick=()=>{this.page--;this.render();};this.q('[data-next]').onclick=()=>{this.page++;this.render();};
  this.q('[data-zoom]').onchange=()=>{this.zoom=Number(this.q('[data-zoom]').value);this.paper.style.setProperty('--score-zoom',String(this.zoom));};
  this.q('[data-retry]').onclick=()=>this.setSong(this.song);this.q('[data-svg]').onclick=()=>this.exportPage('svg');this.q('[data-png]').onclick=()=>this.exportPage('png');this.q('[data-print]').onclick=()=>this.printAll();
  this.onMessage=event=>{const job=this.printJob;if(!job||event.origin!==ORIGIN||event.source!==job.window||event.data?.job!==job.id)return;if(event.data.type==='piano-score-print-ready')job.resolve();};addEventListener('message',this.onMessage);
 }
 status(text,error=false){this.error=error?text:'';this.q('[data-status]').textContent=text;this.q('[data-retry]').hidden=!error;}
 controls(ready){for(const selector of['[data-prev]','[data-next]','[data-svg]','[data-png]','[data-print]'])this.q(selector).disabled=!ready;this.q('[data-prev]').disabled=!ready||this.page===0;this.q('[data-next]').disabled=!ready||this.page+1>=(this.manifest?.pages[this.style]||0);}
 stopWorker(reason='曲谱请求已取消'){
  this.worker?.terminate();this.worker=null;for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(Error(reason));}this.pending.clear();
 }
 request(command,extra={}){
  if(this.closed||!this.worker)return Promise.reject(Error('曲谱窗口已关闭或未准备'));const id=++this.serial,documentId=this.epoch;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('曲谱准备超时，请重试'));},120000);this.pending.set(id,{resolve,reject,timer,documentId});try{this.worker.postMessage({id,documentId,command,...extra});}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});
 }
 async setSong(song){
  const epoch=++this.epoch;this.renderEpoch++;this.stopWorker();this.cancelPrint();this.song=song;this.cache.clear();this.currentSVG=null;this.manifest=null;this.page=0;this.phase='preparing';this.controls(false);this.status('正在独立排版，演奏进度不会被改动…');this.q('[data-title]').textContent=String(song?.title||'完整曲谱');if(!this.dialog.open)this.dialog.showModal();
  try{
   this.worker=new Worker(new URL('./desktop-score-worker.js',import.meta.url),{type:'module',name:'piano-full-score'});
   this.worker.onmessage=event=>{const response=event.data||{},pending=this.pending.get(response.id);if(!pending||pending.documentId!==response.documentId||response.documentId!==this.epoch)return;clearTimeout(pending.timer);this.pending.delete(response.id);response.type==='error'?pending.reject(Error(response.error)):pending.resolve(response);};
   this.worker.onerror=event=>{event.preventDefault?.();if(this.closed||epoch!==this.epoch)return;this.stopWorker('独立排版进程发生错误');this.phase='error';this.status('独立排版进程发生错误，可点击重试',true);this.controls(false);};this.worker.onmessageerror=()=>this.worker?.onerror?.({preventDefault(){}});
   const manifest=await this.request('prepare',{song});if(this.closed||epoch!==this.epoch)return;this.manifest=manifest;await this.render();
  }catch(error){if(!this.closed&&epoch===this.epoch){this.phase='error';this.status(error.message,true);this.controls(false);}}
 }
 async svgFor(style,page,epoch=this.epoch){
  const key=style+':'+page;if(this.cache.has(key))return this.cache.get(key);const response=await this.request('page',{style,page});if(this.closed||epoch!==this.epoch)throw Error('曲谱已更换');let source;
  if(style===0)source=response.svg;else{const{renderStaff}=await import('./full-score/renderer.js');if(this.closed||epoch!==this.epoch)throw Error('曲谱已更换');const staging=document.createElement('div');staging.className='ds-staging';document.body.append(staging);try{source=serializeScoreSVG(await renderStaff(response.staff,staging));}finally{staging.remove();}}
  if(this.closed||epoch!==this.epoch)throw Error('曲谱已更换');source=serializeScoreSVG(cleanScoreSVG(source));this.cache.set(key,source);while(this.cache.size>8)this.cache.delete(this.cache.keys().next().value);return source;
 }
 async render(){
  if(this.closed||!this.manifest)return;const epoch=this.epoch,render=++this.renderEpoch,style=this.style,count=this.manifest.pages[style];this.page=Math.max(0,Math.min(count-1,this.page));const page=this.page;this.phase='rendering';this.controls(false);this.status('正在显示第 '+(page+1)+' / '+count+' 页…');
  try{const source=await this.svgFor(style,page,epoch);if(this.closed||epoch!==this.epoch||render!==this.renderEpoch)return;this.paper.replaceChildren(document.importNode(cleanScoreSVG(source),true));this.paper.style.setProperty('--score-zoom',String(this.zoom));await frame();if(this.closed||epoch!==this.epoch||render!==this.renderEpoch)return;this.currentSVG=source;this.phase='ready';this.q('[data-page]').textContent=(page+1)+' / '+count+' 页';this.status(this.manifest.notice);this.controls(true);}
  catch(error){if(!this.closed&&epoch===this.epoch&&render===this.renderEpoch){this.phase='error';this.status(error.message,true);this.controls(false);}}
 }
 async exportPage(kind){
  if(this.phase!=='ready'||!this.currentSVG)return;const epoch=this.epoch,title=filename(this.song.title),page=this.page+1,style=this.style;this.status('正在生成当页 '+kind.toUpperCase()+'…');
  try{const source=await portableSVG(this.currentSVG,this.q('[data-embed]').checked);if(this.closed||epoch!==this.epoch)return;
   if(kind==='svg')download(`${title}-${style?'五线谱':'简谱'}-${page}.svg`,new Blob([source],{type:'image/svg+xml'}));
   else{const image=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('浏览器未能渲染 SVG，仍可导出 SVG 或使用全曲打印'));image.src=toDataURL(source);});if(this.closed||epoch!==this.epoch)return;const canvas=document.createElement('canvas');canvas.width=1190;canvas.height=1684;const context=canvas.getContext('2d');if(!context)throw Error('浏览器不支持 PNG 绘制');context.fillStyle='#fff';context.fillRect(0,0,1190,1684);context.drawImage(image,0,0,1190,1684);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('浏览器未生成 PNG');if(this.closed||epoch!==this.epoch)return;download(`${title}-${style?'五线谱':'简谱'}-${page}.png`,blob);}
   this.status('当页 '+kind.toUpperCase()+' 已交给浏览器下载');
  }catch(error){if(!this.closed&&epoch===this.epoch)this.status(error.message,true);}
 }
 cancelPrint(){const job=this.printJob;if(!job)return;clearTimeout(job.timer);job.reject?.(Error('打印任务已取消'));if(!job.complete)try{job.window?.postMessage({type:'piano-score-print-cancel',job:job.id},ORIGIN);}catch(_){}this.printJob=null;}
 async printAll(){
  if(this.phase!=='ready'||!this.manifest)return;this.cancelPrint();const epoch=this.epoch,style=this.style,count=this.manifest.pages[style],title=String(this.song.title||'完整曲谱');const id=crypto.randomUUID();let resolve,reject;
  const ready=new Promise((yes,no)=>{resolve=yes;reject=no;});ready.catch(()=>{});const job={id,resolve,reject,window:null,timer:null};this.printJob=job;job.timer=setTimeout(()=>reject(Error('打印页面未回应，请允许同源弹出页面后重试')),15000);
  job.window=window.open(new URL('./print-score.html?job='+encodeURIComponent(id),import.meta.url).href,'_blank');
  if(!job.window){this.cancelPrint();this.status('浏览器阻止了打印页面，请允许弹出窗口后重试',true);return;}
  try{await ready;clearTimeout(job.timer);if(this.closed||epoch!==this.epoch||this.printJob!==job)throw Error('打印任务已取消');job.window.postMessage({type:'piano-score-print-start',job:id,title,count,style},ORIGIN);
   for(let page=0;page<count;page++){if(this.closed||epoch!==this.epoch||this.printJob!==job||job.window.closed)throw Error('打印任务已取消');this.status('正在准备全曲打印 '+(page+1)+' / '+count+' 页…');const svg=await this.svgFor(style,page,epoch);if(this.closed||epoch!==this.epoch||this.printJob!==job)throw Error('打印任务已取消');job.window.postMessage({type:'piano-score-print-page',job:id,page,svg},ORIGIN);}
   job.window.postMessage({type:'piano-score-print-complete',job:id},ORIGIN);this.status('全部 '+count+' 页已交给打印页面；在该页面点击准备打印，并在浏览器对话框选择另存为 PDF。');job.reject=null;job.complete=true;
  }catch(error){try{job.window.postMessage({type:'piano-score-print-error',job:id,error:error.message},ORIGIN);}catch(_){}if(!this.closed&&epoch===this.epoch)this.status(error.message,true);}
 }
 inspect(){return{open:!this.closed,phase:this.phase,error:this.error,documentId:this.epoch,style:this.style,page:this.page,pages:this.manifest?.pages||[0,0],cachedPages:this.cache.size,pending:this.pending.size,worker:!!this.worker,printing:!!this.printJob&&!this.printJob.complete};}
 close(){if(this.closed)return;this.closed=true;this.epoch++;this.renderEpoch++;this.stopWorker();this.cancelPrint();removeEventListener('message',this.onMessage);if(this.dialog.open)this.dialog.close();this.dialog.remove();if(current===this)current=null;}
}
export async function openDesktopScore(song){if(!current||current.closed)current=new DesktopScoreWindow();const controller=current;await controller.setSong(song);return controller;}
