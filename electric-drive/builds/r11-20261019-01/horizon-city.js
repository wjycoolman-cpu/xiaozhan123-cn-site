import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {applyWindowLighting} from './urban-lighting.js';

// Actual ORCA architecture reduced offline for the distant layer. Near buildings
// retain their original detail. No per-frame loaders or environment captures.
export async function createHorizonCity({scene,ownG,ownM,ownT,roomLightUniform}){
 const loader=new GLTFLoader(),models=await Promise.all(['tower'].map(n=>loader.loadAsync(new URL(`./assets/horizon/${n}-distant.glb`,import.meta.url).href)));
 let triangles=0,batches=0;
 for(let type=0;type<models.length;type++){
  const source=models[type].scene;source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source),center=bounds.getCenter(new THREE.Vector3());
  const count=18,placements=[];
  for(let i=0;i<count;i++){
   const angle=(i+.31*type)/count*Math.PI*2,radius=350+(i%4)*57,scale=.62+(i*17%41)/100;
   const matrix=new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(angle)*radius,-14.0,Math.cos(angle)*radius),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle+(i%3)*.4),new THREE.Vector3(scale,scale,scale));placements.push(matrix);
  }
  source.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const geometry=ownG(mesh.geometry.clone());geometry.applyMatrix4(mesh.matrixWorld);geometry.translate(-center.x,-bounds.min.y,-center.z);
   for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    ownM(material);material.userData.trackWarpExempt=true;material.envMapIntensity=.65;
    if(/glass|window/i.test(material.name))applyWindowLighting(material,roomLightUniform);
    for(const texture of Object.values(material))if(texture?.isTexture)ownT(texture);
   }
   const batch=new THREE.InstancedMesh(geometry,mesh.material,count);batch.name=`horizon-${type}-${batches++}`;batch.frustumCulled=false;
   for(let i=0;i<count;i++)batch.setMatrixAt(i,placements[i]);batch.instanceMatrix.needsUpdate=true;scene.add(batch);
   triangles+=(geometry.index?.count||geometry.attributes.position.count)/3*count;
  });
 }
 scene.userData.horizonCity={models:1,buildings:18,batches,instanceTriangles:triangles,source:'NVIDIA Emerald Square / ORCA',license:'CC-BY-NC-SA-3.0',lodTextureLimit:512};
 return true;
}
