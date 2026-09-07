import { test, expect } from '@playwright/test';
import { SidraHomePage } from '../../src/pages/SidraHomePage.ts';
import { salvarDownload } from '../../src/core/arquivo.ts';
import { validarCsv } from '../../src/core/validacao.ts';
import { config } from '../../src/config/index.ts';

/**
 * Smoke do fluxo completo do desafio, contra o SIDRA real.
 *
 * Diferente do `npm start`, que só precisa terminar com o arquivo no lugar, aqui
 * cada etapa é ASSERTADA — o objetivo é dizer *onde* quebrou quando o IBGE mudar
 * a interface, em vez de só apontar que o download falhou.
 *
 * Depende do site no ar: trate uma falha aqui como diagnóstico do contrato com o
 * SIDRA, não necessariamente como defeito do nosso código.
 */
test.describe('Tabela 1209 — população de 60 anos ou mais por UF', () => {
  test('percorre o fluxo pela interface e baixa um CSV válido', async ({ page }, testInfo) => {
    const home = new SidraHomePage(page);

    const tabela = await test.step('descobre a tabela pela busca da interface', async () => {
      await home.abrir();
      const encontrada = await home.buscarTabela(config.termoBusca);

      await expect(encontrada.titulo).toContainText(`Tabela ${config.tabela.numero}`);
      await expect(encontrada.titulo).toContainText(config.tabela.tituloEsperado);
      return encontrada;
    });

    await test.step('marca as faixas de 60+ e ativa a soma', async () => {
      const rotulos = await tabela.grupoIdade.rotulos();

      // Fixa o achado que orientou toda a implementação: a categoria pedida no
      // enunciado NÃO existe na tabela; ela é composta por duas faixas.
      expect(rotulos).not.toContain('60 anos ou mais');
      expect(rotulos).toEqual(expect.arrayContaining([...config.faixasEtarias60Mais]));

      await tabela.grupoIdade.desmarcarTodos();
      for (const faixa of config.faixasEtarias60Mais) {
        await tabela.grupoIdade.marcar(faixa);
        expect(await tabela.grupoIdade.estaMarcado(faixa)).toBe(true);
      }

      // "Total" vem marcado por padrão e somaria a população inteira ao recorte.
      expect(await tabela.grupoIdade.estaMarcado('Total')).toBe(false);
      expect((await tabela.grupoIdade.contador()).marcados).toBe(config.faixasEtarias60Mais.length);

      await tabela.grupoIdade.ativarSoma();
      expect(await tabela.grupoIdade.somaAtiva()).toBe(true);
    });

    await test.step('seleciona as 27 Unidades da Federação', async () => {
      await tabela.territorio.marcarNivel(config.nivelTerritorial);
      await tabela.territorio.desmarcarNivel(config.nivelTerritorialPadrao);

      const { marcados, total } = await tabela.territorio.contadorDoNivel(config.nivelTerritorial);
      expect(total).toBe(config.totalUfsEsperado);
      expect(marcados).toBe(total);
      expect(await tabela.territorio.estaMarcado(config.nivelTerritorialPadrao)).toBe(false);
    });

    await test.step('seleciona o ano mais recente', async () => {
      const anos = await tabela.anosDisponiveis();
      expect(anos.length).toBeGreaterThan(0);

      const escolhido = await tabela.selecionarAnoMaisRecente();
      expect(escolhido).toBe(anos[0]);
      expect(await tabela.ano.estaMarcado(escolhido)).toBe(true);
      expect((await tabela.ano.contador()).marcados).toBe(1);
    });

    await test.step('baixa o CSV e valida o conteúdo', async () => {
      const download = await tabela.baixar(config.formatoDownload);

      // Grava no diretório do teste — o CSV entregue em `dados/` é produzido pelo
      // `npm start` e não deve ser sobrescrito por uma execução de teste.
      const destino = await salvarDownload(download, testInfo.outputPath('tabela-1209.csv'));

      const { linhasDeDados, somaTotal } = await validarCsv(
        destino,
        config.totalUfsEsperado,
        config.nivelTerritorial,
      );

      expect(linhasDeDados).toBe(config.totalUfsEsperado);
      // Confere a ordem de grandeza do Censo 2022 (~32,1 milhões de pessoas 60+),
      // faixa larga o bastante para sobreviver a uma revisão do IBGE.
      expect(somaTotal).toBeGreaterThan(25_000_000);
      expect(somaTotal).toBeLessThan(45_000_000);
    });
  });
});
