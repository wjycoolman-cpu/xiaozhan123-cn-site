# R8 post-processing sources

## Three.js 0.186.1

Original project: https://github.com/mrdoob/three.js

MIT license, full original text in `THREE-LICENSE.txt`. The selected EffectComposer, Pass, ShaderPass, MaskPass, OutputPass, UnrealBloomPass and four shaders come from the same installed Three.js 0.186.1 used by the existing runtime. Import paths were rewritten to the existing local `vendor/three.module.js`; the engine was not upgraded or duplicated. The source hashes and selected files are recorded in the author's work/three-postfx-sources.json.

Actual reference examples opened and viewed:

- https://threejs.org/examples/webgl_materials_car.html — physical car paint, clearcoat and environment reflection. The game retains its separately licensed vehicle.
- https://threejs.org/examples/webgl_postprocessing_unreal_bloom.html — multiscale bloom. The example's Ion Drive model was only viewed and is not included.

## N8AO 2.0.1

Original project: https://github.com/N8python/n8ao

Pinned commit: `0fc15550c98119758e83ed4c2d0e87273bae9ed9`.

License: the exact repository LICENSE at this commit contains **CC0 1.0 Universal** and is reproduced unmodified in `N8AO-LICENSE.txt`. The repository's package.json says ISC; this metadata difference is recorded here rather than substituting package metadata for the actual license text.

Official live example viewed: https://n8programs.com/n8ao/example/ . Its architectural model is not included in this package.

Local modifications:

1. Retained the standalone Three.js N8AOPass and removed the unused pmndrs adapter, avoiding a second post-processing framework/dependency. Local import paths use the existing Three runtime.
2. Clamped the transparent AO adjustment factor to [0,1], so overlapping additive jet alpha cannot extrapolate AO into extra brightness. Original transparent colour blending remains intact.
3. During only the two transparent auxiliary renders, saved and disabled shadowMap.autoUpdate/needsUpdate, restoring both in finally along with visibility/background/clear state. The normal beauty render still updates the original shadow casters.
4. The wrapper explicitly disposes owned render targets, textures, materials and shared fullscreen geometry without duplicate resource ownership.

The game wrapper uses the original displaced beauty/depth materials, half-resolution Medium AO, no temporal accumulation, depth-masked and bounded high-pass bloom, a mild finishing shader, one ACES/sRGB output pass and FXAA. It does not reprocess geometry with a global normal override. All sources and inherited game asset licenses remain separate; no commercial game's model, texture or sound was extracted.
