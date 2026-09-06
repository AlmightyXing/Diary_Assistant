"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const child_process = require("child_process");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const fsSync__namespace = /* @__PURE__ */ _interopNamespaceDefault(fsSync);
let backendProcess = null;
function startBackend() {
  const isPackaged2 = electron.app.isPackaged;
  const backendExePath = isPackaged2 ? path.join(process.resourcesPath, "extraResources", "backend.exe") : path.join(__dirname, "../../backend/dist/backend.exe");
  if (fsSync__namespace.existsSync(backendExePath)) {
    console.log("Starting backend: ", backendExePath);
    backendProcess = child_process.spawn(backendExePath, [], { stdio: "inherit" });
  } else {
    console.warn("Backend executable not found at: ", backendExePath);
  }
}
electron.app.on("will-quit", () => {
  if (backendProcess) {
    try {
      if (process.platform === "win32" && backendProcess.pid) {
        require("child_process").execSync(`taskkill /pid ${backendProcess.pid} /t /f`);
      } else {
        backendProcess.kill();
      }
    } catch (e) {
      console.error("Failed to kill backend:", e);
    }
  }
});
electron.app.setAppUserModelId("DiaryAs");
const isPackaged = electron.app.isPackaged;
const appDataPath = isPackaged ? path.join(process.resourcesPath, "..", "data") : path.join(__dirname, "../../data");
if (!fsSync__namespace.existsSync(appDataPath)) {
  fsSync__namespace.mkdirSync(appDataPath, { recursive: true });
}
const dataPath = path.join(appDataPath, "schedule_data.json");
const templatesPath = path.join(appDataPath, "schedule_templates.json");
const positionsPath = path.join(appDataPath, "widget_positions.json");
if (!fsSync__namespace.existsSync(positionsPath)) {
  fsSync__namespace.writeFileSync(positionsPath, JSON.stringify({}));
}
if (!fsSync__namespace.existsSync(dataPath)) {
  fsSync__namespace.writeFileSync(dataPath, JSON.stringify([]));
}
if (!fsSync__namespace.existsSync(templatesPath)) {
  fsSync__namespace.writeFileSync(templatesPath, JSON.stringify([]));
}
async function getTemplates() {
  const raw = await fs__namespace.readFile(templatesPath, "utf-8");
  return JSON.parse(raw);
}
async function addTemplate(item) {
  const raw = await fs__namespace.readFile(templatesPath, "utf-8");
  const all = JSON.parse(raw);
  item.id = "tpl_" + Date.now().toString();
  all.push(item);
  await fs__namespace.writeFile(templatesPath, JSON.stringify(all, null, 2));
  return item;
}
async function updateTemplate(item) {
  const raw = await fs__namespace.readFile(templatesPath, "utf-8");
  const all = JSON.parse(raw);
  const index = all.findIndex((s) => s.id === item.id);
  if (index !== -1) {
    all[index] = { ...all[index], ...item };
    await fs__namespace.writeFile(templatesPath, JSON.stringify(all, null, 2));
    return all[index];
  }
  return null;
}
async function deleteTemplate(id) {
  const raw = await fs__namespace.readFile(templatesPath, "utf-8");
  let all = JSON.parse(raw);
  all = all.filter((s) => s.id !== id);
  await fs__namespace.writeFile(templatesPath, JSON.stringify(all, null, 2));
  return true;
}
async function getSchedules(date) {
  const rawSchedules = await fs__namespace.readFile(dataPath, "utf-8");
  const allSchedules = JSON.parse(rawSchedules);
  const schedulesForDate = allSchedules.filter((s) => s.date === date && !s.deleted);
  const rawTemplates = await fs__namespace.readFile(templatesPath, "utf-8");
  const allTemplates = JSON.parse(rawTemplates);
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const dateNum = d.getDate();
  const generatedSchedules = [];
  for (const tpl of allTemplates) {
    let match = false;
    if (tpl.ruleType === "daily") {
      match = true;
    } else if (tpl.ruleType === "weekly") {
      const days = tpl.ruleValue ? tpl.ruleValue.split(",").map(Number) : [];
      if (days.includes(dayOfWeek)) match = true;
    } else if (tpl.ruleType === "monthly") {
      const dates = tpl.ruleValue ? tpl.ruleValue.split(",").map(Number) : [];
      if (dates.includes(dateNum)) match = true;
    }
    if (match) {
      const existing = allSchedules.find((s) => s.date === date && s.templateId === tpl.id);
      if (!existing) {
        generatedSchedules.push({
          id: "gen_" + tpl.id + "_" + date,
          templateId: tpl.id,
          date,
          title: tpl.title,
          description: tpl.description,
          importance: tpl.importance,
          type: tpl.type,
          isGenerated: true
        });
      }
    }
  }
  const importanceValues = {
    "必要": 1,
    "重要": 2,
    "次要": 3
  };
  return [...schedulesForDate, ...generatedSchedules].sort((a, b) => {
    const valA = importanceValues[a.importance] || 4;
    const valB = importanceValues[b.importance] || 4;
    return valA - valB;
  });
}
async function addSchedule(item) {
  const raw = await fs__namespace.readFile(dataPath, "utf-8");
  const all = JSON.parse(raw);
  item.id = Date.now().toString();
  all.push(item);
  await fs__namespace.writeFile(dataPath, JSON.stringify(all, null, 2));
  return item;
}
async function updateSchedule(item) {
  const raw = await fs__namespace.readFile(dataPath, "utf-8");
  const all = JSON.parse(raw);
  const index = all.findIndex((s) => s.id === item.id);
  if (index !== -1) {
    all[index] = { ...all[index], ...item, isGenerated: false };
    await fs__namespace.writeFile(dataPath, JSON.stringify(all, null, 2));
    return all[index];
  } else if (item.id && item.id.startsWith("gen_")) {
    const newItem = { ...item, isGenerated: false };
    all.push(newItem);
    await fs__namespace.writeFile(dataPath, JSON.stringify(all, null, 2));
    return newItem;
  }
  return null;
}
async function deleteSchedule(id) {
  const raw = await fs__namespace.readFile(dataPath, "utf-8");
  let all = JSON.parse(raw);
  const index = all.findIndex((s) => s.id === id);
  if (index !== -1) {
    if (all[index].templateId) {
      all[index].deleted = true;
    } else {
      all.splice(index, 1);
    }
  } else if (id.startsWith("gen_")) {
    const parts = id.split("_");
    const templateId = parts[1];
    const date = parts.slice(2).join("_");
    all.push({
      id,
      templateId,
      date,
      deleted: true
    });
  }
  await fs__namespace.writeFile(dataPath, JSON.stringify(all, null, 2));
  return true;
}
let win = null;
let widgetWin = null;
let calendarWidgetWin = null;
function saveWidgetPositions() {
  const pos = {};
  if (widgetWin && !widgetWin.isDestroyed()) {
    pos.health = widgetWin.getPosition();
  }
  if (calendarWidgetWin && !calendarWidgetWin.isDestroyed()) {
    pos.calendar = calendarWidgetWin.getPosition();
  }
  try {
    const raw = fsSync__namespace.readFileSync(positionsPath, "utf-8");
    const existing = JSON.parse(raw);
    fsSync__namespace.writeFileSync(positionsPath, JSON.stringify({ ...existing, ...pos }, null, 2));
  } catch (e) {
  }
}
function loadWidgetPositions() {
  try {
    const raw = fsSync__namespace.readFileSync(positionsPath, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}
function createWidgetWindow() {
  if (widgetWin) return;
  widgetWin = new electron.BrowserWindow({
    width: 250,
    height: 110,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  const pos = loadWidgetPositions();
  if (pos.health) {
    widgetWin.setPosition(pos.health[0], pos.health[1]);
  } else {
    const primaryDisplay = electron.screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    widgetWin.setPosition(width - 260, 20);
  }
  if (process.env.VITE_DEV_SERVER_URL) {
    widgetWin.loadURL(process.env.VITE_DEV_SERVER_URL + "#/widget");
  } else {
    widgetWin.loadFile(path.join(__dirname, "../dist/index.html"), { hash: "widget" });
  }
  widgetWin.on("moved", () => saveWidgetPositions());
  widgetWin.on("closed", () => {
    widgetWin = null;
  });
  widgetWin.on("focus", () => {
    widgetWin == null ? void 0 : widgetWin.setAlwaysOnTop(true);
  });
  widgetWin.on("blur", () => {
    widgetWin == null ? void 0 : widgetWin.setAlwaysOnTop(false);
  });
}
function createCalendarWidgetWindow() {
  if (calendarWidgetWin) return;
  calendarWidgetWin = new electron.BrowserWindow({
    width: 250,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  const pos = loadWidgetPositions();
  if (pos.calendar) {
    calendarWidgetWin.setPosition(pos.calendar[0], pos.calendar[1]);
  } else {
    const primaryDisplay = electron.screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    calendarWidgetWin.setPosition(width - 260, 150);
  }
  if (process.env.VITE_DEV_SERVER_URL) {
    calendarWidgetWin.loadURL(process.env.VITE_DEV_SERVER_URL + "#/calendar-widget");
  } else {
    calendarWidgetWin.loadFile(path.join(__dirname, "../dist/index.html"), { hash: "calendar-widget" });
  }
  calendarWidgetWin.on("moved", () => saveWidgetPositions());
  calendarWidgetWin.on("closed", () => {
    calendarWidgetWin = null;
  });
  calendarWidgetWin.on("focus", () => {
    calendarWidgetWin == null ? void 0 : calendarWidgetWin.setAlwaysOnTop(true);
  });
  calendarWidgetWin.on("blur", () => {
    calendarWidgetWin == null ? void 0 : calendarWidgetWin.setAlwaysOnTop(false);
  });
}
async function getScheduleDates() {
  const rawSchedules = await fs__namespace.readFile(dataPath, "utf-8");
  const allSchedules = JSON.parse(rawSchedules);
  const dates = allSchedules.filter((s) => !s.deleted && !s.isGenerated).map((s) => s.date);
  return Array.from(new Set(dates));
}
let tray = null;
function setupTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, "../dist/icons/Calendar.png");
  tray = new electron.Tray(iconPath);
  tray.setToolTip("Diary Assistant");
  const contextMenu = electron.Menu.buildFromTemplate([
    { label: "打开主界面", click: () => {
      if (win) {
        win.show();
        win.focus();
      } else {
        createWindow();
      }
    } },
    { type: "separator" },
    { label: "退出应用", click: () => {
      electron.app.quit();
    } }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (win) {
      win.show();
      win.focus();
    } else {
      createWindow();
    }
  });
}
function createWindow() {
  win = new electron.BrowserWindow({
    width: 1024,
    height: 768,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}
electron.app.whenReady().then(() => {
  startBackend();
  electron.ipcMain.handle("get-templates", getTemplates);
  electron.ipcMain.handle("add-template", (_, item) => addTemplate(item));
  electron.ipcMain.handle("update-template", (_, item) => updateTemplate(item));
  electron.ipcMain.handle("delete-template", (_, id) => deleteTemplate(id));
  electron.ipcMain.handle("get-schedules", (_, date) => getSchedules(date));
  electron.ipcMain.handle("add-schedule", (_, item) => addSchedule(item));
  electron.ipcMain.handle("update-schedule", (_, item) => updateSchedule(item));
  electron.ipcMain.handle("delete-schedule", (_, id) => deleteSchedule(id));
  electron.ipcMain.handle("get-schedule-dates", () => getScheduleDates());
  electron.ipcMain.on("window-minimize", (event) => {
    const webContents = event.sender;
    const win2 = electron.BrowserWindow.fromWebContents(webContents);
    win2 == null ? void 0 : win2.minimize();
  });
  electron.ipcMain.on("window-close", async (event) => {
    const webContents = event.sender;
    const currentWin = electron.BrowserWindow.fromWebContents(webContents);
    if (currentWin === win) {
      const { response } = await electron.dialog.showMessageBox(currentWin, {
        type: "question",
        buttons: ["隐藏至后台", "退出应用", "取消"],
        title: "退出确认",
        message: `您要关闭应用还是将其隐藏至后台？
(隐藏至后台时，桌面小组件将继续运行，且可以通过状态栏图标恢复)`
      });
      if (response === 0) {
        setupTray();
        currentWin == null ? void 0 : currentWin.hide();
      } else if (response === 1) {
        electron.app.quit();
      }
    } else {
      currentWin == null ? void 0 : currentWin.close();
    }
  });
  electron.ipcMain.on("wake-up-main", (_, tab) => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      win.webContents.send("navigate-to", tab);
    } else {
      createWindow();
      if (win) {
        win.webContents.once("did-finish-load", () => {
          setTimeout(() => {
            if (win && !win.isDestroyed()) {
              win.webContents.send("navigate-to", tab);
            }
          }, 500);
        });
      }
    }
  });
  electron.ipcMain.on("toggle-widget", (_, enabled) => {
    if (enabled) {
      createWidgetWindow();
      createCalendarWidgetWindow();
    } else {
      if (widgetWin) widgetWin.close();
      if (calendarWidgetWin) calendarWidgetWin.close();
    }
  });
  electron.ipcMain.on("set-widget-click-through", (_, through) => {
    if (widgetWin) widgetWin.setIgnoreMouseEvents(through, { forward: true });
    if (calendarWidgetWin) calendarWidgetWin.setIgnoreMouseEvents(through, { forward: true });
  });
  electron.ipcMain.on("set-widget-click-through", (_, through) => {
    if (widgetWin) {
      widgetWin.setIgnoreMouseEvents(through, { forward: true });
    }
  });
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
