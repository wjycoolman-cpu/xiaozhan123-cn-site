/* Desktop workspace ownership. Heavy original instruments are imported only on selection. */
const SURFACES=new Set(['piano','calculator','pad','touch','scope','handheld','visualizer','music']);
const SCENES=new Set(['calculator','handheld','visualizer','music']);
const NAMES={piano:'钢琴',calculator:'音乐计算器',pad:'多彩打击垫',touch:'触感乐器',scope:'科学仪器',handheld:'音乐掌机',visualizer:'光影琴境',music:'流光谱面'};
const KEY='piano-desktop44-surfaces';
const DEFAULT={calcCount:16,numbered:false,shape:0,game:0,style:0,musicStyle:0,density:1,reducedMotion:false,showNotes:true,preview:true,tapDuration:false,octave:4,firstPitch:48,whiteCount:22};
function initial(){try{return {...DEFAULT,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch(_){return {...DEFAULT};}}
function stylesheet(file){const href=new URL(file,import.meta.url).href;if([...document.querySelectorAll('link[rel="stylesheet"]')].some(link=>link.href===href))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
export function createDesktopWorkspaces({host,onStatus=()=>{},onChange=()=>{},setTone=()=>{}}){
 let active='piano',epoch=0,instance=null,sceneManager=null,scenePromise=null,updating=false,visible=true,ready=true,error='',config=initial();
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(config));}catch(_){}};
 function releaseInput(){instance?.releaseInput?.();}
 function closeCurrent(){releaseInput();instance?.close?.();instance=null;updating=false;}
 async function scenes(){if(!scenePromise)scenePromise=import('./desktop-scenes.js').then(module=>{stylesheet('./desktop-scenes.css');sceneManager=module.createDesktopScenes({host,onStatus});return sceneManager;}).catch(failure=>{scenePromise=null;throw failure;});return scenePromise;}
 async function select(surface,{preset}={}){
  if(!SURFACES.has(surface))throw Error('未知乐器');
  const token=++epoch;PianoWeb.pause();closeCurrent();active=surface;ready=surface==='piano';error='';host.replaceChildren();onChange({surface,title:NAMES[surface],ready,error});
  if(Number.isInteger(preset)&&preset>=0&&preset<176)setTone(preset);
  if(surface==='piano')return inspect();
  const placeholder=document.createElement('div');placeholder.className='view-placeholder';placeholder.textContent='正在准备'+NAMES[surface]+'…';host.append(placeholder);
  try{
   let candidate;
   if(SCENES.has(surface)){
    const manager=await scenes();if(token!==epoch)return null;
    candidate=manager;instance=candidate;await manager.open(surface,config);
   }else{
    const module=await import(surface==='pad'?'./native-pad.js':surface==='touch'?'./native-touch.js':'./native-scope.js');
    if(token!==epoch)return null;stylesheet('./desktop-instruments.css');host.replaceChildren();
    const open=module[{pad:'openPad',touch:'openTouch',scope:'openScope'}[surface]];candidate=open(host);instance=candidate;
   }
   if(token!==epoch)return null;
   const state=instance?.inspect?.();if(state?.error)throw Error(state.error);if(state?.failed)throw Error('乐器显示未就绪');instance?.setActive?.(visible);ready=true;onChange({surface,title:NAMES[surface],ready,error:''});return inspect();
  }catch(failure){
   if(token!==epoch)return null;closeCurrent();error=failure.message||'乐器暂未就绪';ready=false;host.replaceChildren();
   const box=document.createElement('div');box.className='view-placeholder';const message=document.createElement('span');message.textContent=error;
   const retry=document.createElement('button');retry.textContent='重新载入';retry.onclick=()=>select(surface,{preset});box.append(message,retry);host.append(box);onStatus(error);onChange({surface,title:NAMES[surface],ready,error});return null;
  }
 }
 function configure(values){config={...config,...values};sceneManager?.configure?.(values);save();return {...config};}
 function inspect(){return{surface:active,ready,error,visible,configuration:{...config},needsPianoKeyboard:['piano','visualizer','music'].includes(active),...(instance?.inspect?.()||{})};}
 async function update(view){
  if(!instance||!ready||!visible||updating||!SCENES.has(active))return;
  updating=true;const token=epoch;
  try{await instance.update(view);}catch(failure){if(token===epoch)onStatus(failure.message);}finally{if(token===epoch)updating=false;}
 }
 function setActive(value){visible=!!value;if(!visible)releaseInput();instance?.setActive?.(visible);}
 const controller={select,configure,inspect,update,setActive,releaseInput,setPresentation:value=>sceneManager?.setPresentation?.(value),handleKey:(event,down)=>visible&&!!instance?.handleKey?.(event,down),
  async offlineFrame(view){if(visible&&instance?.offlineFrame)return instance.offlineFrame(view);},
  close(){++epoch;closeCurrent();sceneManager?.close?.();active='piano';ready=true;host.replaceChildren();},
  configuration:()=>({...config})};
 // The original same-origin scenes call this bridge; the scene adapter itself
 // binds each callback to its current frame/generation and validates messages.
 const bridge={inspect,update:()=>document.body.dataset.exporting?Promise.resolve():update(PianoWeb.view()),offlineFrame:()=>controller.offlineFrame(PianoWeb.view())};
 for(const name of ['down','up','release','ready','geometry','failed'])bridge[name]=(...args)=>instance?.[name]?.(...args);
 bridge.key=(event,down)=>{const input=typeof event==='string'?{code:event,target:host,preventDefault(){}}:event;const consumed=PianoWeb.handleKey(input,!!down);if(consumed)input.preventDefault?.();return consumed;};
 window.App31Surfaces=bridge;
 return controller;
}
