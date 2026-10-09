/* Formal Java mixer compiled by TeaVM + unchanged TinySoundFont WASM.
 * No generic oscillator fallback: a failed asset reports an actual error. */
export class PianoAudio {
 constructor(onStatus=()=>{}){this.context=null;this.master=null;this.node=null;this.voices=new Map();this.bytes=new Map();this.loaded=new Set();this._tone=0;this.volume=.72;this._sustain=true;this.onStatus=onStatus;this.requests=new Map();this.sequence=0;this.stats={started:0,released:0,sampleVoices:0,synthVoices:0};}
 get tone(){return this._tone;}set tone(v){this._tone=Number(v)||0;}
 get sustain(){return this._sustain;}set sustain(v){this._sustain=!!v;this.node?.port.postMessage({type:'sustain',value:!!v});}
 contextForGesture(){if(!this.context){const A=window.AudioContext||window.webkitAudioContext;if(!A)throw Error('浏览器不支持网页音频');this.context=new A({sampleRate:48000,latencyHint:'interactive'});}return this.context;}
 async unlock(){const c=this.contextForGesture();await c.resume();if(!this.boot)this.boot=(async()=>{
  if(c.sampleRate!==48000)throw Error('浏览器未提供正式引擎要求的 48 kHz 音频');
  await c.audioWorklet.addModule('native-audio-worklet.js');this.node=new AudioWorkletNode(c,'formal-piano-mixer',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1]});this.node.connect(c.destination);
  this.node.port.onmessage=e=>{const m=e.data;if(m.type==='pcm'){this.pcm=new Float32Array(m.bytes);this.pcmSequence=m.sequence;return;}const p=this.requests.get(m.request);if(p){this.requests.delete(m.request);clearTimeout(p.timer);m.error?p.reject(Error(m.error)):p.resolve();}else if(m.error)this.onStatus(m.error);};
  this.node.onprocessorerror=()=>this.onStatus('声音处理器中断，请重新打开页面');
  const wasm=await this.getBytes('native-gm.wasm');await this.send({type:'wasm',bytes:wasm.slice(0)});this.sustain=this._sustain;this.setVolume(this.volume);
 })().catch(e=>{this.boot=null;throw e;});await this.boot;return c;}
 send(m){const request=++this.sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.requests.delete(request);reject(Error('声音引擎加载超时'));},15000);this.requests.set(request,{resolve,reject,timer});this.node.port.postMessage({...m,request},m.bytes?[m.bytes]:[]);});}
 async getBytes(path){if(!this.bytes.has(path)){const p=(async()=>{const response=await fetch(path,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('音色资源加载失败：'+response.status);return response.arrayBuffer();})();this.bytes.set(path,p);p.catch(()=>this.bytes.delete(path));}return this.bytes.get(path);}
 samplePitch(p){return Math.max(21,Math.min(108,21+3*Math.round((p-21)/3)));}
 fetchSample(p){return this.getBytes(`assets/piano/${String(this.samplePitch(p)).padStart(3,'0')}.bin`);}
 async prepare(pitches){await this.unlock();const tone=this._tone;
  if(tone>=34&&tone<162){if(!this.bankReady)this.bankReady=this.getBytes('assets/soundfont/TimGM6mb.sf2').then(bytes=>this.send({type:'bank',bytes:bytes.slice(0)})).catch(e=>{this.bankReady=null;throw e;});await this.bankReady;return;}
  if(![0,4,5,12,13,14].includes(tone))return;
  await Promise.all([...new Set(pitches.map(p=>this.samplePitch(p)))].map(async p=>{if(this.loaded.has(p))return;const bytes=await this.fetchSample(p),view=new DataView(bytes);let at=12,data;
   while(at+8<=bytes.byteLength){const tag=view.getUint32(at,false),length=view.getUint32(at+4,true);if(tag===0x64617461){data=bytes.slice(at+8,at+8+length);break;}at+=8+length+(length&1);}
   if(!data||data.byteLength%2)throw Error('钢琴采样格式无效');await this.send({type:'sample',index:Math.round((p-21)/3),bytes:data});this.loaded.add(p);
  }));}
 setVolume(v){this.volume=Math.max(0,Math.min(1,v));this.node?.port.postMessage({type:'volume',value:this.volume});}
 async on(id,pitch,velocity=90,scheduled=0){if(this.voices.has(id))return;const v={id,pitch,pending:true};this.voices.set(id,v);try{await this.prepare([pitch]);if(this.voices.get(id)!==v)return;v.pending=false;
   const start=()=>{if(this.voices.get(id)!==v)return;this.node.port.postMessage({type:'on',id,pitch,velocity,preset:this._tone});this.stats.started++;this.stats[this._tone>=34&&this._tone<162?'sampleVoices':'synthVoices']++;};
   const delay=Math.max(0,(scheduled-this.context.currentTime)*1000);if(delay>2)v.onTimer=setTimeout(start,delay);else start();return v;
  }catch(e){if(this.voices.get(id)===v)this.voices.delete(id);this.onStatus(e.message);}}
 off(id,immediate=false,scheduled=0){const v=this.voices.get(id);if(!v)return;const delay=Math.max(0,(scheduled-(this.context?.currentTime||0))*1000);if(delay>10){clearTimeout(v.offTimer);v.offTimer=setTimeout(()=>this.off(id,immediate),delay);return;}clearTimeout(v.onTimer);clearTimeout(v.offTimer);this.voices.delete(id);if(!v.pending)this.node?.port.postMessage({type:'off',id,quick:!!immediate});this.stats.released++;}
 stop(){for(const v of this.voices.values()){clearTimeout(v.onTimer);clearTimeout(v.offTimer);}this.voices.clear();this.node?.port.postMessage({type:'stop'});}
 inspect(){return{voices:this.voices.size,context:this.context?.state||'uninitialized',volume:this.volume,preset:this._tone,engine:'formal-java-and-tsf',...this.stats};}
}
