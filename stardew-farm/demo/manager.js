"use strict";

(() => {
  const STORAGE_KEY = "stardew-farm-manager-demo-v1";
  const MOD_VERSION = "1.0.2";
  const DEFAULT_PATH = "D:\\SteamLibrary\\steamapps\\common\\Stardew Valley";
  const MODES = Object.freeze({
    development: { label: "开荒种田（推荐）", description: "优先照料作物，闲暇时沿农田边界规整开荒。" },
    rush: { label: "收益速进", description: "减少额外开荒，把体力与资金用于种植、出货和再投资。" },
    showcase: { label: "观赏演示", description: "保留更清楚的工具动作，兼顾观赏与自动种田。" }
  });
  const FIXTURES = Object.freeze({
    ready: { path: DEFAULT_PATH, game: true, smapi: true, installed: false, description: "完整游戏 · SMAPI 4.5.2 · 助手未安装" },
    installed: { path: DEFAULT_PATH, game: true, smapi: true, installed: true, description: "完整游戏 · SMAPI 4.5.2 · 助手 1.0.2 已安装" },
    "missing-smapi": { path: "G:\\GOG Games\\Stardew Valley", game: true, smapi: false, installed: false, description: "完整游戏 · 尚未配置 SMAPI" },
    foreign: { path: "E:\\Games\\Stardew Valley", game: false, smapi: false, installed: false, foreign: true, description: "同名模组目录含未知内容，正式配置器会拒绝覆盖" },
    damaged: { path: "C:\\Games\\Stardew Valley", game: false, smapi: false, installed: true, damaged: true, description: "游戏文件不完整 · 已识别助手仍可卸载" },
    busy: { path: "F:\\SteamLibrary\\steamapps\\common\\Stardew Valley", game: true, smapi: true, installed: false, running: true, description: "游戏正在运行，正式配置器会拒绝安装、配置或卸载" }
  });
  const $ = id => document.getElementById(id);
  const ui = {
    path: $("GamePath"), preset: $("Preset"), speed: $("SpeedCeiling"), dependency: $("AutoSmapi"),
    browse: $("BrowseGame"), detect: $("DetectGame"), install: $("InstallConfigure"), launch: $("LaunchGame"),
    cancel: $("CancelOperation"), uninstall: $("UninstallAssistant"), details: $("ToggleDetails"),
    log: $("OperationLog"), logHost: $("details-host"), activity: $("activity"),
    title: $("StatusTitle"), detail: $("StatusDetail"), status: document.querySelector(".status"),
    gameBadge: $("game-badge"), smapiBadge: $("smapi-badge"), modBadge: $("mod-badge")
  };
  let memory = readMemory();
  let current = null;
  let inspectedInput = "";
  let busy = false;
  let scanning = false;
  let supportsCancellation = false;
  let cancelRequested = false;
  let pathTimer = null;
  let revision = 0;
  let detailsExpanded = false;
  let storageAvailable = true;
  let selectedFolder = "ready";
  let timingScale = 1;
  let keyboardInApp = false;
  let lastValidSpeed = 200;

  function readMemory() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (raw && raw.schema === 1 && raw.games && typeof raw.games === "object") {
        const games = {};
        for (const [key, value] of Object.entries(raw.games)) {
          if (!value || typeof value !== "object" || key.length > 512) continue;
          games[key] = {
            installed: value.installed === true,
            smapi: value.smapi === true,
            ownedRemainder: value.ownedRemainder === true,
            config: validConfiguration(value.config)
          };
        }
        return { schema: 1, games, lastPath: typeof raw.lastPath === "string" ? raw.lastPath.slice(0, 512) : "" };
      }
    } catch (_) { /* A damaged optional demo preference does not prevent browsing. */ }
    return { schema: 1, games: {}, lastPath: "" };
  }

  function validConfiguration(value) {
    if (!value || typeof value !== "object" || !MODES[value.WorkMode]) return null;
    if (!Number.isInteger(value.SpeedCeiling) || value.SpeedCeiling < 1 || value.SpeedCeiling > 200) return null;
    return {
      WorkMode: value.WorkMode, WorkSpeed: Math.min(value.WorkMode === "rush" ? 50 : value.WorkMode === "showcase" ? 25 : 10, value.SpeedCeiling),
      SpeedCeiling: value.SpeedCeiling, AdaptiveSpeed: true,
      ReserveGold: value.WorkMode === "rush" ? 0 : 100, KeepEachCrop: value.WorkMode === "rush" ? 0 : 5,
      PrepareAhead: value.WorkMode !== "rush", ClearTrees: value.WorkMode !== "rush",
      MaxTreesPerDay: value.WorkMode === "development" ? 12 : 4, ShowOverlay: false
    };
  }

  function writeMemory() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); }
    catch (_) {
      storageAvailable = false;
      appendLog("浏览器样例：此浏览器未允许保存本地样例状态，刷新后可能重置；真实游戏配置未读取或修改。");
    }
  }

  function canonical(input) {
    const text = String(input).trim().replace(/^"|"$/g, "").replace(/\//g, "\\");
    return text.replace(/\\+$/g, "");
  }
  function keyFor(path) { return canonical(path).toUpperCase(); }
  function sampleForPath(path) {
    const key = keyFor(path);
    return Object.values(FIXTURES).find(fixture => keyFor(fixture.path) === key) || null;
  }
  function inspect(path) {
    if (!String(path).trim()) return null;
    const fixture = sampleForPath(path);
    if (!fixture) return { path: canonical(path), game: false, smapi: false, installed: false, status: "游戏文件夹不存在，请浏览选择包含 Stardew Valley.exe 的目录。" };
    const saved = memory.games[keyFor(path)];
    const result = Object.assign({}, fixture);
    if (saved) {
      result.installed = saved.installed;
      result.smapi = saved.smapi;
      result.config = saved.config;
      result.ownedRemainder = saved.ownedRemainder;
    }
    if (result.foreign) result.status = "同名模组目录已有未知内容，未覆盖。请保留它并检查目录。";
    else if (result.damaged) result.status = "这不是完整的 Windows 星露谷游戏目录：缺少 Stardew Valley.dll。";
    else result.status = "游戏 1.6.15 · " + (result.smapi ? "SMAPI 兼容" : "需要 SMAPI 4.5.2") + " · " + (result.installed ? "助手已安装" : "助手未安装或文件不完整");
    return result;
  }

  function setStatus(title, detail, error = false) {
    ui.title.textContent = title;
    ui.detail.textContent = detail || "";
    ui.status.classList.toggle("error", error);
  }
  function sampleDetail(text) { return "浏览器样例：" + text; }
  function appendLog(text) {
    if (!text) return;
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    if (ui.log.value.length > 24000) ui.log.value = ui.log.value.slice(-18000);
    ui.log.value += time + "  " + text.trim() + "\n";
    ui.log.scrollTop = ui.log.scrollHeight;
  }
  function setDetails(expanded) {
    detailsExpanded = expanded;
    ui.logHost.hidden = !expanded;
    ui.details.textContent = expanded ? "收起操作记录" : "查看操作记录";
    ui.details.setAttribute("aria-expanded", String(expanded));
  }
  function setBadge(element, text, ready) {
    element.textContent = text;
    element.classList.toggle("ready", !!ready);
  }
  function updateBadges(result) {
    setBadge(ui.gameBadge, "游戏：" + (result && result.game ? "已找到" : result && result.installed ? "文件不完整" : "未找到"), result && result.game);
    ui.gameBadge.classList.toggle("incomplete", !!(result && result.installed && !result.game));
    setBadge(ui.smapiBadge, "SMAPI：" + (result && result.smapi ? "已就绪" : "未配置"), result && result.smapi);
    setBadge(ui.modBadge, "助手：" + (result && result.installed ? "v" + MOD_VERSION : "未安装"), result && result.installed);
  }
  function updateButtons() {
    const idle = !busy && !scanning;
    const valid = current && inspectedInput === ui.path.value.trim();
    const game = valid && current.game;
    const smapi = game && current.smapi;
    const mod = valid && current.installed;
    ui.path.disabled = busy;
    for (const field of [ui.browse, ui.detect, ui.preset, ui.speed, ui.dependency]) field.disabled = !idle;
    ui.install.disabled = !(idle && game && (smapi || ui.dependency.checked));
    ui.launch.disabled = !(idle && smapi && mod);
    ui.uninstall.disabled = !(idle && mod);
    ui.install.textContent = mod ? "一键应用配置 / 更新(I)" : "一键安装并配置(I)";
    ui.detect.textContent = scanning ? "正在检测…" : "自动检测(D)";
  }
  function showDetection(result, actionNotice = false) {
    if (result && result.installed && !result.game) {
      setStatus("游戏文件不完整，助手仍可卸载", "暂时不能安装或启动。可先卸载本助手，再修复游戏文件；存档和其他模组保留。", true);
    } else if (!result || !result.game) {
      setStatus("这个目录中没有找到游戏", "选择 Stardew Valley.exe 所在文件夹，或点击“自动检测”。", true);
    } else if (result.installed && result.smapi) {
      setStatus("助手已安装，可以启动游戏", "也可以更改玩法后点击“一键应用配置 / 更新”。");
    } else if (!result.smapi) {
      setStatus("游戏已找到，缺少 SMAPI", ui.dependency.checked ? "一键安装时将联网配置官方组件，再安装自动农场助手。" : "勾选自动配置 SMAPI，或安装运行组件后重新检测。");
    } else {
      setStatus("游戏已找到，可以一键安装", "选择玩法和加速上限，然后点击“一键安装并配置”。");
    }
    if (actionNotice) ui.detail.textContent = sampleDetail(ui.detail.textContent + "这里只检查虚构目录，未读取本机游戏。");
    // Native unknown directories return without logging; identified damaged
    // installations still append their diagnostic before the early return.
    if (result && (result.game || result.installed) && result.status) appendLog((actionNotice ? "浏览器样例：" : "") + result.status);
  }
  function inspectCurrent(show = true, actionNotice = true) {
    inspectedInput = ui.path.value.trim();
    current = inspect(inspectedInput);
    updateBadges(current);
    if (show) {
      if (!inspectedInput) setStatus("选择游戏文件夹", actionNotice ? sampleDetail("自动检测，或使用“浏览”选择预设样例游戏位置；浏览器未访问本机目录。") : "自动检测，或使用“浏览”选择游戏所在位置。");
      else showDetection(current, actionNotice);
    }
    updateButtons();
    return current;
  }
  function delay(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds * timingScale)); }
  async function discover() {
    if (busy || scanning) return;
    scanning = true;
    const ownRevision = ++revision;
    clearTimeout(pathTimer);
    updateButtons();
    setStatus("正在检测游戏位置…", sampleDetail("只检索预设的虚构安装目录，未读取本机安装记录。"));
    await delay(420);
    if (ownRevision !== revision) { scanning = false; updateButtons(); return; }
    const preferred = sampleForPath(ui.path.value);
    ui.path.value = preferred && preferred.game ? preferred.path : DEFAULT_PATH;
    scanning = false;
    inspectCurrent(true, true);
  }

  function beginOperation(text, cancellable) {
    busy = true;
    supportsCancellation = cancellable;
    cancelRequested = false;
    clearTimeout(pathTimer);
    revision++;
    ui.activity.hidden = false;
    ui.cancel.hidden = !cancellable;
    ui.cancel.disabled = !cancellable;
    ui.cancel.textContent = "取消操作";
    setStatus(text, sampleDetail("这里只演示操作过程；不会安装组件、写入游戏配置或打开真实游戏。"));
    appendLog("浏览器样例：" + text);
    updateButtons();
  }
  function endOperation() {
    busy = false;
    supportsCancellation = false;
    ui.activity.hidden = true;
    ui.cancel.hidden = true;
    updateButtons();
  }
  function requestCancel() {
    if (!busy || !supportsCancellation) return;
    cancelRequested = true;
    ui.cancel.disabled = true;
    ui.cancel.textContent = "正在取消…";
    setStatus("正在等待安全取消…", sampleDetail("样例步骤退出后可以重试；真实游戏文件未被修改。"));
  }
  function throwIfCancelled() {
    if (cancelRequested) { const error = new Error("cancelled"); error.cancelled = true; throw error; }
  }
  function fail(title, message) {
    setStatus(title, sampleDetail(message + " 目录和设置已保留，可处理原因后重试。真实游戏未操作。"), true);
    appendLog("浏览器样例：" + title + "：" + message);
    setDetails(true);
  }
  function requireNotRunning(result) {
    if (result && result.running) throw new Error("游戏正在运行。请先正常退出游戏，再安装、配置或卸载；当前游戏不会被强制关闭。");
  }
  async function progress(text, wait = 500) {
    throwIfCancelled();
    appendLog("浏览器样例：" + text);
    setStatus("正在处理…", sampleDetail(text + "（不访问真实文件）"));
    await delay(wait);
    throwIfCancelled();
  }
  async function install() {
    if (busy || scanning || ui.install.disabled) return;
    normalizeSpeed();
    const path = ui.path.value.trim();
    const mode = ui.preset.value;
    const ceiling = Number(ui.speed.value);
    const dependency = ui.dependency.checked;
    const initial = inspect(path);
    beginOperation("正在安装并配置…", true);
    try {
      if (!initial || !initial.game) throw new Error("这不是完整的 Windows 星露谷游戏目录。请浏览选择游戏所在文件夹。");
      requireNotRunning(initial);
      if (!Number.isInteger(ceiling) || ceiling < 1 || ceiling > 200) throw new Error("速度上限应在 1 到 200 之间。实际工作速度会随电脑负载调整。");
      if (!MODES[mode]) throw new Error("请选择养成、速通或演示模式。");
      if (initial.foreign) throw new Error("同名模组目录已有未知内容，未覆盖。请保留它并检查目录。");
      await progress("检查发行包、游戏版本和文件边界…", 500);
      if (!initial.smapi) {
        if (!dependency) throw new Error("此游戏尚未安装 SMAPI。勾选自动配置 SMAPI 后重试，或先从 smapi.io 安装 4.5.2 以上版本。");
        await progress("从 SMAPI 官方 GitHub 下载 4.5.2（约 40 MB）…（仅演示，不下载）", 650);
        await progress("按官方文件步骤配置 SMAPI（仅当前游戏目录）…（仅演示，不写入）", 450);
      }
      await progress("安装农场助手并应用模式与自适应速度…", 600);
      const configuration = validConfiguration({ WorkMode: mode, SpeedCeiling: ceiling });
      throwIfCancelled();
      memory.games[keyFor(path)] = { installed: true, smapi: true, config: configuration, ownedRemainder: false };
      memory.lastPath = canonical(path);
      writeMemory();
      inspectCurrent(false);
      appendLog("浏览器样例：模式 " + MODES[mode].label + "，加速上限 " + ceiling + "，AdaptiveSpeed=true；仅保存在本演示的独立本地状态。");
      appendLog("浏览器样例：安装后检查流程已演示。没有安装真实助手或 SMAPI，没有写入游戏配置。");
      setStatus("配置流程演示完成", sampleDetail("助手 " + MOD_VERSION + " 已记录为已安装。点击“启动游戏”可查看正式入口说明；真实安装未执行。" + (!storageAvailable ? "本浏览器未允许持久保存样例。" : "")));
    } catch (error) {
      if (error.cancelled) {
        inspectCurrent(false);
        setStatus("操作已取消", sampleDetail("样例任务已退出；安装状态未提交，可重新检测后再试。真实游戏文件未修改。"));
        appendLog("浏览器样例：操作取消，安装前样例状态已保留。");
      } else fail("安装配置未完成", error.message);
    } finally { endOperation(); }
  }
  async function uninstall() {
    if (busy || scanning || ui.uninstall.disabled) return;
    const path = ui.path.value.trim();
    const initial = inspect(path);
    beginOperation("正在卸载本助手…", false);
    try {
      requireNotRunning(initial);
      if (!initial || !initial.installed || initial.foreign) throw new Error("无法确认同名目录属于农场助手，未删除任何文件。");
      await progress("卸载已识别的农场助手文件…（仅演示，不删除文件）", 450);
      memory.games[keyFor(path)] = { installed: false, smapi: initial.smapi, config: initial.config || null, ownedRemainder: true };
      memory.lastPath = canonical(path);
      writeMemory();
      inspectCurrent(false);
      appendLog("浏览器样例：助手安装标记已移除，样例配置保留。没有卸载真实助手、删除存档或修改共享 SMAPI。");
      setStatus("卸载流程演示完成", sampleDetail("当前目录的助手样例已移除，可再次一键安装。真实游戏、存档、其他模组和 SMAPI 未操作。"));
    } catch (error) { fail("卸载未完成", error.message); }
    finally { endOperation(); }
  }
  async function launch() {
    if (busy || scanning || ui.launch.disabled) return;
    const result = inspect(ui.path.value.trim());
    beginOperation("正在启动游戏…", false);
    try {
      requireNotRunning(result);
      if (!result || !result.game || !result.smapi || !result.installed) throw new Error("请先完成安装配置，再启动游戏。");
      await delay(300);
      setStatus("浏览器无法启动本机游戏", "请在 Windows 正式配置器中点击“启动游戏”。进入单人存档后 F8 开始 / 暂停，F9 设置；本演示未发送启动请求。");
      appendLog("浏览器样例：正式入口是 StardewModdingAPI.exe；网页没有创建游戏进程，也不假报启动成功。");
    } catch (error) { fail("游戏未能启动", error.message); }
    finally { endOperation(); }
  }

  function openFolderDialog() {
    if (busy || scanning) return;
    const tree = $("sample-folders");
    tree.replaceChildren();
    const shownFixtures = ["ready", "missing-smapi", "foreign", "damaged", "busy"];
    const currentSample = shownFixtures.find(name => keyFor(FIXTURES[name].path) === keyFor(ui.path.value));
    selectedFolder = currentSample || "ready";
    for (const name of shownFixtures) {
      const fixture = FIXTURES[name];
      const label = document.createElement("label");
      label.className = "folder-option";
      const input = document.createElement("input");
      input.type = "radio"; input.name = "sample-folder"; input.value = name; input.checked = name === selectedFolder;
      input.addEventListener("change", () => { selectedFolder = name; $("folder-detail").textContent = "样例：" + fixture.description; });
      const text = document.createElement("span"); text.textContent = fixture.path;
      label.append(input, text); tree.append(label);
    }
    $("folder-detail").textContent = "样例：" + FIXTURES[selectedFolder].description;
    $("folder-dialog").showModal();
  }
  function closeFolderDialog() { $("folder-dialog").close(); }
  function applyFixture(name, mode = "development", ceiling = 200, clearLog = true) {
    if (busy || scanning || !FIXTURES[name]) return false;
    const fixture = FIXTURES[name];
    memory.games[keyFor(fixture.path)] = {
      installed: fixture.installed, smapi: fixture.smapi,
      config: fixture.installed ? validConfiguration({ WorkMode: mode, SpeedCeiling: ceiling }) : null,
      ownedRemainder: false
    };
    ui.path.value = fixture.path;
    ui.preset.value = MODES[mode] ? mode : "development";
    ui.speed.value = Number.isInteger(ceiling) && ceiling >= 1 && ceiling <= 200 ? ceiling : 200;
    lastValidSpeed = Number(ui.speed.value);
    ui.dependency.checked = true;
    updateMode();
    if (clearLog) ui.log.value = "";
    setDetails(false);
    inspectCurrent(true, false);
    return true;
  }
  function updateMode() { $("mode-description").textContent = MODES[ui.preset.value].description; }
  function normalizeSpeed() {
    const text = ui.speed.value.trim();
    const entered = text === "" ? NaN : Number(text);
    if (Number.isFinite(entered)) lastValidSpeed = Math.min(200, Math.max(1, Math.round(entered)));
    ui.speed.value = lastValidSpeed;
    return lastValidSpeed;
  }

  ui.path.addEventListener("input", () => {
    if (busy) return;
    revision++;
    current = null;
    inspectedInput = "";
    updateButtons();
    clearTimeout(pathTimer);
    pathTimer = setTimeout(() => inspectCurrent(true, true), 400);
  });
  ui.preset.addEventListener("change", updateMode);
  ui.dependency.addEventListener("change", () => { updateButtons(); if (!busy && !scanning && current) showDetection(current, true); });
  ui.speed.addEventListener("change", normalizeSpeed);
  ui.speed.addEventListener("blur", normalizeSpeed);
  ui.browse.addEventListener("click", openFolderDialog);
  ui.detect.addEventListener("click", discover);
  ui.install.addEventListener("click", install);
  ui.launch.addEventListener("click", launch);
  ui.uninstall.addEventListener("click", uninstall);
  ui.cancel.addEventListener("click", requestCancel);
  ui.details.addEventListener("click", () => setDetails(!detailsExpanded));
  $("folder-cancel").addEventListener("click", closeFolderDialog);
  $("folder-ok").addEventListener("click", () => { ui.path.value = FIXTURES[selectedFolder].path; clearTimeout(pathTimer); closeFolderDialog(); inspectCurrent(true, true); });
  document.addEventListener("pointerdown", event => { keyboardInApp = $("FarmAssistantManager").contains(event.target); });
  document.addEventListener("focusin", event => { keyboardInApp = $("FarmAssistantManager").contains(event.target); });
  document.addEventListener("keydown", event => {
    if ($("folder-dialog").open) return;
    const unmodified = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
    const inApp = keyboardInApp || $("FarmAssistantManager").contains(event.target);
    if (event.key === "F5" && unmodified && inApp) {
      event.preventDefault();
      if (!busy && !scanning) discover();
      return;
    }
    if (event.key === "Escape" && unmodified && busy && supportsCancellation) { event.preventDefault(); requestCancel(); return; }
    if (event.key === "Enter" && unmodified && !event.defaultPrevented && inApp && !ui.install.disabled) {
      // WinForms AcceptButton applies at form level; controls that consume Enter keep their own action.
      const consumesEnter = event.target.closest("button, textarea, select, a, [contenteditable='true'], [role='button']");
      if (!consumesEnter) { event.preventDefault(); install(); return; }
    }
    if (!event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const access = { b: ui.browse, d: ui.detect, i: ui.install, l: ui.launch, u: ui.uninstall }[event.key.toLowerCase()];
    if (access && !access.disabled) { event.preventDefault(); access.click(); }
  });
  window.addEventListener("pagehide", () => { clearTimeout(pathTimer); revision++; cancelRequested = true; });

  const query = new URLSearchParams(location.search);
  const fixture = query.get("fixture");
  const requestedMode = query.get("mode") || "development";
  const requestedSpeed = Number(query.get("speed") || 200);
  if (fixture && FIXTURES[fixture]) applyFixture(fixture, requestedMode, requestedSpeed);
  else {
    ui.path.value = sampleForPath(memory.lastPath) ? memory.lastPath : DEFAULT_PATH;
    inspectCurrent(true, false);
  }
  updateMode();

  // Local inspection helpers for the APP/HTML comparison harness; never expose real game APIs.
  window.StardewFarmManagerDemo = Object.freeze({
    version: "1.0.0", coreVersion: MOD_VERSION, storageKey: STORAGE_KEY,
    setFixture: applyFixture,
    snapshot: () => ({ busy, scanning, current: current && Object.assign({}, current), mode: ui.preset.value, ceiling: Number(ui.speed.value), autoDependency: ui.dependency.checked, detailsExpanded, statusTitle: ui.title.textContent, statusDetail: ui.detail.textContent, games: JSON.parse(JSON.stringify(memory.games)), storageAvailable }),
    reset: () => { if (busy || scanning) return false; memory = { schema: 1, games: {}, lastPath: "" }; try { localStorage.removeItem(STORAGE_KEY); } catch (_) {} return applyFixture("ready"); },
    useTestTiming: scale => { if (busy || scanning || !Number.isFinite(scale) || scale < 0.01 || scale > 1) return false; timingScale = scale; return true; }
  });
})();
