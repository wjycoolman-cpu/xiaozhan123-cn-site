/* Desktop loading adapter for the unchanged formal sampler / Java / TSF engine.
 * No sample conversion, alternate oscillator, or MIDI-owner substitution.
 * Project GPL-3.0; inherited engine/assets retain their existing notices. */
import {PianoAudio} from '../demo/audio.js';

export const AUDIO_ASSET_BASE = new URL('../demo/', import.meta.url).href;
export const DESKTOP_AUDIO_WORKLET = new URL('./desktop-audio-worklet.js', import.meta.url).href;
const PIANO_PRESETS = new Set([0, 4, 5, 12, 13, 14]);
const windowIndexes = new WeakMap();
const validPitches = pitches => [...new Set((pitches || []).filter(p => Number.isInteger(p) && p >= 0 && p <= 127))];

/** Exact source events overlapping [position, position + lookahead * speed]. */
export function pitchesForWindow(song, positionMs = 0, {lookaheadMs = 1400, speed = 1} = {}) {
  const notes = Array.isArray(song) ? song : song?.notes;
  if (!Array.isArray(notes) || !notes.length) return [];
  const position = Math.max(0, Number(positionMs) || 0);
  const horizon = position + Math.max(0, Number(lookaheadMs) || 0) * Math.max(.1, Number(speed) || 1);
  let index = windowIndexes.get(notes);
  if (!index || index.length !== notes.length) {
    let end = 0;
    index = notes.map(n => end = Math.max(end, n.start + n.duration));
    windowIndexes.set(notes, index);
  }
  let low = 0, high = notes.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (index[mid] <= position) low = mid + 1;
    else high = mid;
  }
  const pitches = [];
  for (let i = low; i < notes.length && notes[i].start <= horizon; i++) {
    const note = notes[i];
    if (note.start + note.duration > position) pitches.push(note.pitch);
  }
  return validPitches(pitches);
}

export class DesktopPianoAudio extends PianoAudio {
  constructor(onStatus = () => {}, {fetchTimeoutMs = 60000, warmConcurrency = 2} = {}) {
    super(onStatus);
    this.fetchTimeoutMs = Math.max(15000, Math.min(120000, Number(fetchTimeoutMs) || 60000));
    this.warmConcurrency = Math.max(1, Math.min(4, Math.round(warmConcurrency) || 2));
    this.samplePreparations = new Map();
    this.background = new Map();
    this.warmQueue = [];
    this.warmRunning = 0;
    this.warmError = '';
    this.coreReady = false;
  }

  assetURL(relative) {
    // The small desktop mixer adds phone41 reed presets 170..175. Its original
    // 0..169 Java, GM and PCM resources remain in the unchanged shared engine.
    if (relative === 'native-audio-worklet.js') return DESKTOP_AUDIO_WORKLET;
    return new URL(relative, AUDIO_ASSET_BASE).href;
  }

  // Resolve assets against the engine directory, independent of document.baseURI.
  getBytes(relative) {
    const url = this.assetURL(relative);
    if (!this.bytes.has(url)) {
      const pending = (async () => {
        const response = await fetch(url, {signal: AbortSignal.timeout(this.fetchTimeoutMs)});
        if (!response.ok) throw Error('音色资源加载失败：' + response.status);
        return response.arrayBuffer();
      })();
      this.bytes.set(url, pending);
      pending.catch(() => { if (this.bytes.get(url) === pending) this.bytes.delete(url); });
    }
    return this.bytes.get(url);
  }

