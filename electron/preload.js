const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('processcapture', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  startRecording: (opts) => ipcRenderer.invoke('recording:start', opts),
  stopRecording: () => ipcRenderer.invoke('recording:stop'),
  processRecording: (opts) => ipcRenderer.invoke('recording:process', opts),
  listRecordings: () => ipcRenderer.invoke('recordings:list'),
  getReport: (opts) => ipcRenderer.invoke('recordings:get-report', opts),
  onProgress: (callback) => ipcRenderer.on('processing:progress', (_, data) => callback(data)),
});