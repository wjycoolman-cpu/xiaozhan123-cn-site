/* Local document import. PDF.js Apache-2.0, fflate MIT. Licenses ship in assets/licenses. */
(function(){
  'use strict';
  const LIMIT=12*1024*1024;
  const text=(v,max=40000)=>typeof v==='string'?v.slice(0,max):'';
  function blank(){return {basics:{name:'',label:'',email:'',phone:'',url:'',summary:'',image:'',location:{city:'',address:''},birthDate:''},work:[],education:[],projects:[],skills:[],certificates:[],languages:[],awards:[],interests:[],custom:[]};}
  const fields={work:['name','position','startDate','endDate','summary','url','highlights'],education:['institution','area','studyType','startDate','endDate','score','summary'],projects:['name','description','url','startDate','endDate','highlights'],skills:['name','level','keywords'],certificates:['name','issuer','date','url'],languages:['language','fluency'],awards:['title','date','awarder','summary'],interests:['name','keywords'],custom:['title','content']};
  function normalize(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('文件里没有可用的简历资料。');
    const src=input.profile||input.resume||input;
    if(!src.basics&&!Object.keys(fields).some(k=>Array.isArray(src[k])))throw Error('这不是 JSON Resume 或本应用的备份文件。');
    const out=blank(),b=src.basics||{};
    for(const k of Object.keys(out.basics)){if(k!=='location')out.basics[k]=text(b[k],k==='image'?2000000:40000);}
    if(!/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(out.basics.image))out.basics.image='';
    const loc=b.location||{};out.basics.location={city:text(loc.city,300),address:text(loc.address,1000)};
    for(const [section,keys] of Object.entries(fields)){
      out[section]=(Array.isArray(src[section])?src[section]:[]).slice(0,100).filter(i=>i&&typeof i==='object'&&!Array.isArray(i)).map(i=>{
        const entry={};for(const k of keys)entry[k]=['highlights','keywords'].includes(k)?(Array.isArray(i[k])?i[k].filter(x=>typeof x==='string').map(x=>text(x,10000)).slice(0,50):[]):text(i[k]);return entry;
      });
    }
    return out;
  }
  function parseText(raw){
    const src=String(raw||'').replace(/\r/g,'').replace(/\u0000/g,'').slice(0,180000).trim();
    if(!src)throw Error('没有识别到文字，请选择有文字的文件，或直接粘贴信息。');
    const p=blank(),lines=src.split('\n').map(s=>s.trim()).filter(Boolean);
    const value=(re)=>{const m=src.match(re);return m?m[1].trim():'';};
    p.basics.name=value(/(?:姓名|名字|Name)\s*[:：]\s*([^\n|丨]{1,24})/i);
    p.basics.label=value(/(?:求职意向|意向岗位|应聘职位|职位|岗位|Title)\s*[:：]\s*([^\n|丨]+)/i);
    p.basics.email=value(/([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/);
    p.basics.phone=value(/((?:\+?86[\s-]?)?1[3-9]\d[\d\s-]{8,14}\d)/)||value(/(?:电话|手机|Phone)\s*[:：]\s*([+\d\s()-]{7,25})/i);
    p.basics.phone=p.basics.phone.replace(/\s/g,'');
    p.basics.location.city=value(/(?:所在城市|居住地|城市|City)\s*[:：]\s*([^\n|丨]+)/i);
    if(!p.basics.name&&lines[0]&&/^[\u4e00-\u9fff]{2,6}$/.test(lines[0]))p.basics.name=lines[0];
    const groups={summary:[],work:[],education:[],projects:[],skills:[],certificates:[],languages:[],awards:[],other:[]};
    const headings=[['summary',/^(个人简介|自我评价|个人优势|简介|个人总结|Summary|Profile|About me)$/i],['work',/^(工作经历|工作经验|实习经历|职业经历|Experience|Work experience|Employment)$/i],['education',/^(教育经历|教育背景|学历|Education)$/i],['projects',/^(项目经历|项目经验|个人项目|Projects)$/i],['skills',/^(专业技能|技能特长|个人技能|技能|Skills)$/i],['certificates',/^(证书|资质证书|资格证书|Certifications|Certificates)$/i],['languages',/^(语言能力|语言|Languages)$/i],['awards',/^(荣誉奖项|获奖经历|奖项|Awards)$/i]];
    let area='other';
    for(const line of lines){
      const cleaned=line.replace(/^[#•·\d.、\s]+/,'').replace(/[：:]$/,'').trim();
      const h=headings.find(([,re])=>re.test(cleaned));if(h){area=h[0];continue;}
      const inline=line.match(/^([^：:]{2,16})[：:]\s*(.*)$/);const hi=inline&&headings.find(([,re])=>re.test(inline[1]));
      if(hi){area=hi[0];if(inline[2])groups[area].push(inline[2]);continue;}
      groups[area].push(line);
    }
    p.basics.summary=groups.summary.join('\n');
    const dates=/((?:19|20)\d{2}[.年/-]?\d{0,2})\s*(?:月)?\s*[-—–~至]\s*((?:19|20)\d{2}[.年/-]?\d{0,2}|至今|现在|Present)/i;
    function entries(arr,kind){
      if(!arr.length)return [];
      const result=[];let entry=null;
      for(const line of arr){
        const m=line.match(dates);
        if(m||!entry){
          const rest=line.replace(dates,'').replace(/[|丨：:]/g,' · ').trim().replace(/^[\s·-]+|[\s·-]+$/g,'');
          const parts=rest.split(/\s*·\s*/).filter(Boolean);
          entry=kind==='work'?{name:parts[0]||'请补充单位名称',position:parts[1]||'',startDate:m?m[1]:'',endDate:m?m[2]:'',summary:'',highlights:[]}:kind==='education'?{institution:parts[0]||'请补充学校名称',area:parts[1]||'',studyType:'',startDate:m?m[1]:'',endDate:m?m[2]:'',score:'',summary:''}:{name:rest||'请补充项目名称',description:'',url:'',startDate:m?m[1]:'',endDate:m?m[2]:'',highlights:[]};
          result.push(entry);
        }else{
          const k=kind==='projects'?'description':'summary';entry[k]+=(entry[k]?'\n':'')+line.replace(/^[•·]\s*/,'');
        }
      }
      return result.slice(0,100);
    }
    p.work=entries(groups.work,'work');p.education=entries(groups.education,'education');p.projects=entries(groups.projects,'projects');
    if(groups.skills.length)p.skills=[{name:'专业技能',level:'',keywords:groups.skills.join('、').split(/[、,，;；\n]/).map(s=>s.trim()).filter(Boolean).slice(0,50)}];
    p.certificates=groups.certificates.map(name=>({name,issuer:'',date:'',url:''})).slice(0,100);
    p.languages=groups.languages.map(language=>({language,fluency:''})).slice(0,30);
    p.awards=groups.awards.map(title=>({title,awarder:'',date:'',summary:''})).slice(0,100);
    const leftovers=groups.other.filter(l=>!l.includes(p.basics.email||'\u0000')&&!l.includes(p.basics.phone||'\u0000')&&!l.match(/^(姓名|名字|Name|求职意向|意向岗位|应聘职位|职位|岗位|Title|城市|居住地|所在城市|电话|手机)\s*[:：]/i)&&l!==p.basics.name);
    if(leftovers.length)p.custom.push({title:'导入待整理',content:leftovers.join('\n')});
    return {profile:p,text:src,warnings:['离线识别按标题和文字规律提取，请检查姓名、日期与经历。未匹配的文字保存在“自定义／导入待整理”中。']};
  }
  async function extractDocx(bytes){
    if(!window.fflate)throw Error('文档读取组件没有加载，请重新打开应用。');
    const files=await new Promise((resolve,reject)=>window.fflate.unzip(bytes,{filter:f=>f.name==='word/document.xml'&&f.originalSize<4*1024*1024},(e,d)=>e?reject(e):resolve(d)));
    if(!files['word/document.xml'])throw Error('文件里没有可读取的 Word 正文，或正文过大。');
    const xml=new TextDecoder().decode(files['word/document.xml']);const dom=new DOMParser().parseFromString(xml,'application/xml');
    if(dom.querySelector('parsererror'))throw Error('Word 文件内容损坏，无法读取。');
    return [...dom.getElementsByTagName('w:p')].map(p=>[...p.getElementsByTagName('w:t')].map(t=>t.textContent).join('')).join('\n');
  }
  async function extractPdf(bytes,progress){
    const pdfjs=await import('./vendor/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',location.href).href;
    const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:true,disableFontFace:true,cMapUrl:new URL('./vendor/cmaps/',location.href).href,cMapPacked:true,stopAtErrors:false});
    let doc;
    try{
      doc=await task.promise;if(doc.numPages>30)throw Error('请导入 30 页以内的简历 PDF。');
      const pages=[];
      for(let n=1;n<=doc.numPages;n++){
        if(progress)progress('读取 PDF：'+n+' / '+doc.numPages+' 页');
        const page=await doc.getPage(n);const content=await page.getTextContent();let out='',previousY=null;
        for(const item of content.items){if(!item.str)continue;const y=item.transform&&item.transform[5];if(previousY!==null&&Math.abs(previousY-y)>4)out+='\n';else if(out&&!out.endsWith('\n'))out+=' ';out+=item.str;if(item.hasEOL)out+='\n';previousY=y;}
        pages.push(out);page.cleanup();
      }
      const output=pages.join('\n');if(output.replace(/\s/g,'').length<12)throw Error('这份 PDF 主要是扫描图片，没有可提取的文字。请使用文字版 PDF、Word 或粘贴资料；本版本未包含图片 OCR。');
      return output;
    }catch(e){if(/password|Password/i.test(e.message||''))throw Error('PDF 设置了密码，请先导出无密码的副本再导入。');throw e;}
    finally{await task.destroy();}
  }
  async function readFile(file,progress){
    if(!file)throw Error('未选择文件。');if(file.size>LIMIT)throw Error('文件较大，请选择 12 MB 以内的文件。');
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(ext==='json'){
      const json=JSON.parse(await file.text());
      if(json.format==='resume-studio-backup'&&Array.isArray(json.resumes)){
        const records=json.resumes.slice(0,50).map(r=>({title:text(r.title,80)||'导入的简历',profile:normalize(r.profile),templateId:text(r.templateId,10),settings:r.settings&&typeof r.settings==='object'?r.settings:{}}));
        if(!records.length)throw Error('备份中没有简历。');return {kind:'backup',records,favorites:Array.isArray(json.favorites)?json.favorites:[],warnings:[]};
      }
      return {kind:'profile',profile:normalize(json),text:'JSON 结构化资料',warnings:[]};
    }
    const bytes=new Uint8Array(await file.arrayBuffer());let raw;
    if(ext==='docx')raw=await extractDocx(bytes);
    else if(ext==='pdf')raw=await extractPdf(bytes,progress);
    else if(ext==='txt'){
      raw=new TextDecoder('utf-8').decode(bytes);if(raw.includes('\uFFFD')){try{raw=new TextDecoder('gb18030').decode(bytes);}catch(_){}}
    }else throw Error('支持 JSON、TXT、Word DOCX 和文字版 PDF；旧版 DOC 请先另存为 DOCX。');
    return {kind:'profile',...parseText(raw)};
  }
  window.ResumeImport={blank,normalize,parseText,readFile};
})();
