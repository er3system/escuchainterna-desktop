#!/usr/bin/env node
/** Exporta una copia pública SIN historial Git ni archivos de la instalación. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const destination = path.join(root, '.open-source-publish');
if (fs.existsSync(destination) && !process.argv.includes('--refresh')) {
  throw new Error('Ya existe .open-source-publish. Usa --refresh para actualizar sus archivos permitidos conservando su Git.');
}

const files = [
  'package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json',
  'postcss.config.mjs', 'eslint.config.mjs', 'vitest.config.ts', '.gitignore', '.gitattributes',
  '.env.example', 'README.md', 'LICENSE', 'CONTRIBUTING.md', 'SECURITY.md',
  'THIRD_PARTY_NOTICES.md', 'electron-builder.yml', 'electron-builder.json',
  'electron-builder.config.cjs', 'electron-builder.config.mjs',
];
const directories = ['src', 'tests', 'public', 'desktop', 'scripts', 'bin', '.github'];
const docs = [
  'desktop-concept.md', 'desktop-sync.md', 'desktop-navigation.md', 'desktop-product-review.md', 'desktop-google-calendar.md', 'desktop-account-access.md', 'desktop-pdf-export.md', 'consentimiento-google-propuesta.md', 'desktop-consent-reception.md', 'guia-para-ias.md', 'ui-spec.md', 'historia-clinica-spec.md',
  'expediente-v2-spec.md', 'consultorios-spec.md', 'cuentas-institucionales-spec.md',
];
const deny = /(?:^|\/)(?:node_modules|\.git|\.env(?:\..*)?|backups|uploads)(?:\/|$)|\.(?:db(?:-wal|-shm|-journal)?|pfx|pem|key|enc\.json|ei-backup|eibackup|eisync|eichannel)$/i;
let count = 0;

function copy(relative) {
  const source = path.join(root, relative);
  if (!fs.existsSync(source)) return;
  const normalized = relative.replaceAll('\\', '/');
  if (normalized !== '.env.example' && deny.test(normalized)) {
    throw new Error(`Archivo no publicable: ${normalized}`);
  }
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`No se exportan enlaces: ${normalized}`);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(source).sort()) copy(path.join(relative, name));
    return;
  }
  if (!stat.isFile()) throw new Error(`Archivo especial no publicable: ${normalized}`);
  const target = path.join(destination, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const data = fs.readFileSync(source);
  if (/\.(?:ts|tsx|js|mjs|cjs|json|md|txt|html|css|yml|yaml|svg)$/.test(normalized) || normalized === '.env.example') {
    const text = data.toString('utf8').replaceAll('admin@demo.test', 'admin@demo.test').replace(/\r\n/g, '\n').replace(/\n{2,}$/, '\n');
    const unsafe = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{25,}|sk-ant-[A-Za-z0-9_-]{30,}|AKIA[A-Z0-9]{16}/;
    if (unsafe.test(text)) throw new Error(`Posible secreto detectado: ${normalized}`);
    fs.writeFileSync(target, text);
  } else {
    fs.copyFileSync(source, target);
  }
  count += 1;
}

for (const item of files) copy(item);
for (const item of directories) copy(item);
for (const doc of docs) copy(path.join('docs', doc));
fs.writeFileSync(path.join(destination, 'AGENTS.md'), `# EscuchaInterna — acuerdos de trabajo\n\nLee docs/guia-para-ias.md antes de implementar, verificar, publicar o configurar Google.\n\n- Interfaz y dominio en español.\n- Arquitectura DDD por contextos en src/contexts/<contexto>/{domain,application,infrastructure}.\n- Value objects y mensajes de aplicación convierten los primitivos en la frontera.\n- Repositorios: interfaz de dominio y adaptadores de infraestructura.\n- Todo dato operativo se filtra por owner_user_id del usuario autenticado.\n- El modo escritorio elimina gates comerciales, nunca autenticación ni permisos.\n- SQLite se abre mediante getDb(); esquema nuevo requiere migración versionada.\n- Integraciones: puerto y adaptador; el programa debe funcionar sin red.\n- Componentes cliente no importan módulos Node; servir ReadStreams mediante Readable.toWeb.\n- No publicar .env, claves, datos de pacientes, respaldos ni contenido sin licencia.\n- Verificar npm run typecheck, npm test y npm run build. Para desktop: pruebas y smoke empaquetado.\n- No ejecutar build y dev contra el mismo directorio de Next.\n`);
console.log(`Copia pública preparada: ${destination} (${count + 1} archivos, sin historial ni catálogos privados).`);
