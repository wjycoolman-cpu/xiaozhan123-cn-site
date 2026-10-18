// electric-drive automatic diagnostics. No manual-feedback client/store is used.
// Importing this module does not open storage, attach handlers, or make requests.
export const DIAGNOSTICS_DB = 'electric-drive-auto-diagnostics-private-v1';
export const APPROVED_ENDPOINT = 'https://xiaozhan-feedback-d1d5oh63be3b3b.api.tcloudbasegateway.com/v1/functions/qingci-feedback';
const GATEWAY_ORIGIN = 'https://xiaozhan-feedback-d1d5oh63be3b3b.api.tcloudbasegateway.com';
const SCHEMA = 'app-center-feedback/v1', ACK = 'app-center-feedback-ack/v1';
const STATE_SCHEMA = 'electric-drive-diagnostics/v1';
const TTL = 7 * 24 * 60 * 60 * 1000, HOUR = 60 * 60 * 1000;
const MAX_QUEUE = 8, MAX_SEEN = 64, CAPTURE_PER_HOUR = 3, SEND_PER_HOUR = 8;
const encoder = new TextEncoder(), decoder = new TextDecoder();
const aad = encoder.encode(STATE_SCHEMA);
const ownFiles = new Set([
  'game.js', 'core.js', 'world.js', 'track.js', 'encounters.js', 'audio.js',
  'pbr-city.js', 'landmarks.js', 'hero-support.js', 'carrier-vehicle.js', 'combat-visuals.js', 'road-detail.js', 'pursuit-visuals.js', 'postfx.js', 'race-interface.js', 'lighting-settings.js', 'N8AO.js', 'EffectComposer.js', 'UnrealBloomPass.js', 'OutputPass.js', 'ShaderPass.js', 'FXAAShader.js',
  'loader.js', 'web-update-client.js', 'three.module.js', 'three.core.js',
  'GLTFLoader.js', 'DRACOLoader.js', 'KTX2Loader.js', 'MeshoptDecoder.js',
]);
const errorNames = new Set(['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError']);
const fatalCodes = new Set(['startup_failed', 'module_load_failed', 'asset_load_failed', 'renderer_unavailable', 'integrity_failed', 'cache_failed', 'runtime_fatal']);
const stages = new Set(['loader', 'boot', 'runtime']);
const safeGet = (object, key) => { try { return object?.[key]; } catch { return undefined; } };
const boundedInt = value => Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 1e7 ? Number(value) : 0;
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const copy = value => JSON.parse(JSON.stringify(value));
const smallJson = (text, limit = 4096) => { try { return typeof text === 'string' && text.length <= limit ? JSON.parse(text) : null; } catch { return null; } };

// Only a public, allowlisted basename and bounded coordinates can leave here.
// Query/hash/userinfo, absolute path, raw message, stack text and function names
// are never included in the result. Unattributed/foreign script errors are dropped.
export function sanitizeGameError(error, context = {}, scopeURL) {
  let scope;
  try { scope = new URL(scopeURL); } catch { return null; }
  const frame = (source, line, column) => {
    if (typeof source !== 'string' || source.length > 4096) return null;
    try {
      const url = new URL(source, scope);
      const file = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
      if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || url.username || url.password || !ownFiles.has(file)) return null;
      return { file, line: boundedInt(line), column: boundedInt(column) };
    } catch { return null; }
  };
  const frames = [];
  const direct = frame(safeGet(context, 'file'), safeGet(context, 'line'), safeGet(context, 'column'));
  if (direct) frames.push(direct);
  const stack = safeGet(error, 'stack');
  if (typeof stack === 'string') {
    for (const line of stack.slice(0, 8192).split('\n').slice(0, 24)) {
      const match = line.trim().match(/(https?:\/\/[^\s()]+):(\d+):(\d+)\)?$/);
      if (!match) continue;
      const item = frame(match[1], match[2], match[3]);
      if (item && !frames.some(previous => JSON.stringify(previous) === JSON.stringify(item))) frames.push(item);
      if (frames.length === 3) break;
    }
  }
  if (!frames.length) return null;
  const rawName = safeGet(error, 'name');
  const name = typeof rawName === 'string' && errorNames.has(rawName) ? rawName : 'Error';
  return { code: name, kind: safeGet(context, 'kind') === 'unhandledrejection' ? 'unhandledrejection' : 'error', stage: 'runtime', frames };
}

