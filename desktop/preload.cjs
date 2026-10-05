const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('escuchaDesktop', Object.freeze({
  driveStatus: () => ipcRenderer.invoke('desktop:drive-status'),
  chooseConsentFolder: owner => typeof owner === 'string' && owner.length === 36 ? ipcRenderer.invoke('desktop:consent-folder', owner) : Promise.reject(new Error('Cuenta inválida.')),
  synchronizationStatus: () => ipcRenderer.invoke('desktop:sync-status'),
  connectSynchronization: () => ipcRenderer.invoke('desktop:sync-connect'),
  publishSynchronization: () => ipcRenderer.invoke('desktop:sync-publish'),
  receiveSynchronization: id => typeof id === 'string' && id.length === 36 ? ipcRenderer.invoke('desktop:sync-receive', id) : Promise.reject(new Error('Versión inválida.')),
  disconnectSynchronization: () => ipcRenderer.invoke('desktop:sync-disconnect'),
}));
