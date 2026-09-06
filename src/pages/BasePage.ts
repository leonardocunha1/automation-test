import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { Locator, Page } from 'playwright';
import { config } from '../config/index.ts';
import { TIMEOUT } from '../config/timeouts.ts';

/**
 * Base dos Page Objects do SIDRA.
 *
 * Não há `goto(path)` genérico aqui de propósito: a única navegação por URL do projeto
 * é `SidraHomePage.abrir()`. Ver `docs/ARQUITETURA.md#decisões-de-design`.
 */
export abstract class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Espera o DOM ficar pronto. Cada página especializa com seu próprio sinal. */
  async waitForLoaded(_timeout: number = TIMEOUT.HEAVY): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Captura de diagnóstico. Usada pelo tratamento de erro do entrypoint. */
  async capturarTela(nome: string): Promise<string> {
    const pasta = resolve(process.cwd(), config.pastaCapturas);
    await mkdir(pasta, { recursive: true });
    const destino = resolve(pasta, `${nome}.png`);
    await this.page.screenshot({ path: destino, fullPage: true });
    return destino;
  }

  /** Rola o elemento até a viewport antes de agir. */
  protected async prepararParaClique(alvo: Locator): Promise<void> {
    await alvo.scrollIntoViewIfNeeded();
  }
}
