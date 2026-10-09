import {Output,Mp4OutputFormat,BufferTarget,CanvasSource,AudioBufferSource} from './vendor/mediabunny.mjs';
import {toCanvas} from './vendor/html-to-image.mjs';
import * as formal from './native-synth.js';
let busy=false;
const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
async function audio(configuration,progress){return new Promise((resolve,reject)=>{const worker=new Worker('./native-offline-audio.js',{type:'module'});worker.onerror=e=>{worker.terminate();reject(Error(e.message));};worker.onmessage=e=>{if(e.data.ready)worker.postMessage({...configuration,notes:configuration.song.notes});if(e.data.progress!==undefined)progress(e.data.progress);if(e.data.error){worker.terminate();reject(Error(e.data.error));}if(e.data.pcm){worker.terminate();resolve(new Float32Array(e.data.pcm));}};});}
export async function exportActualWav(){
 const view=PianoWeb.view();if(!view.song)throw Error('请先选择歌曲');
 const pcm=await audio({song:view.song,speed:view.speed,preset:Number(document.querySelector('#tone').value),volume:PianoWeb.audio.volume,sustain:PianoWeb.audio.sustain},progress=>document.querySelector('#status').textContent='生成 WAV '+progress+'%');
 const bytes=new ArrayBuffer(44+pcm.length*2),data=new DataView(bytes),text=(at,value)=>{for(let i=0;i<value.length;i++)data.setUint8(at+i,value.charCodeAt(i));};
 text(0,'RIFF');data.setUint32(4,36+pcm.length*2,true);text(8,'WAVE');text(12,'fmt ');data.setUint32(16,16,true);data.setUint16(20,1,true);data.setUint16(22,1,true);data.setUint32(24,48000,true);data.setUint32(28,96000,true);data.setUint16(32,2,true);data.setUint16(34,16,true);text(36,'data');data.setUint32(40,pcm.length*2,true);for(let i=0;i<pcm.length;i++)data.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,pcm[i]))*(pcm[i]<0?32768:32767)),true);
 return new Blob([bytes],{type:'audio/wav'});
}
export async function exportActualVideo({seconds=null,width=1080,height=1920,fps=30}={}){
 if(busy)throw Error('正在导出');busy=true;let output;
 const status=document.querySelector('#status');
 try{
  const guitar=App31Surfaces.inspect().surface==='touch'&&formal.guitarEnabled();if(guitar)formal.guitarAction(1);const configuration=PianoWeb.beginOffline(guitar?JSON.parse(formal.guitarSong()):null);if(!configuration.song)throw Error('请先选择歌曲');document.querySelector('.instrument').inert=true;
  const pcm=await audio(configuration,p=>status.textContent='准备声音 '+p+'%');
  const total=seconds??pcm.length/48000,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
  output=new Output({format:new Mp4OutputFormat(),target:new BufferTarget()});
  const video=new CanvasSource(canvas,{codec:'avc',bitrate:6000000}),sound=new AudioBufferSource({codec:'aac',bitrate:192000});output.addVideoTrack(video,{frameRate:fps});output.addAudioTrack(sound);await output.start();
  const length=Math.min(pcm.length,Math.ceil(total*48000)),buffer=new AudioBuffer({length,numberOfChannels:1,sampleRate:48000});buffer.copyToChannel(pcm.subarray(0,length),0);await sound.add(buffer);
  const instrument=document.querySelector('.instrument'),nativeCanvas=document.querySelector('canvas[id^="native-"]');
  let staticSnapshot=null;
  const captureRatio=Math.max(1,Math.min(3,width*.80/instrument.getBoundingClientRect().width));
  const captureOptions={pixelRatio:captureRatio,cacheBust:false,filter:node=>node.tagName!=='IFRAME'&&node.id!=='status'};
  for(let i=0;i<Math.ceil(total*fps);i++){
   const sample=Math.min(pcm.length,Math.floor(i/fps*48000));PianoWeb.offlinePcm=pcm.subarray(Math.max(0,sample-2048),sample);PianoWeb.offlineFrame(i/fps*1000*configuration.speed);await window.App31Surfaces.update();await frame();
   const viewport=instrument.getBoundingClientRect();
   if(nativeCanvas&&!staticSnapshot)staticSnapshot=await toCanvas(instrument,captureOptions);
   const snapshot=staticSnapshot??await toCanvas(instrument,captureOptions);
   if(nativeCanvas){const bounds=nativeCanvas.getBoundingClientRect();snapshot.getContext('2d').drawImage(nativeCanvas,(bounds.left-viewport.left)*captureRatio,(bounds.top-viewport.top)*captureRatio,bounds.width*captureRatio,bounds.height*captureRatio);}
   const embedded=document.querySelector('#native-surface-frame');
   if(embedded){const body=embedded.contentDocument.body,child=await toCanvas(body,{pixelRatio:captureRatio,cacheBust:false}),bounds=embedded.getBoundingClientRect(),cover=document.body.dataset.surface==='calculator'?document.querySelector('.native-toolbar').getBoundingClientRect().height:0;snapshot.getContext('2d').drawImage(child,0,cover*captureRatio,child.width,child.height-cover*captureRatio,(bounds.left-viewport.left)*captureRatio,(bounds.top-viewport.top+cover)*captureRatio,bounds.width*captureRatio,(bounds.height-cover)*captureRatio);}
   // Reserve space for short-video captions and right-side action buttons.
   const safe={x:width*.06,y:height*.10,w:width*.80,h:height*.72},scale=Math.min(safe.w/snapshot.width,safe.h/snapshot.height),w=snapshot.width*scale,h=snapshot.height*scale;
   ctx.fillStyle=getComputedStyle(instrument).backgroundColor||'#202b38';ctx.fillRect(0,0,width,height);ctx.drawImage(snapshot,safe.x+(safe.w-w)/2,safe.y+(safe.h-h)/2,w,h);
   await video.add(i/fps,1/fps);status.textContent='生成视频 '+Math.round((i+1)/Math.ceil(total*fps)*100)+'%';
  }
  await output.finalize();return new Blob([output.target.buffer],{type:'video/mp4'});
 }catch(error){await output?.cancel().catch(()=>{});throw error;}finally{delete PianoWeb.offlinePcm;PianoWeb.endOffline();document.querySelector('.instrument').inert=false;busy=false;}
}
window.App31Video={exportActualVideo};
