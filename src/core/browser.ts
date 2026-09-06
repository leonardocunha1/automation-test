import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { config } from '../config/index.ts';
import { TIMEOUT } from '../config/timeouts.ts';

export interface Sessao {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/** Sobe o Chromium preparado para o SIDRA. Ver `docs/ARQUITETURA.md#ambiente`. */
export async function abrirNavegador(): Promise<Sessao> {
  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.slowMo,
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    locale: 'pt-BR',
    viewport: { width: 1600, height: 1000 },
  });

  context.setDefaultTimeout(TIMEOUT.DEFAULT);
  context.setDefaultNavigationTimeout(TIMEOUT.NAVIGATION);

  const page = await context.newPage();
  return { browser, context, page };
}
