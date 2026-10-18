import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { trackPoint } from './track.js';
import {applyWindowLighting} from './urban-lighting.js';

// Shared physical lots: the street renderer makes room for the same bounds.
export const AUTHORED_BUILDING_LOTS=[
 {id:'emerald-street-045',asset:'streetfront',worldMetres:45,side:-1,nearEdge:11.5,yaw:0,size:[28.636269,22.283602,77.161617]},
 {id:'bistro-corner-045',asset:'corner',worldMetres:45,side:1,nearEdge:11.5,yaw:Math.PI/2,size:[17.492665,30.331266,23.537243]},
 {id:'bistro-ornate-130',asset:'ornate',worldMetres:130,side:-1,nearEdge:12,yaw:-Math.PI/2,size:[35.945454,27.119085,38.589821]},
 {id:'bistro-corner-105',asset:'corner',worldMetres:105,side:1,nearEdge:11.5,yaw:Math.PI/2,size:[17.492665,30.331266,23.537243]},
 {id:'emerald-coffee-170',asset:'coffee',worldMetres:170,side:-1,nearEdge:11.5,yaw:0,size:[26.464728,17.905344,26.464733]},
 {id:'emerald-tower-235',asset:'tower',worldMetres:235,side:1,nearEdge:57,yaw:0,size:[30.959252,108.250664,30.867094]},
 {id:'emerald-tower-540',asset:'tower',worldMetres:540,side:-1,nearEdge:48,yaw:Math.PI/2,size:[30.959252,108.250664,30.867094]},
 {id:'emerald-coffee-655',asset:'coffee',worldMetres:655,side:1,nearEdge:15,yaw:Math.PI/2,size:[26.464728,17.905344,26.464733]},
 {id:'bistro-ornate-670',asset:'ornate',worldMetres:670,side:-1,nearEdge:12,yaw:-Math.PI/2,size:[35.945454,27.119085,38.589821]},
 {id:'emerald-street-735',asset:'streetfront',worldMetres:735,side:-1,nearEdge:14,yaw:Math.PI,size:[28.636269,22.283602,77.161617]},
 {id:'bistro-brick-860',asset:'brick',worldMetres:860,side:1,nearEdge:17,yaw:Math.PI/2,size:[22.330722,38.424652,23.306484]},

 // R7: authored streets carry the near view; repeated modular windows stay behind them.
 // Dimensions are the actual shared GLB bounds, and yaw keeps a source street face toward the driver.
 ...[
  ['corner',220,-1,13,Math.PI],['coffee',480,-1,30,0],
  ['arcade',610,-1,14,0],['corner',810,-1,14,Math.PI],
  ['brick',895,-1,16,-Math.PI/2],['streetfront',980,-1,16,Math.PI],
  ['arcade',1070,-1,14,0],['coffee',1150,-1,15,0],['corner',1220,-1,13,Math.PI],
  ['arcade',170,1,13,-Math.PI/2],['ornate',290,1,15,Math.PI],
  ['brick',430,1,16,Math.PI/2],['corner',505,1,14,Math.PI/2],
  ['arcade',585,1,14,-Math.PI/2],['ornate',730,1,16,Math.PI],
  ['streetfront',800,1,17,Math.PI],['corner',940,1,15,Math.PI/2],
  ['arcade',1020,1,16,-Math.PI/2],['streetfront',1110,1,17,Math.PI],
  ['coffee',1190,1,15,Math.PI/2],
 ].map(([asset,worldMetres,side,nearEdge,yaw])=>({
  id:`authored-${asset}-${side}-${worldMetres}`,asset,worldMetres,side,nearEdge,yaw,
  size:({corner:[17.492665,30.331266,23.537243],ornate:[35.945454,27.119085,38.589821],
    arcade:[34.988426,29.867786,35.891518],brick:[22.330722,38.424652,23.306484],
    coffee:[26.464728,17.905344,26.464733],streetfront:[28.636269,22.283602,77.161617],
    toy:[30.149732,25.730001,30.149732]})[asset]
 })),
].map(lot=>{const c=Math.abs(Math.cos(lot.yaw)),s=Math.abs(Math.sin(lot.yaw)),longitudinalSize=c*lot.size[2]+s*lot.size[0],lateralSize=c*lot.size[0]+s*lot.size[2],margin=Math.max(8,lateralSize*.5);return{...lot,lateralSize,longitudinalSize,opening:[lot.worldMetres-longitudinalSize/2-margin,lot.worldMetres+longitudinalSize/2+margin]};});

