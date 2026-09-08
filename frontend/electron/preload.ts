import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getSchedules: (date: string) => ipcRenderer.invoke('get-schedules', date),
  addSchedule: (item: any) => ipcRenderer.invoke('add-schedule', item),
  getTemplates: () => ipcRenderer.invoke('get-templates'),
  addTemplate: (item: any) => ipcRenderer.invoke('add-template', item),
  updateTemplate: (item: any) => ipcRenderer.invoke('update-template', item),
  deleteTemplate: (id: string) => ipcRenderer.invoke('delete-template', id),
  updateSchedule: (item: any) => ipcRenderer.invoke('update-schedule', item),
  deleteSchedule: (id: string) => ipcRenderer.invoke('delete-schedule', id),
  getScheduleDates: () => ipcRenderer.invoke('get-schedule-dates'),
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  wakeUpMain: (tab: string) => ipcRenderer.send('wake-up-main', tab),
  onNavigateTo: (callback: (tab: string) => void) => {
    ipcRenderer.removeAllListeners('navigate-to');
    ipcRenderer.on('navigate-to', (_, tab) => callback(tab));
  },
  toggleHealthWidget: (enabled: boolean) => ipcRenderer.send('toggle-health-widget', enabled),
  toggleCalendarWidget: (enabled: boolean) => ipcRenderer.send('toggle-calendar-widget', enabled),
  setWidgetClickThrough: (through: boolean) => ipcRenderer.send('set-widget-click-through', through)
})
