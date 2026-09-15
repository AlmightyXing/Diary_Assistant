import { app, BrowserWindow, net, ipcMain, dialog, Tray, Menu, screen } from 'electron'
import { join } from 'path'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import { spawn, ChildProcess } from 'child_process'
let backendProcess: ChildProcess | null = null

function startBackend() {
  const isPackaged = app.isPackaged
  
  if (!isPackaged) {
    const pythonExe = join(__dirname, '../../backend/venv/Scripts/python.exe')
    const mainPy = join(__dirname, '../../backend/main.py')
    console.log('Starting backend via python source: ', mainPy)
    
    const logsFolder = join(__dirname, '../../logs')
    if (!fsSync.existsSync(logsFolder)) {
      fsSync.mkdirSync(logsFolder, { recursive: true })
    }
    const logFile = join(logsFolder, 'backend.log')
    const logStream = fsSync.createWriteStream(logFile, { flags: 'a' })
    const timestamp = new Date().toISOString()
    logStream.write(`\n\n--- Backend Started at ${timestamp} (DEV MODE) ---\n`)
    
    backendProcess = spawn(pythonExe, [mainPy], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    if (backendProcess.stdout) {
      backendProcess.stdout.on('data', (data) => logStream.write(data))
    }
    if (backendProcess.stderr) {
      backendProcess.stderr.on('data', (data) => logStream.write(data))
    }
    return;
  }
  
  const backendExePath = isPackaged
    ? join(process.resourcesPath, 'extraResources', 'backend.exe')
    : join(__dirname, '../../backend/dist/backend.exe')
    
  if (fsSync.existsSync(backendExePath)) {
    console.log('Starting backend: ', backendExePath)
    
    // 配置 logs 文件夹路径
    const logsFolder = isPackaged
      ? join(require('path').dirname(app.getPath('exe')), 'logs')
      : join(__dirname, '../../logs')
      
    if (!fsSync.existsSync(logsFolder)) {
      fsSync.mkdirSync(logsFolder, { recursive: true })
    }
    
    const logFile = join(logsFolder, 'backend.log')
    const logStream = fsSync.createWriteStream(logFile, { flags: 'a' })
    const timestamp = new Date().toISOString()
    logStream.write(`

--- Backend Started at ${timestamp} ---
`)

    backendProcess = spawn(backendExePath, [], { 
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'] 
    })
    
    if (backendProcess.stdout) {
      backendProcess.stdout.pipe(logStream)
    }
    if (backendProcess.stderr) {
      backendProcess.stderr.pipe(logStream)
    }
    
    backendProcess.on('error', (err) => {
      logStream.write(`
Failed to start backend: ${err.message}
`)
    })
    backendProcess.on('close', (code) => {
      logStream.write(`
Backend process exited with code ${code}
`)
    })
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
    pos.health = widgetWin.getBounds();
  }
  if (calendarWidgetWin && !calendarWidgetWin.isDestroyed()) {
    pos.calendar = calendarWidgetWin.getBounds();
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
      backgroundThrottling: false,
    }
  });

  const pos = loadWidgetPositions();
  if (pos.health) {
    widgetWin.setBounds(pos.health);
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
      backgroundThrottling: false,
    }
  });

  const pos = loadWidgetPositions();
  if (pos.calendar) {
    calendarWidgetWin.setBounds(pos.calendar);
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


// --- Main Process Health Polling ---
let flashWin: BrowserWindow | null = null;
let notifiedEye = false;
let prevPhase: string | null = null;

function triggerFlashAndBeep(color: string = 'green') {
  if (flashWin && !flashWin.isDestroyed()) return;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.bounds;
  flashWin = new BrowserWindow({
    x, y, width, height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    webPreferences: { nodeIntegration: false }
  });
  flashWin.setIgnoreMouseEvents(true, { forward: true });
  flashWin.setAlwaysOnTop(true, 'screen-saver', 1);

  const rgb = color === 'yellow' ? '255, 255, 0' : '0, 255, 0';

  const html = `
    <html>
      <head>
        <style>
          body {
            margin: 0; padding: 0; overflow: hidden; background: transparent;
            box-sizing: border-box;
            border: 20px solid rgba(${rgb}, 0);
            animation: breathe 1s infinite alternate;
          }
          @keyframes breathe {
            0% { border-color: rgba(${rgb}, 0.1); box-shadow: inset 0 0 50px rgba(${rgb}, 0.1); }
            100% { border-color: rgba(${rgb}, 0.8); box-shadow: inset 0 0 100px rgba(${rgb}, 0.6); }
          }
        </style>
      </head>
      <body>
        <script>
          const playAlarmBeep = () => {
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              
              // Modified to a softer sine wave chime instead of harsh square wave
              osc.type = 'sine';
              osc.frequency.setValueAtTime(600, ctx.currentTime);
              gain.gain.setValueAtTime(0, ctx.currentTime);
              gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
              gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.6);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);

              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 1.3);
            } catch(e) { console.error("Audio play failed", e); }
          };
          playAlarmBeep();
        </script>
      </body>
    </html>
  `;
  flashWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  
  setTimeout(() => {
    if (flashWin && !flashWin.isDestroyed()) {
      flashWin.close();
      flashWin = null;
    }
  }, 8500);
}

function handleHealthStatus(data: any) {
  if (prevPhase && prevPhase !== data.sedentary.phase) {
    if (prevPhase === 'sedentary' && data.sedentary.phase === 'exercise') {
      triggerFlashAndBeep('yellow');
    }
    // Exercise ending (exercise -> sedentary) no longer flashes
  }
  prevPhase = data.sedentary.phase;

  if (data.eye_care.time_left === 0 && !notifiedEye) {
    triggerFlashAndBeep('green');
    notifiedEye = true;
    
    const req = net.request({
      method: 'POST',
      url: 'http://127.0.0.1:8000/health/refresh'
    });
    req.setHeader('Content-Type', 'application/json');
    req.write(JSON.stringify({ timer_type: 'eye_care' }));
    req.end();
  } else if (data.eye_care.time_left > 0) {
    notifiedEye = false;
  }
}

function pollHealth() {
  const request = net.request('http://127.0.0.1:8000/health/status');
  request.on('response', (response) => {
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => {
      try {
        const status = JSON.parse(data);
        handleHealthStatus(status);
      } catch(e) {}
    });
  });
  request.on('error', () => {});
  request.end();
}

// Start polling
setInterval(pollHealth, 1000);

function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    frame: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
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
    
  createWindow()
;
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


  ipcMain.on('toggle-health-widget', (_, enabled) => {
    if (enabled) {
      createWidgetWindow();
    } else {
      if (widgetWin) widgetWin.close();
    }
  });

  ipcMain.on('toggle-calendar-widget', (_, enabled) => {
    if (enabled) {
      createCalendarWidgetWindow();
    } else {
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
