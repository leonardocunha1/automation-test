import { test, expect } from '@playwright/test';
import { analisarCsv } from '../../src/core/validacao.ts';

const DIMENSAO = 'Unidade da Federação';

/**
 * Monta um CSV no mesmo formato que o SIDRA entrega, incluindo o bloco de
 * cabeçalho que já causou um falso negativo real na validação.
 */
function csvComTerritorios(territorios: Array<[string, number]>): string {
  return [
    '"Tabela 1209 - População, por grupos de idade"',
    '"Variável - População (Pessoas)"',
    `"${DIMENSAO}";"Ano x Grupo de idade"`,
    `"${DIMENSAO}";"2022"`,
    `"${DIMENSAO}";""`,
    ...territorios.map(([nome, valor]) => `"${nome}";"${valor}"`),
    '"Fonte: IBGE - Censo Demográfico"',
  ].join('\r\n');
}

function ufsFicticias(quantidade: number): Array<[string, number]> {
  return Array.from({ length: quantidade }, (_, i) => [`UF ${i + 1}`, (i + 1) * 1000]);
}

test.describe('analisarCsv', () => {
  test('aceita o CSV com os 27 territórios esperados', () => {
    const resultado = analisarCsv(csvComTerritorios(ufsFicticias(27)), 27, DIMENSAO);

    expect(resultado.linhasDeDados).toBe(27);
    // 1000 + 2000 + ... + 27000
    expect(resultado.somaTotal).toBe(378_000);
  });

  /**
   * Regressão do bug encontrado na primeira execução real: a linha de cabeçalho
   * `"Unidade da Federação";"2022"` casa com o padrão `"<texto>";"<número>"` e
   * era contada como dado, fazendo a validação acusar 28 linhas em vez de 27.
   */
  test('não conta as linhas de cabeçalho como dados', () => {
    const csv = csvComTerritorios(ufsFicticias(27));

    // O cabeçalho realmente contém uma linha que imita o formato de dado.
    expect(csv).toContain(`"${DIMENSAO}";"2022"`);

    expect(analisarCsv(csv, 27, DIMENSAO).linhasDeDados).toBe(27);
  });

  test('tolera o BOM que o SIDRA emite no início do arquivo', () => {
    const comBom = '﻿' + csvComTerritorios(ufsFicticias(27));

    expect(() => analisarCsv(comBom, 27, DIMENSAO)).not.toThrow();
  });

  test('aceita quebras de linha LF, e não só CRLF', () => {
    const comLf = csvComTerritorios(ufsFicticias(27)).replace(/\r\n/g, '\n');

    expect(analisarCsv(comLf, 27, DIMENSAO).linhasDeDados).toBe(27);
  });

  test.describe('rejeições', () => {
    test('recusa arquivo vazio', () => {
      expect(() => analisarCsv('   \n  ', 27, DIMENSAO)).toThrow(/vazio/i);
    });

    test('recusa página de erro HTML servida como CSV', () => {
      const html = '<!DOCTYPE html><html><body>Erro interno</body></html>';

      expect(() => analisarCsv(html, 27, DIMENSAO)).toThrow(/HTML em vez de CSV/i);
    });

    /** O caso que indica seleção territorial não aplicada — ex.: só o Brasil. */
    test('recusa contagem de territórios diferente da esperada', () => {
      const csv = csvComTerritorios(ufsFicticias(1));

      expect(() => analisarCsv(csv, 27, DIMENSAO)).toThrow(/1 linhas de dados.*pedia 27/s);
    });

    test('recusa CSV em que todos os valores são zero', () => {
      const zerados: Array<[string, number]> = Array.from({ length: 27 }, (_, i) => [
        `UF ${i + 1}`,
        0,
      ]);

      expect(() => analisarCsv(csvComTerritorios(zerados), 27, DIMENSAO)).toThrow(/zero/i);
    });
  });
});
