import * as THREE from './vendor/three.module.js';

// Licensed photographic cloud detail, with an art-directed dusk transfer in
// linear light. The same result is prefiltered for PBR, not a screen image.
export function createDuskSky({photo,dayPhoto,ownG,ownM}){
 const image=photo.image,decode=photo.type===THREE.HalfFloatType?THREE.DataUtils.fromHalfFloat:value=>value,logValues=[];
 for(let y=0;y<image.height/2;y+=8)for(let x=0;x<image.width;x+=8){
  const i=(y*image.width+x)*4,luma=decode(image.data[i])*.2126+decode(image.data[i+1])*.7152+decode(image.data[i+2])*.0722;
  if(luma>1e-6&&Number.isFinite(luma))logValues.push(Math.log2(luma));
 }
 logValues.sort((a,b)=>a-b);
 const low=logValues[Math.floor(logValues.length*.10)]??-2,high=Math.max(low+.25,logValues[Math.floor(logValues.length*.90)]??1);
 const material=ownM(new THREE.ShaderMaterial({
  name:'PhotographicDuskSky',side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{skyPhoto:{value:photo},dayPhoto:{value:dayPhoto},daylight:{value:1},photoRotation:{value:3.35},cloudLogRange:{value:new THREE.Vector2(low,high)},sunAzimuth:{value:new THREE.Vector2(-62,-90).normalize()}},
  vertexShader:'varying vec3 vSkyRay;void main(){vec4 wp=modelMatrix*vec4(position,1.0);vSkyRay=wp.xyz-cameraPosition;gl_Position=projectionMatrix*viewMatrix*wp;}',
  fragmentShader:`
   uniform sampler2D skyPhoto;uniform sampler2D dayPhoto;uniform float daylight;uniform float photoRotation;uniform vec2 cloudLogRange;uniform vec2 sunAzimuth;varying vec3 vSkyRay;
   void main(){
    vec3 ray=normalize(vSkyRay);float c=cos(photoRotation),s=sin(photoRotation);
    vec3 photoRay=vec3(c*ray.x-s*ray.z,ray.y,s*ray.x+c*ray.z);
    // Bring the source's high thin cloud bank into the driving view; hue and
    // horizon placement still follow the actual view ray, independently.
    float photoElevation=clamp(photoRay.y*.9+.40,0.0,.995);
    vec2 uv=vec2(atan(photoRay.z,photoRay.x)*.15915494309+.5,asin(photoElevation)*.31830988618+.5);
    vec3 source=texture2D(skyPhoto,uv).rgb;
    float luma=dot(source,vec3(.2126,.7152,.0722));
    float lumaDetail=smoothstep(cloudLogRange.x,cloudLogRange.y,log2(max(luma,.00001)));
    float cloudWhiteness=source.r/max(source.b,.00001);
    float cloudDetail=mix(lumaDetail,smoothstep(.28,.68,cloudWhiteness),.85);
    vec3 upper=mix(vec3(.10,.16,.25),vec3(.30,.39,.52),cloudDetail);
    upper*=mix(1.12,.80,smoothstep(0.0,.75,max(0.0,ray.y)));
    float sunFacing=max(0.0,dot(normalize(ray.xz+vec2(.00001)),sunAzimuth));
    float warmBand=exp(-max(0.0,ray.y)*11.0)*(.24+.76*sunFacing*sunFacing);
    vec3 horizon=mix(vec3(.75,.30,.13),vec3(1.5,.65,.28),cloudDetail);
    vec3 color=mix(upper,horizon,warmBand);
    color=mix(color,vec3(.045,.052,.075),1.0-smoothstep(-.4,-.02,ray.y));
    // A separate licensed midday HDR supplies true daytime color and sun.
    // Match its measured sun azimuth/elevation to the directional key light.
    float dc=cos(2.77),ds=sin(2.77);
    vec3 dayRay=vec3(dc*ray.x-ds*ray.z,ray.y,ds*ray.x+dc*ray.z);
    vec2 dayUv=vec2(atan(dayRay.z,dayRay.x)*.15915494309+.5,asin(clamp(dayRay.y,-1.0,1.0))*.31830988618+.5);
    vec3 dayColor=min(texture2D(dayPhoto,dayUv).rgb,vec3(20.0));
    color=mix(color,dayColor,daylight);
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 }));
 material.userData.trackWarpExempt=true;
 material.userData.cloudLogRange=[low,high];
 const mesh=new THREE.Mesh(ownG(new THREE.SphereGeometry(500,32,16)),material);
 mesh.name='photographic-dusk-atmosphere';mesh.frustumCulled=false;mesh.renderOrder=-100;
 return mesh;
}

