import { test, expect } from '@playwright/test';
import { anosDecrescentes, escaparRegex, rotuloComContador } from '../../src/core/texto.ts';

test.describe('rotuloComContador', () => {
  /**
   * Rótulos reais capturados da árvore territorial do SIDRA em 2026-09-05.
   * Vários deles são prefixo ou sufixo uns dos outros — é o que torna a
   * ancoragem nas duas pontas obrigatória.
   */
  const NIVEIS_REAIS = [
    'Brasil [1/1]',
    'Grande Região [0/5]',
    'Unidade da Federação [0/27]',
    'Em Grande Região [0/27]',
  ];

  test('casa o nível pedido', () => {
    const regex = rotuloComContador('Unidade da Federação');

    expect(regex.test('Unidade da Federação [0/27]')).toBe(true);
    expect(regex.test('Unidade da Federação [27/27]')).toBe(true);
  });

  test('não casa outros níveis da mesma árvore', () => {
    const regex = rotuloComContador('Unidade da Federação');
    const outros = NIVEIS_REAIS.filter((n) => !n.startsWith('Unidade da Federação'));

    for (const nivel of outros) {
      expect(regex.test(nivel), `não deveria casar "${nivel}"`).toBe(false);
    }
  });

  /** Sem o `^`, `Grande Região` casaria `Em Grande Região` — nível diferente. */
  test('não casa um nível que apenas termina com o nome', () => {
    expect(rotuloComContador('Grande Região').test('Em Grande Região [0/27]')).toBe(false);
  });

  /** Sem o `$`, `Grande Região` casaria `Grande Região e UF`. */
  test('não casa um nível que apenas começa com o nome', () => {
    expect(rotuloComContador('Grande Região').test('Grande Região e UF [0/32]')).toBe(false);
  });

  /**
   * O `.nome-arvore` que envolve o nó anexa o ano de referência ao texto. Este
   * teste fixa o motivo de o componente ancorar no `.sidra-check` interno: se
   * alguém "simplificar" o locator para o elemento externo, este teste explica
   * por que o match some.
   */
  test('não casa o texto do elemento externo, que traz o ano anexado', () => {
    const regex = rotuloComContador('Unidade da Federação');

    expect(regex.test('Unidade da Federação [0/27] (Ano 2022)')).toBe(false);
  });

  test('escapa caracteres especiais do nome', () => {
    expect(rotuloComContador('Brasil (total)').test('Brasil (total) [1/1]')).toBe(true);
  });
});

test.describe('escaparRegex', () => {
  test('neutraliza metacaracteres', () => {
    const escapado = escaparRegex('a.b*c+d?');

    expect(new RegExp(`^${escapado}$`).test('a.b*c+d?')).toBe(true);
    expect(new RegExp(`^${escapado}$`).test('aXbYcZdW')).toBe(false);
  });
});

test.describe('anosDecrescentes', () => {
  /** Rótulos como o editor de período os exibe, com o texto de atualização. */
  const ROTULOS_REAIS = [
    '2022 - atualizado em 22/12/2023',
    '2010 - atualizado em 26/10/2023',
    '2000 - atualizado em 29/04/2009',
    '1991 - atualizado em 29/04/2009',
    '1872 - atualizado em 29/04/2009',
  ];

  test('extrai o ano de rótulos com texto anexado', () => {
    expect(anosDecrescentes(ROTULOS_REAIS)).toEqual(['2022', '2010', '2000', '1991', '1872']);
  });

  test('ordena decrescente mesmo se o site listar fora de ordem', () => {
    expect(anosDecrescentes(['1991', '2022', '2000'])).toEqual(['2022', '2000', '1991']);
  });

  /** Ordenação por string colocaria "999" depois de "2022". */
  test('ordena numericamente, não lexicograficamente', () => {
    expect(anosDecrescentes(['2022', '1991'])[0]).toBe('2022');
  });

  test('ignora rótulos sem ano', () => {
    expect(anosDecrescentes(['Total', '2022 - atualizado', 'sem ano'])).toEqual(['2022']);
  });

  test('devolve lista vazia quando não há anos', () => {
    expect(anosDecrescentes([])).toEqual([]);
    expect(anosDecrescentes(['Total'])).toEqual([]);
  });
});
