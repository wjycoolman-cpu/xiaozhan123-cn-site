/* Project GPL-3.0; original 0..169 engine and assets stay byte-identical in ../demo/.
 * The only new DSP path is phone 1.0.41 reed presets 170..175. No Web Audio nodes
 * are created here; this same processor is also used by the offline worker. */
import * as original from '../demo/native-synth.js';

// Direct float-precision port of the phone 1.0.41 DeltaHarmonicaSynth.java.
// Corresponding Java source and GPL-3.0 notice: assets/delta-harmonica/source/.
const f=Math.fround,DELTA_RATE=48000,DELTA_N=4096;
const DELTA_SINE=Float32Array.from({length:DELTA_N},(_,i)=>Math.sin(i*Math.PI*2/DELTA_N));
const reedSine=p=>DELTA_SINE[Math.trunc((p-Math.floor(p))*DELTA_N)&(DELTA_N-1)];
export const DELTA_NORMAL_RELEASE=f(Math.exp(Math.log(.0001)/(DELTA_RATE*.30)));
export const DELTA_QUICK_RELEASE=f(Math.exp(Math.log(.0001)/(DELTA_RATE*.010)));
export const isDeltaPreset=preset=>Number.isInteger(preset)&&preset>=170&&preset<=175;
export class DeltaHarmonicaVoice{
 constructor(){this.active=false;}
 start(preset,pitch,velocity){
  if(!isDeltaPreset(preset)||!Number.isInteger(pitch)||pitch<0||pitch>127)throw Error('Invalid reed instrument or pitch');
  this.variant=preset-170;this.phase=this.lfo=0;this.frames=0;this.envelope=1;this.filter=this.breath=0;
  this.step=440*Math.pow(2,(pitch-69)/12)/DELTA_RATE;
  this.gain=f(f(.19)*f(Math.sqrt(f(Math.max(1,Math.min(127,velocity))/f(127)))));
  this.cutoff=f([.21,.09,.36,.12,.07,.19][this.variant]);
  this.noise=(0x1234567^pitch*131^this.variant*713)|0;this.active=true;
 }
 seek(count){for(let i=0;i<count&&this.active;i++)this.next(false,1);}
 next(released=false,releaseMultiplier=DELTA_NORMAL_RELEASE){
  if(!this.active)return 0;
  const flutter=reedSine(this.lfo);this.lfo+=5.1/DELTA_RATE;
  const vibrato=this.frames>DELTA_RATE/5?1+flutter*(this.variant===5?.0035:.0011):1;
  this.phase+=this.step*vibrato;if(this.phase>=1)this.phase-=Math.floor(this.phase);
  let signal=f(f(reedSine(this.phase)+f(reedSine(this.phase*2)*f(this.variant===2?.48:.27)))+f(reedSine(this.phase*3)*f(this.variant===1?.08:.17)));
  if(this.variant===4)signal=f(f(signal*f(.70))+f(reedSine(this.phase*.5)*f(.36)));
  if(this.variant===5)signal=f(signal+f(reedSine(this.phase*1.004+this.lfo*.007)*f(.32)));
  this.noise^=this.noise<<13;this.noise^=this.noise>>>17;this.noise^=this.noise<<5;
  const random=f(f(this.noise)/f(2147483647));this.breath=f(this.breath+f(f(.08)*f(random-this.breath)));
  signal=f(signal+f(this.breath*f(this.variant===3?.23:.055)));
  this.filter=f(this.filter+f(this.cutoff*f(signal-this.filter)));
  const attack=Math.min(1,f(f(this.frames)/f(this.variant===3?2400:720)));
  const swell=f(f(.62)+f(f(.38)*Math.min(1,f(f(this.frames)/f(DELTA_RATE*3.6)))));
  const output=f(f(f(f(this.filter*this.gain)*attack)*swell)*this.envelope);
  this.frames++;if(released){this.envelope=f(this.envelope*releaseMultiplier);if(this.envelope<f(.0001))this.active=false;}
  return output;
 }
}

