/** Timeouts nomeados (ms). Ver `docs/ARQUITETURA.md` para os valores serem folgados. */
export const TIMEOUT = {
  TINY: 3_000,
  SHORT: 8_000,
  DEFAULT: 20_000,
  NAVIGATION: 45_000,
  HEAVY: 60_000,
  DOWNLOAD: 120_000,
} as const;

/** Espera fixa de settle de UI. Única do projeto — ver `docs/SIDRA.md`. */
export const SETTLE = {
  ARVORE_REORDENA: 400,
} as const;
