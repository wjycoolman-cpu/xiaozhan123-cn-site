import * as pdfjs from './vendor/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';
const pages = document.querySelector('#pages');
const status = document.querySelector('#status');
const input = document.querySelector('#page-number');
const prev = document.querySelector('#prev');
const next = document.querySelector('#next');
let doc, current = 1;
const rendered = new Set();
let queue = Promise.resolve();
class DocumentChunks extends pdfjs.PDFDataRangeTransport {
  constructor(base) { super(7771451,new Uint8Array()); this.base=base;this.cache=new Map();this.controller=new AbortController(); }
  async chunk(n) {
    if(!this.cache.has(n))this.cache.set(n,fetch(new URL(`chunks/${String(n).padStart(3,'0')}.bin`,this.base),{signal:this.controller.signal}).then(async response=>{
      if(!response.ok)throw Error(`Document chunk HTTP ${response.status}`);
      const data=new Uint8Array(await response.arrayBuffer());
      if(data.length!==Math.min(131072,7771451-n*131072))throw Error('Document chunk is incomplete');
      return data;
    }));
    return this.cache.get(n);
  }
  requestDataRange(begin,end) {
    const first=Math.floor(begin/131072),last=Math.floor((end-1)/131072);
    Promise.all(Array.from({length:last-first+1},(_,i)=>this.chunk(first+i))).then(parts=>{
      const data=new Uint8Array(end-begin);
      for(let i=0;i<parts.length;i++){
        const start=(first+i)*131072,from=Math.max(begin,start),to=Math.min(end,start+parts[i].length);
        data.set(parts[i].subarray(from-start,to-start),from-begin);
      }
      this.onDataRange(begin,data);
    }).catch(error=>{status.textContent='页面加载失败，请刷新重试，或下载 PDF 原文件。';console.error(error);});
  }
  abort() { this.controller.abort(); }
}
function update(n) {
  current = n; input.value = n;
  prev.disabled = n === 1; next.disabled = n === doc.numPages;
}
function jump(n) {
  n = Math.max(1, Math.min(doc.numPages, Number(n) || 1));
  update(n); document.querySelector(`#pdf-page-${n}`).scrollIntoView({block:'start'});
}
prev.onclick = () => jump(current - 1);
next.onclick = () => jump(current + 1);
input.onchange = () => jump(input.value);
input.onkeydown = e => { if (e.key === 'Enter') jump(input.value); };
async function render(n, holder) {
  const box = holder.getBoundingClientRect();
  if (box.bottom < -1200 || box.top > innerHeight + 1200) { rendered.delete(n); return; }
  const page = await doc.getPage(n);
  const base = page.getViewport({scale:1});
  const scale = holder.clientWidth / base.width;
  const viewport = page.getViewport({scale});
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', `第 ${n} 页`);
  canvas.width = Math.ceil(viewport.width * ratio);
  canvas.height = Math.ceil(viewport.height * ratio);
  holder.style.aspectRatio = `${base.width}/${base.height}`;
  holder.append(canvas);
  await page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]}).promise;
  holder.querySelector('.page-placeholder')?.remove();
  const text = document.createElement('div'); text.className = 'textLayer';
  text.style.setProperty('--scale-factor',scale);
  text.style.setProperty('--total-scale-factor',scale);
  holder.append(text);
  await new pdfjs.TextLayer({textContentSource:page.streamTextContent(),container:text,viewport}).render();
  holder.dataset.rendered = 'true';
  page.cleanup();
}
try {
  const asset = name => new URL(name,import.meta.url).href;
  const loading = pdfjs.getDocument({range:new DocumentChunks(import.meta.url),cMapUrl:asset('vendor/cmaps/'),cMapPacked:true,standardFontDataUrl:asset('vendor/standard_fonts/'),wasmUrl:asset('vendor/wasm/'),iccUrl:asset('vendor/iccs/'),isEvalSupported:false,disableStream:true,disableAutoFetch:true});
  loading.onProgress = ({loaded,total}) => { status.textContent = total ? `正在加载文档… ${Math.min(100,Math.round(loaded/total*100))}%` : '正在加载文档…'; };
  doc = await loading.promise;
  const first = await doc.getPage(1); const size = first.getViewport({scale:1}); first.cleanup();
  document.querySelector('#page-total').textContent = doc.numPages;
  input.max = doc.numPages; input.disabled = false; update(1);
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const holder = entry.target; const n = Number(holder.dataset.page);
      if (rendered.has(n)) continue;
      rendered.add(n);
      queue = queue.then(() => render(n,holder)).catch(error => {
        rendered.delete(n); holder.querySelector('canvas')?.remove();
        const label = holder.querySelector('.page-placeholder');
        if (label) label.textContent = `第 ${n} 页加载失败，请刷新重试`;
        console.error(error);
      });
    }
  },{rootMargin:'800px 0px'});
  for (let n=1;n<=doc.numPages;n++) {
    const holder = document.createElement('section');
    holder.className = 'pdf-page'; holder.id = `pdf-page-${n}`; holder.dataset.page=n;
    holder.setAttribute('aria-label',`第 ${n} 页`); holder.style.aspectRatio=`${size.width}/${size.height}`;
    const label = document.createElement('span'); label.className='page-placeholder'; label.textContent=`第 ${n} 页`;
    holder.append(label); pages.append(holder); observer.observe(holder);
  }
  status.textContent = `共 ${doc.numPages} 页 · 向下滚动阅读，也可输入页码跳转`;
  let scheduled=false;
  window.addEventListener('scroll',()=>{
    if(scheduled)return; scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      const y=document.querySelector('nav').getBoundingClientRect().bottom;
      let best=current, visible=0;
      for(const holder of pages.children){ const box=holder.getBoundingClientRect(); const amount=Math.max(0,Math.min(box.bottom,innerHeight)-Math.max(box.top,y)); if(amount>visible){visible=amount;best=Number(holder.dataset.page);} }
      update(best);
      for(const holder of pages.querySelectorAll('[data-rendered]')) {
        if(Math.abs(Number(holder.dataset.page)-current)<=5) continue;
        holder.querySelectorAll('canvas,.textLayer').forEach(el=>el.remove());
        holder.removeAttribute('data-rendered'); rendered.delete(Number(holder.dataset.page));
        const label=document.createElement('span');label.className='page-placeholder';label.textContent=`第 ${holder.dataset.page} 页`;holder.append(label);
      }
    });
  },{passive:true});
} catch(error) {
  status.textContent = '文档暂时加载失败，请刷新重试，或点击“下载 PDF”保存原文件。';
  console.error(error);
}
