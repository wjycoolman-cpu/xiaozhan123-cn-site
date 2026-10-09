/* Original scene adapter. VexFlow 4.2.5 / MIT and bundled fonts retain their licences. */
'use strict';
(() => {
 const NS='http://www.w3.org/2000/svg', SEGMENT=4000, PX=.105, CURSOR=570, MAX_GROUPS=128, CACHE_LIMIT=9;
 const colors=['#c9abff','#f4c477'], dark=['#262136','#30272b'];
 const scene=document.getElementById('scene'), paper=document.getElementById('paper'),
  staves=document.getElementById('staves'), tiles=document.getElementById('tiles'),
  trails=document.getElementById('trails'), lights=document.getElementById('lights'), decoration=document.getElementById('decoration');
 let data=null,notes=[],ends=[],starts=[],prefix=[],cache=new Map(),visible=[],lastFrame=null,latestGeneration=null,ready=false;
 let renderCount=0,cacheHits=0,lastError='',activeCount=0,activeSources=[],packedGroups=0;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const finite=(x,otherwise=0)=>Number.isFinite(Number(x))?Number(x):otherwise;
 function el(tag,attrs,parent){const n=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,v));if(parent)parent.appendChild(n);return n;}
 function bridge(method,...args){const b=window.MusicSceneReady;if(b&&typeof b[method]==='function')b[method](...args);}
 function error(e){lastError=String(e&&e.message||e||'Scene failed').slice(0,500);return lastError;}
 function bound(a,v,upper=false){let l=0,r=a.length;while(l<r){const m=(l+r)>>>1;if(a[m]<v||(upper&&a[m]===v))l=m+1;else r=m;}return l;}
 const pitches=['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'];
 const noteKey=p=>pitches[p%12]+'/'+(Math.floor(p/12)-1);
 function glyphDuration(ms){const beats=ms*data.bpm/60000;return beats>=3.5?'w':beats>=1.75?'h':beats>=.875?'q':beats>=.4375?'8':beats>=.21875?'16':'32';}
 function staveBase(staff){return staff===0?135:315;}
 function buildStaves(){
  staves.replaceChildren();const VF=window.Vex.Flow;
  const holder=document.createElement('div'),r=new VF.Renderer(holder,VF.Renderer.Backends.SVG);r.resize(1500,580);
  const ctx=r.getContext();ctx.setStrokeStyle('#252031');ctx.setFillStyle('#252031');
  for(let staff=0;staff<2;staff++){
   new VF.Stave(10,staveBase(staff),1480,{left_bar:false,right_bar:false}).setContext(ctx).draw();
   new VF.Stave(72,staveBase(staff),200,{left_bar:false,right_bar:false}).addClef(staff===0?'treble':'bass').setContext(ctx).draw();
  }
  for(const child of Array.from(holder.querySelector('svg').childNodes))staves.appendChild(child);
  // Fixed clefs remain legible while original millisecond positions scroll behind them.
  el('line',{x1:62,x2:62,y1:175,y2:395,stroke:'#252031','stroke-width':2},staves);
 }
 function groupNotes(segment){
  const from=segment*SEGMENT,to=from+SEGMENT,groups=[],map=new Map();
  for(let i=bound(starts,from),end=bound(starts,to);i<end;i++){
   const n=notes[i],k=n.staff+':'+n.start;let g=map.get(k);
   if(!g){g={start:n.start,staff:n.staff,notes:[],end:n.start,duration:n.duration};map.set(k,g);groups.push(g);}
   g.notes.push(n);g.end=Math.max(g.end,n.start+n.duration);g.duration=Math.min(g.duration,n.duration);
  }
  // Chords/unisons preserve their source events. Exceptional dense inputs use time bins,
  // retaining the complete input ledger and the true current event count.
  if(groups.length<=MAX_GROUPS)return groups;
  const bins=new Map();
  for(const g of groups){const key=g.staff+':'+Math.floor((g.start-from)/(SEGMENT/64));let b=bins.get(key);
   if(!b){b={...g,notes:[],packed:true};bins.set(key,b);}b.notes.push(...g.notes);b.end=Math.max(b.end,g.end);}
  return Array.from(bins.values()).sort((a,b)=>a.start-b.start||a.staff-b.staff);
 }
 function buildSegment(segment){
  if(cache.has(segment)){cacheHits++;const existing=cache.get(segment);cache.delete(segment);cache.set(segment,existing);return existing;}
  const VF=window.Vex.Flow,holder=document.createElement('div'),renderer=new VF.Renderer(holder,VF.Renderer.Backends.SVG);
  renderer.resize(SEGMENT*PX,580);const ctx=renderer.getContext();ctx.setFillStyle('#262136');ctx.setStrokeStyle('#262136');
  const group=el('g',{'data-segment':segment}),objects=[];
  const staffRefs=[0,1].map(s=>new VF.Stave(0,staveBase(s),SEGMENT*PX,{left_bar:false,right_bar:false}).setClef(s===0?'treble':'bass'));
  for(const g of groupNotes(segment)){
   const unique=Array.from(new Set(g.notes.map(n=>n.pitch))).sort((a,b)=>a-b);
   // The full MIDI range is kept. Large clusters show representative pitch extremes
   // instead of spawning unbounded chord-head DOM.
   const shown=unique.length>12?unique.slice(0,6).concat(unique.slice(-6)):unique;
   const duration=glyphDuration(g.duration),clef=g.staff===0?'treble':'bass';
   const n=new VF.StaveNote({keys:shown.map(noteKey),duration,clef,auto_stem:true});
   shown.forEach((p,index)=>{if(pitches[p%12].includes('#'))n.addModifier(new VF.Accidental('#'),index);});
   n.setStave(staffRefs[g.staff]);new VF.TickContext().addTickable(n).preFormat().setX((g.start-segment*SEGMENT)*PX+5);
   const before=holder.querySelector('svg').childNodes.length;n.setContext(ctx).draw();
   const node=el('g',{'data-source':g.notes[0].source,'data-staff':g.staff});
   for(const c of Array.from(holder.querySelector('svg').childNodes).slice(before))node.appendChild(c);
   group.appendChild(node);
   const ys=n.getYs();g.x=n.getAbsoluteX();g.y=ys[Math.floor(ys.length/2)]||staveBase(g.staff)+60;g.node=node;g.state=-1;g.engraved=n;g.glyph=duration;
   g.heads=shown.map((pitch,index)=>{const head=n.noteHeads[index],box=head.getBoundingBox();return {pitch,
    x:box.getX()+box.getW()/2,y:box.getY()+box.getH()/2,
    events:g.notes.filter(event=>event.pitch===pitch),node:head.getSVGElement?head.getSVGElement():null,state:-1};});
   if(g.packed||unique.length>12){const t=el('text',{x:g.x+14,y:g.y-14,'font-size':13,fill:'#aaa0ba'},node);t.textContent='·'+g.notes.length;}
   objects.push(g);
  }
  const beams=[];
  for(let staff=0;staff<2;staff++){
   let pending=[];const flush=()=>{if(pending.length>1){const beam=new VF.Beam(pending.map(g=>g.engraved));
    // Assign the beam before the final note draw so flags are not drawn beneath it.
    for(const g of pending){g.node.replaceChildren();g.engraved.setContext(ctx).draw();for(const c of Array.from(holder.querySelector('svg').childNodes))g.node.appendChild(c);
     g.heads.forEach((head,index)=>{const glyph=g.engraved.noteHeads[index],box=glyph.getBoundingBox();head.x=box.getX()+box.getW()/2;head.y=box.getY()+box.getH()/2;head.node=glyph.getSVGElement?glyph.getSVGElement():null;});}
    beam.setContext(ctx).draw();
    const node=el('g',{});for(const c of Array.from(holder.querySelector('svg').childNodes))node.appendChild(c);group.appendChild(node);beams.push({node,groups:pending,staff,state:-1});}pending=[];};
   for(const g of objects.filter(g=>g.staff===staff)){const short=['8','16','32'].includes(g.glyph);
    if(!short||g.packed||(pending.length&&g.start-pending[pending.length-1].start>45000/data.bpm))flush();
    if(short&&!g.packed){pending.push(g);if(pending.length===4)flush();}
   }flush();
  }
  objects.forEach(g=>delete g.engraved);
  // Stable bar positions are a visual beat guide; playback uses the imported times.
  const barMs=240000/data.bpm,from=segment*SEGMENT;
  for(let b=Math.ceil(from/barMs)*barMs;b<from+SEGMENT;b+=barMs){const x=(b-from)*PX;
   el('line',{x1:x,x2:x,y1:175,y2:395,stroke:'#2b2338','stroke-width':1,opacity:.4},group);}
  const result={segment,node:group,objects,beams};cache.set(segment,result);renderCount++;
  while(cache.size>CACHE_LIMIT){const oldest=cache.keys().next().value;if(visible.includes(oldest)){const value=cache.get(oldest);cache.delete(oldest);cache.set(oldest,value);}else cache.delete(oldest);}
  return result;
 }
 function updateWindow(ms){
  const center=Math.floor(ms/SEGMENT),requested=[];
  for(let segment=Math.max(0,center-2);segment<=center+2;segment++){
   if(segment*SEGMENT<=data.duration||segment===0)requested.push(segment);
  }
  const changed=requested.join(',')!==visible.join(',');visible=requested;
  if(changed){tiles.replaceChildren();for(const segment of requested)tiles.appendChild(buildSegment(segment).node);}
  // One neighbor is cached off DOM before the next boundary.
  if((center+3)*SEGMENT<=data.duration)buildSegment(center+3);
  for(const segment of visible){const tile=cache.get(segment);tile.node.setAttribute('transform','translate('+(CURSOR+(segment*SEGMENT-ms)*PX)+',0)');}
 }
 function activeAt(ms){
  const count=bound(starts,ms,true)-bound(ends,ms,true);const sources=[];
  for(let i=bound(starts,ms,true)-1;i>=0&&prefix[i]>ms;i--){if(notes[i].start+notes[i].duration>ms&&sources.length<256)sources.push(notes[i].source);}
  activeCount=count;activeSources=sources.sort((a,b)=>a-b);
 }
 function updateNotes(ms){
  const active=[[],[]],past=[[],[]],future=[[],[]];packedGroups=0;
  for(const segment of visible)for(const g of cache.get(segment).objects){
   const isActive=g.notes.some(n=>n.start<=ms&&n.start+n.duration>ms),state=isActive?2:g.start<=ms?1:0,styleDirty=g.state!==state;
   if(g.state!==state){g.node.setAttribute('fill',state?colors[g.staff]:dark[g.staff]);g.node.setAttribute('stroke',state?colors[g.staff]:dark[g.staff]);
    g.node.querySelectorAll('[fill]').forEach(n=>{if(n.getAttribute('fill')!=='none')n.setAttribute('fill',state?colors[g.staff]:dark[g.staff]);});
    g.node.querySelectorAll('[stroke]').forEach(n=>{if(n.getAttribute('stroke')!=='none')n.setAttribute('stroke',state?colors[g.staff]:dark[g.staff]);});g.state=state;
   }
   const offset=CURSOR+(segment*SEGMENT-ms)*PX;
   for(const head of g.heads){const sounding=head.events.some(event=>event.start<=ms&&event.start+event.duration>ms),headState=sounding?2:head.events.some(event=>event.start<=ms)?1:0;
    if(head.node&&(styleDirty||head.state!==headState)){head.node.setAttribute('fill',headState?colors[g.staff]:dark[g.staff]);head.node.setAttribute('stroke',headState?colors[g.staff]:dark[g.staff]);
     head.node.querySelectorAll('[fill]').forEach(node=>{if(node.getAttribute('fill')!=='none')node.setAttribute('fill',headState?colors[g.staff]:dark[g.staff]);});
     head.node.querySelectorAll('[stroke]').forEach(node=>{if(node.getAttribute('stroke')!=='none')node.setAttribute('stroke',headState?colors[g.staff]:dark[g.staff]);});}
    head.state=headState;if(sounding)active[g.staff].push({x:offset+head.x,y:head.y,start:g.start,end:g.end,pitch:head.pitch});
   }
   const p={x:offset+g.x,y:g.y,start:g.start,end:g.end};
   if(g.start<=ms)past[g.staff].push(p);else future[g.staff].push(p);if(g.packed)packedGroups++;
  }
  for(const segment of visible)for(const beam of cache.get(segment).beams){const state=beam.groups.every(g=>g.start<=ms)?1:0;
   if(state!==beam.state){beam.node.querySelectorAll('[fill]').forEach(n=>{if(n.getAttribute('fill')!=='none')n.setAttribute('fill',state?colors[beam.staff]:dark[beam.staff]);});beam.state=state;}}
  lights.replaceChildren();trails.replaceChildren();
  for(let staff=0;staff<2;staff++){
   const a=active[staff].filter(head=>head.x>=0&&head.x<=1500),p=past[staff].sort((x,y)=>x.start-y.start),f=future[staff].sort((x,y)=>x.start-y.start);
   for(const n of a){el('ellipse',{cx:n.x,cy:n.y,rx:32,ry:20,fill:colors[staff],opacity:.7,filter:'url(#halo)'},lights);el('ellipse',{cx:n.x,cy:n.y,rx:11,ry:7,fill:'none',stroke:'#fff7e9','stroke-width':2.2,opacity:.95},lights);}
   const prev=p[p.length-1],next=f[0];
   if(prev&&next&&next.start-prev.start<=4000){const t=clamp((ms-prev.start)/(next.start-prev.start),0,1),lift=40;
    const midX=(prev.x+next.x)/2,midY=Math.min(prev.y,next.y)-lift;
    const x=(1-t)*(1-t)*prev.x+2*(1-t)*t*midX+t*t*next.x,y=(1-t)*(1-t)*prev.y+2*(1-t)*t*midY+t*t*next.y;
    el('path',{d:'M '+prev.x+' '+prev.y+' Q '+midX+' '+midY+' '+next.x+' '+next.y,fill:'none',stroke:colors[staff],'stroke-width':1.4,opacity:.35},trails);
    el('circle',{cx:x,cy:y,r:17,fill:colors[staff],filter:'url(#halo)',opacity:.85},lights);el('circle',{cx:x,cy:y,r:4.6,fill:'#fff8ed'},lights);
   }else if(a.length){const n=a[a.length-1];el('circle',{cx:n.x+3,cy:n.y-17,r:4.5,fill:'#fff8ed'},lights);}
  }
 }
 const birds=[];let particles=[];
 function buildDecoration(){
  decoration.replaceChildren();birds.length=0;particles=[];
  for(let i=0;i<2;i++){const g=el('g',{},decoration);
   el('path',{d:'M -35 5 L 4 -9 L 30 -5 L 45 -10 L 30 3 L 8 13 L -28 17 L -10 5 Z',fill:'#f6f3ed'},g);
   const wing=el('path',{d:'M -3 1 L -17 -29 L 8 -15 L 21 3 Z',fill:'#fffefa'},g);
   el('path',{d:'M -3 1 L -23 -7 L 8 13 L 19 3 Z',fill:'#c6cad0'},g);birds.push({g,wing});
  }
  for(let i=0;i<22;i++)particles.push(el('circle',{r:1.5+i%3,fill:i%4===0?'#f4cf91':'#f9efff'},decoration));
 }
 function decorate(ms,reduced,energy){
  const t=reduced?0:ms/1000,height=1000*innerHeight/Math.max(1,innerWidth);
  birds.forEach(({g,wing},i)=>{const x=380+i*280+Math.sin(t*.18+i*2)*150,y=height*(i===0?.26:.69)+Math.cos(t*.13+i)*Math.min(45,height*.025);
   g.setAttribute('transform','translate('+x+','+y+') rotate('+(-9+Math.sin(t*.3+i)*7)+') scale('+(i===0?.85:.42)+')');
   wing.setAttribute('transform','translate(0,'+(reduced?0:Math.sin(t*3+i)*3)+')');g.setAttribute('opacity',i===0?.85:.4);
  });
  particles.forEach((n,i)=>{const x=(i*173.51+t*(4+i%4))%1050-25,y=((i*253.17-t*(6+i%5))%(height+50)+(height+50))%(height+50)-25;
   n.setAttribute('cx',x);n.setAttribute('cy',y);n.setAttribute('opacity',reduced?.14:.08+(.5+.5*Math.sin(i*2.7+t*.8))*(.18+energy*.12));
  });
 }
 function summary(){return {ready,generation:latestGeneration,noteCount:notes.length,duration:data?data.duration:0,
  ms:lastFrame?lastFrame.ms:0,playing:lastFrame?lastFrame.playing:false,style:lastFrame?lastFrame.style:0,
  activeCount,activeSources:activeSources.slice(),visibleSegments:visible.slice(),cachedSegments:cache.size,
  renderedGroups:visible.reduce((sum,s)=>sum+(cache.get(s)?cache.get(s).objects.length:0),0),packedGroups,
  domNodes:document.querySelectorAll('*').length,ringCount:lights.querySelectorAll('ellipse[fill="none"]').length,renderCount,cacheHits,lastError,staffAssignment:data?data.staffAssignment:null,
  clock:'original-song-ms',engraving:'duration-glyphs-with-original-onsets',windowMs:16000};}
 function frame(input={}){
  const frameId=finite(input.frameId,0);
  if(!ready){bridge('painted',frameId,lastError||'Scene not loaded');return summary();}
  try{
   const ms=Math.max(0,finite(input.ms)),style=Number(input.style)===1?1:0,reduced=!!input.reducedMotion;
   lastFrame={ms,playing:!!input.playing,style,reducedMotion:reduced,exporting:!!input.exporting};
   scene.classList.toggle('flat',style===1);const t=reduced?0:ms/1000;
   paper.style.transform=style===1?'none':'perspective(1200px) rotateX(12deg) rotateZ('+(-9+Math.sin(t*.06)*1.1)+'deg)';
   updateWindow(ms);activeAt(ms);updateNotes(ms);
   const energy=clamp(finite(input.energy,Math.min(1,activeCount/8)),0,1);decorate(ms,reduced,energy);
   // Host owns the playback clock. rAF reports submission, never advances time.
   if(input.captureVisualBarrier&&input.exporting)bridge('painted',frameId,'');else requestAnimationFrame(()=>bridge('painted',frameId,''));return summary();
  }catch(e){ready=false;bridge('painted',frameId,error(e));return summary();}
 }
 async function load(input){
  latestGeneration=input&&input.generation;const generation=latestGeneration;ready=false;lastError='';
  try{
   if(!input||!Array.isArray(input.notes)||input.notes.length>100000)throw Error('Invalid score event count');
   if(!window.Vex||!window.Vex.Flow)throw Error('Bundled VexFlow did not initialize');
   if(!Number.isFinite(Number(input.duration))||input.duration<0||input.duration>1800000)throw Error('Invalid score duration');
   window.Vex.Flow.setMusicFont('Bravura');
   const faces=await document.fonts.load('16px SceneSC');await document.fonts.ready;if(latestGeneration!==generation)return summary();
   if(!faces.length||!document.fonts.check('16px SceneSC'))throw Error('Bundled licensed scene font did not load');
   data={...input,bpm:clamp(finite(input.bpm,120),1,1000),duration:Number(input.duration)};
   notes=input.notes.map((n,i)=>{
    if(!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127||!Number.isFinite(n.start)||n.start<0||!Number.isFinite(n.duration)||n.duration<=0||n.start+n.duration>1800000)throw Error('Invalid score note '+i);
    return {...n,source:n.source===undefined?i:n.source,staff:Number(n.staff)===1?1:0,velocity:clamp(finite(n.velocity,80),1,127)};
   }).sort((a,b)=>a.start-b.start||a.pitch-b.pitch||a.source-b.source);
   starts=notes.map(n=>n.start);ends=notes.map(n=>n.start+n.duration).sort((a,b)=>a-b);prefix=[];let max=0;
   for(const n of notes){max=Math.max(max,n.start+n.duration);prefix.push(max);}data.duration=Math.max(data.duration,max);
   document.getElementById('title').textContent=String(data.title||'未命名曲目');document.getElementById('empty').style.display=notes.length?'none':'block';
   cache.clear();visible=[];renderCount=0;cacheHits=0;buildStaves();buildDecoration();ready=true;
   frame({ms:0,playing:false,frameId:0});if(lastError)throw Error(lastError);bridge('loaded',generation,'');return summary();
  }catch(e){ready=false;bridge('loaded',generation,error(e));return summary();}
 }
 window.MusicScene={load,frame,inspect:summary};
 function fit(){const portrait=innerHeight>innerWidth;document.getElementById('score').setAttribute('viewBox',portrait?'240 80 700 430':'0 0 1500 580');
  decoration.setAttribute('viewBox','0 0 1000 '+Math.round(1000*innerHeight/Math.max(1,innerWidth)));}
 addEventListener('resize',fit);fit();
 addEventListener('error',e=>{error(e.message||'Local scene asset failed');bridge('loaded',latestGeneration,lastError);},true);
 addEventListener('unhandledrejection',e=>{error(e.reason);bridge('loaded',latestGeneration,lastError);});
})();
