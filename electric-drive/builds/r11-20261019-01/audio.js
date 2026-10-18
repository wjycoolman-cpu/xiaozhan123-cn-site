// R8: retain finite zero speed; moving layers follow actual speed at a blocked stop.
// Existing CC0 assets are reused; see AUDIO_DESIGN.md and assets/SFX-SOURCES.txt.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const panFor=lane=>clamp(((Number.isFinite(lane)?lane:1)-1)*.62,-.75,.75);

export class DriveAudio {
  constructor(){
    this.enabled=false;this.context=null;this.nodes=null;this.samples={};
    this.active=new Set();this.voices=new Map();this.releasing=new Set();
    this.playCounts={};this.sampleErrors={};this.lastCue=new Map();
    this.lastStatus='menu';this.state=null;this.maxActive=0;this.stolenVoices=0;
    this.stopCount=0;this.sampleLoads=null;this.voiceLimit=20;
    this.coinRun=0;this.lastCoinAudio=-Infinity;this.coinCueHistory=[];
    this.nitroAudioRatio=0;this.nitroLayerLevel=0;
    this.introSirenCount=0;this.brakeCars=new Set();
  }

  async toggle(){
    if(!this.enabled){
      this.init();if(!this.context)return false;
      try{await this.context.resume();this.enabled=true;if(this.state?.status==='intro')this.introSiren();}
      catch(error){this.sampleErrors.context=String(error.message||error);this.enabled=false;}
    }else{
      this.enabled=false;this.stopTransient();
      this.nodes.master.gain.setTargetAtTime(0,this.context.currentTime,.012);
    }
    return this.enabled;
  }

  init(){
    if(this.context)return;
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return;
    const c=this.context=new Context();
    const master=c.createGain(),highpass=c.createBiquadFilter(),limiter=c.createDynamicsCompressor();
    master.gain.value=0;highpass.type='highpass';highpass.frequency.value=30;
    limiter.threshold.value=-9;limiter.knee.value=10;limiter.ratio.value=6;
    limiter.attack.value=.004;limiter.release.value=.14;
    master.connect(highpass);highpass.connect(limiter);limiter.connect(c.destination);
    const ambient=c.createGain();ambient.gain.value=1;ambient.connect(master);
    const uiGain=c.createGain();uiGain.gain.value=.36;uiGain.connect(highpass);
    const motor=c.createOscillator(),harmonic=c.createOscillator();
    const gain=c.createGain(),harmonicGain=c.createGain(),motorFilter=c.createBiquadFilter();
    motor.type='sine';motor.frequency.value=106;gain.gain.value=.035;
    harmonic.type='triangle';harmonic.frequency.value=214;harmonicGain.gain.value=.009;
    motorFilter.type='lowpass';motorFilter.frequency.value=510;
    motor.connect(gain);gain.connect(ambient);
    harmonic.connect(motorFilter);motorFilter.connect(harmonicGain);harmonicGain.connect(ambient);
    this.noiseBuffer=this.makeNoise(2);
    const wind=c.createBufferSource(),windFilter=c.createBiquadFilter(),windGain=c.createGain();
    wind.buffer=this.noiseBuffer;wind.loop=true;windFilter.type='lowpass';windFilter.frequency.value=1350;windGain.gain.value=0;
    wind.connect(windFilter);windFilter.connect(windGain);windGain.connect(ambient);
    // A second filter branch reuses the wind source, adding no new looping source.
    const glideFilter=c.createBiquadFilter(),glideGain=c.createGain();
    glideFilter.type='bandpass';glideFilter.frequency.value=920;glideFilter.Q.value=.65;glideGain.gain.value=0;
    wind.connect(glideFilter);glideFilter.connect(glideGain);glideGain.connect(ambient);
    const nitroFilter=c.createBiquadFilter(),nitroGain=c.createGain();
    nitroFilter.type='bandpass';nitroFilter.frequency.value=850;nitroFilter.Q.value=.7;nitroGain.gain.value=0;
    wind.connect(nitroFilter);nitroFilter.connect(nitroGain);nitroGain.connect(ambient);
    const rear=c.createOscillator(),rearGain=c.createGain(),rearFilter=c.createBiquadFilter(),rearPan=c.createStereoPanner();
    rear.type='triangle';rear.frequency.value=88;rearGain.gain.value=0;
    rearFilter.type='lowpass';rearFilter.frequency.value=430;
    rear.connect(rearFilter);rearFilter.connect(rearGain);rearGain.connect(rearPan);rearPan.connect(master);
    motor.start();harmonic.start();wind.start();rear.start();
    this.nodes={master,limiter,highpass,ambient,uiGain,motor,gain,harmonic,harmonicGain,motorFilter,wind,windFilter,windGain,glideFilter,glideGain,nitroFilter,nitroGain,rear,rearGain,rearPan,rearFilter};
    this.sampleLoads=this.loadSamples();
  }

