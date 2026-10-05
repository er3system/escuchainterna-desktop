import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
    // Varios tests crean una BD SQLite temporal y corren migraciones+seed+cifrado en
    // beforeAll (cientos de ms c/u). Bajo el paralelismo de la suite completa, la contención
    // de CPU/disco hacía que algunos superaran el timeout por defecto (5s test / 10s hook)
    // de forma intermitente. Holgura amplia para que la suite sea determinista.
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
