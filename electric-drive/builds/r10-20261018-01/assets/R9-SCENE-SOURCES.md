# R9 城市场景增量：来源与改动

本增量服务极限电驱的免费非商业版本。它继承原包各素材的独立许可；没有把Bistro或Emerald重新标成CC0。原资产、原许可与历史失败试样保留。

## 真正采用的素材与方法

### 1. 新的精细路灯（CC BY 4.0）

文件：bistro/bistro-street-lamp-512.glb
来源：https://developer.nvidia.com/orca/amazon-lumberyard-bistro
署名：Amazon Lumberyard Bistro (2017), Amazon Lumberyard, NVIDIA ORCA.
许可：https://creativecommons.org/licenses/by/4.0/ ，完整原文继续随 bistro/LICENSE.txt 提供。

从本项目已取得的原始Bistro外景中选取 Bistro_Research_Exterior_Paris_StreetLight_01a_6257，保留原PBR纹理/材质、灯体/链条/灯泡造型；沿用已经验证的BC5 DirectX法线重建与Y反转、线性rough/metal转换。归一化基脚和朝向，仅作保UV接缝的平面化简：10824→10790三角面，4材质，1,104,432B。实例共享几何/纹理，非逐灯加载模型；路灯外侧放置且不增加碰撞或可玩车道限制。

### 2. 真实天空云层（原有CC0素材，重新用于渲染）

继续使用包内 sky/qwantani_sunset_puresky_2k.hdr。
来源：https://polyhaven.com/a/qwantani_sunset_puresky
作者：Greg Zaal / Jarod Guest。许可：https://polyhaven.com/license （CC0）。
既有 sky/SOURCE_AND_LICENSE.md 保留原署名与原件信息。

dusk-sky.js在运行时采样真实HDR云层细节，在linear light中调整为低饱和蓝灰高空和窄暖橙天际线；同一结果一次预滤波成为PBR环境，再由既有一次城市cubemap提供主车反射。全屏仍为实时三维驾驶，不使用概念图当驾驶背景，不新增每帧环境抓取。
rosendal/dusk1 HDR与官方Three Sky程序云曾作研究试样，但未进入本次最终运行增量，旧失败图保留以便核对选路。

### 3. 原有建筑与道路，按原许可保留

- Poly Haven Modular Urban Apartments Facade / Asphalt 02：CC0；来源 https://polyhaven.com/a/modular_urban_apartments_facade 与 https://polyhaven.com/a/asphalt_02 。复用真实窗框/玻璃/檐口组件补齐被省略的可见低层，搭建8座错落的中景楼体；原pbr-city/SOURCE_AND_LICENSE.md保留。
- Bistro原街角、砖楼：CC BY 4.0；替换3处近景低细节toy楼，并沿用原完整模型/纹理。
- 其余保留的Emerald Square素材仍是CC BY-NC-SA 3.0；完整归属、修改说明和SA边界见 emerald/SOURCE_AND_LICENSE.md 与 LICENSE.txt。上述Bistro替换不取消包内其他Emerald的NC-SA约束。
- 主车/其他车辆、原道路、字体、后处理等的原许可均保留。

## 实现边界

urban-lighting.js为新代码：24个精细路灯共享4个材质批；最多2个普通PointLight，不加动态阴影灯；暖护栏细线共28段。窗光用source-local坐标和稳定实例roomSeed，避免建筑移动导致随机重亮。亮窗为少量暖色点缀。
world/pbr-city/landmarks只改视觉。core、encounters、audio、root UI和R8冻结件未写入。宽屏跟车更近，手机机位保持；相应运行与构图检查单列，不能把图片参考等同真实用户/手机/网站验收。

