import * as THREE from './vendor/three.module.js';
import {installTrackWarp,trackPoint} from './track.js';

// Fictional chase livery on the licensed, detailed CarConcept source.
// Reads the root-owned intro/pursuit contract; creates no timers or collisions.
export function createPursuitVisuals({source,scene,ownG,ownM,ownT,makeCanvas,distanceUniform}){
 source.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(source,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=4.05/size.z;
 const shift=new THREE.Vector3(center.x,bounds.min.y,center.z),axis=new THREE.Vector3(0,1,0),parts=[],wheelNames=new Set(['WheelFrontL','WheelFrontR','WheelRearL','WheelRearR']);
 const depth=ownM(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}));installTrackWarp(depth,distanceUniform);
 source.traverse(part=>{
  if(!part.isMesh)return;
  let parent=part,wheel=null;while(parent&&parent!==source){if(wheelNames.has(parent.name)){wheel=parent;break;}parent=parent.parent;}
  const pivot=wheel?wheel.getWorldPosition(new THREE.Vector3()).sub(shift).multiplyScalar(scale).applyAxisAngle(axis,Math.PI):null;
  const geometry=ownG(part.geometry.clone());geometry.applyMatrix4(part.matrixWorld);geometry.translate(-shift.x,-shift.y,-shift.z);geometry.scale(scale,scale,scale);geometry.rotateY(Math.PI);if(pivot)geometry.translate(-pivot.x,-pivot.y,-pivot.z);
  const material=ownM(part.material.clone());material.userData={...material.userData,trackWarp:false};
  if(pivot&&material.name==='TrafficRim'){material.color.set(0x6f7b87);material.roughness=.5;material.metalness=.65;}
  if(material.name==='TrafficPaint'){
   material.color.set(0xe9eef3);material.metalness=.42;material.roughness=.27;
   material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vPoliceLocal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPoliceLocal=position;');
    shader.fragmentShader='varying vec3 vPoliceLocal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float stripe=smoothstep(.29,.32,vPoliceLocal.y)*(1.0-smoothstep(.59,.62,vPoliceLocal.y));
      float hood=step(1.24,abs(vPoliceLocal.z))*smoothstep(.45,.52,vPoliceLocal.y);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.012,.055,.16),max(stripe,hood*.92));`);
   };
   material.customProgramCacheKey=()=> 'r7-fictional-police-two-tone-v1';
  }
  installTrackWarp(material,distanceUniform);parts.push({geometry,material,pivot});
 });
 const root=new THREE.Group();root.name='opening-police-pursuit';scene.add(root);
 const basic=(color,opacity=1)=>{const m=ownM(new THREE.MeshBasicMaterial({color,toneMapped:false,transparent:opacity<1,opacity,depthWrite:opacity===1}));installTrackWarp(m,distanceUniform);return m;};
 const black=ownM(new THREE.MeshStandardMaterial({color:0x142335,roughness:.32,metalness:.66}));installTrackWarp(black,distanceUniform);
 const red=basic(0xff2538),blue=basic(0x2784ff),white=basic(0xe0eeff);
 const glowCanvas=makeCanvas(64,128),glowCtx=glowCanvas.getContext('2d');glowCtx.save();glowCtx.scale(1,2);
 const glow=glowCtx.createRadialGradient(32,32,0,32,32,32);glow.addColorStop(0,'rgba(255,255,255,.6)');glow.addColorStop(.45,'rgba(255,255,255,.22)');glow.addColorStop(1,'rgba(255,255,255,0)');glowCtx.fillStyle=glow;glowCtx.fillRect(0,0,64,64);glowCtx.restore();
 const glowTexture=ownT(new THREE.CanvasTexture(glowCanvas));
 const spillMaterial=color=>{const m=basic(color,.18);m.map=glowTexture;m.blending=THREE.AdditiveBlending;return m;};
 const box=ownG(new THREE.BoxGeometry(1,1,1)),cars=[];
 const add=(g,m,parent,position,scale)=>{const o=new THREE.Mesh(g,m);o.position.set(...position);o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;o.customDepthMaterial=depth;parent.add(o);return o;};
 for(let i=0;i<2;i++){
  const car=new THREE.Group(),wheels=[];car.name='police-car-'+i;root.add(car);
  for(const part of parts){const mesh=add(part.geometry,part.material,car,part.pivot?part.pivot.toArray():[0,0,0],[1,1,1]);if(part.pivot)wheels.push(mesh);}
  add(box,black,car,[0,1.14,.06],[1.1,.045,.32]);
  const r=add(box,red,car,[-.31,1.23,.06],[.43,.135,.25]),b=add(box,blue,car,[.31,1.23,.06],[.43,.135,.25]);
  for(const side of[-1,1]){add(box,black,car,[side*.42,1.08,.06],[.08,.15,.11]);add(box,white,car,[side*.73,.43,-2.025],[.15,.035,.02]);}
  // Soft coloured spill is a short ground plane, avoiding two extra dynamic shadow lights.
  const spillGeo=ownG(new THREE.PlaneGeometry(1,1));spillGeo.rotateX(-Math.PI/2);
  const spillR=add(spillGeo,spillMaterial(0xff254b),car,[-.57,.032,.1],[1.4,1,4.8]),spillB=add(spillGeo,spillMaterial(0x287aff),car,[.57,.033,.1],[1.4,1,4.8]);
  spillR.castShadow=false;spillB.castShadow=false;spillR.receiveShadow=false;spillB.receiveShadow=false;
  cars.push({car,wheels,red:r,blue:b,spillR,spillB});
 }
 const metadata={source:'CarConcept-TrafficLOD / CC-BY-4.0; fictional white-blue chase adaptation',cars:2,visible:0,introProgress:0};scene.userData.policePursuit=metadata;
 function update(state,time,speed){
  const intro=state.status==='intro'&&state.intro?.active,active=!!state.pursuit?.active||intro;
  const progress=THREE.MathUtils.clamp(state.intro?.progress||0,0,1),pressure=THREE.MathUtils.clamp(state.pursuit?.pressure??.5,0,1);
  root.visible=active;metadata.visible=active?2:0;metadata.introProgress=progress;
  for(let i=0;i<cars.length;i++){
   const c=cars[i],side=i?1:-1;
   c.car.position.set(side*(intro?2.35:3.0),.018,intro?7.2-i*3.9:10+(1-pressure)*11+i*5);
   c.car.rotation.y=Math.sin(time*1.8+i)*.018;
   for(const w of c.wheels)w.rotation.x=time*(intro?18:speed)/.31;
   const flash=Math.sin(time*12+i*.3)>.05;c.red.visible=flash;c.blue.visible=!flash;c.spillR.visible=flash;c.spillB.visible=!flash;
  }
 }
 update({},0,0);return{update};
}

export function createBrakeVapor({scene,ownT,ownM,makeCanvas}){
 const canvas=makeCanvas(32,32),ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(16,16,0,16,16,16);
 gradient.addColorStop(0,'rgba(255,255,255,.62)');gradient.addColorStop(.45,'rgba(255,255,255,.18)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);
 const texture=ownT(new THREE.CanvasTexture(canvas)),root=new THREE.Group();root.name='fault-car-brake-vapor';scene.add(root);
 const sprites=[];for(let i=0;i<16;i++){const material=ownM(new THREE.SpriteMaterial({map:texture,color:0xaab7bd,transparent:true,opacity:0,depthWrite:false})),sprite=new THREE.Sprite(material);root.add(sprite);sprites.push(sprite);}
 const metadata={active:0,maximumOpacity:.095,source:'native procedural soft tire haze'};scene.userData.brakeVapor=metadata;
 function update(state){
  let n=0;const time=state.time||0,distance=state.distance||0;
  for(const e of state.entities||[]){if(e.kind!=='faultCar'||e.phase!=='braking'||!(e.speed>1.5)||Math.abs(e.z)>90)continue;
   for(let i=0;i<8&&n<sprites.length;i++){
    const sprite=sprites[n++],side=i%2?1:-1,t=((time*1.35+Math.floor(i/2)*.23)%1+1)%1;
    const x=(Number.isFinite(e.x)?e.x:[-3.2,0,3.2][e.lane??1])+side*.80;
    sprite.position.fromArray(trackPoint(x,.13+t*.55,e.z-1.2-t*1.1,distance));sprite.scale.setScalar(.15+t*.42);
    sprite.material.opacity=Math.sin(t*Math.PI)*.095*Math.min(1,(e.brakeRatio||.15)*3);sprite.visible=true;
   }
  }
  for(let i=n;i<sprites.length;i++)sprites[i].visible=false;metadata.active=n;
 }
 update({});return{update};
}
