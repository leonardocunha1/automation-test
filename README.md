# Desafio Técnico – Automação RPA (SIDRA/IBGE, tabela 1209)

Automação em **Playwright + TypeScript** que navega pelo [SIDRA/IBGE](https://sidra.ibge.gov.br/)
a partir da página inicial, descobre a tabela **1209 – População, por grupos de idade** pela
própria interface do site, configura o recorte de **população com 60 anos ou mais por Unidade
da Federação** e baixa o resultado em CSV.

O arquivo gerado fica em [`dados/populacao_60mais_1209.csv`](dados/populacao_60mais_1209.csv).

> **Documentação técnica:** [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) (organização do código e
> decisões de design) e [`docs/SIDRA.md`](docs/SIDRA.md) (mapa da interface do site: seletores,
> anatomia dos painéis e armadilhas encontradas).

---

## Passo a passo de execução

```bash
# 1. Instalar dependências (baixa o Chromium do Playwright automaticamente)
npm install

# 2. Rodar a automação
npm start
```

Saída esperada:

```
[1] Abrindo a página inicial do SIDRA (https://sidra.ibge.gov.br/)
    ✓ Home carregada.

[2] Localizando a tabela 1209 pela busca da interface
    · Termo "1209" digitado na busca interna.
    ✓ Tabela 1209 aberta pela interface: Tabela 1209 - População, por grupos de idade (Vide Notas)

[3] Configurando o grupo de idade: 60 anos ou mais
    · Faixa marcada: 60 a 69 anos
    · Faixa marcada: 70 anos ou mais
    ✓ Faixas somadas em uma única coluna de 60 anos ou mais.

[4] Configurando o recorte territorial: Unidades da Federação
    ✓ 27 Unidades da Federação selecionadas.

[5] Selecionando o ano mais recente disponível
    ✓ Ano selecionado: 2022.

[6] Baixando o arquivo em CSV (BR)
    · Formato "CSV (BR)" selecionado, compressão desativada.
    ✓ Arquivo salvo em .../dados/populacao_60mais_1209.csv

[7] Validando o conteúdo do arquivo
    ✓ 27 UFs no arquivo — população total de 60 anos ou mais: 32.113.490 pessoas.

✅ Concluído em 7.1s — dados/populacao_60mais_1209.csv
```

A pasta `dados/` é criada automaticamente se não existir.

### Outros comandos

| Comando                | O que faz                                                |
| ---------------------- | -------------------------------------------------------- |
| `npm start`            | Execução normal (headless).                              |
| `npm run start:headed` | Abre o navegador para acompanhar a execução.             |
| `npm run start:debug`  | Navegador visível e ações desaceleradas (`SLOW_MO=250`). |
| `npm test`             | Roda testes unitários e o smoke E2E.                     |
| `npm run test:unit`    | Só os unitários (~1s, sem browser e sem rede).           |
| `npm run test:e2e`     | Só o smoke E2E contra o SIDRA real.                      |
| `npm run check`        | Typecheck + lint + formatação + unitários.               |

Variáveis de ambiente: `HEADLESS=false` mostra o navegador, `SLOW_MO=<ms>` desacelera cada ação.

---

## Dependências

- **Node.js 20+** (testado em v24.13.1)
- **playwright** `1.60.0` — driver de automação (só o Chromium é instalado)
- **typescript**, **tsx** — execução direta do TypeScript sem etapa de build
- **eslint**, **prettier**, **typescript-eslint** — qualidade de código

O `npm install` já dispara `playwright install chromium` via `postinstall`.

---

## Estratégia adotada

### Navegação — descobrindo a tabela pela interface

O enunciado proíbe abrir a URL da tabela diretamente. O caminho usado é o mesmo de um
usuário real:

1. Abre `https://sidra.ibge.gov.br/`;
2. Clica na **lupa do menu superior** (`title="Pesquisa Tabela"`), que revela o campo de busca;
3. Digita `1209` e confirma no botão **OK**;
4. O SIDRA resolve a busca e navega para a página da tabela.

Como salvaguarda contra falha silenciosa, o script **confere que chegou na tabela certa**
(número na URL + título em `#nome-tabela`) antes de configurar qualquer coisa. Sem isso, uma
mudança no ranking da busca faria o robô baixar a tabela errada sem reclamar.

> A única navegação por URL do projeto é a home. Por isso a `BasePage` **não** expõe um
> `goto(path)` genérico — seria um convite a burlar a regra sem querer.

### Arquitetura (Page Object Model)

```
desafio_ibge_1209.ts          # entrypoint: o roteiro do desafio, passo a passo
src/
  config/
    index.ts                  # parâmetros da extração (termo, faixas, formato, saída)
    timeouts.ts               # TIMEOUT / SETTLE nomeados e justificados
  core/
    browser.ts                # launch do Chromium + contexto com acceptDownloads
    logger.ts                 # log de etapas para o stdout
    arquivo.ts                # mkdir recursivo + saveAs
    validacao.ts              # conferência do CSV baixado
  pages/
    BasePage.ts               # utilitários comuns (espera, screenshot)
    SidraHomePage.ts          # busca e descoberta da tabela
    TabelaPage.ts             # expõe os editores tipados + download
  components/
    EditorDimensao.ts         # painel genérico de dimensão (Variável, Idade, Ano)
    SeletorTerritorial.ts     # árvore de níveis territoriais
    ModalDownload.ts          # formato, compressão e disparo do download
tests/
  unit/                       # lógica pura, sem browser (~1s)
  e2e/                        # smoke do fluxo real contra o SIDRA
playwright.config.ts          # projetos `unit` e `e2e`
```

O entrypoint lê como o enunciado, e nenhum seletor vaza para fora dos Page Objects:

```ts
const tabela = await home.buscarTabela('1209');
await tabela.grupoIdade.marcar('60 a 69 anos');
await tabela.grupoIdade.ativarSoma();
await tabela.territorio.marcarNivel('Unidade da Federação');
await tabela.selecionarAnoMaisRecente();
await tabela.baixar('CSV (BR)');
```

**Por que um componente genérico para os editores?** Os quatro painéis do SIDRA (Variável,
Grupo de idade, Ano, Unidade Territorial) compartilham exatamente a mesma anatomia — mesmo
cabeçalho com contador `[n/total]`, mesmos botões de marcar/desmarcar, mesma estrutura de
item. Um `EditorDimensao` parametrizado pelo id do painel cobre três deles; só a árvore
territorial precisou de componente próprio.

### Seletores estáveis

O SIDRA não tem `data-testid`, mas expõe âncoras melhores do que classes de layout:

| Alvo               | Seletor                                                    | Por quê é estável                                                                |
| ------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Painéis            | `#panel-C58`, `#panel-P`, `#panel-T`                       | Ids derivados da dimensão (C58 = classificação 58, P = período, T = território). |
| Estado de marcação | `button.sidra-toggle[aria-selected]`                       | Reflete o estado real após o recálculo do servidor.                              |
| Comandos           | `button[title="Somar elementos"]`                          | Rótulo funcional, não posicional.                                                |
| Download           | `#botao-downloads`, `#modal-downloads`, `#opcao-downloads` | Ids próprios do site.                                                            |

### Esperas explícitas

Nenhuma espera cega. Cada ação é confirmada pelo **estado** que ela deveria produzir:

- **Página pronta** → classe `carregado` no `<body>` (que o próprio SIDRA adiciona ao fim do
  bootstrap). Note que a home _não_ tem essa classe — só a página da tabela;
- **Item marcado** → `aria-selected="true"` no toggle;
- **Nível territorial aplicado** → contador do nó passa a `[27/27]`;
- **Soma ativa** → o cabeçalho do painel vira `Grupo de idade - Soma [2/15]`;
- **Download** → `page.waitForEvent('download')` armado _antes_ do clique.

Há uma única espera fixa no projeto (`SETTLE.ARVORE_REORDENA`), documentada no código com a
razão: a árvore territorial reordena os nós e não emite sinal DOM observável para isso.

### Testes

O entregável do desafio é o script CLI — os testes são uma camada extra que exercita os mesmos
Page Objects, sem alterar o entrypoint.

| Camada       | O que cobre                                                                 | Custo                        |
| ------------ | --------------------------------------------------------------------------- | ---------------------------- |
| `tests/unit` | Lógica pura: parser do CSV, regex da árvore territorial, ordenação de anos. | ~1s, sem browser nem rede.   |
| `tests/e2e`  | Um smoke do fluxo completo contra o SIDRA, assertando cada etapa.           | ~35s, depende do site no ar. |

A separação não é cerimônia: os unitários existem porque **um bug real foi encontrado
justamente nessa camada**. O parser contava 28 linhas em vez de 27, porque a linha de cabeçalho
`"Unidade da Federação";"2022"` é indistinguível de uma linha de dado só pelo formato. Isso só
apareceu ao rodar o fluxo inteiro por acaso; hoje há um teste de regressão de 1ms para ele.

Para viabilizar essa cobertura, a lógica pura foi extraída do I/O e dos Page Objects:

- `analisarCsv(conteudo, ...)` — regra de aceitação, testável sem tocar em disco;
  `validarCsv(caminho, ...)` só lê o arquivo e delega;
- `core/texto.ts` — `rotuloComContador`, `anosDecrescentes` e `escaparRegex`.

Os testes do `core/texto.ts` fixam as decisões que não são óbvias no código. Por exemplo, este
caso documenta _por que_ o componente ancora no `.sidra-check` interno e não no elemento que o
envolve:

```ts
test('não casa o texto do elemento externo, que traz o ano anexado', () => {
  expect(
    rotuloComContador('Unidade da Federação').test('Unidade da Federação [0/27] (Ano 2022)'),
  ).toBe(false);
});
```

O smoke E2E grava o CSV no diretório do próprio teste (`testInfo.outputPath`), então rodar os
testes **não** sobrescreve o entregável em `dados/`.

O lint inclui `eslint-plugin-playwright`, que barra `test.only` esquecido e `expect`
condicional — erros que passam pelo typecheck e produzem teste que "passa" sem asserir nada.

### Validação do resultado

Depois de gravar o arquivo, o script confere o que foi efetivamente salvo: que não está vazio,
que não é uma página de erro HTML, que tem exatamente 27 linhas de território e que a soma dos
valores é positiva. Um RPA que "termina com sucesso" gravando lixo é pior que um que falha alto.

O total conferido bate com o divulgado pelo Censo 2022: **32.113.490 pessoas** com 60 anos ou mais.

---

## Principais desafios encontrados

### 1. A tabela 1209 não tem a categoria "60 anos ou mais"

Esse foi o achado que mais mudou a implementação. Os grupos disponíveis na tabela são:

```
Total · 0 a 4 · 5 a 9 · 10 a 14 · 15 a 19 · 15 a 17 · 18 e 19 · 20 a 24 ·
25 a 29 · 30 a 39 · 40 a 49 · 50 a 59 · 60 a 69 · 70 anos ou mais · Idade ignorada
```

Não existe "60 anos ou mais". Uma busca pelo texto literal do enunciado simplesmente não
encontra nada. O recorte é obtido marcando **`60 a 69 anos` + `70 anos ou mais`** e ativando o
botão **∑ ("Somar elementos")** do editor, que o SIDRA consolida numa única coluna.

Também foi preciso **desmarcar o "Total"**, que vem selecionado por padrão e somaria a
população inteira ao recorte.

### 2. Toda marcação é um _toggle_ — idempotência não é opcional

Nenhum controle do SIDRA é um checkbox comum: todos alternam. Clicar em algo já marcado o
desmarca, silenciosamente e sem erro. O caso mais traiçoeiro era o ∑: como o site pode
recuperar preferências de sessão, um clique incondicional **desligaria** a soma numa segunda
execução, e o CSV sairia com duas colunas em vez da consolidada — sem nenhum sintoma de falha.

Por isso `marcar`, `desmarcar`, `marcarNivel` e `ativarSoma` verificam o estado antes de agir.
Validado rodando a automação duas vezes seguidas e comparando os arquivos: idênticos.

### 3. Texto de nó com sufixo invisível na árvore territorial

Localizar o nível "Unidade da Federação" por texto exato falhava de forma não óbvia:

```
.nome-arvore  → "Unidade da Federação [0/27] (Ano 2022)"
.sidra-check  → "Unidade da Federação [0/27]"
```

O elemento externo carrega o ano de referência no fim do texto. Como o regex precisa ser
ancorado no fim para não casar prefixos de outros níveis (`Grande Região` vs `Em Grande
Região`), a solução foi ancorar no `.sidra-check` interno.

### 4. Elementos ocultos disputando o seletor

Dois casos custaram depuração:

- `page.locator('h4').first()` pegava **"Acessar sua Conta"** — um `h4` de menu oculto que vem
  antes do título real no DOM. Corrigido ancorando em `#nome-tabela`;
- o campo de busca existe **duas vezes** (o do header e uma cópia responsiva em
  `#sidra-pesquisa-sm`), o que vira _strict mode violation_. Corrigido filtrando por `:visible`.

### 5. `body.carregado` só existe na página da tabela

A classe que sinaliza "bootstrap concluído" parecia um sinal global, mas a home não a possui —
esperar por ela lá dava timeout de 60s. O método ficou especializado na `TabelaPage`, e a
`BasePage` mantém apenas o `domcontentloaded`.

Usar `waitUntil: 'load'` não era alternativa: o SIDRA mantém requests de telemetria abertas
depois de a página já estar utilizável.

---

## Limitação conhecida

Com a soma ativada, o SIDRA **não nomeia a coluna resultante** — a linha de cabeçalho do grupo
de idade sai vazia no CSV:

```csv
"Unidade da Federação";"Ano x Grupo de idade"
"Unidade da Federação";"2022"
"Unidade da Federação";""        <- seria "60 anos ou mais"
"Rondônia";"196046"
```

Os valores estão corretos (conferidos contra o Censo), mas o arquivo não se autodocumenta. A
interface do SIDRA não oferece campo para rotular a soma. Quem preferir um CSV explícito pode
desativar a soma e entregar as duas faixas nomeadas — basta remover a chamada a `ativarSoma()`
no entrypoint; a validação continua funcionando.

---

## Restrições do desafio — como foram respeitadas

| Restrição                     | Como                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Iniciar pela home             | Única URL do projeto é `https://sidra.ibge.gov.br/` (`config.baseUrl`).                             |
| Não acessar a URL da tabela   | A tabela é alcançada por lupa → busca → OK. Não há `goto` para `/Tabela/...`.                       |
| Não usar a API REST do SIDRA  | Nenhuma requisição HTTP é feita pelo código; tudo passa pelo navegador.                             |
| Sem manipulação manual do DOM | Nenhum `page.evaluate` no código de produção — só `click()`, `fill()`, `selectOption()`, `check()`. |
| Esperas explícitas            | `waitFor` sobre estados reais; uma única espera fixa, justificada no código.                        |
