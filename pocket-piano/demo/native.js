import {setSurface,settings as surfaceSettings} from './native-surfaces.js';
import './native-score.js';
const q=s=>document.querySelector(s);
function show(id){if(window.PianoWeb?.inspect().playing)q('#start').click();q(id).showModal();}
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>b.closest('dialog').close());
q('#mode-entry').onclick=()=>show('#native-mode');
q('#native-assisted').onclick=()=>{q('#simple').checked=!q('#simple').checked;q('#simple').dispatchEvent(new Event('change'));q('#native-assisted').textContent=q('#simple').checked?'右手＋伴奏':'完整跟弹';};
q('#native-clear-search').onclick=()=>{q('#search').value='';q('#search').dispatchEvent(new Event('input'));q('#search').focus();};
q('#native-all').onclick=()=>{q('#search').value='';q('#category').value='全部';q('#search').dispatchEvent(new Event('input'));};
q('#native-prev').onclick=()=>window.PianoWeb.browse(-1);q('#native-next').onclick=()=>window.PianoWeb.browse(1);
for(const [label,value] of [['全部','全部'],['流行歌曲','流行歌曲'],['动漫影视','动漫影视'],['经典轻音乐','经典轻音乐'],['基础练习','基础练习'],['其他','其他'],['我的','我的'],['收藏','收藏'],['录制','录制']]){if(![...q('#category').options].some(o=>o.value===value))q('#category').add(new Option(label,value));const b=document.createElement('button');b.textContent=label;b.dataset.category=value;b.onclick=()=>{q('#category').value=value;q('#category').dispatchEvent(new Event('change'));for(const x of q('#native-categories').children)x.classList.toggle('selected',x===b);};if(value==='全部')b.classList.add('selected');q('#native-categories').append(b);}
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{q('#mode').value=b.dataset.mode;q('#mode').dispatchEvent(new Event('change'));q('#mode-entry').textContent=({free:'自由',auto:'自动',follow:'跟弹'})[b.dataset.mode]+' ▾';q('#native-mode').close();};
q('#progress-entry').onclick=()=>show('#native-progress');q('#native-beginning').onclick=()=>{q('#restart').click();};
q('#tone-entry').onclick=()=>show('#native-tone');
const presets=await fetch('assets/instruments.json').then(r=>{if(!r.ok)throw Error('音色目录加载失败');return r.json();});
q('#tone').replaceChildren(...presets.map(p=>new Option(p.name,String(p.id))));
const toneCategory=document.createElement('select');toneCategory.id='native-tone-category';toneCategory.setAttribute('aria-label','音色分类');
for(const category of [...new Set(presets.map(p=>p.category))])toneCategory.add(new Option(category,category));
q('#native-tones').before(toneCategory);
function toneRows(){q('#native-tones').replaceChildren();for(const p of presets.filter(p=>p.category===toneCategory.value)){
 const b=document.createElement('button');b.className='native-tone-row';b.dataset.preset=p.id;
 const icon=document.createElement('img');icon.src='assets/instrument-icons/'+p.id+'.svg';icon.alt='';icon.width=48;icon.height=48;
 const title=document.createElement('span');title.textContent=p.name;const detail=document.createElement('small');detail.textContent=p.detail;b.append(icon,title,detail);
 b.onclick=()=>{q('#tone').value=String(p.id);q('#tone').dispatchEvent(new Event('change'));q('#tone-entry').setAttribute('aria-label','音色，'+p.name);q('#native-tone').close();};q('#native-tones').append(b);
}}
toneCategory.onchange=toneRows;toneRows();
q('#tone').addEventListener('change',()=>{const p=presets[Number(q('#tone').value)];if(!p)return;const icon=q('#tone-entry img');icon.src='assets/instrument-icons/'+p.id+'.svg';icon.alt=p.name;q('#tone-entry').setAttribute('aria-label','音色，'+p.name);});
q('#tone').dispatchEvent(new Event('change'));
q('#sustain').addEventListener('change',()=>{const surface=document.body.dataset.surface;if(['handheld','touch'].includes(surface)||surface==='pad'&&App31Pad.inspect().configuration.percussion)PianoWeb.audio.sustain=false;});
function limitation(title,text){q('#capability-title').textContent=title;q('#capability-text').textContent=text;show('#native-capability');}
q('#export-entry').onclick=async()=>{const button=q('#export-entry');button.disabled=true;try{const {exportActualVideo}=await import('./native-video.js');const blob=await exportActualVideo();const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=(PianoWeb.view().song?.title||'演奏')+'-真实页面.mp4';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);q('#status').textContent='视频已生成，请查看浏览器下载';}catch(error){q('#status').textContent=error.message;}finally{button.disabled=false;}};
const surfaces=document.createElement('dialog');surfaces.id='native-surface-menu';surfaces.innerHTML='<div class="dialog-head"><h2>演奏键盘</h2><button>完成</button></div><div class="native-sheet-body"></div>';document.body.append(surfaces);surfaces.querySelector('.dialog-head button').onclick=()=>surfaces.close();
for(const [label,name]of [['钢琴键盘','piano'],['音乐计算器','calculator'],['科学仪器','scope'],['多彩打击垫','pad'],['音乐掌机 · 白色双侧控制器','handheld'],['音乐可视化 · 流光五线谱','visualizer']]){const b=document.createElement('button');b.textContent=label;b.dataset.surface=name;b.onclick=()=>{surfaces.close();setSurface(name);};surfaces.querySelector('.native-sheet-body').append(b);}
for(const [label,preset]of [['提琴 · 按弦演奏',30],['口琴 · 吹吸音孔',56],['吉他 · 指板与扫弦',6],['长笛 · 简化音孔',8],['颤音琴 · 敲击音条',9]]){const b=document.createElement('button');b.textContent=label;b.dataset.surface='touch';b.dataset.preset=preset;b.onclick=()=>{surfaces.close();setSurface('touch',preset);};surfaces.querySelector('.native-sheet-body').append(b);}
q('#surface-entry').onclick=()=>show('#native-surface-menu');
setInterval(()=>{const s=window.PianoWeb?.inspect();if(!s)return;const exporting=!!document.body.dataset.exporting;q('#song-title').textContent=s.mode==='free'?presets[Number(q('#tone').value)].name:PianoWeb.view().song?.title||'选择曲目';q('#native-state').textContent=s.mode==='free'?'多指弹奏 · 可录制':exporting||s.playing?(s.mode==='auto'?'自动演奏中':'轻点亮键，自动补足音长'):s.position>0?'已暂停 · 点开始继续':'等待开始 · 点开始后弹奏';q('#mode-entry').textContent=({free:'自由',auto:'自动',follow:'跟弹'})[s.mode]+' ▾';},100);
await import('./native-tools.js');