// One authored ORCA Bistro landmark, CC BY 4.0. No source texture downloads
// occur at runtime; attribution and conversion notes live in assets/bistro/.
export async function createLandmarks({scene,ownG,ownM,ownT,roomLightUniform}){
 const load=name=>new GLTFLoader().loadAsync(new URL('./assets/bistro/'+name,import.meta.url).href);
 const [main,brick,props,kit]=await Promise.all([load('bistro-building-512.glb'),load('bistro-brick-building-512.glb'),load('bistro-props-light-512.glb'),load('bistro-city-block-kit-512.glb')]);
 const emerald={};await Promise.all(['tower','coffee','toy','streetfront'].map(async name=>{emerald[name]=await new GLTFLoader().loadAsync(new URL('./assets/emerald/emerald-'+name+'.glb',import.meta.url).href);}));
 for(const[key,name]of Object.entries({corner:'Bistro_05_Corner_Shops',ornate:'Bistro_07_Ornate_Residence',arcade:'Bistro_09_Arcade_Block'})){const part=kit.scene.getObjectByName(name);if(!part)throw Error('Authored block node missing: '+name);part.position.set(0,0,0);emerald[key]={scene:part};}
 emerald.brick=brick;
 const records=[],metadata=[];scene.userData.landmarks=metadata;
 function register(source){let meshes=0,triangles=0;source.traverse(o=>{
  if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;ownG(o.geometry);
  for(const m of(Array.isArray(o.material)?o.material:[o.material])){
   ownM(m);m.userData.trackWarpExempt=true;m.envMapIntensity=.95;
   if(['MASTER_Glass_Exterior','MASTER_Glass_Dirty','MASTER_Glass_Dirty_MASKED','MASTER_Frosted_Glass','MASTER_Room_Interior'].includes(m.name))applyWindowLighting(m,roomLightUniform);
   for(const t of Object.values(m))if(t?.isTexture){ownT(t);t.anisotropy=4;}
  }
  o.castShadow=true;o.receiveShadow=true;
 });return{meshes,triangles};}
 function building(gltf,id,worldMetres,nearEdge,side,yaw,opening,assetName=null){
  const source=gltf.scene;source.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(source,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const root=new THREE.Group(),normalizer=new THREE.Group();root.name='landmark-'+id;scene.add(root);root.add(normalizer);normalizer.add(source);normalizer.position.set(-center.x,-bounds.min.y,-center.z);
  const stats=register(source),lateralSize=Math.abs(Math.cos(yaw))*size.x+Math.abs(Math.sin(yaw))*size.z;
  const rawX=side*(nearEdge+lateralSize/2),ground=-14.05;
  const isEmerald=['tower','coffee','toy','streetfront'].includes(assetName)||id.startsWith('emerald-');const meta={id,assetName,source:isEmerald?'NVIDIA Emerald Square / ORCA':'Amazon Lumberyard Bistro / ORCA',license:isEmerald?'CC-BY-NC-SA-3.0':'CC-BY-4.0',worldMetres,nearEdge,rawX,ground,scale:1,sourceSize:size.toArray(),meshes:stats.meshes,sourceTriangles:stats.triangles,streetOpeningMetres:opening};
  metadata.push(meta);records.push({root,worldMetres,rawX,y:ground,yaw,meta});
 }
 building(main,'bistro',320,9.8,-1,Math.PI/2,[295.5,345.5]);
 // Its authored -X/-Z street faces turn toward the road and approaching driver.
 building(brick,'brick',365,11,1,Math.PI/2,[339.5,392.5]);
 for(const lot of AUTHORED_BUILDING_LOTS){const gltf=emerald[lot.asset];building({scene:gltf.scene.clone(true)},lot.id,lot.worldMetres,lot.nearEdge,lot.side,lot.yaw,lot.opening,lot.asset);}
 const template=props.scene.getObjectByName('Planter_Shrub');
 if(!template)throw Error('Bistro light-prop planter missing');
 register(props.scene);
 for(const worldMetres of[280,286,290]){
  const root=new THREE.Group(),plant=template.clone(true);plant.position.set(0,0,0);plant.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(plant,true),center=bounds.getCenter(new THREE.Vector3());
  plant.position.set(-center.x,-bounds.min.y,-center.z);root.add(plant);root.name='landmark-roof-planter';scene.add(root);
  // The six-floor podium slab top is -13.85+18+.04+.06 = 4.25m.
  // Vegetation sits 1cm above that roof near its visible road-facing edge,
  // behind its parapet, rather than hovering beside the motorway.
  records.push({root,worldMetres,rawX:-33.2,y:4.26,yaw:Math.PI/2,meta:null,supportWorldMetres:271.5});
 }
 function update(distance){
  const theta=Math.atan(.45*Math.cos(distance/110)+.32*Math.cos(distance/53));
  for(const record of records){
   const{root,worldMetres,rawX,y,yaw,meta}=record,sceneZ=((distance-worldMetres+1090)%1240+1240)%1240-1090;
   const s=distance-sceneZ,localTheta=Math.atan(.45*Math.cos(s/110)+.32*Math.cos(s/53));
   root.position.fromArray(trackPoint(rawX,y,-sceneZ,distance));root.position.y=y;
   root.rotation.set(0,yaw+theta-localTheta,0);root.visible=sceneZ>-405&&sceneZ<70;
   if(record.supportWorldMetres!==undefined){const supportZ=((distance-record.supportWorldMetres+1090)%1240+1240)%1240-1090;root.visible=root.visible&&supportZ>-390&&supportZ<65;}
   if(meta){meta.distanceUniform=distance;meta.sceneZ=sceneZ;}
  }
 }
 update(0);return{update};
}
