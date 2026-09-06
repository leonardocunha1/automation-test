/** Parâmetros da extração. Os Page Objects não conhecem literais da tabela 1209. */
export const config = {
  baseUrl: 'https://sidra.ibge.gov.br/',
  termoBusca: '1209',

  tabela: {
    numero: 1209,
    tituloEsperado: 'População, por grupos de idade',
  },

  /** A tabela 1209 não tem "60 anos ou mais": o recorte é a soma destas duas faixas. */
  faixasEtarias60Mais: ['60 a 69 anos', '70 anos ou mais'],

  nivelTerritorial: 'Unidade da Federação',
  /** Nível que o SIDRA marca por padrão; desmarcado para não poluir o recorte por UF. */
  nivelTerritorialPadrao: 'Brasil',
  totalUfsEsperado: 27,

  formatoDownload: 'CSV (BR)',
  arquivoSaida: 'dados/populacao_60mais_1209.csv',
  pastaCapturas: 'capturas',

  headless: process.env.HEADLESS !== 'false',
  slowMo: Number(process.env.SLOW_MO ?? 0),
} as const;