export class FormalPianoMixer extends AudioWorkletProcessor {
 constructor(){super();original.initialize();this.owners=new Map();this.deltaVoices=[];this.deltaScratch=new Float32Array(128);this.slots=Array(48).fill(null);this.sustain=true;this.volume=.72;this.gm=null;this.ready=false;this.scopePcm=new Float32Array(2048);this.scopeIndex=0;this.scopeSequence=0;this.port.onmessage=e=>this.message(e.data);}
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
   const prior=this.owners.get(m.id);if(prior?.delta){prior.voice.active=false;this.owners.delete(m.id);}
   if(isDeltaPreset(m.preset))this.startReed(m);
   else if(m.preset>=170)throw Error('Unknown reed instrument');
   else if(m.preset>=34&&m.preset<162){
    if(!this.ready)throw Error('采样音色尚未准备好');let slot=this.slots.findIndex((v,i)=>v===null||!this.gm.active(i));if(slot<0)slot=this.slots.findIndex(v=>!v.held);if(slot<0)slot=0;
    const old=this.slots[slot];if(old)this.owners.delete(old.id);
    const v={id:m.id,gm:true,slot,held:true};this.slots[slot]=v;this.owners.set(m.id,v);this.gm.note_on(slot,m.preset-34,m.pitch,m.velocity);
   }else {const key=original.noteOn(m.pitch,m.velocity,m.preset);for(const [id,v]of this.owners)if(!v.gm&&v.key===key)this.owners.delete(id);this.owners.set(m.id,{gm:false,key,held:true});}
  }else if(m.type==='off'){
   const v=this.owners.get(m.id);if(v){v.held=false;if(v.delta){v.released=true;v.releaseStep=m.quick?DELTA_QUICK_RELEASE:DELTA_NORMAL_RELEASE;this.owners.delete(m.id);}else if(v.gm){if(m.quick||!this.sustain)this.gm.note_off(v.slot,m.quick?1:0);}else original.noteOff(v.key,!!m.quick);if(m.quick||!v.gm)this.owners.delete(m.id);}
  }else if(m.type==='tick')original.tick(!!m.accent);
  else if(m.type==='stop'){original.stop();this.gm?.stop_all();for(const v of this.deltaVoices){v.held=false;v.released=true;v.releaseStep=DELTA_QUICK_RELEASE;}this.owners.clear();this.slots.fill(null);}
  if(m.request)this.port.postMessage({request:m.request,ok:true});
 }catch(e){this.port.postMessage({request:m.request,error:String(e.message||e)});}}

 startReed(m){
  this.deltaVoices=this.deltaVoices.filter(v=>v.voice.active);
  if(this.deltaVoices.length>=48){let oldest=this.deltaVoices.find(v=>!v.held)||this.deltaVoices[0];oldest.voice.active=false;if(this.owners.get(oldest.id)===oldest)this.owners.delete(oldest.id);this.deltaVoices=this.deltaVoices.filter(v=>v!==oldest);}
  const voice=new DeltaHarmonicaVoice();voice.start(m.preset,m.pitch,m.velocity);
  const record={id:m.id,delta:true,voice,held:true,released:false,releaseStep:DELTA_NORMAL_RELEASE};
  this.deltaVoices.push(record);this.owners.set(m.id,record);
 }
 mixReeds(out,n){
  if(!this.deltaVoices.length)return;
  if(this.deltaScratch.length<n)this.deltaScratch=new Float32Array(n);this.deltaScratch.fill(0,0,n);
  for(const record of this.deltaVoices){for(let i=0;i<n&&record.voice.active;i++)this.deltaScratch[i]=f(this.deltaScratch[i]+record.voice.next(record.released,record.releaseStep));if(!record.voice.active&&this.owners.get(record.id)===record)this.owners.delete(record.id);}
  for(let i=0;i<n;i++){let value=f(this.deltaScratch[i]*f(this.volume));value=f(value/f(1+Math.abs(value)));const pcm=Math.trunc(f(Math.max(f(-.999),Math.min(f(.999),value))*f(32767)))/32768;out[i]=Math.max(-.999,Math.min(.999,out[i]+pcm));}
  this.deltaVoices=this.deltaVoices.filter(record=>record.voice.active);
 }

 process(inputs,outputs){const out=outputs[0][0];if(!out)return true;const n=out.length,pcm=original.render(n,this.volume);for(let i=0;i<n;i++)out[i]=pcm[i]/32768;
  if(this.ready){const p=this.gm.render(n),gm=new Float32Array(this.gm.memory.buffer,p,n);for(let i=0;i<n;i++){let v=gm[i]*this.volume;v/=1+Math.abs(v);out[i]=Math.max(-.999,Math.min(.999,out[i]+v));}}
  this.mixReeds(out,n);
  for(let i=0;i<n;i++){this.scopePcm[this.scopeIndex++]=out[i];if(this.scopeIndex===2048){const bytes=this.scopePcm.slice().buffer;this.port.postMessage({type:'pcm',sequence:++this.scopeSequence,bytes},[bytes]);this.scopeIndex=0;}}
  for(const channel of outputs[0].slice(1))channel.set(out);return true;}
}
registerProcessor('formal-piano-mixer',FormalPianoMixer);
