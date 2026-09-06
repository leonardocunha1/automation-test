import { defineConfig } from '@playwright/test';
import { TIMEOUT } from './src/config/timeouts.ts';

/**
 * Configuração dos testes.
 *
 * O entregável do desafio é o script CLI (`npm start`), que usa `playwright` puro e não
 * depende deste arquivo. Ver `docs/ARQUITETURA.md#camada-de-testes`.
 */
export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  projects: [
    {
      // Lógica pura: sem browser, sem rede.
      name: 'unit',
      testDir: './tests/unit',
      use: {},
      timeout: TIMEOUT.SHORT,
    },
    {
      // Smoke do fluxo real contra o SIDRA.
      name: 'e2e',
      testDir: './tests/e2e',
      use: {
        acceptDownloads: true,
        locale: 'pt-BR',
        viewport: { width: 1600, height: 1000 },
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
      },
      timeout: TIMEOUT.DOWNLOAD,
      retries: process.env.CI ? 1 : 0,
    },
  ],
});
