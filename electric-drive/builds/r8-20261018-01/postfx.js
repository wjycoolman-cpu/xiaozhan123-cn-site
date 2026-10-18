import * as THREE from './vendor/three.module.js';
import {EffectComposer} from './vendor/postfx/postprocessing/EffectComposer.js';
import {UnrealBloomPass} from './vendor/postfx/postprocessing/UnrealBloomPass.js';
import {OutputPass} from './vendor/postfx/postprocessing/OutputPass.js';
import {ShaderPass} from './vendor/postfx/postprocessing/ShaderPass.js';
import {FXAAShader} from './vendor/postfx/shaders/FXAAShader.js';
import {N8AOPass} from './vendor/postfx/N8AO.js';

// Real beauty/depth from the same displaced materials. No global normal override,
// so rigid city anchors, instanced vehicle dents and the curved road stay aligned.
export function createPostFX({renderer,scene,camera}){
 const composer=new EffectComposer(renderer),size=new THREE.Vector2();renderer.getSize(size);
 const ao=new N8AOPass(scene,camera,size.x,size.y);ao.setQualityMode('Medium');
 Object.assign(ao.configuration,{aoRadius:1.65,distanceFalloff:.8,intensity:3.2,gammaCorrection:false,halfRes:true,accumulate:false});
 ao.configuration.color=new THREE.Color(0x111621);
 composer.addPass(ao);
 const bloom=new UnrealBloomPass(size,.18,.28,1.80);
 // The sky's HDR sun is intentionally very bright. It must never seed a
 // screen-filling glow; use the exact scene depth and cap extracted energy.
 bloom.materialHighPassFilter.uniforms.tSceneDepth={value:ao.beautyRenderTarget.depthTexture};
 bloom.materialHighPassFilter.fragmentShader=bloom.materialHighPassFilter.fragmentShader
  .replace('uniform sampler2D tDiffuse;','uniform sampler2D tDiffuse;\nuniform sampler2D tSceneDepth;')
  .replace('vec4 texel = texture2D( tDiffuse, vUv );','vec4 texel = texture2D( tDiffuse, vUv );\ntexel.rgb=min(texel.rgb,vec3(6.0));')
  .replace('gl_FragColor = mix( outputColor, texel, alpha );','alpha*=1.0-step(.99999,texture2D(tSceneDepth,vUv).x);\ngl_FragColor = mix( outputColor, texel, alpha );');
 bloom.materialHighPassFilter.needsUpdate=true;composer.addPass(bloom);
 const finish=new ShaderPass({uniforms:{tDiffuse:{value:null},strength:{value:0},time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`
  uniform sampler2D tDiffuse;uniform float strength;uniform float time;varying vec2 vUv;
  void main(){
   vec2 p=vUv-.5;float edge=smoothstep(.29,.68,length(p));
   vec2 drift=p*strength*edge*.0018;
   vec3 c=texture2D(tDiffuse,vUv).rgb;
   c.r=mix(c.r,texture2D(tDiffuse,vUv+drift).r,strength*edge*.35);
   c.b=mix(c.b,texture2D(tDiffuse,vUv-drift).b,strength*edge*.35);
   float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.065);
   c*=1.0-smoothstep(.20,.75,length(p))*.085;
   gl_FragColor=vec4(max(c,vec3(0.0)),1.0);
  }`});composer.addPass(finish);
 const output=new OutputPass();composer.addPass(output);
 const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);
 let enabled=true,lastWidth=0,lastHeight=0;
 const info={enabled:true,ao:'N8AO 2.0.1 / half resolution / Medium',radiusMetres:1.65,intensity:3.2,bloom:{threshold:1.8,strength:.18,radius:.28,skyExcludedBySceneDepth:true,maximumExtractedRadiance:6},colorPipeline:'linear HDR -> AO -> depth-masked high-threshold bloom -> mild chroma/vignette -> ACES+SRGB exactly once -> FXAA',depth:'original beauty materials; no normal override',temporalAccumulation:false};
 scene.userData.postFX=info;
 function resize(width,height){
  if(width===lastWidth&&height===lastHeight)return;lastWidth=width;lastHeight=height;
  composer.setSize(width,height);const pixelRatio=renderer.getPixelRatio();fxaa.uniforms.resolution.value.set(1/(width*pixelRatio),1/(height*pixelRatio));
 }
 function render(state,dt){
  if(!enabled){renderer.render(scene,camera);return;}
  finish.uniforms.strength.value=state.status==='running'?Math.max(0,Math.min(1,state.player?.nitroRatio||0)):0;
  finish.uniforms.time.value=state.time||0;
  const oldAutoReset=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();
  try{composer.render(Math.min(.05,Math.max(0,dt||0)));info.drawCalls=renderer.info.render.calls;info.triangles=renderer.info.render.triangles;}finally{renderer.info.autoReset=oldAutoReset;}
 }
 function configure(values={}){
  if(values.enabled!==undefined){enabled=!!values.enabled;info.enabled=enabled;}
  if(values.ao!==undefined)ao.configuration.intensity=values.ao?3.2:0;
  if(values.bloom!==undefined)bloom.enabled=!!values.bloom;
  if(values.finish!==undefined)finish.enabled=!!values.finish;
  if(values.debugAO!==undefined){ao.setDisplayMode(values.debugAO?'AO':'Combined');bloom.enabled=!values.debugAO;finish.enabled=!values.debugAO;}
 }
 resize(size.x,size.y);
 return{render,resize,configure,dispose(){
  const owned=new Set();for(const value of Object.values(ao)){
   if(!value)continue;
   if(value.isWebGLRenderTarget||value.isRenderTarget||value.isTexture||value.isMaterial)owned.add(value);
   if(value._mesh?.geometry)owned.add(value._mesh.geometry);
   if(value.material){for(const m of(Array.isArray(value.material)?value.material:[value.material]))if(m.isMaterial)owned.add(m);}
  }
  for(const resource of owned)resource.dispose();
  bloom.materialHighPassFilter.dispose();bloom.dispose();finish.dispose();output.dispose();fxaa.dispose();composer.dispose();
 }};
}
