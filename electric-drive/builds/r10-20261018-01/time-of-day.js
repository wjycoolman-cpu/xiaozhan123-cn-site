// Art direction is expressed in linear light through actual sky radiance,
// sun/fill, fog and cached reflection environments. No per-frame captures.
export const TIME_OF_DAY_PROFILES = Object.freeze({
  day: Object.freeze({
    label: '白天', exposure: .96, fog: 0xb4cee0, fogDensity: .00105,
    sunColor: 0xfff3dc, sunIntensity: 2.15, sunOffset: [-62, 122, -90],
    skyFill: 0xbcd7f4, groundFill: 0x696b68, fillIntensity: .65,
    rimColor: 0xd8e9ff, rimIntensity: .50, environmentIntensity: 1.0,
    roomLights: .04, streetLights: 0, stripLights: .03,
  }),
  dusk: Object.freeze({
    label: '黄昏', exposure: 1.0, fog: 0x7e8a9e, fogDensity: .00115,
    sunColor: 0xffc692, sunIntensity: 1.2, sunOffset: [-62, 28, -90],
    skyFill: 0xb4cceb, groundFill: 0x68616a, fillIntensity: .85,
    rimColor: 0xc4dbf6, rimIntensity: .78, environmentIntensity: 1.45,
    roomLights: 1, streetLights: 1, stripLights: 1,
  }),
});

export function normalizeTimeOfDay(value) {
  return value === 'dusk' ? 'dusk' : 'day';
}
