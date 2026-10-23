# 弹钢琴网页版 2026-10-23

独立网页入口 `/pocket-piano/web/`，复用 `/pocket-piano/demo/` 的曲库、声音、图形资源和第三方依赖。主页提供 Everyone Piano 风格的电脑键盘按键图、逐键编辑、笔记本半音布局及互动五线谱。空格按住延音、主 Enter 开始/暂停、Shift+发音键升半音、Esc 停止发声。附加键位属于本项目适配，不声称完整复制官方默认布局。

## 直接运行与恢复

1. 获取公开仓库 https://github.com/wjycoolman-cpu/xiaozhan123-cn-site ，保留其目录结构。
2. 将本适配源码 ZIP 解压至仓库根目录，覆盖其中 `pocket-piano/web/` 对应文件。ZIP 内没有私有数据，也不包含未使用的旧网页资源副本。
3. 在仓库根运行 `python -m http.server 8769 --bind 127.0.0.1`。
4. 打开 `http://127.0.0.1:8769/pocket-piano/web/`。需要 HTTP/HTTPS 源与浏览器音频手势，不能直接用 `file://` 打开。
5. 本页 HTML 的 `<base>` 有意指向 `/pocket-piano/demo/`；不能仅拷贝 `web` 目录到独立域名而丢失共享资源。

## 完整对应源码

本 ZIP 提供本轮实际网页适配代码、实际派生运行时、可复算补丁、谱面脚本、许可入口和组件哈希。共享引擎仍使用已公开的完整源码两部分：

- https://raw.githubusercontent.com/wjycoolman-cpu/xiaozhan123-cn-site/f655a107b3fa30ddf48c4cdd55f554da5f577fc5/pocket-piano/demo/source/app31-html-source-part1.zip
- https://raw.githubusercontent.com/wjycoolman-cpu/xiaozhan123-cn-site/f655a107b3fa30ddf48c4cdd55f554da5f577fc5/pocket-piano/demo/source/app31-html-source-part2.zip

两份共享源码 ZIP 解压到同一个空目录，按其 README.md 重建原 Java/C 引擎与依赖；再应用本轮适配。已部署的共享资源和运行时也完整保留在公开仓库 `pocket-piano/demo/`。具体共享基线与哈希见 `source-lock.json`。

## Guide 修正

TeaVM 0.12.3 的官方 `TTreeSet.add` 将元素本身作为 TreeMap 值，`remove` 却比较另一存在标记，违背 Java Set 返回契约。它会使旧网页版的 pending 音符消失，但正确按键返回 false、和弦不推进。上游对应实现：

https://github.com/konsoletyper/teavm/blob/0.12.3/classlib/src/main/java/org/teavm/classlib/java/util/TTreeSet.java

本页的 `native-synth.js` 由 `build-guide-runtime.py` 从未改动的共享原模块按精确 SHA 生成，只修正这一处存值/返回判断。运行 `python pocket-piano/web/build-guide-runtime.py` 可重新生成同一字节；`guide-runtime-provenance.json` 记录原始和修正哈希。保留项目 GPL-3.0 与 TeaVM Apache-2.0 许可。8 个本页胶合模块以同一份修正版主线程 Guide 运行，避免钢琴、独立乐器、整页曲谱各持不同进度；音频 AudioWorklet/WASM 和离线混音 Worker 继续共享原文件。

## 数据和验证边界

旧 `piano-web-songs` / `piano-web-favorites` 保留。缺省力度补 85、缺省 BPM 补 120，显式无效力度拒绝。新增会话和键位分别使用 `piano-web41-session`、`piano-web41-keys`，只在当前浏览器本地保存。

五线谱使用原始音符事件同步，记谱时值、拍号、调号和声部为近似排版，非原版出版谱。VexFlow MIT、Bravura/Noto 字体 OFL、声音、曲目及视频依赖分别保留许可，详见 credits.html。

Node 模型和输入所有权验证不等于浏览器可见画面、真实输入、声音听感、实体键盘无冲或浏览器 MP4 导出验收；每次交付应分别记录实际覆盖范围。
