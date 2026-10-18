# Amazon Lumberyard Bistro 街区样本

**Amazon Lumberyard Bistro (2017), Amazon Lumberyard, Open Research Content Archive (ORCA).**

原始来源：https://developer.nvidia.com/orca/amazon-lumberyard-bistro

原件下载入口：https://developer.nvidia.com/bistro

许可：**Creative Commons Attribution 4.0 International / CC BY 4.0**

许可链接：https://creativecommons.org/licenses/by/4.0/

允许在遵守 CC BY 4.0 署名要求的情况下商业使用、修改与分发。保留以上名称、作者、来源和许可链接，并说明修改；不要把这组素材标为 CC0，不表示 Amazon 或 NVIDIA 为本游戏背书。

本地修改：从官方原 ZIP 的 BistroExterior.fbx 裁出餐馆建筑与约 33m × 35m 周边街景；按建筑、街边细节、路面合并几何；纹理缩至不超过 512px；BC5 XY 法线重建正 Z，并由 DirectX 绿通道转为 OpenGL；按官方 README 的 G粗糙度/B金属度重建受光 PBR 材质；重新导出内嵌纹理 GLB。原 Specular 红通道暂未绑定为 AO，原数据保留在工作目录，避免在遮蔽约定未完全确认时直接反黑。

`bistro-cafe-street-512.glb` 是合并版；`bistro-building-512.glb`、`bistro-street-details-512.glb`、`bistro-street-surface-512.glb` 是同一坐标系的独立部分，可挑选或一起组合，**不要把合并版与各部分同时叠放**。

原 ZIP 内的完整许可保存为本目录 LICENSE.txt，原 README.txt 保存为 ORIGINAL_README.txt；二者内容未改写。所有模型来自官方公开资产，不是商业游戏拆包。

新增两件同源补件 `bistro-brick-building-512.glb`、`bistro-props-light-512.glb` 同样适用以上 CC BY 4.0 许可。第二栋建筑隔离与轻量道具的选取、减面、原点/展示平移修改及精确尺寸见 `ADDONS_USAGE.md`。

## R5-02 新增完整建筑

`bistro-building-09-1k.glb` 和 `bistro-building-11-1k.glb` 来自同一官方 BistroExterior 场景，分别保留白石拱窗/曲面屋顶建筑与红砖圆角建筑的完整几何、材质分组和原始米尺度。提取后烘焙源对象变换、处理负行列式法线、以 XZ 中心和最低地面重设原点，合并同建筑网格并导出 glTF Y-up；未减面。两个文件分别为 68,836 和 25,861 个三角形，内嵌 PBR 贴图最长边 1024px；法线与粗糙度/金属度转换沿用上述已核对的约定。新修改同样适用 CC BY 4.0，保留 Amazon Lumberyard / ORCA 来源署名，不表示原作者背书。

09/11 是前一轮看样候选，后续质量选择以 Emerald 主体及 Bistro 05/07 替换，当前 R5-02 运行清单不包含这两件 1K 文件。`bistro-building-02-1k.glb` 因大块空白背墙同样不采用、不随运行包分发。官方源 ZIP 保持只读；候选材质清单及导出记录保存在本工作包 work/quality-city，质量检查图在 QA/quality-assets，它们不属于游戏运行文件。

当前 R5-02 采用 `bistro-city-block-kit-512.glb` 中的 `Bistro_05_Corner_Shops` 和 `Bistro_07_Ornate_Residence`，分别保留灰蓝石商铺、突出屋窗及浅石雕花窗套、拱门、檐口等实物细节；覆盖合集的展示平移、按真实米尺度安置于道路两侧。同源原件、平面 dissolve、材质合并、512px 内嵌 PBR 和 CC BY 4.0 修改说明见随包 `BLOCK_KIT_USAGE.md`。原01餐馆和brick建筑继续用于300–400米的Bistro街区。
