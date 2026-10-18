import { Vector3 } from './vendor/three.module.js';

const point=new Vector3();
const interfaceState={speedRatio:0,objective:null,hazard:null};
export function updateRaceInterface(state,world){
  const kph=Math.max(0,state.speed*3.6),ratio=Math.min(1,kph/210);
  interfaceState.speedRatio=ratio;
  document.getElementById('speedFill').style.strokeDashoffset=String(100-ratio*100);
  document.querySelector('.instruments').setAttribute('aria-label',`时速 ${Math.floor(kph)} km/h，喷气 ${Math.round(state.player.nitroEnergy*100)}%，护盾 ${state.player.health}`);
  const missions=state.missions||[];
  const completed=missions.findIndex(m=>m.completeUntil>state.time);
  const selected=completed>=0?completed:Math.floor(state.time/8)%Math.max(1,missions.length);
  for(let i=0;i<missions.length;i++)document.querySelector(`[data-mission="${missions[i].id}"]`).classList.toggle('current',i===selected);
  interfaceState.objective=missions[selected]?.id||null;
  const marker=document.getElementById('objectWarning');
  const hazard=state.status==='running'&&!state.rearWarning?
    (state.entities||[]).filter(e=>e.kind==='faultCar'&&e.z>7&&e.z<90).sort((a,b)=>a.z-b.z)[0]:null;
  let visible=false;
  if(hazard&&world?.camera&&world.scene?.userData.trackPoint){
    point.fromArray(world.scene.userData.trackPoint(hazard.x,(hazard.y||0)+2.1,hazard.z,state.distance));
    point.project(world.camera);
    const x=(point.x*.5+.5)*innerWidth,y=(-point.y*.5+.5)*innerHeight;
    visible=point.z>-1&&point.z<1&&x>34&&x<innerWidth-34&&y>84&&y<innerHeight*.72;
    if(visible){marker.style.left=`${x}px`;marker.style.top=`${y}px`;marker.querySelector('span').textContent=hazard.phase==='stopped'?'前车已停':'前车减速';interfaceState.hazard={id:hazard.id,x,y,phase:hazard.phase};}
  }
  marker.classList.toggle('hidden',!visible);
  if(!visible)interfaceState.hazard=null;
  document.getElementById('eventBanner').classList.toggle('object-linked',visible&&/故障车|前车/.test(state.notice?.title||''));
}
export function raceInterfaceSnapshot(){return JSON.parse(JSON.stringify(interfaceState));}
