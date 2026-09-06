import { readFile } from 'node:fs/promises';

export interface ResultadoValidacao {
  linhasDeDados: number;
  somaTotal: number;
}

/**
 * Regra de aceitação do CSV, separada do I/O para ser testável.
 *
 * @param conteudo texto do CSV (com ou sem BOM).
 * @param territoriosEsperados quantas linhas de território o recorte deve conter.
 * @param rotuloDimensao rótulo da dimensão territorial, usado para descartar o cabeçalho.
 * @throws se o conteúdo não parecer o CSV esperado.
 */
export function analisarCsv(
  conteudo: string,
  territoriosEsperados: number,
  rotuloDimensao: string,
): ResultadoValidacao {
  const bruto = conteudo.replace(/^\uFEFF/, '');

  if (bruto.trim().length === 0) {
    throw new Error('O arquivo baixado está vazio.');
  }
  if (/<html/i.test(bruto)) {
    throw new Error('O SIDRA devolveu HTML em vez de CSV — provavelmente uma página de erro.');
  }

  const dados = extrairValores(bruto, rotuloDimensao);

  if (dados.length !== territoriosEsperados) {
    throw new Error(
      `O CSV tem ${dados.length} linhas de dados, mas o recorte pedia ${territoriosEsperados} territórios. ` +
        `Verifique se a seleção territorial foi aplicada.`,
    );
  }

  const somaTotal = dados.reduce((acumulado, valor) => acumulado + valor, 0);
  if (somaTotal <= 0) {
    throw new Error('O CSV foi baixado, mas todos os valores são zero ou inválidos.');
  }

  return { linhasDeDados: dados.length, somaTotal };
}

/**
 * Valores das linhas de dado, no formato `"<território>";"<valor>"`.
 *
 * As linhas de cabeçalho repetem o rótulo da dimensão e são descartadas: o formato
 * sozinho não as distingue de um dado. Ver `docs/SIDRA.md#8-formato-do-csv-gerado`.
 */
function extrairValores(bruto: string, rotuloDimensao: string): number[] {
  const valores: number[] = [];
  for (const linha of bruto.split(/\r?\n/)) {
    const match = /^"([^"]+)";"(\d+)"$/.exec(linha.trim());
    if (!match?.[2]) continue;
    if (match[1]?.trim() === rotuloDimensao) continue;
    valores.push(Number(match[2]));
  }
  return valores;
}

/** Lê o arquivo gravado e aplica `analisarCsv`. */
export async function validarCsv(
  caminho: string,
  territoriosEsperados: number,
  rotuloDimensao: string,
): Promise<ResultadoValidacao> {
  const conteudo = await readFile(caminho, 'utf8');

  try {
    return analisarCsv(conteudo, territoriosEsperados, rotuloDimensao);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    throw new Error(`${mensagem} Arquivo: ${caminho}`);
  }
}
