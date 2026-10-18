// Arcade vehicle contact presentation. No input, scoring or collision writes.
// THREE and resource ownership are provided by the existing world renderer.
export function contactPaddingX(rawX,playerX,side,heroSideReach,trafficHalfWidth,padding=.025){
 const direction=Math.sign(side)||1,minimum=heroSideReach+trafficHalfWidth+padding;
 return playerX+direction*Math.max(minimum,direction*(rawX-playerX));
}
export function createCombatVisuals({THREE,scene,ownG,ownM,ownT,installTrackWarp,distanceUniform,heroSupportCenterY}){
 if(!Number.isFinite(heroSupportCenterY))throw Error('Combat visuals require the actual hero support centre');
 const dummy=new THREE.Object3D(),color=new THREE.Color(),damageMaterials=new WeakSet();
 const radialCanvas=document.createElement('canvas');radialCanvas.width=radialCanvas.height=64;
 const context=radialCanvas.getContext('2d'),gradient=context.createRadialGradient(32,32,0,32,32,31);
 gradient.addColorStop(0,'rgba(255,255,255,.75)');gradient.addColorStop(.48,'rgba(255,255,255,.28)');gradient.addColorStop(1,'rgba(255,255,255,0)');context.fillStyle=gradient;context.fillRect(0,0,64,64);
 const soft=ownT(new THREE.CanvasTexture(radialCanvas));
 const jetTime={value:0},plumes=new THREE.Group();plumes.name='continuous-nitro-plumes';plumes.visible=false;
 const plumeGeometry=ownG(new THREE.CylinderGeometry(.022,.155,1,18,14,true));plumeGeometry.rotateX(Math.PI/2);plumeGeometry.translate(0,0,.5);
 const plumeMeshes=[];
 function jetMaterial(colorValue,opacity){
  const material=ownM(new THREE.MeshBasicMaterial({color:colorValue,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending,toneMapped:false}));
  material.onBeforeCompile=shader=>{
   shader.uniforms.uNitroTime=jetTime;
   shader.vertexShader='uniform float uNitroTime; varying vec3 vNitroLocal;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vNitroLocal=position;transformed.xy*=1.0+.08*sin(position.z*38.0-uNitroTime*50.0);`);
   shader.fragmentShader='uniform float uNitroTime; varying vec3 vNitroLocal;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float jetT=clamp(vNitroLocal.z,0.0,1.0);
    float jetPulse=.8+.2*sin(jetT*48.0-uNitroTime*55.0+atan(vNitroLocal.y,vNitroLocal.x)*3.0);
    diffuseColor.a*=pow(1.0-jetT,1.3)*jetPulse;`);
  };
  material.customProgramCacheKey=()=> 'r6-continuous-thrust-1';installTrackWarp(material,distanceUniform);return material;
 }
 const jetOuter=jetMaterial(0x31bfff,.32),jetCore=jetMaterial(0xd8faff,.58);
 for(const x of[-.48,.48])for(const core of[false,true]){const mesh=new THREE.Mesh(plumeGeometry,core?jetCore:jetOuter);mesh.position.set(x,.25-heroSupportCenterY,1.88);mesh.userData.core=core;plumes.add(mesh);plumeMeshes.push(mesh);}
 function fadeMaterial(options){
  const material=ownM(new THREE.MeshBasicMaterial({...options,transparent:true,depthWrite:false,toneMapped:false}));
  material.onBeforeCompile=shader=>{
   shader.vertexShader='attribute float aCombatFade; varying float vCombatFade;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCombatFade=aCombatFade;');
   shader.fragmentShader='varying float vCombatFade;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vCombatFade;');
  };
  material.customProgramCacheKey=()=> 'r6-contact-fade-1';installTrackWarp(material,distanceUniform);return material;
 }
 function batch(name,geometry,material,capacity){
  const g=ownG(geometry),fade=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);g.setAttribute('aCombatFade',fade);
  const mesh=new THREE.InstancedMesh(g,material,capacity);mesh.name=name;mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);return{mesh,fade,capacity,count:0};
 }
 const spark=batch('contact-orange-sparks',new THREE.BoxGeometry(1,1,1),fadeMaterial({color:0xffdca2,blending:THREE.AdditiveBlending}),256);
 const debris=batch('knockdown-body-fragments',new THREE.BoxGeometry(1,1,.16),fadeMaterial({color:0xb9c4c9}),96);
 const smoke=batch('wreck-soft-smoke',new THREE.PlaneGeometry(1,1),fadeMaterial({color:0x29343b,map:soft,side:THREE.DoubleSide,forceSinglePass:true}),72);
 const skid=batch('wreck-tire-skids',new THREE.PlaneGeometry(1,1),fadeMaterial({color:0x101820,opacity:.38,side:THREE.DoubleSide,forceSinglePass:true}),24);
 const batches=[spark,debris,smoke,skid];
 function put(b,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,opacity=1,tint=0xffffff){
  if(b.count>=b.capacity)return;dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
  b.mesh.setMatrixAt(b.count,dummy.matrix);b.mesh.setColorAt(b.count,color.set(tint));b.fade.setX(b.count,opacity);b.count++;
 }
 function installDamage(material){
  if(damageMaterials.has(material))return;damageMaterials.add(material);
  const old=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=function(shader,renderer){
   old.call(this,shader,renderer);
   const fragment=!material.isMeshDepthMaterial;
   shader.vertexShader='attribute float aCombatDamage; attribute float aCombatSide;\n'+(fragment?'varying vec3 vCombatLocal; varying float vCombatDent; varying float vCombatSide;\n':'')+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float combatSide=aCombatSide<0.0?-1.0:1.0;
    float combatMask=smoothstep(.1,.78,transformed.x*combatSide);
    float combatLength=1.0-smoothstep(.65,1.55,abs(transformed.z-.2));
    transformed.x-=combatSide*aCombatDamage*.24*combatMask*combatLength;
    transformed.y-=aCombatDamage*.09*combatMask*combatLength*smoothstep(.3,.8,transformed.y);
    ${fragment?'vCombatLocal=transformed;vCombatDent=aCombatDamage;vCombatSide=combatSide;':''}`);
   if(fragment){
    shader.fragmentShader='varying vec3 vCombatLocal; varying float vCombatDent; varying float vCombatSide;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
     float scrapeSide=smoothstep(.4,.82,vCombatLocal.x*vCombatSide);
     float scrapeHeight=1.0-smoothstep(.15,.34,abs(vCombatLocal.y-.49));
     float scratchAA=max(fwidth(vCombatLocal.y),.006);
     float scratchA=1.0-smoothstep(.008,.018+scratchAA,abs(vCombatLocal.y-.43-.018*sin(vCombatLocal.z*2.8)));
     float scratchB=1.0-smoothstep(.006,.014+scratchAA,abs(vCombatLocal.y-.55+.024*sin(vCombatLocal.z*2.1)));
     float scrapePatch=vCombatDent*scrapeSide*scrapeHeight;
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.07,.085,.095),scrapePatch*.64);
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.36,.39,.40),scrapePatch*max(scratchA,scratchB*.7)*.68);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,scrapePatch*.8);');
   }
  };
  material.customProgramCacheKey=()=>key()+'|r6-source-body-dent-1';material.needsUpdate=true;
 }
 function bindTraffic(geometry,material,depth,capacity=64){
  const damage=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1),side=new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(1),1);
  geometry.setAttribute('aCombatDamage',damage);geometry.setAttribute('aCombatSide',side);installDamage(material);installDamage(depth);return{damage,side};
 }
 function update({effects=[],entities=[],time=0,camera,nitroActive=false,nitroRatio=0}){
  if(!plumes.parent){const source=scene.getObjectByName('hero-electric-jets');if(source)source.add(plumes);}
  jetTime.value=time;plumes.visible=nitroRatio>.04;
  for(const mesh of plumeMeshes){const core=mesh.userData.core,scale=core?.48:1;mesh.scale.set(scale*(.85+nitroRatio*.15),scale,1.1+nitroRatio*.8);}
  for(const b of batches)b.count=0;
  for(const e of effects){
   if(!['scrape','sideSwipe','knockdown','nearMiss','boostBurst'].includes(e.kind))continue;
   const age=Math.max(0,e.age||0),duration=Math.max(.01,e.duration||(e.kind==='knockdown'?1.1:.4)),p=Math.min(1,age/duration);if(p>=1)continue;
   const x=e.x||0,y=e.y??.46,z=-(e.z||0),side=Math.sign(e.side??e.impactSide??1)||1;
   if(e.kind==='scrape'||e.kind==='sideSwipe'||e.kind==='knockdown'){
    const strong=e.kind==='knockdown',count=strong?24:14;
    for(let i=0;i<count;i++){
     const a=i*2.39996,life=1-p,speed=strong?2.6:1.2;
     put(spark,x+Math.cos(a)*p*speed,y+.1+Math.max(0,Math.sin(a))*p*1.3-p*p*.3,z+p*(4.2+i%4*.55),.015+.018*life,.015,.15+life*.28,a,Math.atan2(Math.cos(a)*speed,4.2+i%4*.55),side*.5,life*life,0xffb653);
     if(strong&&i<12){const size=.06+(i%3)*.035;put(debris,x+Math.cos(a)*p*2.1,y+Math.sin(p*Math.PI)*(1+i%3*.35),z+Math.sin(a)*p*2.1,size,size*.7,size*2.1,time*3+a,time*2-a,p*5,life,0x899ea6);}
    }
   }else if(e.kind==='boostBurst'){
    for(let i=0;i<12;i++){const a=i*2.39996,tail=p*(1.5+i%3*.3);put(spark,x+Math.cos(a)*.32,y+Math.sin(a)*.14,z+tail,.018,.018,.22*(1-p)+.06,0,0,0,(1-p)*(1-p),0x83eaff);}
   }else if(e.kind==='nearMiss'){
    for(let i=0;i<5;i++)put(spark,x+side*(.6+i*.04),.45+i*.09,z+.4+p*3+i*.24,.012,.012,.38*(1-p)+.1,0,0,0,1-p,0xb6f4ff);
   }
  }
  for(const e of entities){
   if(!e.wrecked&&e.phase!=='wrecked')continue;
   const age=Math.max(0,e.wreckAge||0),fade=Math.max(0,1-age/2.4),x=Number.isFinite(e.x)?e.x:[-3.2,0,3.2][e.lane??1],z=-(e.z||0),y=e.y||0;
   for(let i=0;i<5;i++){
    const p=(time*.48+i*.2)%1,size=.3+p*.95;
    put(smoke,x+Math.sin(i*3.1)*p*.25,y+.45+p*1.7,z+.3+p*.7,size,size,size,camera.rotation.x,camera.rotation.y,camera.rotation.z,(1-p)*fade*.56,0x27323a);
   }
   for(const offset of[-.55,.55])put(skid,x+offset,.022,z+.5, .13,2.3,1,-Math.PI/2,0,e.wreckYaw??(e.impactSide||1)*Math.min(1.7,age*2.4),fade*.55,0x152027);
  }
  for(const b of batches){b.mesh.count=b.count;b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;b.fade.needsUpdate=true;}
  scene.userData.combatVisuals={nitroActive,nitroRatio,continuousPlumes:plumes.visible,scrapeSparks:spark.count,fragments:debris.count,wreckSmoke:smoke.count,skidMarks:skid.count,damageDeformsActualTrafficGeometry:true};
 }
 return{bindTraffic,update};
}
