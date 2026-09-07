/**
 * Desafio Técnico – Automação RPA
 *
 * Navega pelo SIDRA/IBGE a partir da home, descobre a tabela 1209 pela busca interna,
 * configura o recorte (60 anos ou mais, por UF, no ano mais recente) e baixa o CSV.
 *
 * Execução: `npm start` (ou `npm run start:headed` para ver o navegador).
 * Documentação: `docs/ARQUITETURA.md` e `docs/SIDRA.md`.
 */
import { config } from './src/config/index.ts';
import { abrirNavegador } from './src/core/browser.ts';
import { salvarDownload } from './src/core/arquivo.ts';
import { validarCsv } from './src/core/validacao.ts';
import { log } from './src/core/logger.ts';
import { SidraHomePage } from './src/pages/SidraHomePage.ts';
import type { TabelaPage } from './src/pages/TabelaPage.ts';

async function main(): Promise<void> {
  const inicio = Date.now();
  const { browser, page } = await abrirNavegador();
  let tabela: TabelaPage | undefined;

  try {
    // 1. Entrar pela home — a URL da tabela NÃO é acessada diretamente.
    log.etapa(`Abrindo a página inicial do SIDRA (${config.baseUrl})`);
    const home = new SidraHomePage(page);
    await home.abrir();
    log.ok('Home carregada.');

    // 2. Descobrir a tabela pela busca interna do site.
    log.etapa(`Localizando a tabela ${config.tabela.numero} pela busca da interface`);
    tabela = await home.buscarTabela(config.termoBusca);
    await confirmarTabelaCorreta(tabela);

    // 3. Grupo de idade: 60 anos ou mais.
    log.etapa('Configurando o grupo de idade: 60 anos ou mais');
    await configurarFaixaEtaria(tabela);

    // 4. Recorte territorial: as 27 Unidades da Federação.
    log.etapa('Configurando o recorte territorial: Unidades da Federação');
    await configurarTerritorio(tabela);

    // 5. Ano mais recente disponível.
    log.etapa('Selecionando o ano mais recente disponível');
    const ano = await tabela.selecionarAnoMaisRecente();
    log.ok(`Ano selecionado: ${ano}.`);

    // 6. Baixar e salvar o CSV.
    log.etapa(`Baixando o arquivo em ${config.formatoDownload}`);
    const download = await tabela.baixar(config.formatoDownload);
    const destino = await salvarDownload(download, config.arquivoSaida);
    log.ok(`Arquivo salvo em ${destino}`);

    // 7. Conferir o que foi gravado antes de declarar sucesso.
    log.etapa('Validando o conteúdo do arquivo');
    const { linhasDeDados, somaTotal } = await validarCsv(
      destino,
      config.totalUfsEsperado,
      config.nivelTerritorial,
    );
    log.ok(
      `${linhasDeDados} UFs no arquivo — população total de 60 anos ou mais: ` +
        `${somaTotal.toLocaleString('pt-BR')} pessoas.`,
    );

    const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`\n✅ Concluído em ${segundos}s — ${config.arquivoSaida}\n`);
  } catch (erro) {
    await reportarFalha(erro, tabela);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

/** Confirma que a busca levou à tabela certa, evitando baixar a tabela errada em silêncio. */
async function confirmarTabelaCorreta(tabela: TabelaPage): Promise<void> {
  const numero = tabela.numeroNaUrl();
  if (numero !== config.tabela.numero) {
    throw new Error(
      `A busca levou à tabela ${numero ?? '(desconhecida)'}, e não à ${config.tabela.numero}.`,
    );
  }

  const titulo = await tabela.tituloTexto();
  if (!titulo.includes(config.tabela.tituloEsperado)) {
    log.aviso(`Título inesperado na página da tabela: "${titulo}".`);
  }
  log.ok(`Tabela ${numero} aberta pela interface: ${titulo}`);
}

/**
 * Marca as faixas que compõem 60+ e liga a soma.
 *
 * A tabela 1209 não tem a categoria pronta: ela é composta por `60 a 69 anos` e
 * `70 anos ou mais`, consolidadas pelo ∑ do editor.
 */
async function configurarFaixaEtaria(tabela: TabelaPage): Promise<void> {
  const disponiveis = await tabela.grupoIdade.rotulos();
  const faltando = config.faixasEtarias60Mais.filter((f) => !disponiveis.includes(f));
  if (faltando.length > 0) {
    throw new Error(
      `Faixas etárias não encontradas na tabela: ${faltando.join(', ')}. ` +
        `Disponíveis: ${disponiveis.join(' | ')}.`,
    );
  }

  // "Total" vem marcado por padrão e somaria a população inteira ao recorte.
  await tabela.grupoIdade.desmarcarTodos();

  for (const faixa of config.faixasEtarias60Mais) {
    await tabela.grupoIdade.marcar(faixa);
    log.info(`Faixa marcada: ${faixa}`);
  }

  const { marcados } = await tabela.grupoIdade.contador();
  if (marcados !== config.faixasEtarias60Mais.length) {
    throw new Error(
      `Esperava ${config.faixasEtarias60Mais.length} faixas marcadas, mas o editor indica ${marcados}.`,
    );
  }

  await tabela.grupoIdade.ativarSoma();
  log.ok('Faixas somadas em uma única coluna de 60 anos ou mais.');
}

/** Marca o nível "Unidade da Federação" (27 UFs) e remove o "Brasil" default. */
async function configurarTerritorio(tabela: TabelaPage): Promise<void> {
  const { territorio } = tabela;

  await territorio.marcarNivel(config.nivelTerritorial);

  // Desmarcado DEPOIS de marcar as UFs: o SIDRA rejeita ficar sem território algum.
  await territorio.desmarcarNivel(config.nivelTerritorialPadrao);

  const { marcados, total } = await territorio.contadorDoNivel(config.nivelTerritorial);
  if (marcados !== total || total !== config.totalUfsEsperado) {
    const niveis = await territorio.niveisDisponiveis();
    throw new Error(
      `Esperava ${config.totalUfsEsperado} UFs marcadas, mas o nível indica ${marcados}/${total}. ` +
        `Níveis disponíveis: ${niveis.join(' | ')}.`,
    );
  }
  log.ok(`${marcados} Unidades da Federação selecionadas.`);
}

async function reportarFalha(erro: unknown, tabela?: TabelaPage): Promise<void> {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  log.erro(mensagem);

  if (tabela) {
    try {
      const captura = await tabela.capturarTela(`falha-${Date.now()}`);
      log.info(`Captura de tela salva em ${captura}`);
    } catch {
      // Uma falha ao capturar a tela não deve mascarar o erro original.
    }
  }

  if (erro instanceof Error && erro.stack) {
    console.error(`\n${erro.stack}\n`);
  }
}

await main();
