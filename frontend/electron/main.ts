import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, screen } from 'electron'
import { join } from 'path'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import { spawn, ChildProcess } from 'child_process'
let backendProcess: ChildProcess | null = null

function startBackend() {
  const isPackaged = app.isPackaged
  const backendExePath = isPackaged
    ? join(process.resourcesPath, 'extraResources', 'backend.exe')
    : join(__dirname, '../../backend/dist/backend.exe') // wait, for dev we usually start it manually. We can just check if it exists.
    
  if (fsSync.existsSync(backendExePath)) {
    console.log('Starting backend: ', backendExePath)
    backendProcess = spawn(backendExePath, [], { stdio: 'inherit' })
  } else {
    console.warn('Backend executable not found at: ', backendExePath)
  }
}

app.on('will-quit', () => {
  if (backendProcess) {
    try {
      if (process.platform === 'win32' && backendProcess.pid) {
        require('child_process').execSync(`taskkill /pid ${backendProcess.pid} /t /f`)
      } else {
        backendProcess.kill()
      }
    } catch (e) {
      console.error('Failed to kill backend:', e)
    }
  }
})

// 强制设置一个全新的 AppUserModelId，绕过之前的通知拦截
app.setAppUserModelId('DiaryAs')

const isPackaged = app.isPackaged
const appDataPath = isPackaged 
    ? join(process.resourcesPath, '..', 'data') 
    : join(__dirname, '../../data')

if (!fsSync.existsSync(appDataPath)) {
    fsSync.mkdirSync(appDataPath, { recursive: true })
}

const dataPath = join(appDataPath, 'schedule_data.json')
const templatesPath = join(appDataPath, 'schedule_templates.json')
const positionsPath = join(appDataPath, 'widget_positions.json')
if (!fsSync.existsSync(positionsPath)) {
  fsSync.writeFileSync(positionsPath, JSON.stringify({}))
}



// Ensure data files exist
if (!fsSync.existsSync(dataPath)) {
  fsSync.writeFileSync(dataPath, JSON.stringify([]))
}
if (!fsSync.existsSync(templatesPath)) {
  fsSync.writeFileSync(templatesPath, JSON.stringify([]))
}

// ---- Templates ----
async function getTemplates() {
  const raw = await fs.readFile(templatesPath, 'utf-8')
  return JSON.parse(raw)
}

async function addTemplate(item: any) {
  const raw = await fs.readFile(templatesPath, 'utf-8')
  const all = JSON.parse(raw)
  item.id = 'tpl_' + Date.now().toString()
  all.push(item)
  await fs.writeFile(templatesPath, JSON.stringify(all, null, 2))
  return item
}

async function updateTemplate(item: any) {
  const raw = await fs.readFile(templatesPath, 'utf-8')
  const all = JSON.parse(raw)
  const index = all.findIndex((s: any) => s.id === item.id)
  if (index !== -1) {
    all[index] = { ...all[index], ...item }
    await fs.writeFile(templatesPath, JSON.stringify(all, null, 2))
    return all[index]
  }
  return null
}

async function deleteTemplate(id: string) {
  const raw = await fs.readFile(templatesPath, 'utf-8')
  let all = JSON.parse(raw)
  all = all.filter((s: any) => s.id !== id)
  await fs.writeFile(templatesPath, JSON.stringify(all, null, 2))
  return true
}

// ---- Schedules ----
async function getSchedules(date: string) {
  const rawSchedules = await fs.readFile(dataPath, 'utf-8')
  const allSchedules = JSON.parse(rawSchedules)
  const schedulesForDate = allSchedules.filter((s: any) => s.date === date && !s.deleted)

  const rawTemplates = await fs.readFile(templatesPath, 'utf-8')
  const allTemplates = JSON.parse(rawTemplates)

  const d = new Date(date)
  const dayOfWeek = d.getDay() // 0 is Sunday, 1 is Monday...
  const dateNum = d.getDate()

  const generatedSchedules = []
  
  for (const tpl of allTemplates) {
    let match = false
    if (tpl.ruleType === 'daily') {
      match = true
    } else if (tpl.ruleType === 'weekly') {
      const days = tpl.ruleValue ? tpl.ruleValue.split(',').map(Number) : []
      if (days.includes(dayOfWeek)) match = true
    } else if (tpl.ruleType === 'monthly') {
      const dates = tpl.ruleValue ? tpl.ruleValue.split(',').map(Number) : []
      if (dates.includes(dateNum)) match = true
    }

    if (match) {
      const existing = allSchedules.find((s: any) => s.date === date && s.templateId === tpl.id)
      if (!existing) {
        generatedSchedules.push({
          id: 'gen_' + tpl.id + '_' + date,
          templateId: tpl.id,
          date: date,
          title: tpl.title,
          description: tpl.description,
          importance: tpl.importance,
          type: tpl.type,
          isGenerated: true
        })
      }
    }
  }

  const importanceValues: Record<string, number> = {
    '必要': 1,
    '重要': 2,
    '次要': 3
  };

  return [...schedulesForDate, ...generatedSchedules].sort((a: any, b: any) => {
    const valA = importanceValues[a.importance] || 4;
    const valB = importanceValues[b.importance] || 4;
    return valA - valB;
  })
}

