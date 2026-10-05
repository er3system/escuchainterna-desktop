# Componentes y contenido de terceros

La licencia MIT de este repositorio cubre el código propio. Las dependencias conservan sus licencias originales; los metadatos de `package-lock.json` y los archivos de licencia de cada dependencia forman parte de su atribución.

Electron incluye Chromium y Node.js. El instalador incluye además un runtime oficial de Node.js para ejecutar SQLite y Next.js sin requerir una instalación previa. Su licencia se conserva en los recursos distribuidos.

## Catálogos clínicos

El dataset CIE-11 y las publicaciones clínicas de la instalación original no forman parte de la distribución pública inicial. Su ausencia no impide abrir el programa ni crear pacientes, citas y expedientes. El buscador CIE-11 requiere un catálogo instalado por separado.

CIE-11 es una clasificación de la Organización Mundial de la Salud con condiciones de licencia propias. La licencia MIT del programa no concede derechos sobre esa clasificación ni sobre pruebas, escalas, libros o publicaciones de terceros. Consulta la [licencia oficial de ICD-11](https://icd.who.int/en/docs/icd11-license.pdf).

Las escalas PHQ-9 y GAD-7 presentes en el código conservan su atribución a sus autores y a Pfizer. Su reproducción está autorizada por las condiciones publicadas por [Pfizer](https://www.pfizer.com/print/pdf/node/3064); la licencia MIT no reemplaza la atribución del instrumento.

No se distribuye la carpeta privada `data/biblioteca`, los PDFs de la instalación original, archivos de pacientes ni respaldos. Si incorporas un catálogo, verifica su licencia y atribución antes de compartirlo. No añadas contenido clínico externo al instalador por el mero hecho de ser accesible en internet.
