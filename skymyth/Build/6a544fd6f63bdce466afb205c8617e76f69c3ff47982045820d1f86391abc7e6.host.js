/* SkyMyth static host: persistent compressed resources and bounded range loading. */
'use strict';
var canvas = document.getElementById('unity-canvas');
var config = window.skyMythConfig;
var unityInstance = null;
(function () {
  const resources = window.skyMythCompressedResources;
  const loading = document.getElementById('loading');
  const label = document.getElementById('loading-label');
  const progress = document.getElementById('progress');
  const errorNode = document.getElementById('error');
  const retry = document.getElementById('retry');
  const controller = new AbortController();
  const urls = new Set();
  const counters = {};
  const expectedTotal = Object.values(resources).reduce((n, r) => n + r.bytes, 0);
  const cacheName = 'skymyth-compressed-resources-v1';
  const observation = window.skyMythStaticLoader = {
    schema: 'skymyth-static-resource-loader/v3', startedAt: performance.now(),
    resources: {}, blobUrlsReleased: false, state: 'loading',
    source: 'r111-resumable-chunks', networkBytes: 0, retries: [],
    cache: {name: cacheName, state: 'opening', hits: [], writes: [], failures: [], recovered: [], savedBytes: 0},
  };
  function release() {
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
    observation.blobUrlsReleased = true;
  }
  function warning(message) {
    const node = document.getElementById('storage-warning');
    node.textContent = message;
    node.style.display = 'block';
  }
  function cacheFailure(key, error) {
    observation.cache.failures.push({key, error: String(error).slice(0, 240)});
    observation.cache.state = 'unavailable';
    const node = document.getElementById('storage-warning');
    if (!node.textContent) warning('浏览器暂时无法缓存游戏资源，下次进入可能需要重新下载。');
  }
  const cacheReady = (async function () {
    try {
      if (!window.isSecureContext || !window.caches) throw new Error('Resource cache requires supported secure storage');
      const cache = await caches.open(cacheName);
      observation.cache.state = 'ready';
      return cache;
    } catch (error) { cacheFailure('open', error); return null; }
  }());
  function failed(error) {
    observation.state = 'failed';
    observation.error = String(error);
    controller.abort();
    release();
    errorNode.textContent = '下载暂时中断，请检查网络后重试。已保存的下载和游戏进度会保留。';
    label.textContent = '未能进入游戏';
    retry.hidden = false;
    document.getElementById('loading-return').hidden = false;
    console.error(error);
  }
  function report(key, amount) {
    counters[key] = Math.min(resources[key].bytes, amount);
    const loaded = Object.values(counters).reduce((n, v) => n + v, 0);
    progress.value = 0.75 * loaded / expectedTotal;
    const percent = Math.min(100, Math.floor(loaded * 100 / expectedTotal));
    label.textContent = observation.networkBytes ? '正在下载游戏… ' + percent + '%' : '正在从本地载入游戏… ' + percent + '%';
  }
  async function readNetwork(response, key, signal, completedBytes) {
    if (!response.ok || !response.body) throw new Error('Resource request failed: ' + key + ' HTTP ' + response.status);
    const reader = response.body.getReader();
    const parts = [];
    let received = 0;
    try {
      for (;;) {
        if (signal.aborted) throw new DOMException('Resource transfer cancelled', 'AbortError');
        const part = await reader.read();
        if (part.done) break;
        parts.push(part.value);
        received += part.value.byteLength;
        observation.networkBytes += part.value.byteLength;
        completedBytes(part.value.byteLength);
      }
      return new Blob(parts, {type: response.headers.get('content-type') || 'application/octet-stream'});
    } catch (error) { await reader.cancel().catch(function () {}); throw error; }
  }
  async function digest(blob) {
    const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  async function download(resource, key, resolved) {
    const chunks = resource.chunks;
    if (!Array.isArray(chunks) || !chunks.length) {
      let received = 0;
      const response = await fetch(resolved, {signal: controller.signal, credentials: 'same-origin'});
      const blob = await readNetwork(response, key, controller.signal, bytes => {
        received += bytes; report(key, received);
      });
      return {blob, status: response.status, headers: response.headers, transport: 'single-response'};
    }
    if (chunks.reduce((n, c) => n + c.bytes, 0) !== resource.bytes) throw new Error('Invalid resource chunk manifest');
    const cache = await cacheReady;
    const parts = new Array(chunks.length);
    const inflight = new Map();
    const metrics = {parts: chunks.length, cacheHits: 0, cacheBytes: 0, retries: [], writes: 0, cacheFailures: 0};
    let completed = 0, next = 0;
    const update = () => report(key, completed + Array.from(inflight.values()).reduce((n, v) => n + v, 0));
    async function part(index) {
      const chunk = chunks[index], url = new URL(chunk.url, document.URL);
      if (url.origin !== location.origin || !Number.isSafeInteger(chunk.bytes) || chunk.bytes <= 0 ||
          chunk.bytes > 2 * 1024 * 1024 || !/^[A-F0-9]{64}$/.test(chunk.sha256)) throw new Error('Invalid resource chunk');
      if (cache) {
        try {
          const saved = await cache.match(url.href);
          if (saved) {
            const blob = await saved.blob();
            if (blob.size !== chunk.bytes || await digest(blob) !== chunk.sha256) throw new Error('Saved part integrity mismatch');
            parts[index] = blob; completed += blob.size;
            metrics.cacheHits++; metrics.cacheBytes += blob.size;
            observation.cache.savedBytes += blob.size;
            update(); return;
          }
        } catch (error) {
          observation.cache.recovered.push({key, part: index, error: String(error).slice(0, 240)});
          await cache.delete(url.href).catch(() => {});
        }
      }
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (controller.signal.aborted) throw new DOMException('Resource transfer cancelled', 'AbortError');
        const local = new AbortController();
        const abort = () => local.abort();
        controller.signal.addEventListener('abort', abort, {once: true});
        let timeout;
        const touch = () => {clearTimeout(timeout); timeout = setTimeout(() => local.abort(), 45000);};
        inflight.set(index, 0); touch();
        try {
          const response = await fetch(url, {signal: local.signal, credentials: 'same-origin'});
          if (response.status !== 200) {await response.body?.cancel(); throw new Error('Part request HTTP ' + response.status);}
          const blob = await readNetwork(response, key, local.signal, bytes => {
            touch(); inflight.set(index, inflight.get(index) + bytes); update();
          });
          if (blob.size !== chunk.bytes || await digest(blob) !== chunk.sha256) throw new Error('Downloaded part integrity mismatch');
          clearTimeout(timeout);
          parts[index] = blob; completed += blob.size; inflight.delete(index);
          if (cache) {
            try {
              await cache.put(url.href, new Response(blob, {status: 200, headers: {
                'Content-Type': 'application/octet-stream', 'Content-Length': String(blob.size),
                'X-SkyMyth-Resource-SHA256': chunk.sha256,
              }}));
              metrics.writes++; observation.cache.savedBytes += blob.size;
            } catch (error) {metrics.cacheFailures++; cacheFailure(key + '-part-' + index, error);}
          }
          update(); return;
        } catch (error) {
          local.abort(); inflight.delete(index); update();
          if (controller.signal.aborted || attempt === 3) throw error;
          metrics.retries.push({part: index, attempt, error: String(error).slice(0, 240)});
          observation.retries.push({key, part: index, attempt});
          label.textContent = '连接中断，正在继续下载… ' + Math.floor(Object.values(counters).reduce((n,v)=>n+v,0)*100/expectedTotal) + '%';
        } finally {clearTimeout(timeout); controller.signal.removeEventListener('abort', abort);}
      }
    }
    async function worker() {
      while (next < chunks.length) {const index = next++; await part(index);}
    }
    const jobs = Array.from({length: Math.min(3, chunks.length)}, worker);
    try {await Promise.all(jobs);}
    catch (error) {controller.abort(); await Promise.allSettled(jobs); throw error;}
    const blob = new Blob(parts, {type: 'application/gzip'});
    parts.length = 0;
    if (blob.size !== resource.bytes) throw new Error('Assembled resource length mismatch');
    const cached = metrics.cacheHits === chunks.length;
    if (cached) observation.cache.hits.push(key);
    else if (cache && metrics.cacheHits + metrics.writes === chunks.length) observation.cache.writes.push(key);
    return {blob, status: 200, headers: new Headers(), transport: cached ? 'persistent-chunks' : 'resumable-chunks', chunked: true,
      ranges: 0, concurrency: 3, chunkMetrics: metrics, networkBodyBytes: resource.bytes - metrics.cacheBytes};
  }
  async function validateAndDecode(blob, key, verifyDigest) {
    const resource = resources[key];
    const prefix = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    const compressed = prefix[0] === 31 && prefix[1] === 139;
    if (blob.size !== (compressed ? resource.bytes : resource.rawBytes)) throw new Error('Resource length mismatch: ' + key);
    if (verifyDigest) {
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
      const sha = Array.from(digest, x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
      if (sha !== (compressed ? resource.sha256 : resource.rawSha256)) throw new Error('Resource SHA256 mismatch: ' + key);
    }
    if (compressed && typeof DecompressionStream !== 'function') throw new Error('This browser does not support gzip DecompressionStream');
    const input = blob.stream();
    const decoded = compressed ? input.pipeThrough(new DecompressionStream('gzip')) : input;
    const body = await new Response(decoded, {headers: {'Content-Type': resource.mime}}).blob();
    if (body.size !== resource.rawBytes) throw new Error('Decoded resource length mismatch: ' + key);
    const signature = new Uint8Array(await body.slice(0, 16).arrayBuffer());
    if (key === 'dataUrl' && new TextDecoder().decode(signature) !== 'UnityWebData1.0\0') throw new Error('Unity data signature mismatch');
    if (key === 'codeUrl' && !(signature[0] === 0 && signature[1] === 97 && signature[2] === 115 && signature[3] === 109)) throw new Error('WebAssembly signature mismatch');
    return {body, compressed};
  }
  async function resourceBlob(key) {
    const resource = resources[key];
    const resolved = new URL(resource.url, document.URL);
    if (resolved.origin !== location.origin) throw new Error('Resource must share game origin');
    const cache = await cacheReady;
    let cached = null, wire = null, decoded = null;
    if (cache) {
      try {
        cached = await cache.match(resolved.href);
        if (cached) {
          if (cached.headers.get('x-skymyth-resource-sha256') !== resource.sha256) throw new Error('Cached resource version mismatch');
          wire = {blob: await cached.blob(), status: 200, headers: cached.headers, transport: 'persistent-cache'};
          // Gzip CRC, decoded length and Unity/Wasm signatures are checked on
          // every load; the exact SHA was checked before this body was saved.
          decoded = await validateAndDecode(wire.blob, key, false);
          observation.cache.hits.push(key);
          report(key, resource.bytes);
        }
      } catch (error) {
        observation.cache.recovered.push({key, error: String(error).slice(0, 240)});
        await cache.delete(resolved.href).catch(function () {});
        wire = null; decoded = null;
      }
    }
    if (!decoded) {
      wire = await download(resource, key, resolved);
      decoded = await validateAndDecode(wire.blob, key, true);
      if (cache && !wire.chunked) {
        try {
          await cache.put(resolved.href, new Response(wire.blob, {status: 200, headers: {
            'Content-Type': decoded.compressed ? 'application/gzip' : resource.mime,
            'Content-Length': String(wire.blob.size), 'X-SkyMyth-Resource-SHA256': resource.sha256,
          }}));
          observation.cache.writes.push(key);
        } catch (error) { cacheFailure(key, error); }
      }
    }
    if (controller.signal.aborted) throw new Error('Resource load cancelled');
    const url = URL.createObjectURL(decoded.body);
    urls.add(url);
    report(key, resource.bytes);
    observation.resources[key] = {
      url: resolved.href, status: wire.status, transport: wire.transport,
      ranges: wire.ranges || 0, concurrency: wire.concurrency || 1,
      fetchedBodyBytes: wire.chunked ? wire.networkBodyBytes : (wire.transport === 'persistent-cache' ? 0 : wire.blob.size),
      cachedBodyBytes: wire.chunked ? wire.chunkMetrics.cacheBytes : (wire.transport === 'persistent-cache' ? wire.blob.size : 0),
      decodedBytes: decoded.body.size, browserDecompressed: decoded.compressed,
      sha256VerifiedBeforeCaching: wire.transport !== 'persistent-cache',
      chunkMetrics: wire.chunkMetrics || null,
      resourceSignatureVerified: key === 'dataUrl' || key === 'codeUrl',
    };
    return [key, url];
  }
  config.showBanner = function (message, type) { if (type === 'error') failed(new Error(message)); else warning(message); };
  config.autoSyncPersistentDataPath = true;
  config.preRun = [function (module) { module.streamingAssetsUrl = '/sky-streaming'; }];
  config.skyMythStorageWarning = warning;
  config.skyMythExitToPage = function (generation) {
    const current = unityInstance;
    if (!current || current.Module.skyMythExitGeneration !== generation) return;
    current.Quit().then(function () {
      unityInstance = null; window.skyMythUnityInstance = null;
      document.getElementById('game').style.display = 'none';
      document.getElementById('menu').style.display = 'block';
      document.getElementById('start').focus();
      observation.state = 'returned_to_page';
    }).catch(function (error) { current.Module.skyMythExitPending = false; warning('未能返回网页，请稍后再试。'); console.error(error); });
  };
  document.getElementById('start').onclick = function () { location.reload(); };
  retry.onclick = function () { location.reload(); };
  window.addEventListener('pagehide', function () { controller.abort(); release(); }, {once: true});
  async function start() {
    const loader = document.createElement('script');
    loader.src = window.skyMythUnityLoader;
    const loaderReady = new Promise(function (resolve, reject) {
      loader.onload = resolve; loader.onerror = function () { reject(new Error('Unity loader could not be loaded')); };
    });
    document.body.appendChild(loader);
    const [, decoded] = await Promise.all([loaderReady, Promise.all(Object.keys(resources).map(resourceBlob))]);
    for (const [key, url] of decoded) config[key] = url;
    observation.decodedAt = performance.now();
    label.textContent = '正在启动游戏…';
    const instance = await createUnityInstance(canvas, config, function (value) {
      progress.value = 0.75 + 0.25 * value; label.textContent = '正在启动游戏… ' + Math.round(value * 100) + '%';
    });
    unityInstance = instance; window.skyMythUnityInstance = instance;
    window.skyMythStartedAt = performance.now();
    observation.state = 'started'; observation.startedAtFinished = performance.now();
    release(); loading.style.display = 'none'; canvas.focus();
    if (observation.cache.hits.length + observation.cache.writes.length === Object.keys(resources).length) {
      const cache = await cacheReady;
      if (cache) {
        const keep = new Set(Object.values(resources).flatMap(r => [r.url, ...(r.chunks || []).map(c => c.url)]).map(url => new URL(url, document.URL).href));
        for (const request of await cache.keys()) {
          if (request.url.startsWith(new URL('Build/', document.URL).href) && !keep.has(request.url)) await cache.delete(request);
        }
        observation.cache.state = 'complete';
      }
    }
  }
  start().catch(failed);
}());
