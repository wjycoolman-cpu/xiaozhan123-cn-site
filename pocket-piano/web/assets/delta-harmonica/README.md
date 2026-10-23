# 手机 1.0.41 游戏口琴音色

音色 ID 170–175 使用本项目手机 1.0.41 的 `DeltaHarmonicaSynth.java` 独立簧片算法。六种音色是经典簧片、温暖木腔、明亮金属、柔和气息、厚实低音、双簧颤音；没有从游戏中提取录音，也没有将这些 ID 作为普通 GM 口琴的别名。

`source/DeltaHarmonicaSynth.java` 与 `source/Instruments.java` 是对应的未修改手机源文件；项目 GPL-3.0 全文保留为 `source/LICENSE`。网页移植为可直接编辑的 ES module，位于 `../../desktop-audio-worklet.js`，没有额外编译或构建前置。原算法的 48 kHz、4096 点正弦表、确定噪声、起音、渐强和释放保留，浮点运算用 `Math.fround` 对应 Java float。

新 Worklet 只为 170–175 增加分支；原 0–169 仍导入相邻 `/demo/native-synth.js`，GM 的 WASM／SF2 和钢琴 PCM 路径也保持原样。原第三方来源与许可证继续见网页的来源许可入口和 `/demo/credits.html`。基线、源码与派生模块的文本哈希见 `audio-provenance.json`；文本统一 LF 后计算。

实时 `desktop-audio.js` 使用该新 Worklet；离线 `desktop-offline-audio.js` 在 Worker 内加载同一个处理器，消息仍为 ready → 配置（notes/preset/volume/sustain/speed）→ progress/error/pcm，PCM 为 48 kHz 单声道 Float32。WAV／MP4 消费者须使用新的离线 Worker，不能继续把新音色交给旧的 170 音色 Worker。

数字键页面与 DSP 分开：`body.png` 为手机既有原图，页面采用 8 列数字键，音高为 72+[0,2,4,5,7,9,11,12]，末键为“高1”。触摸／电脑键／MIDI 都须经主机统一的按下与松开事件，保留跟弹曲谱的实际音高。资源文件存在、离线 PCM 对照和逻辑测试不代表浏览器实际运行、听感或视觉验收。
