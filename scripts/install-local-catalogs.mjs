/** Instala únicamente contenidos de biblioteca en una carpeta explícita.
 * No modifica originales, cuentas, claves ni expedientes. Nunca sobrescribe.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const extensions = new Set(['.pdf', '.epub', '.doc', '.docx', '.txt', '.pptx', '.xls']);
const within = (root, candidate) => { const relative = path.relative(root, candidate); return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function installLocalCatalogs({ books, publicationsRoot, destination }) {
  if (!destination || !path.isAbsolute(destination) || (!books && !publicationsRoot)) throw new Error('Indica un destino absoluto y al menos un catálogo.');
  const target = path.resolve(destination);
  const planned = [];
  let bookCount = 0, publicationCount = 0;
  function add(source, relative) {
    const output = path.resolve(target, relative);
    if (!within(target, output) || !fs.lstatSync(source).isFile()) throw new Error('Archivo de catálogo inválido.');
    planned.push({ source, output });
  }
  function checkRoot(value) {
    if (!path.isAbsolute(value)) throw new Error('Los orígenes deben ser rutas absolutas.');
    const source = fs.realpathSync(value);
    if (source === target || within(source, target) || within(target, source)) throw new Error('Separa el destino de los originales.');
    return source;
  }
  if (books) {
    const source = checkRoot(books);
    function visit(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error('El catálogo no admite enlaces simbólicos.');
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) { add(file, path.join('biblioteca', path.relative(source, file))); bookCount++; }
      }
    }
    visit(source);
  }
  if (publicationsRoot) {
    const source = checkRoot(publicationsRoot);
    const manifest = path.join(source, 'data/publicaciones/manifest.json');
    const entries = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    if (!Array.isArray(entries)) throw new Error('El manifest de publicaciones no es válido.');
    const assets = new Set();
    for (const entry of entries) {
      if (!entry || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(entry.id) || !entry.title || !entry.htmlPath) throw new Error('Publicación incompleta.');
      for (const field of ['htmlPath', 'pdfPath']) {
        if (!entry[field]) continue;
        if (typeof entry[field] !== 'string' || path.isAbsolute(entry[field])) throw new Error('Las publicaciones necesitan rutas relativas para instalarse en otra PC.');
        const file = path.resolve(source, entry[field]);
        const roots = ['data/publicaciones', 'data/publicaciones-src'].map(relative => path.join(source, relative));
        if (!roots.some(root => within(root, file)) || !roots.some(root => within(root, fs.realpathSync(file)))) throw new Error('Un archivo sale de las carpetas de publicaciones.');
        assets.add(file);
      }
      publicationCount++;
    }
    for (const file of assets) add(file, path.relative(source, file));
    // El manifest se copia al final, una vez disponibles sus archivos.
    const cie11 = path.join(source, 'data/cie11/cie11.json');
    if (fs.existsSync(cie11)) add(cie11, 'data/cie11/cie11.json');
    add(manifest, 'data/publicaciones/manifest.json');
  }
  // Valida todo antes de escribir; los archivos ya instalados deben coincidir.
  for (const { source, output } of planned) {
    let ancestor = path.dirname(output);
    while (within(target, ancestor) || ancestor === target) {
      if (fs.existsSync(ancestor) && fs.lstatSync(ancestor).isSymbolicLink()) throw new Error('El destino no admite enlaces.');
      if (ancestor === target) break;
      ancestor = path.dirname(ancestor);
    }
    if (fs.existsSync(output) && (!fs.lstatSync(output).isFile() || digest(source) !== digest(output))) throw new Error('Hay un archivo distinto en el destino. Se conserva sin sobrescribir.');
  }
  let copied = 0, bytes = 0;
  for (const { source, output } of planned) {
    if (fs.existsSync(output)) continue;
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(source, output, fs.constants.COPYFILE_EXCL);
    copied++; bytes += fs.statSync(output).size;
  }
  return { books: bookCount, publications: publicationCount, copied, bytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = {};
  const names = { '--books': 'books', '--publications-root': 'publicationsRoot', '--destination': 'destination' };
  for (let i = 2; i < process.argv.length; i += 2) { const name = names[process.argv[i]]; if (!name || !process.argv[i + 1] || options[name]) throw new Error('Argumentos de instalación inválidos.'); options[name] = process.argv[i + 1]; }
  console.log(JSON.stringify(installLocalCatalogs(options), null, 2));
}
