// Computer-keyboard playing uses physical KeyboardEvent.code values. The UI is
// original; the hand separation / numbered-note arrangement follows EOP's model.
export const KEYBOARD_STORAGE_KEY = 'piano-web41-keys';
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const DEGREES = ['1', '♯1', '2', '♯2', '3', '4', '♯4', '5', '♯5', '6', '♯6', '7'];
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const MAIN_ROWS = [
  ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'],
  ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
  ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'],
  ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight']
];
const PAD_ROWS = [
  ['NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract'],
  ['Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd'],
  ['Numpad4', 'Numpad5', 'Numpad6'],
  ['Numpad1', 'Numpad2', 'Numpad3', 'NumpadEnter'],
  ['Numpad0', 'NumpadDecimal']
];
const LABELS = {
  Backquote: '`', Minus: '−', Equal: '=', Backspace: '退格', Tab: 'Tab',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', CapsLock: 'Caps',
  Semicolon: ';', Quote: "'", Enter: 'Enter', ShiftLeft: 'Shift', ShiftRight: 'Shift',
  Comma: ',', Period: '.', Slash: '/', NumLock: 'Num', NumpadDivide: '/',
  NumpadMultiply: '×', NumpadSubtract: '−', NumpadAdd: '+', NumpadEnter: 'Enter',
  NumpadDecimal: '.', Space: '空格'
};
const ALL_CODES = [...MAIN_ROWS.flat(), ...PAD_ROWS.flat()];
const CODE_SET = new Set(ALL_CODES);
const RESERVED = new Set(['Tab', 'CapsLock', 'ShiftLeft', 'ShiftRight', 'Backspace', 'Enter', 'NumLock']);
const label = code => LABELS[code] || code.replace(/^Key|^Digit|^Numpad/, '');
const noteName = pitch => NAMES[((pitch % 12) + 12) % 12] + (Math.floor(pitch / 12) - 1);
const integer = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback;
const defaults = () => ({ version: 1, layout: 'everyone', transpose: 0, octaves: { left: 0, right: 0 }, velocity: { left: 70, right: 100 }, overrides: { everyone: {}, laptop: {} } });

function scaleRow(map, codes, base, hand = 'left') {
  codes.forEach((code, i) => { map[code] = { pitch: base + 12 * Math.floor(i / 7) + SCALE[i % 7], hand }; });
}

function presets(layout) {
  const map = {};
  if (layout === 'everyone') {
    scaleRow(map, MAIN_ROWS[0].slice(1, 13), 72);
    scaleRow(map, MAIN_ROWS[1].slice(1, 13), 60);
    scaleRow(map, MAIN_ROWS[2].slice(1, 12), 48);
    scaleRow(map, MAIN_ROWS[3].slice(1, 11), 36);
    // The numbered right-hand block follows the familiar 1–7 fingering. Extra
    // keys supply the neighbouring pitches; every key remains editable.
    Object.entries({ Numpad0: 59, Numpad1: 60, Numpad2: 62, Numpad3: 64, Numpad4: 65,
      Numpad5: 67, Numpad6: 69, Numpad7: 71, Numpad8: 72, Numpad9: 74,
      NumpadDecimal: 61, NumpadDivide: 66, NumpadMultiply: 68, NumpadSubtract: 70,
      NumpadAdd: 76, NumpadEnter: 77 }).forEach(([code, pitch]) => { map[code] = { pitch, hand: 'right' }; });
  } else {
    // Chromatic two-octave alternative: the staggered rows follow white / black
    // piano keys and require no separate number pad.
    const lower = ['KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyH', 'KeyN', 'KeyJ', 'KeyM', 'Comma', 'KeyL', 'Period', 'Semicolon', 'Slash'];
    const upper = ['KeyQ', 'Digit2', 'KeyW', 'Digit3', 'KeyE', 'KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'Digit7', 'KeyU', 'KeyI', 'Digit9', 'KeyO', 'Digit0', 'KeyP', 'BracketLeft', 'Equal', 'BracketRight'];
    lower.forEach((code, i) => { map[code] = { pitch: 48 + i, hand: 'left' }; });
    upper.forEach((code, i) => { map[code] = { pitch: 60 + i, hand: 'right' }; });
  }
  return map;
}

function readConfig() {
  const config = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEYBOARD_STORAGE_KEY) || 'null');
    if (!raw || raw.version !== 1) return { config, storage: 'ready' };
    config.layout = raw.layout === 'laptop' ? 'laptop' : 'everyone';
    config.transpose = integer(raw.transpose, 0, -11, 11);
    for (const hand of ['left', 'right']) {
      config.octaves[hand] = integer(raw.octaves?.[hand], 0, -2, 2);
      config.velocity[hand] = integer(raw.velocity?.[hand], hand === 'left' ? 70 : 100, 1, 100);
    }
    for (const layout of ['everyone', 'laptop']) {
      for (const [code, entry] of Object.entries(raw.overrides?.[layout] || {})) {
        if (!CODE_SET.has(code) || RESERVED.has(code)) continue;
        if (entry === null) config.overrides[layout][code] = null;
        else if (Number.isInteger(entry?.pitch) && entry.pitch >= 21 && entry.pitch <= 108) {
          config.overrides[layout][code] = { pitch: entry.pitch, hand: entry.hand === 'right' ? 'right' : 'left' };
        }
      }
    }
    return { config, storage: 'ready' };
  } catch (_) { return { config, storage: 'unavailable' }; }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The caller forwards keyboard events; this module never claims global keys. */
