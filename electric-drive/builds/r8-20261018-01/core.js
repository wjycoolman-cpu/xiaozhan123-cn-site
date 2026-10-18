export const LANES = [-3.2, 0, 3.2];
export const RULES = Object.freeze({ jumpVelocity: 10.8, gravity: 15.5, maxAirTime: 2.5, rollDuration: .65, rollCooldown: 1.35, explosionHeight: 1.8, explosionHalfLength: 7, explosionDuration: 1.15, nitroBonus:14, nitroDrain:.23, nitroMinEnergy:.08, trafficContactHalfLength:4, trafficSideGap:2.25, introDuration:3.2, faultDeceleration:3.5 });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class DriveCore {
  constructor(patterns = [], tutorial = [], openingCoins = []) { this.patterns = patterns; this.tutorial = tutorial; this.openingCoins=openingCoins.filter(c=>Number.isFinite(c.dz)&&c.dz>=0).map(c=>({...c})).sort((a,b)=>a.dz-b.dz);this.serial = 0; this.reset(); }
  reset(practice = false, seed = 82317) {
    this.randomState = seed;
    this.state = { status:'menu', time:0, distance:0, speed:26, seed, practice, score:0, combo:0, coins:0,coinStreak:0,lastCoinAt:-10,dodges:0, jumps:0, flips:0, batteriesCleared:0,nearMisses:0,sideSwipes:0,knockdowns:0,missionsCompleted:0,
      intro:{active:false,progress:0},pursuit:{active:false,pressure:0},
      missions:[{id:'coins',label:'收集金币',target:10,value:0,baseline:0,level:0,completeUntil:0},{id:'air',label:'飞跃与空翻',target:3,value:0,baseline:0,level:0,completeUntil:0},{id:'contact',label:'擦身或撞车',target:2,value:0,baseline:0,level:0,completeUntil:0}],
      player:{x:0,y:0,vy:0,vx:0,roll:0,pitch:0,hit:0,boost:0,nitroEnergy:.45,nitroActive:false,nitroVelocity:0,nitroRatio:0,targetLane:1,health:3,rollCooldown:0,grounded:true,gliding:false,invulnerable:0,airTime:0,rollTimer:0,rollDirection:1},
      entities:[], effects:[], events:[], notice:{title:'',hint:'',label:'',until:0}, feedback:{title:'',detail:'',until:0}, lastCollision:'', reason:'', rearWarning:false };
    this.jumpHeld = false; this.nitroHeld=false;this.nitroExhausted=false;this.scriptStage = 0; this.tutorialIndex = 0; this.openingCoinIndex=0;this.nextGroup = 760;this.openingBeats=new Set();this.firstFault=false; this.groupEnd = 0; this.lastPattern = ''; return this.state;
  }
  random() { this.randomState = (this.randomState * 1664525 + 1013904223) >>> 0; return this.randomState / 4294967296; }
  event(kind, extra={}) { const entry={seq:++this.serial,kind,at:this.state.time,distance:this.state.distance,...extra}; this.state.events.push(entry); if(this.state.events.length>160) this.state.events.shift(); return entry; }
  begin(practice=false,seed=82317){
    if(practice)return this.start(true,seed);
    this.reset(false,seed);this.state.status='intro';this.state.intro={active:true,progress:0};this.state.pursuit={active:true,pressure:1};this.event('introStart');return this.state;
  }
  skipIntro(){
    if(this.state.status!=='intro')return false;
    const seed=this.state.seed;this.start(false,seed);this.event('introEnd');return true;
  }
  start(practice=false, seed=82317) {
    this.reset(practice,seed); this.state.status='running';this.state.pursuit={active:!practice,pressure:practice?0:1};
    this.notice(practice?'先把身法练起来':'欢迎来到云端公路','左右变道 · 空格起跳，按住滑翔','WARM UP',4.5);
    if(practice && this.tutorial.length){this.scriptStage=99;this.spawnGroup();}
    else {if(this.openingCoins.length)this.spawnOpeningCoins();else{this.spawn('coin',1,35);this.spawn('coin',1,49);this.spawn('coin',1,63);}this.spawn('barrier',1,105);this.spawn('traffic',0,150);this.scriptStage=1;}
    this.event('start',{practice}); return this.state;
  }
  spawn(kind,lane=1,z=120,extra={}) {
    if(kind==='ring')kind='coin';
    const entity={id:++this.serial,kind,lane,x:LANES[lane]??0,z,y:0,age:0,phase:'active',passed:false,...extra};
    if(kind==='coin') entity.y=extra.y??.85;
    if(kind==='traffic'){entity.damage=0;entity.wrecked=false;entity.wreckAge=0;entity.impactSide=0;entity.contactUntil=0;}
    if(kind==='battery') {entity.phase=extra.phase??'armed';entity.fuse=extra.fuse??1.7;entity.launchX=extra.launchX??entity.x;entity.targetX=extra.targetX??entity.x;entity.sourceId=extra.sourceId??null;entity.sourceLane=extra.sourceLane??lane;}
    if(kind==='rearCar') {entity.phase='warning';entity.z=extra.z??-65;entity.warnTime=.85;}
    if(kind==='faultCar'){entity.phase='braking';entity.speed=14;entity.brakeRatio=0;this.event('brakeStart',{id:entity.id,entityKind:kind,lane});}
    this.state.entities.push(entity); this.event('spawn',{id:entity.id,entityKind:kind,lane,x:entity.x,z:entity.z}); return entity;
  }
  spawnOpeningCoins(){
    const s=this.state;
    while(this.openingCoinIndex<this.openingCoins.length&&this.openingCoins[this.openingCoinIndex].dz<=s.distance+170){
      const {lane=1,dz,y=.85,...extra}=this.openingCoins[this.openingCoinIndex++];
      if(dz>=s.distance-3)this.spawn('coin',lane,dz-s.distance,{...extra,y});
    }
  }
  notice(title,hint='',label='ON THE ROAD',duration=3) { this.state.notice={title,hint,label,until:this.state.time+duration}; }
  feedback(title,detail='',duration=1.35) { this.state.feedback={title,detail,until:this.state.time+duration}; }
  effect(kind,x=0,z=0,y=0,duration=.8) { this.state.effects.push({id:++this.serial,kind,x,z,y,age:0,duration}); }
  lane(dir) {
    if(this.state.status!=='running') return false;
    const p=this.state.player, next=clamp(p.targetLane+dir,0,2); if(next===p.targetLane)return false;
    p.targetLane=next;this.event('lane',{lane:next});return true;
  }
  jump(held=true) {
    this.jumpHeld=held;
    if(!held || this.state.status!=='running')return false;
    const p=this.state.player;if(!p.grounded)return false;
    p.vy=RULES.jumpVelocity;p.grounded=false;p.airTime=0;p.y=.025;this.state.jumps++;
    this.effect('jump',p.x,0,0,.55);this.event('jump');return true;
  }
  releaseJump() { this.jumpHeld=false; }
  grantNitro(amount){this.state.player.nitroEnergy=clamp(this.state.player.nitroEnergy+amount,0,1);}
  setNitroActive(active){
    const s=this.state,p=s.player;if(p.nitroActive===active)return;
    p.nitroActive=active;this.event(active?'nitroStart':'nitroEnd',{energy:p.nitroEnergy});
    if(active)this.effect('boostBurst',p.x,0,p.y,.5);
  }
  nitro(held=true){
    const s=this.state,p=s.player;
    if(!held){this.nitroHeld=false;this.nitroExhausted=false;this.setNitroActive(false);return false;}
    if(s.status!=='running'||this.nitroHeld)return p.nitroActive;
    this.nitroHeld=true;
    if(p.nitroEnergy<RULES.nitroMinEnergy){this.nitroExhausted=true;this.feedback('喷气能量不足','金币、擦身和空翻可以补充能量',1.4);return false;}
    this.nitroExhausted=false;this.setNitroActive(true);return true;
  }
  strikeTraffic(entity,side,strength=1,isSide=true){
    if(entity.wrecked)return;
    const s=this.state,p=s.player,first=entity.damage===0;
    entity.damage=Math.max(entity.damage,strength);entity.impactSide=side||1;entity.contactUntil=s.time+.35;
    if(first&&isSide){s.sideSwipes++;s.combo++;s.score+=25;this.grantNitro(.025);this.effect('scrape',(p.x+entity.x)*.5,entity.z,.55,.55);this.event('sideSwipe',{id:entity.id,entityKind:'traffic',side:entity.impactSide,damage:entity.damage});this.feedback('擦碰 +25','继续侧撞，或喷气冲击交通车',1);}
    if(entity.damage>=2){
      entity.wrecked=true;entity.passed=true;entity.wreckAge=0;entity.sideImpact=isSide;
      if(isSide)entity.x=p.x+entity.impactSide*Math.max(Math.abs(entity.x-p.x),RULES.trafficSideGap);
      else entity.z=Math.max(entity.z,RULES.trafficContactHalfLength+.05);
      s.knockdowns++;s.combo++;const bonus=150+Math.min(s.combo,10)*10;s.score+=bonus;this.grantNitro(.08);
      this.effect('knockdown',entity.x,entity.z,.6,1.2);this.event('knockdown',{id:entity.id,entityKind:'traffic',side:entity.impactSide,damage:2,nitro:p.nitroActive});this.feedback(`撞毁 +${bonus}`,`连续身法 ×${s.combo}`,1.4);
    }
  }
  roll(dir=1) {
    const s=this.state,p=s.player;
    if(s.status!=='running'||p.grounded||p.y<.3||p.rollCooldown>0)return false;
    p.rollTimer=RULES.rollDuration;p.rollCooldown=RULES.rollCooldown;p.rollDirection=dir;p.invulnerable=Math.max(p.invulnerable,.52);p.boost=1;
    s.flips++;s.score+=100;s.combo++;this.grantNitro(.08);this.effect('roll',p.x,0,p.y,.6);this.feedback('空翻 +100','短暂闪避窗口已开启');this.event('roll',{direction:dir});return true;
  }
  pause() { if(this.state.status==='running'||this.state.status==='intro'){this.pausedFrom=this.state.status;this.nitro(false);this.state.status='paused';this.jumpHeld=false;this.event('pause');return true;}return false; }
  resume() { if(this.state.status==='paused'){this.state.status=this.pausedFrom==='intro'?'intro':'running';this.event('resume');return true;}return false; }
  hurt(entity, reason) {
    const s=this.state,p=s.player;if(p.invulnerable>0||entity.hit)return;
    entity.hit=true;p.hit=1;p.invulnerable=1.7;s.combo=0;s.coinStreak=0;s.lastCollision=entity.kind;this.nitro(false);
    this.effect('hit',p.x,0,p.y,.65);this.event('hit',{id:entity.id,entityKind:entity.kind,health:s.practice?p.health:p.health-1});
    if(s.practice){this.feedback('再试一下','练习模式不扣护盾',1.4);return;}
    p.health--;this.feedback('护盾 -1',reason,1.7);
    if(p.health<=0){s.status='over';s.reason=reason;this.event('gameOver',{reason});this.jumpHeld=false;}
  }
  clear(entity,detail='极限擦过') {
    if(entity.passed)return;entity.passed=true;if(entity.hit||(entity.kind==='traffic'&&entity.damage>0))return;const s=this.state;s.dodges++;s.combo++;s.score+=50+Math.min(s.combo,20)*5;
    const p=s.player,dx=Math.abs(p.x-entity.x);
    if(entity.kind==='traffic'&&!entity.damage&&!entity.nearMissed&&dx>=1.65&&dx<2.65&&p.y<1.55){entity.nearMissed=true;s.nearMisses++;s.score+=25;this.grantNitro(.08);this.event('nearMiss',{id:entity.id,entityKind:'traffic',side:Math.sign(entity.x-p.x),energy:p.nitroEnergy});this.effect('scrape',entity.x,-3,.5,.28);this.feedback('贴身擦过 +25','喷气能量补充',1);}
    if(entity.kind==='battery'){s.batteriesCleared++;this.feedback('电池雨？飞过去。','凌空避险 +150');s.score+=150;}
    else if(Math.abs(this.state.player.x-entity.x)<2.3)this.feedback(detail,`连续身法 ×${s.combo}`,.9);
    this.event('dodge',{id:entity.id,entityKind:entity.kind});
  }
  spawnGroup() {
    const s=this.state;
    if(s.practice&&this.tutorialIndex<this.tutorial.length){
      const lesson=this.tutorial[this.tutorialIndex++];let max=0;
      for(const object of lesson.objects){const {kind,lane,dz:offset,...extra}=object,dz=Math.max(0,Number(offset)||0);max=Math.max(max,dz);this.spawn(kind,lane,105+dz,extra);}
      this.notice(lesson.title,lesson.hint,`PRACTICE / ${this.tutorialIndex} OF ${this.tutorial.length}`,4);this.event('encounter',{pattern:lesson.id});
      this.nextGroup=Math.max(s.distance+105+max+65,this.tutorial[this.tutorialIndex]?.minDistance??0);return;
    }
    const eligible=this.patterns.filter(p=>s.distance>=(p.minDistance??0)&&p.id!==this.lastPattern);
    if(!eligible.length){this.spawn('traffic',Math.floor(this.random()*3),140);this.spawn('barrier',Math.floor(this.random()*3),195);this.nextGroup=s.distance+240;return;}
    const total=eligible.reduce((a,p)=>a+(p.weight??1),0);let draw=this.random()*total;
    let pattern=eligible.at(-1);for(const p of eligible){draw-=p.weight??1;if(draw<=0){pattern=p;break;}}
    this.lastPattern=pattern.id;let max=0;
    for(const object of pattern.objects){const {kind,lane,dz:offset,...extra}=object,dz=Math.max(0,Number(offset)||0);max=Math.max(max,dz);this.spawn(kind,lane,140+dz,extra);}
    this.notice(pattern.title,pattern.hint,'CITY / CHALLENGE',2.2);this.event('encounter',{pattern:pattern.id});
    this.nextGroup=s.distance+140+max-45;
  }
  updateMissions(){
    const s=this.state,totals={coins:s.coins,air:s.jumps+s.flips,contact:s.sideSwipes+s.nearMisses+s.knockdowns};
    for(const mission of s.missions){
      if(mission.completeUntil){if(s.time<mission.completeUntil)continue;mission.completeUntil=0;mission.baseline=totals[mission.id];mission.target=Math.min(mission.id==='coins'?30:6,mission.target+(mission.id==='coins'?4:1));mission.value=0;}
      mission.value=Math.min(mission.target,totals[mission.id]-mission.baseline);
      if(mission.value>=mission.target){mission.completeUntil=s.time+1.4;mission.level++;s.missionsCompleted++;const bonus=100+Math.min(s.missionsCompleted,8)*25;s.score+=bonus;this.grantNitro(.12);this.event('missionComplete',{mission:mission.id,count:s.missionsCompleted,bonus});this.feedback('目标完成',`${mission.label} · +${bonus} 积分`,1.2);}
    }
  }
  update(dt) {
    const s=this.state;
    if(s.status==='intro'){s.intro.progress=Math.min(1,s.intro.progress+dt/RULES.introDuration);s.pursuit.pressure=1-s.intro.progress*.25;if(s.intro.progress>=1)this.skipIntro();return;}
    if(s.status!=='running')return;
    const p=s.player;s.time+=dt;
    s.pursuit={active:!s.practice&&s.time<5,pressure:!s.practice?Math.max(0,1-s.time/5):0};
    if(p.nitroActive){p.nitroEnergy=Math.max(0,p.nitroEnergy-RULES.nitroDrain*dt);if(p.nitroEnergy<=0){this.setNitroActive(false);this.nitroExhausted=true;}}
    p.nitroVelocity+=((p.nitroActive?RULES.nitroBonus:0)-p.nitroVelocity)*(1-Math.exp(-5*dt));
    if(p.nitroVelocity<.001)p.nitroVelocity=0;p.nitroRatio=p.nitroVelocity/RULES.nitroBonus;
    s.speed=Math.min(42,26+s.distance*.0025)+p.nitroVelocity;
    const nextX=p.x+(LANES[p.targetLane]-p.x)*(1-Math.exp(-15*dt));
    const frontFault=s.entities.filter(e=>e.kind==='faultCar'&&e.z>=3.875&&Math.abs(nextX-e.x)<2.12&&p.y<1.55).sort((a,b)=>a.z-b.z)[0];
    p.blockedBy=null;
    if(frontFault){const obstacleSpeed=Math.max(0,frontFault.speed-RULES.faultDeceleration*dt*.5),safeSpeed=Math.max(0,obstacleSpeed+(frontFault.z-3.98)/dt);if(safeSpeed<s.speed){s.speed=safeSpeed;p.blockedBy=frontFault.id;}}
    s.distance+=s.speed*dt;s.score+=s.speed*dt*.12;
    if(!s.practice)this.spawnOpeningCoins();
    if(s.time-s.lastCoinAt>1.25)s.coinStreak=0;
    const previousX=p.x;p.x+=(LANES[p.targetLane]-p.x)*(1-Math.exp(-15*dt));p.vx=dt>0?(p.x-previousX)/dt:0;p.hit=Math.max(0,p.hit-dt*2);p.boost=Math.max(0,p.boost-dt*1.6);p.invulnerable=Math.max(0,p.invulnerable-dt);p.rollCooldown=Math.max(0,p.rollCooldown-dt);
    if(p.rollTimer>0){p.rollTimer=Math.max(0,p.rollTimer-dt);const progress=1-p.rollTimer/RULES.rollDuration;p.roll=p.rollDirection*progress*Math.PI*2;if(!p.rollTimer)p.roll=0;}else p.roll=0;
    if(!p.grounded){p.airTime+=dt;p.gliding=this.jumpHeld&&p.vy<1.4&&p.airTime<RULES.maxAirTime;
      p.vy-=(p.gliding?4.8:RULES.gravity)*dt;if(p.gliding)p.vy=Math.max(p.vy,-2.8);if(p.airTime>RULES.maxAirTime)p.vy-=RULES.gravity*dt;
      p.y+=p.vy*dt;if(p.y<=0){p.y=0;p.vy=0;p.grounded=true;p.gliding=false;this.event('land');this.effect('jump',p.x,0,0,.3);}
    }else p.gliding=false;
    p.pitch+=( (p.grounded?0:clamp(-p.vy*.025,-.2,.18))-p.pitch)*(1-Math.exp(-8*dt));
    if(this.scriptStage===1&&s.distance>65){this.notice('前方路障 · 起飞！','轻按空格越过路障，按住可以滑翔','FIRST JUMP',3);this.scriptStage=2;}
    if(this.scriptStage===2&&s.distance>180){this.spawn('batteryVan',0,140);this.spawn('traffic',2,140);this.notice('前车准备向右甩电池','中间车道会出现爆区，提前起飞','BATTERY DROP',4);this.scriptStage=3;}
    if(this.scriptStage===3&&s.distance>400){this.spawn('rearCar',p.targetLane,-65);this.notice('后车逼近！','变道或飞起','REAR ALERT',1.2);this.scriptStage=4;}
    if(this.scriptStage===4&&s.distance>570){this.spawn('drone',1,125,{y:2.75});this.notice('空中也有早高峰','地面通过，或起飞后按 Q / E 空翻闪避','AIR TRAFFIC',4);this.scriptStage=5;}
    if(!s.practice){
      for(const [at,lane] of [[115,2],[315,0]])if(s.distance>at&&!this.openingBeats.has(at)){this.openingBeats.add(at);this.spawn('traffic',lane,140);}
      if(!this.firstFault&&s.distance>650){this.firstFault=true;this.spawn('faultCar',2,115);for(let i=0;i<6;i++)this.spawn('coin',1,120+i*5);this.notice('故障车正在减速','它会停在右侧，沿金币路线绕行','BRAKE / AHEAD',2);}
    }
    const unfinishedDynamic=s.entities.some(e=>(e.kind==='battery'&&e.phase!=='done'&&e.z>-15)||(e.kind==='rearCar'&&e.z<8));
    if(s.distance>this.nextGroup&&!unfinishedDynamic)this.spawnGroup();
    s.rearWarning=false;const pending=[];
    for(const e of s.entities){
      const previousZ=e.z;e.age+=dt;
      if(e.wrecked){e.wreckAge+=dt;e.z+=(8+s.speed*.18)*dt;e.x+=e.impactSide*dt*4.8;if(e.sideImpact&&Math.abs(e.z)<RULES.trafficContactHalfLength+.1&&(e.x-p.x)*e.impactSide<RULES.trafficSideGap)e.x=p.x+e.impactSide*RULES.trafficSideGap;continue;}
      if(e.kind==='rearCar'){
        if(e.phase==='warning'){s.rearWarning=true;e.warnTime-=dt;if(e.warnTime<=0){e.phase='charging';this.event('rearCharge',{id:e.id,lane:e.lane});}}
        else {e.z+=45*dt;if(e.z<8)s.rearWarning=true;}
      }else if(e.kind==='faultCar'){
        const previousSpeed=e.speed;e.speed=Math.max(0,e.speed-RULES.faultDeceleration*dt);e.brakeRatio=1-e.speed/14;e.z+=((previousSpeed+e.speed)*.5-s.speed)*dt;
        if(e.speed===0&&e.phase!=='stopped'){e.phase='stopped';this.event('brakeStop',{id:e.id,entityKind:e.kind,lane:e.lane});}
      }else e.z-=s.speed*dt;
      if(e.kind==='batteryVan'&&!e.thrown&&e.z<75&&e.lane<2){
        e.thrown=true;const lane=e.lane+1;pending.push({kind:'battery',lane,z:e.z,extra:{sourceId:e.id,sourceLane:e.lane,x:e.x+.9,launchX:e.x+.9,targetX:LANES[lane],phase:'airborne',y:1.6,spawnAt:s.time,fuse:Math.max(.65,(e.z-17)/s.speed)}});
        this.notice('电池往右飞了！','看黄色爆区，起跳后按住滑翔','BATTERY / CAUTION',2.4);this.event('batteryThrow',{id:e.id,sourceLane:e.lane,targetLane:lane});
      }
      if(e.kind==='battery'){
        if(e.phase==='airborne'&&e.age<.55){const t=e.age/.55;e.x=e.launchX+(e.targetX-e.launchX)*t;e.y=Math.max(0,1.6*(1-t)+Math.sin(t*Math.PI)*2);}
        else if(e.phase==='airborne'){e.x=e.targetX;e.y=0;e.phase='armed';this.event('batteryLand',{id:e.id,x:e.x,lane:e.lane,sourceId:e.sourceId});}
        e.fuse-=dt;
        if(e.fuse<=0&&!e.exploded){e.phase='exploding';e.exploded=true;e.blastAge=0;this.effect('explosion',e.x,e.z,0,RULES.explosionDuration);this.event('batteryExplode',{id:e.id,lane:e.lane,x:e.x,z:e.z});}
        if(e.phase==='exploding'){e.blastAge+=dt;if(e.blastAge>RULES.explosionDuration)e.phase='done';}
      }
      const dx=Math.abs(p.x-e.x),crossed=Math.min(previousZ,e.z)<2.5&&Math.max(previousZ,e.z)>-2.5;
      const trafficCrossed=Math.min(previousZ,e.z)<RULES.trafficContactHalfLength&&Math.max(previousZ,e.z)>-RULES.trafficContactHalfLength;
      if(e.kind==='coin'){
        const coinCrossed=Math.min(previousZ,e.z)<1.35&&Math.max(previousZ,e.z)>-1.35;
        if(!e.collected&&dx<1.2&&coinCrossed&&Math.abs(p.y+.8-e.y)<.92){
          e.collected=true;s.coins++;s.coinStreak=s.time-s.lastCoinAt<=1.25?s.coinStreak+1:1;s.lastCoinAt=s.time;
          s.score+=10+Math.min(10,Math.floor(s.coinStreak/5))*2;p.boost=Math.max(p.boost,.15);this.grantNitro(.016);
          this.effect('coin',e.x,e.z,e.y,.38);this.event('collect',{id:e.id,entityKind:'coin',coins:s.coins,streak:s.coinStreak,x:e.x,z:e.z,y:e.y});
        }
      }else if(e.kind==='battery'){
        if(e.phase==='exploding'&&Math.abs(e.z)<RULES.explosionHalfLength&&dx<2.05&&p.y<RULES.explosionHeight)this.hurt(e,'电池爆区在地面，提前起飞或换道。');
        if(!e.passed&&e.z<-9)this.clear(e);
      }else if(e.kind==='rearCar'){
        if(e.phase==='charging'&&crossed&&dx<1.65&&p.y<1.7)this.hurt(e,'后车追了上来，留意红色车道预警。');
        if(e.z>6&&!e.passed)this.clear(e,'闪过追车！');
      }else{
        if(e.kind==='traffic'&&trafficCrossed&&p.y<1.55){
          const toward=Math.sign(p.vx)===Math.sign(e.x-p.x)&&Math.abs(p.vx)>1.2;
          if(p.nitroActive&&dx<1.65)this.strikeTraffic(e,Math.sign(e.x-p.x)||Math.sign(p.vx)||1,2,toward&&dx>.4);
          else if(toward&&dx>.4&&dx<1.9)this.strikeTraffic(e,Math.sign(e.x-p.x),dx<1.16?2:1,true);
          if(e.wrecked)continue;
        }
        let hit=false;
        if((e.kind==='traffic'||e.kind==='faultCar'?trafficCrossed:crossed)&&dx<(e.kind==='faultCar'?2.05:1.65)){
          if(e.kind==='barrier')hit=p.y<.95;
          else if(e.kind==='traffic')hit=p.y<1.55&&s.time>e.contactUntil;
          else if(e.kind==='faultCar')hit=p.y<1.55;
          else if(e.kind==='batteryVan')hit=p.y<2.5;
          else if(e.kind==='drone')hit=Math.abs(p.y+.65-(e.y||2.75))<1.05;
          else if(e.kind==='beam')hit=p.y>1.1;
        }
        if(hit)this.hurt(e,e.kind==='faultCar'?'故障车已减速停下，提前绕行或起飞。':e.kind==='drone'?'空中有无人机，空翻闪避或从地面通过。':e.kind==='beam'?'前方横梁很低，落地通过。':'撞上了前方障碍，提前变道或起跳。');
        if(e.kind==='faultCar'&&hit&&Math.abs(e.z)<3.875&&dx<2.12){const side=Math.sign(p.x-e.x)||Math.sign(LANES[p.targetLane]-e.x)||(e.lane===2?-1:1);p.x=e.x+side*2.12;p.targetLane=clamp(e.lane+side,0,2);p.vx=0;}
        if(e.z<-4&&!e.passed)this.clear(e,p.y>.8?'凌空越过！':'漂亮走位');
      }
    }
    for(const spec of pending)this.spawn(spec.kind,spec.lane,spec.z,spec.extra);
    const battery=s.entities.find(e=>e.kind==='battery'&&e.phase!=='done'&&e.z>-8&&e.z<45);
    const close=s.entities.filter(e=>e.kind!=='coin'&&!e.hit&&!e.wrecked&&e.z>0&&e.z<40&&Math.abs(p.x-e.x)<2.4).sort((a,b)=>a.z-b.z)[0];
    if(battery)this.notice(battery.phase==='exploding'?'地面爆区 · 保持腾空':'电池落地 · 准备起飞','看地面落点，起跳后按住滑翔','BATTERY / CAUTION',.3);
    else if(close?.kind==='barrier')this.notice('前方路障 · 起飞！','空格 / 起飞键，按住可延长滞空','JUMP / AHEAD',.3);
    else if(close?.kind==='drone')this.notice(p.y>.3?'空中来车 · 翻过去！':'空中危险 · 贴地通过',p.y>.3?'按 Q / E 或空翻键短暂闪避':'也可以变道，保留起跳空间','AIR / CAUTION',.3);
    else if(close?.kind==='beam')this.notice('前方低梁 · 贴地通过','这一段先别起跳','LOW / CLEARANCE',.3);
    else if(close?.kind==='faultCar')this.notice(close.phase==='stopped'?'故障车已停下':'前车正在减速','左右绕行，或起飞越过','BRAKE / AHEAD',.3);
    s.entities=s.entities.filter(e=>!e.collected&&(!e.wrecked||e.wreckAge<1.8)&&(e.kind==='rearCar'?e.z<100:e.z>-28));
    for(const f of s.effects)f.age+=dt;s.effects=s.effects.filter(f=>f.age<f.duration);
    this.updateMissions();
  }
  snapshot() { return JSON.parse(JSON.stringify(this.state)); }
}
