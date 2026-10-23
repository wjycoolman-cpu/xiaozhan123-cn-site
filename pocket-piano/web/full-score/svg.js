/* SVG from our formal engine/VexFlow only; remove active/external content before DOM/export. */
export function cleanScoreSVG(source){
 const xml=new DOMParser().parseFromString(String(source),'image/svg+xml');if(xml.querySelector('parsererror'))throw Error('谱面 SVG 无效');const svg=xml.documentElement;if(svg.localName!=='svg')throw Error('谱面未生成 SVG');
 for(const node of [...svg.querySelectorAll('script,foreignObject,iframe,object,embed,style,link')])node.remove();
 for(const node of [svg,...svg.querySelectorAll('*')])for(const attribute of [...node.attributes]){
  const name=attribute.name.toLowerCase(),value=attribute.value;
  if(name.startsWith('on')||name==='src'||name.endsWith('href')&&!value.startsWith('#'))node.removeAttribute(attribute.name);
  else if(name==='style'){for(const declaration of value.split(';')){const at=declaration.indexOf(':');if(at<0)continue;const property=declaration.slice(0,at).trim(),content=declaration.slice(at+1).trim();if(['fill','stroke','stroke-width','font-size','font-family','opacity','text-anchor','dominant-baseline'].includes(property)&&!/(?:https?:|javascript:|data:|@import)/i.test(content))node.setAttribute(property,content);}node.removeAttribute(attribute.name);}
  else if(name==='font-family'&&value.includes('ScoreSC'))node.setAttribute('font-family',"'Segoe UI','Microsoft YaHei',system-ui,sans-serif");
 }
 svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('viewBox','0 0 595 842');svg.setAttribute('width','595');svg.setAttribute('height','842');return svg;
}
export const serializeScoreSVG=svg=>new XMLSerializer().serializeToString(svg);
export function toDataURL(source){const bytes=new TextEncoder().encode(source);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return'data:image/svg+xml;base64,'+btoa(binary);}
