/** Log de execução em etapas numeradas para o stdout. */
let etapaAtual = 0;

function agora(): string {
  return new Date().toLocaleTimeString('pt-BR');
}

export const log = {
  /** Abre uma etapa de alto nível do fluxo. */
  etapa(mensagem: string): void {
    etapaAtual += 1;
    console.log(`\n[${etapaAtual}] ${mensagem}`);
  },
  /** Detalhe dentro da etapa corrente. */
  info(mensagem: string): void {
    console.log(`    · ${mensagem}`);
  },
  /** Confirmação de que um estado esperado foi atingido. */
  ok(mensagem: string): void {
    console.log(`    ✓ ${mensagem}`);
  },
  aviso(mensagem: string): void {
    console.warn(`    ! ${mensagem}`);
  },
  erro(mensagem: string): void {
    console.error(`    ✗ [${agora()}] ${mensagem}`);
  },
};
