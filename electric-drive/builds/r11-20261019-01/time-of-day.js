// Art direction is expressed in linear light through actual sky radiance,
// sun/fill, fog and cached reflection environments. No per-frame captures.
export const TIME_OF_DAY_PROFILES = Object.freeze({
  day: Object.freeze({
    label: '白天', exposure: .96, fog: 0xb9c6cd, fogDensity: .00135,
    sunColor: 0xffe4bb, sunIntensity: 3.0, sunOffset: [-90, 75, 55],
    skyFill: 0xb4cff0, groundFill: 0x535450, fillIntensity: .46,
    rimColor: 0xd8e9ff, rimIntensity: .38, environmentIntensity: .86,
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
