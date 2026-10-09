import * as original from './native-synth.js';
class FormalPianoMixer extends AudioWorkletProcessor {
 constructor(){super();original.initialize();this.owners=new Map();this.slots=Array(48).fill(null);this.sustain=true;this.volume=.72;this.gm=null;this.ready=false;this.scopePcm=new Float32Array(2048);this.scopeIndex=0;this.scopeSequence=0;this.port.onmessage=e=>this.message(e.data);}
 message(m){try{
  if(m.type==='wasm'){
   const env={pp_pow:Math.pow,pp_powf:(a,b)=>Math.fround(Math.pow(a,b)),pp_expf:a=>Math.fround(Math.exp(a)),pp_log:Math.log,pp_tan:Math.tan,pp_log10:Math.log10,pp_sqrtf:a=>Math.fround(Math.sqrt(a))};
   this.gm=new WebAssembly.Instance(new WebAssembly.Module(m.bytes),{env}).exports;
  }else if(m.type==='bank'){
   const p=this.gm.allocate(m.bytes.byteLength);if(!p)throw Error('乐器采样内存不足');new Uint8Array(this.gm.memory.buffer,p,m.bytes.byteLength).set(new Uint8Array(m.bytes));if(!this.gm.load_bank(p,m.bytes.byteLength))throw Error('正式采样库无法加载');this.ready=true;
  }else if(m.type==='sample')original.loadSample(m.index,new Int16Array(m.bytes));
  else if(m.type==='volume')this.volume=m.value;
  else if(m.type==='sustain'){
   this.sustain=m.value;original.setSustain(m.value);if(!m.value)for(const [id,v]of this.owners)if(v.gm&&!v.held)this.gm.note_off(v.slot,0);
  }else if(m.type==='on'){
   if(m.preset>=34&&m.preset<162){
    if(!this.ready)throw Error('采样音色尚未准备好');let slot=this.slots.findIndex((v,i)=>v===null||!this.gm.active(i));if(slot<0)slot=this.slots.findIndex(v=>!v.held);if(slot<0)slot=0;
    const old=this.slots[slot];if(old)this.owners.delete(old.id);
    const v={id:m.id,gm:true,slot,held:true};this.slots[slot]=v;this.owners.set(m.id,v);this.gm.note_on(slot,m.preset-34,m.pitch,m.velocity);
   }else {const key=original.noteOn(m.pitch,m.velocity,m.preset);for(const [id,v]of this.owners)if(!v.gm&&v.key===key)this.owners.delete(id);this.owners.set(m.id,{gm:false,key,held:true});}
  }else if(m.type==='off'){
   const v=this.owners.get(m.id);if(v){v.held=false;if(v.gm){if(m.quick||!this.sustain)this.gm.note_off(v.slot,m.quick?1:0);}else original.noteOff(v.key,!!m.quick);if(m.quick||!v.gm)this.owners.delete(m.id);}
  }else if(m.type==='tick')original.tick(!!m.accent);
  else if(m.type==='stop'){original.stop();this.gm?.stop_all();this.owners.clear();this.slots.fill(null);}
  if(m.request)this.port.postMessage({request:m.request,ok:true});
 }catch(e){this.port.postMessage({request:m.request,error:String(e.message||e)});}}
 process(inputs,outputs){const out=outputs[0][0];if(!out)return true;const n=out.length,pcm=original.render(n,this.volume);for(let i=0;i<n;i++)out[i]=pcm[i]/32768;
  if(this.ready){const p=this.gm.render(n),gm=new Float32Array(this.gm.memory.buffer,p,n);for(let i=0;i<n;i++){let v=gm[i]*this.volume;v/=1+Math.abs(v);out[i]=Math.max(-.999,Math.min(.999,out[i]+v));}}
  for(let i=0;i<n;i++){this.scopePcm[this.scopeIndex++]=out[i];if(this.scopeIndex===2048){const bytes=this.scopePcm.slice().buffer;this.port.postMessage({type:'pcm',sequence:++this.scopeSequence,bytes},[bytes]);this.scopeIndex=0;}}
  for(const channel of outputs[0].slice(1))channel.set(out);return true;}
}
registerProcessor('formal-piano-mixer',FormalPianoMixer);
