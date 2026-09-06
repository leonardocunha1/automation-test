# Mapa da interface do SIDRA

Referência do que foi observado no site ao construir a automação. Tudo aqui foi verificado ao
vivo em **2026-09-05** contra `https://sidra.ibge.gov.br/`, tabela 1209.

Este documento existe para que ninguém precise repetir a exploração: se um seletor quebrar, a
resposta provavelmente está aqui.

---

## 1. Home — como a busca funciona

A barra de busca **não fica visível ao carregar**. É preciso clicar na lupa do menu superior
para revelá-la.

| Elemento     | Seletor                               | Observação                                       |
| ------------ | ------------------------------------- | ------------------------------------------------ |
| Lupa do menu | `[title="Pesquisa Tabela"]`           | Revela o campo de busca.                         |
| Campo        | `input[placeholder="pesquisar"]`      | ⚠️ Existe **duas vezes** no DOM.                 |
| Confirmar    | `getByRole('button', { name: 'OK' })` | Digitar `1209` e confirmar leva direto à tabela. |

### Armadilha: campo de busca duplicado

O SIDRA renderiza dois campos `pesquisar` — o do header e uma cópia responsiva dentro de
`#sidra-pesquisa-sm`, exibida só em viewport estreito. **Ambos existem no DOM sempre**, o que
transforma um locator ingênuo em _strict mode violation_ assim que a cópia ganha role acessível.

A solução é filtrar pelo que está de fato visível:

```ts
page.locator('input[placeholder="pesquisar"]:visible').first();
```

### Buscar por número navega direto

Digitar `1209` e confirmar não abre uma tela de resultados: o SIDRA resolve no servidor e
redireciona para `/Tabela/1209`. Por isso o código espera a navegação em vez de assumir que o
clique já trocou de página:

```ts
await Promise.all([page.waitForURL(/\/[Tt]abela\/\d+/), botaoOk.click()]);
```

---

## 2. Página da tabela — sinais de carregamento

| Sinal                                 | O que indica                                              |
| ------------------------------------- | --------------------------------------------------------- |
| `body.carregado`                      | O bootstrap da página terminou.                           |
| `#panel-T .item-arvore`               | Os editores montaram (o territorial é o último).          |
| Texto `Realizando download dos dados` | Overlay de recálculo; **removido do DOM**, não escondido. |

### Armadilha: `body.carregado` não existe na home

A classe parece um sinal global, mas **só a página da tabela a possui**. Esperar por ela na home
dá timeout de 60s. Por isso o método vive em `TabelaPage`, não na `BasePage`.

### Por que não usar `waitUntil: 'load'`

O SIDRA mantém requests de telemetria abertas depois de a página já estar utilizável — `load`
só resolveria quando elas fechassem. O projeto usa `domcontentloaded` mais um sinal específico
de cada página.

---

## 3. Editores de dimensão — anatomia comum

Os painéis de **Variável**, **Grupo de idade** e **Ano** compartilham exatamente a mesma
estrutura. É isso que permite um único componente genérico cobrir os três.

```html
<div id="panel-C58" class="janela fixed">
  <div id="panel-C58-toggle" class="janela-comandos panel-heading">
    <div class="janela-titulo"><span>Grupo de idade [1/15]</span></div>
  </div>

  <button title="Somar elementos"></button>
  <!-- ∑ -->
  <button title="Marcar todos os elementos listados"></button>
  <button title="Desmarcar todos os elementos listados"></button>

  <div data-indice="0" class="item-lista">
    <div class="sidra-check checked">
      <button type="button" class="sidra-toggle" aria-selected="true"></button>
      <span class="nome">Total</span>
    </div>
  </div>
  <!-- ... demais itens ... -->
</div>
```

### Ids dos painéis

São derivados da dimensão pelo próprio SIDRA e estáveis entre sessões:

| Painel       | Dimensão                          |
| ------------ | --------------------------------- |
| `#panel-V`   | Variável                          |
| `#panel-C58` | Grupo de idade (classificação 58) |
| `#panel-P`   | Ano (período)                     |
| `#panel-T`   | Unidade Territorial               |

### Estado da marcação

