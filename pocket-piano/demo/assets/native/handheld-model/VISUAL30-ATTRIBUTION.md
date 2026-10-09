# 白色音乐掌机 30 · 新视觉来源与修改

## open-console-cad

**tiansongyu**, copyright (c) 2026, **MIT License**. Full license: `OPEN-CONSOLE-CAD-LICENSE.txt`. Upstream brand statement: `OPEN-CONSOLE-CAD-THIRD-PARTY-NOTICES.md`.

- Source: https://github.com/tiansongyu/open-console-cad
- Pinned revision: `55081da3b4864aba36082644f9a3c5cedf1061c8`
- Original asset: `exports/switch.glb`, 9,937,528 bytes, 654 meshes; actually downloaded and imported into Three.js.
- Runtime subset: `control-shells.glb`, 219,204 bytes. Eight published source parts retained: `JoyLRear`, `JoyRRear`, `JoyLFaceButton0`, `JoyLStickCollar`, `JoyLStickBoot`, `JoyLStickStem`, `JoyLStickCap`, `FrontBezel`. Exact selected attribute data is repacked into the smaller GLB; all internal electronics, accessories, logo and text objects are omitted.
- Modifications in the original application adapter: the published rear-shell convex exterior outline becomes a newly extruded, closed, rounded front shell without rear ports or screw holes; source buttons, concave sticks and frame geometry are fitted to the application case. The eight button diameters and center positions are rebuilt per form to provide nonoverlapping touch rectangles at the representative 320dp portrait / 853dp landscape viewports. Source concave stick geometry, milled profiles and bezel are reused; this is a two-source adaptation, not five newly downloaded models.
- White molded nonmetallic material, roughness, clearcoat and studio environment are original application settings.
- Nintendo, Sony and Valve marks are outside the upstream MIT grant. No upstream logo or text mesh is in the runtime subset, and the application implies no official affiliation. The required direction/triangle/circle/square/cross glyphs are original project drawing commands in `symbols.js`.

The editable FreeCAD construction scripts and unmodified full source GLB are retained with the candidate research evidence. The license grants use, modification and distribution; it does not grant third-party trademark rights.

## Existing source and Three.js

The original **SalvaVelarte** model remains under **CC BY 4.0**, with the attribution, exact source glTF/BIN/textures and license in the existing `ATTRIBUTION.md` and source folder. This adapter reuses its original source hierarchy, meaningful eight connected key islands, dimensions and ancillary parts. It replaces the control and case visual geometry described above; the downloaded source files are unmodified.

Three.js **r170**, **MIT**, copyright the Three.js authors, remains in `vendor/THREE-LICENSE.txt`. One extra official module is used without source alteration:

https://github.com/mrdoob/three.js/blob/r170/examples/jsm/environments/RoomEnvironment.js

`RoomEnvironment.js` is rendered into a PMREM once when the renderer is created. Its construction meshes and PMREM generator are disposed immediately. The resulting environment render target is released when `HandheldScene.dispose()` runs. No external HDR, paid asset, font, account or runtime network connection is required.

## Evidence boundary

Desktop WebGL images and coordinate diagnostics establish this visual adapter at the documented viewports. Native Android touch/audio/export and user visual acceptance require the root task's actual application checks. A successful image or a 48dp numeric check is not that acceptance.
