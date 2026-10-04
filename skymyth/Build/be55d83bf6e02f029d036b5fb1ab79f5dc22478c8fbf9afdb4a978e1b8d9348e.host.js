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
  const chunkSize = 8 * 1024 * 1024;
  const rangeConcurrency = 6;
  const observation = window.skyMythStaticLoader = {
    schema: 'skymyth-static-resource-loader/v2', startedAt: performance.now(),
    resources: {}, blobUrlsReleased: false, state: 'loading',
    source: 'r104-cache1', networkBytes: 0,
    cache: {name: cacheName, state: 'opening', hits: [], writes: [], failures: [], recovered: []},
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
    errorNode.textContent = '游戏加载失败，请检查网络后重试。浏览器保存的进度不会被清除。';
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
  function validRange(response, start, end, total) {
    return response.status === 206 && !response.headers.get('content-encoding') &&
      response.headers.get('content-range') === 'bytes ' + start + '-' + end + '/' + total;
  }
  async function download(resource, key, resolved) {
    let received = 0;
    const onBytes = function (bytes) { received += bytes; report(key, received); };
    const ranged = resource.bytes >= 16 * 1024 * 1024;
    const localController = new AbortController();
    const abort = function () { localController.abort(); };
    controller.signal.addEventListener('abort', abort, {once: true});
    const options = {signal: localController.signal, credentials: 'same-origin'};
    try {
      const firstEnd = Math.min(resource.bytes, chunkSize) - 1;
      const first = await fetch(resolved, ranged ? {...options, headers: {Range: 'bytes=0-' + firstEnd}} : options);
      // A host which ignores Range returns its complete body. Use it once.
      if (!ranged || first.status === 200) {
        const blob = await readNetwork(first, key, localController.signal, onBytes);
        return {blob, status: first.status, headers: first.headers, transport: ranged ? 'single-response-range-ignored' : 'single-response'};
      }
      if (!validRange(first, 0, firstEnd, resource.bytes)) {
        await first.body?.cancel();
        throw new Error('Host returned an invalid first range');
      }
      const chunks = new Array(Math.ceil(resource.bytes / chunkSize));
      chunks[0] = await readNetwork(first, key, localController.signal, onBytes);
      if (chunks[0].size !== firstEnd + 1) throw new Error('First range length mismatch');
      let next = 1;
      async function worker() {
        while (next < chunks.length) {
          const index = next++;
          const start = index * chunkSize, end = Math.min(resource.bytes, start + chunkSize) - 1;
          const response = await fetch(resolved, {...options, headers: {Range: 'bytes=' + start + '-' + end}});
          if (!validRange(response, start, end, resource.bytes)) {
            await response.body?.cancel();
            throw new Error('Host returned an invalid range');
          }
          const chunk = await readNetwork(response, key, localController.signal, onBytes);
          if (chunk.size !== end - start + 1) throw new Error('Range length mismatch');
          chunks[index] = chunk;
        }
      }
      const jobs = Array.from({length: Math.min(rangeConcurrency, chunks.length - 1)}, worker);
      try { await Promise.all(jobs); }
      catch (error) {
        localController.abort();
        await Promise.allSettled(jobs);
        throw error;
      }
      const blob = new Blob(chunks, {type: 'application/gzip'});
      chunks.length = 0;
      if (blob.size !== resource.bytes) throw new Error('Assembled range length mismatch');
      return {blob, status: 200, headers: first.headers, transport: 'parallel-ranges', ranges: Math.ceil(resource.bytes / chunkSize), concurrency: rangeConcurrency};
    } catch (error) {
      if (!ranged || controller.signal.aborted) throw error;
      observation.rangeFallback = String(error).slice(0, 240);
      localController.abort();
      received = 0;
      report(key, 0);
      const response = await fetch(resolved, {signal: controller.signal, credentials: 'same-origin'});
      const blob = await readNetwork(response, key, controller.signal, onBytes);
      return {blob, status: response.status, headers: response.headers, transport: 'single-response-range-fallback'};
    } finally { controller.signal.removeEventListener('abort', abort); }
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
      if (cache) {
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
      fetchedBodyBytes: wire.transport === 'persistent-cache' ? 0 : wire.blob.size,
      cachedBodyBytes: wire.transport === 'persistent-cache' ? wire.blob.size : 0,
      decodedBytes: decoded.body.size, browserDecompressed: decoded.compressed,
      sha256VerifiedBeforeCaching: wire.transport !== 'persistent-cache',
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
        const keep = new Set(Object.values(resources).map(r => new URL(r.url, document.URL).href));
        for (const request of await cache.keys()) {
          if (request.url.startsWith(new URL('Build/', document.URL).href) && !keep.has(request.url)) await cache.delete(request);
        }
        observation.cache.state = 'complete';
      }
    }
  }
  start().catch(failed);
}());
