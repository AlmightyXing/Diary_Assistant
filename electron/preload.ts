import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getSchedules: (date: string) => ipcRenderer.invoke('get-schedules', date),
  addSchedule: (item: any) => ipcRenderer.invoke('add-schedule', item),
  updateSchedule: (item: any) => ipcRenderer.invoke('update-schedule', item),
  deleteSchedule: (id: string) => ipcRenderer.invoke('delete-schedule', id)
})
