import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Download } from 'playwright';

/**
 * Persiste o download, criando a árvore de pastas se preciso.
 *
 * @returns caminho absoluto do arquivo salvo.
 */
export async function salvarDownload(download: Download, destinoRelativo: string): Promise<string> {
  const destino = resolve(process.cwd(), destinoRelativo);
  await mkdir(dirname(destino), { recursive: true });
  await download.saveAs(destino);
  return destino;
}
