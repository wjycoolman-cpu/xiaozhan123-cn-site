import { DriveCore } from './core.js';
import { DriveAudio } from './audio.js';
import { GAME_VERSION, GAME_BUILD } from './build-info.js';
import { updateRaceInterface, raceInterfaceSnapshot } from './race-interface.js';

const $=id=>document.getElementById(id),show=(id,yes)=>$(id).classList.toggle('hidden',!yes);
const audio=new DriveAudio();let core,world,lastFrame=performance.now(),accumulator=0,frames=[],eventCursor=0,uiClock=0,lastStatus='',runNumber=0,lastCoinCount=0;
const query=new URLSearchParams(location.search),qa=query.has('qa');
let diagnostics;
const diagnosticsReady=import('./diagnostics.js').then(({createDiagnostics})=>{
  diagnostics=createDiagnostics({version:GAME_VERSION,build:GAME_BUILD,scopeURL:new URL('./',import.meta.url).href});
  $('diagnosticsControl').replaceChildren();diagnostics.mountControl($('diagnosticsControl'));
  return diagnostics;
}).catch(()=>null);
$('versionNote').textContent=`版本 ${GAME_VERSION}`;
const feedbackHandoff={schema:'website-feedback-handoff/v1',productId:'electric-drive',text:'',contact:'',version:`${GAME_VERSION} (${GAME_BUILD})`,source:'app'};
const handoffBytes=new TextEncoder().encode(JSON.stringify(feedbackHandoff));
$('feedbackLink').hash='handoff='+btoa(String.fromCharCode(...handoffBytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
$('fatalFeedbackLink').href=$('feedbackLink').href;
const inputIsTouch=()=>matchMedia('(pointer:coarse)').matches||innerWidth<=760;
function hintForInput(text){if(!inputIsTouch())return text;return text.replace(/A\s*\/\s*D 或方向键换道；触屏点左右箭头。/g,'点按左右箭头换道。').replace(/A\s*\/\s*D\s*换道/g,'点按左右箭头换道').replace(/空格\s*\/\s*起(?:跳|飞)键/g,'「飞跃」').replace(/按\s*Q\s*\/\s*E 或空翻键/g,'点按「空翻」').replace(/Q\s*\/\s*E 空翻；触屏点空翻键/g,'点按「空翻」').replace(/Q\s*\/\s*E/g,'「空翻」').replace(/Shift(?:\s*\/\s*喷气(?:键|按钮)?)?/g,'「喷气」').replace(/空格|起跳键|起飞键/g,'「飞跃」').replace(/按住起跳/g,'按住「飞跃」');}
let best=0;try{best=Number(localStorage.getItem('electric-drive-best-v1'))||0;}catch{}
$('best').textContent=String(best);
const metrics={frames:0,maxFrameMs:0,frameSamples:[],startedAt:Date.now(),errors:[],worldReady:false};
addEventListener('error',e=>metrics.errors.push(String(e.message)));
addEventListener('unhandledrejection',e=>metrics.errors.push(String(e.reason)));

function syncStatus(){
  const s=core.state,running=['running','intro','paused'].includes(s.status);
  document.body.classList.toggle('playing',s.status!=='menu');
  document.body.dataset.status=s.status;
  show('menuPanel',s.status==='menu');show('menuFooter',s.status==='menu');show('sceneLabel',s.status==='menu');show('gameHud',s.status!=='menu'&&s.status!=='intro');show('runStats',s.status!=='menu'&&s.status!=='intro');show('pauseBtn',running);show('touchControls',s.status==='running');show('pausePanel',s.status==='paused');show('overPanel',s.status==='over');show('introOverlay',s.status==='intro');
  if(s.status==='over'){
    const meters=Math.floor(s.distance);if(meters>best){best=meters;$('best').textContent=String(best);try{localStorage.setItem('electric-drive-best-v1',String(best));}catch{}}
    $('resultDistance').textContent=String(meters);$('resultBest').textContent=`${best} m`;$('resultScore').textContent=String(Math.floor(s.score));$('resultCoins').textContent=String(s.coins);$('resultKnockdowns').textContent=String(s.knockdowns);$('resultReason').textContent=s.reason;$('resultMissions').textContent=`完成目标 ${s.missionsCompleted}`;$('resultTitle').textContent=meters>=best&&meters>50?'刷新最远里程':'驾驶结束';
  }
  if(s.status!==lastStatus){const focusId={menu:'startBtn',running:'game',intro:'skipIntroBtn',paused:'resumeBtn',over:'restartBtn'}[s.status];if(focusId)$(focusId).focus({preventScroll:true});}
  lastStatus=s.status;
}
function start(practice=false){show('controlsPanel',false);audio.stopTransient();core.begin(practice,82317+runNumber++*7309);$('modeLabel').textContent=practice?'身法练习':'自由驾驶';accumulator=0;eventCursor=0;metrics.frameSamples=[];lastCoinCount=0;syncStatus();ui();$('game').focus({preventScroll:true});}
function togglePause(){if(core.state.status==='running'||core.state.status==='intro')core.pause();else if(core.state.status==='paused'){core.resume();$('game').focus({preventScroll:true});}syncStatus();}
function home(){audio.stopTransient();core.reset();accumulator=0;eventCursor=0;syncStatus();}
function action(name,down=true){if(!core)return;if(name==='left'&&down)core.lane(-1);if(name==='right'&&down)core.lane(1);if(name==='jump')down?core.jump():core.releaseJump();if(name==='roll'&&down)core.roll(1);if(name==='nitro')core.nitro(down);}
function bind(){
  $('startBtn').addEventListener('click',()=>start());$('practiceBtn').addEventListener('click',()=>start(true));$('pauseBtn').addEventListener('click',togglePause);$('resumeBtn').addEventListener('click',togglePause);$('restartBtn').addEventListener('click',()=>start(core.state.practice));$('pauseRestartBtn').addEventListener('click',()=>start(core.state.practice));$('homeBtn').addEventListener('click',home);$('resultHomeBtn').addEventListener('click',home);
  $('controlsBtn').addEventListener('click',()=>{const keys=[...document.querySelectorAll('.control-list dt')];const labels=inputIsTouch()?['‹  ›','飞跃 · 按住滑翔','↻ 空翻','喷气 · 按住加速','Ⅱ 暂停']:['← → / A D','空格','Q E','Shift','P / Esc'];keys.forEach((el,i)=>el.textContent=labels[i]);show('controlsPanel',true);$('closeControlsBtn').focus({preventScroll:true});});
  $('closeControlsBtn').addEventListener('click',()=>{show('controlsPanel',false);$('controlsBtn').focus({preventScroll:true});});
  $('settingsBtn').addEventListener('click',()=>{show('settingsPanel',true);$('closeSettingsBtn').focus({preventScroll:true});});
  $('closeSettingsBtn').addEventListener('click',()=>{show('settingsPanel',false);$('settingsBtn').focus({preventScroll:true});});
  $('skipIntroBtn').addEventListener('click',()=>{core.skipIntro();syncStatus();});
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();if(core.state.status==='running')core.pause();else if(core.state.status==='menu')return;syncStatus();});
  $('soundBtn').addEventListener('click',async()=>{const enabled=await audio.toggle();$('soundBtn').querySelector('span').textContent=enabled?'开':'关';$('soundBtn').setAttribute('aria-label',enabled?'关闭声音':'开启声音');$('soundBtn').title=enabled?'关闭声音':'开启声音';});
  addEventListener('keydown',e=>{
    const openDialog=[...document.querySelectorAll('.scrim:not(.hidden)')].find(el=>el.getAttribute('role')==='dialog');
    if(openDialog&&e.code==='Tab'){const buttons=[...openDialog.querySelectorAll('button,a[href],input')].filter(el=>!el.disabled&&el.getClientRects().length);const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}
    if(!$('settingsPanel').classList.contains('hidden')){if(e.code==='Escape')$('closeSettingsBtn').click();return;}
    if(!$('controlsPanel').classList.contains('hidden')){if(e.code==='Escape')$('closeControlsBtn').click();return;}
    if(core.state.status==='menu'&&['ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();const options=[...document.querySelectorAll('.menu-action')];const current=options.indexOf(document.activeElement);options[(current+(e.code==='ArrowDown'?1:-1)+options.length)%options.length].focus();return;}
    if(e.target instanceof HTMLButtonElement && (e.code==='Enter'||(e.code==='Space'&&core.state.status!=='running')))return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','Escape','KeyA','KeyD','KeyW','KeyQ','KeyE','KeyP','KeyR','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();
    if(e.repeat)return;
    if(e.code==='KeyP'||e.code==='Escape')return togglePause();
    if(core.state.status==='intro'){if(['Space','Enter'].includes(e.code)){e.preventDefault();core.skipIntro();syncStatus();}return;}
    if(e.code==='Enter'&&core.state.status==='menu')return start();
    if(e.code==='KeyR'&&core.state.status!=='menu')return start(core.state.practice);
    if(e.code==='ShiftLeft'||e.code==='ShiftRight')return action('nitro');
    if(e.code==='ArrowLeft'||e.code==='KeyA')action('left');if(e.code==='ArrowRight'||e.code==='KeyD')action('right');if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')action('jump');if(e.code==='KeyQ')core.roll(-1);if(e.code==='KeyE')core.roll(1);
  });
  addEventListener('keyup',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code))core.releaseJump();if(['ShiftLeft','ShiftRight'].includes(e.code))action('nitro',false);});
  for(const button of document.querySelectorAll('[data-action]')){
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);action(button.dataset.action);});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{if(button.dataset.action==='jump')action('jump',false);if(button.dataset.action==='nitro')action('nitro',false);});
  }
  addEventListener('blur',()=>{if(['running','intro'].includes(core.state.status)){core.pause();syncStatus();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&['running','intro'].includes(core.state.status)){core.pause();syncStatus();}});
  const resize=()=>world?.resize(innerWidth,innerHeight);addEventListener('resize',resize);resize();
}
function ui(){const s=core.state,p=s.player;
  $('introProgress').style.transform=`scaleX(${s.intro.progress})`;
  for(const mission of s.missions){const node=document.querySelector(`[data-mission="${mission.id}"]`);node.querySelector('b').textContent=mission.completeUntil?'完成':`${mission.value}/${mission.target}`;node.querySelector('i').style.transform=`scaleX(${mission.value/mission.target})`;node.classList.toggle('complete',!!mission.completeUntil);}
  const coins=s.coins||0;$('coinCount').textContent=String(coins);$('coinReadout').setAttribute('aria-label',`金币 ${coins}`);$('coinStreak').textContent=s.coinStreak>=5?`×${s.coinStreak}`:'';
  if(coins>lastCoinCount){$('coinReadout').classList.remove('collected');void $('coinReadout').offsetWidth;$('coinReadout').classList.add('collected');}lastCoinCount=coins;
  $('distance').innerHTML=s.distance>=1000?`${(s.distance/1000).toFixed(2)}<span> km</span>`:`${Math.floor(s.distance)}<span> m</span>`;$('speed').textContent=String(Math.floor(s.speed*3.6)).padStart(3,'0');$('score').textContent=String(Math.floor(s.score));$('combo').textContent=s.combo>1?`连续身法 ×${s.combo}`:'身法积分';
  const energy=Math.min(1,Math.max(0,p.nitroEnergy));$('nitroFill').style.transform=`scaleX(${energy})`;$('nitroText').textContent=p.nitroActive?'喷射中':energy<.08?'待充能':`${Math.round(energy*100)}%`;
  const nitroButton=$('nitroButton');nitroButton.querySelector('small').textContent=p.nitroActive?'喷射中':energy<.08?'待充能':core.nitroExhausted&&core.nitroHeld?'松开重按':'喷气';nitroButton.classList.toggle('active',p.nitroActive);nitroButton.classList.toggle('empty',energy<.08);nitroButton.setAttribute('aria-pressed',String(p.nitroActive));nitroButton.setAttribute('aria-label',`按住喷气加速，能量 ${Math.round(energy*100)}%`);$('nitroStatus').classList.toggle('active',p.nitroActive);
  $('rollFill').style.width=`${(1-p.rollCooldown/1.35)*100}%`;$('rollText').textContent=p.rollCooldown>0?`${p.rollCooldown.toFixed(1)} s`:'就绪';
  $('hearts').setAttribute('aria-label',`剩余 ${p.health} 层护盾`);
  document.querySelector('.desktop-help').classList.toggle('hidden',s.time>7);
  [...$('hearts').children].forEach((el,i)=>el.classList.toggle('empty',i>=p.health));
  const notice=s.notice,visible=s.time<notice.until&&s.status==='running'&&!s.rearWarning;$('eventBanner').classList.toggle('visible',visible);$('eventBanner').classList.toggle('danger',/BATTERY|REAR/.test(notice.label));
  document.querySelector('.mission-list').classList.toggle('suppressed',inputIsTouch()&&(visible||s.rearWarning));
  $('eventTitle').textContent=notice.title;$('eventHint').textContent=hintForInput(notice.hint);$('eventLabel').textContent=/BATTERY/.test(notice.label)?'电池预警':/LESSON|TRAIN|PRACTICE/.test(notice.label)||(s.practice&&/WARM/.test(notice.label))?'身法练习':/DRONE/.test(notice.label)?'空中注意':'道路提示';
  show('rearWarning',s.rearWarning&&s.status==='running');const f=s.feedback;$('feedback').dataset.side=p.x>.6?'left':'right';$('feedback').classList.toggle('show',s.time<f.until&&s.status==='running'&&!s.rearWarning&&!(visible&&/BATTERY|REAR/.test(notice.label))&&!(inputIsTouch()&&p.y>.25));$('feedback').replaceChildren(document.createTextNode(f.title),Object.assign(document.createElement('small'),{textContent:f.detail}));
  updateRaceInterface(s,world);
}
function frame(now){
  requestAnimationFrame(frame);const elapsed=now-lastFrame;lastFrame=now;const dt=Math.min(.05,Math.max(0,elapsed/1000));
  if(!world||!core)return;metrics.frames++;if(core.state.status==='running'&&elapsed<500){metrics.maxFrameMs=Math.max(metrics.maxFrameMs,elapsed);frames.push(elapsed);if(frames.length>900)frames.shift();}
  if(core.state.status==='running'||core.state.status==='intro'){accumulator+=dt;while(accumulator>=1/120){core.update(1/120);accumulator-=1/120;if(!['running','intro'].includes(core.state.status))break;}}
  else if(core.state.status==='menu'){core.state.time+=dt;core.state.distance+=dt*7;}
  if(core.state.status!==lastStatus)syncStatus();
  for(const event of core.state.events)if(event.seq>eventCursor){audio.event(event);eventCursor=event.seq;}
  audio.update(core.state);world.render(core.state,dt);uiClock+=dt;if(uiClock>.07){ui();uiClock=0;}
}
async function boot(){
  try{
    const [visuals,encounters]=await Promise.all([import('./world.js'),import('./encounters.js').catch(()=>({ENCOUNTERS:[]}))]);
    core=new DriveCore(encounters.ENCOUNTERS||[],encounters.TUTORIAL||[],encounters.OPENING_COINS||[]);world=visuals.createWorld($('game'),{quality:'auto',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
    if(world.ready)await world.ready;
    metrics.worldReady=true;bind();syncStatus();ui();show('loading',false);
    if(location.hostname==='127.0.0.1'){const heartbeat=()=>fetch('/__heartbeat',{cache:'no-store'}).catch(()=>{});heartbeat();setInterval(heartbeat,25000);}
    if(qa){Object.defineProperty(window,'__DRIVE_QA__',{value:{snapshot:()=>({...core.snapshot(),audio:audio.getMetrics(),interface:raceInterfaceSnapshot(),metrics:{...metrics,frameSamples:[...frames],drawCalls:world.renderer?.info?.render?.calls,triangles:world.renderer?.info?.render?.triangles}}),version:GAME_VERSION},writable:false});}
    lastFrame=performance.now();requestAnimationFrame(frame);
  }catch(error){metrics.errors.push(String(error.stack||error));$('fatalReason').textContent='资源未能完整载入。请重新载入；若仍失败，可通过反馈入口报告。';show('loading',false);show('fatal',true);console.error(error);void diagnosticsReady.then(async d=>{await d?.captureDisplayedFatal({displayed:true,code:'startup_failed',stage:'boot',error});void d?.retry();});}
}
boot();
