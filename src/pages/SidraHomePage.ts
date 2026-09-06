import type { Locator, Page } from 'playwright';
import { BasePage } from './BasePage.ts';
import { TabelaPage } from './TabelaPage.ts';
import { config } from '../config/index.ts';
import { TIMEOUT } from '../config/timeouts.ts';
import { log } from '../core/logger.ts';

/**
 * Home do SIDRA — o único ponto de entrada permitido pelo desafio.
 *
 * A busca só aparece após clicar na lupa do menu. Ver `docs/SIDRA.md#1-home--como-a-busca-funciona`.
 */
export class SidraHomePage extends BasePage {
  readonly path = '/';

  private readonly botaoBusca: Locator;
  private readonly campoBusca: Locator;
  private readonly botaoOk: Locator;

  constructor(page: Page) {
    super(page);
    this.botaoBusca = page.getByTitle('Pesquisa Tabela');
    // O campo existe duas vezes no DOM (header + cópia responsiva): filtrar por visível
    // evita strict mode violation.
    this.campoBusca = page.locator('input[placeholder="pesquisar"]:visible').first();
    this.botaoOk = page.getByRole('button', { name: 'OK', exact: true });
  }

  async abrir(): Promise<void> {
    await this.page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });
    await this.waitForLoaded();
    await this.botaoBusca.waitFor({ state: 'visible', timeout: TIMEOUT.DEFAULT });
  }

  /**
   * Localiza uma tabela pela busca interna e navega até ela clicando.
   *
   * @param termo o que digitar na busca (para o desafio, `1209`).
   * @returns o Page Object da tabela já carregada.
   */
  async buscarTabela(termo: string): Promise<TabelaPage> {
    await this.prepararParaClique(this.botaoBusca);
    await this.botaoBusca.click();

    await this.campoBusca.waitFor({ state: 'visible', timeout: TIMEOUT.SHORT });
    await this.campoBusca.fill(termo);
    log.info(`Termo "${termo}" digitado na busca interna.`);

    await Promise.all([
      this.page.waitForURL(/\/[Tt]abela\/\d+/, { timeout: TIMEOUT.NAVIGATION }),
      this.botaoOk.click(),
    ]);

    const tabela = new TabelaPage(this.page);
    await tabela.aguardarCarregamento();
    return tabela;
  }
}
