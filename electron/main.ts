import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'

const dataPath = join(app.getPath('userData'), 'schedule_data.json')

// Ensure data file exists
if (!fsSync.existsSync(dataPath)) {
  fsSync.writeFileSync(dataPath, JSON.stringify([]))
}

async function getSchedules(date: string) {
  const raw = await fs.readFile(dataPath, 'utf-8')
  const all = JSON.parse(raw)
  return all.filter((s: any) => s.date === date)
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
    all[index] = { ...all[index], ...item }
    await fs.writeFile(dataPath, JSON.stringify(all, null, 2))
    return all[index]
  }
  return null
}

async function deleteSchedule(id: string) {
  const raw = await fs.readFile(dataPath, 'utf-8')
  let all = JSON.parse(raw)
  all = all.filter((s: any) => s.id !== id)
  await fs.writeFile(dataPath, JSON.stringify(all, null, 2))
  return true
}

let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('get-schedules', (_, date) => getSchedules(date))
  ipcMain.handle('add-schedule', (_, item) => addSchedule(item))
  ipcMain.handle('update-schedule', (_, item) => updateSchedule(item))
  ipcMain.handle('delete-schedule', (_, id) => deleteSchedule(id))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
