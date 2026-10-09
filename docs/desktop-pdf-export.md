# Guardar documentos en PDF

En la app de Windows, abre el consentimiento, expediente, reporte o mapa familiar y pulsa **Guardar PDF**. Elige la carpeta y el nombre del archivo. **Imprimir** abre por separado el selector de impresoras.

También puedes usar **Archivo → Guardar PDF…** (`Ctrl+Shift+S`) para guardar la página actual. `Ctrl+P` sigue abriendo la impresión. No hace falta instalar una impresora virtual ni conectarse a internet.

El archivo contiene lo que muestra la vista imprimible: un borrador conserva su indicación de borrador; guardar PDF no firma ni modifica el expediente. Los documentos se exportan con fondo claro y texto oscuro, independientemente del tema de la app. El PDF elegido es una copia legible sin el cifrado de los respaldos de EscuchaInterna.

## Contrato de implementación

- `desktop/pdf-export.cjs` usa `webContents.printToPDF` y el selector nativo `showSaveDialog`. El renderer solo proporciona un nombre sugerido; no puede elegir una ruta de escritura.
- El IPC admite únicamente la ventana principal y su frame principal en el origen local activo. El nombre se limita y normaliza para Windows; el destino debe terminar en `.pdf`.
- Cambiar de página durante el selector o la generación cancela la escritura. Cancelar el selector no genera un PDF ni toca archivos. La escritura es atómica y sus temporales se eliminan si falla.
- El proceso nativo bloquea otras operaciones de datos mientras genera el documento. La UI muestra el estado, permite reintentar y no presenta una cancelación como éxito.
- Las pruebas usan un perfil aislado y cuentas ficticias: `npm run desktop:test` y, después de empaquetar, `npm run desktop:export-smoke`.
