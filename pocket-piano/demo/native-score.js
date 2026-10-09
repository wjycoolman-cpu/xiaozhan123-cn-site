import * as formal from './native-synth.js';
const dialog=document.createElement('dialog');dialog.id='native-full-score';
dialog.innerHTML='<div class="dialog-head"><h2>完整曲谱</h2><button data-close>完成</button></div><div class="score-tools"><select aria-label="谱面类型"><option value="0">简谱</option><option value="1">五线谱</option></select><button data-prev>上一页</button><span data-page></span><button data-next>下一页</button><button data-export>导出本页 SVG</button></div><p data-error role="status"></p><div class="score-paper"></div>';
document.body.append(dialog);let page=0,style=0,generation=0,frame=null;
const q=s=>dialog.querySelector(s),paper=q('.score-paper');
const font=new FontFace('ScoreSC','url(assets/native/full-score/NotoSansSC-Regular.otf)');
document.fonts.add(font);const fontReady=font.load();
q('[data-close]').onclick=()=>dialog.close();
q('select').onchange=()=>{style=Number(q('select').value);page=0;render();};
q('[data-prev]').onclick=()=>{page--;render();};q('[data-next]').onclick=()=>{page++;render();};
async function render(){q('[data-error]').textContent='';const token=++generation;const count=formal.scorePages(style);page=Math.max(0,Math.min(count-1,page));q('[data-page]').textContent=`${page+1} / ${count}`;q('[data-prev]').disabled=page===0;q('[data-next]').disabled=page+1===count;
 try{await fontReady;if(token!==generation)return;paper.replaceChildren();frame=null;
  if(style===0){paper.innerHTML=formal.scoreNumbered(page);}
  else {frame=document.createElement('iframe');frame.title='完整五线谱';frame.src='assets/native/full-score/staff.html';frame.onload=async()=>{const w=frame.contentWindow;w.ScoreReady={rendered(g,p,heads,error){if(g===generation&&error)q('[data-error]').textContent=error;},bootError(error){q('[data-error]').textContent=error;}};await w.Score.render(JSON.parse(formal.scoreStaff(page,token)));};paper.append(frame);}
 }catch(e){q('[data-error]').textContent='谱面生成失败：'+e.message;}}
q('[data-export]').onclick=async()=>{try{const svg=style===0?paper.querySelector('svg'):frame?.contentDocument.querySelector('svg');if(!svg)throw Error('请等待谱面生成');const clone=svg.cloneNode(true);const bytes=new Uint8Array(await fetch('assets/native/full-score/NotoSansSC-Regular.otf').then(r=>{if(!r.ok)throw Error('谱面字体未加载');return r.arrayBuffer();}));let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const css=document.createElementNS('http://www.w3.org/2000/svg','style');css.textContent="@font-face{font-family:ScoreSC;src:url(data:font/otf;base64,"+btoa(binary)+")}text{font-family:ScoreSC}";clone.prepend(css);const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(window.PianoWeb.view().song.title||'曲谱')+'-'+(style?'五线谱':'简谱')+'-'+(page+1)+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}catch(e){q('[data-error]').textContent=e.message;}};
document.querySelector('#score').onclick=()=>{window.PianoWeb.pause();formal.scorePrepare();page=0;dialog.showModal();render();};
