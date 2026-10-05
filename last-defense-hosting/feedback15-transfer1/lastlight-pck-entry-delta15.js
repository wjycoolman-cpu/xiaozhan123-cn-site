/* LastLight Feedback15 cached-PCK delta candidate.
 *
 * Reads the exact Ready14 PCK from origin Cache Storage without modifying it,
 * applies a small same-origin patch, verifies every segment and the complete
 * Feedback15 SHA-256, then starts Godot through public Engine APIs.
 * Root must run the real browser journey before adoption.
 */
(function (global) {
	'use strict';

	const SCHEMA = 'lastlight.feedback15.pck-entry-delta.v1';
	const observation = {
		schema: 'lastlight.feedback15.pck-entry-delta-observation.v1',
		state: 'idle',
		oldCacheFound: false,
		copiedBytes: 0,
		patchedBytes: 0,
	};
	global.lastLightPckDeltaObservation = observation;
	function publishObservation() {
		const progress = document.getElementById('canvas');
		if (progress) progress.dataset.lastlightDelta = JSON.stringify(observation);
	}
	async function boundedRead(url, consume) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 45000);
		try {
			const response = await fetch(url, {credentials: 'same-origin', cache: 'no-store', signal: controller.signal});
			if (!response.ok) fail('PCK delta HTTP ' + response.status);
			return await consume(response);
		} finally {
			clearTimeout(timer);
		}
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

	function isSha(value) {
		return /^[A-F0-9]{64}$/.test(value || '');
	}

	function validateManifest(manifest, manifestUrl) {
		if (!manifest || manifest.schema !== SCHEMA || manifest.status !== 'passed') fail('Unexpected PCK delta manifest');
		for (const name of ['source', 'target']) {
			const item = manifest[name] || {};
			if (!Number.isSafeInteger(item.bytes) || item.bytes <= 0 || !isSha(item.sha256)) fail('Invalid ' + name + ' identity');
		}
		const sourceUrl = new URL(manifest.source.logical_url, location.origin);
		if (sourceUrl.origin !== location.origin) fail('Old PCK cache URL must use this origin');
		const patch = manifest.patch || {};
		if (!Number.isSafeInteger(patch.bytes) || patch.bytes <= 0 || !isSha(patch.sha256)) fail('Invalid patch identity');
		const patchUrl = new URL(patch.logical_path, manifestUrl);
		if (patchUrl.origin !== location.origin) fail('PCK patch must use this origin');
		if (!Array.isArray(manifest.segments) || manifest.segments.length === 0) fail('Missing PCK delta segments');
		let destination = 0;
		let patchCovered = 0;
		for (const [index, segment] of manifest.segments.entries()) {
			if (!segment || !['copy', 'patch'].includes(segment.kind) || segment.destination_start !== destination ||
				!Number.isSafeInteger(segment.bytes) || segment.bytes <= 0 || !isSha(segment.sha256)) {
				fail('Invalid PCK delta segment ' + index);
			}
			if (segment.kind === 'copy') {
				if (!Number.isSafeInteger(segment.source_start) || segment.source_start < 0 ||
					segment.source_start + segment.bytes > manifest.source.bytes) fail('Copy span outside old PCK');
			} else {
				if (!Number.isSafeInteger(segment.payload_offset) || segment.payload_offset !== patchCovered ||
					segment.payload_offset + segment.bytes > patch.bytes) fail('Patch span outside payload');
				patchCovered += segment.bytes;
			}
			destination += segment.bytes;
		}
		if (destination !== manifest.target.bytes || patchCovered !== patch.bytes) fail('PCK delta coverage mismatch');
		return {sourceUrl, patchUrl};
	}

	async function fetchManifest(url) {
		const manifestUrl = new URL(url, document.baseURI);
		if (manifestUrl.origin !== location.origin) fail('PCK delta manifest must use this origin');
		const manifest = await boundedRead(manifestUrl, response => response.json());
		return {manifest, ...validateManifest(manifest, manifestUrl)};
	}

	async function findOldPck(sourceUrl, expectedBytes) {
		if (!global.isSecureContext || !global.caches) return null;
		const response = await caches.match(sourceUrl.href);
		if (!response || response.status !== 200) return null;
		const blob = await response.blob();
		if (blob.size !== expectedBytes) return null;
		observation.oldCacheFound = true;
		return blob;
	}

	async function fetchPatch(patchUrl, expected) {
		const body = new Uint8Array(await boundedRead(patchUrl, response => response.arrayBuffer()));
		if (body.byteLength !== expected.bytes || await sha256(body) !== expected.sha256) fail('PCK delta payload identity mismatch');
		return body;
	}

	async function reconstruct(manifest, oldBlob, patchBytes, onProgress) {
		const target = new Uint8Array(manifest.target.bytes);
		let completed = 0;
		for (const segment of manifest.segments) {
			let bytes;
			if (segment.kind === 'copy') {
				bytes = new Uint8Array(await oldBlob.slice(segment.source_start, segment.source_start + segment.bytes).arrayBuffer());
				observation.copiedBytes += bytes.byteLength;
			} else {
				bytes = patchBytes.subarray(segment.payload_offset, segment.payload_offset + segment.bytes);
				observation.patchedBytes += bytes.byteLength;
			}
			if (bytes.byteLength !== segment.bytes || await sha256(bytes) !== segment.sha256) fail('PCK delta segment identity mismatch');
			target.set(bytes, segment.destination_start);
			completed += bytes.byteLength;
			publishObservation();
			onProgress?.({phase: segment.kind === 'copy' ? 'old-cache' : 'patch', current: completed, total: manifest.target.bytes});
		}
		if (await sha256(target) !== manifest.target.sha256) fail('Reconstructed PCK SHA256 mismatch');
		observation.fullSha256Verified = true;
		publishObservation();
		return target;
	}

	async function tryBuild(options) {
		observation.state = 'manifest';
		publishObservation();
		const loaded = await fetchManifest(options.manifestUrl || 'index.pck.delta15.json');
		observation.state = 'old-cache';
		const oldBlob = await findOldPck(loaded.sourceUrl, loaded.manifest.source.bytes);
		if (!oldBlob) {
			observation.state = 'unavailable';
			publishObservation();
			return null;
		}
		observation.state = 'reconstructing';
		publishObservation();
		const patch = await fetchPatch(loaded.patchUrl, loaded.manifest.patch);
		const pck = await reconstruct(loaded.manifest, oldBlob, patch, options.onProgress);
		observation.state = 'verified';
		publishObservation();
		return pck;
	}

	global.LastLightPckDelta = Object.freeze({tryBuild});
}(window));
