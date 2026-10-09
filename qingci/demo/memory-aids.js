/* Original lightweight concept cues for Qingci. No external images or fonts. */
'use strict';
(function attachMemoryAids(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.QingciMemoryAids = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMemoryAids() {
  const entries = Object.freeze([
    Object.freeze({
      word: 'anchor',
      sense: '锚',
      scene: '小船浮在水面，重物沉到水底，把船稳在原处。',
      cue: '看船为什么没有随水漂走。',
      kind: '图像联想',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M10 38 Q40 28 70 38 T130 38" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M20 29 H72 L62 44 H30 Z" fill="#e8ece8" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><line x1="48" y1="44" x2="48" y2="72" stroke="currentColor" stroke-width="3"/><path d="M38 72 H58 M48 62 V86 M48 86 C35 86 29 79 29 71 M48 86 C61 86 67 79 67 71" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M82 82 Q125 72 166 82 T230 82" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>'
    }),
    Object.freeze({
      word: 'obstacle',
      sense: '障碍',
      scene: '一条直路被方块截断，行进箭头只好绕到旁边。',
      cue: '看路线为什么改变方向。',
      kind: '概念图',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M12 58 H76 Q88 58 88 46 V26 Q88 16 100 16 H166 Q178 16 178 28 V46 Q178 58 190 58 H224" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><polyline points="214,48 226,58 214,68" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="108" y="40" width="46" height="44" rx="5" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><line x1="116" y1="50" x2="146" y2="74" stroke="currentColor" stroke-width="2" opacity="0.45"/><line x1="146" y1="50" x2="116" y2="74" stroke="currentColor" stroke-width="2" opacity="0.45"/></svg>'
    }),
    Object.freeze({
      word: 'expand',
      sense: '膨胀',
      scene: '左边的小圆逐渐变成右边的大圆，边界向四周推开。',
      cue: '比较前后边界离中心的距离。',
      kind: '概念图',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="48" cy="50" r="17" fill="#e9ede8" stroke="currentColor" stroke-width="3"/><path d="M78 50 H112" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><polyline points="102,41 113,50 102,59" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="175" cy="50" r="34" fill="#e5ebe6" stroke="currentColor" stroke-width="3"/><line x1="175" y1="12" x2="175" y2="2" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><polyline points="168,9 175,2 182,9" fill="none" stroke="currentColor" stroke-width="3"/><line x1="213" y1="50" x2="229" y2="50" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><polyline points="222,43 229,50 222,57" fill="none" stroke="currentColor" stroke-width="3"/><line x1="175" y1="88" x2="175" y2="98" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><polyline points="168,91 175,98 182,91" fill="none" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'absorb',
      sense: '吸收',
      scene: '几滴水落进多孔方块，进入后不再从下方滴出。',
      cue: '留意水滴进入材料前后的变化。',
      kind: '图像联想',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M46 18 C38 29 36 34 36 40 A10 10 0 0 0 56 40 C56 34 54 29 46 18 Z" fill="#e4eceb" stroke="currentColor" stroke-width="3"/><path d="M94 10 C86 21 84 26 84 32 A10 10 0 0 0 104 32 C104 26 102 21 94 10 Z" fill="#e4eceb" stroke="currentColor" stroke-width="3"/><path d="M142 18 C134 29 132 34 132 40 A10 10 0 0 0 152 40 C152 34 150 29 142 18 Z" fill="#e4eceb" stroke="currentColor" stroke-width="3"/><line x1="46" y1="53" x2="46" y2="64" stroke="currentColor" stroke-width="3"/><polyline points="39,58 46,65 53,58" fill="none" stroke="currentColor" stroke-width="3"/><line x1="94" y1="45" x2="94" y2="64" stroke="currentColor" stroke-width="3"/><polyline points="87,58 94,65 101,58" fill="none" stroke="currentColor" stroke-width="3"/><line x1="142" y1="53" x2="142" y2="64" stroke="currentColor" stroke-width="3"/><polyline points="135,58 142,65 149,58" fill="none" stroke="currentColor" stroke-width="3"/><rect x="24" y="64" width="142" height="27" rx="8" fill="#eee9dd" stroke="currentColor" stroke-width="3"/><circle cx="55" cy="77" r="3" fill="currentColor"/><circle cx="91" cy="82" r="3" fill="currentColor"/><circle cx="128" cy="75" r="3" fill="currentColor"/></svg>'
    }),
    Object.freeze({
      word: 'balance',
      sense: '平衡',
      scene: '支点两侧放着相同重量，横杆保持水平。',
      cue: '观察支点两侧是否同高。',
      kind: '概念图',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><line x1="32" y1="43" x2="208" y2="43" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><polygon points="120,45 94,88 146,88" fill="#eee9e2" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><line x1="58" y1="43" x2="58" y2="67" stroke="currentColor" stroke-width="3"/><line x1="182" y1="43" x2="182" y2="67" stroke="currentColor" stroke-width="3"/><path d="M35 67 H81 Q78 88 58 88 Q38 88 35 67 Z" fill="#e7ece8" stroke="currentColor" stroke-width="3"/><path d="M159 67 H205 Q202 88 182 88 Q162 88 159 67 Z" fill="#e7ece8" stroke="currentColor" stroke-width="3"/><circle cx="58" cy="24" r="11" fill="#e5ebe6" stroke="currentColor" stroke-width="3"/><circle cx="182" cy="24" r="11" fill="#e5ebe6" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'ambiguous',
      sense: '模棱两可的',
      scene: '同一个起点分出两条同样醒目的路线，无法只凭图确定去向。',
      cue: '两个方向都说得通时，选择不再唯一。',
      kind: '概念图',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="35" cy="50" r="11" fill="#e7ece8" stroke="currentColor" stroke-width="3"/><path d="M47 50 H92 C113 50 119 25 142 25 H217" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M47 50 H92 C113 50 119 75 142 75 H217" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><polyline points="207,15 219,25 207,35" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><polyline points="207,65 219,75 207,85" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="164" cy="25" r="5" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><circle cx="164" cy="75" r="5" fill="#eee9e2" stroke="currentColor" stroke-width="2"/></svg>'
    }),
    Object.freeze({
      word: 'island', sense: '岛', kind: '图像联想',
      scene: '一小片陆地四周都是水，和远处陆地断开。',
      cue: '看陆地与水的包围关系。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M8 72 Q35 64 62 72 T116 72 T170 72 T232 72" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M58 68 Q82 34 118 51 Q143 27 182 68 Z" fill="#eee9dd" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M125 48 V23 M125 25 Q107 23 101 10 M125 25 Q143 23 151 10 M125 32 Q110 33 104 43" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>'
    }),
    Object.freeze({
      word: 'transparent', sense: '透明的', kind: '图像联想',
      scene: '浅色薄板挡在前面，后方连续线仍能完整看见。',
      cue: '观察遮挡物后面的线有没有消失。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="40" cy="50" r="16" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><line x1="56" y1="50" x2="214" y2="50" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><rect x="96" y="18" width="72" height="64" rx="6" fill="#e4eceb" fill-opacity="0.48" stroke="currentColor" stroke-width="3"/><circle cx="202" cy="50" r="12" fill="none" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'shrink', sense: '缩小', kind: '概念图',
      scene: '左边的大圆变成右边的小圆，边界向中心收回。',
      cue: '比较变化前后的占用范围。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="62" cy="50" r="34" fill="#e5ebe6" stroke="currentColor" stroke-width="3"/><path d="M105 50 H145" fill="none" stroke="currentColor" stroke-width="3"/><polyline points="135,41 146,50 135,59" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="184" cy="50" r="16" fill="#e9ede8" stroke="currentColor" stroke-width="3"/><line x1="184" y1="10" x2="184" y2="28" stroke="currentColor" stroke-width="3"/><polyline points="177,21 184,28 191,21" fill="none" stroke="currentColor" stroke-width="3"/><line x1="224" y1="50" x2="204" y2="50" stroke="currentColor" stroke-width="3"/><polyline points="211,43 204,50 211,57" fill="none" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'gather', sense: '聚集', kind: '概念图',
      scene: '分散在四周的小点沿箭头靠到同一个中心。',
      cue: '看多个位置最后变成了几个位置。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="30" cy="20" r="6" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><circle cx="28" cy="80" r="6" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><circle cx="210" cy="18" r="6" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><circle cx="212" cy="82" r="6" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><path d="M42 27 L100 45 M42 73 L100 55 M198 27 L140 45 M198 73 L140 55" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="120" cy="50" r="20" fill="#e5ebe6" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'scatter', sense: '分散', kind: '概念图',
      scene: '中心的一组小点向四面移动，彼此距离越来越远。',
      cue: '看原本靠在一起的点去了哪里。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="120" cy="50" r="15" fill="#e5ebe6" stroke="currentColor" stroke-width="3"/><path d="M100 42 L42 20 M100 58 L42 80 M140 42 L198 20 M140 58 L198 80" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="30" cy="16" r="6" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><circle cx="30" cy="84" r="6" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><circle cx="210" cy="16" r="6" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><circle cx="210" cy="84" r="6" fill="#eee9e2" stroke="currentColor" stroke-width="2"/></svg>'
    }),
    Object.freeze({
      word: 'surround', sense: '包围', kind: '概念图',
      scene: '一个方块在中心，四周的圆点形成闭合一圈。',
      cue: '中心还能否不经过周围直接离开。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="102" y="34" width="36" height="32" rx="4" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><ellipse cx="120" cy="50" rx="86" ry="37" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="5 7"/><circle cx="34" cy="50" r="8" fill="#e5ebe6" stroke="currentColor" stroke-width="2"/><circle cx="206" cy="50" r="8" fill="#e5ebe6" stroke="currentColor" stroke-width="2"/><circle cx="120" cy="13" r="8" fill="#e5ebe6" stroke="currentColor" stroke-width="2"/><circle cx="120" cy="87" r="8" fill="#e5ebe6" stroke="currentColor" stroke-width="2"/></svg>'
    }),
    Object.freeze({
      word: 'connect', sense: '连接', kind: '概念图',
      scene: '两个分开的圆被一条连续线接在一起。',
      cue: '留意两端之间是否出现通路。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="52" cy="50" r="22" fill="#e7ece8" stroke="currentColor" stroke-width="3"/><circle cx="188" cy="50" r="22" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><path d="M74 50 C105 22 135 78 166 50" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="120" cy="50" r="5" fill="currentColor"/></svg>'
    }),
    Object.freeze({
      word: 'separate', sense: '分开的', kind: '概念图',
      scene: '原本相贴的两个圆沿相反方向离开，中间出现空隙。',
      cue: '观察两个部分之间的距离变化。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="94" cy="50" r="20" fill="#e7ece8" stroke="currentColor" stroke-width="3"/><circle cx="146" cy="50" r="20" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><path d="M68 50 H28 M172 50 H212" fill="none" stroke="currentColor" stroke-width="3"/><polyline points="39,40 27,50 39,60" fill="none" stroke="currentColor" stroke-width="3"/><polyline points="201,40 213,50 201,60" fill="none" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'increase', sense: '增加', kind: '概念图',
      scene: '从左到右的柱子一根比一根高，箭头也持续向上。',
      cue: '比较连续三个数量的变化方向。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="36" y="62" width="28" height="24" rx="3" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><rect x="96" y="43" width="28" height="43" rx="3" fill="#e7ece8" stroke="currentColor" stroke-width="3"/><rect x="156" y="19" width="28" height="67" rx="3" fill="#e5ebe6" stroke="currentColor" stroke-width="3"/><path d="M30 54 L103 29 L190 8" fill="none" stroke="currentColor" stroke-width="3"/><polyline points="179,4 191,8 184,19" fill="none" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'decrease', sense: '减少', kind: '概念图',
      scene: '从左到右的柱子逐根变矮，箭头持续向下。',
      cue: '比较连续三个数量的变化方向。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="42" y="19" width="28" height="67" rx="3" fill="#e5ebe6" stroke="currentColor" stroke-width="3"/><rect x="102" y="43" width="28" height="43" rx="3" fill="#e7ece8" stroke="currentColor" stroke-width="3"/><rect x="162" y="62" width="28" height="24" rx="3" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><path d="M35 8 L110 31 L202 58" fill="none" stroke="currentColor" stroke-width="3"/><polyline points="194,47 203,58 190,62" fill="none" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'divide', sense: '分开', kind: '概念图',
      scene: '一条共同路线在中点分成上下两条独立路线。',
      cue: '看一个整体最后变成了几部分。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="20" y="36" width="38" height="28" rx="5" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><path d="M58 50 H108 C128 50 132 25 154 25 H218 M108 50 C128 50 132 75 154 75 H218" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="220" cy="25" r="6" fill="#e5ebe6" stroke="currentColor" stroke-width="2"/><circle cx="220" cy="75" r="6" fill="#e5ebe6" stroke="currentColor" stroke-width="2"/></svg>'
    }),
    Object.freeze({
      word: 'combine', sense: '结合', kind: '概念图',
      scene: '上下两条路线在中点合成一条，共同进入一个圆。',
      cue: '看两个来源最后剩下几条路线。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="28" cy="25" r="8" fill="#e7ece8" stroke="currentColor" stroke-width="2"/><circle cx="28" cy="75" r="8" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><path d="M38 25 H88 C110 25 112 50 134 50 H190" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M38 75 H88 C110 75 112 50 134 50" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="208" cy="50" r="18" fill="#e5ebe6" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'float', sense: '漂浮', kind: '图像联想',
      scene: '轻物体停在水面上方，没有沉入水底。',
      cue: '观察物体相对水面的高度。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M10 61 Q35 52 60 61 T110 61 T160 61 T230 61" fill="none" stroke="currentColor" stroke-width="3"/><ellipse cx="120" cy="47" rx="40" ry="17" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><path d="M36 84 V66" stroke="currentColor" stroke-width="4"/><polyline points="27,75 36,65 45,75" fill="none" stroke="currentColor" stroke-width="4"/></svg>'
    }),
    Object.freeze({
      word: 'sink', sense: '下沉', kind: '图像联想',
      scene: '重物穿过水面向下移动，逐渐靠近水底。',
      cue: '观察物体相对水面的高度变化。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M10 27 Q35 20 60 27 T110 27 T160 27 T230 27" fill="none" stroke="currentColor" stroke-width="3"/><rect x="94" y="50" width="52" height="31" rx="6" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><path d="M40 38 V72" stroke="currentColor" stroke-width="4"/><polyline points="31,62 40,73 49,62" fill="none" stroke="currentColor" stroke-width="4"/></svg>'
    }),
    Object.freeze({
      word: 'bend', sense: '弯曲', kind: '概念图',
      scene: '直杆受力后，中间形成明显弧度。',
      cue: '比较前后线条是否仍保持笔直。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><line x1="18" y1="35" x2="90" y2="35" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M103 50 H132" stroke="currentColor" stroke-width="3"/><polyline points="123,41 133,50 123,59" fill="none" stroke="currentColor" stroke-width="3"/><path d="M148 25 Q186 90 224 25" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M186 7 V30" stroke="currentColor" stroke-width="3"/><polyline points="179,23 186,30 193,23" fill="none" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'stretch', sense: '伸展', kind: '概念图',
      scene: '折线弹簧被两端向外拉，整体长度变长。',
      cue: '看两端之间的距离是否变大。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><polyline points="56,50 76,32 96,68 116,32 136,68 156,32 176,50" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M55 50 H18 M177 50 H222" stroke="currentColor" stroke-width="3"/><polyline points="30,40 18,50 30,60 M210,40 222,50 210,60" fill="none" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'compress', sense: '压缩', kind: '概念图',
      scene: '两侧同时向内推，折线弹簧被挤到更短。',
      cue: '看外力方向与整体长度的变化。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><polyline points="92,50 102,31 112,69 122,31 132,69 142,31 152,50" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M22 50 H83 M218 50 H161" stroke="currentColor" stroke-width="3"/><polyline points="70,38 84,50 70,62 M174,38 160,50 174,62" fill="none" stroke="currentColor" stroke-width="4"/><rect x="84" y="18" width="76" height="64" rx="5" fill="none" stroke="currentColor" stroke-width="2" opacity="0.35"/></svg>'
    }),
    Object.freeze({
      word: 'approach', sense: '接近', kind: '概念图',
      scene: '左右两个圆沿箭头相向移动，距离不断缩短。',
      cue: '观察两个目标之间的空隙变化。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="40" cy="50" r="16" fill="#e7ece8" stroke="currentColor" stroke-width="3"/><circle cx="200" cy="50" r="16" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><path d="M62 50 H105 M178 50 H135" stroke="currentColor" stroke-width="3"/><polyline points="94,40 106,50 94,60 M146,40 134,50 146,60" fill="none" stroke="currentColor" stroke-width="3"/><line x1="116" y1="42" x2="124" y2="58" stroke="currentColor" stroke-width="2" opacity="0.45"/></svg>'
    }),
    Object.freeze({
      word: 'withdraw', sense: '撤退', kind: '概念图',
      scene: '前方有边界，圆点沿箭头转身离开。',
      cue: '看移动方向是靠近还是离开前方。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><line x1="188" y1="16" x2="188" y2="84" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="142" cy="50" r="16" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><path d="M122 50 H42" stroke="currentColor" stroke-width="4"/><polyline points="54,39 41,50 54,61" fill="none" stroke="currentColor" stroke-width="4"/><path d="M157 31 Q170 18 183 31" fill="none" stroke="currentColor" stroke-width="2" opacity="0.45"/></svg>'
    }),
    Object.freeze({
      word: 'support', sense: '支撑', kind: '图像联想',
      scene: '横板下方有稳固立柱，承住上面的重量。',
      cue: '想一想抽走下方结构会发生什么。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="34" y="22" width="172" height="24" rx="5" fill="#e5ebe6" stroke="currentColor" stroke-width="3"/><circle cx="72" cy="12" r="10" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><circle cx="120" cy="12" r="10" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><circle cx="168" cy="12" r="10" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><rect x="62" y="46" width="24" height="42" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><rect x="154" y="46" width="24" height="42" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><line x1="40" y1="88" x2="200" y2="88" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'oppose', sense: '反对', kind: '概念图',
      scene: '两支箭从相反方向顶在一起，彼此阻止对方前进。',
      cue: '看两个力量的方向是否一致。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="120" cy="50" r="13" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><line x1="111" y1="41" x2="129" y2="59" stroke="currentColor" stroke-width="2"/><line x1="129" y1="41" x2="111" y2="59" stroke="currentColor" stroke-width="2"/><path d="M22 50 H100 M218 50 H140" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><polyline points="87,37 101,50 87,63 M153,37 139,50 153,63" fill="none" stroke="currentColor" stroke-width="5"/></svg>'
    }),
    Object.freeze({
      word: 'exchange', sense: '交换', kind: '概念图',
      scene: '上下两件物品沿相反方向移动，互换左右位置。',
      cue: '看双方是否都给出并得到另一件东西。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="45" cy="28" r="15" fill="#e7ece8" stroke="currentColor" stroke-width="3"/><rect x="180" y="64" width="30" height="24" rx="4" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><path d="M65 28 H190 M175 72 H50" fill="none" stroke="currentColor" stroke-width="3"/><polyline points="179,18 191,28 179,38 M61,62 49,72 61,82" fill="none" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'transfer', sense: '转移', kind: '概念图',
      scene: '一个小圆从左侧容器移到右侧容器，原处空下。',
      cue: '追踪同一个对象的位置变化。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="22" y="28" width="58" height="54" rx="8" fill="none" stroke="currentColor" stroke-width="3"/><rect x="160" y="28" width="58" height="54" rx="8" fill="#e7ece8" stroke="currentColor" stroke-width="3"/><circle cx="189" cy="55" r="12" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><path d="M82 55 H147" stroke="currentColor" stroke-width="4"/><polyline points="136,44 149,55 136,66" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="51" cy="55" r="12" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 5"/></svg>'
    }),
    Object.freeze({
      word: 'reflect', sense: '反射', kind: '概念图',
      scene: '一束光碰到竖直镜面后，沿对称方向折返回去。',
      cue: '观察碰到表面前后的方向变化。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><line x1="168" y1="10" x2="168" y2="90" stroke="currentColor" stroke-width="5"/><path d="M30 78 L164 48 L58 18" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><polyline points="50,11 59,18 52,28" fill="none" stroke="currentColor" stroke-width="3"/><path d="M180 18 L190 28 M180 36 L190 46 M180 54 L190 64 M180 72 L190 82" stroke="currentColor" stroke-width="2" opacity="0.45"/></svg>'
    }),
    Object.freeze({
      word: 'parallel', sense: '平行', kind: '概念图',
      scene: '两条直线保持相同方向，向远处延伸也不相交。',
      cue: '比较两条线之间的距离是否改变。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><line x1="24" y1="30" x2="216" y2="30" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><line x1="24" y1="70" x2="216" y2="70" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><polyline points="205,19 217,30 205,41 M205,59 217,70 205,81" fill="none" stroke="currentColor" stroke-width="4"/><line x1="72" y1="30" x2="72" y2="70" stroke="currentColor" stroke-width="2" stroke-dasharray="3 5" opacity="0.45"/><line x1="168" y1="30" x2="168" y2="70" stroke="currentColor" stroke-width="2" stroke-dasharray="3 5" opacity="0.45"/></svg>'
    }),
    Object.freeze({
      word: 'concentrate', sense: '集中', kind: '概念图',
      scene: '四周的小点沿箭头汇到一个很小的中心区域。',
      cue: '看注意或数量最终落在多大范围。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="28" cy="18" r="5" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="82" r="5" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><circle cx="210" cy="20" r="5" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><circle cx="208" cy="80" r="5" fill="#eee9e2" stroke="currentColor" stroke-width="2"/><path d="M42 26 L105 45 M45 74 L105 55 M196 28 L135 45 M195 72 L135 55" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="120" cy="50" r="13" fill="#e5ebe6" stroke="currentColor" stroke-width="3"/><circle cx="120" cy="50" r="4" fill="currentColor"/></svg>'
    }),
    Object.freeze({
      word: 'distribute', sense: '分发', kind: '概念图',
      scene: '中心容器里的物品沿三条路线送到不同接收点。',
      cue: '看同一来源最后去了几个地方。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="99" y="34" width="42" height="32" rx="5" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><path d="M98 43 L54 20 M98 57 L54 80 M142 50 H190" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="38" cy="16" r="10" fill="#e7ece8" stroke="currentColor" stroke-width="2"/><circle cx="38" cy="84" r="10" fill="#e7ece8" stroke="currentColor" stroke-width="2"/><circle cx="206" cy="50" r="10" fill="#e7ece8" stroke="currentColor" stroke-width="2"/><polyline points="181,42 191,50 181,58" fill="none" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'accessible', sense: '可进入的', kind: '概念图',
      scene: '门口没有台阶，一条缓坡直接连到敞开的入口。',
      cue: '观察从地面到入口是否有可走通的路线。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="150" y="18" width="62" height="70" rx="3" fill="#eee9e2" stroke="currentColor" stroke-width="3"/><rect x="169" y="38" width="27" height="50" fill="#f7f7f4" stroke="currentColor" stroke-width="3"/><path d="M20 84 H82 L169 56" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M48 69 H86" stroke="currentColor" stroke-width="3"/><polyline points="76,60 87,69 76,78" fill="none" stroke="currentColor" stroke-width="3"/></svg>'
    }),
    Object.freeze({
      word: 'vulnerable', sense: '易受伤害的', kind: '概念图',
      scene: '盾牌已有裂缝，外来的箭正对着薄弱处。',
      cue: '留意保护结构中最容易被突破的位置。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M130 12 L178 27 V52 C178 73 158 87 130 94 C102 87 82 73 82 52 V27 Z" fill="#e7ece8" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M130 20 L119 42 L136 51 L123 78" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 49 H100" stroke="currentColor" stroke-width="4"/><polyline points="88,37 102,49 88,61" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="130" cy="49" r="5" fill="#eee9e2" stroke="currentColor" stroke-width="2"/></svg>'
    }),
    Object.freeze({
      word: 'underestimate', sense: '低估', kind: '概念图',
      scene: '虚线框只估到一半高度，实际柱体明显更高。',
      cue: '比较原先判断与真实大小的差距。',
      svg: '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="64" y="50" width="48" height="38" rx="4" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="6 6"/><rect x="128" y="14" width="48" height="74" rx="4" fill="#e5ebe6" stroke="currentColor" stroke-width="3"/><path d="M112 69 H128" stroke="currentColor" stroke-width="3"/><polyline points="120,61 129,69 120,77" fill="none" stroke="currentColor" stroke-width="3"/><line x1="48" y1="88" x2="192" y2="88" stroke="currentColor" stroke-width="3"/></svg>'
    })
  ]);

  const byWord = new Map(entries.map(entry => [entry.word, entry]));
  const api = {
    lookup(word) {
      if (typeof word !== 'string') return null;
      return byWord.get(word.trim().toLowerCase()) || null;
    },
    entries() {
      return entries;
    }
  };
  return Object.freeze(api);
});