`button.sidra-toggle[aria-selected]` reflete o estado **após o recálculo do servidor**. É o que
permite esperar o estado real em vez de dormir depois do clique — o SIDRA refaz a query a cada
marcação.

O contador no cabeçalho (`Grupo de idade [2/15]`) serve para assertar a seleção inteira, em vez
de confiar que cada clique deu certo.

### ⚠️ Armadilha central: tudo é toggle, nada é checkbox

**Nenhum controle do SIDRA é um checkbox comum.** Todos alternam: clicar em algo já marcado o
desmarca, silenciosamente e sem erro.

Isso obriga toda operação de marcação a ser idempotente — verificar o estado antes de agir. O
caso mais traiçoeiro é o **∑ (Somar elementos)**: como o site pode recuperar preferências de
sessão, um clique incondicional **desligaria** a soma numa segunda execução, e o CSV sairia com
duas colunas em vez da consolidada — sem nenhum sintoma de falha.

Quando a soma está ativa:

- o botão ganha a classe `active`;
- o cabeçalho passa de `Grupo de idade [2/15]` para `Grupo de idade - Soma [2/15]`.

O segundo é a confirmação de que o SIDRA **aplicou** a soma, e não só de que o botão ficou
destacado.

---

## 4. Grupos de idade da tabela 1209

⚠️ **A categoria "60 anos ou mais" não existe.** Buscar pelo texto literal do enunciado não
encontra nada.

Faixas disponíveis:

```
Total · 0 a 4 · 5 a 9 · 10 a 14 · 15 a 19 · 15 a 17 [2010, 2022] ·
18 e 19 [2010, 2022] · 20 a 24 · 25 a 29 · 30 a 39 · 40 a 49 ·
50 a 59 · 60 a 69 · 70 anos ou mais · Idade ignorada [1872, ...]
```

O recorte de 60+ é obtido marcando **`60 a 69 anos` + `70 anos ou mais`** e ativando o ∑.

Também é preciso **desmarcar o `Total`**, que vem selecionado por padrão e somaria a população
inteira ao recorte.

### Limitação: a soma não é nomeada

Com o ∑ ativo, o SIDRA consolida os valores mas **não rotula a coluna** — a linha de cabeçalho
do grupo de idade sai vazia no CSV:

```csv
"Unidade da Federação";"Ano x Grupo de idade"
"Unidade da Federação";"2022"
"Unidade da Federação";""        <- seria "60 anos ou mais"
"Rondônia";"196046"
```

Não há campo na interface para nomear a soma. Os valores estão corretos (conferidos contra o
Censo), mas o arquivo não se autodocumenta.

---

## 5. Editor territorial — a exceção

O painel `#panel-T` é o único que foge da anatomia comum: expõe uma **árvore** de níveis em vez
de uma lista plana.

```html
<li id="arvore-435e-1">
  <div class="item-arvore tem-filhos">
    <i class="expande collapsed"></i>
    <div class="nome-arvore" data-id="435e-1">
      <div class="sidra-check">
        <button type="button" class="sidra-toggle" aria-selected="false"></button>
        <span class="nome">Unidade da Federação <span class="contador">[0/27]</span></span>
      </div>
      (Ano 2022)
    </div>
  </div>
</li>
```

Marcar o **nó pai** marca todos os filhos de uma vez — é assim que as 27 UFs entram na seleção
com um clique só, sem iterar estado por estado.

### Níveis disponíveis

```
Brasil [1/1] · Grande Região [0/5] · Unidade da Federação [0/27] ·
Em Grande Região [0/27] · Brasil e Grande Região [6] ·
Brasil, Grande Região e UF [33] · Grande Região e UF [32]
```

`Brasil` vem marcado por padrão e adicionaria uma linha de total nacional ao recorte por UF. É
desmarcado **depois** de marcar as UFs — o SIDRA rejeita ficar sem nenhum território
selecionado.

### ⚠️ Armadilha: o sufixo invisível no rótulo

O elemento externo carrega o ano de referência solto no fim do texto:

```
.nome-arvore  → "Unidade da Federação [0/27] (Ano 2022)"
.sidra-check  → "Unidade da Federação [0/27]"
```

