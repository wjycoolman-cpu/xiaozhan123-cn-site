const STORAGE_KEY = 'electric-drive-time-of-day-v1';
const valid = value => value === 'day' || value === 'dusk';

export function readTimeOfDayPreference(storage) {
  try {
    const value = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    return valid(value) ? value : 'day';
  } catch {
    return 'day';
  }
}

export function bindLightingSettings({ world, document = globalThis.document, storage }) {
  const buttons = [...document.querySelectorAll('button[data-time-of-day]')];
  const status = document.getElementById('timeOfDayStatus');
  let destroyed = false;
  const sync = () => {
    const mode = world.getTimeOfDay();
    if (!valid(mode)) throw new Error('Invalid rendered time of day');
    document.documentElement.dataset.timeOfDay = mode;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.timeOfDay === mode));
    status.textContent = `当前：${mode === 'day' ? '白天' : '黄昏'}`;
    return mode;
  };
  const select = event => {
    if (destroyed) return;
    const mode = event.currentTarget.dataset.timeOfDay;
    if (!valid(mode) || world.setTimeOfDay(mode) !== mode) return;
    try { (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, mode); } catch {}
    sync();
  };
  for (const button of buttons) button.addEventListener('click', select);
  sync();
  return {
    snapshot() {
      const meta = world.scene?.userData?.timeOfDay ?? {};
      return {
        mode: world.getTimeOfDay(), lightingReady: meta.lightingReady === true,
        cachedEnvironments: meta.cachedEnvironments ?? 0,
        cachedHeroReflections: meta.cachedHeroReflections ?? 0,
        perFrameCaptures: meta.perFrameCaptures ?? 0,
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const button of buttons) button.removeEventListener('click', select);
    },
  };
}
