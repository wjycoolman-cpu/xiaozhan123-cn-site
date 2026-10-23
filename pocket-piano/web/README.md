# 弹钢琴电脑演奏台 desktop43-perf1 · 2026-10-23

独立网页入口 `/pocket-piano/web/`，复用 `/pocket-piano/demo/` 的曲库、正式声音和第三方依赖。默认自由演奏与实体电脑键盘：左侧曲库、固定播放条、中央双手键位图、下方钢琴。五线谱和下落音符在同一工作区切换。键盘设置默认折叠，保留逐键编辑及笔记本半音布局。空格按住延音、主 Enter 开始/暂停、Shift+发音键升半音、Esc 停止发声。参考 Everyone Piano 的操作关系和 Synthesia 的练曲视图，界面为本项目原创，不声称完整复制官方默认键位或皮肤。手机计算器、掌机及独立触摸乐器菜单不在此桌面入口加载。

## 直接运行与恢复

1. 获取公开仓库 https://github.com/wjycoolman-cpu/xiaozhan123-cn-site ，保留其目录结构。
2. 将本适配源码 ZIP 解压至仓库根目录，覆盖其中 `pocket-piano/web/` 对应文件。ZIP 内没有私有数据，也不包含未使用的旧网页资源副本。
3. 在仓库根运行 `python -m http.server 8769 --bind 127.0.0.1`。
4. 打开 `http://127.0.0.1:8769/pocket-piano/web/`。需要 HTTP/HTTPS 源与浏览器音频手势，不能直接用 `file://` 打开。
5. 资源路径以各模块 URL 解析，不依赖 HTML `<base>`。共享音频和曲库仍在相邻的 `/demo/`，不能仅拷贝 `web` 目录而丢失共享资源。

## 桌面加载策略

电脑键位和设置不等待曲库、谱面或整首音色。内置目录为轻量索引，16 首内置曲目按选中的单曲读取；在线目录由用户打开后读取，完整目录搜索在 Worker 内进行。五线谱仅在选择该视图且已有歌曲时加载 VexFlow，中文标签使用系统字体，不下载整套 CJK 字库。正式 Guide 仅跟弹和 EOP 导入等实际需要时加载。

`desktop-audio.js` 继续使用原采样与 Java/TSF 音频引擎。后台只预热核心和中央 C，首次声音仍需浏览器用户手势及实际音频资源就绪。自动演奏只等待起始短窗，跟弹只等待当前音组，再滚动预取后续音符；不等待整首曲目的全部采样。不使用低品质振荡器替代钢琴。

## 本地性能记录

帮助 → 下载性能记录，可取得本页当前的 `piano-local-performance-v1` JSON。记录仅保存在内存，刷新后重新开始；不会自动上传，也不读取曲谱、录音、搜索词、按键内容、存档或身份信息。资源记录仅保留同源钢琴静态资源类别，去掉查询参数，并将单曲、采样及曲库分包编号替换为占位路径。最多保留 112 条，单种操作最多 16 条；较早记录可能被淘汰。

工作区、菜单、视图、选曲、曲库读取、音源准备、开始演奏、录制和媒体生成分别记录自己的起止点。DOM／数据就绪、音频命令就绪与两次 rAF 后的呈现机会有不同标记；这些记录不证明实际像素已经显示、扬声器已经发声、INP 或完整冷／热启动通过。资源传输为零也只作为缓存线索。页面隐藏时，待呈现记录以 `not_visible` 结束；从浏览器往返缓存返回后继续采集。

`performance.js` 通过可选动态导入加载，演奏和菜单不等待它；下载慢或失败不阻断原功能。模块晚到时导入操作原有的 Performance 时钟区间，不把诊断模块的下载等待加到已结束操作上。User Timing、Navigation／Resource Timing 与可用的 Long Animation Frame／longtask 观察器只是后续真实浏览器测试的取证入口，仍需在最终网址按相同条件完成实际冷／热启动、切换、首次演奏及声音输出验收。

## 完整对应源码

本 ZIP 提供本轮实际网页适配代码、实际派生运行时、可复算补丁、谱面脚本、许可入口和组件哈希。共享引擎仍使用已公开的完整源码两部分：

- https://raw.githubusercontent.com/wjycoolman-cpu/xiaozhan123-cn-site/f655a107b3fa30ddf48c4cdd55f554da5f577fc5/pocket-piano/demo/source/app31-html-source-part1.zip
- https://raw.githubusercontent.com/wjycoolman-cpu/xiaozhan123-cn-site/f655a107b3fa30ddf48c4cdd55f554da5f577fc5/pocket-piano/demo/source/app31-html-source-part2.zip

两份共享源码 ZIP 解压到同一个空目录，按其 README.md 重建原 Java/C 引擎与依赖；再应用本轮适配。已部署的共享资源和运行时也完整保留在公开仓库 `pocket-piano/demo/`。具体共享基线与哈希见 `source-lock.json`。

## Guide 修正

TeaVM 0.12.3 的官方 `TTreeSet.add` 将元素本身作为 TreeMap 值，`remove` 却比较另一存在标记，违背 Java Set 返回契约。它会使旧网页版的 pending 音符消失，但正确按键返回 false、和弦不推进。上游对应实现：

https://github.com/konsoletyper/teavm/blob/0.12.3/classlib/src/main/java/org/teavm/classlib/java/util/TTreeSet.java

本页的 `native-synth.js` 由 `build-guide-runtime.py` 从未改动的共享原模块按精确 SHA 生成，只修正这一处存值/返回判断。运行 `python pocket-piano/web/build-guide-runtime.py` 可重新生成同一字节；`guide-runtime-provenance.json` 记录原始和修正哈希。保留项目 GPL-3.0 与 TeaVM Apache-2.0 许可。桌面跟弹采用修正版 Guide，谱面在独立 Worker 中使用同源音符；音频 AudioWorklet/WASM 和离线混音 Worker 继续共享原文件。旧版手机胶合文件保留来源记录，不在 desktop42 入口导入。

## 数据和验证边界

旧 `piano-web-songs` / `piano-web-favorites` 和 `piano-web41-keys` 保留。缺省力度补 85、缺省 BPM 补 120，显式无效力度拒绝。desktop42 会话及上一曲快照使用 `piano-web42-session` / `piano-web42-last-song`，兼容读取旧41会话；不把旧手机8白键布局恢复到电脑。未知旧在线曲目的进度保留，并由明确“恢复上次曲目”入口按需读取，不阻塞键盘演奏。

五线谱使用原始音符事件同步，记谱时值、拍号、调号和声部为近似排版，非原版出版谱。VexFlow MIT、Bravura 字体 OFL、声音、曲目及视频依赖分别保留许可，详见 credits.html。旧共享资源中的 Noto 许可仍保留，桌面入口不请求它。

Node 模型和输入所有权验证不等于浏览器可见画面、真实输入、声音听感、实体键盘无冲或浏览器 MP4 导出验收；每次交付应分别记录实际覆盖范围。
