document.getElementById('password-form').addEventListener('submit', event => {
  event.preventDefault();
  const password = document.getElementById('password').value;
  if (password.length < 12) { document.getElementById('error').textContent = 'Usa al menos 12 caracteres.'; return; }
  window.backupPassword.submit(password);
});
document.getElementById('cancel').addEventListener('click', () => window.backupPassword.cancel());
