/**
 * Ejecuta `next build` / `next start` con distDir AISLADO (.next-build) para
 * que el build de verificación nunca pise los chunks del dev server que corre
 * sobre .next (causa raíz de los "Cannot find module './NNNN.js'" y
 * ChunkLoadError cuando build y dev conviven).
 */
import { spawnSync } from 'node:child_process';

const command = process.argv[2];
if (!['build', 'start'].includes(command)) {
  console.error('Uso: node scripts/next-isolated.mjs <build|start>');
  process.exit(1);
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['next', command, ...process.argv.slice(3)],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, NEXT_DIST_DIR: '.next-build' },
  },
);
process.exit(result.status ?? 1);
