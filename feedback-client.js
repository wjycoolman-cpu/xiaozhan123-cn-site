(function (global) {
  'use strict';
  const PRODUCTS = new Set(['skymyth', 'pocket-piano', 'mianji', 'qingci', 'question-bank', 'stardew-farm', 'resume-studio', 'yuji', 'subtitle-studio', 'website']);
  const LEGACY_PRODUCTS = new Set(['kfc-order']);
  const GATEWAY_ORIGIN = 'https://xiaozhan-feedback-d1d5oh63be3b3b.api.tcloudbasegateway.com';
  const APPROVED_ENDPOINT = GATEWAY_ORIGIN + '/v1/functions/qingci-feedback';
  const DEVICE_KEY = 'website-feedback-anonymous-device-v1';
  let deviceId, authSession;
  const SCHEMA = 'app-center-feedback/v1';
  const ACK_SCHEMA = 'app-center-feedback-ack/v1';
  const DB_NAME = 'app-center-feedback-private-v1';
  const TTL = 7 * 24 * 60 * 60 * 1000;
  const MAX_PENDING = 20;
  const clone = value => JSON.parse(JSON.stringify(value));
  const emptyState = () => ({ schema: 'feedback-draft/v1', draft: { message: '', contact: '', updatedAt: 0, intentId: null }, attempts: [] });
  const sameContent = (draft, payload) => draft.message === payload.message && draft.contact === payload.contact;
  const requireProduct = id => { if (!PRODUCTS.has(id) && !LEGACY_PRODUCTS.has(id)) throw new Error('unsupported_product'); };
  const encoder = new TextEncoder();
  const utf8Length = value => encoder.encode(value).byteLength;
  const validTimestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  const forbiddenControls = value => /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value);
  const singleLineControls = value => /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value);
  function validUnicode(value) {
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(++i);
        if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      } else if (code >= 0xdc00 && code <= 0xdfff) return false;
    }
    return true;
  }

  function endpoint(value) {
    if (typeof value !== 'string' || !value) return '';
    try {
      const page = new URL(global.location.href), u = new URL(value, page);
      if (u.username || u.password || u.href.includes('?') || u.href.includes('#')) return '';
      if (value === APPROVED_ENDPOINT) return APPROVED_ENDPOINT;
      const loopback = ['localhost', '127.0.0.1', '[::1]'];
      return loopback.includes(page.hostname) && loopback.includes(u.hostname) && u.protocol === 'http:' ? u.href : '';
    } catch { return ''; }
  }

  function payloadError(p, productId) {
    const keys = ['schema', 'requestId', 'productId', 'version', 'message', 'contact', 'source', 'createdAt'];
    if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).length !== keys.length || !keys.every(k => Object.prototype.hasOwnProperty.call(p, k) && typeof p[k] === 'string' && validUnicode(p[k]))) return 'invalid_fields';
    if (p.schema !== SCHEMA || !/^wf_[a-f0-9]{32}$/.test(p.requestId) || p.productId !== productId || !PRODUCTS.has(productId) || p.source !== 'app-center') return 'invalid_identity';
    if (Array.from(p.version).length > 80 || singleLineControls(p.version)) return 'invalid_version';
    if (!validTimestamp(p.createdAt)) return 'invalid_time';
    if (Array.from(p.message).length < 3 || Array.from(p.message).length > 4000) return 'message_length';
    if (!p.message.trim()) return 'empty_message';
    if (utf8Length(p.message) > 12 * 1024) return 'message_bytes';
    if (Array.from(p.contact).length > 160) return 'contact_length';
    if (forbiddenControls(p.message) || singleLineControls(p.contact)) return 'invalid_text';
    if (utf8Length(JSON.stringify(p)) > 16 * 1024) return 'body_bytes';
    return '';
  }
  const validPayload = (p, productId) => !payloadError(p, productId);

  // Only restore/retry uses the frozen F29 validator. New intents use payloadError.
  // Retained old requests must remain readable even when today's receiver rejects
  // their Unicode or single-line fields. Never normalize or rewrite their payload.
  function validLegacyPayload(p, productId) {
    const keys = ['schema', 'requestId', 'productId', 'version', 'message', 'contact', 'source', 'createdAt'];
    return p && typeof p === 'object' && !Array.isArray(p) && Object.keys(p).length === keys.length &&
      keys.every(k => Object.prototype.hasOwnProperty.call(p, k) && typeof p[k] === 'string') &&
      p.schema === SCHEMA && /^wf_[a-f0-9]{32}$/.test(p.requestId) && p.productId === productId && (PRODUCTS.has(productId) || LEGACY_PRODUCTS.has(productId)) && p.source === 'app-center' &&
      p.version.length <= 80 && !/[\u0000-\u001f\u007f-\u009f]/.test(p.version) && validTimestamp(p.createdAt) &&
      Array.from(p.message).length >= 3 && Array.from(p.message).length <= 4000 && utf8Length(p.message) <= 12 * 1024 &&
      Array.from(p.contact).length <= 160 && !forbiddenControls(p.message) && !forbiddenControls(p.contact) && utf8Length(JSON.stringify(p)) <= 16 * 1024;
  }
  const savedPayloadValid = (p, productId) => validPayload(p, productId) || validLegacyPayload(p, productId);

  function anonymousDeviceId() {
    if (deviceId) return deviceId;
    try { deviceId = global.localStorage.getItem(DEVICE_KEY); } catch {}
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(deviceId || '')) {
      if (!global.crypto?.getRandomValues) throw new Error('secure_random_unavailable');
      const bytes = global.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      deviceId = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
      try { global.localStorage.setItem(DEVICE_KEY, deviceId); } catch {}
    }
    return deviceId;
  }

  function parseSmallJson(text, limit = 4096) {
    try { return typeof text === 'string' && text.length <= limit ? JSON.parse(text) : null; } catch { return null; }
  }

  async function anonymousToken(signal) {
    if (authSession && Date.now() < authSession.until) return authSession.value;
    const response = await fetch(GATEWAY_ORIGIN + '/auth/v1/signin/anonymously', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-device-id': anonymousDeviceId() },
      body: '{}', signal, credentials: 'omit', mode: 'cors', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer'
    });
    const body = parseSmallJson(await response.text(), 32768);
    if (!response.ok || !body || typeof body.access_token !== 'string' || !body.access_token || body.access_token.length > 16384 ||
        !Number.isFinite(body.expires_in) || body.expires_in <= 0 || body.expires_in > 86400 ||
        (body.token_type !== undefined && String(body.token_type).toLowerCase() !== 'bearer')) throw new Error('anonymous_auth_unavailable');
    authSession = { value: body.access_token, until: Date.now() + Math.max(0, body.expires_in - 60) * 1000 };
    return authSession.value;
  }

  async function gatewayDelivery(rawPayload, signal) {
    const envelope = JSON.stringify({ httpMethod: 'POST', headers: { 'content-type': 'application/json' }, body: rawPayload });
    for (let attempt = 0; attempt < 2; attempt++) {
      const usedToken = await anonymousToken(signal);
      const response = await fetch(APPROVED_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + usedToken },
        body: envelope, signal, credentials: 'omit', mode: 'cors', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer'
      });
      const wrapper = response.ok ? parseSmallJson(await response.text(), 16384) : null;
      const validWrapper = wrapper && !Array.isArray(wrapper) && Number.isInteger(wrapper.statusCode) && wrapper.statusCode >= 100 && wrapper.statusCode <= 599 &&
        typeof wrapper.body === 'string' && wrapper.body.length <= 4096 && (wrapper.isBase64Encoded === undefined || wrapper.isBase64Encoded === false);
      if (response.status === 401 || (validWrapper && wrapper.statusCode === 401)) {
        if (authSession?.value === usedToken) authSession = null;
        if (attempt === 0) continue;
        return { status: 401, ok: false, authenticationFailure: true };
      }
      if (!response.ok) return { status: response.status, ok: false };
      if (!validWrapper) return { status: 200, ok: true, body: null };
      return { status: wrapper.statusCode, ok: wrapper.statusCode >= 200 && wrapper.statusCode < 300, body: parseSmallJson(wrapper.body) };
    }
  }

  function prune(value, productId, now) {
    if (!value || value.schema !== 'feedback-draft/v1' || !value.draft || !Array.isArray(value.attempts)) throw new Error('invalid_saved_state');
    const draft = value.draft;
    if (typeof draft.message !== 'string' || typeof draft.contact !== 'string' || draft.message.length > 8000 || draft.contact.length > 320 || !Number.isFinite(draft.updatedAt)) throw new Error('invalid_saved_draft');
    if (value.attempts.length > MAX_PENDING || value.attempts.some(a => !savedPayloadValid(a.payload, productId) || !['uncertain', 'conflict', 'rejected'].includes(a.state))) throw new Error('invalid_saved_attempt');
    value.attempts = value.attempts.filter(a => Date.parse(a.payload.createdAt) + TTL > now);
    if (draft.updatedAt + TTL <= now) value.draft = emptyState().draft;
    if (value.draft.intentId && !value.attempts.some(a => a.payload.requestId === value.draft.intentId && sameContent(value.draft, a.payload))) value.draft.intentId = null;
    return value;
  }

  async function vault(now) {
    let db, key;
    const storage = { mode: 'memory', reason: 'unavailable' };
    function fail(reason) { storage.mode = 'memory'; storage.reason = reason; }
    function request(store, mode, operation) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        let result;
        const q = operation(transaction.objectStore(store));
        q.onsuccess = () => { result = q.result; };
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = transaction.onerror = () => reject(new Error('storage_failed'));
      });
    }
    try {
      if (!global.indexedDB || !global.crypto?.subtle || !global.crypto?.getRandomValues) throw new Error('storage_unavailable');
      db = await new Promise((resolve, reject) => {
        const q = global.indexedDB.open(DB_NAME, 1);
        let ended = false;
        const timer = setTimeout(() => { ended = true; reject(new Error('storage_timeout')); }, 4000);
        q.onupgradeneeded = () => { q.result.createObjectStore('keys'); q.result.createObjectStore('drafts', { keyPath: 'productId' }); };
        q.onsuccess = () => { clearTimeout(timer); if (ended) q.result.close(); else resolve(q.result); };
        q.onerror = () => { clearTimeout(timer); reject(new Error('storage_unavailable')); };
        q.onblocked = () => { clearTimeout(timer); ended = true; reject(new Error('storage_blocked')); };
      });
      const generated = await global.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      key = await new Promise((resolve, reject) => {
        const tx = db.transaction('keys', 'readwrite'), store = tx.objectStore('keys'), q = store.get('aes-gcm');
        let selected;
        q.onsuccess = () => { selected = q.result || generated; if (!q.result) store.put(selected, 'aes-gcm'); };
        tx.oncomplete = () => resolve(selected);
        tx.onerror = tx.onabort = () => reject(new Error('key_storage_failed'));
      });
      if (!key || key.extractable !== false || key.algorithm?.name !== 'AES-GCM' || key.algorithm?.length !== 256) throw new Error('invalid_saved_key');
      await new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite'), q = tx.objectStore('drafts').openCursor();
        q.onsuccess = () => { const cursor = q.result; if (cursor) { if (!Number.isFinite(cursor.value.expiresAt) || cursor.value.expiresAt <= now()) cursor.delete(); cursor.continue(); } };
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(new Error('cleanup_failed'));
      });
      storage.mode = 'encrypted'; storage.reason = '';
      db.onversionchange = () => { db.close(); fail('storage_changed'); };
    } catch { if (db) db.close(); db = null; fail('unavailable'); }
    const aad = id => new TextEncoder().encode('feedback-draft/v1|' + id);
    return {
      storage,
      fail,
      async read(id) {
        const record = await request('drafts', 'readonly', store => store.get(id));
        if (!record) return { revision: 0, state: emptyState() };
        if (record.expiresAt <= now()) return { revision: record.revision, state: emptyState() };
        const bytes = await global.crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv, additionalData: aad(id) }, key, record.ciphertext);
        return { revision: record.revision, state: JSON.parse(new TextDecoder().decode(bytes)) };
      },
      async write(id, state, revision) {
        const times = state.attempts.map(a => Date.parse(a.payload.createdAt) + TTL);
        if (state.draft.message || state.draft.contact) times.push(state.draft.updatedAt + TTL);
        let record;
        if (times.length) {
          const iv = global.crypto.getRandomValues(new Uint8Array(12));
          const ciphertext = new Uint8Array(await global.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(id) }, key, new TextEncoder().encode(JSON.stringify(state))));
          record = { productId: id, revision: revision + 1, expiresAt: Math.max(...times), iv, ciphertext };
        }
        return new Promise((resolve, reject) => {
          const tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts'), q = store.get(id);
          let conflict = false;
          q.onsuccess = () => { if ((q.result?.revision || 0) !== revision) { conflict = true; tx.abort(); } else if (record) store.put(record); else store.delete(id); };
          tx.oncomplete = resolve;
          tx.onerror = tx.onabort = () => reject(new Error(conflict ? 'revision_conflict' : 'storage_failed'));
        });
      },
      async erase(id) { if (!db) return false; await request('drafts', 'readwrite', store => store.delete(id)); return true; }
    };
  }

  async function create(options = {}) {
    const now = options.now || Date.now;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(10, Math.min(20000, options.timeoutMs)) : 20000;
    const store = await vault(now);
    const cache = new Map(), serial = new Map(), inFlight = new Set();
    function storageNotice() {
      return store.storage.mode === 'encrypted' ? '草稿与待确认反馈已加密保存在此浏览器；可恢复 7 天内的内容，过期副本在下次打开时清理。共用设备可清除本机保存。' :
        store.storage.reason === 'read_failed' ? '已有加密草稿暂时无法读取，旧副本未被删除。新内容只保留在当前页面，刷新或关闭后会丢失。' :
        '此浏览器暂时无法保存加密草稿；内容只保留在当前页面，刷新或关闭后会丢失。';
    }
    const snapshot = state => ({ ...clone(state), storage: { mode: store.storage.mode, notice: storageNotice() } });
    function mutate(id, action) {
      requireProduct(id);
      const work = async () => {
        for (let attempt = 0; attempt < 5; attempt++) {
          let record = { revision: 0, state: clone(cache.get(id) || emptyState()) };
          if (store.storage.mode === 'encrypted') {
            try { record = await store.read(id); record.state = prune(record.state, id, now()); }
            catch { store.fail('read_failed'); record.state = clone(cache.get(id) || emptyState()); }
          } else record.state = prune(record.state, id, now());
          const value = action(record.state);
          if (store.storage.mode === 'encrypted') {
            try { await store.write(id, record.state, record.revision); }
            catch (e) { if (e.message === 'revision_conflict') continue; store.fail('write_failed'); }
          }
          cache.set(id, clone(record.state));
          return { value, state: snapshot(record.state) };
        }
        throw new Error('concurrent_edit');
      };
      const next = (serial.get(id) || Promise.resolve()).then(work);
      serial.set(id, next.catch(() => {}));
      return next;
    }
    function setDraftOnState(state, message, contact) {
      if (state.draft.message === message && state.draft.contact === contact) return;
      const associated = state.attempts.find(a => a.payload.requestId === state.draft.intentId);
      if (associated && !sameContent({ message, contact }, associated.payload)) state.draft.intentId = null;
      state.draft.message = message; state.draft.contact = contact; state.draft.updatedAt = now();
    }
    function requestId() {
      if (!global.crypto?.getRandomValues) throw new Error('secure_random_unavailable');
      return 'wf_' + Array.from(global.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    }
    async function transmit(productId, payload, target) {
      const key = productId + ':' + payload.requestId;
      if (inFlight.has(key)) return { kind: 'busy', payload };
      inFlight.add(key);
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
      let outcome;
      try {
        const rawPayload = JSON.stringify(payload);
        let response;
        if (target === APPROVED_ENDPOINT) response = await gatewayDelivery(rawPayload, controller.signal);
        else {
          const reply = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: rawPayload, signal: controller.signal, credentials: 'omit', mode: 'cors', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
          response = { status: reply.status, ok: reply.ok, body: reply.ok ? parseSmallJson(await reply.text()) : null };
        }
        if (response.status === 409) outcome = { kind: 'conflict', reason: 'id_conflict', payload };
        else if (response.authenticationFailure) outcome = { kind: 'uncertain', reason: 'auth_unavailable', payload };
        else if (!response.ok) outcome = { kind: response.status === 408 || response.status === 429 || response.status >= 500 ? 'uncertain' : 'rejected', reason: 'http_' + response.status, payload };
        else {
          const body = response.body;
          outcome = body && !Array.isArray(body) && body.schema === ACK_SCHEMA && body.requestId === payload.requestId && body.productId === productId && ['accepted', 'duplicate'].includes(body.status) ?
            { kind: 'accepted', receiptStatus: body.status, payload } : { kind: 'uncertain', reason: 'ack_mismatch', payload };
        }
      } catch { outcome = { kind: 'uncertain', reason: controller.signal.aborted ? 'timeout' : 'network', payload }; }
      finally { clearTimeout(timer); inFlight.delete(key); }
      const result = await mutate(productId, state => {
        const current = state.attempts.find(a => a.payload.requestId === payload.requestId);
        if (!current) return false;
        if (outcome.kind === 'accepted') {
          state.attempts = state.attempts.filter(a => a !== current);
          const clears = state.draft.intentId === payload.requestId && sameContent(state.draft, payload);
          if (clears) state.draft = emptyState().draft;
          return clears;
        }
        current.state = outcome.kind; current.reason = outcome.reason;
        return false;
      });
      return { ...outcome, clearedDraft: result.value, state: result.state };
    }
    return {
      endpoint,
      async get(productId) { return (await mutate(productId, () => {})).state; },
      async setDraft(productId, message, contact = '') {
        if (typeof message !== 'string' || typeof contact !== 'string' || message.length > 8000 || contact.length > 320) throw new Error('invalid_draft');
        return (await mutate(productId, state => setDraftOnState(state, message, contact))).state;
      },
      async restoreAttempt(productId, id) {
        return (await mutate(productId, state => { const a = state.attempts.find(a => a.payload.requestId === id); if (!a) throw new Error('missing_request'); state.draft = { message: a.payload.message, contact: a.payload.contact, updatedAt: now(), intentId: id }; })).state;
      },
      async submit({ productId, version = '', message, contact = '', endpoint: value }) {
        const target = endpoint(value); if (!target) throw new Error('endpoint_unavailable');
        requireProduct(productId);
        if (typeof message !== 'string' || typeof contact !== 'string' || message.length > 8000 || contact.length > 320) return { kind: 'invalid_input', reason: typeof contact !== 'string' || contact.length > 320 ? 'contact_length' : 'message_length', state: (await mutate(productId, () => {})).state };
        let fresh;
        const prepared = await mutate(productId, state => {
          setDraftOnState(state, message, contact);
          let item = state.attempts.find(a => a.payload.requestId === state.draft.intentId);
          if (item && item.state !== 'uncertain') return { error: item.state };
          if (!item) {
            if (state.attempts.length >= MAX_PENDING) return { error: 'queue_full' };
            fresh ||= { schema: SCHEMA, requestId: requestId(), productId, version, message, contact, source: 'app-center', createdAt: new Date(now()).toISOString() };
            const reason = payloadError(fresh, productId);
            if (reason) return { error: 'invalid_input', reason };
            item = { payload: fresh, state: 'uncertain', reason: 'pending' }; state.attempts.push(item); state.draft.intentId = fresh.requestId;
          }
          return { payload: clone(item.payload) };
        });
        if (prepared.value.error) return { kind: prepared.value.error, reason: prepared.value.reason, state: prepared.state };
        return transmit(productId, prepared.value.payload, target);
      },
      async retry(productId, id, value) {
        const target = endpoint(value); if (!target) throw new Error('endpoint_unavailable');
        const prepared = await mutate(productId, state => { const a = state.attempts.find(a => a.payload.requestId === id); if (!a) throw new Error('missing_request'); return clone(a); });
        if (prepared.value.state !== 'uncertain') return { kind: prepared.value.state, state: prepared.state };
        return transmit(productId, prepared.value.payload, target);
      },
      async clearDraft(productId) { return (await mutate(productId, state => { state.draft = emptyState().draft; })).state; },
      async clearProduct(productId) {
        requireProduct(productId);
        const result = await mutate(productId, state => { state.draft = emptyState().draft; state.attempts = []; });
        let localClearConfirmed = store.storage.mode === 'encrypted';
        if (!localClearConfirmed) { try { localClearConfirmed = await store.erase(productId); } catch {} }
        return { ...result.state, localClearConfirmed };
      }
    };
  }
  global.AppCenterFeedback = Object.freeze({ create, endpoint, schema: SCHEMA, ackSchema: ACK_SCHEMA });
})(window);