export function createKeyboardAdapter({ host, onPress = () => {}, onRelease = () => {}, onReleaseAll = () => {},
  onMappingChange = () => {}, onPedal = () => {}, onPanic = () => {}, onTransport = () => {}, isEnabled = () => true } = {}) {
  if (!(host instanceof HTMLElement)) throw new TypeError('Computer keyboard host is required');
  const loaded = readConfig();
  let config = loaded.config, storage = loaded.storage, editMode = false, releasing = false;
  let held = new Set(), expected = new Set(), next = new Set(), automatic = new Set();
  const physical = new Map(), pointers = new Map(), buttons = new Map(), pedalOwners = new Set();
  const controlDown = new Set();
  let currentMap = {}, editingCode = null, tapSequence = 0, lastStateSignature = '';
  const tapOwners = new Map();
  host.classList.add('cw-panel');
  host.setAttribute('aria-label', '电脑键盘演奏与键位适配');
  const toolbar = element('div', 'cw-toolbar');
  const title = element('div', 'cw-title');
  title.append(element('strong', '', '电脑键盘'), element('span', 'cw-subtitle', '双手演奏 · 物理键位'));
  const layoutLabel = element('label', 'cw-layout-label', '布局 ');
  const layoutSelect = element('select', 'cw-layout');
  layoutSelect.setAttribute('aria-label', '电脑键位布局');
  layoutSelect.append(new Option('经典双手 · 带数字小键盘', 'everyone'), new Option('笔记本 · 双排半音键盘', 'laptop'));
  layoutSelect.value = config.layout;
  layoutLabel.append(layoutSelect);
  const editButton = element('button', 'cw-edit', '编辑键位');
  editButton.type = 'button'; editButton.setAttribute('aria-pressed', 'false');
  const resetButton = element('button', 'cw-reset', '恢复默认'); resetButton.type = 'button';
  const panicButton = element('button', 'cw-panic', '止音'); panicButton.type = 'button';
  panicButton.title = '停止所有声音（Esc）';
  toolbar.append(title, layoutLabel, editButton, resetButton, panicButton);
  const tunings = element('div', 'cw-tunings');
  const transposeLabel = element('label', 'cw-tuning', '移调 ');
  const transpose = element('select', 'cw-transpose');
  transpose.setAttribute('aria-label', '电脑键盘移调');
  for (let n = -11; n <= 11; n++) transpose.append(new Option(n === 0 ? 'C · 原调' : `${n > 0 ? '+' : ''}${n} 半音`, String(n)));
  transpose.value = config.transpose; transposeLabel.append(transpose); tunings.append(transposeLabel);
  const octaveSelects = {}, velocityInputs = {};
  for (const hand of ['left', 'right']) {
    const text = hand === 'left' ? '左手' : '右手';
    const group = element('div', `cw-hand-settings cw-${hand}`);
    const octaveLabel = element('label', 'cw-tuning', `${text}八度 `);
    const octave = element('select', 'cw-octave');
    octave.setAttribute('aria-label', `${text}八度`);
    for (let n = -2; n <= 2; n++) octave.append(new Option(n === 0 ? '原位' : `${n > 0 ? '+' : ''}${n}`, String(n)));
    octave.value = config.octaves[hand]; octaveLabel.append(octave); octaveSelects[hand] = octave;
    const velocityLabel = element('label', 'cw-tuning cw-velocity', `${text}力度 `);
    const velocity = element('input', 'cw-velocity-input');
    velocity.type = 'range'; velocity.min = '1'; velocity.max = '100'; velocity.value = config.velocity[hand];
    velocity.setAttribute('aria-label', `${text}演奏力度`);
    const output = element('output', '', String(config.velocity[hand]));
    velocityLabel.append(velocity, output); velocityInputs[hand] = { input: velocity, output };
    group.append(octaveLabel, velocityLabel); tunings.append(group);
  }
  const viewport = element('div', 'cw-viewport');
  const diagram = element('div', 'cw-diagram');
  const main = element('div', 'cw-main');
  const mainHeading = element('div', 'cw-block-heading cw-left', '主键区 · 左手');
  main.append(mainHeading);
  const pad = element('div', 'cw-pad');
  pad.append(element('div', 'cw-block-heading cw-right', '数字小键盘 · 右手'));
  const padGrid = element('div', 'cw-pad-grid'); pad.append(padGrid);
  const status = element('p', 'cw-status'); status.setAttribute('role', 'status');
  const legend = element('div', 'cw-legend');
  for (const [cls, text] of [['cw-held-dot', '正在按下'], ['cw-expected-dot', '当前待弹'], ['cw-next-dot', '下一组']]) {
    const item = element('span', ''); item.append(element('i', cls), document.createTextNode(text)); legend.append(item);
  }
  const pedalButton = element('button', 'cw-pedal', '空格 · 按住延音');
  pedalButton.type = 'button'; pedalButton.setAttribute('aria-pressed', 'false');
  const below = element('div', 'cw-below'); below.append(legend);
  diagram.append(main, pad); viewport.append(diagram);

  function makeKey(code) {
    const button = element('button', 'cw-key'); button.type = 'button';
    button.dataset.code = code;
    if (RESERVED.has(code) && code !== 'Enter') button.classList.add('cw-reserved');
    const keyLabel = element('span', 'cw-physical', label(code));
    const degree = element('span', 'cw-degree');
    const note = element('span', 'cw-note');
    button.append(keyLabel, degree, note); buttons.set(code, { button, degree, note });
    button.addEventListener('contextmenu', e => { if (!RESERVED.has(code)) { e.preventDefault(); openEditor(code); } });
    button.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !available()) return;
      e.preventDefault();
      if (editMode) { openEditor(code); return; }
      if (!currentMap[code]) return;
      try { button.setPointerCapture(e.pointerId); } catch (_) {}
      pressPointer(e.pointerId, code);
    });
    button.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cw-key');
      const targetCode = hit && host.contains(hit) ? hit.dataset.code : null;
      if (targetCode !== pointers.get(e.pointerId)?.code) {
        releasePointer(e.pointerId);
        if (targetCode && currentMap[targetCode] && available()) pressPointer(e.pointerId, targetCode);
      }
    });
    const up = e => releasePointer(e.pointerId);
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, up);
    button.addEventListener('click', e => {
      if (code === 'Enter' && !editMode && available()) { onTransport(); return; }
      if (e.detail !== 0 || !available() || RESERVED.has(code)) return;
      if (editMode) { openEditor(code); return; }
      const entry = currentMap[code]; if (!entry) return;
      const owner = `computer-tap-${++tapSequence}`;
      tapOwners.set(owner, entry.pitch); onPress(owner, entry.pitch, config.velocity[entry.hand]); paint();
      setTimeout(() => { if (tapOwners.delete(owner)) { onRelease(owner); paint(); } }, 140);
    });
    return button;
  }
  for (const [index, row] of MAIN_ROWS.entries()) {
    const line = element('div', `cw-row cw-row-${index}`);
    row.forEach(code => line.append(makeKey(code))); main.append(line);
  }
  const spaceRow = element('div', 'cw-space-row');
  for (const text of ['Ctrl', 'Win', 'Alt']) spaceRow.append(element('span', 'cw-meta-key', text));
  spaceRow.append(pedalButton);
  for (const text of ['Alt', 'Ctrl']) spaceRow.append(element('span', 'cw-meta-key', text));
  main.append(spaceRow);
  for (const [y, row] of PAD_ROWS.entries()) for (const [x, code] of row.entries()) {
    const key = makeKey(code);
    key.classList.add(`cw-pad-row-${y}`, `cw-pad-col-${x}`);
    padGrid.append(key);
  }

  const dialog = element('dialog', 'cw-editor');
  const dialogHead = element('div', 'cw-editor-head');
  const editorTitle = element('h2', '', '编辑键位');
  const close = element('button', 'cw-editor-close', '×'); close.type = 'button'; close.setAttribute('aria-label', '关闭键位编辑');
  dialogHead.append(editorTitle, close);
  const description = element('p', 'cw-editor-help', '为这个物理按键指定音高和左右手。修改自动保存在当前浏览器。');
  const handLabel = element('label', 'cw-editor-field', '所属手');
  const handSelect = element('select', ''); handSelect.append(new Option('左手', 'left'), new Option('右手', 'right')); handLabel.append(handSelect);
  const pitchLabel = element('label', 'cw-editor-field', '基准音高');
  const pitchSelect = element('select', ''); pitchSelect.setAttribute('aria-label', '自定义基准音高');
  for (let n = 21; n <= 108; n++) pitchSelect.append(new Option(`${noteName(n)} · MIDI ${n}`, String(n)));
  pitchLabel.append(pitchSelect);
  const preview = element('p', 'cw-editor-preview');
  const actions = element('div', 'cw-editor-actions');
  const clear = element('button', '', '停用此键'), resetKey = element('button', '', '恢复此键'), save = element('button', 'cw-save', '保存键位');
  for (const b of [clear, resetKey, save]) b.type = 'button';
  actions.append(clear, resetKey, save); dialog.append(dialogHead, description, handLabel, pitchLabel, preview, actions);
  host.replaceChildren(toolbar, tunings, viewport, below, status, dialog);

  function saveConfig(message = '') {
    try { localStorage.setItem(KEYBOARD_STORAGE_KEY, JSON.stringify(config)); storage = 'ready'; }
    catch (_) { storage = 'unavailable'; }
    rebuild();
    if (message) status.textContent = message + (storage === 'unavailable' ? '；浏览器未允许保存，离开后会恢复默认。' : '');
    onMappingChange();
  }
  function available() {
    return isEnabled() && !dialog.open && !document.querySelector('dialog[open]');
  }
  function blockedTarget(e) {
    const target = e.target;
    return target instanceof Element && (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') || (['Space', 'Enter'].includes(e.code) && target.closest('button, a')));
  }
  function rebuild() {
    const baseMap = presets(config.layout), overrides = config.overrides[config.layout];
    currentMap = {};
    for (const code of ALL_CODES) {
      const entry = Object.hasOwn(overrides, code) ? overrides[code] : baseMap[code];
      if (!entry) continue;
      const pitch = entry.pitch + config.transpose + config.octaves[entry.hand] * 12;
      if (pitch >= 21 && pitch <= 108) currentMap[code] = { ...entry, basePitch: entry.pitch, pitch, custom: Object.hasOwn(overrides, code) };
    }
    host.dataset.layout = config.layout;
    mainHeading.textContent = config.layout === 'everyone' ? '主键区 · 左手' : '主键区 · 双排半音（左手 Z 起，右手 Q 起）';
    pad.hidden = config.layout !== 'everyone';
    layoutSelect.value = config.layout; transpose.value = config.transpose;
    for (const hand of ['left', 'right']) {
      octaveSelects[hand].value = config.octaves[hand];
      velocityInputs[hand].input.value = config.velocity[hand];
      velocityInputs[hand].output.textContent = String(config.velocity[hand]);
    }
    for (const [code, ui] of buttons) {
      const entry = currentMap[code];
      ui.button.classList.toggle('cw-left', entry?.hand === 'left');
      ui.button.classList.toggle('cw-right', entry?.hand === 'right');
      ui.button.classList.toggle('cw-unmapped', !entry);
      ui.button.classList.toggle('cw-custom', !!entry?.custom);
      ui.button.setAttribute('aria-disabled', !entry && !editMode && code !== 'Enter' ? 'true' : 'false');
      ui.degree.textContent = entry ? DEGREES[entry.basePitch % 12] : '—';
      const octave = entry ? Math.floor(entry.basePitch / 12) - 5 : 0;
      ui.degree.dataset.octave = octave > 0 ? '˙'.repeat(octave) : octave < 0 ? '·'.repeat(-octave) : '';
      ui.degree.classList.toggle('cw-low-degree', octave < 0);
      ui.note.textContent = entry ? noteName(entry.pitch) : code === 'Enter' ? '播放 / 暂停' : RESERVED.has(code) ? '系统键' : '未设定';
      const text = entry ? `${label(code)}，${entry.hand === 'left' ? '左手' : '右手'} ${noteName(entry.pitch)}，${editMode ? '点击编辑' : '按住演奏，右键编辑'}` : code === 'Enter' ? 'Enter，开始或暂停演奏' : `${label(code)}，${RESERVED.has(code) ? '保留系统功能' : '未映射，右键可设置'}`;
      ui.button.setAttribute('aria-label', text); ui.button.title = text;
    }
    status.textContent = editMode ? '点击任意发音键编辑；保存后退出编辑即可演奏。' : 'Enter 播放/暂停；空格按住延音；右键改键；Esc 止音。' + (config.layout === 'everyone' ? ' Shift + 发音键升半音。' : '') + (storage === 'unavailable' ? ' 当前浏览器不允许保存键位。' : ' 键位自动保存在本浏览器。');
    paint();
  }
  function paint() {
    const local = new Set([...physical.values(), ...pointers.values()].map(v => v.pitch));
    const localCodes = new Set([...physical.values(), ...pointers.values()].map(v => v.code));
    for (const value of tapOwners.values()) local.add(value);
    for (const [code, ui] of buttons) {
      const pitch = currentMap[code]?.pitch;
      const pressed = pitch !== undefined && (held.has(pitch) || local.has(pitch) || localCodes.has(code));
      const shiftedExpected = config.layout === 'everyone' && pitch !== undefined && !expected.has(pitch) && expected.has(pitch + 1);
      ui.button.classList.toggle('cw-pressed', pressed);
      ui.button.classList.toggle('cw-automatic', pitch !== undefined && automatic.has(pitch));
      ui.button.classList.toggle('cw-expected', pitch !== undefined && (expected.has(pitch) || shiftedExpected));
      ui.button.classList.toggle('cw-expected-sharp', shiftedExpected);
      ui.button.classList.toggle('cw-next', pitch !== undefined && !expected.has(pitch) && next.has(pitch));
      ui.button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }
    pedalButton.classList.toggle('cw-pedal-down', pedalOwners.size > 0);
    pedalButton.setAttribute('aria-pressed', pedalOwners.size ? 'true' : 'false');
  }
  function pressPointer(pointerId, code) {
    const entry = currentMap[code]; if (!entry) return;
    const owner = `computer-pointer-${pointerId}`;
    pointers.set(pointerId, { owner, code, pitch: entry.pitch });
    onPress(owner, entry.pitch, config.velocity[entry.hand]); paint();
  }
  function releasePointer(pointerId) {
    const entry = pointers.get(pointerId); if (!entry) return;
    pointers.delete(pointerId); onRelease(entry.owner); paint();
  }
  function pedal(owner, down) {
    const wasDown = pedalOwners.size > 0;
    if (down) pedalOwners.add(owner); else pedalOwners.delete(owner);
    if (wasDown !== (pedalOwners.size > 0)) onPedal(pedalOwners.size > 0);
    paint();
  }
  function releaseAll() {
    if (releasing) return;
    releasing = true;
    const owners = [...physical.values(), ...pointers.values()].map(v => v.owner).concat([...tapOwners.keys()]);
    physical.clear(); pointers.clear(); tapOwners.clear(); controlDown.clear();
    const wasPedal = pedalOwners.size > 0; pedalOwners.clear();
    try {
      owners.forEach(owner => onRelease(owner));
      if (wasPedal) onPedal(false);
      onReleaseAll();
    } finally { releasing = false; paint(); }
  }
  function handle(e, down) {
    const code = e.code;
    // Release the owner captured at note-on even if focus, settings or enabled
    // state has changed. A later pitch mapping must never release a new note.
    if (!down) {
      if (physical.has(code)) {
        const entry = physical.get(code); physical.delete(code); onRelease(entry.owner); paint(); return true;
      }
      if (code === 'Space' && pedalOwners.has('physical')) { pedal('physical', false); return true; }
      if (controlDown.delete(code)) return true;
      return false;
    }
    if (!available() || blockedTarget(e) || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.keyCode === 229) return false;
    if (editMode) return false;
    if (code === 'Space') { if (!e.repeat) pedal('physical', true); e.preventDefault?.(); return true; }
    if (code === 'Enter') { if (!e.repeat && !controlDown.has(code)) { controlDown.add(code); onTransport(); } e.preventDefault?.(); return true; }
    if (code === 'Escape') { if (!e.repeat) { releaseAll(); onPanic(); } e.preventDefault?.(); return true; }
    const entry = currentMap[code];
    if (!entry) return false;
    e.preventDefault?.();
    if (e.repeat || physical.has(code)) return true;
    const owner = `computer-key-${code}`;
    const pitch = entry.pitch + (config.layout === 'everyone' && e.shiftKey ? 1 : 0);
    if (pitch > 108) return true;
    physical.set(code, { owner, pitch, code });
    onPress(owner, pitch, config.velocity[entry.hand]); paint(); return true;
  }
  function openEditor(code) {
    if (RESERVED.has(code)) return;
    releaseAll(); editingCode = code;
    const entry = config.overrides[config.layout][code] || presets(config.layout)[code] || { pitch: 60, hand: code.startsWith('Numpad') ? 'right' : 'left' };
    editorTitle.textContent = `编辑 ${code.startsWith('Numpad') ? '小键盘 ' : ''}${label(code)} 键`;
    handSelect.value = entry.hand; pitchSelect.value = entry.pitch; editorPreview();
    if (!dialog.open) dialog.showModal();
  }
  function editorPreview() {
    const pitch = Number(pitchSelect.value) + config.transpose + config.octaves[handSelect.value] * 12;
    preview.textContent = pitch >= 21 && pitch <= 108 ? `加上当前移调与八度后，实际发声：${noteName(pitch)}` : '当前移调与八度超出钢琴音域，此键暂不发声。';
  }
  handSelect.onchange = pitchSelect.onchange = editorPreview;
  close.onclick = () => dialog.close();
  save.onclick = () => {
    if (!editingCode) return;
    config.overrides[config.layout][editingCode] = { pitch: Number(pitchSelect.value), hand: handSelect.value };
    dialog.close(); saveConfig('键位已保存。');
  };
  clear.onclick = () => { if (editingCode) { config.overrides[config.layout][editingCode] = null; dialog.close(); saveConfig('此键已停用，可随时右键重新设置。'); } };
  resetKey.onclick = () => { if (editingCode) { delete config.overrides[config.layout][editingCode]; dialog.close(); saveConfig('此键已恢复默认。'); } };
  dialog.addEventListener('close', () => { editingCode = null; });
  layoutSelect.onchange = () => { releaseAll(); config.layout = layoutSelect.value; saveConfig('布局已切换。'); };
  transpose.onchange = () => { releaseAll(); config.transpose = Number(transpose.value); saveConfig(); };
  for (const hand of ['left', 'right']) {
    octaveSelects[hand].onchange = () => { releaseAll(); config.octaves[hand] = Number(octaveSelects[hand].value); saveConfig(); };
    velocityInputs[hand].input.oninput = () => { config.velocity[hand] = Number(velocityInputs[hand].input.value); velocityInputs[hand].output.textContent = String(config.velocity[hand]); };
    velocityInputs[hand].input.onchange = () => saveConfig();
  }
  editButton.onclick = () => { releaseAll(); editMode = !editMode; editButton.setAttribute('aria-pressed', String(editMode)); editButton.textContent = editMode ? '完成编辑' : '编辑键位'; host.classList.toggle('cw-editing', editMode); rebuild(); };
  resetButton.onclick = () => { releaseAll(); config.overrides[config.layout] = {}; config.transpose = 0; config.octaves = { left: 0, right: 0 }; config.velocity = { left: 70, right: 100 }; saveConfig('当前布局已恢复默认，另一布局的自定义键位保留。'); };
  panicButton.onclick = () => { releaseAll(); onPanic(); status.textContent = '已停止所有声音。'; };
  pedalButton.addEventListener('pointerdown', e => { if (e.button === 0 && available()) { e.preventDefault(); try { pedalButton.setPointerCapture(e.pointerId); } catch (_) {} pedal(`pointer-${e.pointerId}`, true); } });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) pedalButton.addEventListener(event, e => pedal(`pointer-${e.pointerId}`, false));
  pedalButton.addEventListener('click', e => { if (e.detail === 0 && available()) pedal('toggle', !pedalOwners.has('toggle')); });
  // The app owns blur/visibility/pagehide and calls releaseAll. In particular,
  // focusing its staff iframe must not be mistaken for leaving the instrument.
  document.addEventListener('focusin', e => { if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') && (physical.size || pointers.size || pedalOwners.size)) releaseAll(); });
  rebuild();
  return {
    handle, releaseAll,
    labelForPitch(pitch) {
      const matches = Object.entries(currentMap).filter(([code, entry]) => entry.pitch === pitch && (config.layout === 'everyone' || !code.startsWith('Numpad')));
      matches.sort(([a, x], [b, y]) => (pitch >= 60 ? Number(y.hand === 'right') - Number(x.hand === 'right') : Number(y.hand === 'left') - Number(x.hand === 'left')) || a.length - b.length);
      let code = matches[0]?.[0], sharp = false;
      if (!code && config.layout === 'everyone') { code = Object.keys(currentMap).find(key => currentMap[key].pitch + 1 === pitch); sharp = !!code; }
      return code ? (sharp ? 'Shift + ' : '') + (code.startsWith('Numpad') ? '小键盘 ' : '') + label(code) : '';
    },
    update(state = {}) {
      const set = value => new Set(Array.isArray(value) || value instanceof Set ? value : []);
      const heldNext = set(state.held), expectedNext = set(state.expected), upcomingNext = set(state.next);
      const autoNext = state.automatic === true ? new Set(heldNext) : set(state.automatic);
      const signature = [heldNext, expectedNext, upcomingNext, autoNext].map(values => [...values].sort((a, b) => a - b).join(',')).join('|');
      if (signature === lastStateSignature) return;
      lastStateSignature = signature; held = heldNext; expected = expectedNext; next = upcomingNext; automatic = autoNext; paint();
    },
    inspect() {
      return { version: 1, storageKey: KEYBOARD_STORAGE_KEY, storage, layout: config.layout, transpose: config.transpose,
        octaves: { ...config.octaves }, velocity: { ...config.velocity }, keyMap: Object.fromEntries(Object.entries(currentMap).map(([code, v]) => [code, v.pitch])),
        mappings: Object.fromEntries(Object.entries(currentMap).map(([code, v]) => [code, { ...v }])),
        physical: [...physical.entries()].map(([code, v]) => ({ code, ...v })), pointers: [...pointers.values()].map(v => ({ ...v })),
        pedal: pedalOwners.size > 0, editMode, editorOpen: dialog.open, labels: { left: '主键区', right: '数字小键盘' } };
    }
  };
}
