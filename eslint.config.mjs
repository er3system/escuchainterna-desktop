// @ts-check
import tseslint from 'typescript-eslint';

/**
 * Plugins-stub: el código tiene comentarios `eslint-disable` para reglas de
 * `eslint-config-next` (no-img-element, exhaustive-deps) que esta config mínima
 * no carga. Sin registrarlas, cada directiva produce "Definition for rule not
 * found". Las declaramos como no-op para que las directivas resuelvan sin activar
 * esas reglas (no es un linter de estilo; solo nos importan las de promesas).
 */
const noop = { meta: {}, create: () => ({}) };
const nextStub = { rules: { 'no-img-element': noop } };
const reactHooksStub = { rules: { 'exhaustive-deps': noop, 'rules-of-hooks': noop } };

/**
 * Config de lint ENFOCADA en seguridad de promesas — añadida como red de
 * protección de la re-plataforma sync→async (rama replatform/postgres). NO es un
 * linter de estilo: solo activa las reglas type-aware que cazan el modo de fallo
 * propio de esta migración.
 *
 *  - no-floating-promises: una llamada async a la que se le perdió el `await`
 *    (escritura que se dispara y se olvida → race / efecto perdido).
 *  - no-misused-promises (checksConditionals): una promesa usada en un `if`/
 *    `while`/ternario — SIEMPRE es truthy → un guard de acceso al que se le
 *    olvidó el `await` (p. ej. `if (patientAccess(...))`) abriría un BYPASS de
 *    autorización que `tsc` no detecta. Es el riesgo crítico de la cascada.
 *  - await-thenable: `await` sobre algo que no es promesa (ruido inverso).
 *
 * `checksVoidReturn: false` evita el ruido de handlers async en JSX
 * (onClick={async ...}), ajeno a esta migración.
 */
export default tseslint.config(
  {
    // `bin/` (migrate/seed): entry points async de la re-plataforma; una promesa
    // flotante ahí = despliegue que "pasa" sin migrar/sembrar. El tsconfig raíz ya
    // los incluye (`**/*.ts`), así que projectService los resuelve sin más.
    files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts', 'bin/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      '@next/next': nextStub,
      'react-hooks': reactHooksStub,
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksConditionals: true, checksVoidReturn: false, checksSpreads: true },
      ],
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  {
    // Las directivas `eslint-disable` para reglas de Next que stubeamos como
    // no-op quedarían marcadas "unused"; las silenciamos (no son de esta config).
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'scripts/**', 'data/**'],
  },
);