async function addSchedule(item: any) {
  const raw = await fs.readFile(dataPath, 'utf-8')
  const all = JSON.parse(raw)
  item.id = Date.now().toString()
  all.push(item)
  await fs.writeFile(dataPath, JSON.stringify(all, null, 2))
  return item
}

async function updateSchedule(item: any) {
  const raw = await fs.readFile(dataPath, 'utf-8')
  const all = JSON.parse(raw)
  const index = all.findIndex((s: any) => s.id === item.id)
  
  if (index !== -1) {
    all[index] = { ...all[index], ...item, isGenerated: false }
    await fs.writeFile(dataPath, JSON.stringify(all, null, 2))
    return all[index]
  } else if (item.id && item.id.startsWith('gen_')) {
    const newItem = { ...item, isGenerated: false }
    all.push(newItem)
    await fs.writeFile(dataPath, JSON.stringify(all, null, 2))
    return newItem
  }
  return null
}

async function deleteSchedule(id: string) {
  const raw = await fs.readFile(dataPath, 'utf-8')
  let all = JSON.parse(raw)
  
  const index = all.findIndex((s: any) => s.id === id)
  if (index !== -1) {
    if (all[index].templateId) {
       all[index].deleted = true
    } else {
       all.splice(index, 1)
    }
  } else if (id.startsWith('gen_')) {
    const parts = id.split('_')
    const templateId = parts[1]
    const date = parts.slice(2).join('_')
    all.push({
      id: id,
      templateId: templateId,
      date: date,
      deleted: true
    })
  }
  await fs.writeFile(dataPath, JSON.stringify(all, null, 2))
  return true
}

let win: BrowserWindow | null = null

let widgetWin: BrowserWindow | null = null
let calendarWidgetWin: BrowserWindow | null = null

function saveWidgetPositions() {
  const pos: any = {};
  if (widgetWin && !widgetWin.isDestroyed()) {
    pos.health = widgetWin.getPosition();
  }
  if (calendarWidgetWin && !calendarWidgetWin.isDestroyed()) {
    pos.calendar = calendarWidgetWin.getPosition();
  }
  try {
    const raw = fsSync.readFileSync(positionsPath, 'utf-8');
    const existing = JSON.parse(raw);
    fsSync.writeFileSync(positionsPath, JSON.stringify({ ...existing, ...pos }, null, 2));
  } catch (e) {}
}

