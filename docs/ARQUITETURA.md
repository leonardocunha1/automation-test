# Arquitetura

Como o projeto está organizado e por que cada decisão foi tomada. Para o mapa da **interface do
SIDRA** (seletores, anatomia dos painéis, armadilhas do site), veja [SIDRA.md](SIDRA.md).

---

## Visão geral

```
desafio_ibge_1209.ts          # entrypoint: o roteiro do desafio, passo a passo
src/
  config/
    index.ts                  # parâmetros da extração
    timeouts.ts               # TIMEOUT / SETTLE nomeados
  core/
    browser.ts                # launch do Chromium + contexto
    logger.ts                 # log de etapas para o stdout
    arquivo.ts                # mkdir recursivo + saveAs
    texto.ts                  # helpers puros (regex, ordenação)
    validacao.ts              # conferência do CSV baixado
  pages/
    BasePage.ts               # utilitários comuns
    SidraHomePage.ts          # busca e descoberta da tabela
    TabelaPage.ts             # editores tipados + download
  components/
    EditorDimensao.ts         # painel genérico de dimensão
    SeletorTerritorial.ts     # árvore de níveis territoriais
    ModalDownload.ts          # formato, compressão e disparo
tests/
  unit/                       # lógica pura, sem browser
  e2e/                        # smoke do fluxo real
```

O fluxo de dependências é sempre para baixo: `entrypoint → pages → components → core/config`.
Nenhum componente conhece o entrypoint, e `core/` não conhece Page Object nenhum.

---

## Decisões de design

### O entrypoint é um script CLI, não um runner de testes

O enunciado pede execução por linha de comando (`node desafio_ibge_1209.js`). Por isso
`npm start` usa o pacote **`playwright` puro**, não `@playwright/test`.

Os testes existem como camada extra e usam `@playwright/test`, exercitando os **mesmos** Page
Objects. Trocar o entrypoint por um runner descumpriria o enunciado.

### Não há `goto(path)` genérico na `BasePage`

O desafio proíbe abrir a URL da tabela diretamente — ela precisa ser descoberta pela interface.
Um `goto` na classe base seria um convite a burlar isso sem querer.

A **única** navegação por URL do projeto é `SidraHomePage.abrir()`, que aponta para a home.
Todo o resto acontece por clique. É uma restrição do desafio codificada na estrutura, em vez de
confiada à disciplina de quem escreve.

### Um componente genérico para os editores

