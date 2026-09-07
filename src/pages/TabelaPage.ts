import type { Download, Locator, Page } from 'playwright';
import { BasePage } from './BasePage.ts';
import { EditorDimensao } from '../components/EditorDimensao.ts';
import { SeletorTerritorial } from '../components/SeletorTerritorial.ts';
import { ModalDownload } from '../components/ModalDownload.ts';
import { TIMEOUT } from '../config/timeouts.ts';
import { log } from '../core/logger.ts';
import { anosDecrescentes } from '../core/texto.ts';

/**
 * Página de uma tabela do SIDRA, com os editores expostos como componentes tipados.
 *
 * Ids dos painéis: `panel-V` (Variável), `panel-C58` (Grupo de idade), `panel-P` (Ano),
 * `panel-T` (Unidade Territorial). Ver `docs/SIDRA.md#3-editores-de-dimensão--anatomia-comum`.
 */
export class TabelaPage extends BasePage {
  readonly path = '/tabela';

  readonly variavel: EditorDimensao;
  readonly grupoIdade: EditorDimensao;
  readonly ano: EditorDimensao;
  readonly territorio: SeletorTerritorial;
  readonly modalDownload: ModalDownload;

  constructor(page: Page) {
    super(page);
    this.variavel = new EditorDimensao(page, 'panel-V', 'Variável');
    this.grupoIdade = new EditorDimensao(page, 'panel-C58', 'Grupo de idade');
    this.ano = new EditorDimensao(page, 'panel-P', 'Ano');
    this.territorio = new SeletorTerritorial(page, 'panel-T');
    this.modalDownload = new ModalDownload(page);
  }

  /** A classe `carregado` só existe nesta página — não na home. */
  override async waitForLoaded(timeout: number = TIMEOUT.HEAVY): Promise<void> {
    await super.waitForLoaded(timeout);
    await this.page.locator('body.carregado').waitFor({ state: 'attached', timeout });
  }

  /** Espera os editores montarem — o territorial é o último. */
  async aguardarCarregamento(): Promise<void> {
    await this.waitForLoaded();
    await this.page.locator('#panel-T .item-arvore').first().waitFor({ timeout: TIMEOUT.HEAVY });
  }

  /** Número da tabela lido da URL, para confirmar que chegamos na tabela certa. */
  numeroNaUrl(): number | null {
    const match = /\/[Tt]abela\/(\d+)/.exec(this.page.url());
    return match?.[1] ? Number(match[1]) : null;
  }

  /**
   * Cabeçalho da tabela
   */
  get titulo(): Locator {
    return this.page.locator('#nome-tabela').getByRole('heading', { name: /^Tabela \d+/ });
  }

  /** O mesmo título como texto — para o script CLI, que não tem `expect` disponível. */
  async tituloTexto(): Promise<string> {
    return (await this.titulo.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
  }

  /** Anos disponíveis, do mais recente para o mais antigo. */
  async anosDisponiveis(): Promise<string[]> {
    return anosDecrescentes(await this.ano.rotulos());
  }

  /** Marca o ano mais recente e desmarca os demais. Devolve o ano escolhido. */
  async selecionarAnoMaisRecente(): Promise<string> {
    const anos = await this.anosDisponiveis();
    const maisRecente = anos[0];
    if (!maisRecente) {
      throw new Error('Nenhum ano disponível no editor de período.');
    }

    await this.ano.desmarcarTodos();
    await this.ano.marcar(maisRecente);
    return maisRecente;
  }

  /**
   * Abre o modal de download e baixa o arquivo no formato pedido.
   *
   * @param formato rótulo exato no select, ex.: `CSV (BR)`.
   */
  async baixar(formato: string): Promise<Download> {
    await this.page.locator('#botao-downloads').click();
    await this.modalDownload.aguardarAbertura();

    const disponiveis = await this.modalDownload.formatosDisponiveis();
    if (!disponiveis.some((f) => f.trim() === formato)) {
      throw new Error(
        `Formato "${formato}" não está disponível. Opções: ${disponiveis.join(', ')}.`,
      );
    }

    await this.modalDownload.escolherFormato(formato);
    await this.modalDownload.desativarCompressao();
    log.info(`Formato "${formato}" selecionado, compressão desativada.`);

    return this.modalDownload.baixar();
  }
}
