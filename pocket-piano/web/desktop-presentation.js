/* Presentation is transient display state. The app owns musical state, global
 * keyboard routing and fullscreen. This module never requests fullscreen. */
const IDLE_MS=1500;
const HIDDEN_CONTROLS='.topbar,.library-panel,.transport,.workspace-bar,.timeline,.studio-footer,.piano-controls,.piano-range,#computer-keyboard,#expand-controls';

export function createPresentationMode({button,exitButton,releaseInput=()=>{},onChange=()=>{}}={}){
 if(!button||!exitButton)throw Error('纯净模式需要进入和退出按钮');
 const body=document.body,listeners=[];let enabled=body.dataset.presentation==='clean',disposed=false,idle=false,timer=null,frame=null,escapeOwned=false,generation=0,lastError='';
 const previous={pressed:button.getAttribute('aria-pressed'),exitHidden:exitButton.hidden,exitIdle:exitButton.getAttribute('data-idle')};
 function listen(target,type,callback,options){target.addEventListener(type,callback,options);listeners.push(()=>target.removeEventListener(type,callback,options));}
 function safe(callback){try{callback();}catch(error){lastError=String(error?.message||error).slice(0,200);}}
 function clearIdle(){if(timer!==null)clearTimeout(timer);timer=null;}
 function clearFrame(){if(frame!==null)cancelAnimationFrame(frame);frame=null;}
 function focusedExit(){const active=document.activeElement;return active===exitButton||exitButton.contains(active);}
 function sync(){button.setAttribute('aria-pressed',String(enabled));exitButton.hidden=!enabled;exitButton.dataset.idle=String(enabled&&idle);}
 function activity(){
  if(disposed||!enabled)return;clearIdle();idle=false;sync();
  timer=setTimeout(()=>{timer=null;if(disposed||!enabled||focusedExit())return;idle=true;sync();},IDLE_MS);
 }
 function resize(){safe(()=>globalThis.dispatchEvent(new Event('resize')));}
 function geometryChanged(){
  clearFrame();resize();const token=generation;
  if(typeof requestAnimationFrame==='function')frame=requestAnimationFrame(()=>{frame=null;if(!disposed&&token===generation)resize();});
 }
 function releaseHiddenFocus(){const active=document.activeElement;if(active===exitButton||active?.closest?.(HIDDEN_CONTROLS))safe(()=>active.blur());}
 function set(value){
  if(disposed)return false;const next=!!value;if(next===enabled)return enabled;
  ++generation;clearIdle();clearFrame();safe(releaseInput);enabled=next;idle=false;
  if(enabled)body.dataset.presentation='clean';else if(body.dataset.presentation==='clean')delete body.dataset.presentation;
  releaseHiddenFocus();sync();if(enabled)activity();geometryChanged();safe(()=>onChange(enabled));return enabled;
 }
 function toggle(){return set(!enabled);}
 function handleKey(event,down){
  if(disposed)return false;const code=event?.code||event?.key;
  if(down&&code==='Tab'){activity();return false;}
  if(code!=='Escape')return false;
  if(!down){const owned=escapeOwned;escapeOwned=false;return owned;}
  if(!enabled){if(escapeOwned&&event.repeat)return true;escapeOwned=false;return false;}
  escapeOwned=true;if(!event.repeat)set(false);return true;
 }
 button.type='button';exitButton.type='button';exitButton.dataset.presentationExit='true';exitButton.dataset.exportExclude='true';exitButton.dataset.recordingExclude='true';exitButton.setAttribute('data-html2canvas-ignore','true');
 if(!exitButton.getAttribute('aria-label'))exitButton.setAttribute('aria-label','退出纯净模式');if(!exitButton.title)exitButton.title='退出纯净模式 · Esc';if(!exitButton.textContent.trim())exitButton.textContent='退出纯净模式 · Esc';
 listen(button,'click',toggle);listen(exitButton,'click',()=>set(false));listen(document,'pointermove',activity,{passive:true});listen(document,'pointerdown',activity,{passive:true});listen(exitButton,'focus',activity);listen(exitButton,'blur',activity);
 let stylesheet=document.querySelector('link[data-desktop-presentation]');
 if(!stylesheet){stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./desktop-presentation.css',import.meta.url).href;stylesheet.dataset.desktopPresentation='true';document.head.append(stylesheet);}
 listen(stylesheet,'load',()=>{if(!disposed&&enabled)geometryChanged();});sync();if(enabled)activity();
 function inspect(){return{enabled,idle,disposed,idleDelay:IDLE_MS,idleTimerPending:timer!==null,geometryFramePending:frame!==null,escapeOwned,exitAvailable:enabled&&!exitButton.hidden,exportExcluded:exitButton.dataset.exportExclude==='true',error:lastError};}
 function dispose(){
  if(disposed)return;if(enabled)set(false);disposed=true;++generation;clearIdle();clearFrame();escapeOwned=false;for(const remove of listeners.splice(0))remove();
  if(previous.pressed===null)button.removeAttribute('aria-pressed');else button.setAttribute('aria-pressed',previous.pressed);
  exitButton.hidden=previous.exitHidden;if(previous.exitIdle===null)exitButton.removeAttribute('data-idle');else exitButton.setAttribute('data-idle',previous.exitIdle);
 }
 return{set,toggle,inspect,handleKey,dispose};
}