function sanitizeFatal(input, scopeURL) {
  const code = safeGet(input, 'code'), stage = safeGet(input, 'stage');
  if (!input || safeGet(input, 'displayed') !== true || !fatalCodes.has(code)) return null;
  const attributed = sanitizeGameError(safeGet(input, 'error'), {}, scopeURL);
  return { code, kind: 'displayed_fatal', stage: stages.has(stage) ? stage : 'boot', frames: attributed?.frames || [] };
}

export function acceptedAck(response, payload) {
  const body = safeGet(response, 'body');
  return response?.ok === true && Number.isInteger(response.status) && response.status >= 200 && response.status < 300 &&
    body && typeof body === 'object' && !Array.isArray(body) &&
    body.schema === ACK && body.requestId === payload.requestId && body.productId === 'electric-drive' &&
    ['accepted', 'duplicate'].includes(body.status);
}

// Dedicated store. CryptoKey is structured-cloned by IDB, remains nonextractable,
// and is never returned by the public diagnostics API or exported as key bytes.
// Revision CAS prevents lost writes between tabs even without Web Locks.
function createIndexedDBBackend(indexedDB = globalThis.indexedDB) {
  let db;
  const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('storage_unavailable'));
  });
  const transaction = (mode, operate) => new Promise((resolve, reject) => {
    let result;
    const tx = db.transaction('private', mode);
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(new Error('storage_unavailable'));
    operate(tx.objectStore('private'), value => { result = value; });
  });
  return {
    async open() {
      if (!indexedDB) throw new Error('storage_unavailable');
      const request = indexedDB.open(DIAGNOSTICS_DB, 1);
      let expired = false;
      request.onupgradeneeded = () => request.result.createObjectStore('private');
      const timeout = new Promise((_, reject) => {
        const timer = setTimeout(() => { expired = true; reject(new Error('storage_unavailable')); }, 8000);
        request.addEventListener('success', () => { clearTimeout(timer); if (expired) request.result.close(); }, { once: true });
        request.addEventListener('error', () => clearTimeout(timer), { once: true });
      });
      db = await Promise.race([requestValue(request), timeout]);
      db.onversionchange = () => db.close();
    },
    ensureKey(proposed) {
      return transaction('readwrite', (store, done) => {
        const request = store.get('aes-key');
        request.onsuccess = () => {
          const key = request.result || proposed;
          if (!request.result) store.put(key, 'aes-key');
          done(key);
        };
      });
    },
    read() { return transaction('readonly', (store, done) => { const request = store.get('sealed-state'); request.onsuccess = () => done(request.result); }); },
    commit(revision, sealed) {
      return transaction('readwrite', (store, done) => {
        const request = store.get('sealed-state');
        request.onsuccess = () => {
          if ((request.result?.revision || 0) !== revision) return done(false);
          store.put({ ...sealed, revision: revision + 1 }, 'sealed-state'); done(true);
        };
      });
    },
    close() { db?.close(); },
  };
}

function newState(crypto) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const value = hex(bytes);
  return { schema: STATE_SCHEMA, enabled: true, deviceId: [value.slice(0, 8), value.slice(8, 12), value.slice(12, 16), value.slice(16, 20), value.slice(20)].join('-'), queue: [], seen: [], captures: [], sends: [] };
}

