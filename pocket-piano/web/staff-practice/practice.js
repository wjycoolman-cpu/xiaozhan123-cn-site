/* Pocket Piano practice adapter. Engraving: bundled VexFlow 4.2.5 (MIT).
   Font and library notices remain in ../full-score/. No score/audio network access. */
'use strict';
(() => {
 const NS='http://www.w3.org/2000/svg', paper=document.getElementById('paper');
 const viewport=document.getElementById('viewport'),errorBox=document.getElementById('error');
 const status=document.getElementById('status'),hint=document.getElementById('hint'),position=document.getElementById('position');
 const SHARPS=['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'];
 const FLATS=['c','db','d','eb','e','f','gb','g','ab','a','bb','b'];
 let payload=null,lastFrame=null,rendered=null,loadToken=0,active=true,closed=false,ready=false;
 let records=[],anchors=[],sourceIndex={},cursor=null,svg=null,logicalWidth=595,logicalHeight=180,viewY=0;
 let error='',errors=[],lastFocus='',serial=Promise.resolve();
 const nums=a=>Array.isArray(a)?a.map(Number).filter(Number.isFinite):[];
 const modeName=m=>(m===1||m==='AUTO')?'AUTO':(m===2||m==='FOLLOW')?'FOLLOW':'FREE';
 const twoFrames=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 function enqueue(action){
  // Native frames, system changes and layout rebuilds share one ordered lane.
  // A resize must never invalidate an outstanding native painted callback.
  const work=serial.then(()=>closed?undefined:action());serial=work.catch(fail);return work;
 }
 function bridge(name,...args){const host=window.StaffPracticeReady;if(host&&typeof host[name]==='function')host[name](...args);}
 function fail(reason){error=String(reason&&reason.message||reason||'谱面未能显示').slice(0,500);errors.push(error);if(errors.length>12)errors.shift();ready=false;errorBox.textContent='谱面暂不可用：'+error;errorBox.style.display='block';}
 addEventListener('error',event=>{const target=event.target;fail(event.message||(target&&target.src?'无法载入本地谱面组件':'谱面运行错误'));},true);
 addEventListener('unhandledrejection',event=>fail(event.reason));
 function key(pitch,flat){return (flat?FLATS:SHARPS)[((pitch%12)+12)%12]+'/'+(Math.floor(pitch/12)-1);}
 function duration(t){return String(t.denominator)+(t.dotted?'d':'')+(t.rest?'r':'');}
 function node(tag,attrs,parent=svg){const el=document.createElementNS(NS,tag);for(const k in attrs)el.setAttribute(k,attrs[k]);parent.appendChild(el);return el;}
 function text(value,x,y,size=9,color='#7a858b'){const el=node('text',{x,y,'font-size':size,fill:color});el.textContent=value;return el;}
 function groupRows(rows){
  // FullScoreDocument splits very tall chords across rows for A4 export. Rejoin
  // those exact voice fragments; different voices keep their independent timing.
  const map=new Map();
  for(const row of rows){
   let combined=map.get(row.voiceId);
   if(!combined){combined={voiceId:row.voiceId,clef:row.clef,cells:row.cells.map(cell=>cell.map(t=>({...t,notes:[...(t.notes||[])]})))};map.set(row.voiceId,combined);}
   else row.cells.forEach((cell,col)=>cell.forEach((t,i)=>{
    const dst=combined.cells[col][i];if(!dst||dst.startTick!==t.startTick||dst.ticks!==t.ticks)throw Error('同声部的曲谱片段时间不一致');
    const known=new Set(dst.notes.map(n=>n.source));for(const n of t.notes||[])if(!known.has(n.source)){dst.notes.push(n);known.add(n.source);}
    dst.ghost=!dst.rest&&!dst.notes.length;
   }));
  }
  return [...map.values()];
 }
 function soundingAt(record,ms){return ms>=record.startMs&&ms<record.startMs+Math.max(1,record.durationMs);}
 function actualTime(f){
  let ms=Math.max(0,Number(f.ms)||0);
  if(!f.exporting&&modeName(f.mode)==='AUTO'&&f.playing){
   const age=f.sampleEpochMs?Math.max(0,Math.min(250,Date.now()-f.sampleEpochMs)):0;
   ms+=age*Math.max(0,Number(f.speed)||1);
  }
  return Math.min(ms,Number(payload.durationMs)||ms);
 }
 function geometry(){return {width:viewport.clientWidth,height:viewport.clientHeight,scrollTop:viewport.scrollTop,scrollHeight:viewport.scrollHeight,logicalWidth,logicalHeight,viewY,scale:paper.clientWidth/logicalWidth};}
 function visibleSources(){
  const bounds=viewport.getBoundingClientRect(),visible=new Set();
  for(const r of records){const b=r.marker.getBoundingClientRect();if(b.bottom>bounds.top&&b.top<bounds.bottom&&b.right>bounds.left&&b.left<bounds.right)visible.add(r.source);}
  return [...visible].sort((a,b)=>a-b);
 }
 function focusOn(f,ms){
  const wanted=nums(f.currentSources),next=nums(f.nextSources),follow=modeName(f.mode)==='FOLLOW';
  let choices=records.filter(r=>wanted.includes(r.source));
  if(!choices.length&&Number(f.focusSource)>=0)choices=records.filter(r=>r.source===Number(f.focusSource));
  if(!choices.length&&!follow)choices=records.filter(r=>soundingAt(r,ms));
  if(!choices.length)choices=records.filter(r=>next.includes(r.source));
  if(!choices.length)return;
  const focusKey=choices.map(r=>r.source).join(',');if(focusKey===lastFocus)return;lastFocus=focusKey;
  const ys=choices.map(r=>r.y),scale=paper.clientWidth/logicalWidth;
  const top=(Math.min(...ys)-viewY-22)*scale,bottom=(Math.max(...ys)-viewY+22)*scale;
  if(top<viewport.scrollTop||bottom>viewport.scrollTop+viewport.clientHeight){
   // Instant positioning is also deterministic during offline export. User
   // scrolling is respected until the actual target changes.
   viewport.scrollTop=Math.max(0,(top+bottom-viewport.clientHeight)/2);
  }
 }
 function cursorX(ms,f){
  const wanted=new Set(nums(f.currentSources));
  if(modeName(f.mode)==='FOLLOW'){
   const matches=records.filter(r=>wanted.has(r.source));if(matches.length)return Math.min(...matches.map(r=>r.x));
   if(Number(f.targetTime)>=0)ms=Number(f.targetTime);
  }
  if(!anchors.length)return 45;
  let previous=anchors[0];for(const a of anchors){if(a.ms>ms){const amount=Math.max(0,Math.min(1,(ms-previous.ms)/Math.max(1,a.ms-previous.ms)));return previous.x+(a.x-previous.x)*amount;}previous=a;}
  return previous.x;
 }
 function draw(f){
  if(!ready||!payload)return null;
  const ms=actualTime(f),mode=modeName(f.mode),held=new Set(nums(f.held)),automatic=new Set(nums(f.automatic));
  const wanted=new Set(nums(f.currentSources)),next=new Set(nums(f.nextSources)),accepted=new Set(nums(f.acceptedSources));
  const played=new Set(),pending=new Set(),headStates=new Map(),rank={'':0,next:1,expected:2,played:3};
  for(const r of records){
   // Guide owns acceptance of each attack. A pitch held across an onset change
   // must not count as a fresh press of that pitch in the next score group.
   const current=wanted.has(r.source),atTime=soundingAt(r,ms);
   const isPlayed=mode==='FOLLOW'?accepted.has(r.source):held.has(r.pitch)&&atTime||mode==='AUTO'&&automatic.has(r.pitch)&&atTime;
   const state=isPlayed?'played':mode==='FOLLOW'&&current?'expected':mode==='FOLLOW'&&next.has(r.source)?'next':'';
   r.marker.setAttribute('data-state',state);
   if(r.head&&(!headStates.has(r.head)||rank[state]>rank[headStates.get(r.head)]))headStates.set(r.head,state);
   if(isPlayed)played.add(r.source);if(state==='expected')pending.add(r.source);
  }
  for(const [head,state] of headStates)head.setAttribute('data-state',state);
  const x=cursorX(ms,f);cursor.setAttribute('x1',x);cursor.setAttribute('x2',x);cursor.style.display=mode==='FREE'?'none':'';
  status.textContent=mode==='FOLLOW'?'跟弹 · 等你按对':mode==='AUTO'?(f.playing?'自动演奏':'自动 · 已暂停'):'自由演奏';
  hint.textContent=mode==='FOLLOW'?'虚线待弹 · 蓝色本组已按':'蓝色发声 · 高低声部';
  position.textContent=(payload.systemIndex+1)+' / '+payload.systemCount+(payload.sameTimeParts>1&&!payload.sameTimePartsMerged?' · 声部 '+(payload.sameTimePart+1)+'/'+payload.sameTimeParts:'');
  focusOn(f,ms);
  return {frameId:f.frameId,generation:payload.generation,systemIndex:payload.systemIndex,songId:payload.songId,sourceNoteCount:payload.sourceNoteCount,
   displayedMs:ms,sampleEpochMs:Number(f.sampleEpochMs)||0,mode,playing:!!f.playing,speed:Number(f.speed)||1,exporting:!!f.exporting,
   currentSources:nums(f.currentSources),nextSources:nums(f.nextSources),acceptedSources:nums(f.acceptedSources),expected:nums(f.expected),nextExpected:nums(f.nextExpected),
   held:[...held],automatic:[...automatic],playedSources:[...played],pendingSources:[...pending],cursorX:x,
   visibleSources:visibleSources(),viewport:geometry(),drawnAtEpochMs:Date.now()};
 }
 async function render(data,notify=true){
  const token=++loadToken;ready=false;payload=data;lastFocus='';
  error='';errorBox.style.display='none';records=[];anchors=[];sourceIndex={};
  try{
   const VF=window.Vex&&window.Vex.Flow;if(!VF)throw Error('VexFlow 未能载入');VF.setMusicFont('Bravura');
   const faces=await document.fonts.load('12px ScoreSC');await document.fonts.ready;
   if(!faces.length)throw Error('本地谱面字体未能载入');if(token!==loadToken||closed)return;
   const system=data.systems&&data.systems[0];if(!system||!system.boxes.length)throw Error('没有可显示的谱段');
   paper.replaceChildren();logicalWidth=Math.max(595,viewport.clientWidth);logicalHeight=200;viewY=0;
   const renderer=new VF.Renderer(paper,VF.Renderer.Backends.SVG);renderer.resize(logicalWidth,logicalHeight);
   const context=renderer.getContext();context.setFillStyle('#25333e');context.setStrokeStyle('#25333e');context.setFont('ScoreSC',9,'');
   svg=paper.querySelector('svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','演奏五线谱：'+data.title);
   const rows=groupRows(system.rows),clefs=['treble','bass'].filter(c=>rows.some(r=>r.clef===c));
   const [numerator,denominator]=data.meter.split('/').map(Number),flat=data.flats||['Db','Eb','F','Gb','Ab','Bb'].includes(data.key);
   const origin=system.boxes[0].x,right=Math.max(...system.boxes.map(b=>b.x+b.width));
   const mapX=x=>30+(x-origin)*(logicalWidth-46)/(right-origin);
   const clefY={treble:-5,bass:clefs.includes('treble')?72:-5};
   const ledgers=rows.map(()=>new Map());let allNotes=[];
   for(let col=0;col<system.boxes.length;col++){
    const box=system.boxes[col],bx=mapX(box.x),bw=mapX(box.x+box.width)-bx;
    text(box.measure+(box.continuedBefore?' 续':''),bx+3,12);
    const staves=new Map();
    for(const clef of clefs){
     const stave=new VF.Stave(bx,clefY[clef],bw,{left_bar:!box.continuedBefore,right_bar:!box.continuedAfter});
     if(col===0){stave.addClef(clef);stave.addKeySignature(data.key);stave.addTimeSignature(data.meter);}
     if(box.continuedBefore)stave.setBegBarType(VF.Barline.type.NONE);if(box.continuedAfter)stave.setEndBarType(VF.Barline.type.NONE);
     stave.setContext(context).draw();staves.set(clef,stave);
    }
    if(col===0&&staves.size===2)new VF.StaveConnector(staves.get('treble'),staves.get('bass')).setType(VF.StaveConnector.type.BRACE).setContext(context).draw();
    const voiceRows=rows.map((row,rowIndex)=>{
     const peers=rows.filter(r=>r.clef===row.clef),voiceIndex=peers.indexOf(row),stave=staves.get(row.clef);
     const sourceTokens=row.cells[col],notes=sourceTokens.map(t=>{
      let n;const ghost=t.ghost||(voiceIndex>0&&t.rest);
      if(ghost)n=new VF.GhostNote({duration:duration(t).replace('r','')});
      else if(t.rest)n=new VF.StaveNote({keys:[row.clef==='bass'?'d/3':'b/4'],duration:duration(t),clef:row.clef});
      else n=new VF.StaveNote({keys:t.notes.map(p=>key(p.pitch,flat)),duration:duration(t),clef:row.clef,
       auto_stem:peers.length===1,stem_direction:peers.length>1?(voiceIndex%2===0?1:-1):undefined});
      n.setIntrinsicTicks(t.ticks*VF.RESOLUTION/384);n.setStave(stave);if(t.dotted&&!ghost)VF.Dot.buildAndAttach([n],{all:true});return n;
     });
     const voice=new VF.Voice({num_beats:numerator,beat_value:denominator}).setMode(VF.Voice.Mode.SOFT).addTickables(notes);
     return {row,rowIndex,stave,notes,sourceTokens,voice};
    });
    for(const clef of clefs)VF.Accidental.applyAccidentals(voiceRows.filter(r=>r.row.clef===clef).map(r=>r.voice),data.key);
    const start=Math.max(...[...staves.values()].map(s=>s.getNoteStartX()));for(const s of staves.values())s.setNoteStartX(start);
    const formatter=new VF.Formatter();for(const clef of clefs)formatter.joinVoices(voiceRows.filter(r=>r.row.clef===clef).map(r=>r.voice));
    formatter.format(voiceRows.map(r=>r.voice),Math.max(10,bx+bw-start-14));
    for(const r of voiceRows){
     const compound=denominator===8&&numerator>3&&numerator%3===0;
     const beams=r.notes.some(n=>n instanceof VF.GhostNote)?[]:VF.Beam.generateBeams(r.notes,{groups:[new VF.Fraction(compound?3:1,denominator)],maintain_stem_directions:true});
     r.voice.draw(context,r.stave);beams.forEach(b=>b.setContext(context).draw());
     const ledger=ledgers[r.rowIndex];
     r.sourceTokens.forEach((t,index)=>{
      const n=r.notes[index];if(t.rest||t.ghost)return;
      const noteElement=n.getSVGElement&&n.getSVGElement(),heads=noteElement?[...noteElement.querySelectorAll('.vf-notehead')]:[];
      t.notes.forEach((p,head)=>{
       if(t.tieIn){const previous=ledger.get(p.source);new VF.StaveTie({first_note:previous?previous.note:undefined,last_note:n,first_indices:[previous?previous.head:head],last_indices:[head]}).setContext(context).draw();}
       if(t.tieOut)ledger.set(p.source,{note:n,head});else ledger.delete(p.source);
       const headElement=heads[head]||null;
       if(headElement){headElement.classList.add('source-head');headElement.setAttribute('data-source',p.source);}
       const noteHead=n.noteHeads&&n.noteHeads[head]||n.note_heads&&n.note_heads[head];
       let x=n.getAbsoluteX()+5;if(noteHead&&typeof noteHead.getAbsoluteX==='function')x=noteHead.getAbsoluteX()+5;
       const y=n.getYs()[head];
       const events=Array.isArray(p.events)&&p.events.length?p.events:[[p.source,p.startMs,p.durationMs]];
       if(headElement)headElement.setAttribute('data-sources',events.map(e=>e[0]).join(','));
       for(const e of events){
        const record={source:Number(e[0]),pitch:Number(p.pitch),startMs:Number(e[1]),durationMs:Number(e[2]),x,y,head:headElement};
        records.push(record);sourceIndex[e[0]]={pitch:p.pitch,startMs:e[1],durationMs:e[2],voiceId:r.row.voiceId,clef:r.row.clef};
        allNotes.push({record,n});
       }
       if(p.unisons>1)text('×'+p.unisons,x-5,y-10,6);
      });
      // Quantized token position controls the cursor; sound highlights use the
      // original source milliseconds, including tied continuations.
      anchors.push({ms:box.startMs+(t.startTick-box.start)/(box.end-box.start)*(box.endMs-box.startMs),x:n.getAbsoluteX()+5});
     });
    }
    anchors.push({ms:box.endMs,x:bx+bw-5});
   }
   for(const ledger of ledgers)for(const item of ledger.values())new VF.StaveTie({first_note:item.note,last_note:undefined,first_indices:[item.head],last_indices:[item.head]}).setContext(context).draw();
   anchors.sort((a,b)=>a.ms-b.ms||a.x-b.x);anchors=anchors.filter((a,i)=>!i||a.ms!==anchors[i-1].ms);
   const drawing=svg.getBBox();viewY=Math.min(0,drawing.y-10);logicalHeight=Math.max(170,drawing.y+drawing.height+15-viewY);
   // Fit this two-stave system, including stems/beams and ledger lines, to both
   // dimensions. Head visibility alone is insufficient: scroll-based following
   // can otherwise crop a preceding beam in a compact landscape viewport.
   const fit=Math.min(viewport.clientWidth/logicalWidth,viewport.clientHeight/logicalHeight);
   const displayWidth=logicalWidth*fit,displayHeight=logicalHeight*fit;
   svg.setAttribute('viewBox','0 '+viewY+' '+logicalWidth+' '+logicalHeight);svg.setAttribute('width','100%');svg.setAttribute('height',displayHeight);
   svg.style.width='100%';svg.style.height=displayHeight+'px';
   paper.style.width=displayWidth+'px';paper.style.height=displayHeight+'px';viewport.scrollTop=0;
   cursor=node('line',{id:'cursor',x1:45,x2:45,y1:18,y2:logicalHeight+viewY-9});
   for(const {record:r} of allNotes)r.marker=node('ellipse',{'data-source':r.source,class:'note-target',cx:r.x,cy:r.y,rx:9,ry:7});
   ready=true;await twoFrames();if(token!==loadToken||closed)return;
   if(notify)bridge('loaded',data.generation,data.systemIndex,'');
  }catch(e){if(token===loadToken){fail(e);if(notify)bridge('loaded',data.generation,data.systemIndex,error);}}
 }
 async function paint(f,notify){
  if(closed)return;
  if(!payload||f.generation!==payload.generation||f.systemIndex!==payload.systemIndex){if(notify)bridge('painted',f.frameId,'谱段与播放位置不匹配');return;}
  if(!ready){if(notify)bridge('painted',f.frameId,error||'谱面尚未就绪');return;}
  lastFrame=f;
  try{const snapshot=draw(f);await twoFrames();if(closed)return;
   rendered={...snapshot,visibleSources:visibleSources(),viewport:geometry(),paintedAtEpochMs:Date.now()};if(notify)bridge('painted',f.frameId,'');
  }catch(e){fail(e);if(notify)bridge('painted',f.frameId,error);}
 }
 window.StaffPractice={loadSystem:data=>enqueue(()=>render(data)),frame:f=>enqueue(()=>paint(f,true)),
  setActive:value=>{active=!!value;},
  close:()=>{closed=true;active=false;ready=false;loadToken++;paper.replaceChildren();records=[];},
  inspect:()=>({version:'staff-practice-1',active,closed,ready,error,errors:[...errors],rendered:rendered?{...rendered}:null,
   ...(rendered||{}),loadedGeneration:payload&&payload.generation,loadedSystemIndex:payload&&payload.systemIndex,
   renderedSourceCount:new Set(records.map(r=>r.source)).size,sourceIndex:{...sourceIndex},viewport:geometry(),visibleSources:visibleSources()})};
 let resizeTimer=0,resizeQueued=false,resizeNeeded=false;
 function scheduleResize(){
  if(resizeQueued||closed)return;resizeQueued=true;
  enqueue(async()=>{
   resizeNeeded=false;if(!payload)return;const data=payload,f=lastFrame;
   await render(data,false);if(f&&ready&&!closed)await paint(f,false);
  }).finally(()=>{resizeQueued=false;if(resizeNeeded&&!closed)scheduleResize();});
 }
 addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!payload||closed)return;resizeNeeded=true;scheduleResize();},100);});
})();
