/* Port of the existing licensed full-score adapter. VexFlow 4.2.5 (MIT),
 * Bravura glyph outlines (OFL); no Chinese font download for screen rendering. */
const NS='http://www.w3.org/2000/svg';
let loading=null;
export function loadEngraver(){
 if(globalThis.Vex?.Flow)return Promise.resolve(globalThis.Vex.Flow);
 if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('../../demo/assets/native/full-score/vexflow-4.2.5.js',import.meta.url).href;script.onload=()=>{if(globalThis.Vex?.Flow)resolve(globalThis.Vex.Flow);else{script.remove();loading=null;reject(Error('五线谱绘制组件未初始化，可重试'));}};script.onerror=()=>{script.remove();loading=null;reject(Error('五线谱绘制组件加载失败，可重试'));};document.head.append(script);});return loading;
}
 function text(svg,value,x,y,size,anchor='start',color='#3a4b40'){
  const t=document.createElementNS(NS,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('font-size',size);t.setAttribute('text-anchor',anchor);t.setAttribute('fill',color);t.setAttribute('font-family',"'Segoe UI','Microsoft YaHei',system-ui,sans-serif");t.textContent=value;svg.appendChild(t);return t;
 }
 const SHARPS=['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'];
 const FLATS=['c','db','d','eb','e','f','gb','g','ab','a','bb','b'];
 function key(pitch,flat){return (flat?FLATS:SHARPS)[((pitch%12)+12)%12]+'/'+(Math.floor(pitch/12)-1);}
 function duration(t){return String(t.denominator)+(t.dotted?'d':'')+(t.rest?'r':'');}

export async function renderStaff(data,paper){
 await loadEngraver();
   const VF=window.Vex&&window.Vex.Flow;if(!VF||typeof VF.Renderer!=='function')throw Error('Bundled VexFlow did not initialize');VF.setMusicFont('Bravura');


   while(paper.firstChild)paper.removeChild(paper.firstChild);
   const renderer=new VF.Renderer(paper,VF.Renderer.Backends.SVG);renderer.resize(595,842);
   const context=renderer.getContext();context.setFillStyle('#162d20');context.setStrokeStyle('#203e2b');context.setFont('Segoe UI',10,'');
   const svg=paper.querySelector('svg');svg.setAttribute('viewBox','0 0 595 842');
   const title=Array.from(data.title),titleNode=text(svg,data.title,297.5,40,23,'middle','#222824');
   if(titleNode.getComputedTextLength()>523){let lo=0,hi=title.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);titleNode.textContent=title.slice(0,mid).join('')+'…';if(titleNode.getComputedTextLength()<=523)lo=mid;else hi=mid-1;}titleNode.textContent=title.slice(0,lo).join('')+'…';}
   text(svg,data.meta,36,62,11);text(svg,data.notice,36,80,8.5,'start','#687067');
   text(svg,'实际音高记谱；不按手机琴键的八度折回显示。弧线为同一次发声的跨拍延长。',36,95,8,'start','#687067');
   if(data.fontWarning)text(svg,data.fontWarning,36,109,8,'start','#8a5429');
   let heads=0;
   const [numerator,denominator]=data.meter.split('/').map(Number);
   const flat=data.flats||['Db','Eb','F','Gb','Ab','Bb'].includes(data.key);
   for(const system of data.systems){
    for(const b of system.boxes)text(svg,b.measure+(b.continuedBefore?'（续）':''),b.x+3,system.y+12,9,'start','#748174');
    const ledgers=system.rows.map(()=>new Map());
    for(let col=0;col<system.boxes.length;col++){
     const b=system.boxes[col],voices=[],rows=[];
     for(let rowIndex=0;rowIndex<system.rows.length;rowIndex++){
      const row=system.rows[rowIndex];
      if(col===0)text(svg,row.label,36,row.y+22,9,'start','#657367');
      const stave=new VF.Stave(b.x,row.staveY,b.width,{left_bar:!b.continuedBefore,right_bar:!b.continuedAfter});
      if(col===0){stave.addClef(row.clef);stave.addKeySignature(data.key);stave.addTimeSignature(data.meter);}
      else stave.setClef(row.clef);
      if(b.continuedBefore)stave.setBegBarType(VF.Barline.type.NONE);
      if(b.continuedAfter)stave.setEndBarType(VF.Barline.type.NONE);
      stave.setContext(context).draw();
      const notes=[],sourceTokens=row.cells[col];
      for(const t of sourceTokens){
       let n;
       if(t.ghost||(row.firstHead>0&&t.rest)){n=new VF.GhostNote({duration:duration(t).replace('r','')});}
       else if(t.rest){n=new VF.StaveNote({keys:[row.clef==='bass'?'d/3':'b/4'],duration:duration(t),clef:row.clef});}
       else{
        n=new VF.StaveNote({keys:t.notes.map(p=>key(p.pitch,flat)),duration:duration(t),clef:row.clef,auto_stem:true});
        heads+=t.notes.length;
       }
       // A whole-measure rest uses a whole-rest glyph even in 3/4 or 6/8.
       // Layout time still exactly equals this slice, including ghost placeholders.
       n.setIntrinsicTicks(t.ticks*VF.RESOLUTION/384);n.setStave(stave);
       if(t.dotted&&!t.ghost&&!(row.firstHead>0&&t.rest))VF.Dot.buildAndAttach([n],{all:true});
       notes.push(n);
      }
      const voice=new VF.Voice({num_beats:numerator,beat_value:denominator}).setMode(VF.Voice.Mode.SOFT).addTickables(notes);
      VF.Accidental.applyAccidentals([voice],data.key);
      voices.push(voice);rows.push({rowIndex,row,stave,notes,sourceTokens});
     }
     // Formatting all staves together aligns simultaneous notes across voices.
     const start=Math.max(...rows.map(r=>r.stave.getNoteStartX()));
     rows.forEach(r=>r.stave.setNoteStartX(start));
     const formatter=new VF.Formatter();voices.forEach(v=>formatter.joinVoices([v]));
     formatter.format(voices,Math.max(10,b.x+b.width-start-14));
     rows.forEach((r,at)=>{
      const compound=denominator===8&&numerator>3&&numerator%3===0;
      const beams=r.notes.some(note=>note instanceof VF.GhostNote)?[]:VF.Beam.generateBeams(r.notes,{groups:[new VF.Fraction(compound?3:1,denominator)]});
      voices[at].draw(context,r.stave);beams.forEach(beam=>beam.setContext(context).draw());
      const ledger=ledgers[r.rowIndex];
      r.sourceTokens.forEach((t,index)=>{
       if(t.rest||t.ghost)return;const n=r.notes[index];
       t.notes.forEach((p,head)=>{
        if(t.tieIn){const previous=ledger.get(p.source);new VF.StaveTie({first_note:previous?previous.note:undefined,last_note:n,first_indices:[previous?previous.head:head],last_indices:[head]}).setContext(context).draw();}
        if(t.tieOut)ledger.set(p.source,{note:n,head});else ledger.delete(p.source);
        if(p.unisons>1){context.save();context.setFont('Segoe UI',6,'');context.fillText('×'+p.unisons,n.getAbsoluteX()-4,n.getYs()[head]-9);context.restore();}
       });
      });
     });
    }
    for(const ledger of ledgers)for(const item of ledger.values())new VF.StaveTie({first_note:item.note,last_note:undefined,first_indices:[item.head],last_indices:[item.head]}).setContext(context).draw();
   }
   text(svg,data.footer,36,815,8,'start','#687668');text(svg,(data.page+1)+' / '+data.count+' 页',559,815,9,'end','#405e49');
   text(svg,'离线排版 · VexFlow 4.2.5 / MIT · Bravura / OFL 1.1 · 系统字体',36,829,7.5,'start','#7b847b');

 return svg;
}
