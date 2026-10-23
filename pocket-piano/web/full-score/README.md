# 桌面完整分页曲谱

`desktop-score.js` 的 `openDesktopScore(song)` 按需打开模态窗口。每次打开或换歌创建独立的 `desktop-score-worker.js`；Worker 自己导入正式 `native-synth.js`，只调用曲谱排版接口，不读取或改动主页面 `PianoWeb.engine` 与 Guide。

简谱正式引擎的文字测量桥在 Worker 内使用标准 OffscreenCanvas，屏显不加载中文字体。缺少 OffscreenCanvas 时，简谱给出明确错误；五线谱命令仍可准备。此处没有固定字宽或虚拟字体的生产回退。

五线谱适配器来自已有 `demo/assets/native/full-score/staff.js`，保留其 VexFlow 绘制逻辑，移除了手机 iframe、视口缩放和默认整套中文字体下载。代码按需加载本站既有、固定版本的 VexFlow 4.2.5。音乐记号使用 Bravura 字形路径；中文屏显采用系统字体。正式依赖与许可继续保存在原目录，没有修改或重复打包原资源：

- `../../demo/assets/native/full-score/vexflow-4.2.5.js`：VexFlow 4.2.5，MIT，见 `VEXFLOW-LICENSE.txt`。
- `../../demo/assets/native/full-score/BRAVURA-OFL.txt`：Bravura，SIL Open Font License 1.1。
- `../../demo/assets/native/full-score/NotoSansSC-Regular.otf` 与 `NOTO-OFL.txt`：Noto Sans SC，SIL Open Font License 1.1。

当页 SVG/PNG 为用户触发的浏览器下载；选择“嵌入开源中文字体”后才请求 Noto 字节，并将 OFL 许可嵌入 SVG 元数据。PNG 必须由浏览器实际解码 SVG 并通过 Canvas 输出，Node 模型不构成像素验证。

“全曲打印 / 另存 PDF”把选定谱面类型的所有页发送至同源独立打印页面。该页接齐全部页后，仍需用户明确点击准备打印；此时才加载本地 Noto 字体并打开浏览器打印对话框，由用户选择“另存为 PDF”。这不是自动生成 PDF 字节的接口。父窗口在传输未完成时关闭或换歌会取消任务；已传输完成的打印页面可独立使用。

严格 CSP 使用同源脚本、外部 CSS 与同源字体，不增加 `unsafe-eval`。VexFlow 的旧全局对象探测中包含 `new Function` 回退；现代环境存在 `globalThis`，不会进入该分支。Node 检查在禁用字符串动态代码生成的 VM 中实际初始化 VexFlow；浏览器 CSP、真实字体布局、PNG 像素和打印 PDF 仍需浏览器验证。
