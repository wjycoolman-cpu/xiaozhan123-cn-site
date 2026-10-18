(() => {
  'use strict';
  if (parent === window) return;
  const match = location.pathname.match(/\/builds\/([^/]+)\//);
  const build = match ? decodeURIComponent(match[1]) : '';
  let previous=null;
  const send = () => {const status=document.body?.dataset.status || 'unknown';if(status===previous)return;previous=status;parent.postMessage({app:'electric-drive',type:'GAME_STATE',build,status},location.origin);};
  const start = () => {send();new MutationObserver(send).observe(document.body,{attributes:true,attributeFilter:['data-status']});};
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded',start,{once:true});else start();
  addEventListener('pageshow',send);
})();
