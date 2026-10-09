'use strict';
// Same CSV columns and merge semantics as the Android app, with an isolated format.
const DemoFiles=(()=>{
  const namespace='mianji-html-parity-1.1.2-v1',format='mianji-demo-backup',limit=2000000;
  function parts(ms,zone){const a=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));return Object.fromEntries(a.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]))}
  function date(ms,zone){const p=parts(ms,zone);return `${p.year}-${p.month}-${p.day}`}
  function stamp(ms,zone){const p=parts(ms,zone),offset=Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute)-Math.floor(ms/60000)*60000)/60000),abs=Math.abs(offset);return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} ${offset<0?'-':'+'}${String(Math.floor(abs/60)).padStart(2,'0')}:${String(abs%60).padStart(2,'0')}`}
  function cell(v){v=String(v);if(/^[=+\-@\t\r]/.test(v.trimStart())||/^[\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'}
  function native(r){return {id:r.id,date:r.date,startMs:r.start,endMs:r.end,phoneUseMinutes:r.phoneUse||0,interruptions:r.interruptions||0,confidence:r.confirmed?'已确认':'待确认',reason:r.reason||'',source:r.source,confirmed:r.confirmed,quality:r.quality,note:r.note||'',excluded:r.excluded,zoneId:r.zoneId||Intl.DateTimeFormat().resolvedOptions().timeZone}}
  function csv(records){return '\uFEFF日期,开始,结束,估计分钟,窗口内用机分钟,用机段数,来源,已确认,排除统计,醒来感受1到5,备注\r\n'+records.slice().sort((a,b)=>a.start-b.start).map(r=>{const n=native(r);return [n.date,stamp(n.startMs,n.zoneId),stamp(n.endMs,n.zoneId),Math.floor((n.endMs-n.startMs)/60000)-n.phoneUseMinutes,n.phoneUseMinutes,n.interruptions,n.source,n.confirmed,n.excluded,n.quality,n.note].map(cell).join(',')}).join('\r\n')}
  function backup(data){return JSON.stringify({format,schema:1,namespace,exportedAt:Date.now(),settings:{enabled:data.enabled,targetMinutes:data.target,autoUpdate:data.autoUpdate},records:data.records.map(native)},null,2)}
  function validate(text,now=Date.now()){
    if(new TextEncoder().encode(text).length>limit)throw Error('备份文件太大，最多 2 MB。');
    let j;try{j=JSON.parse(text.replace(/^\uFEFF/,''))}catch{throw Error('无法读取 JSON，请选择完整的网页演示备份。')}
    if(!j||j.format!==format||j.schema!==1||j.namespace!==namespace)throw Error('请选择眠迹网页演示的 JSON 备份；手机备份不能在此恢复。');
    const s=j.settings;if(!s||!Number.isInteger(s.targetMinutes)||s.targetMinutes<360||s.targetMinutes>600||typeof s.enabled!=='boolean'||typeof s.autoUpdate!=='boolean')throw Error('备份设置不合法。');
    if(!Array.isArray(j.records)||j.records.length>5000)throw Error('备份记录超过上限，最多 5000 条。');
    const ids=new Set(),dates=new Set();
    const records=j.records.map(n=>{
      if(!n||typeof n.id!=='string'||n.id.length<1||n.id.length>100||n.id.startsWith('demo-')||n.source==='示例')throw Error('示例不能恢复为自己的记录。');
      if(typeof n.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(n.date)||!Number.isSafeInteger(n.startMs)||!Number.isSafeInteger(n.endMs)||n.startMs<=0||n.endMs<=n.startMs||n.endMs-n.startMs>86400000||n.endMs>now)throw Error('记录的日期、起止或时长不合法。');
      const m=Math.floor((n.endMs-n.startMs)/60000);
      if(!Number.isInteger(n.phoneUseMinutes)||n.phoneUseMinutes<0||n.phoneUseMinutes>m||!Number.isInteger(n.interruptions)||n.interruptions<0||n.interruptions>1000||!Number.isInteger(n.quality)||n.quality<1||n.quality>5||typeof n.note!=='string'||n.note.length>1000||typeof n.reason!=='string'||n.reason.length>1000||typeof n.source!=='string'||n.source.length>100||typeof n.confirmed!=='boolean'||typeof n.excluded!=='boolean')throw Error('记录的用机时长、感受或文字不合法。');
      if(typeof n.zoneId!=='string'||n.zoneId.length>100)throw Error('记录时区不合法。');
      try{if(date(n.endMs,n.zoneId)!==n.date)throw Error()}catch{throw Error('起床日期与记录日期或时区不一致。')}
      if(ids.has(n.id)||dates.has(n.date))throw Error('备份包含重复记录或重复日期。');ids.add(n.id);dates.add(n.date);
      return {id:n.id,date:n.date,start:n.startMs,end:n.endMs,minutes:m-n.phoneUseMinutes,phoneUse:n.phoneUseMinutes,interruptions:n.interruptions,source:n.source,confirmed:n.confirmed,quality:n.quality,note:n.note,excluded:n.excluded,reason:n.reason,zoneId:n.zoneId};
    });return {records,settings:s};
  }
  function additions(current,imported){const dates=new Set(current.map(r=>r.date));return imported.filter(r=>!dates.has(r.date))}
  return {namespace,format,limit,csv,backup,validate,additions};
})();
