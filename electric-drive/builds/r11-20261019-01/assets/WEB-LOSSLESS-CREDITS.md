# 网页版素材的格式改动

本网页对部分随包 GLB 的内嵌图像作无损 WebP 编码，并整理容器偏移；未缩小贴图，未改变贴图解码后的 RGBA 像素、模型几何、轮组、材质参数、UV、法线或动画。部分资源另以 gzip 传输，浏览器核验并还原后使用。

原作者、来源和许可仍按随附说明适用：

- Bistro：Amazon Lumberyard / NVIDIA ORCA，CC BY 4.0。见 bistro/SOURCE_AND_LICENSE.md 及同目录许可。
- Emerald Square：Nicholas Hull、Kate Anderson、Nir Benty / NVIDIA，CC BY-NC-SA 3.0。素材及上述格式改编继续以该许可提供；仅供免费非商业展示。见 emerald/SOURCE_AND_LICENSE.md 及同目录许可。
- 主车、交通车、道路、环境和字体的原作者及许可见各自随附 CREDITS、SOURCE、LICENSE、OFL 文件和游戏资源许可说明；本格式改动不增加品牌授权，也不表示原作者背书。

本游戏的代码与不同来源素材分别沿各自许可，未将整包一概改为 Emerald 素材的许可。

R11：1K Bistro街区同样经逐图RGBA与非图片访问器逐字节核验；新远景tower未获得更小的无损格式，直接保留原GLB。
