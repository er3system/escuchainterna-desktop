const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('escuchaDesktop', Object.freeze({
  savePdf: name => name === undefined || (typeof name === 'string' && name.length <= 240) ? ipcRenderer.invoke('desktop:save-pdf', name) : Promise.reject(new Error('Nombre de documento inválido.')),
  recoverLocalAccount: email => typeof email === 'string' && email.length <= 254 ? ipcRenderer.invoke('desktop:recover-account', email) : Promise.reject(new Error('Correo inválido.')),
  driveStatus: () => ipcRenderer.invoke('desktop:drive-status'),
  chooseConsentFolder: owner => typeof owner === 'string' && owner.length === 36 ? ipcRenderer.invoke('desktop:consent-folder', owner) : Promise.reject(new Error('Cuenta inválida.')),
  synchronizationStatus: () => ipcRenderer.invoke('desktop:sync-status'),
  connectSynchronization: () => ipcRenderer.invoke('desktop:sync-connect'),
  publishSynchronization: () => ipcRenderer.invoke('desktop:sync-publish'),
  receiveSynchronization: id => typeof id === 'string' && id.length === 36 ? ipcRenderer.invoke('desktop:sync-receive', id) : Promise.reject(new Error('Versión inválida.')),
  disconnectSynchronization: () => ipcRenderer.invoke('desktop:sync-disconnect'),
}));
