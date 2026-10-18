import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {installTrackWarp} from './track.js';

// Complete ORCA vehicle with four geometry-derived axles. Materials/geometry
// are shared across instances; the former 115 loose source pieces are merged.
export async function createCarrierVehicle({ownG,ownM,ownT,distanceUniform}){
 const gltf=await new GLTFLoader().loadAsync(new URL('./assets/emerald/emerald-carrier.glb',import.meta.url).href),source=gltf.scene;source.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(source,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),offset=new THREE.Vector3(center.x,bounds.min.y,center.z),scale=5.2/size.x;
 const template=new THREE.Group(),sets=new Map(),wheels=new Map(),records=new Set(),seen=new Set();template.name='authored-battery-carrier';template.rotation.y=-Math.PI/2;template.scale.set(scale,scale,scale*1.4);
 source.traverse(o=>{if(o.name.startsWith('carrier-wheel-')){const c=o.getWorldPosition(new THREE.Vector3()),rig=new THREE.Group();rig.name=o.name;rig.position.copy(c).sub(offset);template.add(rig);wheels.set(o,{center:c,rig,sets:new Map()});}});
 if(wheels.size!==4)throw Error('Authored battery carrier requires four actual axles');
 source.traverse(o=>{if(!o.isMesh)return;let ancestor=o,wheel=null;while(ancestor&&ancestor!==source){if(wheels.has(ancestor)){wheel=wheels.get(ancestor);break;}ancestor=ancestor.parent;}
  const material=o.material;if(Array.isArray(material))throw Error('Carrier primitive must have one material');
  if(!seen.has(material)){seen.add(material);ownM(material);installTrackWarp(material,distanceUniform);material.envMapIntensity=.9;for(const t of Object.values(material))if(t?.isTexture){ownT(t);t.anisotropy=4;}}
  const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.translate(...(wheel?wheel.center:offset).toArray().map(v=>-v));const bucket=wheel?wheel.sets:sets;if(!bucket.has(material))bucket.set(material,[]);bucket.get(material).push(g);
 });
 const depth=ownM(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}));installTrackWarp(depth,distanceUniform);
 function merge(bucket,parent){for(const[material,parts]of bucket){const attrs=Object.keys(parts[0].attributes).filter(a=>parts.every(p=>p.attributes[a]));for(const p of parts)for(const a of Object.keys(p.attributes))if(!attrs.includes(a))p.deleteAttribute(a);const g=parts.length===1?parts[0]:mergeGeometries(parts,false);if(!g)throw Error('Carrier merge failed');ownG(g);const m=new THREE.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;m.customDepthMaterial=depth;parent.add(m);for(const p of parts)if(p!==g)p.dispose();}}
 merge(sets,template);let lowestWheelY=0;
 for(const w of wheels.values()){
  merge(w.sets,w.rig);let radius=0;
  w.rig.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)radius=Math.max(radius,Math.hypot(a.getX(i),a.getY(i)));});
  w.rig.userData.radius=radius*scale;
  lowestWheelY=Math.min(lowestWheelY,w.rig.position.y*scale-radius*scale);
 }
 // The source wheels are slightly eccentric around their geometry centres.
 // Bound their full spin once, keeping the tyres above the real road surface.
 template.position.y=.015-lowestWheelY;
 const metadata={source:'NVIDIA Emerald Square / ORCA Bus_2',license:'CC-BY-NC-SA-3.0',sourceTriangles:16698,sourceSize:size.toArray(),displayLength:5.2,displayWidth:size.z*scale*1.4,displayHeight:size.y*scale,sourceForwardAxis:'-X',displayForwardAxis:'-Z',groundBaseline:.015,maximumSupportOffset:template.position.y,wheels:4,sourceLoosePieces:115,bodyBatches:sets.size,wheelBatches:[...wheels.values()].reduce((n,w)=>n+w.sets.size,0)};
 function create(parent){const root=new THREE.Group(),model=template.clone(true);parent.add(root);root.add(model);const axles=[];model.traverse(o=>{if(o.name.startsWith('carrier-wheel-'))axles.push(o);});const record={root,model,type:'van',authoredCarrier:true,wheels:axles};root.userData.car=record;records.add(record);return root;}
 function update(time,speed){for(const r of records)if(r.root.visible&&r.root.parent?.visible)for(const w of r.wheels)w.rotation.z=time*speed/Math.max(.2,w.userData.radius);}
 return{create,update,records,metadata};
}
