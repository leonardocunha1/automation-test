import type { Locator, Page } from 'playwright';
import { SETTLE, TIMEOUT } from '../config/timeouts.ts';
import { rotuloComContador } from '../core/texto.ts';

/**
 * Editor de Unidade Territorial — o único painel que foge da anatomia comum.
 *
 * Expõe uma árvore de níveis; marcar o nó pai marca todos os filhos de uma vez.
 * Ver `docs/SIDRA.md#5-editor-territorial--a-exceção`.
 */
export class SeletorTerritorial {
  private readonly page: Page;
  private readonly raiz: Locator;

  constructor(page: Page, idPainel: string) {
    this.page = page;
    this.raiz = page.locator(`#${idPainel}`);
  }

  /**
   * Nó da árvore cujo rótulo é `nome`.
   *
   * Ancorado no `.sidra-check` interno, e não no `.nome-arvore` que o envolve: este
   * traz o ano de referência anexado ao texto e derruba o match.
   */
  private no(nome: string): Locator {
    return this.raiz
      .locator('.item-arvore .nome-arvore > .sidra-check')
      .filter({ hasText: rotuloComContador(nome) });
  }

  private toggle(nome: string): Locator {
    return this.no(nome).locator('button.sidra-toggle');
  }

  async estaMarcado(nome: string): Promise<boolean> {
    return (await this.toggle(nome).getAttribute('aria-selected')) === 'true';
  }

  /** Marca um nível inteiro, e com ele todos os territórios filhos. Idempotente. */
  async marcarNivel(nome: string): Promise<void> {
    const toggle = this.toggle(nome);
    await toggle.waitFor({ state: 'visible', timeout: TIMEOUT.DEFAULT });

    if (await this.estaMarcado(nome)) return;

    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await this.aguardarEstado(nome, true);
  }

  /** Desmarca um nível inteiro. Idempotente. */
  async desmarcarNivel(nome: string): Promise<void> {
    const toggle = this.toggle(nome);
    await toggle.waitFor({ state: 'visible', timeout: TIMEOUT.DEFAULT });

    if (!(await this.estaMarcado(nome))) return;

    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await this.aguardarEstado(nome, false);
  }

  private async aguardarEstado(nome: string, marcado: boolean): Promise<void> {
    await this.no(nome)
      .locator(`button.sidra-toggle[aria-selected="${marcado}"]`)
      .waitFor({ state: 'attached', timeout: TIMEOUT.DEFAULT });
    // A árvore reordena os nós sem emitir sinal DOM observável.
    await this.page.waitForTimeout(SETTLE.ARVORE_REORDENA);
  }

  /** Contador do próprio nível (`[27/27]`), não o do painel. */
  async contadorDoNivel(nome: string): Promise<{ marcados: number; total: number }> {
    const texto = (await this.no(nome).textContent()) ?? '';
    const match = /\[(\d+)\/(\d+)\]/.exec(texto);
    if (!match) {
      throw new Error(`Não foi possível ler o contador do nível "${nome}". Texto: "${texto}"`);
    }
    return { marcados: Number(match[1]), total: Number(match[2]) };
  }

  /** Rótulos dos níveis disponíveis — usado nas mensagens de erro. */
  async niveisDisponiveis(): Promise<string[]> {
    const nomes = await this.raiz
      .locator('.item-arvore > .nome-arvore span.nome')
      .allTextContents();
    return nomes.map((n) => n.replace(/\s+/g, ' ').trim());
  }
}
