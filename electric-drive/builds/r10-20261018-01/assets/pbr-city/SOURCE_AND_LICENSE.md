# R4 城市高架运行资源来源

以下资产全部来自 Poly Haven，原始资产 CC0，可商业使用、修改和随游戏分发；无需强制署名，建议保留本文件供来源追踪。

- 公寓立面原件：James Ray Cock / https://polyhaven.com/a/modular_urban_apartments_facade
- 沥青 PBR：Rob Tuytel / https://polyhaven.com/a/asphalt_02
- 当前天空及反射 HDRI：Sergej Majboroda（拍摄）、Jarod Guest（Sky Edits）/ https://polyhaven.com/a/industrial_sunset_puresky
- 官方许可：https://polyhaven.com/license
- CC0：https://creativecommons.org/publicdomain/zero/1.0/

`urban-facade-selected.glb` 是对公寓立面原件的选件、平面减面和格式整理，修改：保留 6 个墙/窗/门/檐口节点，DISSOLVE 减少共面细分，保留 UV/法线/材质边界，导出为内嵌纹理 GLB。3,245 tris，9,618,684 bytes。原件也保留在 facade/，二者不需要同时装入游戏。

`asphalt/` 中三张 1K JPG 分别为 diffuse、OpenGL normal、roughness，原尺度约 3m × 3m。

`sky/industrial_sunset_puresky_1k.hdr` 为 1K Radiance HDR（1,158,432 bytes），当前同时用于 background 和 PMREM environment，固定同一旋转角。它不含城市/道路/游客照片。详见同目录 SOURCE_AND_USAGE.md。

R4 的实际运行依赖仅为选件 GLB、asphalt/ 三图和 sky/ HDR。本目录的 facade/ 原始模型与 venice_sunset_1k.hdr 是来源工作副本，当前不会加载，也不应随运行包复制；完整来源原件另在 scout 工作区保留。

R4 改动：按源件真实 3m 网格组装四面窗墙与檐口，添加实心退台屋顶、沿街基座，按材质实例化与距离裁切；UV/法线/纹理许可保留。源包没有独立阳台模型，不宣称导入了阳台资产。

源图示例、网站文案不属于此运行资源包。未放入 Bistro 资产、商业游戏资产、付费资源或需登录文件。
