import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dados/**',
      'capturas/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // As regras type-aware (`no-floating-promises`) exigem um programa TypeScript,
    // então valem só para os fontes do projeto — o próprio config fica de fora.
    files: ['src/**/*.ts', 'tests/**/*.ts', 'desafio_ibge_1209.ts', 'playwright.config.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Promise solta num script de automação é a origem clássica de flake:
      // a ação "acontece" fora de ordem e o erro some.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // Parâmetros documentados mas não usados (ex.: `_timeout` na BasePage).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    // Regras específicas de spec: pegam `expect` sem await, condicional dentro de
    // teste, `test.only` esquecido — erros que passam batido no typecheck e viram
    // teste que "passa" sem asserir nada.
    ...playwright.configs['flat/recommended'],
    files: ['tests/**/*.spec.ts'],
  },
  prettier,
);