function validPayload(payload) {
  const keys = ['schema', 'requestId', 'productId', 'version', 'message', 'contact', 'source', 'createdAt'];
  return payload && typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).length === 8 &&
    keys.every(key => typeof payload[key] === 'string') && payload.schema === SCHEMA && payload.productId === 'electric-drive' &&
    /^wf_[a-f0-9]{32}$/.test(payload.requestId) && payload.version.length > 0 && payload.version.length <= 80 && !/[^A-Za-z0-9._+ -]/.test(payload.version) &&
    payload.message.length <= 600 && /^\[自动技术诊断\]\n(?:code|kind|stage|file)=[A-Za-z0-9_.:\-]+(?:\n(?:code|kind|stage|file)=[A-Za-z0-9_.:\-]+)*$/.test(payload.message) &&
    payload.contact === '' && payload.source === 'game' && /^20[2-9][0-9]-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(payload.createdAt) && Number.isFinite(Date.parse(payload.createdAt));
}

function validState(state) {
  return state?.schema === STATE_SCHEMA && typeof state.enabled === 'boolean' && /^[a-f0-9-]{36}$/.test(state.deviceId) &&
    Array.isArray(state.queue) && state.queue.length <= MAX_QUEUE && state.queue.every(item => validPayload(item.payload) && /^[a-f0-9]{64}$/.test(item.fingerprint) && Number.isFinite(item.created) && Number.isFinite(item.next) && Number.isInteger(item.attempts)) &&
    Array.isArray(state.seen) && state.seen.length <= MAX_SEEN && state.seen.every(item => /^[a-f0-9]{64}$/.test(item.fingerprint) && Number.isFinite(item.time)) &&
    ['captures', 'sends'].every(key => Array.isArray(state[key]) && state[key].length <= SEND_PER_HOUR && state[key].every(Number.isFinite));
}

function prune(state, now) {
  state.queue = state.queue.filter(item => now - item.created < TTL && now >= item.created - HOUR);
  state.seen = state.seen.filter(item => now - item.time < TTL && now >= item.time - HOUR).slice(-MAX_SEEN);
  state.captures = state.captures.filter(time => now - time < HOUR && time <= now);
  state.sends = state.sends.filter(time => now - time < HOUR && time <= now);
}

function createVault(backend, crypto) {
  let key;
  return {
    async open() {
      if (!crypto?.subtle || !crypto.getRandomValues) throw new Error('secure_storage_unavailable');
      await backend.open();
      const proposed = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      key = await backend.ensureKey(proposed);
      if (!key || key.extractable !== false || key.algorithm?.name !== 'AES-GCM' || key.algorithm.length !== 256 || !key.usages.includes('encrypt') || !key.usages.includes('decrypt')) throw new Error('secure_storage_unavailable');
    },
    async load() {
      const stored = await backend.read();
      if (!stored) return { revision: 0, state: newState(crypto) };
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: stored.iv, additionalData: aad }, key, stored.ciphertext);
      const state = JSON.parse(decoder.decode(plaintext));
      if (!validState(state)) throw new Error('secure_storage_unavailable');
      return { revision: stored.revision, state };
    },
    async save(state, revision) {
      if (!validState(state)) throw new Error('secure_storage_unavailable');
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, encoder.encode(JSON.stringify(state)));
      return backend.commit(revision, { iv, ciphertext });
    },
    close() { key = null; backend.close?.(); },
  };
}

