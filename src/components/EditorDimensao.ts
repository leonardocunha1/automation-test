import type { Locator, Page } from 'playwright';
import { TIMEOUT } from '../config/timeouts.ts';

/**
 * Um "Editor" de dimensão da página da tabela (Variável, Grupo de idade, Ano).
 *
 * Os três painéis compartilham a mesma anatomia, por isso um único componente
 * parametrizado pelo id cobre todos. Ver `docs/SIDRA.md#3-editores-de-dimensão--anatomia-comum`.
 */
export class EditorDimensao {
  protected readonly page: Page;
  protected readonly raiz: Locator;
  readonly nome: string;

  /** @param idPainel id do container do editor (`panel-C58`, `panel-P`...). */
  constructor(page: Page, idPainel: string, nome: string) {
    this.page = page;
    this.raiz = page.locator(`#${idPainel}`);
    this.nome = nome;
  }

  private item(rotulo: string): Locator {
    return this.raiz.locator(`.item-lista:has(span.nome:text-is(${JSON.stringify(rotulo)}))`);
  }

  private toggle(rotulo: string): Locator {
    return this.item(rotulo).locator('button.sidra-toggle');
  }

  private comando(titulo: string): Locator {
    return this.raiz.locator(`button[title=${JSON.stringify(titulo)}]`);
  }

  /** Rótulos de todos os itens listados, na ordem em que o SIDRA os exibe. */
  async rotulos(): Promise<string[]> {
    await this.raiz.locator('.item-lista').first().waitFor({ timeout: TIMEOUT.DEFAULT });
    const nomes = await this.raiz.locator('.item-lista span.nome').allTextContents();
    return nomes.map((n) => n.replace(/\s+/g, ' ').trim());
  }

  async estaMarcado(rotulo: string): Promise<boolean> {
    return (await this.toggle(rotulo).getAttribute('aria-selected')) === 'true';
  }

  /** Marca um item. Idempotente — no SIDRA todo clique é toggle. */
  async marcar(rotulo: string): Promise<void> {
    const toggle = this.toggle(rotulo);
    await toggle.waitFor({ state: 'visible', timeout: TIMEOUT.DEFAULT });

    if (await this.estaMarcado(rotulo)) return;

    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await this.aguardarEstado(rotulo, true);
  }

  /** Desmarca um item. Idempotente — no SIDRA todo clique é toggle. */
  async desmarcar(rotulo: string): Promise<void> {
    const toggle = this.toggle(rotulo);
    await toggle.waitFor({ state: 'visible', timeout: TIMEOUT.DEFAULT });

    if (!(await this.estaMarcado(rotulo))) return;

    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await this.aguardarEstado(rotulo, false);
  }

  private async aguardarEstado(rotulo: string, marcado: boolean): Promise<void> {
    await this.item(rotulo)
      .locator(`button.sidra-toggle[aria-selected="${marcado}"]`)
      .waitFor({ state: 'attached', timeout: TIMEOUT.DEFAULT });
  }

  async desmarcarTodos(): Promise<void> {
    await this.comando('Desmarcar todos os elementos listados').click();
  }

  async somaAtiva(): Promise<boolean> {
    const classes = (await this.comando('Somar elementos').getAttribute('class')) ?? '';
    return classes.split(/\s+/).includes('active');
  }

  /**
   * Liga a soma dos elementos marcados (botão ∑), consolidando-os numa única coluna.
   *
   * Idempotente: o ∑ é toggle, e clicar sem checar desligaria a soma numa segunda
   * execução — o CSV sairia com duas colunas, sem sintoma de falha.
   */
  async ativarSoma(): Promise<void> {
    const botao = this.comando('Somar elementos');
    await botao.waitFor({ state: 'visible', timeout: TIMEOUT.DEFAULT });

    if (!(await this.somaAtiva())) {
      await botao.click();
    }

    // O cabeçalho vira "<dimensão> - Soma [n/total]": confirma que o SIDRA aplicou a soma.
    await this.raiz
      .locator('.janela-titulo')
      .first()
      .filter({ hasText: /-\s*Soma\s*\[\d+\/\d+\]/ })
      .waitFor({ state: 'attached', timeout: TIMEOUT.DEFAULT });
  }

  /** Lê o contador do cabeçalho (`Grupo de idade [2/15]`). */
  async contador(): Promise<{ marcados: number; total: number }> {
    const texto = (await this.raiz.locator('.janela-titulo').first().textContent()) ?? '';
    const match = /\[(\d+)\/(\d+)\]/.exec(texto);
    if (!match) {
      throw new Error(
        `Não foi possível ler o contador do editor "${this.nome}". Texto: "${texto}"`,
      );
    }
    return { marcados: Number(match[1]), total: Number(match[2]) };
  }
}
