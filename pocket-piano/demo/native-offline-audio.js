// Reuse the actual AudioWorklet mixer in an isolated worker for offline output.
let Processor;
globalThis.AudioWorkletProcessor=class{constructor(){this.port={postMessage(message){if(message.error)throw Error(message.error);}};}};
globalThis.registerProcessor=(_name,implementation)=>{Processor=implementation;};
await import('./native-audio-worklet.js');
async function bytes(path){const response=await fetch(path);if(!response.ok)throw Error('音色资源读取失败：'+path);return response.arrayBuffer();}
self.onmessage=async event=>{
 try{
  const {notes,preset=0,volume=.72,sustain=true,speed=1}=event.data;
  if(!Array.isArray(notes)||!notes.length)throw Error('没有可导出的音符');
  const mixer=new Processor();mixer.message({type:'volume',value:volume});mixer.message({type:'sustain',value:sustain});
  mixer.message({type:'wasm',bytes:await bytes('native-gm.wasm')});
  if(preset>=34&&preset<162)mixer.message({type:'bank',bytes:await bytes('assets/soundfont/TimGM6mb.sf2')});
  if([0,4,5,12,13,14].includes(preset))for(const pitch of new Set(notes.map(n=>Math.max(21,Math.min(108,21+3*Math.round((n.pitch-21)/3)))))){
   const buffer=await bytes('assets/piano/'+String(pitch).padStart(3,'0')+'.bin'),view=new DataView(buffer);let data;
   for(let at=12;at+8<=buffer.byteLength;){const length=view.getUint32(at+4,true);if(view.getUint32(at,false)===0x64617461){data=buffer.slice(at+8,at+8+length);break;}at+=8+length+(length&1);}
   if(!data)throw Error('钢琴采样格式无效');mixer.message({type:'sample',index:Math.round((pitch-21)/3),bytes:data});
  }
  const events=[];let end=0;
  notes.forEach((note,index)=>{const startMs=note.startMs??note.start,durationMs=note.durationMs??note.duration;if(!Number.isFinite(startMs)||!Number.isFinite(durationMs))throw Error('音符时间无效');const start=Math.round(startMs/speed*48),finish=Math.round((startMs+durationMs)/speed*48);end=Math.max(end,finish);events.push({at:start,type:'on',id:index,pitch:note.pitch,velocity:note.velocity??90,preset},{at:finish,type:'off',id:index,quick:false});});
  events.sort((a,b)=>a.at-b.at||(a.type==='off'?-1:1));
  const length=end+48000*2;if(length>48000*60*30)throw Error('当前网页单次导出最长 30 分钟');
  const pcm=new Float32Array(length);let cursor=0,index=0,lastProgress=-1;
  while(cursor<length){while(index<events.length&&events[index].at<=cursor)mixer.message(events[index++]);const next=index<events.length?events[index].at:length;const count=Math.min(128,length-cursor,Math.max(1,next-cursor));const out=new Float32Array(count);mixer.process([],[[out]]);pcm.set(out,cursor);cursor+=count;const progress=Math.floor(cursor/length*100);if(progress!==lastProgress){lastProgress=progress;self.postMessage({progress});}}
  self.postMessage({pcm:pcm.buffer,sampleRate:48000},[pcm.buffer]);
 }catch(error){self.postMessage({error:error.message});}
};
self.postMessage({ready:true});