// Same approved anonymous HTTP gateway flow as feedback-client.js. No account,
// admin key, manual-draft device key, localStorage or arbitrary endpoint is used.
function createGatewayDelivery() {
  let session;
  async function token(deviceId, signal) {
    if (session && Date.now() < session.until) return session.value;
    const response = await fetch(GATEWAY_ORIGIN + '/auth/v1/signin/anonymously', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-device-id': deviceId },
      body: '{}', signal, credentials: 'omit', mode: 'cors', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
    });
    const body = smallJson(await response.text(), 32768);
    if (!response.ok || !body || typeof body.access_token !== 'string' || !body.access_token || body.access_token.length > 16384 ||
      !Number.isFinite(body.expires_in) || body.expires_in <= 0 || body.expires_in > 86400 ||
      (body.token_type !== undefined && String(body.token_type).toLowerCase() !== 'bearer')) throw new Error('anonymous_auth_unavailable');
    session = { value: body.access_token, until: Date.now() + Math.max(0, body.expires_in - 60) * 1000 };
    return session.value;
  }
  return async (payload, { signal, deviceId }) => {
    const envelope = JSON.stringify({ httpMethod: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    for (let attempt = 0; attempt < 2; attempt++) {
      const usedToken = await token(deviceId, signal);
      const response = await fetch(APPROVED_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + usedToken },
        body: envelope, signal, credentials: 'omit', mode: 'cors', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
      });
      const wrapper = response.ok ? smallJson(await response.text(), 16384) : null;
      const valid = wrapper && !Array.isArray(wrapper) && Number.isInteger(wrapper.statusCode) && wrapper.statusCode >= 100 && wrapper.statusCode <= 599 &&
        typeof wrapper.body === 'string' && wrapper.body.length <= 4096 && (wrapper.isBase64Encoded === undefined || wrapper.isBase64Encoded === false);
      if (response.status === 401 || (valid && wrapper.statusCode === 401)) {
        if (session?.value === usedToken) session = null;
        if (attempt === 0) continue;
        return { status: 401, ok: false };
      }
      if (!response.ok) return { status: response.status, ok: false };
      if (!valid) return { status: 200, ok: true, body: null };
      return { status: wrapper.statusCode, ok: wrapper.statusCode >= 200 && wrapper.statusCode < 300, body: smallJson(wrapper.body) };
    }
  };
}

/** One owner per game document. No initialization or upload can block game boot.
 * Test-only injection: backend (opaque key/ciphertext CAS store), transport
 * (sanitized eight-field payload -> {status,ok,body}), crypto, now, eventTarget.
 * No caller-selectable endpoint and no plaintext-storage fallback exist.
 */
