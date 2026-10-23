/* Fluid solver adapted from WebGL Fluid Simulation, Copyright (c) 2017 Pavel
 * Dobryakov, MIT. Full original license and modification notes: LICENSE-NOTICES.
 * Advection / curl / vorticity / Jacobi pressure / gradient projection are real
 * simulation passes. Keyboard source shapes, buoyancy and material are new. */
(function () {
'use strict';
const VERT = `precision highp float;
attribute vec2 aPosition; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
uniform vec2 texelSize;
void main(){vUv=aPosition*.5+.5;vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);gl_Position=vec4(aPosition,0.,1.);}`;
const HEAD = `precision highp float; precision highp sampler2D;
varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
uniform vec2 texelSize;
`;
const SHADERS = {
copy: `uniform sampler2D uSource; uniform float value; void main(){gl_FragColor=texture2D(uSource,vUv)*value;}`,
advect: `uniform sampler2D uVelocity;uniform sampler2D uSource;uniform vec2 sourceTexel;uniform float dt;uniform float decay;
vec4 bilerp(sampler2D s,vec2 uv,vec2 ts){vec2 p=uv/ts-.5;vec2 i=floor(p);vec2 f=fract(p);return mix(mix(texture2D(s,(i+vec2(.5,.5))*ts),texture2D(s,(i+vec2(1.5,.5))*ts),f.x),mix(texture2D(s,(i+vec2(.5,1.5))*ts),texture2D(s,(i+vec2(1.5,1.5))*ts),f.x),f.y);}
void main(){vec2 p=vUv-dt*bilerp(uVelocity,vUv,texelSize).xy*texelSize;gl_FragColor=bilerp(uSource,p,sourceTexel)/(1.+decay*dt);}`,
curl: `uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).y;float R=texture2D(uVelocity,vR).y;float T=texture2D(uVelocity,vT).x;float B=texture2D(uVelocity,vB).x;gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.);}`,
vorticity: `uniform sampler2D uVelocity;uniform sampler2D uCurl;uniform float dt;uniform float curl;void main(){float L=texture2D(uCurl,vL).x;float R=texture2D(uCurl,vR).x;float T=texture2D(uCurl,vT).x;float B=texture2D(uCurl,vB).x;float C=texture2D(uCurl,vUv).x;vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+.0001;f*=curl*C;f.y*=-1.;vec2 v=texture2D(uVelocity,vUv).xy+f*dt;gl_FragColor=vec4(clamp(v,vec2(-450.),vec2(450.)),0.,1.);}`,
divergence: `uniform sampler2D uVelocity;void main(){vec2 C=texture2D(uVelocity,vUv).xy;float L=vL.x<0.?-C.x:texture2D(uVelocity,vL).x;float R=vR.x>1.?-C.x:texture2D(uVelocity,vR).x;float T=vT.y>1.?-C.y:texture2D(uVelocity,vT).y;float B=vB.y<0.?-C.y:texture2D(uVelocity,vB).y;gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.);}`,
pressure: `uniform sampler2D uPressure;uniform sampler2D uDivergence;void main(){float L=texture2D(uPressure,vL).x;float R=texture2D(uPressure,vR).x;float T=texture2D(uPressure,vT).x;float B=texture2D(uPressure,vB).x;float d=texture2D(uDivergence,vUv).x;gl_FragColor=vec4((L+R+T+B-d)*.25,0.,0.,1.);}`,
gradient: `uniform sampler2D uPressure;uniform sampler2D uVelocity;void main(){float L=texture2D(uPressure,vL).x;float R=texture2D(uPressure,vR).x;float T=texture2D(uPressure,vT).x;float B=texture2D(uPressure,vB).x;vec2 v=texture2D(uVelocity,vUv).xy-vec2(R-L,T-B);gl_FragColor=vec4(v,0.,1.);}`,
force: `uniform sampler2D uVelocity;uniform sampler2D uDye;uniform float dt;uniform float time;uniform float mode;uniform float buoyancy;uniform float aspect;
void main(){vec2 v=texture2D(uVelocity,vUv).xy;vec3 dye=texture2D(uDye,vUv).rgb;float d=max(dye.r,max(dye.g,dye.b));float band=exp(-pow((vUv.y-.22)*4.,2.));
float wave=sin(vUv.y*23.-time*1.8)+.5*sin(vUv.x*29.+time*2.7);vec2 f=vec2(wave*2.,buoyancy*d);
// Fixed spatial phases evolve continuously; only existing smoke receives the
// small curl forces, so this adds neither dye nor a full-screen fog source.
if(mode>.5&&mode<1.5){vec2 q=vUv*vec2(aspect,1.);vec2 a=q*42.+vec2(time*.7,-time*.9);vec2 b=q*79.+vec2(-time*.43+.73,time*.61+1.37);vec2 e=6.*vec2(sin(a.x)*cos(a.y),-cos(a.x)*sin(a.y))+3.*vec2(sin(b.x)*cos(b.y),-cos(b.x)*sin(b.y));f+=e*smoothstep(0.,.15,d);}
if(mode>1.5&&mode<2.5){f.x+=sin(time*2.+vUv.y*35.)*15.*band;f.y+=6.*band;}
if(mode>2.5&&mode<3.5){f.x+=sin(vUv.y*40.-time*3.)*18.*band;f.y+=d*45.;}
if(mode>3.5&&mode<4.5){vec2 p=(vUv-vec2(.5,.36))*vec2(aspect,1.);f+=vec2(-p.y,p.x)*36./(.09+dot(p,p));}
if(mode>4.5&&mode<5.5){f.x+=sin(vUv.y*32.+sin(vUv.x*19.)+time)*21.;f.y+=cos(vUv.x*32.+time)*5.;}
if(mode>5.5&&mode<6.5){f+=vec2(sin(vUv.y*45.+time)*10.,sin(vUv.x*35.-time)*6.);}
gl_FragColor=vec4(clamp(v+f*dt,vec2(-400.),vec2(400.)),0.,1.);}`,
splat: `uniform sampler2D uSource;uniform vec2 point;uniform vec3 color;uniform vec2 radius;uniform float phase;uniform float kind;
void main(){vec2 p=(vUv-point)/radius;float r=dot(p,p);float eddy=1.+.16*sin(p.x*5.+phase)*sin(p.y*4.-phase*.6);float a=exp(-r*eddy);gl_FragColor=texture2D(uSource,vUv)+vec4(a*color,0.);}`,
display: `uniform sampler2D uDye;uniform vec2 dyeTexel;uniform float gain;uniform float time;uniform float material;
vec3 dyeAt(vec2 uv){vec2 p=uv/dyeTexel-.5;vec2 i=floor(p);vec2 f=fract(p);return mix(mix(texture2D(uDye,(i+vec2(.5,.5))*dyeTexel).rgb,texture2D(uDye,(i+vec2(1.5,.5))*dyeTexel).rgb,f.x),mix(texture2D(uDye,(i+vec2(.5,1.5))*dyeTexel).rgb,texture2D(uDye,(i+vec2(1.5,1.5))*dyeTexel).rgb,f.x),f.y);}
void main(){vec3 c=dyeAt(vUv);vec3 l=dyeAt(vUv-vec2(dyeTexel.x,0.));vec3 r=dyeAt(vUv+vec2(dyeTexel.x,0.));vec3 t=dyeAt(vUv+vec2(0.,dyeTexel.y));vec3 b=dyeAt(vUv-vec2(0.,dyeTexel.y));
float d=length(c);vec3 n=normalize(vec3(length(l)-length(r),length(b)-length(t),.06));float light=.68+.32*max(dot(n,normalize(vec3(-.4,.7,1.))),0.);float edge=length(r-l)+length(t-b);c*=light;
if(material>1.5&&material<2.5)c+=edge*vec3(.32,.4,.7);
if(material>2.5&&material<3.5)c*=.76+.24*sin(d*10.+time);
vec3 blur=(l+r+t+b)*.25; c+=blur*.18; c=vec3(1.)-exp(-c*gain);c=pow(max(c,vec3(0.)),vec3(.83));float fade=1.-smoothstep(.84,.99,vUv.y);gl_FragColor=vec4(c*fade,1.);}`
};
class GPUFluid {
 constructor(canvas) {
  this.canvas=canvas;this.error='';this.steps=0;this.splats=0;this.resources=[];this.programs={};this.closed=false;
  const opts={alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true,powerPreference:'high-performance'};
  let gl=canvas.getContext('webgl2',opts);this.v2=!!gl;
  if(!gl)gl=canvas.getContext('webgl',opts)||canvas.getContext('experimental-webgl',opts);
  if(!gl)throw Error('WebGL context unavailable');this.gl=gl;
  if(this.v2){gl.getExtension('EXT_color_buffer_float');this.type=gl.HALF_FLOAT;this.internal=gl.RGBA16F;}
  else{const half=gl.getExtension('OES_texture_half_float');gl.getExtension('EXT_color_buffer_half_float');if(!half)throw Error('Half-float textures unavailable');this.type=half.HALF_FLOAT_OES;this.internal=gl.RGBA;}
  this.format=gl.RGBA;this.precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
  if(!this.precision||!this.precision.precision)throw Error('High precision fragment shader unavailable');
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  for(const key in SHADERS)this.programs[key]=this.program(VERT,HEAD+SHADERS[key]);
  const dbg=gl.getExtension('WEBGL_debug_renderer_info');this.renderer=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  this.mode=this.v2?'webgl2-half-float':'webgl1-half-float';this.resize(480,720);
 }
 shader(type,source){const g=this.gl;if(this.v2){source='#version 300 es\n'+source.replace(/attribute /g,'in ').replace(/varying /g,type===g.VERTEX_SHADER?'out ':'in ').replace(/texture2D\(/g,'texture(');if(type===g.FRAGMENT_SHADER)source=source.replace('precision highp float;','precision highp float;\nout vec4 fragColor;').replace(/gl_FragColor/g,'fragColor');}const s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS)){const e=g.getShaderInfoLog(s);g.deleteShader(s);throw Error(e);}return s;}
 program(v,f){const g=this.gl,p=g.createProgram(),vs=this.shader(g.VERTEX_SHADER,v),fs=this.shader(g.FRAGMENT_SHADER,f);g.attachShader(p,vs);g.attachShader(p,fs);g.bindAttribLocation(p,0,'aPosition');g.linkProgram(p);g.deleteShader(vs);g.deleteShader(fs);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));const u={};for(let i=0;i<g.getProgramParameter(p,g.ACTIVE_UNIFORMS);i++){const n=g.getActiveUniform(p,i).name;u[n]=g.getUniformLocation(p,n);}return{p,u};}
 target(w,h){const g=this.gl,t=g.createTexture(),f=g.createFramebuffer();g.bindTexture(g.TEXTURE_2D,t);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texImage2D(g.TEXTURE_2D,0,this.internal,w,h,0,this.format,this.type,null);g.bindFramebuffer(g.FRAMEBUFFER,f);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE){g.deleteTexture(t);g.deleteFramebuffer(f);throw Error('Half-float framebuffer incomplete');}g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);const a={w,h,t,f};this.resources.push(a);return a;}
 pair(w,h){const a={read:this.target(w,h),write:this.target(w,h)};a.swap=()=>{const t=a.read;a.read=a.write;a.write=t;};return a;}
 resize(w,h){this.width=w;this.height=h;const g=this.gl;for(const a of this.resources){g.deleteTexture(a.t);g.deleteFramebuffer(a.f);}this.resources=[];const aspect=w/Math.max(h,1),base=104;let sw,sh;if(aspect>1){sw=Math.round(base*aspect);sh=base;}else{sw=base;sh=Math.round(base/aspect);}sw=Math.min(sw,224);sh=Math.min(sh,224);this.simW=sw;this.simH=sh;
  // Keep pressure/velocity inexpensive while resolving thin density wisps.
  // The long-side cap scales both axes together on unusually wide displays.
  let dw=aspect>1?384*aspect:384,dh=aspect>1?384:384/aspect;const dyeScale=Math.min(1,1024/Math.max(dw,dh));this.dyeW=Math.max(1,Math.round(dw*dyeScale));this.dyeH=Math.max(1,Math.round(dh*dyeScale));
  this.velocity=this.pair(sw,sh);this.dye=this.pair(this.dyeW,this.dyeH);this.pressure=this.pair(sw,sh);this.divergence=this.target(sw,sh);this.curl=this.target(sw,sh);this.clear();}
 bind(name,uniforms,target){const g=this.gl,o=this.programs[name];g.useProgram(o.p);g.bindBuffer(g.ARRAY_BUFFER,this.buffer);g.vertexAttribPointer(0,2,g.FLOAT,false,0,0);g.enableVertexAttribArray(0);let unit=0;for(const k in uniforms){const l=o.u[k];if(l===undefined||l===null)continue;const v=uniforms[k];if(v&&v.t){g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,v.t);g.uniform1i(l,unit++);}else if(Array.isArray(v)){if(v.length===2)g.uniform2f(l,v[0],v[1]);else if(v.length===3)g.uniform3f(l,v[0],v[1],v[2]);else g.uniform4fv(l,v);}else g.uniform1f(l,v);}g.bindFramebuffer(g.FRAMEBUFFER,target?target.f:null);g.viewport(0,0,target?target.w:this.canvas.width,target?target.h:this.canvas.height);g.drawArrays(g.TRIANGLE_STRIP,0,4);}
 clear(){const g=this.gl;for(const a of this.resources){g.bindFramebuffer(g.FRAMEBUFFER,a.f);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);}g.bindFramebuffer(g.FRAMEBUFFER,null);g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT);this.steps=0;this.splats=0;}
 splat(x,y,vx,vy,color,radius,phase){const as=this.width/this.height;const r=[radius/Math.max(as,.2),radius*1.3];this.bind('splat',{uSource:this.velocity.read,point:[x,y],radius:r,color:[vx,vy,0],phase:phase||0},this.velocity.write);this.velocity.swap();this.bind('splat',{uSource:this.dye.read,point:[x,y],radius:r,color,phase:phase||0},this.dye.write);this.dye.swap();this.splats++;}
 step(dt,time,preset){if(this.closed)return;const ts=[1/this.simW,1/this.simH];this.bind('force',{uVelocity:this.velocity.read,uDye:this.dye.read,dt,time,mode:preset.flow,buoyancy:preset.buoyancy,aspect:this.width/this.height},this.velocity.write);this.velocity.swap();this.bind('curl',{texelSize:ts,uVelocity:this.velocity.read},this.curl);this.bind('vorticity',{texelSize:ts,uVelocity:this.velocity.read,uCurl:this.curl,dt,curl:preset.curl},this.velocity.write);this.velocity.swap();this.bind('divergence',{texelSize:ts,uVelocity:this.velocity.read},this.divergence);this.bind('copy',{uSource:this.pressure.read,value:.65},this.pressure.write);this.pressure.swap();for(let i=0;i<12;i++){this.bind('pressure',{texelSize:ts,uPressure:this.pressure.read,uDivergence:this.divergence},this.pressure.write);this.pressure.swap();}this.bind('gradient',{texelSize:ts,uPressure:this.pressure.read,uVelocity:this.velocity.read},this.velocity.write);this.velocity.swap();this.bind('advect',{texelSize:ts,sourceTexel:ts,uVelocity:this.velocity.read,uSource:this.velocity.read,dt,decay:.42},this.velocity.write);this.velocity.swap();this.bind('advect',{texelSize:ts,sourceTexel:[1/this.dyeW,1/this.dyeH],uVelocity:this.velocity.read,uSource:this.dye.read,dt,decay:preset.decay},this.dye.write);this.dye.swap();this.steps++;}
 render(time,preset){this.bind('display',{texelSize:[1/this.dyeW,1/this.dyeH],uDye:this.dye.read,dyeTexel:[1/this.dyeW,1/this.dyeH],gain:preset.gain,time,material:preset.material},null);}
 finish(){this.gl.finish();const e=this.gl.getError();if(e)this.error='GL '+e;return this.error;}
 close(){if(this.closed)return;this.closed=true;const g=this.gl;for(const a of this.resources){g.deleteTexture(a.t);g.deleteFramebuffer(a.f);}for(const k in this.programs)g.deleteProgram(this.programs[k].p);g.deleteBuffer(this.buffer);this.resources=[];}
 inspect(){return{renderer:this.renderer,mode:this.mode,sim:[this.simW,this.simH],dye:[this.dyeW,this.dyeH],steps:this.steps,splats:this.splats,error:this.error,pressureIterations:12,passes:['force','curl','vorticity','divergence','pressure','gradient','velocity-advection','dye-advection']};}
}
// Genuine grid solver for devices lacking a renderable floating-point framebuffer.
// This fallback uses advection and pressure projection; it never substitutes circles.
class CPUFluid {
 constructor(canvas,reason){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.mode='cpu-grid-fallback';this.renderer='CPU stable fluid';this.reason=String(reason);this.error='';this.steps=0;this.splats=0;this.small=document.createElement('canvas');this.small.width=72;this.small.height=104;this.sc=this.small.getContext('2d');this.resize(480,720);}
 resize(w,h){this.width=w;this.height=h;this.w=72;this.h=104;this.n=this.w*this.h;this.u=new Float32Array(this.n);this.v=new Float32Array(this.n);this.r=new Float32Array(this.n);this.g=new Float32Array(this.n);this.b=new Float32Array(this.n);this.p=new Float32Array(this.n);this.q=new Float32Array(this.n);this.div=new Float32Array(this.n);this.temp=new Float32Array(this.n);this.curlField=new Float32Array(this.n);this.oldU=new Float32Array(this.n);this.oldV=new Float32Array(this.n);this.image=this.sc.createImageData(this.w,this.h);this.clear();}
 clear(){for(const k of['u','v','r','g','b','p','q','div','temp','curlField','oldU','oldV'])this[k].fill(0);this.steps=0;this.splats=0;}
 sample(a,x,y){x=Math.max(0,Math.min(this.w-1.001,x));y=Math.max(0,Math.min(this.h-1.001,y));const X=x|0,Y=y|0,fx=x-X,fy=y-Y,i=Y*this.w+X;return(a[i]*(1-fx)+a[i+1]*fx)*(1-fy)+(a[i+this.w]*(1-fx)+a[i+this.w+1]*fx)*fy;}
 splat(x,y,vx,vy,c,radius){const X=x*this.w,Y=(1-y)*this.h,rx=Math.max(1.1,radius*this.w*this.height/this.width),ry=Math.max(1.1,radius*this.h*1.3);for(let yy=Math.max(1,Math.floor(Y-ry*3));yy<Math.min(this.h-1,Y+ry*3);yy++)for(let xx=Math.max(1,Math.floor(X-rx*3));xx<Math.min(this.w-1,X+rx*3);xx++){const a=Math.exp(-(((xx-X)/rx)**2)-((yy-Y)/ry)**2),i=yy*this.w+xx;this.u[i]+=vx*a*.32;this.v[i]-=vy*a*.32;this.r[i]+=c[0]*a;this.g[i]+=c[1]*a;this.b[i]+=c[2]*a;}this.splats++;}
 step(dt,time,p){
 const w=this.w,h=this.h;
 // Mirror GPU buoyancy and vorticity on the compatibility grid. Bounds keep
 // unsupported hardware usable without replacing smoke with dot sprites.
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x,d=Math.max(this.r[i],this.g[i],this.b[i]),nx=x/w,ny=1-y/h;
  let fx=Math.sin(y*.28-time*2)*2,fy=-p.buoyancy*d*.3;
  if(p.flow===2){fx+=Math.sin(time*2+ny*35)*7;fy-=1.8;}
  if(p.flow===3){fx+=Math.sin(ny*40-time*3)*7;fy-=d*13;}
  if(p.flow===4){const px=(nx-.5)*this.width/this.height,py=ny-.36,q=.09+px*px+py*py;fx-=py*10/q;fy-=px*10/q;}
  if(p.flow===5){fx+=Math.sin(ny*32+Math.sin(nx*19)+time)*7;fy-=Math.cos(nx*32+time)*1.5;}
  if(p.flow===6){fx+=Math.sin(ny*45+time)*3;fy-=Math.sin(nx*35-time)*2;}
  this.u[i]+=fx*dt;this.v[i]+=fy*dt;
 }
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;this.curlField[i]=.5*(this.v[i+1]-this.v[i-1]-this.u[i+w]+this.u[i-w]);}
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x,c=this.curlField,dx=.5*(Math.abs(c[i+w])-Math.abs(c[i-w])),dy=.5*(Math.abs(c[i+1])-Math.abs(c[i-1])),len=Math.hypot(dx,dy)+.0001,v=(p.curl||0)*c[i]*dt*.32;
  this.u[i]=Math.max(-120,Math.min(120,this.u[i]+dx/len*v));this.v[i]=Math.max(-120,Math.min(120,this.v[i]-dy/len*v));
 }
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;this.div[i]=-.5*(this.u[i+1]-this.u[i-1]+this.v[i+w]-this.v[i-w]);this.p[i]=0;}
 for(let k=0;k<10;k++){for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;this.q[i]=(this.div[i]+this.p[i-1]+this.p[i+1]+this.p[i-w]+this.p[i+w])*.25;}const q=this.p;this.p=this.q;this.q=q;}
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;this.u[i]-=.5*(this.p[i+1]-this.p[i-1]);this.v[i]-=.5*(this.p[i+w]-this.p[i-w]);}
 const oldU=this.oldU,oldV=this.oldV;oldU.set(this.u);oldV.set(this.v);
 for(const k of['u','v','r','g','b']){const a=this[k],decay=1/(1+dt*(k==='u'||k==='v'?.5:p.decay));for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;this.temp[i]=this.sample(a,x-dt*oldU[i],y-dt*oldV[i])*decay;}const t=this[k];this[k]=this.temp;this.temp=t;}
 this.steps++;
 }
 render(time,p){const data=this.image.data;for(let i=0;i<this.n;i++){const j=i*4;data[j]=255*(1-Math.exp(-this.r[i]*p.gain));data[j+1]=255*(1-Math.exp(-this.g[i]*p.gain));data[j+2]=255*(1-Math.exp(-this.b[i]*p.gain));data[j+3]=255;}this.sc.putImageData(this.image,0,0);this.ctx.imageSmoothingEnabled=true;this.ctx.fillStyle='#000';this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);this.ctx.drawImage(this.small,0,0,this.canvas.width,this.canvas.height);}
 finish(){return'';}close(){}inspect(){return{renderer:this.renderer,mode:this.mode,sim:[this.w,this.h],steps:this.steps,splats:this.splats,error:this.error,fallbackReason:this.reason,pressureIterations:10,passes:['buoyancy','curl','vorticity','divergence','pressure','gradient','advection']};}
}
window.StageFluid={create(canvas){try{return new GPUFluid(canvas);}catch(e){const replacement=document.createElement('canvas');replacement.id=canvas.id;replacement.setAttribute('aria-hidden','true');canvas.replaceWith(replacement);return new CPUFluid(replacement,e.message);}}};
})();