Os painéis de Variável, Grupo de idade e Ano compartilham a mesma anatomia (mesmo cabeçalho com
contador, mesmos botões, mesma estrutura de item — ver [SIDRA.md](SIDRA.md#3-editores-de-dimensão--anatomia-comum)).
Um `EditorDimensao` parametrizado pelo id do painel cobre os três.

Só a árvore territorial foge do padrão e ganhou componente próprio.

### Toda operação de marcação é idempotente

Nenhum controle do SIDRA é um checkbox: **todos são toggle**. Clicar em algo já marcado o
desmarca, sem erro.

Por isso `marcar`, `desmarcar`, `marcarNivel` e `ativarSoma` verificam o estado antes de agir.
Não é defensividade gratuita — sem isso, uma segunda execução produziria um CSV diferente.
Verificado rodando a automação duas vezes seguidas e comparando os arquivos: idênticos.

### Esperas ancoradas em estado, não em tempo

Cada ação é confirmada pelo estado que ela deveria produzir:

| Ação                       | Confirmação                                           |
| -------------------------- | ----------------------------------------------------- |
| Página da tabela carregou  | `body.carregado` + `#panel-T .item-arvore`            |
| Item marcado               | `aria-selected="true"` no toggle                      |
| Nível territorial aplicado | contador do nó vira `[27/27]`                         |
| Soma ativa                 | cabeçalho vira `Grupo de idade - Soma [2/15]`         |
| Download                   | `waitForEvent('download')` armado **antes** do clique |

Existe **uma única** espera fixa no projeto: `SETTLE.ARVORE_REORDENA`. Ela cobre a reordenação
da árvore territorial, que não emite sinal DOM observável. Espera fixa é legítima quando não há
nada para observar — não como atalho para não descobrir o sinal certo.

### Configuração centralizada

Tudo que é "regra de negócio" da extração vive em `config/index.ts`: termo de busca, faixas
etárias, nível territorial, formato, caminho de saída. Os Page Objects não conhecem nenhum
literal específico da tabela 1209 — recebem tudo por parâmetro.

Isso é o que permitiria apontar a automação para outra tabela sem tocar nos componentes.

### Verificação contra falha silenciosa

Um RPA que "termina com sucesso" gravando lixo é pior que um que falha alto: ninguém percebe até
alguém abrir o dado. O projeto verifica em dois pontos:

1. **Antes de configurar** — confere que a busca levou à tabela 1209 (número na URL + título).
   Sem isso, uma mudança no ranking da busca faria o robô baixar a tabela errada sem reclamar.
2. **Depois de gravar** — confere que o arquivo não está vazio, não é uma página de erro HTML,
   tem exatamente 27 linhas de território e soma positiva.

---

## Camada de testes

| Camada       | Cobre                                              | Custo                        |
| ------------ | -------------------------------------------------- | ---------------------------- |
| `tests/unit` | Parser do CSV, regex da árvore, ordenação de anos. | ~1s, sem browser nem rede.   |
| `tests/e2e`  | Smoke do fluxo completo, assertando cada etapa.    | ~30s, depende do site no ar. |

A separação não é cerimônia: **um bug real foi encontrado justamente na camada pura**. O parser
contava 28 linhas em vez de 27 porque a linha de cabeçalho `"Unidade da Federação";"2022"` é
indistinguível de uma linha de dado só pelo formato. Só apareceu ao rodar o fluxo inteiro por
acaso; hoje há um teste de regressão de 1ms.

### Extração da lógica pura

Para viabilizar essa cobertura, a lógica testável foi separada do I/O e dos Page Objects:

- `analisarCsv(conteudo, ...)` decide; `validarCsv(caminho, ...)` só lê o arquivo e delega;
- `core/texto.ts` concentra `rotuloComContador`, `anosDecrescentes` e `escaparRegex`.

Os testes de `core/texto.ts` fixam decisões que não são óbvias lendo o código — por exemplo, por
que o componente ancora no `.sidra-check` interno e não no elemento que o envolve.

### Por que o E2E fica fora do `npm run check`

`npm run check` roda typecheck, lint, formatação e os **unitários**. O E2E depende do SIDRA no
ar, e um check que falha por instabilidade de site externo treina as pessoas a ignorar o check.

---

## Convenções

- **Idioma**: código e documentação em português, acompanhando o domínio (rótulos do IBGE).
- **Seletores** vivem dentro dos Page Objects e componentes; nunca no entrypoint ou nos testes.
- **Timeouts** são nomeados em `config/timeouts.ts`; nada de número mágico no meio do fluxo.
- **`page.evaluate` é proibido** no código de produção — o enunciado veda manipulação de DOM sem
  interação de usuário. Só `click()`, `fill()`, `selectOption()`, `check()`/`uncheck()`.
- **Lint**: `no-floating-promises` é `error`. Promise solta num script de automação é a origem
  clássica de flake — a ação acontece fora de ordem e o erro desaparece.
  `eslint-plugin-playwright` cobre os specs (`test.only` esquecido, `expect` condicional).

---

## Ambiente

`TIMEOUT` e `SETTLE` (`config/timeouts.ts`) são folgados de propósito: o SIDRA é uma SPA jQuery
antiga que refaz a query no servidor a cada clique. O gargalo é a resposta do IBGE, não a
renderização.

O contexto do navegador usa:

- `acceptDownloads: true` — sem isso `waitForEvent('download')` nunca resolve;
- `locale: 'pt-BR'` — mantém o site em português (os seletores são ancorados em rótulos em
  português) e o CSV com formatação numérica brasileira;
- viewport 1600x1000 — os quatro editores ficam lado a lado; em telas estreitas o SIDRA colapsa
  painéis e muda o comportamento dos cliques.

Variáveis de ambiente: `HEADLESS=false` mostra o navegador, `SLOW_MO=<ms>` desacelera cada ação.
