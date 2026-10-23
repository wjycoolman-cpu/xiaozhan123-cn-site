/* Real-time, user-selected tab recording. Video is never synthesized from DOM.
 * The only sound source is a separate branch of the existing piano mixer.
 * No microphone, screen picker, audio context or recorder starts on import/open. */
const presentationQueues = new WeakMap();
const CANCELLED = Symbol('recording-cancelled');
const DISPLAY_OPTIONS = {
  preferCurrentTab: true, selfBrowserSurface: 'include',
  surfaceSwitching: 'exclude', systemAudio: 'exclude',
  monitorTypeSurfaces: 'exclude', video: {displaySurface: 'browser', frameRate: {ideal: 30, max: 60}}, audio: false
};
const FORMATS = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4',
  'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'
];

export function createDesktopRecorder({piano, root, download, setPresentation,
  getPresentation = () => false, onStatus = () => {}, onState = () => {},
  playAutomatic} = {}) {
  if (!root || !piano || typeof download !== 'function' || typeof setPresentation !== 'function')
    throw Error('录屏需要当前乐器、钢琴音源和纯净画面接口');
  const doc = root.ownerDocument || document, win = doc.defaultView || globalThis;
  const media = win.navigator?.mediaDevices;
  let phase = 'idle', disposed = false, current = null, sequence = 0;
  let dialog, startButton, autoInput, message, stylesheet, ownsStylesheet = false, stylesheetFailed = false;
  let suppressClose = 0, lastError = '', lastBytes = 0, lastFormat = '';
  let lastScope = 'unverified', lastHandleVerified = false, lastCropped = false;
  const listeners = [], ownedKeys = new Set();
  const timeout = (fn, ms) => win.setTimeout(fn, ms);
  const clearTimeoutId = id => win.clearTimeout(id);
  const safe = callback => { try { return callback(); } catch (_) { return undefined; } };
  const textError = error => String(error?.message || error || '录屏失败').slice(0, 400);
  function preparationError(error) {
    const messages = {
      NotAllowedError: '未开始录屏：已取消选择，或浏览器未允许共享当前标签页。',
      AbortError: '未开始录屏：标签页共享已取消或中止。',
      NotFoundError: '当前浏览器没有可共享的标签页视频来源，请使用支持标签页共享的浏览器。',
      InvalidStateError: '请回到当前标签页并亲自点击“选择当前标签页并开始”；录屏需要按钮操作，页面也必须处于可用状态。',
      NotSupportedError: '当前浏览器不支持所需的标签页录屏或视频编码，可以继续使用离线视频导出。'
    };
    return messages[error?.name] || textError(error);
  }
  const active = s => !disposed && current === s && !s.finishing && !s.finished;
  function guard(s) { if (!active(s)) throw CANCELLED; }
  function inspect() {
    const s = current;
    return {
      phase: disposed ? 'disposed' : phase,
      busy: !disposed && ['selecting', 'preparing', 'recording', 'stopping'].includes(phase),
      isRecording: !disposed && !!s?.started && !s.mediaReleased,
      bytes: s?.bytes ?? lastBytes, format: s?.format || lastFormat,
      error: s?.error || lastError,
      captureScopeVerification: s?.scope || lastScope,
      captureHandleVerified: s?.handleVerified ?? lastHandleVerified,
      cropped: s?.cropped ?? lastCropped,
      automatic: !!s?.automatic, dialogOpen: !!dialog?.open, disposed
    };
  }
  function publish(force = false) { if (!disposed || force) safe(() => onState(inspect())); }
  function status(value) { if (!disposed) safe(() => onStatus(value)); }
  function listen(target, type, callback, collection = listeners) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, callback);
    collection.push(() => target.removeEventListener(type, callback));
  }
  function queuePresentation(callback) {
    const previous = presentationQueues.get(root) || Promise.resolve();
    const result = previous.catch(() => {}).then(callback);
    // A rejected transition must not poison the next session, including BFCache.
    const tail = result.catch(() => {});
    presentationQueues.set(root, tail);
    tail.then(() => { if (presentationQueues.get(root) === tail) presentationQueues.delete(root); });
    return result;
  }
  function closeDialog() {
    if (dialog?.open) { ++suppressClose; dialog.close(); }
  }
  function buildDialog() {
    if (stylesheetFailed && ownsStylesheet) { stylesheet?.remove(); stylesheet = null; stylesheetFailed = false; }
    stylesheet ||= doc.querySelector('link[data-desktop-recorder]');
    if (!stylesheet) {
      stylesheet = doc.createElement('link'); stylesheet.rel = 'stylesheet';
      stylesheet.href = new URL('./desktop-recorder.css', import.meta.url).href;
      stylesheet.dataset.desktopRecorder = 'true';
      const candidate = stylesheet;
      listen(stylesheet, 'error', () => { if (stylesheet === candidate) stylesheetFailed = true; });
      doc.head.append(stylesheet); ownsStylesheet = true;
    }
    if (dialog) return;
    const make = (tag, value, className) => {
      const element = doc.createElement(tag);
      if (value) element.textContent = value;
      if (className) element.className = className;
      return element;
    };
    dialog = make('dialog', '', 'desktop-recorder');
    dialog.dataset.screenRecordingExclude = 'true';
    const heading = make('h2', '纯净录屏');
    heading.id = 'desktop-recorder-title'; dialog.setAttribute('aria-labelledby', heading.id);
    const intro = make('p', '录制当前乐器画面和正式钢琴音源，可手弹，也可自动演奏。不会打开麦克风。');
    const instructions = make('p', '在浏览器选择器中只选择当前这个标签页。开始后进入纯净画面；按 F9 停止，或点击浏览器的“停止共享”。', 'recorder-instructions');
    const scope = make('p', '支持时只录制乐器区域。浏览器没有区域裁剪能力时，将录制你选择的整个当前标签页，应用无法保证已识别为本页。', 'recorder-scope');
    const automatic = make('label', '', 'recorder-automatic');
    autoInput = make('input'); autoInput.type = 'checkbox';
    automatic.append(autoInput, make('span', '开始后自动播放当前曲目'));
    message = make('p', '', 'recorder-message'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
    const footer = make('div', '', 'recorder-actions');
    const cancel = make('button', '取消'); cancel.type = 'button';
    startButton = make('button', '选择当前标签页并开始'); startButton.type = 'button'; startButton.className = 'recorder-start';
    footer.append(cancel, startButton); dialog.append(heading, intro, instructions, scope, automatic, message, footer); doc.body.append(dialog);
    listen(startButton, 'click', beginFromGesture);
    listen(cancel, 'click', () => stop());
    listen(dialog, 'cancel', event => { event.preventDefault(); void stop(); });
    listen(dialog, 'close', () => {
      if (suppressClose) { --suppressClose; return; }
      if (current && !current.finishing) void finish(current, {save: current.started, reason: 'cancel'});
      else if (!disposed && phase === 'dialog') { phase = 'idle'; publish(); }
    });
  }
  function open() {
    if (disposed || inspect().busy) return false;
    safe(() => piano.pause?.());
    buildDialog(); lastError = ''; phase = 'dialog';
    const view = piano.view?.() || {};
    autoInput.checked = view.mode === 'auto' && !!view.song;
    autoInput.disabled = !view.song;
    startButton.disabled = false;
    const available = !!media?.getDisplayMedia && typeof win.MediaRecorder === 'function' && typeof win.MediaStream === 'function';
    startButton.disabled = !available;
    message.textContent = !available ? '此浏览器不支持标签页实时录屏，可继续使用离线视频导出。' : !view.song ? '未选曲目：可以录制自由手弹；选曲后可自动演奏。' : '';
    if (!dialog.open) dialog.showModal();
    publish(); return true;
  }
  function newSession(automatic) {
    let resolveStop;
    const stopped = new Promise(resolve => { resolveStop = resolve; });
    return {
      id: ++sequence, automatic, song: piano.view?.().song || null,
      started: false, startCalled: false, stopped, resolveStop, recorderStopped: false,
      finishing: false, finished: false, mediaReleased: false, save: false,
      display: null, track: null, destination: null, node: null, connected: false,
      recorder: null, chunks: [], bytes: 0, format: '', error: '', scope: 'unverified',
      handle: '', origin: '', handleConfigured: false, handleCleared: false, handleVerified: false,
      cropped: false, pureQueued: false, pureTouched: false, savedPresentation: false,
      waits: new Set(), removers: [], stoppedTracks: new Set(), timer: null,
      captureAttribute: 'recording-' + sequence, autoPending: false, autoStarted: false
    };
  }
  function configureHandle(s) {
    const origin = win.location?.origin;
    if (typeof media?.setCaptureHandleConfig !== 'function' || !origin || origin === 'null') return;
    let random = '';
    if (typeof win.crypto?.randomUUID === 'function') random = win.crypto.randomUUID();
    else if (typeof win.crypto?.getRandomValues === 'function') {
      const values = new Uint32Array(4); win.crypto.getRandomValues(values);
      random = [...values].map(n => n.toString(16).padStart(8, '0')).join('');
    }
    if (!random) return;
    try {
      media.setCaptureHandleConfig({handle: random, exposeOrigin: true, permittedOrigins: [origin]});
      s.handle = random; s.origin = origin; s.handleConfigured = true;
    } catch (_) { /* Region capture may still verify the current element. */ }
  }
  function stopTrack(s, track) {
    if (!track || s.stoppedTracks.has(track)) return;
    s.stoppedTracks.add(track); safe(() => track.stop());
  }
  function verifySource(s) {
    const surface = s.track?.getSettings?.().displaySurface;
    if (surface && surface !== 'browser') throw Error('只能录制当前标签页，不能录制窗口或整个屏幕。请重新选择本页。');
    if (s.handleConfigured && typeof s.track?.getCaptureHandle === 'function') {
      const handle = s.track.getCaptureHandle();
      if (!handle || handle.handle !== s.handle || handle.origin !== s.origin)
        throw Error('共享来源不是当前钢琴标签页，录屏已取消。请重新选择本页。');
      s.handleVerified = true;
    }
    if (s.track?.readyState === 'ended') throw Error('标签页共享已经结束，请重新开始录屏。');
  }
  function attachDisplay(s, stream) {
    if (!active(s)) { for (const track of stream?.getTracks?.() || []) stopTrack(s, track); throw CANCELLED; }
    s.display = stream;
    // Even if a browser ignores audio:false, never record its system/tab audio.
    for (const track of stream.getAudioTracks()) stopTrack(s, track);
    const tracks = stream.getVideoTracks();
    if (tracks.length !== 1) throw Error('浏览器没有提供唯一的标签页视频轨道');
    s.track = tracks[0];
    listen(s.track, 'ended', () => { if (active(s)) void finish(s, {save: s.started, reason: 'shared-ended'}); }, s.removers);
    listen(s.track, 'capturehandlechange', () => {
      if (!active(s)) return;
      try { verifySource(s); } catch (error) { void finish(s, {error: textError(error), reason: 'source-changed', immediate: true}); }
    }, s.removers);
    verifySource(s); return stream;
  }
  function beginFromGesture(event) {
    if (disposed || inspect().busy || !dialog?.open) return;
    if (event?.isTrusted !== true) { message.textContent = '请亲自点击按钮，选择当前标签页后开始录屏。'; return; }
    const view = piano.view?.() || {};
    if (autoInput.checked && !view.song) { message.textContent = '选择曲目后可以自动演奏并录屏。'; return; }
    if (!media?.getDisplayMedia || typeof win.MediaRecorder !== 'function') return;
    const s = newSession(autoInput.checked); current = s; phase = 'selecting'; lastError = ''; lastBytes = 0; lastFormat = '';
    startButton.disabled = true; autoInput.disabled = true; message.textContent = '请在浏览器选择器中选择当前钢琴标签页。'; publish();
    if (!active(s)) return;
    configureHandle(s);
    let displayPromise, unlockPromise;
    // Do not insert an await between these calls: both need this actual gesture.
    try { displayPromise = Promise.resolve(media.getDisplayMedia(DISPLAY_OPTIONS)); }
    catch (error) { displayPromise = Promise.reject(error); }
    try { unlockPromise = Promise.resolve(piano.audio.unlock()); }
    catch (error) { unlockPromise = Promise.reject(error); }
    const display = displayPromise.then(stream => attachDisplay(s, stream));
    s.preparation = Promise.all([display, unlockPromise]).then(() => prepare(s)).catch(error => {
      if (error === CANCELLED || s.finishing || s.finished) return;
      return finish(s, {error: preparationError(error), reason: 'preparation-failed', immediate: true});
    });
  }
  function waitFrame(s) {
    guard(s);
    return new Promise((resolve, reject) => {
      let frame = null, timer = null, settled = false;
      const clear = () => {
        s.waits.delete(cancel); if (timer !== null) clearTimeoutId(timer);
        if (frame !== null) win.cancelAnimationFrame(frame);
      };
      const done = (error) => { if (settled) return; settled = true; clear(); error ? reject(error) : resolve(); };
      const cancel = () => done(CANCELLED); s.waits.add(cancel);
      frame = win.requestAnimationFrame(() => { frame = null; done(); });
      timer = timeout(() => done(Error('画面尚未准备完成，请回到当前标签页后重试录屏。')), 8000);
    });
  }
  function waitStylesheet(s, link) {
    if (!link || link.sheet) return Promise.resolve();
    if (link === stylesheet && stylesheetFailed) return Promise.reject(Error('录屏画面样式未加载，请重新打开录屏后重试。'));
    return new Promise((resolve, reject) => {
      let settled = false, timer = null;
      const clear = () => {
        s.waits.delete(cancel); if (timer !== null) clearTimeoutId(timer);
        link.removeEventListener('load', loaded); link.removeEventListener('error', failed);
      };
      const done = error => { if (settled) return; settled = true; clear(); error ? reject(error) : resolve(); };
      const cancel = () => done(CANCELLED), loaded = () => done();
      const failed = () => done(Error('纯净画面样式未加载，录屏未开始。请重试。'));
      s.waits.add(cancel); link.addEventListener('load', loaded); link.addEventListener('error', failed);
      timer = timeout(() => { if (link === stylesheet) stylesheetFailed = true; failed(); }, 8000);
    });
  }
  async function prepare(s) {
    guard(s); phase = 'preparing'; publish(); verifySource(s);
    if (typeof win.CropTarget?.fromElement === 'function' && typeof s.track.cropTo === 'function') {
      const target = await win.CropTarget.fromElement(root); guard(s);
      try { await s.track.cropTo(target); }
      catch (_) { throw Error('无法裁剪到当前乐器区域，录屏未开始。请重新选择当前钢琴标签页。'); }
      guard(s); s.cropped = true; s.scope = 'verified-current-element';
    }
    guard(s); verifySource(s);
    s.pureQueued = true;
    await queuePresentation(async () => {
      guard(s); s.savedPresentation = !!getPresentation(); s.pureTouched = true;
      const enabled = await setPresentation(true);
      if (enabled !== true) throw Error('未能进入纯净画面，录屏未开始。');
    });
    guard(s);
    await Promise.all([waitStylesheet(s, stylesheet), waitStylesheet(s, doc.querySelector('link[data-desktop-presentation]'))]);
    guard(s);
    closeDialog();
    for (const item of doc.querySelectorAll('dialog[open]')) safe(() => item.close());
    for (const item of doc.querySelectorAll('[popover]')) safe(() => item.hidePopover());
    doc.body.setAttribute('data-desktop-capture', s.captureAttribute);
    await waitFrame(s); await waitFrame(s); guard(s); verifySource(s);
    const audio = piano.audio;
    if (!audio?.node || !audio.context?.createMediaStreamDestination) throw Error('正式钢琴音源尚未就绪，录屏未开始。');
    s.node = audio.node; s.destination = audio.context.createMediaStreamDestination();
    s.node.connect(s.destination); s.connected = true;
    const audioTracks = s.destination.stream.getAudioTracks();
    if (!audioTracks.length) throw Error('钢琴录音轨道未就绪');
    s.combined = new win.MediaStream([s.track, ...audioTracks]);
    const Recorder = win.MediaRecorder;
    const chosen = typeof Recorder.isTypeSupported === 'function' ? FORMATS.find(type => Recorder.isTypeSupported(type)) : '';
    if (typeof Recorder.isTypeSupported === 'function' && !chosen) throw Error('此浏览器没有可用的视频录制格式');
    s.recorder = chosen ? new Recorder(s.combined, {mimeType: chosen}) : new Recorder(s.combined);
    s.format = s.recorder.mimeType || chosen || '';
    let resolveStarted, rejectStarted;
    const started = new Promise((resolve, reject) => { resolveStarted = resolve; rejectStarted = reject; });
    const cancelStart = () => rejectStarted(CANCELLED); s.waits.add(cancelStart);
    const startTimer = timeout(() => rejectStarted(Error('浏览器未能开始录屏，请重试。')), 8000);
    const clearStart = () => { clearTimeoutId(startTimer); s.waits.delete(cancelStart); };
    listen(s.recorder, 'start', () => {
      if (!active(s)) { rejectStarted(CANCELLED); return; }
      s.started = true; phase = 'recording'; publish(); resolveStarted();
    }, s.removers);
    listen(s.recorder, 'dataavailable', event => {
      if (s.finished || s.discard || !event.data?.size) return;
      s.chunks.push(event.data); s.bytes += event.data.size;
      if (event.data.type && !s.format) s.format = event.data.type;
      publish();
    }, s.removers);
    listen(s.recorder, 'stop', () => {
      s.recorderStopped = true; s.resolveStop();
      if (active(s)) void finish(s, {save: s.started, reason: 'recorder-ended'});
    }, s.removers);
    listen(s.recorder, 'error', event => {
      rejectStarted(event.error || Error('浏览器录屏中断'));
      void finish(s, {error: textError(event.error || '浏览器录屏中断，视频未保存。'), reason: 'recorder-error', immediate: true});
    }, s.removers);
    try { s.recorder.start(1000); s.startCalled = true; await started; }
    finally { clearStart(); }
    guard(s); verifySource(s);
    status(s.cropped ? '录屏已开始，只录制乐器区域。F9 或浏览器“停止共享”结束。' : '录屏已开始，录制你选择的当前标签页。F9 或浏览器“停止共享”结束。');
    s.timer = win.setInterval(() => poll(s), 250);
    if (s.automatic) {
      if (typeof playAutomatic !== 'function') throw Error('自动演奏接口未就绪');
      s.autoPending = true; s.autoInvoked = true;
      try { await playAutomatic(); }
      finally { s.autoPending = false; if (!active(s)) safe(() => piano.pause?.()); }
      guard(s);
      if (!piano.view?.().playing) throw Error('自动演奏未能开始，录屏已取消。');
      s.autoStarted = true;
    }
  }
  function poll(s) {
    if (!active(s) || !s.started) return;
    try {
      verifySource(s);
      if (!s.automatic || !s.autoStarted || s.autoPending) return;
      const view = piano.view?.(), loop = piano.loop?.();
      const sameSong = view?.song && (view.song === s.song || view.song.id && view.song.id === s.song?.id);
      if (sameSong && !loop?.enabled && !view.playing && Number(s.song.durationMs) > 0 && Number(view.position) >= Number(s.song.durationMs) - 1)
        void finish(s, {save: true, reason: 'song-ended'});
    } catch (error) { void finish(s, {error: textError(error), reason: 'source-changed', immediate: true}); }
  }
  function releaseMedia(s) {
    if (s.mediaReleased) return;
    s.mediaReleased = true;
    if (s.timer !== null) { win.clearInterval(s.timer); s.timer = null; }
    for (const cancel of [...s.waits]) safe(cancel); s.waits.clear();
    for (const remove of s.removers.splice(0)) safe(remove);
    if (s.connected) { s.connected = false; safe(() => s.node.disconnect(s.destination)); }
    for (const track of s.display?.getTracks?.() || []) stopTrack(s, track);
    for (const track of s.destination?.stream?.getTracks?.() || []) stopTrack(s, track);
    if (s.handleConfigured && !s.handleCleared) {
      s.handleCleared = true;
      safe(() => media.setCaptureHandleConfig({handle: '', exposeOrigin: false, permittedOrigins: []}));
    }
    if (doc.body.getAttribute('data-desktop-capture') === s.captureAttribute) doc.body.removeAttribute('data-desktop-capture');
  }
  function waitStop(s) {
    if (!s.startCalled || s.recorderStopped) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = timeout(() => reject(Error('录屏结束等待超时，视频未保存。')), 5000);
      s.stopped.then(() => { clearTimeoutId(timer); resolve(); });
    });
  }
  function finish(s, {save = false, error = '', reason = 'user', immediate = false} = {}) {
    if (s.finished) return s.finishPromise || Promise.resolve(inspect());
    if (error) { s.error = error; s.discard = true; }
    if (!save) s.discard = true;
    if (immediate) { s.immediate = true; s.resolveStop(); }
    if (s.finishing) {
      if (immediate) releaseMedia(s);
      return s.finishPromise || Promise.resolve(inspect());
    }
    s.finishing = true; s.save = !!save && s.started && !s.discard;
    if (!disposed) phase = 'stopping';
    for (const cancel of [...s.waits]) safe(cancel);
    if (s.automatic && s.autoInvoked) safe(() => piano.pause?.());
    publish();
    // Page dismissal/dispose discards immediately; a manual stop waits for the
    // recorder's final dataavailable event before releasing its source tracks.
    if (immediate) releaseMedia(s);
    let restore;
    if (immediate && s.pureQueued) restore = restorePresentation(s);
    s.finishPromise = Promise.resolve().then(async () => {
      try {
        if (s.recorder && s.recorder.state !== 'inactive') s.recorder.stop();
        if (!s.immediate) await waitStop(s);
      } catch (caught) { s.error = s.error || textError(caught); s.discard = true; }
      finally {
        releaseMedia(s);
        try { await (restore || restorePresentation(s)); }
        catch (caught) { s.error = s.error || '录屏已结束，但恢复原画面失败：' + textError(caught); }
      }
      try {
        if (!disposed && s.save && !s.discard && s.bytes > 0) {
          const actual = s.recorder?.mimeType || s.chunks.find(chunk => chunk.type)?.type || s.format;
          const extension = /^video\/mp4(?:;|$)/i.test(actual) ? 'mp4' : /^video\/webm(?:;|$)/i.test(actual) ? 'webm' : '';
          if (!extension) throw Error('浏览器未返回可识别的视频格式，视频未保存。');
          s.format = actual;
          const blob = new win.Blob(s.chunks, {type: actual});
          const title = String(s.song?.title || '手弹演奏').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 80);
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          await download('弹钢琴-纯净录屏-' + title + '-' + stamp + '.' + extension, blob);
          status('纯净录屏已保存（' + extension.toUpperCase() + '）。');
        } else if (!disposed && !s.error) status(s.started ? '录屏已结束，没有生成视频文件。' : '已取消录屏。');
      } catch (caught) { s.error = s.error || textError(caught); }
      finally {
        s.finished = true; s.chunks.length = 0;
        lastBytes = s.bytes; lastFormat = s.format; lastError = s.error;
        lastScope = s.scope; lastHandleVerified = s.handleVerified; lastCropped = s.cropped;
        if (current === s) { current = null; if (!disposed) phase = s.error ? 'failed' : 'idle'; }
        closeDialog();
        if (s.error) status(s.error);
        publish();
      }
      return inspect();
    });
    return s.finishPromise;
  }
  function restorePresentation(s) {
    if (!s.pureQueued || s.restoreQueued) return s.restoration || Promise.resolve();
    s.restoreQueued = true;
    s.restoration = queuePresentation(async () => {
      if (s.pureTouched && await setPresentation(s.savedPresentation) !== s.savedPresentation)
        throw Error('未能恢复录屏前的纯净画面设置');
    });
    return s.restoration;
  }
  function stop() {
    if (current) return finish(current, {save: current.started, reason: 'user'});
    if (!disposed) { closeDialog(); phase = 'idle'; publish(); }
    return Promise.resolve(inspect());
  }
  function handleKey(event, down) {
    const code = event?.code || event?.key;
    if (code !== 'F9' && code !== 'Escape') return false;
    if (!down) { const owned = ownedKeys.delete(code); if (owned) event.preventDefault?.(); return owned; }
    if (disposed || !inspect().busy && !(dialog?.open && code === 'Escape')) return false;
    ownedKeys.add(code); event.preventDefault?.(); if (!event.repeat) void stop(); return true;
  }
  function dispose() {
    if (disposed) return current?.finishPromise || Promise.resolve(inspect());
    disposed = true; phase = 'disposed'; ownedKeys.clear();
    const finishing = current ? finish(current, {reason: 'disposed', immediate: true}) : Promise.resolve();
    closeDialog(); for (const remove of listeners.splice(0)) safe(remove);
    dialog?.remove(); if (ownsStylesheet) stylesheet?.remove();
    publish(true); return finishing.then(() => inspect());
  }
  listen(win, 'pagehide', dispose);
  return {open, stop, handleKey, inspect, dispose};
}
