"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  getSchedules: (date) => electron.ipcRenderer.invoke("get-schedules", date),
  addSchedule: (item) => electron.ipcRenderer.invoke("add-schedule", item),
  getTemplates: () => electron.ipcRenderer.invoke("get-templates"),
  addTemplate: (item) => electron.ipcRenderer.invoke("add-template", item),
  updateTemplate: (item) => electron.ipcRenderer.invoke("update-template", item),
  deleteTemplate: (id) => electron.ipcRenderer.invoke("delete-template", id),
  updateSchedule: (item) => electron.ipcRenderer.invoke("update-schedule", item),
  deleteSchedule: (id) => electron.ipcRenderer.invoke("delete-schedule", id),
  minimize: () => electron.ipcRenderer.send("window-minimize"),
  close: () => electron.ipcRenderer.send("window-close")
});
