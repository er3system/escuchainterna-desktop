if (new URLSearchParams(location.search).get('purpose') === 'sync') {
  document.title = 'Contraseña de sincronización';
  document.querySelector('h1').textContent = 'Conecta tus equipos';
  document.querySelector('main > p').textContent = 'Usa la misma contraseña en todas tus PCs. Los archivos de Drive se cifran antes de salir de la consulta. Elige al menos 12 caracteres y consérvala: no se puede recuperar.';
  document.querySelector('label').textContent = 'Contraseña de sincronización';
}
document.getElementById('password-form').addEventListener('submit', event => {
  event.preventDefault();
  const password = document.getElementById('password').value;
  if (password.length < 12) { document.getElementById('error').textContent = 'Usa al menos 12 caracteres.'; return; }
  window.backupPassword.submit(password);
});
document.getElementById('cancel').addEventListener('click', () => window.backupPassword.cancel());