export function createDiagnostics(options = {}) {
  const crypto = options.crypto || globalThis.crypto;
  const backend = options.backend || createIndexedDBBackend();
  const vault = createVault(backend, crypto);
  const now = options.now || Date.now;
  const target = options.eventTarget || globalThis.window;
  const scopeURL = options.scopeURL || new URL('./', import.meta.url).href;
  const transport = options.transport || createGatewayDelivery();
  const online = options.online || (() => globalThis.navigator?.onLine !== false);
  const tag = value => typeof value === 'string' && value.length > 0 && value.length <= 36 && /^[A-Za-z0-9]/.test(value) && !/[^A-Za-z0-9._+-]/.test(value) ? value : '';
  const version = tag(options.version), build = tag(options.build);
  const versionField = version + ' ' + build;
  let enabled = true, available = false, destroyed = false, generation = 0;
  let preference = null, remotePause = false, currentController, flushPromise, operation = Promise.resolve();
  let status = { available: false, enabled: true, pending: 0, outcome: 'initializing' };
  const listeners = new Set(), detach = new Set();
  let channel;
  try {
    if (target?.document && globalThis.BroadcastChannel && options.broadcast !== false) {
      channel = new BroadcastChannel(DIAGNOSTICS_DB);
      channel.onmessage = event => {
        if (event.data?.type === 'disabled') {
          remotePause = true; enabled = false; generation++; currentController?.abort();
          status = { ...status, enabled: false, outcome: 'off' }; notify();
        } else if (event.data?.type === 'settings') {
          remotePause = false;
          void serial(async () => { if (available) await edit(() => {}); });
        }
      };
    }
  } catch { /* Optional cross-tab notice; storage CAS remains authoritative. */ }
  function notify() { for (const listener of listeners) { try { listener({ ...status }); } catch {} } }
  function unavailable() {
    available = false; enabled = false; currentController?.abort();
    status = { available: false, enabled: false, pending: 0, outcome: 'unavailable' }; notify();
  }
  function serial(job) {
    const result = operation.then(async () => { if (destroyed) return false; try { return await job(); } catch { unavailable(); return false; } });
    operation = result.then(() => undefined, () => undefined);
    return result;
  }
  async function edit(change) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { state, revision } = await vault.load();
      prune(state, now());
      const result = change(state);
      if (!await vault.save(state, revision)) continue;
      if (preference === null) enabled = !remotePause && state.enabled;
      status = { available, enabled, pending: state.queue.length, outcome: enabled ? status.outcome : 'off' }; notify();
      return result;
    }
    throw new Error('storage_conflict');
  }
  const ready = serial(async () => {
    if (!version || !build) return unavailable();
    await vault.open(); available = true;
    await edit(state => { if (preference !== null) state.enabled = preference; status.outcome = state.enabled ? 'idle' : 'off'; });
    return { ...status };
  });

  function capture(normalized) {
    const epoch = generation;
    if (!normalized || destroyed || !enabled) return Promise.resolve(false);
    return serial(async () => {
      if (!available || !enabled || epoch !== generation) return false;
      const fingerprint = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(versionField + '\n' + JSON.stringify(normalized)))));
      return edit(state => {
        if (!state.enabled || !enabled || epoch !== generation || state.seen.some(item => item.fingerprint === fingerprint)) return false;
        if (state.queue.length >= MAX_QUEUE || state.captures.length >= CAPTURE_PER_HOUR) { status.outcome = 'limited'; return false; }
        const time = now();
        const message = '[自动技术诊断]\ncode=' + normalized.code + '\nkind=' + normalized.kind + '\nstage=' + normalized.stage +
          normalized.frames.map(frame => '\nfile=' + frame.file + ':' + frame.line + ':' + frame.column).join('');
        const payload = { schema: SCHEMA, requestId: 'wf_' + hex(crypto.getRandomValues(new Uint8Array(16))), productId: 'electric-drive', version: versionField, message, contact: '', source: 'game', createdAt: new Date(time).toISOString() };
        state.queue.push({ payload, fingerprint, created: time, attempts: 0, next: 0 });
        state.seen.push({ fingerprint, time }); state.seen = state.seen.slice(-MAX_SEEN); state.captures.push(time);
        status.outcome = 'queued'; return true;
      });
    });
  }

  async function send(payload, deviceId, signal) {
    let timer, abort;
    try {
      return await Promise.race([
        Promise.resolve().then(() => { if (signal.aborted) throw new Error('aborted'); return transport(Object.freeze(copy(payload)), { signal, deviceId }); }),
        new Promise((_, reject) => {
          abort = () => reject(new Error('aborted'));
          signal.addEventListener('abort', abort, { once: true });
          timer = setTimeout(() => { currentController?.abort(); reject(new Error('timeout')); }, 10000);
          if (signal.aborted) abort();
        }),
      ]);
    } catch { return null; }
    finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  }

  function retry() {
    if (flushPromise) return flushPromise;
    flushPromise = (async () => {
      await ready;
      if (destroyed || !available || !enabled) return false;
      if (!online()) { status.outcome = 'offline'; notify(); return false; }
      const epoch = generation;
      for (let count = 0; count < MAX_QUEUE && available && enabled && !destroyed && epoch === generation; count++) {
        const selected = await serial(() => edit(state => {
          if (!state.enabled || !enabled || epoch !== generation) return null;
          if (state.sends.length >= SEND_PER_HOUR) { status.outcome = 'limited'; return null; }
          const entry = state.queue.find(item => item.next <= now());
          if (!entry) { status.outcome = state.queue.length ? 'cooldown' : 'empty'; return null; }
          entry.attempts++; entry.next = now() + Math.min(6 * HOUR, 60000 * 5 ** Math.min(entry.attempts - 1, 4));
          state.sends.push(now()); return { payload: copy(entry.payload), deviceId: state.deviceId };
        }));
        if (!selected || !enabled || !available || epoch !== generation || destroyed) break;
        currentController = new AbortController();
        const response = await send(selected.payload, selected.deviceId, currentController.signal);
        currentController = null;
        if (!enabled || !available || epoch !== generation || destroyed) break;
        if (!acceptedAck(response, selected.payload)) { status.outcome = 'pending'; notify(); break; }
        await serial(() => edit(state => {
          if (!state.enabled || !enabled || epoch !== generation) return;
          state.queue = state.queue.filter(item => item.payload.requestId !== selected.payload.requestId);
          status.outcome = 'acknowledged';
        }));
      }
      return status.pending === 0;
    })().catch(() => { unavailable(); return false; }).finally(() => { flushPromise = null; });
    return flushPromise;
  }

  function setEnabled(value) {
    if (destroyed) return Promise.resolve(false);
    const desired = Boolean(value);
    enabled = desired; preference = desired; remotePause = false; generation++;
    const epoch = generation;
    if (!enabled) {
      currentController?.abort();
      try { channel?.postMessage({ type: 'disabled' }); } catch {}
      status = { ...status, enabled: false, outcome: 'off' }; notify();
    }
    return serial(async () => {
      if (!available) return false;
      const result = await edit(state => {
        state.enabled = desired;
        if (!state.enabled) { state.queue = []; state.seen = []; state.captures = []; state.sends = []; }
        status.outcome = state.enabled ? 'idle' : 'off'; return true;
      });
      if (epoch === generation) preference = null;
      try { channel?.postMessage({ type: 'settings' }); } catch {}
      return result;
    });
  }

  function attach() {
    if (!target?.addEventListener || destroyed || detach.size) return;
    const error = event => { void capture(sanitizeGameError(safeGet(event, 'error'), { file: safeGet(event, 'filename'), line: safeGet(event, 'lineno'), column: safeGet(event, 'colno') }, scopeURL)); };
    const rejection = event => { void capture(sanitizeGameError(safeGet(event, 'reason'), { kind: 'unhandledrejection' }, scopeURL)); };
    const onlineEvent = () => { void retry(); };
    for (const [name, handler] of [['error', error], ['unhandledrejection', rejection], ['online', onlineEvent]]) {
      target.addEventListener(name, handler);
      detach.add(() => target.removeEventListener(name, handler));
    }
  }

  function mountControl(host) {
    if (!host?.ownerDocument || destroyed) return () => {};
    const doc = host.ownerDocument, group = doc.createElement('fieldset'), label = doc.createElement('label');
    const toggle = doc.createElement('input'), explanation = doc.createElement('p'), text = doc.createElement('p'), button = doc.createElement('button');
    group.className = 'electric-drive-diagnostics'; toggle.type = 'checkbox';
    label.append(toggle, doc.createTextNode(' 自动诊断'));
    explanation.textContent = '只发送版本和脱敏错误类别、游戏文件与行号，帮助修复问题，送达网站私有反馈信箱。不收输入、联系方式或存档；加密本地待发最多7天。关闭会清除待发并停止采集和上传。';
    text.setAttribute('aria-live', 'polite'); button.type = 'button'; button.textContent = '重试待发';
    group.append(label, explanation, text, button); host.append(group);
    const update = state => {
      toggle.checked = state.enabled; toggle.disabled = !state.available;
      button.disabled = !state.available || !state.enabled || !state.pending;
      text.textContent = state.outcome === 'initializing' ? '正在准备本地加密保存。' : !state.available ? '本次自动诊断不可用，不会继续保存或上传。' : !state.enabled ? '已关闭。' : state.pending ? '已加密待发 ' + state.pending + ' 条；联网后可重试。' : '已开启。';
    };
    listeners.add(update); update(status);
    toggle.addEventListener('change', () => { void setEnabled(toggle.checked); });
    button.addEventListener('click', () => { void retry(); });
    const remove = () => { listeners.delete(update); group.remove(); };
    return remove;
  }

  const api = {
    ready, retry, setEnabled, attach, mountControl,
    captureError(error, context = {}) { return capture(sanitizeGameError(error, context, scopeURL)); },
    captureDisplayedFatal(input) { return capture(sanitizeFatal(input, scopeURL)); },
    getStatus() { return { ...status }; },
    subscribe(callback) { listeners.add(callback); try { callback({ ...status }); } catch {} return () => listeners.delete(callback); },
    destroy() {
      destroyed = true; generation++; currentController?.abort();
      for (const remove of detach) remove(); detach.clear(); channel?.close(); listeners.clear();
      void operation.finally(() => vault.close());
    },
  };
  if (options.attach !== false) attach();
  if (options.startupRetry !== false) void ready.then(() => retry());
  return api;
}
