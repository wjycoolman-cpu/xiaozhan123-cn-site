/* Shared desktop host/input lifecycle. The original formal canvas engines own
 * geometry, painting, configuration and note mapping. The root controller owns
 * global keyboard routing; this helper registers no keydown/keyup listeners. */
export const CANVAS_KEY_CODES=Object.freeze(['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM']);
const keyIndex=code=>/^Numpad[0-9]$/.test(code)?(Number(code.slice(-1))+9)%10:CANVAS_KEY_CODES.indexOf(code);
const editing=target=>!!target?.closest?.('input,select,textarea,button,a,summary,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]');
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const label=code=>code.replace(/^Digit|^Key|^Numpad/,'');
const canvasSongs=new WeakMap();
function syncCanvasSong(engine){const view=window.PianoWeb.view();if(view.mode==='follow'){canvasSongs.set(engine,view.song);return;}const song=view.song||null;if(canvasSongs.has(engine)&&canvasSongs.get(engine)===song)return;engine.loadSong(JSON.stringify(song||{id:'canvas-free',title:'自由演奏',bpm:120,notes:[]}));engine.guideGroups(false);canvasSongs.set(engine,song);}

export function createDesktopCanvasSurface({host,id,label:ariaLabel,type,engine,pointer,draw,geometry:geometryProvider,onRelease=()=>{},onClose=()=>{},extra=()=>({})}){
  const target=host||document.querySelector('.instrument');if(!target?.appendChild)throw Error('乐器工作区不存在');
  const canvas=document.createElement('canvas');canvas.id=id;canvas.className='desktop-instrument-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label',ariaLabel);
  canvas.title='电脑按键：1–9、0、Q–P、A–L、Z–M；数字小键盘1–9也可演奏。可同时按，松开释放。';
  Object.assign(canvas.style,{display:'block',width:'100%',height:'100%',touchAction:'none'});
  const addedHostClass=!target.classList.contains('desktop-instrument-host');target.classList.add('desktop-instrument-host');target.appendChild(canvas);
  const pointers=new Map(),held=new Map(),listeners=[],frameTimes=[];
  let open=true,active=true,frame=null,lastFrame=0,error='',width=0,height=0,dpr=1,rendering=false,rendered=false;
  function report(failure){error=String(failure?.message||failure||'乐器绘制失败');const status=document.querySelector('#status');if(status)status.textContent=error;}
  function call(action,id,x=0,y=0,event=null){try{const invoke=()=>pointer(action,id,x,y);if(event&&window.PianoWeb.withPointerVelocity)window.PianoWeb.withPointerVelocity(event,invoke);else invoke();return true;}catch(failure){report(failure);return false;}}
  function releaseInput(){
    if(!open)return;
    for(const point of held.values())call(1,point.id,point.x,point.y);held.clear();
    for(const[id,point]of pointers){pointers.delete(id);call(1,id,point.x,point.y);try{if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}catch(_){}}pointers.clear();
    call(3,0,0,0);try{onRelease();}catch(failure){report(failure);}
  }
  function geometry(){try{return (geometryProvider?geometryProvider():JSON.parse(engine.canvasGeometry(type))).filter(rect=>Array.isArray(rect)&&rect.length>=4&&rect.every(finite)&&rect[2]>rect[0]&&rect[3]>rect[1]);}catch(failure){report(failure);return[];}}
  function allowed(event,forPointer=false){
    if(!open||target.hidden||canvas.hidden||target.closest?.('[inert],[hidden]')||document.querySelector('dialog[open]'))return false;
    return !event?.ctrlKey&&!event?.metaKey&&!event?.altKey&&!event?.isComposing&&!editing(event?.target)&&(forPointer||!editing(document.activeElement));
  }
  function renderNow(at=performance.now()){
    if(!open||!active||rendering)return false;rendering=true;
    try{
      const bounds=canvas.getBoundingClientRect(),hostBounds=target.getBoundingClientRect();
      const nextWidth=Math.round(bounds.width||hostBounds.width),nextHeight=Math.round(bounds.height||hostBounds.height);if(nextWidth<1||nextHeight<1)return false;
      const ratio=Number(globalThis.devicePixelRatio)||1,nextDpr=Math.min(3,Math.max(1,ratio));
      if(rendered&&(nextWidth!==width||nextHeight!==height))releaseInput();width=nextWidth;height=nextHeight;dpr=nextDpr;
      const pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
      const context=canvas.getContext('2d');if(!context)throw Error('此浏览器没有可用的 Canvas 绘图上下文');context.setTransform(dpr,0,0,dpr,0,0);
      syncCanvasSong(engine);draw(context,width,height);rendered=true;
      if(lastFrame&&finite(at)&&at>=lastFrame){frameTimes.push(at-lastFrame);if(frameTimes.length>120)frameTimes.shift();}lastFrame=at;return true;
    }catch(failure){report(failure);releaseInput();return false;}finally{rendering=false;}
  }
  function loop(at){frame=null;if(!open||!active)return;renderNow(at);if(open&&active&&!error&&typeof requestAnimationFrame==='function')frame=requestAnimationFrame(loop);}
  function setActive(value){const next=!!value;if(!open||next===active)return;active=next;if(!active){releaseInput();if(frame!==null)cancelAnimationFrame(frame);frame=null;}else{renderNow();if(!error&&frame===null)frame=requestAnimationFrame(loop);}}
  function point(event){const bounds=canvas.getBoundingClientRect();return{x:(event.clientX-bounds.left)*(width/(bounds.width||width||1)),y:(event.clientY-bounds.top)*(height/(bounds.height||height||1))};}
  canvas.onpointerdown=event=>{
    if(!allowed(event,true)||event.button>0)return;event.preventDefault();renderNow();if(!rendered)return;
    try{canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);}catch(_){}
    const p=point(event);pointers.set(event.pointerId,p);call(0,event.pointerId,p.x,p.y,event);
  };
  canvas.onpointermove=event=>{if(!pointers.has(event.pointerId))return;event.preventDefault();const p=point(event);pointers.set(event.pointerId,p);call(2,event.pointerId,p.x,p.y,event);};
  function up(event){const p=pointers.get(event.pointerId);if(!p)return;event.preventDefault();pointers.delete(event.pointerId);call(1,event.pointerId,p.x,p.y);try{if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);}catch(_){}}
  canvas.onpointerup=up;canvas.onlostpointercapture=up;canvas.onpointercancel=event=>{event.preventDefault();releaseInput();};
  function handleKey(event,down){
    const code=event?.code;
    if(!down){const p=held.get(code);if(!p)return false;held.delete(code);call(1,p.id,p.x,p.y);return true;}
    if(!active||!allowed(event)||event.repeat||held.has(code))return false;const index=keyIndex(code||'');if(index<0)return false;
    renderNow();if(!rendered)return false;const rect=geometry()[index];if(!rect)return false;
    const p={id:-10000-index-(String(code).startsWith('Numpad')?1000:0),x:(rect[0]+rect[2])/2,y:(rect[1]+rect[3])/2};
    held.set(code,p);if(!call(0,p.id,p.x,p.y)){held.delete(code);return false;}return true;
  }
  function listen(object,type,listener,options){object?.addEventListener?.(type,listener,options);listeners.push(()=>object?.removeEventListener?.(type,listener,options));}
  listen(globalThis,'blur',()=>releaseInput());listen(document,'visibilitychange',()=>{if(document.hidden||document.visibilityState==='hidden')releaseInput();});
  listen(document,'focusin',event=>{if(editing(event.target))releaseInput();});
  function close(){if(!open)return;releaseInput();open=false;if(frame!==null&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(frame);frame=null;for(const remove of listeners.splice(0))remove();
    canvas.onpointerdown=canvas.onpointermove=canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=null;
    try{onClose();}catch(failure){report(failure);}canvas.remove();if(addedHostClass)target.classList.remove('desktop-instrument-host');
  }
  function inspect(){return{open,error,rendered,size:{width,height,dpr},pointerCount:pointers.size,keyCount:held.size,geometryCount:open?geometry().length:0,
    keyboard:open?geometry().slice(0,CANVAS_KEY_CODES.length).map((_,i)=>label(CANVAS_KEY_CODES[i])):[],frames:frameTimes.length,averageFrameMs:frameTimes.reduce((a,b)=>a+b,0)/Math.max(1,frameTimes.length),...extra()};}
  renderNow();if(!document.querySelector('dialog[open]'))try{canvas.focus({preventScroll:true});}catch(_){}if(!error&&typeof requestAnimationFrame==='function')frame=requestAnimationFrame(loop);
  return{canvas,close,handleKey,releaseInput,inspect,renderNow,setActive};
}
