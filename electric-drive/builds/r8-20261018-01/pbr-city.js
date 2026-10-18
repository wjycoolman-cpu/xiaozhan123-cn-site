import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { HDRLoader } from './vendor/HDRLoader.js';
import { trackPoint, installTrackWarp } from './track.js';
import { AUTHORED_BUILDING_LOTS } from './landmarks.js';

// Poly Haven CC0: actual selected facade meshes, Asphalt 02 and Venice Sunset.
// See assets/pbr-city/SOURCE_AND_LICENSE.md. Buildings are rigid instances;
// their anchors follow the road, while each window stays architectural.
export async function createPbrCity({ scene, renderer, roadMaterial, concreteMaterial, distanceUniform, ownG, ownM, ownT }) {
  const url = path => new URL('./assets/pbr-city/' + path, import.meta.url).href;
  const tl = new THREE.TextureLoader();
  const [facade, diffuse, normal, roughness, hdr] = await Promise.all([
    new GLTFLoader().loadAsync(url('urban-facade-selected.glb')),
    tl.loadAsync(url('asphalt/asphalt_02_diff_1k.jpg')),
    tl.loadAsync(url('asphalt/asphalt_02_nor_gl_1k.jpg')),
    tl.loadAsync(url('asphalt/asphalt_02_rough_1k.jpg')),
    new HDRLoader().loadAsync(new URL('./assets/sky/qwantani_sunset_puresky_2k.hdr',import.meta.url).href),
  ]);
  const roadTextures = [diffuse, normal, roughness];
  for (const t of roadTextures) {
    ownT(t); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(11.8 / 3, 390 / 3);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  diffuse.colorSpace = THREE.SRGBColorSpace;
  roadMaterial.map = diffuse; roadMaterial.normalMap = normal;
  roadMaterial.roughnessMap = roughness; roadMaterial.color.set(0xb7b7b7);
  roadMaterial.normalScale.set(.23, .23); roadMaterial.roughness = .94;
  roadMaterial.metalness = 0; roadMaterial.needsUpdate = true;
  const priorRoadCompile=roadMaterial.onBeforeCompile,priorRoadKey=roadMaterial.customProgramCacheKey.bind(roadMaterial);
  roadMaterial.onBeforeCompile=function(shader,r){
    priorRoadCompile.call(this,shader,r);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
      vec4 asphaltTexel=texture2D(map,vMapUv);
      asphaltTexel.rgb=mix(vec3(.16),asphaltTexel.rgb,.58);
      diffuseColor*=asphaltTexel;
     #endif`);
  };
  roadMaterial.customProgramCacheKey=()=>priorRoadKey()+'|r5-asphalt-soft-cracks';
  const concreteNormal=ownT(normal.clone()),concreteRoughness=ownT(roughness.clone());
  concreteNormal.repeat.set(1,1);concreteRoughness.repeat.set(1,1);
  concreteMaterial.color.set(0x8c877a);concreteMaterial.metalness=.01;
  concreteMaterial.roughness=.96;concreteMaterial.normalMap=concreteNormal;
  concreteMaterial.roughnessMap=concreteRoughness;concreteMaterial.normalScale.set(.14,.14);
  concreteMaterial.needsUpdate=true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const environment = pmrem.fromEquirectangular(hdr);
  ownT(hdr);hdr.mapping=THREE.EquirectangularReflectionMapping;
  scene.background=hdr;scene.backgroundIntensity=.72;scene.backgroundBlurriness=0;
  // Source sun is at azimuth +35.7deg; place its glow just left of the driving view.
  scene.backgroundRotation.y=2.80;
  scene.environment=environment.texture;scene.environmentIntensity=.56;
  scene.environmentRotation.y=scene.backgroundRotation.y;
  pmrem.dispose();

  const parts = new Map(), buckets = new Map();
  for (const name of ['wall_window_centered_large_01', 'window_centered_large_01', 'wall_door_centered_large_01', 'door_centered_large_01', 'cornice_standard_standard_01', 'crown_standard_standard_01']) {
    const source = facade.scene.getObjectByName(name);
    if (!source) throw new Error('Required facade source missing: ' + name);
    const copy = source.clone(true); copy.position.set(0, 0, 0); copy.updateMatrixWorld(true);
    const list = [];
    copy.traverse(o => {
      if (!o.isMesh) return;
      const geometry = ownG(o.geometry.clone()); geometry.applyMatrix4(o.matrixWorld);
      // Source cells cover x=-3..0; center the unchanged three metre cell.
      geometry.translate(1.5, 0, 0);
      const material = o.material;
      ownM(material); material.userData.trackWarpExempt = true;
      material.envMapIntensity = .8;
      if (/glass/i.test(material.name)) {
        material.transmission = 0; material.transparent = false; material.opacity = 1;
        material.depthWrite = true; material.roughness = .24; material.metalness = .32;
        material.color.set(0x879fa5);
      }
      for (const t of Object.values(material)) if (t?.isTexture) {
        ownT(t); t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      }
      list.push({ geometry, material });
    });
    parts.set(name, list);
  }

  const specs = [
    [-1, 19, 12, 7, 16, 4], [1, 21, -45, 7, 13, 5],
    [-1, 27, -110, 8, 11, 4], [1, 20, -163, 6, 19, 4],
    [-1, 67, -255, 5, 22, 4], [1, 37, -310, 8, 12, 5],
    [-1, 48, -382, 7, 15, 4], [1, 18, -445, 7, 18, 4],
    [-1, 46, -526, 8, 11, 5], [1, 33, -604, 6, 20, 4],
    [-1, 19, -675, 6, 17, 4], [1, 43, -740, 8, 14, 4],
    [-1, 39, -840, 6, 21, 5], [1, 36, -905, 8, 12, 4],
    [-1, 22, -995, 7, 15, 4], [1, 19, -1080, 7, 18, 4],
  ].map(([side, setback, z, columns, floors, depthCells], i) => ({
    side, x: side * setback, z, columns, floors, depthCells,
    yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2,
    tint: new THREE.Color([0xffffff, 0xd6e0dc, 0xf3e4d8, 0xc6d4d4][i % 4]),
  }));
  function streetProfile(s,side){
    if(s<190)return{setback:30,floors:7};
    if(s<400)return{setback:side<0?31:38,floors:side<0?5:4};
    if(s<600)return{setback:side<0?18:14,floors:side<0?4:7};
    if(s<860)return{setback:side<0?15.5:21,floors:side<0?6:3};
    const open=s>875&&s<1040;
    return open?{setback:38,floors:5}:{setback:28,floors:7};
  }
  for(let i=0;i<20;i++)for(const side of[-1,1]){
    const worldPosition=31+i*62,profile=streetProfile(worldPosition,side);
    // Fit the one Bistro landmark into a real opening, including solid body
    // and roof geometry, rather than merely removing a few facade windows.
    const columns=side<0&&i===4?16:side<0&&i===5?9:side>0&&i===5?10:side>0&&i===6?14:21;
    const anchor=side<0&&i===4?271.5:side<0&&i===5?359:side>0&&i===5?324.5:side>0&&i===6?413.5:worldPosition;
    const baseSpec={side,x:side*(profile.setback+(i%3===2?3.2:0)),z:-anchor,columns,floors:profile.floors+(i%4===0?2:0),depthCells:8+(i%3),yaw:side<0?Math.PI/2:-Math.PI/2,street:true,tint:new THREE.Color([0xe2e1d7,0xcbd7d4,0xf0e7dc][(i+(side>0?1:0))%3])};
    let sections=[{lo:anchor-columns*1.5,hi:anchor+columns*1.5,setback:Math.abs(baseSpec.x)}];
    for(const lot of AUTHORED_BUILDING_LOTS){
      if(lot.side!==side)continue;const next=[];
      for(const part of sections){const lo=Math.max(part.lo,lot.opening[0]),hi=Math.min(part.hi,lot.opening[1]);if(hi<=lo){next.push(part);continue;}
        if(lo>part.lo)next.push({...part,hi:lo});
        next.push({lo,hi,setback:Math.max(part.setback,lot.nearEdge+lot.lateralSize+5)});
        if(hi<part.hi)next.push({...part,lo:hi});
      }sections=next;
    }
    for(const part of sections){
      // Keep the proven roof planter podium intact. Other long blocks become
      // two or three real buildings, with open side streets between them.
      const length=part.hi-part.lo,preservePodium=side<0&&i===4;
      const pieces=preservePodium?1:length>50?3:length>29?2:1,gap=9;
      const span=(length-gap*(pieces-1))/pieces,cols=Math.floor(span/3);
      if(cols<2)continue;
      for(let section=0;section<pieces;section++){
        const mid=part.lo+span/2+section*(span+gap);
        specs.push({...baseSpec,x:side*part.setback,z:-mid,columns:cols,
          floors:baseSpec.floors-(!preservePodium&&pieces>1&&section===1?1:0)});
      }
    }
  }
  const cell = new THREE.Object3D();
  function queue(part, building, x, y, z, yaw = 0, scale = [1, 1, 1]) {
    const key = part.geometry.uuid + ':' + part.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { ...part, instances: [] });
    cell.position.set(x, y, z); cell.rotation.set(0, yaw, 0); cell.scale.set(...scale); cell.updateMatrix();
    buckets.get(key).instances.push({ building, local: cell.matrix.clone() });
  }
  const bodyMat = ownM(parts.get('wall_window_centered_large_01')[0].material.clone());
  bodyMat.userData.trackWarpExempt = true; bodyMat.normalScale?.set(.35, .35);
  const roofMat = ownM(new THREE.MeshStandardMaterial({ color: 0x50534f, roughness: .88, normalMap:concreteNormal,roughnessMap:concreteRoughness,normalScale:new THREE.Vector2(.12,.12) }));
  roofMat.userData.trackWarpExempt = true;
  const plinthMat=ownM(new THREE.MeshStandardMaterial({color:0xa6a08e,roughness:.94,normalMap:concreteNormal,roughnessMap:concreteRoughness,normalScale:new THREE.Vector2(.13,.13)}));
  plinthMat.userData.trackWarpExempt=true;
  const trimMat=ownM(new THREE.MeshStandardMaterial({color:0x777b73,roughness:.54,metalness:.35}));trimMat.userData.trackWarpExempt=true;
  function metreSurface(shader){
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      vec3 surfaceScale=vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));
      #ifdef USE_INSTANCING
       surfaceScale*=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
      #endif
      vec3 surfaceP=position*surfaceScale,surfaceAxis=abs(normalize(normal));
      vec2 surfaceUV=(surfaceAxis.y>.6?surfaceP.xz:(surfaceAxis.x>surfaceAxis.z?surfaceP.zy:surfaceP.xy))/3.0;
      #ifdef USE_MAP
       vMapUv=surfaceUV;
      #endif
      #ifdef USE_NORMALMAP
       vNormalMapUv=surfaceUV;
      #endif
      #ifdef USE_ROUGHNESSMAP
       vRoughnessMapUv=surfaceUV;
      #endif`);
  }
  const concreteAlbedo=ownT(bodyMat.map.clone());concreteAlbedo.wrapS=concreteAlbedo.wrapT=THREE.RepeatWrapping;concreteAlbedo.repeat.set(1,1);
  concreteMaterial.map=concreteAlbedo;
  const priorConcreteCompile=concreteMaterial.onBeforeCompile,priorConcreteKey=concreteMaterial.customProgramCacheKey.bind(concreteMaterial);
  concreteMaterial.onBeforeCompile=function(shader,r){
    priorConcreteCompile.call(this,shader,r);metreSurface(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
      vec3 weatherSample=texture2D(map,vMapUv).rgb;
      float weatherLuma=dot(weatherSample,vec3(.299,.587,.114));
      diffuseColor.rgb*=vec3(.65+weatherLuma*.55);
     #endif`);
  };
  concreteMaterial.customProgramCacheKey=()=>priorConcreteKey()+'|r4-weathered-metre-concrete';concreteMaterial.needsUpdate=true;
  // Preserve metre-scaled surface detail on differently sized solid bodies.
  for(const material of[bodyMat,roofMat,plinthMat]){
    material.onBeforeCompile=metreSurface;
    material.customProgramCacheKey=()=> 'r4-metre-surface-1';
  }
  const unitBox = ownG(new THREE.BoxGeometry(1, 1, 1));
  for (let bi = 0; bi < specs.length; bi++) {
    const b = specs[bi], width = b.columns * 3, height = b.floors * 3, depth = b.depthCells * 3;
    // Opaque structure behind inset glass, plus a real roof bounded by source crown.
    queue({ geometry: unitBox, material: bodyMat }, bi, 0, height / 2, -depth / 2, 0, [width - .9, height, depth - .9]);
    queue({ geometry: unitBox, material: roofMat }, bi, 0, height + .04, -depth / 2, 0, [width, .12, depth]);
    queue({geometry:unitBox,material:plinthMat},bi,0,-.05,-depth/2+1,0,[width+4,.3,depth+5]);
    queue({geometry:unitBox,material:plinthMat},bi,0,-.28,-depth/2,0,[width+5,.45,depth+6]);
    // A setback service volume and roof edge make the top a built structure.
    const penthouseX=(bi%2?1:-1)*width*.18;
    queue({geometry:unitBox,material:bodyMat},bi,penthouseX,height+1.65,-depth*.64,0,[width*.45,3.2,depth*.45]);
    queue({geometry:unitBox,material:roofMat},bi,penthouseX,height+3.3,-depth*.64,0,[width*.45+.4,.16,depth*.45+.4]);
    for(let unit=0;unit<2;unit++)queue({geometry:unitBox,material:trimMat},bi,width*.27-unit*2.7,height+.65,-depth*.32,0,[2.0,1.1,1.8]);
    const end = b.side < 0 ? -1 : 1;
    // A bend reveals the ends of street blocks: use the same real window,
    // cornice and crown geometry there instead of exposing a blank body box.
    const faces=[
      {columns:b.columns,yaw:0,x:0,z:0},
      {columns:b.depthCells,yaw:end*Math.PI/2,x:end*width/2,z:-depth/2},
      {columns:b.depthCells,yaw:-end*Math.PI/2,x:-end*width/2,z:-depth/2},
      ...(!b.street?[{columns:b.columns,yaw:Math.PI,x:0,z:-depth}]:[]),
    ];
    const firstVisibleRow=b.street?3:Math.min(b.floors-1,streetProfile((-b.z+1240)%1240).floors-1);
    for (const face of faces) {
      function place(name, col, row) {
        const u = (col - (face.columns - 1) / 2) * 3;
        const x = face.x + Math.cos(face.yaw) * u;
        const z = face.z - Math.sin(face.yaw) * u;
        for (const part of parts.get(name)) queue(part, bi, x, row * 3, z, face.yaw);
      }
      for (let row = firstVisibleRow; row < b.floors; row++) for (let col = 0; col < face.columns; col++) {
        const door = row === 0 && col === Math.floor(face.columns / 2);
        place(door ? 'wall_door_centered_large_01' : 'wall_window_centered_large_01', col, row);
        place(door ? 'door_centered_large_01' : 'window_centered_large_01', col, row);
        if (row > 0 && row % 4 === 0) place('cornice_standard_standard_01', col, row);
      }
      for (let col = 0; col < face.columns; col++) place('crown_standard_standard_01', col, b.floors);
    }
  }
  const buildingMatrices = specs.map(() => new THREE.Matrix4()), active=specs.map(()=>false),anchor = new THREE.Object3D(), matrix = new THREE.Matrix4();
  const batches = [];
  for (const bucket of buckets.values()) {
    const batch = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.instances.length);
    batch.name = 'pbr-city-' + bucket.material.name;
    batch.castShadow=true;batch.receiveShadow=true;
    batch.frustumCulled = false; batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < bucket.instances.length; i++) batch.setColorAt(i, specs[bucket.instances[i].building].tint);
    scene.add(batch); batches.push({ batch, instances: bucket.instances });
  }
  const groundTextures=[diffuse.clone(),normal.clone(),roughness.clone()];
  for(const t of groundTextures){ownT(t);t.repeat.set(1,1);}
  const groundRoadMat=ownM(new THREE.MeshStandardMaterial({color:0x858585,map:groundTextures[0],normalMap:groundTextures[1],roughnessMap:groundTextures[2],normalScale:new THREE.Vector2(.3,.3),roughness:1}));
  groundRoadMat.userData.trackFlatGround=true;installTrackWarp(groundRoadMat,distanceUniform);
  const markingMat=ownM(new THREE.MeshStandardMaterial({color:0xd1cbb8,roughness:.85}));markingMat.userData.trackFlatGround=true;installTrackWarp(markingMat,distanceUniform);
  const groundPaint=ownG(new THREE.BoxGeometry(1,1,1));
  function groundRoad(x,z,width,length){
    const g=ownG(new THREE.PlaneGeometry(width,length,4,Math.max(4,Math.ceil(length/3))));
    const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*width/3,uv.getY(i)*length/3);
    const road=new THREE.Mesh(g,groundRoadMat);road.rotation.x=-Math.PI/2;road.position.set(x,-14,z);road.receiveShadow=true;scene.add(road);
  }
  for(const x of[-15,0,15])groundRoad(x,-170,x?7.4:10,620);
  const crossings=[];
  for(let i=0;i<8;i++){
    const g=new THREE.Group();scene.add(g);crossings.push(g);
    const geo=ownG(new THREE.PlaneGeometry(130,8,44,2));
    const uv=geo.attributes.uv;for(let j=0;j<uv.count;j++)uv.setXY(j,uv.getX(j)*130/3,uv.getY(j)*8/3);
    const road=new THREE.Mesh(geo,groundRoadMat);road.rotation.x=-Math.PI/2;road.position.y=-13.99;road.receiveShadow=true;g.add(road);
    const zebra=new THREE.InstancedMesh(groundPaint,markingMat,36);zebra.frustumCulled=false;
    const t=new THREE.Object3D();for(let j=0;j<36;j++){t.position.set((j%12-5.5)*.62+(Math.floor(j/12)-1)*15,-13.965,0);t.scale.set(.33,.012,5.4);t.updateMatrix();zebra.setMatrixAt(j,t.matrix);}g.add(zebra);
  }
  // One authored crossing: a thick deck, readable underside beams, four piers
  // outside the driveable road and a real PBR road surface above.
  const crossing=new THREE.Group();crossing.name='representative-overpass';scene.add(crossing);
  const depthMat=ownM(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}));installTrackWarp(depthMat,distanceUniform);
  function structureBox(x,y,z,w,h,d,material=concreteMaterial){
    const o=new THREE.Mesh(unitBox,material);o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=true;o.receiveShadow=true;o.customDepthMaterial=depthMat;crossing.add(o);return o;
  }
  structureBox(0,7.8,0,64,1.15,18);
  for(const z of[-8.8,8.8])structureBox(0,8.8,z,64,.9,.35);
  for(const z of[-5.5,5.5])structureBox(0,6.95,z,27,.8,2.4);
  const crossingPiers=[];
  for(const x of[-10.4,10.4])for(const z of[-5.5,5.5]){
    const pier=structureBox(x,-3.8,z,1.7,21,2.3),foot=structureBox(x,-13.9,z,3.4,.6,3.7);crossingPiers.push({pier,foot,z});
  }
  const crossingTextures=[diffuse.clone(),normal.clone(),roughness.clone()];for(const t of crossingTextures){ownT(t);t.repeat.set(1,1);t.offset.set(0,0);}
  const crossingRoadMat=ownM(new THREE.MeshStandardMaterial({color:0xb0b0b0,map:crossingTextures[0],normalMap:crossingTextures[1],roughnessMap:crossingTextures[2],normalScale:new THREE.Vector2(.3,.3),roughness:.95}));installTrackWarp(crossingRoadMat,distanceUniform);
  const crossingSurfaceGeo=ownG(new THREE.PlaneGeometry(64,17.4,22,8));const cuv=crossingSurfaceGeo.attributes.uv;for(let i=0;i<cuv.count;i++)cuv.setXY(i,cuv.getX(i)*64/3,cuv.getY(i)*17.4/3);
  const crossingSurface=new THREE.Mesh(crossingSurfaceGeo,crossingRoadMat);crossingSurface.position.y=8.39;crossingSurface.rotation.x=-Math.PI/2;crossingSurface.receiveShadow=true;crossing.add(crossingSurface);
  function update(distance) {
    if(scene.userData.pbrCity)scene.userData.pbrCity.warpDistance=distance;
    for (const t of roadTextures) t.offset.y = ((distance / 3) % 1 + 1) % 1;
    for(const t of groundTextures)t.offset.y=((distance/3)%1+1)%1;
    for(let i=0;i<crossings.length;i++)crossings[i].position.z=55-i*80+((distance%80)+80)%80;
    const crossingZ=((distance-460+1090)%1240+1240)%1240-1090;crossing.position.z=crossingZ;
    crossing.visible=crossingZ>-410&&crossingZ<65;
    for(const{pier,foot,z}of crossingPiers){const h=trackPoint(0,0,-(crossingZ+z),distance)[1];pier.scale.y=6.55+h+14.3;pier.position.y=(6.55-14.3-h)/2;foot.position.y=-13.9-h;}
    const baseTheta = Math.atan(.45 * Math.cos(distance / 110) + .32 * Math.cos(distance / 53));
    for (let i = 0; i < specs.length; i++) {
      const b = specs[i];
      const sceneZ = ((b.z + distance + 1090) % 1240 + 1240) % 1240 - 1090;
      active[i]=sceneZ>(b.street?-390:-510)&&sceneZ<65;
      const s = distance - sceneZ;
      anchor.position.fromArray(trackPoint(b.x, -13.85, -sceneZ, distance));
      anchor.position.y=-13.85;
      anchor.rotation.set(0, b.yaw + baseTheta - Math.atan(.45 * Math.cos(s / 110) + .32 * Math.cos(s / 53)), 0);
      anchor.scale.set(1, 1, 1); anchor.updateMatrix(); buildingMatrices[i].copy(anchor.matrix);
    }
    for (const { batch, instances } of batches) {
      let visibleCount=0;
      for (let i = 0; i < instances.length; i++) {
        const item=instances[i];if(!active[item.building])continue;
        matrix.multiplyMatrices(buildingMatrices[item.building],item.local);batch.setMatrixAt(visibleCount,matrix);
        batch.setColorAt(visibleCount,specs[item.building].tint);visibleCount++;
      }
      batch.count=visibleCount;batch.visible=visibleCount>0;
      batch.instanceMatrix.needsUpdate = true;
      batch.instanceColor.needsUpdate=true;
    }
  }
  scene.userData.pbrCity = { buildings:16,streetBlocks:specs.filter(b=>b.street).length,sourceTriangles:3245,batches:batches.length,cells:[...buckets.values()].reduce((n,b)=>n+b.instances.length,0),roadTexelSizeMetres:3,hdr:'Qwantani Sunset Pure Sky 2K',rigidBuildings:true,routePeriodMetres:1240,flatCityGround:true,detailVisibilityMetres:[-510,65],streetVisibilityMetres:[-390,65],regions:[{from:0,to:190,form:'close street canyon and authored corners'},{from:190,to:400,form:'setback Bistro bend'},{from:400,to:600,form:'left low roofs and bridge / right wall'},{from:600,to:860,form:'left authored streets / right lower roofs and skyline'}],crossing:{atMetres:460,undersideHeight:6.55,deckThickness:1.15}};
  update(0);
  return { update, dispose: () => environment.dispose() };
}
