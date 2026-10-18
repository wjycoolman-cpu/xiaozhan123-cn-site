// Read-only flight presentation. All resources use the world's existing ownership.
export function createFlightVisuals({THREE,scene,ownG,ownM,installTrackWarp,distanceUniform,reducedMotion=false}){
  const capacity=288,positions=new Float32Array(capacity*3),colors=new Float32Array(capacity*4);
  const geometry=ownG(new THREE.BufferGeometry());
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,4).setUsage(THREE.DynamicDrawUsage));
  const material=ownM(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}));
  installTrackWarp(material,distanceUniform);
  const ribbon=new THREE.Mesh(geometry,material);ribbon.name='flight-wingtip-ribbons';ribbon.frustumCulled=false;scene.add(ribbon);
  const streakMaterial=ownM(new THREE.MeshBasicMaterial({color:0xb7edff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
  installTrackWarp(streakMaterial,distanceUniform);
  const streaks=new THREE.InstancedMesh(ownG(new THREE.BoxGeometry(.012,.012,1)),streakMaterial,28);streaks.name='flight-air-speed-lines';streaks.frustumCulled=false;streaks.count=0;scene.add(streaks);
  const rings=[];const ringGeometry=ownG(new THREE.RingGeometry(.91,1,64));
  for(let i=0;i<6;i++){
    const m=ownM(new THREE.MeshBasicMaterial({color:0x9feaff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}));installTrackWarp(m,distanceUniform);
    const mesh=new THREE.Mesh(ringGeometry,m);mesh.visible=false;scene.add(mesh);rings.push(mesh);
  }
  const history=[],matrix=new THREE.Object3D();let lastTime=-1;
  function update(state,camera){
    const p=state.player||{},time=state.time||0,distance=state.distance||0;
    const running=state.status==='running',air=running&&!p.grounded&&p.y>.15,nitro=running?Math.max(0,p.nitroRatio||0):0;
    if(time<lastTime||state.status==='menu'||state.status==='intro')history.length=0;
    if(running&&time!==lastTime){
      if(air)history.unshift({x:p.x,y:p.y+.5,distance,roll:p.roll||0,time});
      while(history.length>25||history.length&&time-history.at(-1).time>.44)history.pop();
    }
    lastTime=time;let count=0;
    function vertex(point,side,width,alpha){
      const i=count++;positions[i*3]=point.x+side*.91*Math.cos(point.roll)+width;
      positions[i*3+1]=point.y+side*.91*Math.sin(point.roll);
      positions[i*3+2]=distance-point.distance+1.15;
      colors[i*4]=.43;colors[i*4+1]=.84;colors[i*4+2]=1;colors[i*4+3]=alpha;
    }
    const tailLimit=camera?.aspect<.85?4.2:2.7;
    for(const side of[-1,1])for(let i=0;i<history.length-1;i++){
      const a=history[i],b=history[i+1],wa=.025+nitro*.025;
      const za=distance-a.distance+1.15,zb=distance-b.distance+1.15;
      if(za>tailLimit||zb>tailLimit||za<-3.5||zb<-3.5)continue;
      const fade=z=>Math.pow(Math.max(0,1-Math.abs(z-1.15)/(tailLimit-1.15)),1.4)*.55;
      const aa=fade(za),ab=fade(zb);
      vertex(a,side,-wa,aa);vertex(b,side,-wa,ab);vertex(a,side,wa,aa);
      vertex(a,side,wa,aa);vertex(b,side,-wa,ab);vertex(b,side,wa,ab);
    }
    geometry.setDrawRange(0,count);geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;
    ribbon.visible=!reducedMotion&&running&&count>0;
    streaks.count=!reducedMotion&&running&&(air||nitro>.08)?28:0;streakMaterial.opacity=.06+nitro*.16;
    for(let i=0;i<streaks.count;i++){
      const side=i%2?1:-1,phase=(time*(18+Math.abs(state.speed||0)*.72)+i*2.791)%28;
      matrix.position.set(side*(3.9+(i%5)*.44),.8+(i%7)*.57,-31+phase);
      matrix.rotation.set(0,0,side*.06);matrix.scale.set(1,1,.38+nitro*1.3+(air?.4:0));matrix.updateMatrix();streaks.setMatrixAt(i,matrix.matrix);
    }
    if(streaks.count)streaks.instanceMatrix.needsUpdate=true;
    const pulses=(state.effects||[]).filter(e=>e.kind==='land'&&e.age<e.duration).slice(-6);
    rings.forEach((ring,i)=>{const e=pulses[i];ring.visible=running&&!!e;if(!e)return;const t=Math.min(1,e.age/e.duration),land=e.kind==='land';ring.position.set(e.x,land?.035:(e.y+.5),-(e.z||0));ring.rotation.set(land?-Math.PI/2:0,0,0);ring.scale.setScalar(.65+t*1.8);ring.material.opacity=(1-t)*(land?.15:.35);});
    scene.userData.flightVisuals={wingtipVertices:count,speedLines:streaks.count,retreat:p.retreatTimer>0,history:history.length};
  }
  return{update};
}
