const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('backupPassword', Object.freeze({
  submit: value => { if (typeof value === 'string' && value.length <= 1024) ipcRenderer.send('desktop:backup-password', value); },
  cancel: () => ipcRenderer.send('desktop:backup-password', null),
}));
