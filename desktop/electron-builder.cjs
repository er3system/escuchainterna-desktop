module.exports = {
  appId: 'com.escuchainterna.desktop', productName: 'EscuchaInterna',
  directories: { app: 'desktop', output: 'release' },
  electronVersion: require('../package.json').devDependencies.electron,
  asar: true, npmRebuild: false,
  files: ['main.cjs', 'runtime.cjs', 'security.cjs', 'storage.cjs', 'synchronization.cjs', 'drive.cjs', 'consent-folder.cjs', 'preload.cjs', 'password*', 'package.json', '!node_modules/**'],
  extraResources: [
    { from: '.desktop-build/resources', to: '.', filter: ['**/*', '!**/.env*', '!**/*.db', '!**/*.db-wal', '!**/*.db-shm', '!**/uploads/**'] },
    { from: 'LICENSE', to: 'LICENSE' },
    { from: 'THIRD_PARTY_NOTICES.md', to: 'THIRD_PARTY_NOTICES.md' },
  ],
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'public/icons/icon-512.png', signExecutable: false },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, createStartMenuShortcut: true, deleteAppDataOnUninstall: false, runAfterFinish: false, license: 'LICENSE' },
  artifactName: 'EscuchaInterna-${version}-Windows-${arch}.${ext}',
  publish: null,
};