  makeNoise(seconds){
    const c=this.context,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*seconds),c.sampleRate);
    const data=buffer.getChannelData(0);let seed=0x4d595df4;
    for(let index=0;index<data.length;index++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[index]=(seed/0x100000000)*2-1;}
    return buffer;
  }

  async loadSamples(){
    await Promise.all(Object.entries({whoosh:'glide-whoosh.wav',explosion:'battery-explosion.ogg',metalHeavy:'sfx-r11/impactMetal_heavy_000.ogg',metalLight:'sfx-r11/impactMetal_light_001.ogg',bodyImpact:'sfx-r11/impactSoft_heavy_000.ogg',thrust:'sfx-r11/spaceEngineSmall_000.ogg',airBrake:'sfx-r11/forceField_000.ogg'}).map(async([name,file])=>{
      try{
        const response=await fetch(new URL(`./assets/${file}`,import.meta.url));
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const buffer=await this.context.decodeAudioData(await response.arrayBuffer());
        let offset=0;
        if(name==='whoosh'&&buffer.duration>.5){
          // Pick one bounded breath, then envelope every voice. Never play 5.25 s.
          const data=buffer.getChannelData(0),span=Math.floor(buffer.sampleRate*.38),step=Math.max(1,Math.floor(buffer.sampleRate*.05));
          let best=-1;
          for(let index=0;index+span<data.length;index+=step){
            let power=0;for(let sample=index;sample<index+span;sample+=16)power+=data[sample]*data[sample];
            if(power>best){best=power;offset=index/buffer.sampleRate;}
          }
        }
        this.samples[name]={buffer,offset};delete this.sampleErrors[name];
      }catch(error){this.sampleErrors[name]=String(error.message||error);}
    }));
  }

  count(name){this.playCounts[name]=(this.playCounts[name]||0)+1;}
  allow(name,gap=.06){const now=this.context.currentTime,last=this.lastCue.get(name)??-Infinity;if(now-last<gap)return false;this.lastCue.set(name,now);this.count(name);return true;}

  track(source,gain,nodes,end){
    while(this.voices.size>=this.voiceLimit){
      const oldest=this.voices.keys().next().value;this.finish(oldest,true);this.stolenVoices++;
    }
    const record={source,gain,nodes,end};this.active.add(source);this.voices.set(source,record);
    this.maxActive=Math.max(this.maxActive,this.active.size);
    source.onended=()=>this.finish(source);
  }

  finish(source,stop=false){
    const record=this.voices.get(source);if(!record)return;
    if(this.thrustLoop?.source===source)this.thrustLoop=null;
    if(stop){try{source.stop();}catch{}}
    for(const node of record.nodes){try{node.disconnect();}catch{}}
    this.active.delete(source);this.releasing.delete(source);this.voices.delete(source);
  }

  envelope(gain,start,duration,level,attack=.012){
    gain.gain.setValueAtTime(.00001,start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.00002,level),start+Math.min(attack,duration*.2));
    gain.gain.exponentialRampToValueAtTime(.00001,start+duration);
  }

  tone(freq,duration,volume=.05,type='sine',to=freq,options={}){
    if(!this.enabled||!this.context)return false;
    const c=this.context,start=c.currentTime+(options.delay||0),o=c.createOscillator(),gain=c.createGain(),pan=c.createStereoPanner();
    o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),start);
    o.frequency.exponentialRampToValueAtTime(Math.max(20,to),start+duration);
    pan.pan.setValueAtTime(options.pan||0,start);
    if(Number.isFinite(options.endPan))pan.pan.linearRampToValueAtTime(options.endPan,start+duration);
    this.envelope(gain,start,duration,volume,options.attack||.012);
    o.connect(gain);gain.connect(pan);pan.connect(options.ui?this.nodes.uiGain:this.nodes.master);
    this.track(o,gain,[o,gain,pan],start+duration+.015);o.start(start);o.stop(start+duration+.015);return true;
  }

  sample(name,level=.25,duration=.35,rate=1,options={}){
    const sample=this.samples[name];if(!this.enabled||!sample||!this.context)return false;
    const c=this.context,start=c.currentTime+(options.delay||0),source=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter(),pan=c.createStereoPanner();
    const length=Math.min(duration,(sample.buffer.duration-sample.offset)/rate);
    if(length<=0)return false;
    source.buffer=sample.buffer;source.playbackRate.value=rate;
    filter.type='lowpass';filter.frequency.value=options.cutoff||2200;filter.Q.value=.55;
    pan.pan.setValueAtTime(options.pan||0,start);
    if(Number.isFinite(options.endPan))pan.pan.linearRampToValueAtTime(options.endPan,start+length);
    this.envelope(gain,start,length,level,.018);
    source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.nodes.master);
    this.track(source,gain,[source,filter,gain,pan],start+length+.015);this.count(name);
    source.start(start,sample.offset,length*rate);source.stop(start+length+.015);return true;
  }

  noise(duration,volume=.12,cutoff=1100,options={}){
    if(!this.enabled||!this.context)return false;
    const c=this.context,start=c.currentTime+(options.delay||0),source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain(),pan=c.createStereoPanner();
    source.buffer=this.noiseBuffer;filter.type=options.bandpass?'bandpass':'lowpass';filter.frequency.value=cutoff;filter.Q.value=options.bandpass?.65:.55;
    pan.pan.setValueAtTime(options.pan||0,start);
    if(Number.isFinite(options.endPan))pan.pan.linearRampToValueAtTime(options.endPan,start+duration);
    this.envelope(gain,start,duration,volume,.008);
    source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.nodes.master);
    this.track(source,gain,[source,filter,gain,pan],start+duration+.015);source.start(start,0,duration);source.stop(start+duration+.015);return true;
  }

  stopTransient(){
    this.stopCount++;
    if(!this.context)return;
    const now=this.context.currentTime;
    this.nitroAudioRatio=0;this.nitroLayerLevel=0;
    this.nodes.nitroGain.gain.setTargetAtTime(0,now,.012);
    for(const source of [...this.active]){
      const record=this.voices.get(source);if(!record)continue;
      const param=record.gain.gain;
      if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);
      else{param.cancelScheduledValues(now);param.setValueAtTime(.005,now);}
      param.linearRampToValueAtTime(0,now+.012);
      try{source.stop(now+.016);}catch{this.finish(source);}
      record.end=now+.018;this.active.delete(source);this.releasing.add(source);
    }
  }

  getMetrics(){
    return {enabled:this.enabled,contextState:this.context?.state??'uninitialized',loaded:Object.keys(this.samples),active:this.active.size,playCounts:{...this.playCounts},releaseTails:this.releasing.size,pendingResources:this.voices.size,audioTime:this.context?.currentTime??0,maxActive:this.maxActive,voiceLimit:this.voiceLimit,stolenVoices:this.stolenVoices,stopCount:this.stopCount,sampleErrors:{...this.sampleErrors},coinStreak:this.coinRun,coinCueHistory:this.coinCueHistory.map(cue=>({...cue})),nitroAudioRatio:this.nitroAudioRatio,nitroLayerLevel:this.nitroLayerLevel,introSirenCount:this.introSirenCount,sampleThrustActive:!!this.thrustLoop,audioVersion:'R11'};
  }

  update(state){
    if(['running','intro'].includes(this.lastStatus)&&this.lastStatus!==state.status)this.stopTransient();
    this.lastStatus=state.status;this.state=state;
    if(!this.context||!this.nodes)return;
    const c=this.context,t=c.currentTime,n=this.nodes,running=this.enabled&&state.status==='running',intro=this.enabled&&state.status==='intro';
    for(const [source,record] of this.voices)if(record.end<t-.01)this.finish(source);
    n.master.gain.setTargetAtTime(running?1.15:intro?.78:0,t,running||intro?.04:.012);
    n.ambient.gain.setTargetAtTime(intro?.16:1,t,.08);
    if(!running){n.rearGain.gain.setTargetAtTime(0,t,.012);n.glideGain.gain.setTargetAtTime(0,t,.012);n.nitroGain.gain.setTargetAtTime(0,t,.012);n.windGain.gain.setTargetAtTime(0,t,.025);this.nitroAudioRatio=0;this.nitroLayerLevel=0;return;}
    const suppliedSpeed=Number(state.speed);
    const speed=clamp(Number.isFinite(suppliedSpeed)?Math.abs(suppliedSpeed):26,0,60),motion=clamp(speed/24,0,1),ratio=clamp((speed-24)/18,0,1),p=state.player||{};
    const entities=state.entities||[],rear=entities.find(e=>e.kind==='rearCar'&&e.phase==='charging'&&e.z<10&&e.z>-90);
    const urgent=entities.some(e=>(e.kind==='battery'&&e.phase==='exploding'&&Math.abs(e.z)<30)||(e.kind==='rearCar'&&e.phase==='charging'&&Math.abs(e.z)<30));
    n.ambient.gain.setTargetAtTime(urgent?.56:t<(this.coinDuckUntil||0)?.45:1,t,.045);
    const motorHz=62+speed*1.68;
    n.motor.frequency.setTargetAtTime(motorHz,t,.16);n.harmonic.frequency.setTargetAtTime(motorHz*2.025,t,.16);
    n.gain.gain.setTargetAtTime((.012+.023*motion+ratio*.012)*(p.grounded===false?.76:1),t,.1);
    n.harmonicGain.gain.setTargetAtTime(.0025+.0065*motion,t,.1);
    n.windFilter.frequency.setTargetAtTime(1150+ratio*900,t,.2);
    n.windGain.gain.setTargetAtTime((.055+ratio*.075+(p.grounded===false?.055:0))*motion,t,.18);
    n.glideFilter.frequency.setTargetAtTime(830+ratio*400,t,.18);
    n.glideGain.gain.setTargetAtTime(p.gliding?.09*motion:0,t,p.gliding?.14:.08);
    // Read actual boost state; collectible glow/player.boost never enables this.
    this.nitroAudioRatio=p.nitroActive===true?clamp(Number(p.nitroRatio)||0,0,1):0;
    this.nitroLayerLevel=this.nitroAudioRatio*.10*motion;
    if(this.nitroAudioRatio>.01&&this.samples.thrust){
      if(!this.thrustLoop){
        const source=c.createBufferSource(),gain=c.createGain();source.buffer=this.samples.thrust.buffer;
        source.loop=true;source.loopStart=.08;source.loopEnd=Math.max(.1,source.buffer.duration-.08);
        gain.gain.value=0;source.connect(gain);gain.connect(n.ambient);
        this.track(source,gain,[source,gain],Infinity);this.thrustLoop={source,gain};source.start();this.count('sustainedThrust');
      }
      this.thrustLoop.source.playbackRate.setTargetAtTime(.72+ratio*.58,t,.12);
      this.thrustLoop.gain.gain.setTargetAtTime(this.nitroAudioRatio*.095,t,.045);
    }else if(this.thrustLoop){
      const loop=this.thrustLoop;this.thrustLoop=null;loop.gain.gain.setTargetAtTime(0,t,.018);loop.source.stop(t+.075);
      const record=this.voices.get(loop.source);if(record)record.end=t+.08;
    }
    n.nitroFilter.frequency.setTargetAtTime(850+1050*this.nitroAudioRatio,t,.08);
    n.nitroGain.gain.setTargetAtTime(this.nitroLayerLevel,t,this.nitroAudioRatio>0?.06:.025);
    const approach=rear?clamp((rear.z+65)/73,0,1):0;
    n.rear.frequency.setTargetAtTime(88+approach*90,t,.08);
    n.rearGain.gain.setTargetAtTime(rear?.012+approach*.065:0,t,.045);
    if(rear)n.rearPan.pan.setTargetAtTime(panFor(rear.lane),t,.08);
  }

  coinPickup(e){
    if(!this.allow('coin',.045))return;
    const now=this.context.currentTime;
    this.coinRun=Number.isFinite(e.streak)?Math.max(1,Math.floor(e.streak)):(now-this.lastCoinAudio>1.15?1:this.coinRun+1);
    this.lastCoinAudio=now;this.count('collect');
    const pitches=[880,987.77,1046.5,1174.66,1318.5,1479.98,1567.98,1760];
    const frequency=pitches[Math.min(this.coinRun-1,pitches.length-1)];
    const urgent=['batteryLand','batteryExplode','rearWarning','rearCharge','hit','sideSwipe','knockdown','brakeStart'].some(name=>now-(this.lastCue.get(name)??-Infinity)<.45);
    const level=.10*(urgent?.38:1),pan=Number.isFinite(e.x)?clamp(e.x/3.2*.52,-.7,.7):0;
    this.coinDuckUntil=now+.16;
    this.tone(frequency,.12,level,'sine',frequency*1.005,{pan,attack:.003});
    this.tone(frequency*2,.065,level*.26,'sine',frequency*2,{pan,delay:.004,attack:.003});
    this.noise(.012,.026,6500,{pan});
    this.coinCueHistory.push({at:now,streak:this.coinRun,frequency,level,pan,coins:e.coins??null});
    if(this.coinCueHistory.length>32)this.coinCueHistory.shift();
  }

  introSiren(){
    if(!this.enabled||!this.context||!this.allow('introSiren',2))return;
    this.introSirenCount++;
    // Exactly two short rising/falling phrases, total < .8 s. No repeat timer.
    this.tone(440,.28,.050,'sine',620,{pan:-.32,attack:.024});
    this.tone(620,.30,.045,'sine',440,{pan:.28,delay:.32,attack:.024});
  }

  uiCue(kind='click'){
    if(!this.enabled||!this.context||!this.allow('ui-'+kind,.07))return;
    this.tone(kind==='pause'?390:620,.055,.034,'sine',kind==='pause'?290:780,{ui:true,attack:.004});
  }

  event(e){
    if(e.kind==='introStart'){
      this.stopTransient();this.lastCue.clear();this.brakeCars.clear();this.lastStatus='intro';
      this.coinRun=0;this.lastCoinAudio=-Infinity;
      if(this.enabled){this.count('introStart');this.introSiren();}return;
    }
    if(e.kind==='introEnd'){
      this.stopTransient();this.lastStatus='running';if(this.enabled)this.count('introEnd');return;
    }
    if(e.kind==='start'){this.stopTransient();this.lastCue.clear();this.coinRun=0;this.lastCoinAudio=-Infinity;if(this.nodes)this.nodes.glideGain.gain.setTargetAtTime(0,this.context.currentTime,.008);return;}
    if(e.kind==='pause'||e.kind==='gameOver'){this.stopTransient();if(e.kind==='pause')this.uiCue('pause');else if(this.enabled){this.tone(330,.18,.065,'sine',220,{ui:true});this.tone(220,.26,.045,'sine',165,{ui:true,delay:.16});}return;}
    if(!this.enabled||!this.context)return;
    const pan=panFor(e.lane??e.targetLane),opts={pan};
    const traffic=this.state?.entities?.find(entity=>entity.id===e.id);
    const impactPan=traffic&&Number.isFinite(traffic.x)?clamp((traffic.x-(this.state.player?.x||0))/3.2*.55,-.7,.7):e.side==='left'||e.side===-1?-.5:e.side==='right'||e.side===1?.5:0;
    if(e.kind==='brakeStart'){
      if(this.brakeCars.has(e.id)||!this.allow('brakeStart',.18))return;
      this.brakeCars.add(e.id);if(this.brakeCars.size>64)this.brakeCars.delete(this.brakeCars.values().next().value);
      this.noise(.34,.18,1550,{bandpass:true,pan});
      this.tone(680,.24,.026,'triangle',350,{pan,attack:.022});
    }else if(e.kind==='brakeStop'&&this.allow('brakeStop',.15)){
      this.noise(.085,.10,430,{pan});this.tone(80,.11,.034,'sine',49,{pan});
    }else if(e.kind==='missionComplete'&&this.allow('missionComplete',.55)){
      const urgent=['brakeStart','batteryExplode','hit','rearWarning'].some(name=>this.context.currentTime-(this.lastCue.get(name)??-Infinity)<.4);
      const level=urgent?.014:.027;
      this.tone(392,.105,level,'sine',392);this.tone(523.25,.16,level,'sine',523.25,{delay:.105});
      this.tone(659.25,.18,level*.7,'sine',659.25,{delay:.23});
    }else if(e.kind==='nitroStart'&&this.allow('nitroStart',.10)){
      this.sample('thrust',.16,.48,1.25,{cutoff:2700});
      this.tone(90,.13,.032,'sine',190);this.noise(.11,.09,1350);
    }else if(e.kind==='nitroEnd'&&this.allow('nitroEnd',.06)){
      this.nitroAudioRatio=0;this.nitroLayerLevel=0;this.nodes.nitroGain.gain.setTargetAtTime(0,this.context.currentTime,.025);
    }else if(e.kind==='nearMiss'&&this.allow('nearMiss',.20)){
      if(!this.sample('whoosh',.11,.16,1.4,{pan:impactPan,cutoff:2100}))this.noise(.16,.12,1450,{pan:impactPan});
      this.tone(370,.10,.019,'sine',550,{pan:impactPan});
    }else if(e.kind==='sideSwipe'&&e.damage<2&&this.allow('sideSwipe',.12)){
      this.sample('metalLight',.28,.28,1.05,{pan:impactPan,cutoff:4800});
      this.noise(.14,.20,1100,{bandpass:true,pan:impactPan});this.tone(135,.11,.032,'triangle',90,{pan:impactPan});
    }else if(e.kind==='knockdown'&&this.allow('knockdown',.18)){
      this.sample('metalHeavy',.46,.42,.9,{pan:impactPan,cutoff:3900});
      this.noise(.22,.28,950,{bandpass:true,pan:impactPan});this.noise(.10,.18,280,{pan:impactPan});
      this.tone(76,.20,.074,'triangle',36,{pan:impactPan});this.tone(620,.11,.026,'sine',370,{pan:impactPan,delay:.028});
    }else if(e.kind==='spawn'&&e.entityKind==='rearCar'){
      if(!this.allow('rearWarning',.5))return;
      // One brief signal for the shorter .85 s countdown; do not repeat banners.
      this.tone(196,.11,.043,'triangle',190,{pan});
      this.tone(247,.11,.019,'sine',242,{pan});
    }else if(e.kind==='jump'&&this.allow('jump',.16)){
      if(!this.sample('whoosh',.28,.34,1.08,{cutoff:1550}))this.noise(.28,.19,1300);
      this.tone(155,.18,.032,'sine',285);
      this.noise(.105,.12,1900);this.count('jet');
    }else if(e.kind==='airRetreat'&&this.allow('airRetreat',.2)){
      this.sample('airBrake',.23,.4,1.6,{cutoff:3400});this.noise(.2,.16,1800,{bandpass:true});this.tone(420,.28,.055,'sine',115);
    }else if(e.kind==='roll'&&this.allow('roll',.2)){
      const direction=e.direction===-1?-1:1;
      if(!this.sample('whoosh',.17,.22,1.32,{cutoff:2500,pan:-.65*direction,endPan:.65*direction}))this.noise(.23,.22,1200,{bandpass:true,pan:-.65*direction,endPan:.65*direction});
      this.tone(275,.21,.036,'sine',115,{pan:-.35*direction,endPan:.35*direction});
    }else if(e.kind==='land'&&this.allow('land',.18)){
      this.sample('bodyImpact',.30,.28,.85,{cutoff:1900});
      this.noise(.105,.12,420);this.tone(88,.105,.04,'sine',55);
    }else if(e.kind==='collect'&&e.entityKind==='coin'){
      this.coinPickup(e);
    }else if(e.kind==='collect'&&this.allow('collect',.055)){
      this.tone(660,.085,.024);this.tone(990,.085,.013,'sine',990,{delay:.055});
    }else if(e.kind==='batteryThrow'&&this.allow('batteryThrow',.15)){
      const throwOpts={pan:panFor(e.sourceLane),endPan:panFor(e.targetLane)};
      this.noise(.075,.13,1800,throwOpts);this.tone(420,.17,.042,'triangle',265,throwOpts);
    }else if(e.kind==='batteryLand'&&this.allow('batteryLand',.2)){
      this.noise(.09,.16,850,opts);this.tone(115,.12,.045,'sine',75,opts);
      this.tone(580,.07,.026,'sine',580,{pan,delay:.11});this.tone(580,.07,.026,'sine',580,{pan,delay:.28});
    }else if(e.kind==='batteryExplode'&&this.allow('batteryExplode',.12)){
      if(!this.sample('explosion',.40,.60,1,{pan,cutoff:2300}))this.noise(.42,.38,1350,opts);
      this.tone(84,.23,.11,'sine',38,opts);
    }else if(e.kind==='hit'&&this.allow('hit',.2)){
      this.sample('metalHeavy',.35,.3,.8,{pan,cutoff:3200});
      // Body impact stays separate from the battery blast.
      this.coinRun=0;this.lastCoinAudio=-Infinity;
      this.noise(.13,.23,1700,opts);this.tone(105,.16,.09,'triangle',46,opts);
    }else if(e.kind==='rearCharge'&&this.allow('rearCharge',.3)){
      this.tone(105,.27,.055,'triangle',190,opts);
      this.noise(.23,.12,750,opts);
    }else if(e.kind==='dodge'&&e.entityKind==='rearCar'&&this.allow('rearPass',.4)){
      this.noise(.24,.17,1450,{pan:-.25,endPan:.25});
    }
  }
}
