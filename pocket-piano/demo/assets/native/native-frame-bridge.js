/* Same-origin host adapter for the formal offline WebView assets. */
(()=>{
 const host=()=>parent.App31Surfaces;
 window.NativeGeometry={ready:raw=>host()?.geometry(JSON.parse(raw)),failed:message=>host()?.failed(message)};
 window.HandheldSceneReady={loaded:(generation,error)=>host()?.ready('handheld',generation,error),painted:()=>{},submitted:()=>{},observed:()=>{},failed:message=>host()?.failed(message)};
 window.HandheldSceneTouch={down:(pointer,key)=>host()?.down(pointer,key),up:pointer=>host()?.up(pointer)};
 window.MusicSceneReady={loaded:(generation,error)=>host()?.ready('visualizer',generation,error),painted:()=>{}};
 if(location.pathname.includes('/calculator/')){
  const contacts=new Map();
  document.addEventListener('pointerdown',e=>{const key=e.target.closest('[data-key-index]');if(!key)return;e.preventDefault();key.setPointerCapture(e.pointerId);const id=Number(key.dataset.keyIndex);contacts.set(e.pointerId,id);host()?.down(e.pointerId,id);});
  document.addEventListener('pointermove',e=>{if(!contacts.has(e.pointerId))return;const key=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-key-index]');if(!key)return;const id=Number(key.dataset.keyIndex);if(contacts.get(e.pointerId)!==id){host()?.up(e.pointerId);contacts.set(e.pointerId,id);host()?.down(e.pointerId,id);}});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,e=>{if(contacts.delete(e.pointerId))host()?.up(e.pointerId);});
 }
 addEventListener('blur',()=>host()?.release());
 addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;host()?.key(e,true);});
 addEventListener('keyup',e=>host()?.key(e,false));
})();
