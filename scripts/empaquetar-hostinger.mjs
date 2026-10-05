#!/usr/bin/env node
/**
 * Genera el ZIP de despliegue para el hosting Node.js de Hostinger (hPanel →
 * Websites → Add Website → Node.js Apps → "Upload your website files").
 *
 * El ZIP es CÓDIGO FUENTE (la plataforma corre npm install + build allá):
 * `git archive` del HEAD → solo archivos versionados. Quedan fuera por diseño
 * (ojo: sin barras tras los asteriscos, que cierran este comentario):
 *   - node_modules y .next / .next-build  (se generan en la plataforma)
 *   - data/biblioteca (5.7 GB)            (gitignored: tamaño + principio de
 *                                          copyright — no se redistribuye)
 *   - las BD locales y data/uploads       (datos locales de dev)
 *   - todo .env                           (los secretos van en el panel, jamás en el zip)
 * Sí viajan (versionados): data/publicaciones (contenido propio) y data/cie11.
 *
 * Uso: npm run empaquetar:hostinger   (exige árbol de trabajo limpio)
 */
import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

const localOnlyUntracked = [
  /^\.agents\//,
  /^\.codex\//,
  /^\.mcp\.json$/,
  /^data\/backups\//,
  /^data\/publicaciones\/_nuevas-entradas\.json$/,
  /^scratch-/,
  /^escuchainterna-hostinger-[0-9a-f]+\.zip$/,
];

const dirty = sh('git status --porcelain=v1 --untracked-files=all')
  .split('\n')
  .filter((line) => {
    if (line.trim() === '') return false;
    if (!line.startsWith('??')) return true;
    const path = line.slice(3).replaceAll('\\', '/');
    return !localOnlyUntracked.some((pattern) => pattern.test(path));
  });
if (dirty.length > 0) {
  console.error('✗ Hay cambios o archivos de código sin commitear; el ZIP se genera desde HEAD y no los incluiría:');
  for (const line of dirty) console.error(`   ${line}`);
  console.error('  Commitea (o descarta) y vuelve a correr.');
  process.exit(1);
}

const sha = sh('git rev-parse --short HEAD');
const out = `escuchainterna-hostinger-${sha}.zip`;
sh(`git archive --format=zip -o ${out} HEAD`);

const mb = (statSync(out).size / 1024 / 1024).toFixed(1);
console.log(`✓ ${out} (${mb} MB) — commit ${sha}`);
console.log('  Siguiente paso: hPanel → Websites → Add Website → Node.js Apps → subir este ZIP.');
console.log('  Runbook completo: docs/despliegue-hostinger.md');