Como o regex precisa ser ancorado nas duas pontas (sem `$`, `Grande Região` casaria
`Grande Região e UF`; sem `^`, casaria `Em Grande Região`), o sufixo `(Ano ...)` derruba o
match. Por isso o componente ancora no **`.sidra-check` interno**, nunca no `.nome-arvore`.

Há um teste unitário que fixa exatamente esse caso, para explicar a quebra se alguém
"simplificar" o locator.

### Reordenação sem sinal observável

A árvore reordena os `<li>` ao marcar um nível pai, e o Playwright pode capturar o locator no
instante em que o nó antigo ainda está no DOM. Como a asserção seguinte é sobre o contador
`[n/total]`, que só repinta depois da reordenação, existe uma espera fixa de ~400ms
(`SETTLE.ARVORE_REORDENA`) — a **única** do projeto.

---

## 6. Anos disponíveis

O editor `#panel-P` lista em ordem decrescente, com texto anexado ao rótulo:

```
2022 - atualizado em 22/12/2023
2010 - atualizado em 26/10/2023
2000 · 1991 · 1980 · 1970 · 1960 · 1950 · 1940 · 1920 · 1900 · 1890 · 1872
```

`2022` já vem marcado por padrão, mas o código extrai e ordena numericamente mesmo assim:
depender da ordem de renderização quebra em silêncio quando o site muda.

---

## 7. Modal de download

| Elemento   | Seletor                                         | Observação                                 |
| ---------- | ----------------------------------------------- | ------------------------------------------ |
| Abrir      | `#botao-downloads`                              |                                            |
| Modal      | `#modal-downloads`                              | Ganha `.in` quando aberto (Bootstrap).     |
| Formato    | `#download-form select[name="formato-arquivo"]` |                                            |
| Compressão | `#download-cmp`                                 | "Comprimir (.zip)", desmarcado por padrão. |
| Disparar   | `#opcao-downloads`                              | Link cujo `href` o site reescreve.         |

### Formatos

`XLSX` (padrão) · `ODS` · `HTML` · `CSV (BR)` · `CSV (US)` · `TSV (BR)` · `TSV (US)`

O projeto usa **CSV (BR)** — separador `;` e vírgula decimal, padrão brasileiro que abre direto
no Excel pt-BR.

### Cuidados

- Há **vários** `select[name="formato-arquivo"]` na página (um por modal: links, downloads,
  quadro). É obrigatório escopar em `#download-form`.
- Com "Comprimir (.zip)" ligado o SIDRA entrega um `.zip`; salvá-lo como `.csv` produziria um
  arquivo com extensão mentirosa. O código normaliza o estado em vez de confiar no padrão.
- O `href` de `#opcao-downloads` é reescrito pelo site conforme as opções. **Clicamos no link**;
  em momento algum a URL é montada na mão.
- O `waitForEvent('download')` precisa ser armado **antes** do clique: o SIDRA responde com
  `Content-Disposition: attachment` e o evento dispara no mesmo tick.

---

## 8. Formato do CSV gerado

```csv
"Tabela 1209 - População, por grupos de idade"
"Variável - População (Pessoas)"
"Unidade da Federação";"Ano x Grupo de idade"
"Unidade da Federação";"2022"
"Unidade da Federação";""
"Rondônia";"196046"
...
"Distrito Federal";"365090"
"Fonte: IBGE - Censo Demográfico"

"Notas"
...
"Legenda"
...
```

O arquivo vem com **BOM** (para o Excel reconhecer o UTF-8) e quebras de linha CRLF.

### ⚠️ Armadilha: o cabeçalho imita uma linha de dado

`"Unidade da Federação";"2022"` casa com o padrão `"<texto>";"<número>"` e é indistinguível de
uma linha de dado **só pelo formato**. Isso causou um bug real: a validação acusava 28 linhas em
vez de 27.

O parser descarta explicitamente as linhas cujo território é o próprio rótulo da dimensão. Há
teste de regressão para isso.

---

## 9. Valor de referência

A soma nacional do recorte (27 UFs, 60+, 2022) é **32.113.490 pessoas**, que bate exatamente com
o divulgado pelo Censo 2022. Serve como conferência de sanidade ao mexer no fluxo.
