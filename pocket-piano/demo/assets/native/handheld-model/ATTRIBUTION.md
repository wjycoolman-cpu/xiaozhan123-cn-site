# 白色音乐掌机 26 · 第三方材料与修改

## 3D 掌机模型

“Nintendo Switch” by **SalvaVelarte**, licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.

- Original model: https://sketchfab.com/3d-models/nintendo-switch-19d52d793b8a47ef949c44e7879827e2
- License: https://creativecommons.org/licenses/by/4.0/
- Public asset mirror used: https://github.com/nikurou/Space_Product_Configurator/tree/1b98210750c8a062daf68f1688c49fc5b22d9525/public/nintendo_switch
- Source evidence: `download-receipt.json`, `source-sketchfab.json`, source glTF `asset.extras`.

The downloaded glTF, BIN and three texture files remain byte-for-byte unchanged. The original model has 8,238 triangles and six materials; it is not a high resolution PBR asset collection. Our original runtime adapter splits the merged button mesh into its 22 actual connected geometry islands, makes eight of those islands individually playable, removes their baked ABXY map, adds the shared arrow/shape labels, enlarges and moves these original controls, moves the original stick islands, widens and smooths the original white grips, recolors the center case white, and inserts a dark bezel and original Canvas game screen. Original author/model affiliation is not implied. Source silhouette facets remain visible.

This package contains **one downloaded model** and five original source adaptations. Shape 0 retains the edited Switch body. Shape 2 resizes and repositions the real source case and controls. Shapes 1, 3 and 4 retain the actual split source controls and sticks in original beveled case extensions (vertical, dual display and arcade panel). Shape 3 includes an independent event feedback Canvas screen. These are not five different downloaded models. Their front layout and dimensions were verified in desktop WebGL at the recommended orientations; native Android layouts and user visual acceptance remain unverified. The earlier `frozen-shape0` checkpoint deliberately contains only shape 0 and is kept separately.

## Three.js

Three.js **r170**, MIT license, copyright the Three.js authors. Full license: `vendor/THREE-LICENSE.txt`.
Official source: https://github.com/mrdoob/three.js/tree/r170
Files used: `three.module.min.js`, `GLTFLoader.js`, `BufferGeometryUtils.js`. Only the GLTFLoader utility import path was changed for the local flat vendor directory. No unlicensed application source from the model mirror repository is used.

## 数字合并 / 2048

Original by **Gabriele Cirulli**, MIT. Full license: `game-libs/2048-LICENSE.txt`.
Source: https://github.com/gabrielecirulli/2048/tree/478b6ec346e3787f589e4af751378d06ded4cbbc
The Tile, Grid and GameManager core is retained inside an isolated original adapter; seeded randomness, in-memory storage/UI, and accepted-note event control replace the original web runtime. No original media is used.

## 俄罗斯方块

Original JavaScript Tetris by **Jake Gordon**, MIT. Full license: `game-libs/TETRIS-LICENSE.txt`.
Source: https://github.com/jakesgordon/javascript-tetris/tree/e5c0c42f7dac0f3514a55eff656c6e22e95d68ed
Original collision, piece placement, rotation and line removal rules are adapted to seeded accepted-note events, with a row-zero scan correction. The original timer, DOM and artwork are not used.

Exact upstream files, hashes and modifications are recorded in `game-libs/derivation-manifest.json`. Both game modules run from actual ordered accepted-note slots or the original song note starts; they have no independent game timer or audio player.

## Original adapter and scenes

`renderer.html`, `renderer.js`, `symbols.js`, procedural game screen artwork and integration tests are original project adaptations. They are candidate application assets, not approval evidence. Android frame barriers, native multi-touch/audio, offline MP4 and the user's visual acceptance are separate checks.
