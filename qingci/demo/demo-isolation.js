'use strict';
(() => {
  // The exact APP uses these keys. Namespace only this demo's storage operations.
  const prefix = 'beidanci.html-demo.1.0.6:';
  const owns = key => String(key).startsWith('qingci.');
  for (const name of ['getItem','setItem','removeItem']) {
    const original = Storage.prototype[name];
    Storage.prototype[name] = function(key,...args) {
      return original.call(this,owns(key)?prefix+key:key,...args);
    };
  }
  window.BeidanciDemo = Object.freeze({version:'1.0.6',storagePrefix:prefix,nativeFeatures:'unavailable; APP operation-specific explanations remain active',uploadsEnabled:false});
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-action="audio"]')) {
      const toast=document.getElementById('toast');
      toast.textContent='演示发音使用浏览器英语语音，音色由设备决定；APP 的四种自然词音请使用安装版。';
      toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),5000);
    }
  },true);
})();

