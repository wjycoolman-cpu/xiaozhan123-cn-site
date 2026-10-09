 'use strict';
$('syncEvents').onclick=()=>message('演示不连接生产同步','此页只操作虚构的演示数据，保存在浏览器独立演示空间。网站同步请使用 Android 版和自己的连接码。');
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==window.parent)return;if(e.data?.type==='yuji-demo-orientation-request')setOrientation(e.data.value);if(e.data?.type==='yuji-demo-reset'){localStorage.removeItem('yuji-demo-v1');location.reload();}});
window.parent.postMessage({type:'yuji-demo-ready',orientation:store.prefs.orientation},location.origin);
