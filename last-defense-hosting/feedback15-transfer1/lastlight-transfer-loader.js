/* LastLight Feedback15 PCK Range loader candidate.
 * Keeps index.pck byte-identical, uses public Godot Engine APIs, and never
 * intercepts or monkey-patches fetch. Root must test server Range support and
 * the normal browser journey before adoption.
 */
(function (global) {
	'use strict';

	const SCHEMA = 'lastlight.godot.pck-range-manifest.v1';
	const CACHE_PREFIX = 'lastlight-pck-ranges-v1-';
	const observation = {
		schema: 'lastlight.pck-transfer-observation.v1',
		state: 'idle',
		transport: null,
		chunks: 0,
		cacheHits: 0,
		networkChunks: 0,
		retries: 0,
		loadedBytes: 0,
	};
	global.lastLightTransferObservation = observation;
	function publishObservation() {
		const progress = document.getElementById('canvas');
		if (progress) progress.dataset.lastlightTransfer = JSON.stringify(observation);
	}

	function fail(message) {
		throw new Error(message);
	}

	function hex(bytes) {
		return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
	}

	async function sha256(bytes) {
		return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
	}

	function validateManifest(manifest, manifestUrl) {
		if (!manifest || manifest.schema !== SCHEMA) fail('Unexpected transfer manifest schema');
		const source = manifest.source || {};
		if (!Number.isSafeInteger(source.bytes) || source.bytes <= 0 || !/^[A-F0-9]{64}$/.test(source.sha256 || '')) {
			fail('Invalid PCK identity in transfer manifest');
		}
		const sourceUrl = new URL(source.url, manifestUrl);
		if (sourceUrl.origin !== location.origin) fail('PCK must use the game origin');
		if (!Number.isSafeInteger(manifest.concurrency) || manifest.concurrency < 1 || manifest.concurrency > 6) {
			fail('Invalid transfer concurrency');
		}
		if (!Number.isSafeInteger(manifest.attempts_per_chunk) || manifest.attempts_per_chunk < 1 || manifest.attempts_per_chunk > 4) {
			fail('Invalid retry limit');
		}
		if (!Number.isSafeInteger(manifest.idle_timeout_ms) || manifest.idle_timeout_ms < 5000 || manifest.idle_timeout_ms > 120000) {
			fail('Invalid transfer timeout');
		}
		if (!Array.isArray(manifest.chunks) || manifest.chunks.length === 0) fail('Missing PCK ranges');
		let cursor = 0;
		for (let index = 0; index < manifest.chunks.length; index++) {
			const chunk = manifest.chunks[index];
			if (chunk.index !== index || chunk.start !== cursor || chunk.end !== chunk.start + chunk.bytes - 1 ||
				!Number.isSafeInteger(chunk.bytes) || chunk.bytes <= 0 || chunk.bytes > 8 * 1024 * 1024 ||
				!/^[A-F0-9]{64}$/.test(chunk.sha256 || '')) fail('Invalid PCK range manifest entry ' + index);
			cursor += chunk.bytes;
		}
		if (cursor !== source.bytes) fail('PCK range byte total mismatch');
		return sourceUrl;
	}

	async function fetchManifest(url) {
		const manifestUrl = new URL(url, document.baseURI);
		if (manifestUrl.origin !== location.origin) fail('Transfer manifest must use the game origin');
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 45000);
		let manifest;
		try {
			const response = await fetch(manifestUrl, {credentials: 'same-origin', cache: 'no-store', signal: controller.signal});
			if (!response.ok) fail('Transfer manifest HTTP ' + response.status);
			manifest = await response.json();
		} finally { clearTimeout(timer); }
		const sourceUrl = validateManifest(manifest, manifestUrl);
		return {manifest, sourceUrl};
	}

	async function waitBounded(promise, milliseconds, message) {
		let timer;
		try {
			return await Promise.race([promise, new Promise((resolve, reject) => {
				timer = setTimeout(() => reject(new Error(message)), milliseconds);
			})]);
		} finally { clearTimeout(timer); }
	}

	async function reuseWasm(manifest, config) {
		const spec = manifest.wasm_reuse;
		if (!spec || !global.caches || !navigator.serviceWorker) return;
		const currentUrl = new URL(spec.url, document.baseURI);
		const oldUrl = new URL(spec.legacy_url, location.origin);
		if (currentUrl.origin !== location.origin || oldUrl.origin !== location.origin ||
			!/^lastlight-transfer-sw-/.test(spec.resource_cache)) fail('Invalid engine resource cache identity');
		try {
			const cache = await caches.open(spec.resource_cache);
			let cached = await cache.match(currentUrl.href);
			let legacy = false;
			if (!cached) { cached = await caches.match(oldUrl.href); legacy = !!cached; }
			if (!cached || cached.status !== 200) return;
			const bytes = new Uint8Array(await cached.arrayBuffer());
			if (bytes.byteLength !== spec.bytes || await sha256(bytes) !== spec.sha256) return;
			if (legacy) await cache.put(currentUrl.href, new Response(bytes, {headers: {'Content-Type':'application/wasm'}}));
			const registration = await waitBounded(navigator.serviceWorker.register(config.serviceWorker), 45000, 'Resource cache registration timed out');
			// An unchanged registration call may retain the earlier cache-first worker.
			// Explicitly discover current bytes; an offline, already-active worker stays usable.
			try { await waitBounded(registration.update(), 45000, 'Resource cache update timed out'); }
			catch (error) { observation.workerUpdateUnavailable = String(error).slice(0,240); }
			let active = registration.active;
			const installing = registration.installing || registration.waiting;
			if (installing) {
				await waitBounded(new Promise((resolve, reject) => {
					const check = () => {
						if (installing.state === 'installed') installing.postMessage('claim');
						if (installing.state === 'activated') { installing.removeEventListener('statechange', check); resolve(); }
						if (installing.state === 'redundant') { installing.removeEventListener('statechange', check); reject(new Error('Resource cache installation failed')); }
					};
					installing.addEventListener('statechange', check); check();
				}), 45000, 'Resource cache installation timed out');
				active = registration.active;
			}
			if (!active) return;
			const controlled = new Promise((resolve) => {
				const check = () => {
					if (navigator.serviceWorker.controller === active) {
						navigator.serviceWorker.removeEventListener('controllerchange', check);
						resolve();
					}
				};
				navigator.serviceWorker.addEventListener('controllerchange', check);
				check();
			});
			active.postMessage('claim');
			await waitBounded(controlled, 15000, 'Resource cache control timed out');
			observation.wasmCacheVerified = true;
			observation.legacyWasmReused = legacy;
			publishObservation();
		} catch (error) {
			observation.wasmCacheUnavailable = String(error).slice(0,240);
			publishObservation();
		}
	}

	async function cacheVerifiedPck(manifest, pck) {
		if (!global.caches) return;
		try {
			const cache = await caches.open(CACHE_PREFIX + manifest.source.sha256);
			for (const chunk of manifest.chunks) {
				const body = pck.subarray(chunk.start, chunk.end + 1);
				if (body.byteLength !== chunk.bytes || await sha256(body) !== chunk.sha256) fail('Rebuilt PCK chunk identity mismatch');
				await cache.put(cacheKey(manifest.source, chunk), new Response(body, {headers:{'Content-Type':'application/octet-stream'}}));
			}
			observation.rebuiltChunksCached = manifest.chunks.length;
		} catch (error) { observation.cacheError = String(error).slice(0,240); }
		publishObservation();
	}

	async function hasCompleteRangeCache(manifest) {
		if (!global.caches) return false;
		try {
			const cache = await caches.open(CACHE_PREFIX + manifest.source.sha256);
			for (const chunk of manifest.chunks) {
				if (!await cache.match(cacheKey(manifest.source,chunk))) return false;
			}
			return true;
		} catch { return false; }
	}

	async function reuseWholePck(manifest, sourceUrl) {
		if (!global.caches) return null;
		try {
			const response = await caches.match(sourceUrl.href);
			if (!response || response.status !== 200) return null;
			const blob = await response.blob();
			if (blob.size !== manifest.source.bytes) return null;
			const body = new Uint8Array(await blob.arrayBuffer());
			if (await sha256(body) !== manifest.source.sha256) return null;
			return body;
		} catch { return null; }
	}

	function rangedUrl(sourceUrl, sourceSha) {
		const url = new URL(sourceUrl);
		url.searchParams.set('ll-range-sha256', sourceSha);
		return url;
	}

	async function probeRange(sourceUrl, source) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 30000);
		let response;
		try {
			response = await fetch(rangedUrl(sourceUrl, source.sha256), {
				headers: {Range: 'bytes=0-0'},
				credentials: 'same-origin',
				cache: 'no-store',
				signal: controller.signal,
			});
			if (response.status === 200) {
				await response.body?.cancel();
				return {supported: false, reason: 'server-returned-200'};
			}
			if (response.status !== 206) fail('Range probe HTTP ' + response.status);
			const contentRange = response.headers.get('content-range') || '';
			if (contentRange !== `bytes 0-0/${source.bytes}`) fail('Range probe Content-Range mismatch');
			const encoding = (response.headers.get('content-encoding') || 'identity').toLowerCase();
			if (encoding !== 'identity') fail('Range probe returned encoded bytes');
			const body = new Uint8Array(await response.arrayBuffer());
			if (body.byteLength !== 1) fail('Range probe body length mismatch');
			return {supported: true, etag: response.headers.get('etag') || ''};
		} finally {
			clearTimeout(timer);
		}
	}

	async function readExact(response, expectedBytes, idleTimeoutMs, onBytes) {
		if (!response.body) fail('Range response has no body');
		const body = new Uint8Array(expectedBytes);
		const reader = response.body.getReader();
		let offset = 0;
		let timer = null;
		let timedOut = false;
		const touch = () => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				timedOut = true;
				reader.cancel('idle timeout').catch(() => {});
			}, idleTimeoutMs);
		};
		touch();
		try {
			for (;;) {
				const part = await reader.read();
				if (part.done) break;
				if (offset + part.value.byteLength > body.byteLength) fail('Range body exceeds declared length');
				body.set(part.value, offset);
				offset += part.value.byteLength;
				onBytes(part.value.byteLength);
				touch();
			}
		} finally {
			clearTimeout(timer);
		}
		if (timedOut) fail('Range request idle timeout');
		if (offset !== expectedBytes) fail('Range body length mismatch');
		return body;
	}

	function cacheKey(source, chunk) {
		return new URL(`./.lastlight-transfer-cache/${source.sha256}/${chunk.index}-${chunk.start}-${chunk.end}`, document.baseURI).href;
	}

	async function cachedChunk(cache, source, chunk) {
		if (!cache) return null;
		try {
			const response = await cache.match(cacheKey(source, chunk));
			if (!response) return null;
			const body = new Uint8Array(await response.arrayBuffer());
			if (body.byteLength !== chunk.bytes || await sha256(body) !== chunk.sha256) {
				await cache.delete(cacheKey(source, chunk));
				return null;
			}
			return body;
		} catch (error) {
			observation.cacheError = String(error).slice(0, 240);
			return null;
		}
	}

	async function downloadChunk(cache, sourceUrl, source, chunk, manifest, getProbe, onBytes) {
		const saved = await cachedChunk(cache, source, chunk);
		if (saved) {
			observation.cacheHits++;
			onBytes(saved.byteLength, true);
			return saved;
		}
		const probe = await getProbe();
		if (!probe.supported) fail('The current server cannot resume this download. Please reconnect and try again.');
		for (let attempt = 1; attempt <= manifest.attempts_per_chunk; attempt++) {
			const controller = new AbortController();
			const headerTimer = setTimeout(() => controller.abort(), manifest.idle_timeout_ms);
			try {
				const headers = {Range: `bytes=${chunk.start}-${chunk.end}`};
				if (/^"[^\r\n]+"$/.test(probe.etag)) headers['If-Range'] = probe.etag;
				const response = await fetch(rangedUrl(sourceUrl, source.sha256), {
					headers,
					credentials: 'same-origin',
					cache: 'no-store',
					signal: controller.signal,
				});
				clearTimeout(headerTimer);
				if (response.status !== 206) {
					await response.body?.cancel();
					fail('PCK range HTTP ' + response.status);
				}
				const expectedRange = `bytes ${chunk.start}-${chunk.end}/${source.bytes}`;
				if ((response.headers.get('content-range') || '') !== expectedRange) fail('PCK Content-Range mismatch');
				const encoding = (response.headers.get('content-encoding') || 'identity').toLowerCase();
				if (encoding !== 'identity') fail('PCK range returned encoded bytes');
				if (probe.etag && response.headers.get('etag') && response.headers.get('etag') !== probe.etag) fail('PCK ETag changed');
				const body = await readExact(response, chunk.bytes, manifest.idle_timeout_ms, () => {});
				if (await sha256(body) !== chunk.sha256) fail('PCK range SHA256 mismatch');
				if (cache) {
					try {
						await cache.put(cacheKey(source, chunk), new Response(body, {headers: {
							'Content-Type': 'application/octet-stream',
							'Content-Length': String(body.byteLength),
							'X-LastLight-Chunk-SHA256': chunk.sha256,
						}}));
					} catch (error) {
						observation.cacheError = String(error).slice(0, 240);
					}
				}
				observation.networkChunks++;
				onBytes(body.byteLength, false);
				return body;
			} catch (error) {
				clearTimeout(headerTimer);
				controller.abort();
				if (attempt === manifest.attempts_per_chunk) throw error;
				observation.retries++;
			}
		}
		fail('PCK range retry loop ended unexpectedly');
	}

	async function loadPck(manifest, sourceUrl, onProgress) {
		const source = manifest.source;
		const cacheName = CACHE_PREFIX + source.sha256;
		let cache = null;
		try {
			if (global.isSecureContext && global.caches) cache = await caches.open(cacheName);
		} catch (error) {
			observation.cacheError = String(error).slice(0, 240);
		}
		let probePromise = null;
		const getProbe = () => {
			if (!probePromise) probePromise = probeRange(sourceUrl, source);
			return probePromise;
		};
		const assembled = new Uint8Array(source.bytes);
		let next = 0;
		let completed = 0;
		let stopped = false;
		const report = (count, cached) => {
			completed += count;
			observation.loadedBytes = completed;
			publishObservation();
			onProgress?.({phase: cached ? 'cache' : 'pck', current: completed, total: source.bytes});
		};
		async function worker() {
			while (!stopped && next < manifest.chunks.length) {
				const index = next++;
				try {
					const part = await downloadChunk(cache, sourceUrl, source, manifest.chunks[index], manifest, getProbe, report);
					assembled.set(part, manifest.chunks[index].start);
				} catch (error) {
					stopped = true;
					throw error;
				}
			}
		}
		await Promise.all(Array.from({length: Math.min(manifest.concurrency, manifest.chunks.length)}, worker));
		if (await sha256(assembled) !== source.sha256) fail('Assembled PCK SHA256 mismatch');
		observation.fullSha256Verified = true;
		observation.chunks = manifest.chunks.length;
		publishObservation();
		return assembled;
	}

	async function start(options) {
		const engine = options.engine;
		const config = options.config;
		const onProgress = options.onProgress;
		observation.state = 'loading';
		publishObservation();
		const loaded = await fetchManifest(options.manifestUrl || 'index.transfer.json');
		await reuseWasm(loaded.manifest, config);
		let rebuilt = null;
		const cacheComplete = await hasCompleteRangeCache(loaded.manifest);
		if (!cacheComplete) rebuilt = await reuseWholePck(loaded.manifest,loaded.sourceUrl);
		if (!cacheComplete && !rebuilt && global.LastLightPckDelta) {
			try { rebuilt = await global.LastLightPckDelta.tryBuild({onProgress, manifestUrl:'index.pck.delta15.json'}); }
			catch (error) { observation.deltaUnavailable = String(error).slice(0,240); }
		}
		if (rebuilt) {
			if (rebuilt.byteLength !== loaded.manifest.source.bytes || await sha256(rebuilt) !== loaded.manifest.source.sha256) fail('Cached update target differs from the current game');
			await cacheVerifiedPck(loaded.manifest, rebuilt);
			observation.transport = 'verified-cached-pck-delta';
			observation.fullSha256Verified = true;
			observation.chunks = loaded.manifest.chunks.length;
		} else observation.transport = cacheComplete ? 'verified-range-cache' : 'same-origin-http-range';
		observation.state = 'loading';
		const results = await Promise.all([
			engine.init(config.executable),
			rebuilt || loadPck(loaded.manifest, loaded.sourceUrl, onProgress),
		]);
		const pck = results[1];
		// Godot 4.7.1 indexes fileSizes[file] before inspecting its binary type.
		// A large Uint8Array is coerced into a huge comma-separated property key.
		// ArrayBuffer uses the supported binary overload without that conversion.
		const packBuffer = pck.byteOffset === 0 && pck.byteLength === pck.buffer.byteLength
			? pck.buffer : pck.buffer.slice(pck.byteOffset, pck.byteOffset + pck.byteLength);
		await engine.preloadFile(packBuffer, loaded.manifest.source.url);
		observation.state = 'starting';
		publishObservation();
		await engine.start({
			args: ['--main-pack', loaded.manifest.source.url].concat(config.args || []),
			onProgress: (current, total) => onProgress?.({phase: 'godot', current, total}),
		});
		observation.state = 'started';
		publishObservation();
	}

	global.LastLightTransfer = Object.freeze({start});
}(window));
