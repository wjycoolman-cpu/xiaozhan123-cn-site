import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {toCreasedNormals,mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {KEYS,keyForPitch,resolvePitch,drawSymbol} from './symbols.js';
import {createMusic2048} from './game-libs/music-2048.js';
import {createMusicTetris} from './game-libs/music-tetris.js';
import {createMusicSnake} from './game-libs/music-snake.js';
import {createMusicBreakout} from './game-libs/music-breakout.js';

if(window.HandheldCompatibility?.info.mode==='compatible')throw Error('Compatibility scene already selected');

const GAMES=['跳台阶','接星星','节奏赛车','俄罗斯方块','飞船射击','旋律花园','数字合并','旋律贪吃蛇','音符打砖块'];
const scene=new THREE.Scene();scene.background=new THREE.Color('#252c37');
const camera=new THREE.OrthographicCamera(-55,55,23,-23,.1,500);camera.position.set(0,0,100);camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.24;document.body.prepend(renderer.domElement);
const studioRoom=new RoomEnvironment(),studioPmrem=new THREE.PMREMGenerator(renderer),studioTarget=studioPmrem.fromScene(studioRoom,.04);scene.environment=studioTarget.texture;scene.environmentIntensity=.82;studioRoom.dispose();studioPmrem.dispose();
// A lower ambient floor lets the original bevel normals carry the white case's
// shape. Keep the existing three lights, their positions and the front camera.
scene.add(new THREE.HemisphereLight(0xffffff,0x708299,.48));const keyLight=new THREE.DirectionalLight(0xfff8ee,1.45);keyLight.position.set(-30,50,60);scene.add(keyLight);
const fillLight=new THREE.DirectionalLight(0xc4d9fa,.45);fillLight.position.set(45,-10,35);scene.add(fillLight);
const gameCanvas=document.createElement('canvas');gameCanvas.width=1080;gameCanvas.height=600;const ctx=gameCanvas.getContext('2d',{alpha:false});
const screenTexture=new THREE.CanvasTexture(gameCanvas);screenTexture.colorSpace=THREE.SRGBColorSpace;screenTexture.minFilter=THREE.LinearFilter;screenTexture.magFilter=THREE.LinearFilter;screenTexture.generateMipmaps=false;
const feedbackCanvas=document.createElement('canvas');feedbackCanvas.width=512;feedbackCanvas.height=300;const feedbackCtx=feedbackCanvas.getContext('2d',{alpha:false}),feedbackTexture=new THREE.CanvasTexture(feedbackCanvas);feedbackTexture.colorSpace=THREE.SRGBColorSpace;feedbackTexture.minFilter=THREE.LinearFilter;feedbackTexture.generateMipmaps=false;
const state={generation:0,frameId:0,ms:0,playing:false,started:false,waiting:true,tapDurationMode:true,exporting:false,mode:2,shape:0,game:0,previewCount:2,shownCount:0,active:[],current:[],next:[],manual:{epoch:0,total:0,lastPitch:60,counts:Array(8).fill(0),trace:'',motionMs:0,lastAttackMs:-1000}};
const contacts=new Map(),released=new Map();let model,modelPromise,loadSerial=0,disposed=false,screenMesh,modelBox,parts=[],buttons=[],sticks=[],notes=[],lastAccepted=-1,liveSlots=[],liveEpoch=0,autoPrefix=0,autoCoreGame=-1,autoCore,liveCoreGame=-1,liveCore,ready=false,renderError='',atlas=null;
const seed=2602026,modelStats={sourceTriangles:8238,sourceMaterials:6,sourceNodes:9,buttonGeometryIslands:0,buttonMeshes:8,buttonAdaptation:'actual connected source triangles recentered, enlarged and moved; original ABXY map removed from these 8 only'};
let autoCounts=Array(8).fill(0);
const SHAPES=[{name:'双侧手柄',aspect:'landscape',buttonScale:1.65,spread:8.15},{name:'复古竖式',aspect:'portrait',buttonScale:3.05,spread:15.6},{name:'横式迷你',aspect:'landscape',buttonScale:1.90,spread:8.80},{name:'圆润双屏',aspect:'portrait',buttonScale:3.20,spread:16.6},{name:'街机面板',aspect:'landscape',buttonScale:1.88,spread:8.80}];
let baseObjects=[],sourceObjects=[],caseExtras=[],secondaryScreen,appliedShape=-1,darkFrame;
function bridge(name,method,...args){try{window[name]?.[method]?.(...args);}catch(error){console.error(error);}}
function positionAttribute(a,at,component){return component===0?a.getX(at):component===1?a.getY(at):component===2?a.getZ(at):a.getW(at);}
function splitGeometry(geometry){
 const pos=geometry.attributes.position,n=pos.count,parent=Array.from({length:n},(_,i)=>i),weld=new Map();
 const find=i=>{let p=i;while(parent[p]!==p)p=parent[p];while(parent[i]!==i){const next=parent[i];parent[i]=p;i=next;}return p;};
 const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
 for(let i=0;i<n;i++){const k=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(weld.has(k))join(i,weld.get(k));else weld.set(k,i);}
 const indices=geometry.index?Array.from(geometry.index.array):Array.from({length:n},(_,i)=>i);
 for(let i=0;i<indices.length;i+=3){join(indices[i],indices[i+1]);join(indices[i],indices[i+2]);}
 const groups=new Map();for(let i=0;i<indices.length;i+=3){const key=find(indices[i]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(indices[i],indices[i+1],indices[i+2]);}
 return [...groups.values()].map(old=>{
  const remap=new Map(),unique=[];for(const v of old)if(!remap.has(v)){remap.set(v,unique.length);unique.push(v);}
  const g=new THREE.BufferGeometry();for(const [name,a]of Object.entries(geometry.attributes)){const data=new Float32Array(unique.length*a.itemSize);for(let i=0;i<unique.length;i++)for(let c=0;c<a.itemSize;c++)data[i*a.itemSize+c]=positionAttribute(a,unique[i],c);g.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize));}
  g.setIndex(old.map(v=>remap.get(v)));g.computeBoundingBox();const center=g.boundingBox.getCenter(new THREE.Vector3());return{geometry:g,center,box:g.boundingBox.clone(),triangles:old.length/3};
 });
}
function symbolTexture(slot){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');drawSymbol(c,slot,64,64,90);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
// The derived case already has one vertex per triangle corner. Use Three's
// crease-aware normals after widening, without replacing any source UV or index.
// Keep existing normals on the known Float32 zero-area residual pieces.
function creaseShellNormals(geometry){
 const position=geometry.attributes.position,index=geometry.index;
 if(!index||index.count!==position.count)return false;
 for(let i=0;i<index.count;i++)if(index.array[i]!==i)return false;
 const creased=toCreasedNormals(geometry,Math.PI/4),normal=geometry.attributes.normal,derived=creased.attributes.normal;
 for(let i=0;i<normal.count;i++){const x=derived.getX(i),y=derived.getY(i),z=derived.getZ(i);if(x*x+y*y+z*z>0)normal.setXYZ(i,x,y,z);}
 normal.needsUpdate=true;creased.dispose();return true;
}
function smoothShellNormals(geometry){
 const pos=geometry.attributes.position,acc=new Map(),key=i=>[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>Math.round(v*1e5)).join(','),indices=geometry.index.array;
 for(let i=0;i<indices.length;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,indices[i]),b=new THREE.Vector3().fromBufferAttribute(pos,indices[i+1]),c=new THREE.Vector3().fromBufferAttribute(pos,indices[i+2]),normal=b.sub(a).cross(c.sub(a));for(let k=0;k<3;k++){const id=key(indices[i+k]);if(!acc.has(id))acc.set(id,new THREE.Vector3());acc.get(id).add(normal);}}
 const normal=geometry.attributes.normal;for(let i=0;i<pos.count;i++){const v=acc.get(key(i)).normalize();normal.setXYZ(i,v.x,v.y,v.z);}normal.needsUpdate=true;
}
// Source-derived polar resampling, once at model load. UVs remain barycentric
// combinations of the same source triangle, including its original atlas seam.
function resampleRoundIsland(source,kind,segments=96){
 source.computeBoundingBox();const box=source.boundingBox.clone(),center=box.getCenter(new THREE.Vector3()),half=box.getSize(new THREE.Vector3()).multiplyScalar(.5),pos=source.attributes.position,uv=source.attributes.uv,indices=source.index.array;
 const report={kind,segments,sourceTriangles:indices.length/3,sourceBox:{min:box.min.toArray(),max:box.max.toArray()},sourceHeight:box.max.y-box.min.y,derived:false};
 if(!uv||half.x<=0||half.z<=0){report.reason='source UV or radial extent unavailable';return{geometry:source,report};}
 const step=Math.PI*2/segments,layers=new Map();
 for(let i=0;i<pos.count;i++){const y=Math.round(pos.getY(i)*1e5);if(!layers.has(y))layers.set(y,[]);layers.get(y).push([pos.getX(i)-center.x,pos.getZ(i)-center.z]);}
 // Only the circular/elliptical source rims qualify. Inner triangulation points
 // are removed by a convex hull; an irregular polygon is not silently rounded.
 let maxEllipseError=0;const layerProfiles=[];
 for(const [level,points]of layers){
  const unique=[...new Map(points.map(p=>[p.map(v=>Math.round(v*1e5)).join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  if(unique.length<3)continue;const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),lower=[],upper=[];
  for(const p of unique){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=1e-8)lower.pop();lower.push(p);}
  for(const p of [...unique].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=1e-8)upper.pop();upper.push(p);}lower.pop();upper.pop();const hull=lower.concat(upper);
  const hx=Math.max(...hull.map(p=>Math.abs(p[0]))),hz=Math.max(...hull.map(p=>Math.abs(p[1])));if(Math.max(hx,hz)<Math.max(half.x,half.z)*.02)continue;
  const error=Math.max(...hull.map(p=>Math.abs(Math.hypot(p[0]/hx,p[1]/hz)-1)));maxEllipseError=Math.max(maxEllipseError,error);
  layerProfiles.push({y:level/1e5,outerX:hx,outerZ:hz,hullSamples:hull.length,ellipseError:error});
  if(hull.length<16||error>.035){report.reason='source layer is not a circular/elliptical rim';report.layerProfiles=layerProfiles;return{geometry:source,report};}
 }
 report.layerProfiles=layerProfiles;report.maxEllipseError=maxEllipseError;
 const positions=[],uvs=[],angles=new Set();let maxUvInterpolationError=0,degenerate=0;
 const lerp=(a,b,t)=>{const out=a.map((v,i)=>v+(b[i]-v)*t);return out;};
 const clip=(poly,bound,above)=>{const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=above?a[0]>=bound-1e-10:a[0]<=bound+1e-10,ib=above?b[0]>=bound-1e-10:b[0]<=bound+1e-10;if(ia)result.push(a);if(ia!==ib){const v=lerp(a,b,(bound-a[0])/(b[0]-a[0]));v[0]=bound;result.push(v);}}return result;};
 const point=v=>[center.x+half.x*v[2]*Math.sin(v[0]),v[1],center.z+half.z*v[2]*Math.cos(v[0])];
 for(let at=0;at<indices.length;at+=3){
  const raw=[0,1,2].map(k=>{const i=indices[at+k],x=(pos.getX(i)-center.x)/half.x,z=(pos.getZ(i)-center.z)/half.z;return[Math.atan2(x,z),pos.getY(i),Math.hypot(x,z),uv.getX(i),uv.getY(i),k===0?1:0,k===1?1:0,k===2?1:0];});
  const nonaxis=raw.filter(v=>v[2]>1e-5);if(nonaxis.length===0)continue;const anchor=nonaxis[0][0];
  for(const v of nonaxis){while(v[0]-anchor>Math.PI)v[0]-=Math.PI*2;while(v[0]-anchor<-Math.PI)v[0]+=Math.PI*2;}
  const mean=nonaxis.reduce((n,v)=>n+v[0],0)/nonaxis.length;for(const v of raw){if(v[2]<=1e-5)v[0]=mean;v[0]=Math.round(v[0]/step)*step;}
  const emit=tri=>{const points=tri.map(point),a=new THREE.Vector3(...points[0]),b=new THREE.Vector3(...points[1]),c=new THREE.Vector3(...points[2]);if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-14){degenerate++;return;}for(const v of tri){positions.push(...point(v));uvs.push(v[3],v[4]);if(v[2]>.01)angles.add(((Math.round(v[0]/step)%segments)+segments)%segments);const u=raw.reduce((n,p,k)=>n+p[3]*v[5+k],0),w=raw.reduce((n,p,k)=>n+p[4]*v[5+k],0);maxUvInterpolationError=Math.max(maxUvInterpolationError,Math.abs(u-v[3]),Math.abs(w-v[4]));}};
  // An axis vertex has no angle. Preserve the actual source fan instead of
  // interpolating a fictitious center angle, which would separate cap edges.
  if(nonaxis.length===2){const axis=raw.findIndex(v=>v[2]<=1e-5),centerVertex=raw[axis],a=raw[(axis+1)%3],b=raw[(axis+2)%3],from=Math.round(Math.min(a[0],b[0])/step),to=Math.round(Math.max(a[0],b[0])/step);for(let slice=from;slice<to;slice++){const low=lerp(a,b,(slice*step-a[0])/(b[0]-a[0])),high=lerp(a,b,((slice+1)*step-a[0])/(b[0]-a[0]));low[0]=slice*step;high[0]=(slice+1)*step;emit(a[0]<b[0]?[centerVertex,low,high]:[centerVertex,high,low]);}continue;}
  const from=Math.round(Math.min(...raw.map(v=>v[0]))/step),to=Math.round(Math.max(...raw.map(v=>v[0]))/step);
  for(let slice=from;slice<to;slice++){
   const poly=clip(clip(raw,slice*step,true),(slice+1)*step,false);if(poly.length<3)continue;
   for(let i=1;i<poly.length-1;i++){
    emit([poly[0],poly[i],poly[i+1]]);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(Array.from({length:positions.length/3},(_,i)=>i));geometry.computeBoundingBox();
 // Fit the actual vertices back to the original box, not a fabricated bound.
 const derivedBox=geometry.boundingBox,derivedSize=derivedBox.getSize(new THREE.Vector3()),originalSize=box.getSize(new THREE.Vector3()),derivedCenter=derivedBox.getCenter(new THREE.Vector3());geometry.translate(-derivedCenter.x,-derivedCenter.y,-derivedCenter.z);geometry.scale(originalSize.x/derivedSize.x,originalSize.y/derivedSize.y,originalSize.z/derivedSize.z);geometry.translate(center.x,center.y,center.z);geometry.computeBoundingBox();
 const boundError=Math.max(...['x','y','z'].flatMap(axis=>[Math.abs(geometry.boundingBox.min[axis]-box.min[axis]),Math.abs(geometry.boundingBox.max[axis]-box.max[axis])]));
 report.newBox={min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()};report.boundError=boundError;report.newHeight=geometry.boundingBox.max.y-geometry.boundingBox.min.y;report.newTriangles=geometry.index.count/3;report.angularSamples=angles.size;report.maxUvInterpolationError=maxUvInterpolationError;report.removedDegenerateTriangles=degenerate;
 if(boundError>2e-6||angles.size!==segments||maxUvInterpolationError>1e-6){geometry.dispose();report.reason='source bounds, circular samples or UV transport did not pass';return{geometry:source,report};}
 geometry.computeVertexNormals();smoothShellNormals(geometry);if(kind==='stick')sourceProfileNormals(source,geometry);report.derived=true;return{geometry,report};
}
// Analytic meridian normals: triangle clipping must not become visible as
// radial lighting spokes. Geometry positions, indices and atlas UVs are kept.
function sourceProfileNormals(source,geometry){
 source.computeBoundingBox();const box=source.boundingBox,c=box.getCenter(new THREE.Vector3()),h=box.getSize(new THREE.Vector3()).multiplyScalar(.5),p=source.attributes.position,n=source.attributes.normal,ix=source.index.array,edges=new Map();
 const polar=i=>{const x=(p.getX(i)-c.x)/h.x,z=(p.getZ(i)-c.z)/h.z;return{y:p.getY(i),r:Math.hypot(x,z),a:Math.atan2(x,z),i};};
 for(let at=0;at<ix.length;at+=3)for(let k=0;k<3;k++){
  const a=polar(ix[at+k]),b=polar(ix[at+(k+1)%3]),da=Math.abs(Math.atan2(Math.sin(a.a-b.a),Math.cos(a.a-b.a)));if(a.r>1e-5&&b.r>1e-5&&da>.002)continue;
  a.y=Math.round(a.y*1e4)/1e4;a.r=Math.round(a.r*1e4)/1e4;b.y=Math.round(b.y*1e4)/1e4;b.r=Math.round(b.r*1e4)/1e4;const dy=b.y-a.y,dr=b.r-a.r;if(Math.hypot(dy,dr)<1e-5)continue;const key=[a.y+':'+a.r,b.y+':'+b.r].sort().join(',');
  const theta=a.r>1e-5?a.a:b.a,normal=new THREE.Vector3(dy*Math.sin(theta)/h.x,-dr,dy*Math.cos(theta)/h.z).normalize(),original=new THREE.Vector3(n.getX(a.i)+n.getX(b.i),n.getY(a.i)+n.getY(b.i),n.getZ(a.i)+n.getZ(b.i));const sign=normal.dot(original)<0?-1:1;
  edges.set(key,{a,b,dy,dr,sign});
 }
 if(!edges.size)throw Error('Source stick meridian unavailable');
 const gp=geometry.attributes.position,gn=geometry.attributes.normal;
 for(let i=0;i<gp.count;i++){
  const x=(gp.getX(i)-c.x)/h.x,z=(gp.getZ(i)-c.z)/h.z,y=Math.round(gp.getY(i)*1e4)/1e4,r=Math.round(Math.hypot(x,z)*1e4)/1e4,theta=Math.atan2(x,z),near=[];let minimum=Infinity;
  for(const e of edges.values()){const length=e.dy*e.dy+e.dr*e.dr,t=Math.max(0,Math.min(1,((y-e.a.y)*e.dy+(r-e.a.r)*e.dr)/length)),distance=Math.hypot(y-e.a.y-e.dy*t,r-e.a.r-e.dr*t);if(distance<minimum)minimum=distance;near.push({e,distance});}
  const sum=new THREE.Vector3();for(const {e,distance}of near)if(distance<=minimum+1e-4)sum.add(new THREE.Vector3(e.dy*Math.sin(theta)/h.x,-e.dr,e.dy*Math.cos(theta)/h.z).normalize().multiplyScalar(e.sign));
  if(r<1e-5){sum.x=0;sum.z=0;}
  if(sum.lengthSq()<1e-12)throw Error('Source stick profile normal is ambiguous');sum.normalize();gn.setXYZ(i,sum.x,sum.y,sum.z);
 }
 gn.needsUpdate=true;
}
function limitedHermite(points){
 const slopes=points.slice(1).map((p,i)=>(p[1]-points[i][1])/(p[0]-points[i][0])),d=points.map((p,i)=>{if(!i)return slopes[0];if(i===points.length-1)return slopes.at(-1);const a=slopes[i-1],b=slopes[i];if(a*b<=0)return 0;const h0=p[0]-points[i-1][0],h1=points[i+1][0]-p[0],w0=2*h1+h0,w1=h1+2*h0;return(w0+w1)/(w0/a+w1/b);});
 return{d,value:(at)=>{let k=0;while(k<points.length-2&&at>points[k+1][0])k++;const h=points[k+1][0]-points[k][0],t=(at-points[k][0])/h,t2=t*t,t3=t2*t;return(2*t3-3*t2+1)*points[k][1]+(t3-2*t2+t)*h*d[k]+(-2*t3+3*t2)*points[k+1][1]+(t3-t2)*h*d[k+1];}};
}
function sourceHull(points){
 const unique=[...new Map(points.map(p=>[p.map(v=>Math.round(v*1e5)).join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),lo=[],hi=[];
 for(const p of unique){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=1e-8)lo.pop();lo.push(p);}for(const p of [...unique].reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=1e-8)hi.pop();hi.push(p);}lo.pop();hi.pop();return lo.concat(hi);
}
// Split all adjacent source faces on the same planes before a local warp;
// this carries UVs inside each original triangle and keeps side walls joined.
function sourcePlaneDeform(source,planes,warp,label,audit=false){
 source.computeBoundingBox();const box=source.boundingBox.clone(),pole=box.getCenter(new THREE.Vector3()),p=source.attributes.position,u=source.attributes.uv,ix=source.index.array,positions=[],uvs=[],origins=audit?[]:null,reversalExamples=[];let moved=0,maxShift=0,reversedFaces=0,minParentNormalCosine=1;
 if(!u)return{geometry:source,report:{label,derived:false,reason:'source UV unavailable'}};
 const clip=(poly,plane,side)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[0]*plane[0]+a[2]*plane[1]-plane[2])*side,db=(b[0]*plane[0]+b[2]*plane[1]-plane[2])*side,ia=da>=-1e-10,ib=db>=-1e-10;if(ia)out.push(a);if(ia!==ib){const t=Math.max(0,Math.min(1,da/(da-db)));out.push(t===0?a.slice():t===1?b.slice():a.map((v,k)=>v+(b[k]-v)*t));}}return out;};
 for(let at=0;at<ix.length;at+=3){
  let polygons=[[0,1,2].map(k=>{const i=ix[at+k];return[p.getX(i),p.getY(i),p.getZ(i),u.getX(i),u.getY(i)];})];const parent=polygons[0],parentA=new THREE.Vector3(...parent[0].slice(0,3)),parentB=new THREE.Vector3(...parent[1].slice(0,3)),parentC=new THREE.Vector3(...parent[2].slice(0,3)),parentNormal=parentB.sub(parentA).cross(parentC.sub(parentA));
  for(const plane of planes){const next=[];for(const poly of polygons){const ds=poly.map(v=>v[0]*plane[0]+v[2]*plane[1]-plane[2]);if(Math.min(...ds)<-1e-10&&Math.max(...ds)>1e-10){for(const side of[-1,1]){const part=clip(poly,plane,side);if(part.length>=3)next.push(part);}}else next.push(poly);}polygons=next;}
  for(const poly of polygons)for(let k=1;k<poly.length-1;k++){const tri=[poly[0],poly[k],poly[k+1]].map(v=>{if(Math.abs(v[0]-pole.x)<1e-9&&Math.abs(v[2]-pole.z)<1e-9){v=v.slice();v[0]=pole.x;v[2]=pole.z;}return v;}),mapped=tri.map(v=>warp(v.slice(0,3))),a=new THREE.Vector3(...mapped[0]),b=new THREE.Vector3(...mapped[1]),c=new THREE.Vector3(...mapped[2]),cross=b.sub(a).cross(c.sub(a));if(cross.lengthSq()<1e-24)continue;const fa=new THREE.Vector3(...mapped[0].map(Math.fround)),fb=new THREE.Vector3(...mapped[1].map(Math.fround)),fc=new THREE.Vector3(...mapped[2].map(Math.fround)),actualNormal=fb.sub(fa).cross(fc.sub(fa));if(actualNormal.lengthSq()>1e-18&&parentNormal.lengthSq()>1e-18){const cosine=actualNormal.dot(parentNormal)/Math.sqrt(actualNormal.lengthSq()*parentNormal.lengthSq());minParentNormalCosine=Math.min(minParentNormalCosine,cosine);if(cosine<0){reversedFaces++;if(reversalExamples.length<3)reversalExamples.push({parentTriangle:at/3,parent:parent.map(v=>v.slice(0,3)),origin:tri.map(v=>v.slice(0,3)),mapped,sourceArea:parentNormal.length()/2,mappedArea:actualNormal.length()/2,cosine});}}for(let j=0;j<3;j++){const shift=Math.hypot(...mapped[j].map((v,k)=>v-tri[j][k]));if(shift>1e-7)moved++;maxShift=Math.max(maxShift,shift);positions.push(...mapped[j]);uvs.push(tri[j][3],tri[j][4]);if(origins)origins.push(...tri[j].slice(0,3));}}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(Array.from({length:positions.length/3},(_,i)=>i));g.computeBoundingBox();
 const boundError=Math.max(...['x','y','z'].flatMap(k=>[Math.abs(box.min[k]-g.boundingBox.min[k]),Math.abs(box.max[k]-g.boundingBox.max[k])])),report={label,derived:false,sourceTriangles:ix.length/3,newTriangles:g.index.count/3,sourceBox:{min:box.min.toArray(),max:box.max.toArray()},newBox:{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()},boundError,movedVertices:moved,maxShift,planes:planes.length,reversedFaces,minParentNormalCosine,reversalExamples};
 if(boundError>0||!moved||reversedFaces){g.dispose();report.reason=boundError?'actual source bounds changed':reversedFaces?'source parent face orientation reversed':'local source outline did not move';return{geometry:source,report};}g.computeVertexNormals();smoothShellNormals(g);report.derived=true;return{geometry:g,report,origins:origins?new THREE.Float32BufferAttribute(origins,3):null};
}
function refineShellCorners(source,onlyCorner=null,audit=false){
 source.computeBoundingBox();const box=source.boundingBox,c=box.getCenter(new THREE.Vector3()),p=source.attributes.position,side=c.x<0?-1:1,front=[];for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-box.min.y)<2e-5)front.push([side*(p.getX(i)-c.x),p.getZ(i)-c.z]);const hull=sourceHull(front),curves=[];
 for(const upper of[true,false]){
  const nodes=hull.filter(v=>v[0]>=-1e-5&&(upper?v[1]>0:v[1]<0)).sort((a,b)=>Math.atan2(a[0],a[1])-Math.atan2(b[0],b[1]));if(nodes.length<3)return{geometry:source,report:{derived:false,reason:'source shell corner chain unavailable'}};
  // Drop the continuation along the long straight outer side: each chain
  // stops at its first true corner/straight junction, not the side midpoint.
  const xmax=Math.max(...nodes.map(v=>v[0]));if(upper){while(nodes.length>2&&Math.abs(nodes.at(-2)[0]-xmax)<1e-5)nodes.pop();}else{while(nodes.length>2&&Math.abs(nodes[1][0]-xmax)<1e-5)nodes.shift();}
  const path=[0];for(let i=1;i<nodes.length;i++)path.push(path.at(-1)+Math.hypot(nodes[i][0]-nodes[i-1][0],nodes[i][1]-nodes[i-1][1]));const fx=limitedHermite(nodes.map((v,i)=>[path[i],v[0]])),fz=limitedHermite(nodes.map((v,i)=>[path[i],v[1]]));if(upper){fz.d[0]=0;fx.d[fx.d.length-1]=0;}else{fx.d[0]=0;fz.d[fz.d.length-1]=0;}
  const dense=[];for(let k=0;k<nodes.length-1;k++)for(let j=0;j<16;j++){const s=path[k]+(path[k+1]-path[k])*j/16,x=fx.value(s),z=fz.value(s);dense.push({a:Math.atan2(x,z),r:Math.hypot(x,z)});}const last=nodes.at(-1);dense.push({a:Math.atan2(last[0],last[1]),r:Math.hypot(...last)});
  if(dense.some((v,i)=>i&&v.a<=dense[i-1].a))return{geometry:source,report:{derived:false,reason:'source shell corner is not monotone in angle'}};curves.push({nodes,dense,upper});
 }
 const selected=onlyCorner===null?curves:curves.filter(v=>v.upper===onlyCorner),planes=selected.flatMap(v=>v.dense.slice(1,-1).map(q=>[side*Math.cos(q.a),-Math.sin(q.a),side*c.x*Math.cos(q.a)-c.z*Math.sin(q.a)]));
 const radial=(points,a)=>{for(let i=0;i<points.length-1;i++){const q=points[i],v=points[i+1],dx=v[0]-q[0],dz=v[1]-q[1],den=dx*Math.cos(a)-dz*Math.sin(a),t=(q[1]*Math.sin(a)-q[0]*Math.cos(a))/den;if(t>=-1e-8&&t<=1+1e-8)return Math.hypot(q[0]+dx*t,q[1]+dz*t);}return null;};
 const smooth=t=>t*t*(3-2*t),warp=v=>{const x=side*(v[0]-c.x),z=v[2]-c.z,a=Math.atan2(x,z),r=Math.hypot(x,z);if(x<0||v[1]>=2.28849)return v;const curve=selected.find(q=>a>=q.dense[0].a&&a<=q.dense.at(-1).a);if(!curve)return v;const old=radial(curve.nodes,a);if(old===null||r>old+2e-5||r<old-1.2)return v;let k=0;while(k<curve.dense.length-2&&a>curve.dense[k+1].a)k++;const q=curve.dense[k],n=curve.dense[k+1],target=q.r+(n.r-q.r)*(a-q.a)/(n.a-q.a),w=smooth(Math.max(0,Math.min(1,(r-old+1.2)/1.2)))*smooth(Math.max(0,Math.min(1,(2.2885-v[1])/(2.2885+1.26161)))),shift=(target-old)*w;return[v[0]+side*Math.sin(a)*shift,v[1],v[2]+Math.cos(a)*shift];};
 const result=sourcePlaneDeform(source,planes,warp,'source-shell-corners',audit);result.report.corners=selected.length;result.report.outlineNodes=selected.map(q=>q.nodes);result.report.curveSamples=selected.map(q=>q.dense.length);return result;
}
function refineStickBase(source,audit=false){
 source.computeBoundingBox();const box=source.boundingBox,c=box.getCenter(new THREE.Vector3()),p=source.attributes.position,layers=new Map();for(let i=0;i<p.count;i++){const key=Math.round(p.getY(i)*1e5);if(!layers.has(key))layers.set(key,[]);layers.get(key).push([p.getX(i)-c.x,p.getZ(i)-c.z]);}
 const profiles=[...layers].sort((a,b)=>a[0]-b[0]).map(([y,points])=>{
  const hull=sourceHull(points),polar=hull.map(v=>({a:Math.atan2(v[0],v[1]),r:Math.hypot(...v),point:v})).sort((a,b)=>a.a-b.a),nodes=[polar.at(-1).point,...polar.map(v=>v.point),polar[0].point,polar[1].point],path=[0];for(let i=1;i<nodes.length;i++)path.push(path.at(-1)+Math.hypot(nodes[i][0]-nodes[i-1][0],nodes[i][1]-nodes[i-1][1]));
  const fx=limitedHermite(nodes.map((v,i)=>[path[i],v[0]])),fz=limitedHermite(nodes.map((v,i)=>[path[i],v[1]])),dense=[];
  for(let k=1;k<nodes.length-2;k++)for(let j=0;j<12;j++){const s=path[k]+(path[k+1]-path[k])*j/12,x=fx.value(s),z=fz.value(s);let a=Math.atan2(x,z);if(dense.length)while(a<dense.at(-1).a-1e-8)a+=Math.PI*2;dense.push({a,r:Math.hypot(x,z),point:[x,z]});}dense.push({a:polar[0].a+Math.PI*2,r:polar[0].r,point:polar[0].point});
  return{y:y/1e5,hull,polar,dense};
 });
 if(profiles.length!==4||profiles.some(q=>q.hull.length!==8))return{geometry:source,report:{derived:false,reason:'source irregular base does not retain four eight-point profiles'}};
 const planes=Array.from({length:48},(_,i)=>{const a=i*Math.PI/48;return[Math.cos(a),-Math.sin(a),c.x*Math.cos(a)-c.z*Math.sin(a)];});
 const ray=(profile,a)=>{for(let i=0;i<profile.hull.length;i++){const q=profile.hull[i],n=profile.hull[(i+1)%profile.hull.length],dx=n[0]-q[0],dz=n[1]-q[1],den=dx*Math.cos(a)-dz*Math.sin(a),t=(q[1]*Math.sin(a)-q[0]*Math.cos(a))/den,x=q[0]+dx*t,z=q[1]+dz*t;if(t>=-1e-8&&t<=1+1e-8&&x*Math.sin(a)+z*Math.cos(a)>0)return Math.hypot(x,z);}return null;};
 const radius=(q,a)=>{while(a<q.dense[0].a)a+=Math.PI*2;let k=0;while(k<q.dense.length-2&&a>q.dense[k+1].a)k++;const p=q.dense[k].point,n=q.dense[k+1].point,dx=n[0]-p[0],dz=n[1]-p[1],t=(p[1]*Math.sin(a)-p[0]*Math.cos(a))/(dx*Math.cos(a)-dz*Math.sin(a));return Math.hypot(p[0]+dx*t,p[1]+dz*t);};
 const warp=v=>{const x=v[0]-c.x,z=v[2]-c.z,a=Math.atan2(x,z),r=Math.hypot(x,z);if(r<1e-7)return v;let k=0;while(k<profiles.length-2&&v[1]>profiles[k+1].y)k++;const q=profiles[k],n=profiles[k+1],t=Math.max(0,Math.min(1,(v[1]-q.y)/(n.y-q.y))),rq=ray(q,a),rn=ray(n,a);if(rq===null||rn===null)return v;const old=rq+(rn-rq)*t;if(r<old*.82||r>old+2e-5)return v;const target=radius(q,a)+(radius(n,a)-radius(q,a))*t,w=Math.max(0,Math.min(1,(r/old-.82)/.18)),shift=(target-old)*w*w*(3-2*w);return[v[0]+Math.sin(a)*shift,v[1],v[2]+Math.cos(a)*shift];};
 const result=sourcePlaneDeform(source,planes,warp,'source-irregular-stick-base',audit);result.report.profiles=profiles.map(q=>({y:q.y,hull:q.hull}));return result;
}
function alignSourceSocket(source,stick){
 source.computeBoundingBox();const p=source.attributes.position,uv=source.attributes.uv,ix=source.index.array,box=source.boundingBox,cx=box.getCenter(new THREE.Vector3()).x,y=box.min.y,sp=stick.mesh.geometry.attributes.position,si=stick.mesh.geometry.index.array,localY=y-stick.mesh.position.y;
 const report={derived:false,sourceTriangles:ix.length/3,sourceY:y,sourceStickCenter:stick.mesh.position.toArray()},key=v=>v.map(q=>Math.round(q*1e5)).join(','),point=i=>[p.getX(i),p.getY(i),p.getZ(i)];
 const section=[];for(let at=0;at<si.length;at+=3){for(let k=0;k<3;k++){const a=si[at+k],b=si[at+(k+1)%3],ya=sp.getY(a),yb=sp.getY(b);if((ya-localY)*(yb-localY)>0||Math.abs(yb-ya)<1e-12)continue;const t=(localY-ya)/(yb-ya);if(t<0||t>1)continue;section.push([sp.getX(a)+(sp.getX(b)-sp.getX(a))*t,sp.getZ(a)+(sp.getZ(b)-sp.getZ(a))*t]);}}
 if(!section.length)return{geometry:source,report:{...report,reason:'source shaft section missing'}};
 const rx=Math.max(...section.map(v=>Math.abs(v[0]))),rz=Math.max(...section.map(v=>Math.abs(v[1]))),front=[];
 for(let at=0;at<ix.length;at+=3)if([0,1,2].every(k=>Math.abs(p.getY(ix[at+k])-y)<1e-5))front.push(at/3);
 const boundaries=triangles=>{const edges=new Map();for(const t of triangles)for(let k=0;k<3;k++){const a=ix[t*3+k],b=ix[t*3+(k+1)%3],ka=key(point(a)),kb=key(point(b)),e=ka<kb?ka+'|'+kb:kb+'|'+ka;if(!edges.has(e))edges.set(e,{count:0,a,b,ka,kb});edges.get(e).count++;}const graph=new Map(),representative=new Map();for(const e of edges.values())if(e.count===1)for(const [a,b]of[[e.a,e.b],[e.b,e.a]]){const ka=key(point(a)),kb=key(point(b));representative.set(ka,a);if(!graph.has(ka))graph.set(ka,[]);graph.get(ka).push(kb);}if([...graph.values()].some(n=>n.length!==2))return null;const used=new Set(),loops=[];for(const start of graph.keys()){if(used.has(start))continue;let at=start,last=null;const loop=[];while(!used.has(at)){used.add(at);loop.push(representative.get(at));const next=graph.get(at).find(k=>k!==last);last=at;at=next;}if(at!==start)return null;loops.push(loop);}return loops;};
 const allLoops=boundaries(front),oldHole=allLoops?.find(loop=>loop.length===8);if(!oldHole||allLoops.length!==2)return{geometry:source,report:{...report,reason:'actual coplanar front loops changed'}};
 const holePoints=oldHole.map(point),min=[0,2].map(c=>Math.min(...holePoints.map(v=>v[c]))),max=[0,2].map(c=>Math.max(...holePoints.map(v=>v[c]))),oldCenter=[(min[0]+max[0])/2,(min[1]+max[1])/2],half=[(max[0]-min[0])/2,(max[1]-min[1])/2],angles=holePoints.map(v=>Math.atan2((v[0]-oldCenter[0])/half[0],(v[2]-oldCenter[1])/half[1]));
 const orderedAngles=angles.map(a=>(a+Math.PI*2)%(Math.PI*2)).sort((a,b)=>a-b),maxAngleGap=Math.max(...orderedAngles.map((a,i)=>(orderedAngles[(i+1)%8]+(i===7?Math.PI*2:0))-a)),circumscribe=1/Math.cos(maxAngleGap/2),clearance=.03,targetCenter=[cx+(stick.mesh.position.x-cx)/1.65,stick.mesh.position.z],targetHole=angles.map(a=>[targetCenter[0]+Math.sin(a)*(rx+clearance)*circumscribe/1.65,y,targetCenter[1]+Math.cos(a)*(rz+clearance)*circumscribe]);
 const newMin=[0,2].map(c=>Math.min(...targetHole.map(v=>v[c]))),newMax=[0,2].map(c=>Math.max(...targetHole.map(v=>v[c]))),region={min:[Math.min(min[0],newMin[0])-.5,Math.min(min[1],newMin[1])-.5],max:[Math.max(max[0],newMax[0])+.5,Math.max(max[1],newMax[1])+.5]};
 const selected=front.filter(t=>{const vertices=[0,1,2].map(k=>point(ix[t*3+k]));return [0,2].every((c,j)=>Math.max(...vertices.map(v=>v[c]))>=region.min[j]&&Math.min(...vertices.map(v=>v[c]))<=region.max[j]);}),loops=boundaries(selected);
 if(!loops||loops.length!==2)return{geometry:source,report:{...report,reason:'local source patch boundary is not a two-loop manifold',selectedTriangles:selected.length,loopLengths:loops?.map(l=>l.length)}};
 const oldKeys=new Set(oldHole.map(i=>key(point(i)))),hole=loops.find(l=>l.length===8&&l.every(i=>oldKeys.has(key(point(i))))),outer=loops.find(l=>l!==hole);if(!hole)return{geometry:source,report:{...report,reason:'local patch lost the actual source opening'}};
 const changes=new Map(oldHole.map((i,k)=>[key(point(i)),targetHole[k]])),selectedSet=new Set(selected);
 for(let t=0;t<ix.length/3;t++)if(!selectedSet.has(t)&&[0,1,2].some(k=>changes.has(key(point(ix[t*3+k])))))return{geometry:source,report:{...report,reason:'socket boundary has an untouched adjacent wall'}};
 const polygon=outer.map(i=>new THREE.Vector2(p.getX(i),p.getZ(i))),holePolygon=hole.map(i=>{const v=changes.get(key(point(i)));return new THREE.Vector2(v[0],v[2]);}),faces=THREE.ShapeUtils.triangulateShape(polygon,[holePolygon]),boundaryIds=[...outer,...hole],expectedArea=Math.abs(THREE.ShapeUtils.area(polygon))-Math.abs(THREE.ShapeUtils.area(holePolygon));
 const geometry=source.clone(),gp=geometry.attributes.position;for(let i=0;i<gp.count;i++){const v=changes.get(key(point(i)));if(v)gp.setXYZ(i,...v);}const newIndex=[];for(let t=0;t<ix.length/3;t++)if(!selectedSet.has(t))newIndex.push(ix[t*3],ix[t*3+1],ix[t*3+2]);let area=0;for(const f of faces){const ids=f.map(i=>boundaryIds[i]),a=new THREE.Vector3().fromBufferAttribute(gp,ids[0]),b=new THREE.Vector3().fromBufferAttribute(gp,ids[1]),c=new THREE.Vector3().fromBufferAttribute(gp,ids[2]),normal=b.sub(a).cross(c.sub(a));if(normal.y>=-1e-10){geometry.dispose();return{geometry:source,report:{...report,reason:'Earcut face is not positive in the source front orientation'}};}area+=-normal.y/2;newIndex.push(...ids);}
 const areaError=Math.abs(area-expectedArea);if(areaError>2e-4||faces.length>selected.length){geometry.dispose();return{geometry:source,report:{...report,reason:'Earcut patch area or triangle budget failed',areaError}};}
 geometry.setIndex(newIndex);geometry.computeBoundingBox();const boundError=Math.max(...geometry.boundingBox.min.toArray().map((v,i)=>Math.abs(v-box.min.getComponent(i))),...geometry.boundingBox.max.toArray().map((v,i)=>Math.abs(v-box.max.getComponent(i))));if(boundError>0){geometry.dispose();return{geometry:source,report:{...report,reason:'actual exterior bounds changed',boundError}};}
 return{geometry,report:{...report,derived:true,selectedSourceTriangles:selected,newTriangles:faces.length,sourcePatchLoops:loops.map(l=>l.map(point)),targetHole,sourceSection:{localY,rx,rz,clearance,circumscribe,maxAngleGap},targetCenter,sourceUvBoundary:boundaryIds.map(i=>[uv.getX(i),uv.getY(i)]),areaError,boundError,drawTriangles:newIndex.length/3}};
}