  // The context is created/resumed synchronously in the actual gesture call.
  // The worklet, wasm and messages are the original formal engine protocol.
  async unlock() {
    const context = this.contextForGesture();
    const resume = context.resume();
    if (!this.boot) {
      this.boot = (async () => {
        if (context.sampleRate !== 48000) throw Error('浏览器未提供正式引擎要求的 48 kHz 音频');
        await context.audioWorklet.addModule(this.assetURL('native-audio-worklet.js'));
        const node = new AudioWorkletNode(context, 'formal-piano-mixer', {
          numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1]
        });
        this.node = node;
        node.connect(context.destination);
        node.port.onmessage = event => {
          const message = event.data;
          if (message.type === 'pcm') {
            this.pcm = new Float32Array(message.bytes); this.pcmSequence = message.sequence; return;
          }
          const request = this.requests.get(message.request);
          if (request) {
            this.requests.delete(message.request); clearTimeout(request.timer);
            message.error ? request.reject(Error(message.error)) : request.resolve();
          } else if (message.error) this.onStatus(message.error);
        };
        node.onprocessorerror = () => this.onStatus('声音处理器中断，请重新打开页面');
        const wasm = await this.getBytes('native-gm.wasm');
        await this.send({type: 'wasm', bytes: wasm.slice(0)});
        this.sustain = this._sustain; this.setVolume(this.volume); this.coreReady = true;
      })().catch(error => {
        this.node?.disconnect(); this.node = null; this.boot = null; this.coreReady = false;
        throw error;
      });
    }
    await Promise.all([resume, this.boot]);
    return context;
  }

  // Merge requests before the inherited sampler installs its original PCM.
  // Note owners still pass through inherited on/off/stop, including early key-up.
  async prepare(pitches = []) {
    const ready = this.unlock(), tone = this._tone;
    const roots = validPitches(pitches).map(p => this.samplePitch(p));
    if (PIANO_PRESETS.has(tone)) roots.forEach(p => { this.fetchSample(p).catch(() => {}); });
    else if (tone >= 34 && tone < 162) this.getBytes('assets/soundfont/TimGM6mb.sf2').catch(() => {});
    await ready;
    if (!PIANO_PRESETS.has(this._tone)) return super.prepare([]);
    await Promise.all([...new Set(roots)].map(pitch => {
      if (this.loaded.has(pitch)) return;
      if (!this.samplePreparations.has(pitch)) {
        const pending = super.prepare([pitch]).finally(() => {
          if (this.samplePreparations.get(pitch) === pending) this.samplePreparations.delete(pitch);
        });
        this.samplePreparations.set(pitch, pending);
      }
      return this.samplePreparations.get(pitch);
    }));
  }

  _queueWarm(work) {
    return new Promise((resolve, reject) => {
      this.warmQueue.push({work, resolve, reject}); this._pumpWarm();
    });
  }
  _pumpWarm() {
    while (this.warmRunning < this.warmConcurrency && this.warmQueue.length) {
      const task = this.warmQueue.shift(); this.warmRunning++;
      Promise.resolve().then(task.work).then(task.resolve, task.reject).finally(() => {
        this.warmRunning--; this._pumpWarm();
      });
    }
  }
  _background(key, work) {
    if (!this.background.has(key)) {
      const pending = Promise.resolve().then(work).then(() => ({ok: true})).catch(error => {
        this.warmError = String(error?.message || error); return {ok: false, error: this.warmError};
      }).finally(() => { if (this.background.get(key) === pending) this.background.delete(key); });
      this.background.set(key, pending);
    }
    return this.background.get(key);
  }

  /** Download exact worklet dependencies without creating an AudioContext. */
  warmCore() {
    return this._background('core', () => Promise.all([
      'native-audio-worklet.js', 'native-synth.js', 'native-gm.wasm'
    ].map(url => this._queueWarm(() => this.getBytes(url)))));
  }

  /** Background download by default; install requires an already running core. */
  warmPitches(pitches, {install = false} = {}) {
    const values = validPitches(pitches), roots = [...new Set(values.map(p => this.samplePitch(p)))];
    const tone = this._tone, key = `pitches:${tone}:${install}:${roots.join(',')}`;
    return this._background(key, async () => {
      if (PIANO_PRESETS.has(tone)) {
        await Promise.all(roots.map(p => this._queueWarm(() => this.fetchSample(p))));
      } else if (tone >= 34 && tone < 162) {
        await this._queueWarm(() => this.getBytes('assets/soundfont/TimGM6mb.sf2'));
      }
      if (install && this.coreReady && this._tone === tone) await this.prepare(values);
    });
  }

  warmRange(low = 48, high = 84, {center = 60, install = false} = {}) {
    const a = Math.max(0, Math.min(127, Math.round(low))), b = Math.max(a, Math.min(127, Math.round(high)));
    const pitches = Array.from({length: b - a + 1}, (_, i) => a + i)
      .sort((x, y) => Math.abs(x - center) - Math.abs(y - center));
    return this.warmPitches(pitches, {install});
  }

  /** Foreground readiness is bounded by a short source-time window, never a song. */
  async prepareWindow(song, positionMs = 0, options = {}) {
    const pitches = pitchesForWindow(song, positionMs, options);
    await this.prepare(pitches);
    return {pitches, positionMs, lookaheadMs: options.lookaheadMs ?? 1400};
  }

  /** Rolling lookahead: return immediately to the caller; failures stay inspectable. */
  prefetchWindow(song, positionMs = 0, options = {}) {
    const pitches = pitchesForWindow(song, positionMs, options);
    return this.warmPitches(pitches, {install: this.coreReady});
  }

  inspect() {
    return {...super.inspect(), desktopLoading: {
      coreReady: this.coreReady, samplePreparations: this.samplePreparations.size,
      backgroundTasks: this.background.size, queued: this.warmQueue.length,
      downloading: this.warmRunning, lastError: this.warmError,
      assetBase: AUDIO_ASSET_BASE, worklet: DESKTOP_AUDIO_WORKLET, presetCount: 176
    }};
  }
}

export default DesktopPianoAudio;
