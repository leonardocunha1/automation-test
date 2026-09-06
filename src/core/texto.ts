/** Helpers de texto puros — sem `Page`, sem I/O. Cobertos por `tests/unit/texto.spec.ts`. */

/** Escapa um literal para uso dentro de `new RegExp(...)`. */
export function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Regex que casa o rótulo de um nó da árvore territorial com seu contador.
 *
 * Ancorada nas duas pontas: sem `$`, `Grande Região` casaria `Grande Região e UF`;
 * sem `^`, casaria `Em Grande Região`.
 *
 * @example rotuloComContador('Unidade da Federação') casa "Unidade da Federação [0/27]"
 */
export function rotuloComContador(nome: string): RegExp {
  return new RegExp(`^\\s*${escaparRegex(nome)}\\s*\\[\\d+/\\d+\\]\\s*$`);
}

/** Anos extraídos dos rótulos do editor de período, do mais recente ao mais antigo. */
export function anosDecrescentes(rotulos: string[]): string[] {
  return rotulos
    .map((rotulo) => /\b(\d{4})\b/.exec(rotulo)?.[1])
    .filter((ano): ano is string => Boolean(ano))
    .sort((a, b) => Number(b) - Number(a));
}