function loadWidgetPositions() {
  try {
    const raw = fsSync.readFileSync(positionsPath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function createWidgetWindow() {
  if (widgetWin) return;
  widgetWin = new BrowserWindow({
    width: 250,
    height: 110,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  const pos = loadWidgetPositions();
  if (pos.health) {
    widgetWin.setPosition(pos.health[0], pos.health[1]);
  } else {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    widgetWin.setPosition(width - 260, 20);
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    widgetWin.loadURL(process.env.VITE_DEV_SERVER_URL + '#/widget');
  } else {
    widgetWin.loadFile(join(__dirname, '../dist/index.html'), { hash: 'widget' });
  }

  widgetWin.on('moved', () => saveWidgetPositions());
  widgetWin.on('closed', () => { widgetWin = null; });
  widgetWin.on('focus', () => { widgetWin?.setAlwaysOnTop(true); });
  widgetWin.on('blur', () => { widgetWin?.setAlwaysOnTop(false); });
}

function createCalendarWidgetWindow() {
  if (calendarWidgetWin) return;
  calendarWidgetWin = new BrowserWindow({
    width: 250,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  const pos = loadWidgetPositions();
  if (pos.calendar) {
    calendarWidgetWin.setPosition(pos.calendar[0], pos.calendar[1]);
  } else {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    calendarWidgetWin.setPosition(width - 260, 150);
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    calendarWidgetWin.loadURL(process.env.VITE_DEV_SERVER_URL + '#/calendar-widget');
  } else {
    calendarWidgetWin.loadFile(join(__dirname, '../dist/index.html'), { hash: 'calendar-widget' });
  }

  calendarWidgetWin.on('moved', () => saveWidgetPositions());
  calendarWidgetWin.on('closed', () => { calendarWidgetWin = null; });
  calendarWidgetWin.on('focus', () => { calendarWidgetWin?.setAlwaysOnTop(true); });
  calendarWidgetWin.on('blur', () => { calendarWidgetWin?.setAlwaysOnTop(false); });
}
async function getScheduleDates() {
  const rawSchedules = await fs.readFile(dataPath, 'utf-8')
  const allSchedules = JSON.parse(rawSchedules)
  const dates = allSchedules.filter((s: any) => !s.deleted && !s.isGenerated).map((s: any) => s.date)
  return Array.from(new Set(dates))
}


let tray: Tray | null = null

function setupTray() {
  if (tray) return
  const iconPath = join(__dirname, '../dist/icons/Calendar.png')
    
  tray = new Tray(iconPath)
  tray.setToolTip('Diary Assistant')
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开主界面', click: () => { if (win) { win.show(); win.focus() } else { createWindow() } } },
    { type: 'separator' },
    { label: '退出应用', click: () => { app.quit() } }
  ])
  tray.setContextMenu(contextMenu)
  
  tray.on('click', () => {
    if (win) {
      win.show()
      win.focus()
    } else {
      createWindow()
    }
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    frame: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    // win.webContents.openDevTools() // 注释掉，避免每次启动都弹出开发者工具并报 Autofill.enable 错误
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  startBackend()
  ipcMain.handle('get-templates', getTemplates)
  ipcMain.handle('add-template', (_, item) => addTemplate(item))
  ipcMain.handle('update-template', (_, item) => updateTemplate(item))
  ipcMain.handle('delete-template', (_, id) => deleteTemplate(id))

  ipcMain.handle('get-schedules', (_, date) => getSchedules(date))
  ipcMain.handle('add-schedule', (_, item) => addSchedule(item))
  ipcMain.handle('update-schedule', (_, item) => updateSchedule(item))
  ipcMain.handle('delete-schedule', (_, id) => deleteSchedule(id))
  ipcMain.handle('get-schedule-dates', () => getScheduleDates())

  ipcMain.on('window-minimize', (event) => {
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)
    win?.minimize()
  })
  
  ipcMain.on('window-close', async (event) => {
    const webContents = event.sender
    const currentWin = BrowserWindow.fromWebContents(webContents)
    if (currentWin === win) {
      const { response } = await dialog.showMessageBox(currentWin!, {
        type: 'question',
        buttons: ['隐藏至后台', '退出应用', '取消'],
        title: '退出确认',
        message: `您要关闭应用还是将其隐藏至后台？\n(隐藏至后台时，桌面小组件将继续运行，且可以通过状态栏图标恢复)`
      })
      if (response === 0) {
        setupTray()
        currentWin?.hide()
      } else if (response === 1) {
        app.quit()
      }
    } else {
      currentWin?.close()
    }
  })

  ipcMain.on('wake-up-main', (_, tab) => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      win.webContents.send('navigate-to', tab);
    } else {
      createWindow();
      if (win) {
        win.webContents.once('did-finish-load', () => {
          setTimeout(() => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('navigate-to', tab);
            }
          }, 500);
        });
      }
    }
  });


  ipcMain.on('toggle-widget', (_, enabled) => {
    if (enabled) {
      createWidgetWindow();
      createCalendarWidgetWindow();
    } else {
      if (widgetWin) widgetWin.close();
      if (calendarWidgetWin) calendarWidgetWin.close();
    }
  });

  ipcMain.on('set-widget-click-through', (_, through) => {
    if (widgetWin) widgetWin.setIgnoreMouseEvents(through, { forward: true });
    if (calendarWidgetWin) calendarWidgetWin.setIgnoreMouseEvents(through, { forward: true });
  });

  ipcMain.on('set-widget-click-through', (_, through) => {
    if (widgetWin) {
      widgetWin.setIgnoreMouseEvents(through, { forward: true });
    }
  });

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
