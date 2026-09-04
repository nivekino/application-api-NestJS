// @ts-check
//
// Configuracion plana de ESLint 10 (unico formato soportado: .eslintrc desaparecio en la v10).
//
// Tres capas, cada una con su justificacion:
//   1. src/ y test/ (TypeScript): reglas estrictas CON informacion de tipos
//      (strictTypeChecked + stylisticTypeChecked de typescript-eslint).
//   2. Pruebas (*.spec.ts y test/): eslint-plugin-jest. Vigila lo que el CHECK 3c del gate no
//      puede ver: un it() sin expect, un .only que convierte la bateria en mentira, un expect
//      condicional que pasa por cualquiera de dos caminos.
//   3. scripts/**/*.mjs y este archivo: JavaScript plano de Node, sin reglas de tipos.
// Prettier se aplica al final como regla (prettier/prettier) y apaga las reglas de formato que
// chocarian con el.
//
// Nota Kata: todo corre local; el linter no envia nada a servicios externos.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jest from 'eslint-plugin-jest';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/**', 'coverage/**', 'node_modules/**', 'logs/**']),

  // --- 1. Codigo TypeScript de la API y sus pruebas -----------------------------------------
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // NestJS declara modulos y guards como clases sin miembros (`@Module() class AppModule {}`,
      // `@Injectable() class JwtAuthGuard extends AuthGuard('jwt') {}`): el decorador ES el
      // contenido. Sin esta opcion, strictTypeChecked marcaria cada modulo.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      // Los mensajes de log y de error interpolan codigos de estado (number). Cualquier otro tipo
      // (objetos, nullish, any) sigue prohibido en plantillas: ahi se cuelan datos sensibles.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  // --- 2. Pruebas: unitarias (src/**/*.spec.ts) y e2e (test/) -------------------------------
  {
    files: ['src/**/*.spec.ts', 'test/**/*.ts'],
    extends: [jest.configs['flat/recommended'], jest.configs['flat/style']],
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      // Un test sin expect "pasa" y no prueba nada: es exactamente el hueco que CHECKPOINTS.MD
      // le deja al reviewer. Aqui se vuelve error de lint.
      'jest/expect-expect': 'error',
      // .only reduce la bateria a un test y deja el gate en verde con el resto sin correr.
      'jest/no-focused-tests': 'error',
      // Un expect dentro de if/else pasa por cualquiera de los dos caminos: no fija comportamiento.
      'jest/no-conditional-expect': 'error',
      // `expect(servicio.metodo).toHaveBeenCalled()` dispara unbound-method en typescript-eslint;
      // la variante de eslint-plugin-jest entiende los matchers y no da falsos positivos.
      '@typescript-eslint/unbound-method': 'off',
      'jest/unbound-method': 'error',
    },
  },

  // --- 3. Scripts del harness y esta configuracion: JavaScript plano -------------------------
  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  eslintPluginPrettierRecommended,
);