function moldedMaterial(color,roughness=.34){return new THREE.MeshPhysicalMaterial({color,roughness,metalness:0,clearcoat:.24,clearcoatRoughness:.29,envMapIntensity:.95});}
const cadParts=new Map();
function indexedCrease(geometry){const derived=toCreasedNormals(geometry,Math.PI/3);if(derived!==geometry)geometry.dispose();if(!derived.index)derived.setIndex(Array.from({length:derived.attributes.position.count},(_,i)=>i));return derived;}
function cadRaw(name){const part=cadParts.get(name);if(!part)throw Error('CAD visual part missing: '+name);const geometry=part.geometry.clone();geometry.applyMatrix4(part.matrixWorld);return geometry;}
function cadFitted(name,target,rotation=Math.PI/2){
 const sourceParts=Array.isArray(name)?name.map(cadRaw):null,geometry=sourceParts?mergeGeometries(sourceParts):cadRaw(name);sourceParts?.forEach(part=>part.dispose());geometry.computeBoundingBox();const box=geometry.boundingBox.clone(),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());target.computeBoundingBox();const bounds=target.boundingBox,tc=bounds.getCenter(new THREE.Vector3()),ts=bounds.getSize(new THREE.Vector3());
 geometry.translate(-center.x,-center.y,-center.z);geometry.rotateX(rotation);geometry.scale(ts.x/size.x,ts.y/size.z,ts.z/size.y);geometry.translate(tc.x,tc.y,tc.z);const fitted=indexedCrease(geometry);fitted.computeBoundingBox();return fitted;
}
function cadShell(name,target){
 target.computeBoundingBox();const box=target.boundingBox.clone(),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());size.x=25.2;center.x=center.x<0?-44.6:44.6;
 const source=cadRaw(name),p=source.attributes.position;source.computeBoundingBox();const sb=source.boundingBox,sc=sb.getCenter(new THREE.Vector3()),ss=sb.getSize(new THREE.Vector3()),hull=sourceHull(Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i)])),bevel=.58;
 const outline=new THREE.Shape(),points=hull.map(v=>[(v[0]-sc.x)/ss.x*(size.x-2*bevel),(v[1]-sc.y)/ss.y*(size.z-2*bevel)]);points.forEach((v,i)=>i?outline.lineTo(v[0],v[1]):outline.moveTo(v[0],v[1]));outline.closePath();
 const geometry=new THREE.ExtrudeGeometry(outline,{depth:size.y-2*bevel,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:8,curveSegments:32});geometry.rotateX(Math.PI/2);geometry.translate(center.x,box.max.y-bevel,center.z);source.dispose();const fitted=indexedCrease(geometry);fitted.computeBoundingBox();(modelStats.cadShellDerivation??=[]).push({name,sourceOutlinePoints:hull.length,source:'actual published CAD exterior XY hull',filled:'rear port and screw cuts omitted for this plain front shell',bevelSegments:8,triangles:fitted.index.count/3});return fitted;
}
function glassFrameGeometry(screenW=60,screenH=33.75){const shape=new THREE.Shape(),w=screenW+4.7,h=screenH+3.95,r=1.4,x=-w/2,z=-h/2;shape.moveTo(x+r,z);shape.lineTo(x+w-r,z);shape.quadraticCurveTo(x+w,z,x+w,z+r);shape.lineTo(x+w,z+h-r);shape.quadraticCurveTo(x+w,z+h,x+w-r,z+h);shape.lineTo(x+r,z+h);shape.quadraticCurveTo(x,z+h,x,z+h-r);shape.lineTo(x,z+r);shape.quadraticCurveTo(x,z,x+r,z);const hole=new THREE.Path();hole.moveTo(-screenW/2,-screenH/2);hole.lineTo(-screenW/2,screenH/2);hole.lineTo(screenW/2,screenH/2);hole.lineTo(screenW/2,-screenH/2);hole.closePath();shape.holes.push(hole);const geometry=new THREE.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:true,bevelSize:.09,bevelThickness:.08,bevelSegments:4,curveSegments:16});geometry.rotateX(Math.PI/2);geometry.translate(0,.36,0);return indexedCrease(geometry);}
function adaptModel(root){
 const sourceMeshes=[];root.traverse(o=>{if(o.isMesh)sourceMeshes.push(o);});
 const composite=sourceMeshes.find(o=>o.material.name==='Bumper_and_Buttons');if(!composite)throw Error('Actual composite button mesh missing');
 const islands=splitGeometry(composite.geometry);modelStats.buttonGeometryIslands=islands.length;if(islands.length!==22)throw Error('Source topology changed; button split must be reviewed');
 const targets=[[-41.46,22.21],[-44.62,19.15],[-38.20,19.15],[-41.46,16.14],[41.20,33.63],[38.05,30.57],[44.46,30.57],[41.20,27.56]];
 const used=new Set();buttons=[];const targetSlots=new Map();for(let slot=0;slot<8;slot++){
  let best=-1,distance=Infinity;islands.forEach((island,i)=>{const d=Math.hypot(island.center.x-targets[slot][0],island.center.z-targets[slot][1]);if(!used.has(i)&&d<distance){best=i;distance=d;}});
  if(distance>.2)throw Error('Button island not found for '+KEYS[slot].symbol);used.add(best);targetSlots.set(best,slot);
 }
 const group=new THREE.Group();group.name='ActualSourceParts';group.position.copy(composite.position);group.quaternion.copy(composite.quaternion);group.scale.copy(composite.scale);composite.parent.add(group);composite.visible=false;
 islands.forEach((island,index)=>{
  const slot=targetSlots.get(index),mat=composite.material.clone(),g=island.geometry;g.translate(-island.center.x,-island.center.y,-island.center.z);
  const kind=slot!==undefined?'button':island.triangles===640?'stick':null,contour=null,baseContour=null;
  if(contour){const stats=modelStats.contourAdaptation??={segments:96,derivedParts:0,sourceTriangles:0,drawTriangles:0,maxBoundError:0,maxUvInterpolationError:0,retained:[]};stats.sourceTriangles+=island.triangles;stats.drawTriangles+=contour.report.derived?contour.report.newTriangles:island.triangles;if(contour.report.derived){stats.derivedParts++;stats.maxBoundError=Math.max(stats.maxBoundError,contour.report.boundError);stats.maxUvInterpolationError=Math.max(stats.maxUvInterpolationError,contour.report.maxUvInterpolationError);g.dispose();}else stats.retained.push({island:index,kind,reason:contour.report.reason});}
  if(baseContour){const stats=modelStats.surfaceRefinement??={parts:[],stickProfileNormals:2};stats.parts.push({part:'SourceIsland_'+index,derived:baseContour.report.derived,sourceTriangles:island.triangles,drawTriangles:baseContour.report.derived?baseContour.report.newTriangles:island.triangles,boundError:baseContour.report.boundError??null,reason:baseContour.report.reason??null});if(baseContour.report.derived)g.dispose();}
  if(kind==='button'){g.computeBoundingBox();const size=g.boundingBox.getSize(new THREE.Vector3());g.scale(3.3/size.x,1,3.3/size.z);}
  const cadGeometry=kind==='button'?cadFitted('JoyLFaceButton0',g):kind==='stick'?cadFitted(['JoyLStickCollar','JoyLStickBoot','JoyLStickStem','JoyLStickCap'],g):island.triangles===72?cadFitted('JoyLStickCollar',g):null;
  if(cadGeometry){g.dispose();mat.map=null;mat.color.set('#202630');mat.roughness=kind==='stick'?.52:.36;mat.metalness=0;mat.envMapIntensity=.55;mat.needsUpdate=true;}
  const actualGeometry=cadGeometry??g;const mesh=new THREE.Mesh(actualGeometry,mat);mesh.position.copy(island.center);mesh.name=slot===undefined?'SourceIsland_'+index:'Playable_'+KEYS[slot].symbol;group.add(mesh);parts.push(mesh);
  if(slot===undefined){if(island.triangles===640||island.triangles===72){mesh.userData.stickPart=true;mesh.userData.sourceCenter=island.center.clone();mesh.position.z+=island.center.x<0?3:-3;if(island.triangles===640)sticks.push({side:island.center.x<0?'left':'right',mesh});}return;}
  // Enlarge real key geometry and spread centers; preserve left stick above / right stick below.
  const side=slot<4?-1:1,centerX=side<0?-41.46:41.20,centerZ=side<0?19.15:30.57,spread=6.98,dir=KEYS[slot].direction;
  mesh.position.x=centerX+(dir==='left'?-spread:dir==='right'?spread:0);mesh.position.z=centerZ+(dir==='up'?spread:dir==='down'?-spread:0);mesh.scale.set(2.14,1,2.14);
  mat.map=null;mat.color.set('#292e38');mat.roughness=.31;mat.metalness=0;mat.envMapIntensity=.62;mat.needsUpdate=true;
  const label=new THREE.Mesh(new THREE.PlaneGeometry(1.45,1.45),new THREE.MeshBasicMaterial({map:symbolTexture(slot),transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  label.rotation.x=Math.PI/2;label.position.y=island.box.min.y-island.center.y-.025;mesh.add(label);
  const ring=new THREE.Mesh(new THREE.RingGeometry(1.62,1.70,64),new THREE.MeshBasicMaterial({color:0x74ccf8,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=Math.PI/2;ring.position.y=label.position.y-.012;mesh.add(ring);ring.visible=false;
  buttons[slot]={slot,mesh,label,ring,baseY:mesh.position.y,depth:0,rect:null,hitRect:null};
 });
 for(const o of sourceMeshes)if(/Joycon/.test(o.material.name)){const original=o.geometry,sourceName=o.material.name;o.geometry=cadShell(sourceName.includes('Left')?'JoyLRear':'JoyRRear',original);original.dispose();o.geometry.computeBoundingBox();o.material=moldedMaterial('#f5f5f2',.33);o.material.name=sourceName;}
 const bezel=sourceMeshes.find(o=>o.material.name==='Screen_Bezel');
 const sourceBezelGeometry=bezel.geometry;bezel.geometry=cadFitted('FrontBezel',sourceBezelGeometry);sourceBezelGeometry.dispose();
 bezel.material=moldedMaterial('#f2f3f1',.31);bezel.material.name='Screen_Bezel';
 darkFrame=new THREE.Mesh(glassFrameGeometry(),new THREE.MeshPhysicalMaterial({color:'#070b12',roughness:.26,metalness:0,clearcoat:.36,clearcoatRoughness:.14,envMapIntensity:.45}));darkFrame.position.set(-.08,-2.315,20.4);bezel.parent.add(darkFrame);
 screenMesh=new THREE.Mesh(new THREE.PlaneGeometry(60.0,33.75),new THREE.MeshBasicMaterial({map:screenTexture,toneMapped:false}));screenMesh.name='LiveGameTexture';screenMesh.position.set(-.08,-2.340,20.4);screenMesh.rotation.x=Math.PI/2;bezel.parent.add(screenMesh);
 model=root;sourceObjects=sourceMeshes;baseObjects=[...sourceMeshes,...parts,darkFrame,screenMesh].map(o=>({o,position:o.position.clone(),scale:o.scale.clone(),visible:o.visible}));
 for(const [shape,width,height,radius,centerZ]of[[1,88,114,7,3],[3,94,146,10,-1.5],[4,124,47,3,21]]){
  const outline=new THREE.Shape(),x=-width/2,y=-height/2,w=width,h=height,r=radius;outline.moveTo(x+r,y);outline.lineTo(x+w-r,y);outline.quadraticCurveTo(x+w,y,x+w,y+r);outline.lineTo(x+w,y+h-r);outline.quadraticCurveTo(x+w,y+h,x+w-r,y+h);outline.lineTo(x+r,y+h);outline.quadraticCurveTo(x,y+h,x,y+h-r);outline.lineTo(x,y+r);outline.quadraticCurveTo(x,y,x+r,y);
  const body=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:3.8,bevelEnabled:true,bevelSize:.45,bevelThickness:.35,bevelSegments:3,curveSegments:20}),moldedMaterial('#f2f3f1',.33));body.rotation.x=Math.PI/2;body.position.set(0,2,centerZ);body.name='SourceAdaptedCase_'+shape;body.visible=false;body.userData.shape=shape;bezel.parent.add(body);caseExtras.push(body);
 }
 secondaryScreen=new THREE.Mesh(new THREE.PlaneGeometry(36,21),new THREE.MeshBasicMaterial({map:feedbackTexture,toneMapped:false}));secondaryScreen.rotation.x=Math.PI/2;secondaryScreen.position.set(0,-2.34,9);secondaryScreen.visible=false;secondaryScreen.name='EventFeedbackSecondaryDisplay';bezel.parent.add(secondaryScreen);
 scene.add(model);applyShape(state.shape);
 modelStats.adaptedTriangles=0;model.traverse(o=>{if(o.isMesh&&o!==composite)modelStats.adaptedTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
}
function visibleModelBox(){const box=new THREE.Box3();model.updateMatrixWorld(true);model.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});return box;}
function applyShape(value){
 const shape=Math.max(0,Math.min(4,Math.trunc(value)||0));state.shape=shape;if(appliedShape===shape)return;appliedShape=shape;
 for(const saved of baseObjects){saved.o.position.copy(saved.position);saved.o.scale.copy(saved.scale);saved.o.visible=saved.visible;}
 for(const o of caseExtras)o.visible=o.userData.shape===shape;secondaryScreen.visible=shape===3;secondaryScreen.scale.set(70/36,26/21,1);secondaryScreen.position.z=0;
 const recipe=SHAPES[shape],vertical=shape===1||shape===3;
 if(shape===0){for(const o of sourceObjects)if(/Joycon/.test(o.material.name)){const cx=o.geometry.boundingBox.getCenter(new THREE.Vector3()).x;o.scale.x=1.25;o.position.x=(cx<0?-3.0:3.0)-cx*.25;}for(const o of parts)o.visible=o.name.startsWith('Playable_')||!!o.userData.stickPart;}
 if(shape===1||shape===3||shape===4){for(const o of sourceObjects)o.visible=false;for(const o of parts)o.visible=o.name.startsWith('Playable_')||!!o.userData.stickPart;}
 if(shape===2){for(const o of sourceObjects){if(/Joycon/.test(o.material.name)){const cx=o.geometry.boundingBox.getCenter(new THREE.Vector3()).x;o.scale.x=1.30;o.position.x=(o.material.name.includes('Left')?-4.2:4.2)-cx*.30;o.scale.z=.90;o.position.z=2.04;}else if(o.material.name==='Screen_Bezel'){o.scale.z=.90;o.position.z=2.04;}else o.visible=false;}for(const o of parts)o.visible=o.name.startsWith('Playable_')||!!o.userData.stickPart;}
 const control=shape===0?{leftX:-47.6,rightX:47.6,leftZ:13.4,rightZ:28,leftStick:28.9,rightStick:12.5}:shape===1?{leftX:-23.4,rightX:23.4,leftZ:-30.5,rightZ:-30.5,leftStick:1,rightStick:-40.5}:shape===3?{leftX:-24.9,rightX:24.9,leftZ:-46.5,rightZ:-46.5,leftStick:-14,rightStick:-61}:shape===2?{leftX:-51.0,rightX:51.0,leftZ:17,rightZ:24.4,leftStick:34.2,rightStick:7.4}:shape===4?{leftX:-50.0,rightX:50.0,leftZ:17,rightZ:26,leftStick:34.6,rightStick:9.8}:null;
 if(control){for(const b of buttons){const left=b.slot<4,dir=KEYS[b.slot].direction,cx=left?control.leftX:control.rightX,cz=left?control.leftZ:control.rightZ;b.mesh.position.x=cx+(dir==='left'?-recipe.spread:dir==='right'?recipe.spread:0);b.mesh.position.z=cz+(dir==='up'?recipe.spread:dir==='down'?-recipe.spread:0);b.mesh.scale.set(recipe.buttonScale,1,recipe.buttonScale);}
  for(const o of parts)if(o.userData.stickPart){const c=o.userData.sourceCenter,left=c.x<0;o.position.x=(left?control.leftX:control.rightX)+(c.x-(left?-41.36:41.15));o.position.z=(left?control.leftStick:control.rightStick)+(c.z-(left?30.55:19.15));}
 }
 const screenZ=shape===1?24:shape===3?44:shape===4?23:20.4,screenH=shape===2?32:shape===1?62:shape===3?46:33.75,screenW=shape===1?74:shape===3?78:shape===4?70:68;
 for(const o of parts)if(o.userData.stickPart&&vertical)o.visible=false;
 screenMesh.position.set(-.08,-2.340,screenZ);screenMesh.scale.set(screenW/60,screenH/33.75,1);darkFrame.position.set(-.08,-2.315,screenZ);darkFrame.geometry.dispose();darkFrame.geometry=glassFrameGeometry(screenW,screenH);darkFrame.scale.set(1,1,1);
 const canvasHeight=Math.round(1080*screenH/screenW);if(gameCanvas.height!==canvasHeight){screenTexture.dispose();gameCanvas.height=canvasHeight;screenTexture.needsUpdate=true;lastGamePaintKey='';}
 model.position.set(0,0,0);modelBox=visibleModelBox();model.position.sub(modelBox.getCenter(new THREE.Vector3()));modelBox=visibleModelBox();
 modelStats.visibleTriangles=0;model.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;modelStats.visibleTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
}
let viewportWidth=-1,viewportHeight=-1,viewportShape=-1;
let projectionRevision=0,keyProjectionRevision=0;
const staticProjections=new WeakMap();
const visualStats={localAnimationFrames:0,viewportUpdates:0,keyProjectionPasses:0,bridgedLiveFrames:0,lastLocalFrameGapMs:0};
let localRaf=0,visualAnchorMs=0,visualOffsetMs=0,localVisible=true,lastLocalRafMs=0;
function visualMotionMs(){return state.manual.motionMs+(state.exporting?0:visualOffsetMs);}
function stopLocalAnimation(){if(localRaf)cancelAnimationFrame(localRaf);localRaf=0;}
function localAnimationEligible(){
 if(!ready||disposed||state.exporting||state.mode===1||!state.localVisualAnimation||!localVisible||document.hidden||!(state.mode===0||state.playing))return false;
 const now=visualMotionMs();
 return state.manual.total>0&&now-state.manual.lastAttackMs<500
  ||[...released.values()].some(at=>now-at>=0&&now-at<230)
  ||!state.tapDurationMode&&[...contacts.values()].some(c=>c.rawDuration>0&&now-c.startedAt<c.rawDuration);
}
function localVisualTick(now){
 localRaf=0;if(!localAnimationEligible())return;
 visualOffsetMs=Math.max(0,now-visualAnchorMs);
 if(lastLocalRafMs)visualStats.lastLocalFrameGapMs=now-lastLocalRafMs;lastLocalRafMs=now;
 updateButtons();drawGame(gameState());renderer.render(scene,camera);projectKeys();visualStats.localAnimationFrames++;
 kickLocalAnimation();
}
function kickLocalAnimation(){if(!localRaf&&localAnimationEligible())localRaf=requestAnimationFrame(localVisualTick);}
function setVisible(value){localVisible=!!value;visualAnchorMs=performance.now();visualOffsetMs=0;lastLocalRafMs=0;if(localVisible)kickLocalAnimation();else stopLocalAnimation();}
document.addEventListener('visibilitychange',()=>setVisible(!document.hidden));
function staticProjection(object){
 let cached=staticProjections.get(object);if(!cached||cached.revision!==projectionRevision){
  cached={revision:projectionRevision,rect:projectBox(new THREE.Box3().setFromObject(object))};staticProjections.set(object,cached);
 }return cached.rect;
}

function resize(){
 const w=innerWidth,h=innerHeight,ratio=state.exporting?1:Math.min(2,devicePixelRatio||1);
 if(renderer.getPixelRatio()!==ratio)renderer.setPixelRatio(ratio);
 if(viewportWidth===w&&viewportHeight===h&&viewportShape===state.shape)return false;
 renderer.setSize(w,h,true);viewportWidth=w;viewportHeight=h;viewportShape=state.shape;projectionRevision++;visualStats.viewportUpdates++;
 if(modelBox){const size=modelBox.getSize(new THREE.Vector3()),span=Math.max(size.y*1.12,size.x/(w/h)*1.10);
  camera.top=span/2;camera.bottom=-span/2;camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}
 return true;
}
function projectBox(box){const values=[];for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);values.push({x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2});}return{left:Math.min(...values.map(p=>p.x)),top:Math.min(...values.map(p=>p.y)),right:Math.max(...values.map(p=>p.x)),bottom:Math.max(...values.map(p=>p.y))};}
function projectedOrigin(object){const point=object.getWorldPosition(new THREE.Vector3()).project(camera);return{x:(point.x+1)*innerWidth/2,y:(1-point.y)*innerHeight/2};}
function visibleThroughParents(object){for(let parent=object;parent;parent=parent.parent)if(!parent.visible)return false;return true;}
function projectKeys(){
 if(!ready&&buttons.length!==8)return;
 const changed=buttons.filter(b=>{
  const p=b.mesh.position,s=b.mesh.scale;
  const signature=[projectionRevision,p.x,p.y,p.z,s.x,s.y,s.z].join(',');
  if(signature===b.projectionSignature)return false;b.projectionSignature=signature;return true;
 });
 if(!changed.length)return;
 model.updateMatrixWorld(true);keyProjectionRevision++;visualStats.keyProjectionPasses++;
 for(const b of changed){
  if(!b.mesh.geometry.boundingBox)b.mesh.geometry.computeBoundingBox();
  b.rect=projectBox(b.mesh.geometry.boundingBox.clone().applyMatrix4(b.mesh.matrixWorld));
  const size=SHAPES[state.shape].buttonScale,baseMatrix=b.mesh.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(size/b.mesh.scale.x,1,size/b.mesh.scale.z));
  b.hitRect=projectBox(b.mesh.geometry.boundingBox.clone().applyMatrix4(baseMatrix));
  const cx=(b.hitRect.left+b.hitRect.right)/2,cy=(b.hitRect.top+b.hitRect.bottom)/2,hw=Math.max(24.5,(b.hitRect.right-b.hitRect.left)/2),hh=Math.max(24.5,(b.hitRect.bottom-b.hitRect.top)/2);b.hitRect={left:cx-hw,top:cy-hh,right:cx+hw,bottom:cy+hh};
  b.center={x:(b.hitRect.left+b.hitRect.right)/2,y:(b.hitRect.top+b.hitRect.bottom)/2};
 }
}
function upper(ms){let a=0,b=notes.length;while(a<b){const m=(a+b)>>>1;if(notes[m].start<=ms)a=m+1;else b=m;}return a;}
const makeCore=game=>game===6?createMusic2048(seed):game===3?createMusicTetris(seed):game===7?createMusicSnake(seed):game===8?createMusicBreakout(seed):null;
function gameState(){
 if(state.exporting||state.mode===1){const count=state.exporting||state.started?upper(state.ms):0;if(autoCoreGame!==state.game||count<autoPrefix){autoCoreGame=state.game;autoCore=makeCore(state.game);autoPrefix=0;autoCounts=Array(8).fill(0);}
  while(autoPrefix<count){const slot=keyForPitch(notes[autoPrefix].pitch);autoCore?.attack(slot);if(slot>=0)autoCounts[slot]++;autoPrefix++;}return autoCore?.snapshot()||mechanicsSnapshot(true);
 }
 if(liveCoreGame!==state.game){liveCoreGame=state.game;liveCore=makeCore(state.game);for(const slot of liveSlots)liveCore?.attack(slot);}return liveCore?.snapshot()||mechanicsSnapshot(false);
}
function mechanicsSnapshot(auto){const n=state.shownCount,pitch=auto&&n?(notes[upper(state.ms)-1]?.pitch??60):state.manual.lastPitch,last=auto?(notes[upper(state.ms)-1]?.start??-1000):state.manual.lastAttackMs,now=auto?state.ms:visualMotionMs(),phase=n?Math.max(0,Math.min(1,(now-last)/420)):0,slot=keyForPitch(pitch),counts=auto?autoCounts:state.manual.counts;
 const common={game:state.game,beats:n,score:n,phase,lastSlot:slot};if(state.game===0)return{...common,steps:n,cameraStep:Math.max(0,n-1)+phase};if(state.game===1)return{...common,caught:n,basketLane:slot};if(state.game===2)return{...common,distance:n*22,lane:slot};if(state.game===4)return{...common,wave:Math.floor(n/12),destroyed:n%12,shots:n};return{...common,growthCounts:[...counts],flowerCount:counts.filter(c=>c>=3).length};}
