import * as THREE from './vendor/three.module.js';
import {installTrackWarp} from './track.js';

// Native geometry: corrugated metal, flush drainage and supported overhead signs.
// It stays outside the three playable lanes and shares the road-space Jacobian.
export function createRoadDetail({scene,ownG,ownM,ownT,distanceUniform}){
 const batches=[],temp=new THREE.Object3D(),root=new THREE.Group();root.name='road-craft';scene.add(root);
 const depth=ownM(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}));installTrackWarp(depth,distanceUniform);
 const material=(color,roughness,metalness)=>{const m=ownM(new THREE.MeshStandardMaterial({color,roughness,metalness}));installTrackWarp(m,distanceUniform);return m;};
 const steel=material(0x9ba9b6,.32,.86),dark=material(0x35414c,.55,.65),paint=material(0xe7e3cb,.72,.08),amber=material(0xf7ad32,.3,.1),blue=material(0x184860,.63,.22);
 const box=ownG(new THREE.BoxGeometry(1,1,1));
 const batch=(name,g,m,count)=>{const o=new THREE.InstancedMesh(g,m,count);o.name='road-craft-'+name;o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;o.customDepthMaterial=depth;o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(o);batches.push(o);return o;};
 const put=(b,i,x,y,z,sx=1,sy=1,sz=1,ry=0,rz=0)=>{temp.position.set(x,y,z);temp.scale.set(sx,sy,sz);temp.rotation.set(0,ry,rz);temp.updateMatrix();b.setMatrixAt(i,temp.matrix);};
 const shape=new THREE.Shape();
 [[-.055,-.16],[-.11,-.08],[-.035,0],[-.11,.08],[-.055,.16],[.025,.16],[-.025,.08],[.04,0],[-.025,-.08],[.025,-.16]].forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
 const folded=ownG(new THREE.ExtrudeGeometry(shape,{depth:11.98,steps:1,bevelEnabled:false}));folded.translate(0,0,-5.99);
 const rails=batch('formed-steel-rails',folded,steel,76),posts=batch('posts',box,dark,152),bolts=batch('bolts',ownG(new THREE.SphereGeometry(.027,6,4)),steel,152),markers=batch('reflectors',box,amber,76);
 const drains=batch('flush-drain-slots',box,dark,312),joints=batch('bridge-expansion-joints',box,dark,28);
 const signPanels=batch('sign-panels',box,blue,3),signRims=batch('sign-rims',box,steel,3),signBeams=batch('sign-trusses',box,steel,9),signLegs=batch('sign-supports',box,dark,6);
 const arrowShape=new THREE.Shape();[[-.10,-.35],[.10,-.35],[.10,.1],[.3,.1],[0,.42],[-.3,.1],[-.1,.1]].forEach(([x,y],i)=>i?arrowShape.lineTo(x,y):arrowShape.moveTo(x,y));arrowShape.closePath();
 const arrowGeo=ownG(new THREE.ShapeGeometry(arrowShape)),arrows=batch('direction-arrows',arrowGeo,paint,9);
 const seams=[];
 for(let i=0;i<28;i++)seams.push({metres:i*46+7});
 function update(distance){
  const wrap=(x,n)=>((x%n)+n)%n;
  for(let i=0;i<38;i++)for(let sideIndex=0;sideIndex<2;sideIndex++){
   const side=sideIndex?1:-1,n=i*2+sideIndex,z=45-i*12+wrap(distance,12);
   put(rails,n,side*6.02,.83,z,1,1,1,side<0?Math.PI:0);
   for(let k=0;k<2;k++){put(posts,n*2+k,side*6.08,.56,z-3+k*6,.085,.75,.09);put(bolts,n*2+k,side*5.93,.83,z-3+k*6);}
   put(markers,n,side*5.91,.87,z-3,.025,.105,.07);
  }
  for(let i=0;i<156;i++)for(let sideIndex=0;sideIndex<2;sideIndex++)put(drains,i*2+sideIndex,(sideIndex?1:-1)*5.76,.034,40-i*2.9+wrap(distance,2.9),.18,.013,.052);
  for(let i=0;i<seams.length;i++)put(joints,i,0,.034,((distance-seams[i].metres+390)%440+440)%440-390,11.5,.008,.025);
  for(let i=0;i<3;i++){
   const z=70-i*290+wrap(distance,870);
   put(signRims,i,0,7.4,z,6.68,1.5,.19);put(signPanels,i,0,7.4,z+.12,6.5,1.34,.10);
   put(signBeams,i*3,0,8.36,z,13.3,.14,.2);put(signBeams,i*3+1,0,8.0,z,13.3,.10,.18);put(signBeams,i*3+2,0,8.18,z,12.9,.055,.055);
   for(let k=0;k<2;k++)put(signLegs,i*2+k,(k?1:-1)*6.5,4.1,z,.15,8.2,.20);
   for(let lane=0;lane<3;lane++)put(arrows,i*3+lane,(lane-1)*2.05,7.4,z+.182,.85,.85,1);
  }
  for(const b of batches)b.instanceMatrix.needsUpdate=true;
 }
 scene.userData.roadCraft={nativeGeometry:true,formedRailCrossSection:true,railOutsideLaneX:5.91,drainSlots:312,overheadSignUnderside:6.65,roadSpaceShared:true};
 update(0);return{update};
}
