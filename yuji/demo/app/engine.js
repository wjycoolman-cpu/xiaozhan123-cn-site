(function(root){
'use strict';
const copy=o=>JSON.parse(JSON.stringify(o));
function fresh(config={}){return {id:Date.now()+'-'+Math.random().toString(36).slice(2,8),names:config.names||[['选手 A'],['选手 B']],mode:config.mode||'singles',target:config.target===15?15:21,bestOf:config.bestOf===1?1:3,score:[0,0],wins:[0,0],games:[],rallies:[],gameServer:config.server===1?1:0,server:config.server===1?1:0,swapped:false,interval:false,deciderSwap:false,phase:'playing',notice:'',started:Date.now(),finished:null};}
function cap(s){return s.target===15?21:30;}
function mid(s){return s.target===15?8:11;}
function add(state,side){let s=copy(state);if(s.phase!=='playing'||![0,1].includes(side))return s;s.score[side]++;(s.rallies||(s.rallies=[])).push(side);s.server=side;s.notice='';let max=Math.max(...s.score);if(!s.interval&&max>=mid(s)){s.interval=true;s.notice='局中间歇 · 最多 60 秒';}
if(!s.deciderSwap&&(s.bestOf===1||s.games.length===2)&&max>=mid(s)){s.deciderSwap=true;s.swapped=!s.swapped;s.notice='请交换场地 · 已调整屏幕左右位置';}
if(s.score[side]>=s.target&&(s.score[side]-s.score[1-side]>=2||s.score[side]===cap(s))){s.games.push({score:copy(s.score),winner:side});s.wins[side]++;s.phase=s.wins[side]>=Math.ceil(s.bestOf/2)?'finished':'gameOver';s.notice=s.phase==='finished'?'比赛结束':'本局结束';if(s.phase==='finished')s.finished=Date.now();}return s;}
function minus(state,side){let s=copy(state);if(![0,1].includes(side)||s.score[side]===0)return s;if(s.phase!=='playing'){const g=s.games.pop();s.wins[g.winner]--;s.phase='playing';s.finished=null;}s.score[side]--;const at=(s.rallies||[]).lastIndexOf(side);if(at>=0)s.rallies.splice(at,1);s.server=s.rallies&&s.rallies.length?s.rallies[s.rallies.length-1]:s.gameServer||0;const max=Math.max(...s.score);s.interval=max>=mid(s);if(s.deciderSwap&&max<mid(s)){s.deciderSwap=false;s.swapped=!s.swapped;}s.notice='已修正 '+label(s,side)+' 的比分';for(let i=0;i<2;i++)if(s.score[i]>=s.target&&(s.score[i]-s.score[1-i]>=2||s.score[i]===cap(s))){s.games.push({score:copy(s.score),winner:i});s.wins[i]++;s.phase=s.wins[i]>=Math.ceil(s.bestOf/2)?'finished':'gameOver';if(s.phase==='finished')s.finished=Date.now();break;}return s;}
function next(state){let s=copy(state);if(s.phase!=='gameOver')return s;s.score=[0,0];s.rallies=[];s.gameServer=s.server;s.swapped=!s.swapped;s.interval=false;s.deciderSwap=false;s.phase='playing';s.notice='下一局 · 请交换场地';return s;}
function label(s,i){return s.names[i].join(' / ');}
function summary(s){return [new Date(s.started).toLocaleString('zh-CN'),(s.mode==='doubles'?'双打':'单打')+' · '+s.target+' 分 · '+(s.bestOf===3?'三局两胜':'单局'),label(s,0)+'  vs  '+label(s,1),'局数 '+s.wins.join(' : '),...s.games.map((g,i)=>'第 '+(i+1)+' 局  '+g.score.join(' : ')),s.phase==='finished'?'胜方：'+label(s,s.wins[0]>s.wins[1]?0:1):'当前比分 '+s.score.join(' : ')].join('\n');}
const api={fresh,add,minus,next,cap,mid,label,summary,copy};if(typeof module!=='undefined')module.exports=api;root.ScoreEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