function updateButtons(){
 const now=visualMotionMs();for(const b of buttons){const contact=[...contacts.values()].filter(c=>c.slot===b.slot),autoHeld=(state.exporting||state.mode===1)&&state.active.some(p=>keyForPitch(p)===b.slot);
  b.held=state.exporting?autoHeld:contact.length>0||autoHeld;b.actualPitch=contact.at(-1)?.actualPitch??resolvePitch(b.slot,state.current,4);
  b.current=state.current.some(p=>keyForPitch(p)===b.slot);b.next=state.previewCount>1&&state.next.some(p=>keyForPitch(p)===b.slot);
  const age=now-(released.get(b.slot)??-1000),rebounding=age>=0&&age<230;
  b.depth=b.held?.34:rebounding?.34*Math.exp(-age/60)-.06*Math.sin(age/230*Math.PI)*Math.exp(-age/130):0;
  const capScale=b.held?.95:rebounding?1-.05*Math.exp(-age/70)*Math.cos(age/230*Math.PI*2):1,size=SHAPES[state.shape].buttonScale;b.mesh.scale.set(size*capScale,1,size*capScale);
  b.mesh.position.y=b.baseY+b.depth;b.mesh.material.color.set(b.held?(b.current?'#213d70':'#181d27'):b.current?'#3261b1':'#292e38');b.mesh.material.emissive.set(b.current&&!b.held?'#102752':'#000000');b.ring.visible=b.current||b.next;b.ring.material.opacity=b.current?1:.42;
 }
}
function cues(){const result=[];for(const[kind,pitches]of[['current',state.current],['next',state.previewCount>1?state.next:[]]])for(const pitch of pitches){const slot=keyForPitch(pitch);if(slot>=0)result.push({kind,slot,symbol:KEYS[slot].symbol,pitch});}return result;}
function durationForPitch(pitch){const relevant=notes.filter(n=>n.pitch===pitch);return relevant.find(n=>n.start<=state.ms&&n.start+n.duration>state.ms)||relevant.find(n=>n.start>=state.ms)||null;}
function holdProgress(){
 if(state.tapDurationMode)return [];
 return [...contacts.entries()].map(([pointer,c])=>{const elapsed=Math.max(0,visualMotionMs()-c.startedAt),duration=c.rawDuration;return {pointer,slot:c.slot,symbol:KEYS[c.slot].symbol,pitch:c.actualPitch,duration,elapsed,progress:duration?Math.min(1,elapsed/duration):null,complete:duration?elapsed>=duration:false};});
}
function practiceHint(){return state.tapDurationMode?'轻点一次 · 音长自动补足':holdProgress().some(h=>h.complete)?'音长已足 · 松开按键':'按住亮键 · 等提示后松手';}
function pixelRect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function star(x,y,size,color='#ffdc88'){ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?size*.45:size;ctx[i?'lineTo':'moveTo'](x+Math.cos(a)*r,y+Math.sin(a)*r);}ctx.closePath();ctx.fill();}
function background(){
 if(atlas){const tile=state.game%6,col=tile%3,row=Math.floor(tile/3);ctx.drawImage(atlas,col*atlas.width/3,row*atlas.height/2,atlas.width/3,atlas.height/2,0,0,1080,600);return;}
 const sky=ctx.createLinearGradient(0,0,0,600);sky.addColorStop(0,'#566ba6');sky.addColorStop(.7,'#d399a4');sky.addColorStop(1,'#f0bc8c');ctx.fillStyle=sky;ctx.fillRect(0,0,1080,600);
 for(let layer=0;layer<3;layer++){ctx.fillStyle=['#8383a3','#727e9e','#566985'][layer];ctx.beginPath();ctx.moveTo(0,600);for(let i=0;i<=18;i++)ctx.lineTo(i*68,400+layer*35-Math.sin(i*1.47+layer)*55);ctx.lineTo(1080,600);ctx.fill();}
 pixelRect(0,508,1080,92,'#617e99');for(let i=0;i<35;i++)pixelRect(i*31,518+(i*19)%75,12+i%4*7,2,i%4===0?'#efc398':'#aaa9bc');
 for(let i=0;i<36;i++)pixelRect(i*71%1079,20+i*43%195,2,2,'#ecdcc1');
}
function stone(x,y,w){ctx.fillStyle='#3e425e';ctx.beginPath();ctx.moveTo(x,y+12);ctx.lineTo(x+w,y+12);ctx.lineTo(x+w-12,y+52);ctx.lineTo(x+w-25,y+52);ctx.lineTo(x+w*.65,y+90);ctx.lineTo(x+w*.36,y+90);ctx.lineTo(x+12,y+55);ctx.closePath();ctx.fill();
 for(let i=0;i<10;i++){pixelRect(x+15+i%5*w*.16,y+17+Math.floor(i/5)*28,w*.12,20,i%2?'#726779':'#5a6078');pixelRect(x+17+i%5*w*.16,y+17+Math.floor(i/5)*28,w*.08,3,'#918683');}pixelRect(x-3,y,w+6,14,'#779856');pixelRect(x-3,y,w+6,4,'#c2ce78');for(let i=0;i<12;i++)pixelRect(x+i*w/12,y+4,5,8+i%3*4,'#a6bd63');}
