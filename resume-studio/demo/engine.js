/*
 * Resume Workshop offline HTML renderer.
 * Adapted layout components: Reactive Resume Onyx and Azurill templates.
 * Upstream: https://github.com/reactive-resume/reactive-resume
 * Commit: ba4bec2bd8fef665629d5a4092e1ecfcd5c6880e
 * Reused: horizontal identity / wrapping contacts / primary header rule,
 * centred identity / two content columns, and outlined timeline markers.
 * Replaced React/Forme nodes with semantic HTML, JSON Resume mapping and CSS
 * page fragmentation for Android WebView PrintDocumentAdapter.
 *
 * MIT License
 * Copyright (c) 2026 Amruth Pillai
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function (global) {
  'use strict';

  const SECTION_KEYS = ['summary', 'work', 'education', 'projects', 'skills', 'certificates', 'languages', 'awards', 'interests', 'custom'];
  const SECTION_LABELS = { summary: '个人简介', work: '工作经历', education: '教育背景', projects: '项目经历', skills: '专业技能', certificates: '证书资质', languages: '语言能力', awards: '荣誉奖项', interests: '兴趣特长', custom: '补充信息' };
  const PALETTES = [
    ['墨色', '#273444'], ['海军蓝', '#244b73'], ['松石', '#176b68'], ['森绿', '#37634a'], ['勃艮第', '#813c4d'],
    ['石墨', '#4a515c'], ['靛蓝', '#4b4f91'], ['孔雀蓝', '#19738a'], ['橄榄', '#65713c'], ['栗棕', '#79553e'],
    ['午夜', '#203956'], ['雾蓝', '#466782'], ['雪松', '#3f7268'], ['苔绿', '#58784d'], ['梅紫', '#735079'],
    ['岩灰', '#5d6266'], ['群青', '#334c9b'], ['湖青', '#1d7380'], ['铜褐', '#99623c'], ['莓红', '#984557'],
    ['铅灰', '#414e5e'], ['宝蓝', '#2b6196'], ['深海', '#126869'], ['棕榈', '#476742'], ['紫罗兰', '#71588c']
  ];
  const MOODS = [
    { name: '标准', density: 1, weight: 650, tracking: 0.01, font: 'sans', radius: 2 },
    { name: '紧凑', density: 0.78, weight: 700, tracking: 0, font: 'sans', radius: 0 },
    { name: '舒展', density: 1.24, weight: 550, tracking: 0.045, font: 'sans', radius: 5 },
    { name: '书卷', density: 1.07, weight: 650, tracking: 0.025, font: 'serif', radius: 0 },
    { name: '明晰', density: 0.92, weight: 800, tracking: 0.02, font: 'sans', radius: 7 }
  ];

  // Each row is a real layout family; palette + typographic presets produce 25
  // variations per family. This is deliberately not 1,000 independent designs.
  const familyRows = [
    ['墨石经典', '简洁', 'single', 'split', 'rule', 'plain', 'tags', '横排身份、细主题线、纵向信息组', 'Onyx'],
    ['居中留白', '简洁', 'single', 'center', 'center', 'plain', 'inline', '居中姓名与栏目、对称留白'],
    ['无界极简', '简洁', 'single', 'minimal', 'plain', 'plain', 'inline', '无框单栏、小字号联系行'],
    ['学术双线', '学术', 'single', 'academic', 'double', 'citation', 'inline', '衬线身份、双线分隔、学术条目'],
    ['精练一页', '简洁', 'single', 'compact', 'small', 'compact', 'inline', '紧凑页首、细小栏目、压缩条目间距'],
    ['编辑手记', '创意', 'single', 'editorial', 'bar', 'citation', 'tags', '大字姓名、左侧栏目竖色条、衬线正文'],
    ['左侧索引', '商务', 'rail-left', 'split', 'plain', 'plain', 'inline', '左侧栏目索引与右侧内容构成横行'],
    ['右侧索引', '创意', 'rail-right', 'right', 'plain', 'plain', 'tags', '右侧栏目索引与左侧正文构成横行'],
    ['页首框线', '商务', 'single', 'frame', 'rule', 'plain', 'outline', '页首双边框、栏目细线、技能描边'],
    ['技术文档', '简洁', 'single', 'mono', 'mono', 'compact', 'inline', '等宽拉丁字形、编号式栏目与紧凑条目'],
    ['浅色左栏', '商务', 'sidebar-left', 'aside', 'rule', 'plain', 'tags', '浅色身份左栏、正文右栏'],
    ['浅色右栏', '商务', 'sidebar-right', 'aside', 'rule', 'plain', 'tags', '浅色身份右栏、正文左栏'],
    ['蓝宝石双栏', '商务', 'columns', 'center', 'rule', 'plain', 'inline', '居中身份、双栏连续正文', 'Azurill'],
    ['深色左栏', '商务', 'sidebar-left', 'aside-dark', 'bar', 'plain', 'outline', '深色身份左栏、主题栏目色条'],
    ['深色右栏', '商务', 'sidebar-right', 'aside-dark', 'bar', 'plain', 'outline', '深色身份右栏、主题栏目色条'],
    ['窄栏商务', '商务', 'sidebar-left-narrow', 'aside-narrow', 'small', 'compact', 'inline', '窄幅身份栏与宽幅密集正文'],
    ['肖像页首', '应届', 'single', 'portrait', 'bar', 'plain', 'tags', '页首大肖像与大字身份、左侧色条栏目'],
    ['主题顶栏', '商务', 'single', 'band', 'rule', 'plain', 'tags', '整幅主题色页首与白色身份字'],
    ['沉稳顶栏', '商务', 'single', 'dark-band', 'small', 'compact', 'outline', '深墨页首、紧凑商务栏目'],
    ['分层页首', '创意', 'single', 'strip', 'pill', 'plain', 'tags', '身份与联系人分层、胶囊栏目标题'],
    ['双列技能', '简洁', 'single', 'split', 'rule', 'plain', 'grid', '单栏经历、两列独立技能组'],
    ['能力方框', '商务', 'single', 'right', 'box', 'plain', 'outline', '右对齐身份、描边栏目与能力标签'],
    ['能力清单', '简洁', 'columns', 'minimal', 'small', 'compact', 'list', '紧凑双栏正文、线性能力清单'],
    ['应届清新', '应届', 'single', 'graduate', 'pill', 'plain', 'grid', '居中清新页首、圆角栏目、双列能力'],
    ['圆点时间轴', '时间线', 'single', 'center', 'rule', 'timeline', 'tags', '空心节点与左侧连续时间轴', 'Azurill timeline'],
    ['右侧时间轴', '时间线', 'single', 'right', 'bar', 'timeline-right', 'inline', '正文右侧时间线与节点'],
    ['日期轨迹', '时间线', 'single', 'split', 'small', 'date-rail', 'tags', '日期独占左轨、节点承接经历正文'],
    ['虚线轨迹', '时间线', 'single', 'minimal', 'pill', 'timeline-dotted', 'outline', '虚线时间轴、胶囊栏目与描边标签'],
    ['经历卡片', '创意', 'single', 'strip', 'plain', 'cards', 'grid', '每段经历采用浅底卡片与双列技能'],
    ['学术边注', '学术', 'sidebar-right', 'aside-academic', 'double', 'citation', 'inline', '右侧身份边注、衬线与双线学术栏目'],
    ['研究序列', '学术', 'single', 'academic', 'numbered', 'numbered', 'inline', '编号栏目与编号研究条目'],
    ['商务色带', '商务', 'single', 'compact', 'band', 'plain', 'list', '每个栏目采用横向浅色带'],
    ['右齐商务', '商务', 'single', 'right', 'rule-right', 'compact', 'inline', '右齐身份与右齐栏目标题、细线分隔'],
    ['创意拼接', '创意', 'rail-left', 'editorial', 'box', 'cards', 'outline', '左索引方框与右侧卡片内容'],
    ['垂直名片', '创意', 'sidebar-left', 'aside-card', 'pill', 'plain', 'grid', '名片式身份栏与圆角栏目'],
    ['转角留白', '创意', 'single', 'corner', 'bar', 'plain', 'outline', '页首转角框与较宽姓名留白'],
    ['几何序号', '创意', 'single', 'geometric', 'numbered', 'plain', 'tags', '几何色条页首与圆形序号栏目'],
    ['项目札记', '应届', 'single', 'portrait', 'box', 'project-cards', 'grid', '肖像页首、项目卡片、双列技能'],
    ['左右名片', '商务', 'single', 'contact-right', 'bar', 'plain', 'list', '身份左置、联系人独立右置'],
    ['打印清单', '简洁', 'single', 'minimal', 'double', 'compact', 'grid', '纯白简洁正文、细双线与双列技能']
  ];
  const families = familyRows.map(function (row, index) {
    return { id: 'f' + String(index + 1).padStart(2, '0'), name: row[0], category: row[1], layout: row[2], header: row[3], heading: row[4], entry: row[5], skill: row[6], description: row[7], source: row[8] || 'Resume Workshop variation', tags: [row[1], row[2].indexOf('sidebar') === 0 ? '侧栏' : row[2] === 'columns' ? '双栏' : '单栏', index === 0 || index === 2 || index === 39 ? 'ATS友好' : '视觉排版'] };
  });
  const templates = [];
  const templateMap = Object.create(null);
  families.forEach(function (family, fi) {
    PALETTES.forEach(function (palette, pi) {
      const mood = MOODS[Math.floor(pi / 5)];
      const id = 't' + String(fi * 25 + pi + 1).padStart(4, '0');
      const template = { id: id, name: family.name + ' · ' + palette[0] + ' ' + mood.name, familyId: family.id, familyName: family.name, category: family.category, tags: family.tags.concat([mood.name, palette[0]]), accent: palette[1], paletteName: palette[0], presetName: mood.name, description: family.description, variant: pi };
      templates.push(template);
      templateMap[id] = { template: template, family: family, mood: mood };
    });
  });

  function plain(value) {
    if (value === undefined || value === null || typeof value === 'object' || typeof value === 'function') return '';
    return String(value);
  }
  function escape(value) {
    return plain(value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function text(value) { return escape(value).replace(/\r\n|\r|\n/g, '<br>'); }
  function nonempty(value) { return plain(value).trim() !== ''; }
  function objects(value) { return Array.isArray(value) ? value.filter(function (v) { return v && typeof v === 'object' && !Array.isArray(v); }) : []; }
  function strings(value) { return Array.isArray(value) ? value.filter(nonempty).map(plain) : []; }
  function first() {
    for (let i = 0; i < arguments.length; i++) if (nonempty(arguments[i])) return plain(arguments[i]);
    return '';
  }
  function color(value, fallback) {
    const raw = plain(value).trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(raw)) return '#' + raw.slice(1).split('').map(function (c) { return c + c; }).join('').toLowerCase();
    return fallback;
  }
  function blend(hex, whiteAmount) {
    const rgb = [1, 3, 5].map(function (n) { return Math.round(parseInt(hex.slice(n, n + 2), 16) * (1 - whiteAmount) + 255 * whiteAmount); });
    return '#' + rgb.map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }
  function contrast(hex) {
    const values = [1, 3, 5].map(function (n) { const s = parseInt(hex.slice(n, n + 2), 16) / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722 > 0.179 ? '#17212b' : '#ffffff';
  }
  function finiteNumber(value, fallback, min, max) {
    const parsed = Number(value);
    return value !== null && value !== '' && Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }
  function safeUrl(value) {
    const raw = plain(value).trim();
    return /^https?:\/\/[^\s<>"'\\]+$/i.test(raw) && !/[\u0000-\u001f\u007f]/.test(raw) ? raw : '';
  }
  function safeImage(value) {
    const raw = plain(value).trim();
    // Raster-only data URLs: SVG can contain executable or external content.
    if (raw.length > 20 * 1024 * 1024) return '';
    return /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\r\n]+$/i.test(raw) ? raw.replace(/[\r\n]/g, '') : '';
  }
  function link(value, label) {
    const url = safeUrl(value);
    if (!url) return nonempty(label || value) ? '<span class="url-text">' + text(label || value) + '</span>' : '';
    return '<a href="' + escape(url) + '" rel="noopener noreferrer">' + text(label || value) + '</a>';
  }
  function dateRange(entry) {
    const start = plain(entry.startDate), end = plain(entry.endDate);
    return start && end ? start + ' — ' + end : start || end;
  }
  function paragraphs(value, cls) {
    return nonempty(value) ? '<p class="' + (cls || 'description') + '">' + text(value) + '</p>' : '';
  }
  function bullets(value) {
    const items = strings(value);
    return items.length ? '<ul class="highlights">' + items.map(function (v) { return '<li>' + text(v) + '</li>'; }).join('') + '</ul>' : '';
  }
  function keywordList(value) {
    const keywords = strings(value);
    return keywords.length ? '<div class="keywords">' + keywords.map(function (v) { return '<span class="keyword">' + text(v) + '</span>'; }).join('') + '</div>' : '';
  }
  function hasData(entry, keys) {
    return keys.some(function (k) { return Array.isArray(entry[k]) ? strings(entry[k]).length > 0 : nonempty(entry[k]); });
  }
  function entryHeading(title, subtitle, date, url) {
    const titlePart = nonempty(title) ? '<h3>' + text(title) + '</h3>' : '';
    const datePart = nonempty(date) ? '<div class="entry-date">' + text(date) + '</div>' : '';
    const subPart = nonempty(subtitle) ? '<div class="entry-subtitle">' + text(subtitle) + '</div>' : '';
    const linkPart = nonempty(url) ? '<div class="entry-url">' + link(url) + '</div>' : '';
    return '<div class="entry-heading">' + titlePart + datePart + subPart + linkPart + '</div>';
  }
  function entry(content, cls) { return '<div class="resume-entry ' + (cls || '') + '">' + content + '</div>'; }

  function renderSection(key, profile) {
    const basics = profile.basics && typeof profile.basics === 'object' ? profile.basics : {};
    if (key === 'summary') return paragraphs(basics.summary, 'summary-text');
    if (key === 'work') return objects(profile.work).filter(function (v) { return hasData(v, ['name', 'company', 'position', 'startDate', 'endDate', 'summary', 'highlights']); }).map(function (v) {
      return entry(entryHeading(first(v.position, v.name, v.company), v.position ? first(v.name, v.company) : '', dateRange(v)) + paragraphs(v.summary) + bullets(v.highlights));
    }).join('');
    if (key === 'education') return objects(profile.education).filter(function (v) { return hasData(v, ['institution', 'area', 'studyType', 'startDate', 'endDate', 'score', 'summary', 'courses']); }).map(function (v) {
      const detail = [plain(v.studyType), plain(v.area)].filter(Boolean).join(' · ');
      return entry(entryHeading(v.institution, detail, dateRange(v)) + (nonempty(v.score) ? '<p class="education-score">成绩：' + text(v.score) + '</p>' : '') + paragraphs(v.summary) + keywordList(v.courses));
    }).join('');
    if (key === 'projects') return objects(profile.projects).filter(function (v) { return hasData(v, ['name', 'description', 'summary', 'url', 'startDate', 'endDate', 'highlights']); }).map(function (v) {
      return entry(entryHeading(v.name, first(v.entity, v.role), dateRange(v), v.url) + paragraphs(first(v.description, v.summary)) + bullets(v.highlights), 'project-entry');
    }).join('');
    if (key === 'skills') {
      const skills = objects(profile.skills).filter(function (v) { return hasData(v, ['name', 'level', 'keywords']); });
      return skills.length ? '<div class="skill-groups">' + skills.map(function (v) {
        return '<div class="skill-group"><div class="skill-heading">' + (nonempty(v.name) ? '<h3>' + text(v.name) + '</h3>' : '') + (nonempty(v.level) ? '<span class="skill-level">' + text(v.level) + '</span>' : '') + '</div>' + keywordList(v.keywords) + '</div>';
      }).join('') + '</div>' : '';
    }
    if (key === 'certificates') return objects(profile.certificates).filter(function (v) { return hasData(v, ['name', 'issuer', 'date', 'url']); }).map(function (v) {
      return entry(entryHeading(v.name, v.issuer, v.date, v.url), 'small-entry');
    }).join('');
    if (key === 'languages') {
      const languages = objects(profile.languages).filter(function (v) { return hasData(v, ['language', 'fluency']); });
      return languages.length ? '<div class="language-groups">' + languages.map(function (v) { return '<div class="language-item"><strong>' + text(v.language) + '</strong>' + (nonempty(v.fluency) ? '<span>' + text(v.fluency) + '</span>' : '') + '</div>'; }).join('') + '</div>' : '';
    }
    if (key === 'awards') return objects(profile.awards).filter(function (v) { return hasData(v, ['title', 'name', 'date', 'awarder', 'summary']); }).map(function (v) {
      return entry(entryHeading(first(v.title, v.name), v.awarder, v.date) + paragraphs(v.summary), 'small-entry');
    }).join('');
    if (key === 'interests') return objects(profile.interests).filter(function (v) { return hasData(v, ['name', 'keywords']); }).map(function (v) {
      return '<div class="interest-item">' + (nonempty(v.name) ? '<strong>' + text(v.name) + '</strong>' : '') + keywordList(v.keywords) + '</div>';
    }).join('');
    if (key === 'custom') return objects(profile.custom).filter(function (v) { return hasData(v, ['title', 'content']); }).map(function (v) {
      return entry((nonempty(v.title) ? '<h3 class="custom-title">' + text(v.title) + '</h3>' : '') + paragraphs(v.content, 'custom-content'));
    }).join('');
    return '';
  }
  function sectionOrder(settings) {
    const raw = Array.isArray(settings.sectionOrder) ? settings.sectionOrder : SECTION_KEYS;
    const result = [];
    raw.concat(SECTION_KEYS).forEach(function (key) { if (SECTION_KEYS.indexOf(key) !== -1 && result.indexOf(key) === -1) result.push(key); });
    return result;
  }
  function header(basics, settings, family) {
    const location = basics.location && typeof basics.location === 'object' ? basics.location : {};
    const contacts = [];
    function contact(value, label) { if (nonempty(value)) contacts.push('<span class="contact-item">' + (label ? '<span class="contact-label">' + label + '</span>' : '') + text(value) + '</span>'); }
    contact(basics.phone, '电话 ');
    contact(basics.email, '邮箱 ');
    const place = [plain(location.city), plain(location.address)].filter(Boolean).join(' · ');
    contact(place, '');
    if (nonempty(basics.url)) contacts.push('<span class="contact-item contact-url">' + link(basics.url) + '</span>');
    contact(basics.birthDate, '出生日期 ');
    objects(basics.profiles).forEach(function (v) {
      const label = [plain(v.network), plain(v.username)].filter(Boolean).join('：');
      if (nonempty(v.url) || label) contacts.push('<span class="contact-item contact-url">' + (nonempty(v.url) ? link(v.url, label || v.url) : text(label)) + '</span>');
    });
    const portrait = settings.photoEnabled !== false ? safeImage(first(basics.image, basics.photo)) : '';
    const photo = portrait ? '<img class="portrait photo-' + settings.photoShape + '" src="' + escape(portrait) + '" alt="' + escape(nonempty(basics.name) ? basics.name + '的照片' : '简历照片') + '">' : '';
    const title = '<div class="identity-title">' + (nonempty(basics.name) ? '<h1>' + text(basics.name) + '</h1>' : '') + (nonempty(basics.label) ? '<p class="role">' + text(basics.label) + '</p>' : '') + '</div>';
    if (!photo && !nonempty(basics.name) && !nonempty(basics.label) && !contacts.length) return '';
    return '<header class="identity header-' + family.header + (portrait ? ' with-photo' : ' without-photo') + '">' + photo + title + (contacts.length ? '<div class="contacts">' + contacts.join('') + '</div>' : '') + '</header>';
  }

  const BASE_CSS = String.raw`
*{box-sizing:border-box}html{color-scheme:light}body{margin:0;background:#e9edf2;color:var(--ink,#263444);font-family:var(--font);font-size:var(--font-size);line-height:var(--line-height);-webkit-print-color-adjust:exact;print-color-adjust:exact}.resume-sheet{width:210mm;min-height:297mm;margin:0 auto;padding:var(--page-padding);background:#fff;box-shadow:0 4px 30px #15263815;position:relative;overflow:visible}.resume-sheet::after{content:'';display:block;clear:both}a{color:inherit;text-decoration:none;overflow-wrap:anywhere;word-break:normal}p,h1,h2,h3,ul{margin:0}p,li,.contact-item,.entry-subtitle,.entry-date,.skill-level,.keyword,.language-item,.url-text{overflow-wrap:anywhere;word-break:normal}p{orphans:2;widows:2}h1,h2,h3{overflow-wrap:anywhere;word-break:normal}h1{font-size:2.45em;font-weight:750;line-height:1.22;letter-spacing:var(--tracking);color:var(--ink)}h2{font-size:1.17em;line-height:1.35;font-weight:var(--heading-weight);letter-spacing:var(--tracking)}h3{font-size:1.04em;font-weight:650;line-height:1.42}.identity{margin:0 0 calc(22px * var(--density));padding-bottom:calc(16px * var(--density));border-bottom:1pt solid var(--accent);break-inside:auto;page-break-inside:auto}.identity-title{min-width:0}.role{font-size:1.18em;margin-top:5px;color:var(--accent);font-weight:550}.contacts{display:flex;flex-wrap:wrap;gap:5px 16px;font-size:.88em;color:#536172;margin-top:10px;align-items:flex-start}.contact-item{max-width:100%;min-width:0}.contact-label{color:inherit;opacity:.75}.portrait{width:74px;height:94px;object-fit:cover;border:1px solid var(--line);background:#f0f3f6;float:right;margin:0 0 12px 20px;break-inside:avoid;page-break-inside:avoid}.photo-circle{width:86px;height:86px;border-radius:50%}.photo-rounded{border-radius:12px}.photo-square{border-radius:0}.identity::after{content:'';display:block;clear:both}.header-split{padding-bottom:calc(20px * var(--density))}.header-center{text-align:center}.header-center .contacts,.header-academic .contacts,.header-graduate .contacts{justify-content:center}.header-center .portrait,.header-academic .portrait,.header-graduate .portrait{float:none;display:block;margin:0 auto 13px}.header-minimal{border-bottom:0;padding-bottom:6px}.header-minimal h1{font-size:2.15em;letter-spacing:-.02em}.header-minimal .contacts{margin-top:7px;gap:4px 13px}.header-academic{text-align:center;border-bottom:3px double var(--accent);font-family:var(--serif-font)}.header-academic h1{font-size:2.25em;font-family:var(--serif-font)}.header-compact{padding-bottom:12px;margin-bottom:15px}.header-compact h1{font-size:2em;display:inline-block;margin-right:16px}.header-compact .role{display:inline-block;font-size:1.05em}.header-compact .contacts{margin-top:6px}.header-editorial{border-bottom:0;border-left:5px solid var(--accent);padding:2px 0 10px 19px}.header-editorial h1{font-size:3.2em;font-family:var(--serif-font);letter-spacing:-.01em}.header-frame{border:1.5px solid var(--accent);border-left:6px solid var(--accent);padding:19px 22px}.header-mono{font-family:var(--mono-font);border-bottom:2px solid var(--accent)}.header-mono h1{font-size:2.1em}.header-right{text-align:right}.header-right .portrait{float:left;margin:0 20px 12px 0}.header-right .contacts{justify-content:flex-end}.header-portrait{min-height:116px;border-bottom:0;padding:9px 0 20px}.header-portrait h1{font-size:3em}.header-portrait .portrait{width:90px;height:116px}.header-portrait .photo-circle{height:90px}.header-band,.header-dark-band{padding:24px 26px;background:var(--accent);border:0;color:var(--on-accent)}.header-band h1,.header-band .role,.header-band .contacts{color:var(--on-accent)}.header-band .portrait{border-color:var(--on-accent)}.header-dark-band{background:var(--ink);color:#fff;border-left:7px solid var(--accent)}.header-dark-band h1,.header-dark-band .contacts{color:#fff}.header-dark-band .role{color:var(--soft)}.header-strip{border-bottom:0;background:var(--soft);padding:20px 22px 0}.header-strip .contacts{background:#fff;border-top:1px solid var(--line);padding:11px 0 4px;margin-top:18px}.header-graduate{text-align:center;border-bottom:0;background:var(--soft);padding:20px;border-radius:10px}.header-graduate h1{font-size:2.65em}.header-corner{border-top:4px solid var(--accent);border-left:4px solid var(--accent);border-bottom:0;padding:20px 0 12px 24px}.header-corner h1{font-size:3.15em}.header-geometric{border-bottom:0;border-top:10px solid var(--accent);padding-top:20px;background:linear-gradient(90deg,var(--soft) 0,var(--soft) 24%,#fff 24%);padding-left:20px}.header-contact-right{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.9fr);column-gap:28px;align-items:start}.header-contact-right .contacts{display:block;margin-top:1px;border-left:1px solid var(--line);padding-left:22px}.header-contact-right .contact-item{display:block;margin-bottom:5px}.header-contact-right .portrait{grid-row:1 / span 2;float:none;grid-column:1;margin-left:0}.header-contact-right.with-photo{grid-template-columns:80px minmax(0,1fr) minmax(0,1.2fr)}.header-contact-right.with-photo .identity-title{grid-column:2}.header-contact-right.with-photo .contacts{grid-column:3}
.resume-content{min-width:0;counter-reset:section}.resume-section{margin-bottom:calc(21px * var(--density));break-inside:auto;page-break-inside:auto;min-width:0;counter-increment:section}.section-title{color:var(--accent);margin-bottom:calc(10px * var(--density));padding-bottom:5px;border-bottom:1px solid var(--line);break-after:avoid;page-break-after:avoid;break-inside:avoid;page-break-inside:avoid}.section-body{min-width:0}.resume-entry{margin-bottom:calc(13px * var(--density));break-inside:auto;page-break-inside:auto;min-width:0}.resume-entry:last-child{margin-bottom:0}.entry-heading{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:14px;row-gap:2px;break-inside:avoid;page-break-inside:avoid;break-after:avoid;page-break-after:avoid;min-width:0}.entry-heading h3{grid-column:1}.entry-date{grid-column:2;grid-row:1;font-size:.86em;color:#607081;text-align:right;max-width:190px;padding-top:1px}.entry-subtitle{grid-column:1 / -1;font-size:.93em;color:#657281}.entry-url{grid-column:1 / -1;font-size:.83em;color:var(--accent);margin-top:1px;min-width:0}.description,.summary-text,.custom-content,.education-score{margin-top:6px}.summary-text{margin-top:0}.education-score{font-size:.92em;color:#657281}.highlights{padding-left:1.5em;margin-top:5px}.highlights li{padding-left:2px;margin-bottom:3px;break-inside:auto;page-break-inside:auto;orphans:2;widows:2}.highlights li::marker{color:var(--accent)}.keywords{display:flex;flex-wrap:wrap;gap:5px 6px;margin-top:6px}.keyword{font-size:.9em;line-height:1.5;background:var(--soft);border-radius:var(--radius);padding:2px 8px;color:var(--accent);max-width:100%;break-inside:auto}.skill-group{margin-bottom:10px;min-width:0;break-inside:auto;page-break-inside:auto}.skill-heading{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:2px 10px}.skill-level{font-size:.84em;color:#697586}.language-groups{display:flex;flex-wrap:wrap;gap:9px 27px}.language-item{display:flex;gap:11px;flex-wrap:wrap}.language-item span{color:#697586;font-size:.91em}.interest-item{margin-bottom:10px}.interest-item .keywords{display:inline-flex;margin:0 0 0 10px}.custom-title{margin-bottom:4px}
.heading-center .section-title{text-align:center;border-bottom:0;position:relative;padding:0 20px}.heading-center .section-title::before,.heading-center .section-title::after{content:'';display:inline-block;vertical-align:middle;background:var(--line);width:30px;height:1px;margin:0 12px}.heading-plain .section-title{border:0;padding-bottom:0}.heading-double .section-title{border-bottom:3px double var(--line);padding-bottom:6px}.heading-small .section-title{font-size:1em;border:0;padding-bottom:0;letter-spacing:.06em}.heading-bar .section-title{border-bottom:0;border-left:3px solid var(--accent);padding:1px 0 1px 10px}.heading-mono .section-title{font-family:var(--mono-font);font-size:1.04em;border-bottom:1px dashed var(--line)}.heading-mono .section-title::before{content:'// ';font-weight:400}.heading-pill .section-title{display:inline-block;border:0;background:var(--soft);border-radius:18px;padding:4px 14px;font-size:1.03em}.heading-box .section-title{border:1px solid var(--accent);padding:6px 10px;font-size:1.04em}.heading-band .section-title{border:0;background:var(--soft);padding:7px 12px}.heading-rule-right .section-title{text-align:right;border-bottom:1px solid var(--line)}.heading-numbered .section-title{border:0;display:flex;align-items:baseline;gap:10px}.heading-numbered .section-title::before{content:counter(section,decimal-leading-zero);border:1px solid var(--accent);border-radius:50%;font-size:.8em;width:27px;min-width:27px;height:27px;line-height:25px;text-align:center;font-weight:500}
/* Keep rail content in block flow: a multi-page grid row can move the whole first section to page two. */
.layout-rail-left .resume-section,.layout-rail-right .resume-section{display:block;position:relative;min-height:1.5em;padding-bottom:15px;border-bottom:1px solid var(--line)}.layout-rail-left .section-title,.layout-rail-right .section-title{position:absolute;top:0;width:23%;border:0;margin:0;font-size:1.05em}.layout-rail-left .section-title{left:0}.layout-rail-left .section-body{margin-left:calc(23% + 23px)}.layout-rail-right .section-title{right:0;text-align:right}.layout-rail-right .section-body{margin-right:calc(23% + 23px)}.layout-columns .resume-content{column-count:2;column-gap:30px;column-rule:1px solid var(--line)}.layout-columns .resume-section{display:block}.layout-columns .entry-heading{display:block}.layout-columns .entry-date{text-align:left;margin-top:2px;font-size:.81em}.layout-columns .entry-subtitle{margin-top:2px}.layout-columns .contacts{padding:0 15px}
.layout-sidebar-left .identity,.layout-sidebar-left-narrow .identity,.layout-sidebar-right .identity{width:26%;border:0;background:var(--soft);padding:20px 16px;float:left;margin:0;text-align:left;border-top:5px solid var(--accent);min-width:0}.layout-sidebar-right .identity{float:right}.layout-sidebar-left .resume-content{margin-left:31%}.layout-sidebar-right .resume-content{margin-right:31%}.layout-sidebar-left-narrow .identity{width:21%;padding:16px 12px}.layout-sidebar-left-narrow .resume-content{margin-left:26%}.layout-sidebar-left .identity h1,.layout-sidebar-right .identity h1{font-size:2.05em}.layout-sidebar-left-narrow .identity h1{font-size:1.65em}.layout-sidebar-left .role,.layout-sidebar-right .role,.layout-sidebar-left-narrow .role{font-size:1.04em;line-height:1.5}.layout-sidebar-left .contacts,.layout-sidebar-right .contacts,.layout-sidebar-left-narrow .contacts{display:block;line-height:1.7;font-size:.86em}.layout-sidebar-left .contact-item,.layout-sidebar-right .contact-item,.layout-sidebar-left-narrow .contact-item{display:block;margin-bottom:8px}.layout-sidebar-left .portrait,.layout-sidebar-right .portrait,.layout-sidebar-left-narrow .portrait{float:none;display:block;margin:0 0 15px;max-width:100%}.layout-sidebar-left .contact-label,.layout-sidebar-right .contact-label,.layout-sidebar-left-narrow .contact-label{display:block;font-size:.9em}.header-aside-dark{background:var(--ink)!important;color:#fff;border-top:6px solid var(--accent)!important}.header-aside-dark h1,.header-aside-dark .contacts{color:#fff}.header-aside-dark .role{color:var(--soft)}.header-aside-academic{background:#fff!important;border-left:1px solid var(--line)!important;border-top:0!important;font-family:var(--serif-font);padding-left:20px!important}.header-aside-academic h1{font-family:var(--serif-font)}.header-aside-card{border:1px solid var(--line)!important;border-top:8px solid var(--accent)!important;border-radius:7px;background:linear-gradient(180deg,var(--soft),#fff)!important}
.entry-compact .resume-entry{margin-bottom:calc(9px * var(--density))}.entry-compact .description{margin-top:4px}.entry-citation h3{font-family:var(--serif-font);font-size:1.07em}.entry-citation .entry-subtitle{font-style:italic}.entry-cards .resume-entry,.entry-project-cards .project-entry{background:var(--soft);border-left:3px solid var(--accent);padding:11px 14px;border-radius:0 var(--radius) var(--radius) 0}.entry-numbered .section-body{counter-reset:entry}.entry-numbered .resume-entry{counter-increment:entry;padding-left:27px;position:relative}.entry-numbered .resume-entry::before{content:counter(entry) '.';position:absolute;left:0;top:0;color:var(--accent);font-family:var(--serif-font)}.entry-timeline .resume-entry,.entry-timeline-dotted .resume-entry{border-left:1pt solid var(--accent);margin-left:6px;padding-left:20px;position:relative;padding-bottom:7px;margin-bottom:0}.entry-timeline .resume-entry::before,.entry-timeline-dotted .resume-entry::before{content:'';position:absolute;left:-5px;top:6px;width:9px;height:9px;border:1pt solid var(--accent);border-radius:50%;background:#fff}.entry-timeline .resume-entry:last-child,.entry-timeline-dotted .resume-entry:last-child{padding-bottom:0}.entry-timeline-dotted .resume-entry{border-left-style:dashed;padding-left:24px;padding-bottom:12px}.entry-timeline-right .resume-entry{border-right:1pt solid var(--accent);margin-right:6px;padding-right:20px;position:relative;padding-bottom:9px;margin-bottom:0}.entry-timeline-right .resume-entry::after{content:'';position:absolute;right:-5px;top:6px;width:9px;height:9px;border:1pt solid var(--accent);border-radius:50%;background:#fff}.entry-date-rail .resume-entry{border-left:1px solid var(--line);margin-left:105px;padding-left:20px;position:relative;padding-bottom:9px;margin-bottom:0}.entry-date-rail .entry-date{position:absolute;left:-105px;top:0;width:91px;text-align:right;font-size:.83em;white-space:normal}.entry-date-rail .resume-entry::before{content:'';position:absolute;left:-4px;top:7px;width:7px;height:7px;background:var(--accent);border-radius:50%}.entry-date-rail .entry-heading{display:block}.entry-date-rail .entry-subtitle{margin-top:2px}
.skill-inline .keywords{display:block}.skill-inline .keyword{background:transparent;color:inherit;padding:0;border-radius:0}.skill-inline .keyword:not(:last-child)::after{content:' / ';color:#a0a7ad;padding:0 4px}.skill-outline .keyword{background:transparent;border:1px solid var(--line);color:var(--ink)}.skill-grid .skill-groups{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px 24px}.skill-grid .skill-group{padding-bottom:9px;border-bottom:1px solid var(--line);margin-bottom:0}.skill-list .skill-group{border-bottom:1px solid var(--line);padding-bottom:8px}.skill-list .keywords{display:block}.skill-list .keyword{background:transparent;display:inline;padding:0;color:inherit}.skill-list .keyword:not(:last-child)::after{content:'、'}.empty-profile{font-size:1em;line-height:1.7;color:#748091;padding:38px 16px;text-align:center;border:1px dashed #d5dce4}
@media screen and (max-width:680px){body{background:#fff}.resume-sheet{margin:0;box-shadow:none}}
@media print{html,body{background:#fff;margin:0!important;padding:0!important}.resume-sheet{width:auto;min-height:0;margin:0;padding:0;box-shadow:none;overflow:visible}.resume-section,.resume-entry,.section-body{overflow:visible}.identity,.resume-section,.resume-entry{height:auto;max-height:none}.section-title{break-after:avoid;page-break-after:avoid}a{text-decoration:none}.empty-profile{display:none}}
`;

  function html(profile, templateId, rawSettings) {
    const data = profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : {};
    const basis = templateMap[plain(templateId)] || templateMap.t0001;
    const template = basis.template, family = basis.family, mood = basis.mood;
    const raw = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
    const settings = {
      fontSize: finiteNumber(raw.fontSize, 12, 8, 19),
      lineHeight: finiteNumber(raw.lineHeight, 1.55, 1.15, 2.2),
      margin: finiteNumber(raw.margin, 32, 12, 72),
      spacingScale: finiteNumber(raw._fitSpacingScale, 1, 0.85, 1),
      photoEnabled: raw.photoEnabled !== false,
      photoShape: ['square', 'circle', 'rounded'].indexOf(raw.photoShape) !== -1 ? raw.photoShape : 'square',
      sectionOrder: raw.sectionOrder,
      hiddenSections: Array.isArray(raw.hiddenSections) ? raw.hiddenSections : [],
      accentOverride: raw.accentOverride
    };
    const accent = color(settings.accentOverride, template.accent);
    const basics = data.basics && typeof data.basics === 'object' && !Array.isArray(data.basics) ? data.basics : {};
    const sections = sectionOrder(settings).filter(function (key) { return settings.hiddenSections.indexOf(key) === -1; }).map(function (key) {
      const content = renderSection(key, data);
      return content ? '<section class="resume-section section-' + key + '" data-section="' + key + '"><h2 class="section-title">' + SECTION_LABELS[key] + '</h2><div class="section-body">' + content + '</div></section>' : '';
    }).join('');
    const identity = header(basics, settings, family);
    const sans = '"Noto Sans CJK SC","Noto Sans SC","Droid Sans Fallback",Arial,sans-serif';
    const serif = '"Noto Serif CJK SC","Noto Serif","Noto Sans CJK SC",serif';
    const mono = '"Noto Sans Mono","Roboto Mono","Noto Sans CJK SC",monospace';
    const serifFamily = family.category === '学术' || family.header === 'editorial';
    const font = family.header === 'mono' ? mono : mood.font === 'serif' || serifFamily ? serif : sans;
    const variables = ':root{--accent:' + accent + ';--soft:' + blend(accent, 0.94) + ';--line:' + blend(accent, 0.74) + ';--on-accent:' + contrast(accent) + ';--ink:#273444;--font:' + font + ';--serif-font:' + serif + ';--mono-font:' + mono + ';--font-size:' + settings.fontSize + 'px;--line-height:' + settings.lineHeight + ';--page-padding:' + settings.margin + 'px;--density:' + (mood.density * settings.spacingScale) + ';--heading-weight:' + mood.weight + ';--tracking:' + mood.tracking + 'em;--radius:' + mood.radius + 'px}';
    const pageCss = '@page{size:A4 portrait;margin:' + (settings.margin * 25.4 / 96).toFixed(3) + 'mm}';
    const classes = ['resume-sheet', 'layout-' + family.layout, 'heading-' + family.heading, 'entry-' + family.entry, 'skill-' + family.skill, 'family-' + family.id, 'preset-' + template.variant];
    if (!identity) classes.push('no-identity');
    const noIdentityCss = '.no-identity .resume-content{margin-left:0;margin-right:0}';
    const title = nonempty(basics.name) ? basics.name + '的简历' : '简历';
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; font-src \'none\'; base-uri \'none\'; form-action \'none\'"><title>' + escape(title) + '</title><style>' + variables + BASE_CSS + pageCss + noIdentityCss + '</style></head><body><article class="' + classes.join(' ') + '" data-template="' + template.id + '">' + identity + '<main class="resume-content">' + (sections || (!identity ? '<p class="empty-profile">请先填写或导入简历资料</p>' : '')) + '</main></article></body></html>';
  }

  // Continuous A4 measurement is an estimate. The native PDF page count is the final export check.
  async function fitHtml(profile, templateId, rawSettings) {
    const raw = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings) ? Object.assign({}, rawSettings) : {};
    if (Array.isArray(raw.sectionOrder)) raw.sectionOrder = raw.sectionOrder.slice();
    if (Array.isArray(raw.hiddenSections)) raw.hiddenSections = raw.hiddenSections.slice();
    const data = profile && typeof profile === 'object' && !Array.isArray(profile) ? JSON.parse(JSON.stringify(profile)) : {};
    const base = {
      fontSize: finiteNumber(raw.fontSize, 12, 8, 19),
      lineHeight: finiteNumber(raw.lineHeight, 1.55, 1.15, 2.2),
      margin: finiteNumber(raw.margin, 32, 12, 72),
      _fitSpacingScale: 1
    };
    const target = Number(raw.pageTarget) === 2 ? 2 : 1;
    const candidates = [base];
    if (raw.autoFit !== false) {
      const floorFont = Math.min(base.fontSize, 11);
      const floorLine = Math.min(base.lineHeight, 1.35);
      const floorMargin = Math.min(base.margin, 22);
      const rounded = function (value) { return Math.round(value * 100) / 100; };
      candidates.push({ fontSize: base.fontSize, lineHeight: Math.max(floorLine, rounded((base.lineHeight + floorLine) / 2)), margin: Math.max(floorMargin, rounded((base.margin + floorMargin) / 2)), _fitSpacingScale: 0.92 });
      candidates.push({ fontSize: base.fontSize, lineHeight: floorLine, margin: floorMargin, _fitSpacingScale: 0.85 });
      for (let step = 1; step <= 4 && base.fontSize > floorFont; step++) {
        const size = Math.max(floorFont, rounded(base.fontSize + (floorFont - base.fontSize) * step / 4));
        const candidate = { fontSize: size, lineHeight: floorLine, margin: floorMargin, _fitSpacingScale: 0.85 };
        if (!candidates.some(function (item) { return item.fontSize === size && item.lineHeight === floorLine && item.margin === floorMargin && item._fitSpacingScale === 0.85; })) candidates.push(candidate);
      }
    }
    const baselineHtml = html(data, templateId, Object.assign({}, raw, base));
    const owner = global.document;
    if (!owner || !owner.body) return { html: baselineHtml, effective: { fontSize: base.fontSize, lineHeight: base.lineHeight, margin: base.margin }, estimatedPages: null, adjusted: false, fitsEstimate: false };
    const frame = owner.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1px;border:0;opacity:0;pointer-events:none;';
    const settleWithin = function (promise, milliseconds) {
      return new Promise(function (resolve) {
        let settled = false;
        const finish = function (result) { if (settled) return; settled = true; global.clearTimeout(timer); resolve(result); };
        const timer = global.setTimeout(function () { finish(false); }, milliseconds);
        Promise.resolve(promise).then(function () { finish(true); }, function () { finish(false); });
      });
    };
    const measure = async function (markup, candidate) {
      await new Promise(function (resolve, reject) {
        let settled = false;
        const finish = function (error) {
          if (settled) return;
          settled = true;
          global.clearTimeout(timer);
          frame.onload = null;
          frame.onerror = null;
          if (error) reject(error); else resolve();
        };
        const timer = global.setTimeout(function () { finish(new Error('自动排版暂时未能完成，请重试')); }, 3000);
        frame.onload = function () {
          if (frame.contentDocument && frame.contentDocument.querySelector('.resume-sheet')) finish();
        };
        frame.onerror = function () { finish(new Error('自动排版暂时未能完成，请重试')); };
        frame.srcdoc = markup;
        if (!frame.parentNode) owner.body.appendChild(frame);
      });
      const document = frame.contentDocument;
      const imagePromises = Array.prototype.map.call(document.images, function (image) {
        if (typeof image.decode === 'function') return image.decode().catch(function () {});
        if (image.complete) return Promise.resolve();
        return new Promise(function (resolve) { image.onload = resolve; image.onerror = resolve; });
      });
      const resources = await Promise.all([
        settleWithin(document.fonts ? document.fonts.ready : Promise.resolve(), 2000),
        settleWithin(Promise.all(imagePromises), 2000)
      ]);
      if (resources.some(function (ready) { return !ready; })) throw new Error('自动排版暂时未能完成，请重试');
      const sheet = document.querySelector('.resume-sheet');
      sheet.style.minHeight = '0';
      const height = Math.max(sheet.getBoundingClientRect().height, sheet.scrollHeight) - candidate.margin * 2;
      const pageHeight = 297 * 96 / 25.4;
      // Reserve a few lines per page for heading keeps, widows and print fragmentation.
      const usableHeight = Math.max(1, pageHeight - candidate.margin * 2 - Math.max(24, candidate.fontSize * candidate.lineHeight * 2.2));
      const ratio = Math.max(0, height) / usableHeight;
      return { estimatedPages: Math.max(1, Math.ceil(ratio - 0.0001)), fitsEstimate: ratio <= target, ratio: ratio };
    };
    let best = null;
    try {
      for (let index = 0; index < candidates.length && index < 7; index++) {
        const candidate = candidates[index];
        const markup = index === 0 ? baselineHtml : html(data, templateId, Object.assign({}, raw, candidate));
        const measured = await measure(markup, candidate);
        const result = {
          html: markup,
          effective: { fontSize: candidate.fontSize, lineHeight: candidate.lineHeight, margin: candidate.margin },
          estimatedPages: measured.estimatedPages,
          adjusted: candidate.fontSize !== base.fontSize || candidate.lineHeight !== base.lineHeight || candidate.margin !== base.margin || candidate._fitSpacingScale !== 1,
          fitsEstimate: measured.fitsEstimate
        };
        if (!best || measured.ratio < best.ratio) best = { ratio: measured.ratio, result: result };
        if (measured.fitsEstimate) return result;
      }
      return best.result;
    } finally {
      frame.onload = null;
      frame.onerror = null;
      if (frame.parentNode) frame.parentNode.removeChild(frame);
    }
  }

  function thumbnail(templateId) {
    const basis = templateMap[plain(templateId)] || templateMap.t0001;
    const f = basis.family, t = basis.template, a = t.accent, soft = blend(a, 0.92), lineColor = blend(a, 0.66);
    const lines = [];
    function rect(x, y, width, height, fill, radius) { lines.push('<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" rx="' + (radius || 0) + '" fill="' + fill + '"/>'); }
    function line(x1, y1, x2, y2, stroke, width, dash) { lines.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + stroke + '" stroke-width="' + (width || 1) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'); }
    function circle(x, y, r, fill, stroke) { lines.push('<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '"' : '') + '/>'); }
    const isSide = f.layout.indexOf('sidebar') === 0, isRight = f.layout === 'sidebar-right', isNarrow = f.layout === 'sidebar-left-narrow';
    let x = 17, y = 77, w = 166, identityX = 17, identityW = 166;
    rect(0, 0, 200, 283, '#ffffff');
    if (isSide) {
      const sideW = isNarrow ? 36 : 46, sx = isRight ? 137 : 17;
      rect(sx, 18, sideW, 239, f.header === 'aside-dark' ? '#273444' : soft, f.header === 'aside-card' ? 3 : 0);
      rect(sx, 18, sideW, f.header === 'aside-academic' ? 0.7 : 3, a);
      rect(sx + 7, 32, sideW - 14, 4, f.header === 'aside-dark' ? '#ffffff' : a);
      rect(sx + 7, 40, sideW - 19, 2, f.header === 'aside-dark' ? '#e5eaf0' : '#798797');
      rect(sx + 7, 52, sideW - 15, 25, f.header === 'aside-dark' ? '#647181' : lineColor, 1);
      for (let i = 0; i < 6; i++) rect(sx + 7, 90 + i * 9, sideW - 14 - (i % 2) * 5, 1.7, f.header === 'aside-dark' ? '#cbd3de' : '#8d9ca9');
      x = isRight ? 17 : sx + sideW + 10; w = isRight ? 110 : 183 - x; y = 22;
    } else {
      if (f.header === 'band' || f.header === 'dark-band') rect(17, 18, 166, 48, f.header === 'band' ? a : '#273444');
      if (f.header === 'strip' || f.header === 'graduate') rect(17, 18, 166, 48, soft, f.header === 'graduate' ? 5 : 0);
      if (f.header === 'frame') { rect(17, 18, 166, 48, a); rect(20, 20, 161, 44, '#fff'); }
      if (f.header === 'corner') { rect(17, 18, 166, 2, a); rect(17, 18, 2, 44, a); }
      if (f.header === 'geometric') { rect(17, 18, 166, 5, a); rect(17, 23, 36, 43, soft); }
      const center = ['center', 'academic', 'graduate'].indexOf(f.header) !== -1;
      const right = f.header === 'right';
      const foreground = f.header === 'band' ? contrast(a) : f.header === 'dark-band' ? '#ffffff' : a;
      const titleX = center ? 73 : right ? 118 : 25;
      rect(titleX, 29, f.header === 'editorial' || f.header === 'portrait' || f.header === 'corner' ? 60 : 48, f.header === 'compact' ? 5 : 7, foreground);
      rect(center ? 69 : right ? 101 : 25, 41, 63, 2.3, foreground);
      if (f.header === 'contact-right') { for (let i = 0; i < 4; i++) rect(113, 27 + 6 * i, 60 - (i % 2) * 12, 1.7, '#8996a4'); }
      else { rect(center ? 50 : 25, 54, center ? 100 : 113, 1.8, foreground); }
      if (f.header === 'portrait') { rect(146, 26, 27, 35, lineColor, 1); }
      if (f.header === 'editorial') rect(17, 21, 3, 42, a);
      if (['minimal', 'editorial', 'portrait', 'strip', 'graduate', 'corner', 'geometric'].indexOf(f.header) === -1) line(17, 67, 183, 67, a, f.header === 'mono' ? 1.4 : .7);
      if (f.header === 'academic') line(17, 69, 183, 69, a, .5);
    }
    function block(bx, by, bw, idx) {
      const labelW = f.layout.indexOf('rail') === 0 ? Math.max(20, bw * .23) : bw;
      let contentX = bx, contentW = bw, contentY = by + 11;
      if (f.layout === 'rail-left') { contentX += labelW + 7; contentW -= labelW + 7; contentY = by; }
      if (f.layout === 'rail-right') { contentW -= labelW + 7; contentY = by; }
      let headingX = f.layout === 'rail-right' ? bx + contentW + 7 : bx;
      if (f.heading === 'center') headingX += (labelW - 38) / 2;
      if (f.heading === 'rule-right') headingX += labelW - 38;
      if (f.heading === 'band' || f.heading === 'box' || f.heading === 'pill') rect(headingX, by - 1, labelW, 7, f.heading === 'box' ? lineColor : soft, f.heading === 'pill' ? 3 : 0);
      if (f.heading === 'box') rect(headingX + .6, by - .4, labelW - 1.2, 5.8, '#fff');
      if (f.heading === 'bar') rect(headingX, by - 1, 1.5, 7, a);
      if (f.heading === 'numbered') { circle(headingX + 3, by + 2, 3, '#fff', a); headingX += 9; }
      rect(headingX + (f.heading === 'bar' ? 4 : 0), by, Math.min(37, labelW - 8), 3, a);
      if (['rule', 'double', 'rule-right', 'mono'].indexOf(f.heading) !== -1) line(bx, by + 7, bx + bw, by + 7, lineColor, .6, f.heading === 'mono' ? '2 1' : null);
      if (f.heading === 'double') line(bx, by + 8.6, bx + bw, by + 8.6, lineColor, .4);
      if (f.entry === 'cards' || (f.entry === 'project-cards' && idx === 1)) { rect(contentX, contentY - 1, contentW, 40, soft, 2); rect(contentX, contentY - 1, 1.3, 40, a); contentX += 5; contentW -= 9; }
      if (f.entry.indexOf('timeline') === 0) {
        const rx = f.entry === 'timeline-right' ? contentX + contentW - 3 : contentX + 3;
        line(rx, contentY + 3, rx, contentY + 35, a, .8, f.entry === 'timeline-dotted' ? '2 2' : null);
        circle(rx, contentY + 4, 2, '#fff', a);
        if (f.entry !== 'timeline-right') contentX += 11;
        contentW -= 11;
      }
      if (f.entry === 'date-rail') { rect(contentX, contentY + 1, contentW * .2, 2, '#98a4b1'); line(contentX + contentW * .25, contentY, contentX + contentW * .25, contentY + 34, lineColor, .7); contentX += contentW * .3; contentW *= .7; }
      if (f.entry === 'numbered') { rect(contentX, contentY, 3, 3, a); contentX += 8; contentW -= 8; }
      rect(contentX, contentY + 1, contentW * .63, 2.5, '#5e6c7b');
      for (let i = 0; i < 4; i++) rect(contentX, contentY + 9 + i * 6, contentW * (i === 3 ? .7 : i % 2 ? .88 : .97), 1.5, '#bdc7d2');
      if (idx === 2 && f.skill === 'grid') { rect(contentX + contentW * .52, contentY + 1, contentW * .42, 2.5, '#5e6c7b'); line(contentX + contentW * .48, contentY + 1, contentX + contentW * .48, contentY + 34, lineColor, .5); }
      if (idx === 2 && (f.skill === 'tags' || f.skill === 'outline')) { for (let i = 0; i < 3; i++) rect(contentX + i * (contentW / 3), contentY + 34, contentW / 3 - 3, 4, f.skill === 'tags' ? soft : lineColor, 1); }
    }
    if (f.layout === 'columns') {
      const cw = (w - 12) / 2;
      for (let i = 0; i < 4; i++) { block(x, y + i * 46, cw, i); block(x + cw + 12, y + i * 46, cw, i + 1); }
      line(x + cw + 6, y, x + cw + 6, 263, lineColor, .5);
    } else {
      for (let i = 0; i < 4; i++) block(x, y + i * 47, w, i);
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 283" role="img" aria-label="' + escape(t.name) + '"><title>' + escape(t.name) + '</title>' + lines.join('') + '</svg>';
  }

  const sampleProfile = {
    basics: { name: '林知夏', label: '产品运营 · 用户体验', email: 'lin.zhixia@example.com', phone: '138 0000 2468', url: 'https://example.com/lin', summary: '这是虚构示例资料。擅长梳理用户需求、设计运营流程并用数据检验效果。希望在重视产品体验的团队中，让复杂任务变得清晰易用。', image: '', location: { city: '上海', address: '浦东新区' } },
    work: [
      { name: '远山数字科技（虚构）', position: '产品运营专员', startDate: '2023-07', endDate: '2026-08', summary: '负责用户反馈整理、活动执行与核心流程体验优化。', highlights: ['建立反馈分类与跟进机制，帮助团队优先处理高频问题。', '与产品和设计同事协作，完成新用户引导流程改版。', '整理月度分析报告，将用户行为转化为可执行的改进建议。'] },
      { name: '晨光创意工作室（虚构）', position: '运营实习生', startDate: '2022-06', endDate: '2022-12', summary: '协助内容策划与社群运营，参与活动复盘。', highlights: ['维护内容排期与活动资料，保证多方协作信息一致。'] }
    ],
    education: [{ institution: '海州大学（虚构）', area: '信息管理与信息系统', studyType: '本科', startDate: '2019-09', endDate: '2023-06', score: 'GPA 3.6 / 4.0', summary: '学习数据分析、项目管理与用户研究；参与校内创新实践。' }],
    projects: [{ name: '校园服务体验优化（示例项目）', description: '围绕校园服务预约流程完成访谈、原型与可用性验证。', startDate: '2022-03', endDate: '2022-06', highlights: ['通过访谈梳理关键需求，形成任务流程与交互原型。', '组织两轮可用性测试，记录问题并完成迭代。'] }],
    skills: [{ name: '数据分析', level: '熟练', keywords: ['Excel', 'SQL', '数据可视化'] }, { name: '产品协作', level: '熟练', keywords: ['用户访谈', 'Figma', '项目管理'] }, { name: '内容运营', level: '熟练', keywords: ['内容策划', '活动执行', '社群运营'] }],
    certificates: [{ name: '大学英语六级', issuer: '全国大学英语四、六级考试', date: '2021-12' }],
    languages: [{ language: '中文', fluency: '母语' }, { language: '英语', fluency: '日常工作沟通' }],
    awards: [{ title: '校级创新实践优秀项目（示例）', awarder: '海州大学（虚构）', date: '2022-11', summary: '团队协作奖项。' }],
    interests: [{ name: '摄影与阅读', keywords: ['城市纪实', '设计与人文'] }],
    custom: []
  };

  global.ResumeEngine = { templates: templates, families: families, html: html, fitHtml: fitHtml, thumbnail: thumbnail, sampleProfile: sampleProfile };
})(typeof window !== 'undefined' ? window : globalThis);
