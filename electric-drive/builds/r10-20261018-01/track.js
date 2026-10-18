// Road-space deformation shared by every rendered participant and the camera.
// Core collision coordinates stay (lane x, height y, forward z).
export function trackPoint(x,y,z,d){
  const s=d+z,theta=Math.atan(.45*Math.cos(d/110)+.32*Math.cos(d/53));
  const slope=.45*Math.cos(s/110)+.32*Math.cos(s/53),n=1/Math.sqrt(1+slope*slope);
  const cx=49.5*(Math.sin(s/110)-Math.sin(d/110))+16.96*(Math.sin(s/53)-Math.sin(d/53));
  const h=4.2*(Math.sin(s/100)-Math.sin(d/100))+1.8*(Math.sin(s/43)-Math.sin(d/43));
  const wx=cx+x*n,wz=-z+x*slope*n;
  return [Math.cos(theta)*wx+Math.sin(theta)*wz,y+h,-Math.sin(theta)*wx+Math.cos(theta)*wz];
}
export function trackJacobian(x,y,sceneZ,d){
 const s=d-sceneZ,a=.45*Math.cos(s/110)+.32*Math.cos(s/53);
 const b=-.45/110*Math.sin(s/110)-.32/53*Math.sin(s/53),n=1/Math.sqrt(1+a*a);
 const h=.042*Math.cos(s/100)+1.8/43*Math.cos(s/43);
 const t=Math.atan(.45*Math.cos(d/110)+.32*Math.cos(d/53)),c=Math.cos(t),q=Math.sin(t);
 const rotate=v=>[c*v[0]+q*v[2],v[1],-q*v[0]+c*v[2]];
 return [rotate([n,0,a*n]),[0,1,0],rotate([-a+x*a*b*n*n*n,-h,1-x*b*n*n*n])];
}
const GLSL=`
uniform float uTrackDistance;
vec3 trackWarp(vec3 p){
 float d=uTrackDistance,z=-p.z,s=d+z;
 float theta=atan(.45*cos(d/110.0)+.32*cos(d/53.0));
 float slope=.45*cos(s/110.0)+.32*cos(s/53.0),n=inversesqrt(1.0+slope*slope);
 float cx=49.5*(sin(s/110.0)-sin(d/110.0))+16.96*(sin(s/53.0)-sin(d/53.0));
 float h=4.2*(sin(s/100.0)-sin(d/100.0))+1.8*(sin(s/43.0)-sin(d/43.0));
 #ifdef TRACK_FLAT_GROUND
  h=0.0;
 #endif
 float wx=cx+p.x*n,wz=p.z+p.x*slope*n;
 return vec3(cos(theta)*wx+sin(theta)*wz,p.y+h,-sin(theta)*wx+cos(theta)*wz);
}
mat3 trackJacobian(vec3 p){
 float d=uTrackDistance,s=d-p.z;
 float a=.45*cos(s/110.0)+.32*cos(s/53.0);
 float b=-.45/110.0*sin(s/110.0)-.32/53.0*sin(s/53.0);
 float n=inversesqrt(1.0+a*a),n3=n*n*n;
 float h=.042*cos(s/100.0)+1.8/43.0*cos(s/43.0);
 #ifdef TRACK_FLAT_GROUND
  h=0.0;
 #endif
 float t=atan(.45*cos(d/110.0)+.32*cos(d/53.0)),c=cos(t),q=sin(t);
 mat3 rotation=mat3(c,0.0,-q,0.0,1.0,0.0,q,0.0,c);
 return rotation*mat3(vec3(n,0.0,a*n),vec3(0.0,1.0,0.0),vec3(-a+p.x*a*b*n3,-h,1.0-p.x*b*n3));
}
vec3 trackInverseTransposeNormal(mat3 j,vec3 n){
 vec3 a=cross(j[1],j[2]),b=cross(j[2],j[0]),c=cross(j[0],j[1]);
 float determinant=dot(j[0],a);
 float safeDet=abs(determinant)<0.00001?(determinant<0.0?-0.00001:0.00001):determinant;
 return (a*n.x+b*n.y+c*n.z)/safeDet;
}
`;
export function installTrackWarp(material,distanceUniform){
 if(material.userData.trackWarp || material.userData.trackWarpExempt || material.isShaderMaterial || material.isSpriteMaterial || material.fog===false)return;
 material.userData.trackWarp=true;
 const oldCompile=material.onBeforeCompile,oldKey=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=function(shader,renderer){
  oldCompile.call(this,shader,renderer);shader.uniforms.uTrackDistance=distanceUniform;
  shader.vertexShader=(material.userData.trackFlatGround?'#define TRACK_FLAT_GROUND\n':'')+GLSL+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
   vec4 normalTrackRaw=vec4(position,1.0);
   #ifdef USE_BATCHING
    normalTrackRaw=batchingMatrix*normalTrackRaw;
   #endif
   #ifdef USE_INSTANCING
    normalTrackRaw=instanceMatrix*normalTrackRaw;
   #endif
   normalTrackRaw=modelMatrix*normalTrackRaw;
   mat3 roadJacobian=trackJacobian(normalTrackRaw.xyz);
   mat3 viewRotation=mat3(viewMatrix);
   vec3 normalBeforeRoad=transpose(viewRotation)*transformedNormal;
   transformedNormal=normalize(viewRotation*trackInverseTransposeNormal(roadJacobian,normalBeforeRoad));
   #ifdef USE_TANGENT
    vec3 tangentBeforeRoad=transpose(viewRotation)*transformedTangent;
    vec3 tangentAfterRoad=viewRotation*(roadJacobian*tangentBeforeRoad);
    transformedTangent=normalize(tangentAfterRoad-transformedNormal*dot(tangentAfterRoad,transformedNormal));
   #endif`);
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   vec4 trackRaw=vec4(transformed,1.0);
   #ifdef USE_BATCHING
    trackRaw=batchingMatrix*trackRaw;
   #endif
   #ifdef USE_INSTANCING
    trackRaw=instanceMatrix*trackRaw;
   #endif
   trackRaw=modelMatrix*trackRaw;
   vec3 trackWarpedPosition=trackWarp(trackRaw.xyz);
   vec4 mvPosition=viewMatrix*vec4(trackWarpedPosition,1.0);
   gl_Position=projectionMatrix*mvPosition;`);
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','vec4 worldPosition=vec4(trackWarpedPosition,1.0);');
 };
 material.customProgramCacheKey=()=>oldKey()+'|shared-road-space-r3-jacobian-1'+(material.userData.trackFlatGround?'|flat-ground':'');material.needsUpdate=true;
}
