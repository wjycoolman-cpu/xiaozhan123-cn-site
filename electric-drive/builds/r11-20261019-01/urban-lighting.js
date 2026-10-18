import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {trackPoint,installTrackWarp} from './track.js';
import {TIME_OF_DAY_PROFILES,normalizeTimeOfDay} from './time-of-day.js';

// Applied only to known window/interior materials; source window geometry,
// textures, silhouettes and world depth remain intact.
export function applyWindowLighting(material,roomLightUniform={value:1}){
 if(material.userData.r9WindowLighting)return;
 material.userData.r9WindowLighting=true;
 const before=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=function(shader,renderer){
  before.call(this,shader,renderer);
  shader.uniforms.cityRoomLight=roomLightUniform;
  shader.vertexShader='varying vec3 vLitWindowLocal;\nvarying float vLitRoomSeed;\n#ifdef USE_INSTANCING\nattribute float roomSeed;\n#endif\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vLitWindowLocal=position;
   #ifdef USE_INSTANCING
    vLitRoomSeed=roomSeed;
   #else
    vLitRoomSeed=0.0;
   #endif
   `);
  shader.fragmentShader='uniform float cityRoomLight;\nvarying vec3 vLitWindowLocal;\nvarying float vLitRoomSeed;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   vec3 roomCell=floor(vLitWindowLocal/vec3(3.0,3.0,3.0));
   float roomChoice=fract(sin(dot(roomCell,vec3(12.9898,78.233,41.117))+vLitRoomSeed*13.117)*43758.5453);
   float occupiedRoom=step(.88,roomChoice);
   totalEmissiveRadiance+=occupiedRoom*vec3(.28,.13,.055)*cityRoomLight;`);
 };
 material.customProgramCacheKey=()=>key()+'|r9-stable-selective-window-light-3';
 material.needsUpdate=true;
}

// Reuses one real ORCA lamp with four instanced material parts. No per-lamp
// dynamic shadows or additional reflection captures are added.
export async function createUrbanLighting({scene,ownG,ownM,ownT,distanceUniform}){
 const loaded=await new GLTFLoader().loadAsync(new URL('./assets/bistro/bistro-street-lamp-512.glb',import.meta.url).href);
 loaded.scene.updateMatrixWorld(true);
 const slots=12,count=slots*2,batches=[],anchor=new THREE.Object3D(),head=new THREE.Vector3(),emissionBounds=new THREE.Box3(),allBounds=new THREE.Box3();
 const bulbNames=new Set(['Streetlight_Support_Bulb','Paris_StringLights_01_White_Color']);
 loaded.scene.traverse(o=>{
  if(!o.isMesh)return;
  const geometry=ownG(o.geometry.clone());geometry.applyMatrix4(o.matrixWorld);geometry.computeBoundingBox();allBounds.union(geometry.boundingBox);
  const material=ownM(o.material);material.userData.trackWarpExempt=true;
  for(const t of Object.values(material))if(t?.isTexture){ownT(t);t.anisotropy=4;}
  if(bulbNames.has(material.name)){material.emissive.set(0xffc489);material.emissiveIntensity=1.0;emissionBounds.union(geometry.boundingBox);}
  const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name='city-source-lamps-'+material.name;
  mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);batches.push(mesh);
 });
 if(emissionBounds.isEmpty())throw Error('Real source lamp has no selected bulb geometry');
 emissionBounds.getCenter(head);
 const warmStrip=ownM(new THREE.MeshStandardMaterial({color:0xffbf72,emissive:0xffbd6d,emissiveIntensity:1.4,roughness:.38,metalness:.25}));
 installTrackWarp(warmStrip,distanceUniform);
 const stripGeometry=ownG(new THREE.BoxGeometry(1,1,1,1,1,24));
 const strips=new THREE.InstancedMesh(stripGeometry,warmStrip,28);strips.name='city-guardrail-light-strips';strips.frustumCulled=false;strips.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 const stripDepth=ownM(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}));installTrackWarp(stripDepth,distanceUniform);strips.customDepthMaterial=stripDepth;scene.add(strips);
 const pools=[0,1].map(()=>{const light=new THREE.PointLight(0xffc28a,110,32,2);light.castShadow=false;scene.add(light);return light;});
 const marker=new THREE.Object3D(),poolPosition=new THREE.Vector3();
 function update(distance){
  const phase=((distance%36)+36)%36,theta=Math.atan(.45*Math.cos(distance/110)+.32*Math.cos(distance/53));
  const poolCandidates=[];
  for(let i=0;i<slots;i++)for(let sideIndex=0;sideIndex<2;sideIndex++){
   const side=sideIndex?1:-1,index=i*2+sideIndex,z=42-i*36+phase,s=distance-z;
   const localTheta=Math.atan(.45*Math.cos(s/110)+.32*Math.cos(s/53));
   anchor.position.fromArray(trackPoint(side*6.55,0,-z,distance));
   anchor.rotation.set(0,theta-localTheta+(side>0?Math.PI:0),0);anchor.scale.setScalar(1);anchor.updateMatrix();
   for(const mesh of batches)mesh.setMatrixAt(index,anchor.matrix);
   if(z<22&&z>-75)poolCandidates.push({z,side,matrix:anchor.matrix.clone()});
  }
  for(const mesh of batches)mesh.instanceMatrix.needsUpdate=true;
  for(let i=0;i<14;i++)for(let sideIndex=0;sideIndex<2;sideIndex++){
   marker.position.set((sideIndex?1:-1)*5.92,1.0,42-i*36+phase);
   marker.rotation.set(0,0,0);marker.scale.set(.045,.033,35.7);marker.updateMatrix();strips.setMatrixAt(i*2+sideIndex,marker.matrix);
  }
  strips.instanceMatrix.needsUpdate=true;
  poolCandidates.sort((a,b)=>Math.abs(a.z+5)-Math.abs(b.z+5));
  for(let i=0;i<pools.length;i++){
   const record=poolCandidates[i],light=pools[i];light.visible=!!record;
   if(!record)continue;
   poolPosition.copy(head).applyMatrix4(record.matrix);
   light.position.copy(poolPosition);
  }
  scene.userData.urbanLighting.warpDistance=distance;
 }
 scene.userData.urbanLighting={source:'Amazon Lumberyard Bistro / NVIDIA ORCA',license:'CC-BY-4.0',sourceLamp:'Bistro_Research_Exterior_Paris_StreetLight_01a_6257',instances:count,materialBatches:batches.length,sourceLampBounds:allBounds.getSize(new THREE.Vector3()).toArray(),sourceBulbCenter:head.toArray(),dynamicLightPools:2,dynamicShadowLights:0,guardrailStrips:28,geometryTrianglesPerLamp:10790};
 function setTimeOfDay(mode){
  const profile=TIME_OF_DAY_PROFILES[normalizeTimeOfDay(mode)];
  for(const mesh of batches)if(bulbNames.has(mesh.material.name))mesh.material.emissiveIntensity=profile.streetLights;
  warmStrip.emissiveIntensity=1.4*profile.stripLights;
  for(const light of pools)light.intensity=110*profile.streetLights;
  scene.userData.urbanLighting.timeOfDay=mode;
 }
 update(0);return{update,setTimeOfDay};
}