// Antialiased screen artwork for the four actual source-derived mechanics.
// All positions below are screen texture coordinates, not Android input targets.
function classicTile(x,y,w,h,color,r=6){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function classicBackdrop(){
 const g=ctx.createLinearGradient(0,0,1080,gameCanvas.height);g.addColorStop(0,'#162638');g.addColorStop(1,'#213a48');ctx.fillStyle=g;ctx.fillRect(0,0,1080,gameCanvas.height);
}
function drawClassic(core,phase){
 classicBackdrop();if(!core)return;const h=gameCanvas.height,top=100,available=h-182;
 ctx.fillStyle='#9ddaca';ctx.font='600 28px sans-serif';ctx.textAlign='right';ctx.fillText(String(core.score)+' 分',1040,88);ctx.textAlign='left';
 if(state.game===3){
  const size=Math.min(900/core.width,available/core.height),ox=(1080-size*core.width)/2,oy=top;classicTile(ox-10,oy-10,size*core.width+20,size*core.height+20,'#101f2c',12);
  for(let y=0;y<core.height;y++)for(let x=0;x<core.width;x++){classicTile(ox+x*size,oy+y*size,size-2,size-2,'#203341',3);if(core.grid[y][x])classicTile(ox+x*size,oy+y*size,size-2,size-2,core.grid[y][x],4);}
  for(const b of core.falling||[])classicTile(ox+b.x*size,oy+b.y*size,size-2,size-2,b.color,4);
 }else if(state.game===6){
  const size=Math.min(225,available/4),ox=(1080-size*4)/2,oy=top;classicTile(ox-10,oy-10,size*4+20,size*4+20,'#101f2c',14);
  const colors={2:'#bfd8d4',4:'#a3cbc8',8:'#7faeac',16:'#709cad',32:'#658caa',64:'#607ba0',128:'#6f769f',256:'#817595',512:'#a58396',1024:'#c99e96',2048:'#d8ba93'};
  for(let x=0;x<4;x++)for(let y=0;y<4;y++){const value=core.grid[x][y];classicTile(ox+x*size,oy+y*size,size-7,size-7,value?(colors[value]||'#dbc18d'):'#293e4a',9);if(value){ctx.fillStyle=value<=4?'#263b42':'#f2f7f6';ctx.font=`600 ${Math.round(size*(value>512?.27:.38))}px sans-serif`;ctx.textAlign='center';ctx.fillText(String(value),ox+(x+.5)*size-3,oy+(y+.6)*size);ctx.textAlign='left';}}
 }else if(state.game===7){
  const size=Math.min(36,available/25),ox=(1080-size*25)/2,oy=top;classicTile(ox-10,oy-10,size*25+20,size*25+20,'#101f2c',14);
  for(let x=0;x<25;x++)for(let y=0;y<25;y++)if((x+y)%2===0)classicTile(ox+x*size,oy+y*size,size,size,'#1b303b',0);
  core.cells.forEach((c,i)=>classicTile(ox+c.x*size+1,oy+c.y*size+1,size-2,size-2,i===0?'#c0ede0':'#66b7a6',Math.min(4,size/4)));
  ctx.fillStyle='#f1c795';ctx.beginPath();ctx.arc(ox+(core.apple.x+.5)*size,oy+(core.apple.y+.5)*size,size*.36,0,Math.PI*2);ctx.fill();
 }else if(state.game===8){
  const scale=Math.min(900/400,available/500),ox=(1080-400*scale)/2,oy=top;classicTile(ox-10,oy-10,400*scale+20,500*scale+20,'#101f2c',14);
  const color={red:'#d099a4',orange:'#d4b48c',green:'#92baa5',yellow:'#c9c998'};
  for(const b of core.bricks)classicTile(ox+b.x*scale,oy+b.y*scale,b.width*scale-1,b.height*scale-1,color[b.color],2);
  const p=core.paddle;classicTile(ox+p.x*scale,oy+p.y*scale,p.width*scale,p.height*scale,'#b4ddda',5);
  const f=Math.max(0,Math.min(1,phase*2)),prev=core.previousBall||core.ball,b=core.ball,x=prev.x+(b.x-prev.x)*f,y=prev.y+(b.y-prev.y)*f;
  ctx.fillStyle='#f7edca';ctx.beginPath();ctx.arc(ox+(x+b.width/2)*scale,oy+(y+b.height/2)*scale,b.width*scale/2,0,Math.PI*2);ctx.fill();
 }
}
let lastGamePaintKey='';

function drawGame(core){
 const classic=[3,6,7,8].includes(state.game),logicalHeight=classic?gameCanvas.height:600;const auto=state.exporting||state.mode===1,n=state.shownCount,pitch=auto?(notes[upper(state.ms)-1]?.pitch??60):state.manual.lastPitch;
 const last=auto?(notes[upper(state.ms)-1]?.start??-1000):state.manual.lastAttackMs,now=auto?state.ms:visualMotionMs(),phase=n?Math.max(0,Math.min(1,(now-last)/420)):0,slot=keyForPitch(pitch);
 const list=cues(),progress=holdProgress(),hint=practiceHint(),key=JSON.stringify([state.generation,state.shape,state.game,state.mode,projectionRevision,state.shownCount,state.waiting,state.current,state.next,state.active,state.previewCount,state.tapDurationMode,hint,progress.map(h=>[h.slot,h.complete,h.progress===null?null:Math.round(h.progress*60)]),classic&&state.game!==8?0:Math.round(phase*60)]);
 if(key===lastGamePaintKey)return;lastGamePaintKey=key;ctx.save();if(!classic)ctx.scale(1,gameCanvas.height/600);if(!classic)background();
 if(classic){drawClassic(core,phase);}
 else if(state.game===0){const span=235,base=355,cameraStep=core.cameraStep,terrain=level=>35*Math.sin(level*.63),ground=terrain(Math.floor(cameraStep))+(terrain(Math.floor(cameraStep)+1)-terrain(Math.floor(cameraStep)))*(cameraStep%1);for(let i=-1;i<6;i++){const level=Math.floor(cameraStep)+i;stone((level+.25-cameraStep)*span,base+terrain(level)-ground,156);}
  const x=span*.60,y=base-40-Math.sin(phase*Math.PI)*60;star(x,y,38);ctx.strokeStyle='#413d61';ctx.lineWidth=5;ctx.stroke();pixelRect(x-43,y+1,20,10,'#91cfdf');pixelRect(x-14,y-7,5,8,'#473958');pixelRect(x+10,y-7,5,8,'#473958');pixelRect(x-4,y+12,8,4,'#b7786c');
  if(phase<.7)star((1.6-phase)*span,base-50+phase*23,17);if(n&&phase>.55&&phase<1)for(let i=0;i<5;i++)star(x+(i-2)*25*(phase-.55),y-20-i%2*15,4);
 }else if(state.game===1){const x=100+slot*125,y=490;pixelRect(x-42,y,84,35,'#745a45');pixelRect(x-50,y-7,100,11,'#d4b480');for(let i=0;i<6;i++)pixelRect(x-35+i*13,y,3,30,'#a3895d');if(n&&phase<1)star(x,100+(y-110)*phase,24);for(let i=0;i<Math.min(8,n);i++)star(25+i*28,40,9);
 }else if(state.game===2){ctx.fillStyle='#414f61';ctx.beginPath();ctx.moveTo(440,110);ctx.lineTo(180,600);ctx.lineTo(900,600);ctx.lineTo(640,110);ctx.closePath();ctx.fill();for(let i=0;i<6;i++)pixelRect(537,130+((i*80+n*16+phase*16)%450),6,30,'#d9d2bc');const x=370+slot*47;pixelRect(x,430,52,100,'#a9d4dc');pixelRect(x+9,450,34,24,'#3f6577');pixelRect(x-8,447,10,66,'#232737');pixelRect(x+50,447,10,66,'#232737');pixelRect(x+8,520,8,6,'#f3dda0');pixelRect(x+35,520,8,6,'#f3dda0');
 }else if(state.game===4){const defeated=n%12;for(let i=defeated;i<12;i++){const x=260+i%4*190,y=140+Math.floor(i/4)*66;pixelRect(x-18,y,36,18,'#bbc4df');pixelRect(x-25,y+10,8,24,'#8995bd');pixelRect(x+17,y+10,8,24,'#8995bd');pixelRect(x-10,y+6,5,5,'#384253');pixelRect(x+6,y+6,5,5,'#384253');}const x=140+slot*105;ctx.fillStyle='#b9d8e6';ctx.beginPath();ctx.moveTo(x,490);ctx.lineTo(x+29,545);ctx.lineTo(x,525);ctx.lineTo(x-29,545);ctx.closePath();ctx.fill();if(n&&phase<1)pixelRect(x-2,490-phase*350,4,25,'#faf0b7');
 }else if(state.game===5){const counts=core.growthCounts;pixelRect(0,495,1080,105,'#786e55');for(let i=0;i<8;i++){const x=80+i*132,height=Math.min(265,10+counts[i]*22);if(!counts[i]){pixelRect(x,489,6,4,'#b6bb82');continue;}pixelRect(x,495-height,5,height,'#8cac75');pixelRect(x-20,495-height*.45,20,7,'#759763');pixelRect(x+4,495-height*.65,20,7,'#a9bd75');if(counts[i]>=3)star(x+3,495-height,17,'#dccfa0');}
 }
 const screenRect=staticProjection(screenMesh),hudFont=Math.max(30,Math.ceil(14*logicalHeight/(screenRect.bottom-screenRect.top)));
 ctx.fillStyle='rgba(32,43,62,.65)';ctx.fillRect(12,10,260,hudFont+12);ctx.fillStyle='#f1eee5';ctx.font=hudFont+'px sans-serif';ctx.fillText(GAMES[state.game],25,hudFont+12);
 list.forEach((cue,i)=>{const x=290+i*75;ctx.fillStyle=cue.kind==='current'?'rgba(42,101,175,.85)':'rgba(44,60,80,.5)';ctx.fillRect(x-25,12,55,43);drawSymbol(ctx,cue.slot,x+2,33,35,cue.kind==='current'?'#e8f6ff':'#8fcbe9');});
 if(state.waiting&&!state.exporting){ctx.fillStyle='#edf1fa';ctx.font='20px sans-serif';ctx.textAlign='right';ctx.fillText('点击开始',1040,34);ctx.textAlign='left';}
 progress.forEach((h,i)=>{const x=320+i*110;pixelRect(x,logicalHeight-hudFont-34,100,7,'#293d57');if(h.progress!==null)pixelRect(x,logicalHeight-hudFont-34,100*h.progress,7,h.complete?'#c4def1':'#77bff0');});
 ctx.fillStyle='rgba(26,39,59,.82)';ctx.fillRect(60,logicalHeight-hudFont-18,960,hudFont+12);ctx.fillStyle='#eef2f4';ctx.font=hudFont+'px sans-serif';ctx.textAlign='center';ctx.fillText(hint,540,logicalHeight-12);ctx.textAlign='left';
 ctx.restore();if(secondaryScreen?.visible){feedbackCtx.fillStyle='#25334b';feedbackCtx.fillRect(0,0,512,300);feedbackCtx.fillStyle='#dceafa';feedbackCtx.font='30px sans-serif';feedbackCtx.fillText('音乐进度',24,45);feedbackCtx.textAlign='right';feedbackCtx.fillText(String(n),485,45);feedbackCtx.textAlign='left';
 list.forEach((cue,i)=>{drawSymbol(feedbackCtx,cue.slot,115+i*135,145,82,cue.kind==='current'?'#c1e6ff':'#6c8caa');});feedbackCtx.fillStyle='#9db2cc';feedbackCtx.font='25px sans-serif';feedbackCtx.fillText(state.waiting?'等待开始':core?'得分 '+core.score:'按对音符继续',24,272);feedbackTexture.needsUpdate=true;}
 screenTexture.needsUpdate=true;
}
function block(x,y,size,color){pixelRect(x+1,y+1,size-2,size-2,color);pixelRect(x+2,y+2,size-4,3,'rgba(255,255,255,.5)');}
async function load(data={}){
 stopLocalAnimation();visualOffsetMs=0;const serial=++loadSerial;if(disposed)throw Error('Renderer disposed');const generation=Number(data.generation)||0;state.generation=generation;ready=false;renderError='';contacts.clear();released.clear();notes=(data.notes||[]).map((n,i)=>({...n,source:n.source??i,start:Number(n.start??n.startMs)||0,duration:Number(n.duration??n.durationMs)||1})).sort((a,b)=>a.start-b.start||a.source-b.source);
 Object.assign(state,{frameId:0,ms:0,playing:false,exporting:false,current:[],next:[],active:[],shownCount:0,mode:Number.isInteger(data.mode)?data.mode:2,tapDurationMode:data.tapDurationMode!==false});
 state.shape=Math.max(0,Math.min(4,Number(data.shape)||0));state.game=Math.max(0,Math.min(GAMES.length-1,Number(data.game)||0));state.manual={epoch:0,total:0,lastPitch:60,counts:Array(8).fill(0),trace:'',motionMs:0,lastAttackMs:-1000};liveEpoch=0;liveSlots=[];lastAccepted=-1;liveCoreGame=autoCoreGame=-1;autoPrefix=0;state.started=false;state.waiting=true;
 try{if(!modelPromise)modelPromise=Promise.all([new GLTFLoader().loadAsync('./salva-switch/switch.gltf'),new GLTFLoader().loadAsync('./control-shells.glb')]).then(([gltf,cad])=>{if(disposed)throw Error('Renderer disposed');cad.scene.updateMatrixWorld(true);cad.scene.traverse(o=>{if(o.isMesh)cadParts.set(o.name,o);});adaptModel(gltf.scene);modelStats.visualSource={name:'open-console-cad',commit:'55081da3b4864aba36082644f9a3c5cedf1061c8',license:'MIT',parts:8,bytes:219204,material:'molded ABS PBR with PMREM studio',adaptation:'CAD exterior rear halves repurposed as plain front shells; source filleted buttons and concave stick geometry fit to the original eight large controls'};});await modelPromise;if(serial!==loadSerial)throw Error('Superseded model load');applyShape(state.shape);resize();drawGame(gameState());await renderer.compileAsync(scene,camera);if(serial!==loadSerial||disposed)throw Error('Superseded model compile');ready=true;renderer.render(scene,camera);projectKeys();document.getElementById('status').textContent='';bridge('HandheldSceneReady','loaded',generation,'');return inspect();}
 catch(error){if(serial===loadSerial){renderError=String(error);document.getElementById('status').textContent=renderError;}if(!window.HandheldCompatibility?.deferErrors)bridge('HandheldSceneReady','loaded',generation,String(error));throw error;}
}
async function frame(data){
 if(!data||data.frameId==null)throw Error('frameId required');const id=data.frameId;
 stopLocalAnimation();visualOffsetMs=0;visualAnchorMs=performance.now();lastLocalRafMs=0;
 try{if(!ready)throw Error('Model not loaded');if(data.generation!=null&&data.generation!==state.generation)throw Error('Stale generation');
  for(const field of['mode','shape','game','previewCount'])if(data[field]!=null)state[field]=Number(data[field]);state.game=Math.max(0,Math.min(GAMES.length-1,state.game));
  state.frameId=id;state.ms=Math.max(0,Number(data.ms)||0);state.playing=!!data.playing;state.exporting=!!data.exporting;state.localVisualAnimation=!!data.localVisualAnimation;
  if(data.started!=null)state.started=!!data.started;else if(state.playing||state.ms>0||state.exporting)state.started=true;state.waiting=data.waiting!=null?!!data.waiting:!state.started;
  if(data.tapDurationMode!=null)state.tapDurationMode=!!data.tapDurationMode;
  for(const field of['current','next','active'])state[field]=(data[field]||[]).filter(p=>Number.isInteger(p)&&p>=0&&p<=127);
  if(!state.exporting&&state.mode!==1){
   if(data.manual){if(data.manual.epoch!==liveEpoch){liveEpoch=data.manual.epoch;liveSlots=[];lastAccepted=-1;liveCoreGame=-1;}state.manual={...state.manual,...data.manual,counts:[...(data.manual.counts||state.manual.counts)]};}
   if(typeof data.manual?.trace==='string'){
    const trace=data.manual.trace;if(!/^[0-7]*$/.test(trace))throw Error('Invalid manual trace');const old=liveSlots.join('');
    if(!trace.startsWith(old)){liveSlots=[];liveCoreGame=-1;}
    for(let i=liveSlots.length;i<trace.length;i++){const slot=Number(trace[i]);liveSlots.push(slot);if(liveCoreGame===state.game)liveCore?.attack(slot);}
   }else{const events=data.acceptedEvents||(data.accepted?[data.accepted]:[]);for(const event of events)if(Number(event.id)>lastAccepted){lastAccepted=Number(event.id);const slot=keyForPitch(event.pitch);if(slot<0)continue;liveSlots.push(slot);if(liveCoreGame===state.game)liveCore?.attack(slot);if(!data.manual){state.manual.total++;state.manual.lastPitch=event.pitch;state.manual.counts[slot]++;state.manual.lastAttackMs=state.manual.motionMs;}}}
   state.shownCount=data.manual?state.manual.total:liveSlots.length;
  }else state.shownCount=state.exporting||state.started?upper(state.ms):0;
  applyShape(state.shape);resize();updateButtons();const core=gameState();drawGame(core);renderer.render(scene,camera);projectKeys();
  kickLocalAnimation();
  if(data.captureVisualBarrier&&state.exporting){const submitted=inspect();bridge('HandheldSceneReady','submitted',id,JSON.stringify(submitted));return{frameId:id,generation:state.generation};}
  if(!state.exporting){visualStats.bridgedLiveFrames++;const observed=inspect();bridge('HandheldSceneReady','observed',id,JSON.stringify(observed));return{frameId:id,generation:state.generation};}
  await new Promise(resolve=>requestAnimationFrame(resolve));bridge('HandheldSceneReady','painted',id,'');return inspect();
 }catch(error){bridge('HandheldSceneReady','painted',id,String(error));throw error;}
}
function press({pointer,slot,down,actualPitch}){if(!ready||state.exporting)return false;if(down){if(!KEYS[slot])return false;const pitch=Number.isInteger(actualPitch)?actualPitch:resolvePitch(slot,state.current,4);contacts.set(pointer,{slot,actualPitch:pitch,startedAt:visualMotionMs(),rawDuration:durationForPitch(pitch)?.duration??null});}else{const old=contacts.get(pointer);contacts.delete(pointer);if(old)released.set(old.slot,visualMotionMs());}updateButtons();drawGame(gameState());renderer.render(scene,camera);projectKeys();kickLocalAnimation();return true;}
function inspect(){model?.updateMatrixWorld(true);const rect=screenMesh?staticProjection(screenMesh):null;return{ready,projectionRevision:keyProjectionRevision,visualTiming:{...visualStats,visualMotionMs:visualMotionMs(),nativeMotionMs:state.manual.motionMs,localRafPending:!!localRaf},error:renderError,viewport:{width:innerWidth,height:innerHeight},state:JSON.parse(JSON.stringify(state)),keys:buttons.map(b=>({slot:b.slot,symbol:KEYS[b.slot].symbol,mesh:b.mesh.name,rect:b.rect,capRect:b.rect?{...b.rect}:null,hitRect:b.hitRect?{...b.hitRect}:null,hitShape:'circle',center:b.center,symbolCenter:projectedOrigin(b.label),visible:visibleThroughParents(b.mesh)&&visibleThroughParents(b.label),current:!!b.current,next:!!b.next,held:!!b.held,actualPitch:b.actualPitch??null,depth:b.depth})),screen:{rect,secondaryRect:secondaryScreen?.visible?staticProjection(secondaryScreen):null,cues:cues(),gameName:GAMES[state.game],practiceHint:practiceHint(),practiceFontDp:rect?Math.max(36,Math.ceil(14*600/(rect.bottom-rect.top)))*(rect.bottom-rect.top)/600:null,holdProgress:holdProgress()},camera:{type:'orthographic',position:camera.position.toArray(),rotation:camera.rotation.toArray(),left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom},modelStats,renderStats:{...renderer.info.render,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,contextLost:renderer.getContext().isContextLost()},gameState:gameState(),seed,symbols:KEYS,layout:{sourceModels:2,implementedShapes:[0,1,2,3,4],shapeName:SHAPES[state.shape].name,recommendedAspect:SHAPES[state.shape].aspect,minimumHitDp:buttons.length&&buttons.every(b=>b.hitRect)?Math.min(...buttons.flatMap(b=>[b.hitRect.right-b.hitRect.left,b.hitRect.bottom-b.hitRect.top])):null,leftStickRect:sticks.find(s=>s.side==='left')?staticProjection(sticks.find(s=>s.side==='left').mesh):null,rightStickRect:sticks.find(s=>s.side==='right')?staticProjection(sticks.find(s=>s.side==='right').mesh):null}};}
function hit(x,y){return buttons.find(b=>{const r=b.hitRect;if(!r)return false;const dx=(x-(r.left+r.right)/2)/((r.right-r.left)/2),dy=(y-(r.top+r.bottom)/2)/((r.bottom-r.top)/2);return dx*dx+dy*dy<=1;})?.slot??-1;}
renderer.domElement.addEventListener('pointerdown',event=>{const slot=hit(event.clientX,event.clientY);if(slot<0)return;event.preventDefault();renderer.domElement.setPointerCapture(event.pointerId);const pitch=resolvePitch(slot,state.current,4);press({pointer:event.pointerId,slot,down:true,actualPitch:pitch});bridge('HandheldSceneTouch','down',event.pointerId,slot);});
for(const type of['pointerup','pointercancel'])renderer.domElement.addEventListener(type,event=>{press({pointer:event.pointerId,down:false});bridge('HandheldSceneTouch','up',event.pointerId);});
window.addEventListener('resize',()=>{if(ready){resize();renderer.render(scene,camera);projectKeys();}});
function dispose(){if(disposed)return;stopLocalAnimation();disposed=true;ready=false;loadSerial++;contacts.clear();const resources=new Set();scene.traverse(o=>{if(!o.isMesh)return;resources.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(mat))if(value?.isTexture)resources.add(value);resources.add(mat);}});resources.add(screenTexture);for(const r of resources)r.dispose?.();studioTarget.dispose();renderer.dispose();renderer.forceContextLoss();}
window.HandheldScene={load,frame,press,inspect,dispose,setVisible,async setAtlas(url){atlas=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});drawGame(gameState());renderer.render(scene,camera);},reset(){liveSlots=[];lastAccepted=-1;liveCoreGame=-1;contacts.clear();}};
window.handheldBootReady=true;
if(new URLSearchParams(location.search).has('preview')){
 load({generation:1,title:'模型实际前视候选',notes:[60,62,64,70].map((pitch,i)=>({pitch,start:i*700,duration:550,velocity:90}))})
 .then(()=>frame({generation:1,frameId:1,ms:0,mode:2,playing:false,started:false,waiting:true,current:[60],next:[62],active:[],manual:{epoch:0,total:0,trace:'',counts:Array(8).fill(0),motionMs:0,lastAttackMs:-1000}}));
}
