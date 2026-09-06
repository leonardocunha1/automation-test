import type { Download, Locator, Page } from 'playwright';
import { TIMEOUT } from '../config/timeouts.ts';

/**
 * Modal "Download" (`#modal-downloads`).
 *
 * O `href` do link de download é reescrito pelo próprio site conforme as opções; nós
 * clicamos no link, nunca montamos a URL. Ver `docs/SIDRA.md#7-modal-de-download`.
 */
export class ModalDownload {
  private readonly page: Page;
  private readonly raiz: Locator;

  constructor(page: Page) {
    this.page = page;
    this.raiz = page.locator('#modal-downloads');
  }

  /** Espera a modal terminar a animação de abertura (Bootstrap adiciona `.in`). */
  async aguardarAbertura(): Promise<void> {
    await this.page
      .locator('#modal-downloads.in')
      .waitFor({ state: 'visible', timeout: TIMEOUT.SHORT });
    await this.raiz.locator('#opcao-downloads').waitFor({ state: 'visible' });
  }

  /** @param rotulo texto exato da opção, ex.: `CSV (BR)`. */
  async escolherFormato(rotulo: string): Promise<void> {
    const select = this.raiz.locator('#download-form select[name="formato-arquivo"]');
    await select.selectOption({ label: rotulo });
  }

  /** Garante o arquivo sem compressão: com o zip ligado, salvar como `.csv` mentiria. */
  async desativarCompressao(): Promise<void> {
    const zip = this.raiz.locator('#download-cmp');
    if (await zip.isChecked()) {
      await zip.uncheck();
    }
  }

  /** Formatos oferecidos — usado nas mensagens de erro. */
  async formatosDisponiveis(): Promise<string[]> {
    return this.raiz
      .locator('#download-form select[name="formato-arquivo"] option')
      .allTextContents();
  }

  /** Clica em "Download" e devolve o arquivo. O listener é armado antes do clique. */
  async baixar(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: TIMEOUT.DOWNLOAD }),
      this.raiz.locator('#opcao-downloads').click(),
    ]);
    return download;
  }
}
