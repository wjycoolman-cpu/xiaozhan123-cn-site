# Industrial Sunset (Pure Sky)：直接可用的天空补件

## 文件和许可

- 正式 HDR：`industrial_sunset_puresky_1k.hdr`
- **1,158,432 bytes，1024×512**，MD5 `622cc98d705210e283318c306089bb2e`；匿名下载，实际大小和 MD5 均匹配 Poly Haven API。
- 官方资产：https://polyhaven.com/a/industrial_sunset_puresky
- 精确下载：https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_sunset_puresky_1k.hdr
- 官方清单：https://api.polyhaven.com/files/industrial_sunset_puresky
- 原始拍摄 Sergej Majboroda，Sky Edits Jarod Guest。
- **CC0**。官方资产页指向 CC0，https://polyhaven.com/license 确认 HDRI 可商业使用、修改和随作品分发，无强制署名。原始资产页、许可页与下载核验 JSON 均保存在本目录。

## 实看结果

这是官方编辑的 **sky-only / Pure Sky** 版本。实际下载 HDR 经当前 Three.js r186 `HDRLoader` 加载，再作为 `scene.background` 和 PMREM 的 `scene.environment` 渲染，未报 pageerror / console error。已经实看完整经纬全景和四方向透视图：天空有分散层云、浅冷蓝上空、轻微粉橙暖色地平线，**没有真实城市、道路、游客或地面照片**；下半球为移除地面后的柔化延展区域。适合让游戏自己的城市/高架挡住下半球。

色调是**自然、低对比、偏冷蓝的暖色傍晚**，不是浓橙红戏剧化落日。用它解决单色天空与云层缺失；不要把它称作强烈金色日落。曝光过高会把云层洗白。已生成 `sky-warm-front-preview.png`：exposure=1、backgroundIntensity=0.65、backgroundRotation.y=π/2，让暖光方向靠近向 -Z 行驶的正前方；正式相机方向不同可转动天空，不要逐帧跟车旋转。

`sky-full-panorama.png` 是**下载的真实 HDR 自己渲染**的完整全景，不是官网示例图。`sky-perspective-{0,90,180,270}.png` 是实际背景四方向预览。`three-load-verification.json` 记录 Three.js 186、尺寸、PMREM 结果与错误数组。检查后端为 headless Edge / SwiftShader，仅证明加载与画面内容，不证明真实 GPU 帧率或正式游戏视觉通过。

## 推荐：天空与环境共用同一 HDR

```js
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
const skyHDR = await new HDRLoader().loadAsync(
  './assets/sky/industrial_sunset_puresky_1k.hdr'
);
skyHDR.mapping = THREE.EquirectangularReflectionMapping;
scene.background = skyHDR;
scene.backgroundIntensity = 0.65; // 保留云层，按当前曝光微调
scene.backgroundBlurriness = 0;   // 1K 已较柔，天空不要再额外虚化
scene.backgroundRotation.y = Math.PI / 2;
const pmrem = new THREE.PMREMGenerator(renderer);
const skyEnvTarget = pmrem.fromEquirectangular(skyHDR);
scene.environment = skyEnvTarget.texture;
scene.environmentIntensity = 0.8; // 与主光、材质/当前曝光一起调
scene.environmentRotation.y = scene.backgroundRotation.y;
pmrem.dispose();
// 继续保留 skyHDR（background 仍引用）与 skyEnvTarget（environment 引用）。
// 替换/销毁场景时，再 skyHDR.dispose(); skyEnvTarget.dispose();
```

全场主光方向应和暖光地平线保持一致。若已有程序化天空球会挡住背景，接入时由 world/root 处理该天空球的可见性；本子任务没有改 world 或正式包。

## 可分用：Pure Sky 背景 + 已有 Venice 环境

保留 `scene.environment = veniceEnv.texture`，只将 `scene.background` 指向本 HDR 即可；PMREM 无需为新天空再建一份。在短期保留已调车漆反射时可用，反射仍不会直接把 Venice 地面贴到游戏中。两张 HDR 的太阳方位与色温不同，必须在实机画面比较车漆/玻璃反射是否与可见天空矛盾；长期推荐共用同一张，便于使城市、天空和车辆受光一致。

本次只选一件、未扩搜索、未改正式游戏、未付款或登录。
