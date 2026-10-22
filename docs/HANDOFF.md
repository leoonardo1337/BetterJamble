# Handoff — construção da interface do painel

Para quem vai desenhar o painel sem ter acompanhado a conversa anterior.
A **camada de dados está pronta e testada**. O que falta é a interface.

Leia nesta ordem: este arquivo → `docs/PAINEL.md` (hierarquia e wireframes) →
`docs/FEATURES.md` (o que cada feature faz e de onde vêm os dados).

---

## 1. O que mudou nesta versão (3.2.1 → 3.2.2)

O card grande que ficava **dentro** da página da live deixou de existir. No lugar
dele há um **retângulo de 46 px de altura** com um botão **Abrir Painel**, que
abre uma **janela popup separada** com todo o conteúdo.

O antigo `gems.js` (49 KB, tudo junto) foi apagado e dividido em:

| Arquivo | Mundo | O que faz |
|---|---|---|
| `gems-core.js` | MAIN | **camada de dados**: WebSocket, catálogo, agregações, sorteio, persistência. Não desenha nada e não conhece o painel. |
| `gems-transporte.js` | MAIN | protocolo de mensagens com o painel. Coalesce rajadas, decide o que é snapshot completo e o que é delta. |
| `gems-bar.js` | MAIN | **só** o retângulo baixo na página e a geometria dele. |
| `bridge.js` | ISOLATED | ponte `window.postMessage` ↔ `chrome.*`, nos dois sentidos. |
| `background.js` | SW | abre/foca a janela única do painel e roteia as mensagens. |
| `painel.html` / `painel.js` | página da extensão | **esqueleto**, o seu trabalho. |

Nada mais mudou: `content.js` (exportação de compras), `live.js` (badge de total
vendido + compradores), `popup.*` e `compras.*` estão intactos e funcionando.

---

## 2. A decisão de arquitetura (e por quê)

### Escolha: página de extensão (`painel.html`) via `chrome.windows.create({type:'popup'})`

As duas opções reais eram:

**(A) `window.open('', 'betterjamble', 'popup,...')` a partir do script MAIN.**
Documento `about:blank` mesmo-origem, controlado por referência direta
(`win.document`). Dados fluem em memória, zero messaging, atualização instantânea.

**(B) Página da extensão aberta pelo background**, com os dados viajando
MAIN → `postMessage` → bridge → `chrome.runtime` → painel.

Avaliação honesta de (A), que é de fato mais simples e mais rápida:

- **CSP herdada, e isso mata.** Um `about:blank` aberto por `www.jamble.com`
  herda a origem **e a política de segurança** da Jamble. Se o site tiver
  `style-src` ou `img-src` restritivos (não dá para verificar daqui, e a Jamble
  pode mudar amanhã sem aviso), o `<style>` injetado ou as fotos do
  `jamble.b-cdn.net` simplesmente não carregam — e o sintoma é uma janela branca
  sem erro óbvio. Num painel que é 100% estilo e 100% imagem de perfil, esse é um
  risco de falha total.
- **Bloqueador de popup.** `window.open` só passa dentro do gesto do clique.
  Qualquer reabertura automática (depois de recarregar a página, por exemplo)
  exige um novo clique. Com (B), `chrome.windows.create` roda no service worker e
  não depende de gesto.
- **A janela morre junto com a referência.** Se a aba da Jamble recarregar, o
  novo script perde `win`. Dá para reatar por nome (`window.open('', 'nome')`),
  mas de novo só dentro de um clique — na prática o usuário vê uma janela
  congelada e tem que clicar de novo.
- **Cara de coisa errada.** A barra de endereço mostra `about:blank`.

O preço de (B) é encanamento (quatro saltos) e latência. Medido no harness: com
60 envios disparados em 6 rajadas dentro de ~400 ms, o painel recebeu **2
mensagens** e ficou correto. Os eventos de gema são de baixa frequência; a
latência de `postMessage` + `chrome.runtime` é irrelevante nessa escala.

**Portanto: (B).** Em troca, (B) traz CSP própria e previsível (a de extensão:
`<style>` e `<script src>` locais permitidos, inline `<script>` proibido,
imagens remotas liberadas), sobrevive à recarga da página, e é uma janela de
extensão de verdade.

### Como os pontos fracos de (B) foram resolvidos

| Problema | Solução, já implementada |
|---|---|
| **Estado inicial** — a janela nasce vazia | Ao conectar, o painel manda `painel-pronto`; o background traduz em `pedir-estado` para a aba; a aba responde com um snapshot **completo**. Não há janela de tempo em que o painel fique vazio sem pedir. |
| **Abrir duas vezes** | O background guarda o `windowId`. O segundo pedido faz `chrome.windows.update({focused:true})` na janela que já existe e manda `painel-reatar`, que faz o painel pedir o estado de novo (pode ser outra live). Nunca há duas janelas. |
| **Trocar de live com o painel aberto** | `gems-core` detecta a navegação (`pushState`/`replaceState`/`popstate` + rede de segurança de 1500 ms) e avisa com `motivo: 'nav'`. O transporte zera o contador e manda um snapshot **completo**. O painel, ao receber `completo: true`, **substitui tudo** — inclusive o feed. Validado no harness. |
| **A aba da Jamble recarregou** | O `bridge.js` novo avisa `bj-pagina-pronta` ao carregar. Se há painel conectado, o background manda `painel-reatar` para o painel e `painel-abriu` para a aba. Religa sozinho, sem clique. |
| **O service worker MV3 foi desligado e perdeu a quem o painel pertence** | A aba manda um **pulso a cada 4 s** enquanto o painel está aberto. Qualquer mensagem vinda de uma aba reatribui `abaDeOrigem` no background. A porta do painel também mantém o worker vivo. |
| **A aba da Jamble fechou** | A porta continua, mas o pulso para. O painel mostra "sem sinal há mais de 12 s" e esmaece os números, sem apagar a última foto. |
| **O painel fechou** | `onDisconnect` da porta (e `windows.onRemoved`) manda `painel-fechou` para a aba, que para de enviar qualquer coisa. |

### O que isto **não** exigiu

- **Nenhuma permissão nova.** `chrome.windows.create`, `chrome.tabs.create` e
  `chrome.tabs.sendMessage` não pedem permissão declarada. `permissions`
  continua só `["storage"]`.
- **Nenhum `web_accessible_resources`.** Nada da extensão é carregado dentro da
  página da Jamble: a barra é HTML/CSS inline e o painel é uma página de
  extensão. **Se você precisar de uma imagem da pasta `icons/` dentro da barra**,
  aí sim terá que adicionar `web_accessible_resources` — prefira emoji ou SVG
  inline e não mexa nisso.

---

## 3. A API da camada de dados

Tudo em `window.BetterJamble`, definido em `gems-core.js`. **Você não precisa
chamar nada disso no painel** — o painel recebe os dados já prontos pelo
protocolo da seção 4. A API interessa para (a) entender os formatos, (b) a barra
na página, (c) depuração no console da aba da Jamble.

### 3.1 Contexto

```js
BetterJamble.live()        // {showId, sellerSlug, sellerId} | null
BetterJamble.estaEmLive()  // boolean
```
`sellerSlug` é o `@` da URL (`/live/@lojinha/<showId>` → `"@lojinha"`), e é por
ele que o escopo "todas as lives" agrupa. `sellerId` é o uuid das APIs e pode
ser `null` até a página carregar as fotos dos produtos.

### 3.2 Escopo e filtro

```js
BetterJamble.escopo()              // 'live' | 'vendedor'
BetterJamble.definirEscopo('vendedor')   // avisa com motivo 'escopo'
BetterJamble.filtro()              // '' (todas) | 'pixel_heart' | ...
BetterJamble.definirFiltro('coroa')      // avisa com motivo 'filtro'
```
Os dois são voláteis: recarregou a aba, voltam ao padrão (`'live'`, `''`).

### 3.3 Consultas

Todas aceitam um **escopo explícito opcional**; sem ele vale o escopo atual.
A barra na página usa `totais('live')` justamente porque ela fala da live aberta
e não do que o usuário escolheu no painel.

```js
BetterJamble.ranking(escopo?)        // [LinhaRanking]  já ordenado
BetterJamble.feed(limite?, escopo?)  // [Envio]  antigo -> novo, padrão 250
BetterJamble.feedDesde(seq, escopo?) // [Envio]  só os com seq > n
BetterJamble.catalogo(escopo?)       // [Gema]
BetterJamble.compradores()           // [Comprador]  sempre a live aberta
BetterJamble.totais(escopo?)         // Totais
BetterJamble.livesDoVendedor()       // [ResumoDeLive]
BetterJamble.nomeDaGema(iconeId)     // string
BetterJamble.urlDaGema(iconeId)      // string ('' se não souber)
BetterJamble.precoDaGema(iconeId)    // number
```

Formatos:

```js
LinhaRanking = {
  id,        // user_id
  usuario,   // sem o '@'
  avatar,    // URL ou '' — já considera a foto resolvida pelo /api/profile/full
  gemas,     // soma em gemas (com o filtro aplicado)
  envios,    // número de envios (com o filtro aplicado)
  lives,     // em quantas lives do escopo apareceu
  ultimo,    // timestamp ms do último envio
  icones,    // {iconeId: quantidade}  — sempre o total, sem filtro
}

Envio = {
  id,        // id do evento (ou "<userId>-<timestamp>" se o evento não tiver)
  seq,       // ordem crescente (memória; reatribuída a cada carga da página)
  t,         // timestamp ms
  userId, usuario, avatar,
  iconeId, iconeNome, iconeUrl,
  gemas,     // valor em gemas deste envio
  showId, sellerSlug,
}

Gema = { id, nome, iconeUrl, preco, envios }
// `envios` = quantas vezes essa gema apareceu NO ESCOPO (0 = existe no catálogo
// mas ninguém mandou). Ordem = a do catálogo da Jamble; gemas fora do catálogo
// vão para o fim.

Comprador = { id, usuario, avatar, compras, valor }   // valor em reais

Totais = {
  pessoas, gemas, envios,   // seguem o escopo
  livesNoEscopo,            // 1 no escopo 'live'; n no escopo 'vendedor'
  compradores, vendasValor, vendasCount,  // SEMPRE a live aberta
}

ResumoDeLive = { showId, atual, inicio, fim, pessoas, envios, gemas, temFeed }
```

### 3.4 Sorteio

```js
BetterJamble.participantes({modo, semRepetir, escopo})
// -> [LinhaRanking + {bilhetes}]   só calcula, não sorteia
BetterJamble.sortear({modo, semRepetir, escopo})
// -> {vencedor: LinhaRanking|null, participantes, bilhetes, historico}
BetterJamble.historico()        // [{t, id, usuario, modo, escopo, filtro}]
BetterJamble.limparHistorico()  // também esvazia "quem já ganhou"
```
`modo`: `'peso'` (cada gema = 1 chance, `bilhetes = max(1, gemas)`) ou
`'pessoa'` (1 chance cada). `escopo` padrão: o atual — **mande sempre `'live'`
explicitamente** a não ser que o usuário tenha escolhido outra coisa.
O filtro de gema ativo **vale para o sorteio**.

### 3.5 Fotos de perfil

```js
BetterJamble.avatarDe(userId)              // '' se não houver
BetterJamble.resolverAvatar(userId)        // busca a oficial (1x por pessoa, 2 em paralelo)
BetterJamble.esquecerAvatar(userId, url)   // chame no onerror do <img>
```
No painel, use a mensagem `resolver-avatar` (seção 4.2) em vez de chamar direto.

### 3.6 Assinatura e eventos

```js
const cancelar = BetterJamble.assinar(({motivo, seq}) => { ... });
window.addEventListener('bj:atualizou', (ev) => ev.detail /* {motivo, seq} */);
```
São o mesmo canal; o evento no `window` existe para quem não quer acoplamento.
Avisos iguais no mesmo tick são juntados (coalescidos num microtask).

| `motivo` | Quando dispara | O que significa para a tela |
|---|---|---|
| `reset` | uma vez, ao carregar `gems-core.js` | estado inicial pronto |
| `nav` | trocou de live (ou saiu da live) | **jogue tudo fora e redesenhe** |
| `dados` | chegaram gemas novas pelo WebSocket | acrescente no fim, atualize números |
| `catalogo` | `/api/live/emojis` respondeu | nomes/ícones/preços podem ter melhorado |
| `compradores` | `live.js` republicou a lista | redesenhe só o card de compradores |
| `escopo` / `filtro` | o usuário mudou | **redesenhe tudo** |
| `avatar` | uma foto foi resolvida | troque a imagem, nada mais |
| `sorteio` | houve sorteio ou limpeza do histórico | redesenhe o histórico |

Mais duas funções usadas só pelo transporte:

```js
BetterJamble.estado({completo, desde, limiteFeed})  // monta o snapshot
BetterJamble.drenarNovos()  // [Envio] recém-chegados e ainda não anunciados (consome)
```

---

## 4. O protocolo do painel

O painel conversa por uma porta persistente: `chrome.runtime.connect({name: 'bj-painel'})`.
Toda mensagem tem a forma `{tipo, payload}`. **`painel.js` já implementa isto nas
funções `ligar()` e `aplicar()` — mantenha-as e troque só o desenho.**

### 4.1 Página → painel

#### `painel-estado` — o pacote principal

```js
{
  seq,            // maior seq já enviado; use como 'desde' mentalmente
  em,             // Date.now() de quando foi montado
  completo,       // true = substitua TUDO; false = delta
  live,           // {showId, sellerSlug, sellerId} | null
  escopo,         // 'live' | 'vendedor'
  filtro,         // '' | iconeId
  nomeDoFiltro,   // nome por extenso, pronto para a frase do estado vazio
  catalogo,       // [Gema]
  ranking,        // [LinhaRanking]      — SEMPRE completo
  compradores,    // [Comprador]         — SEMPRE completo
  totais,         // Totais
  livesDoVendedor,// [ResumoDeLive]
  historico,      // [{t,id,usuario,modo,escopo,filtro}]
  jaGanharam,     // [userId]
  feed,           // [Envio]  SÓ quando completo === true
  feedNovos,      // [Envio]  SÓ quando completo === false (pode vir vazio)
  celebrar,       // [Envio]  opcional: chegaram agora, para animação/toast
}
```

Regra de aplicação (já escrita em `absorver()`, `painel.js:75`):
`completo === true` → substitua o objeto inteiro, feed incluso.
`completo === false` → mescle os campos e **acrescente `feedNovos` no fim do
feed** que você já tem, cortando em 250 itens.

Quando chega:
- **completo**: ao conectar; depois de `painel-reatar`; ao trocar de live
  (`nav`); ao trocar escopo ou filtro. É enviado **na hora**, sem espera.
- **delta**: no máximo 1 a cada 250 ms, quando chegou gema, o catálogo melhorou,
  uma foto resolveu ou a lista de compradores mudou.

#### `painel-sorteio`
```js
{ vencedor: LinhaRanking|null, participantes: [...+bilhetes], bilhetes, historico }
```
Resposta direta a um `sortear`. `vencedor: null` = ninguém elegível.

#### `painel-pulso`
`{em}` a cada 4 s enquanto a aba está viva. Mais de 12 s sem pulso = mostre o
estado "sem sinal" (seção 7.5 do `PAINEL.md`). Já há um `setInterval` fazendo
essa checagem em `painel.js`.

#### `painel-reatar`
Vem do background quando o painel já existia e foi pedido de novo, ou quando a
aba recarregou. Ação: **descarte o estado local e mande `painel-pronto`.**

#### `painel-fechou`
A aba de origem sumiu. Mostre desconectado.

### 4.2 Painel → página

| `tipo` | `payload` | Efeito |
|---|---|---|
| `painel-pronto` | — | pede um snapshot completo. Mande ao conectar e ao receber `painel-reatar`. |
| `escopo` | `{escopo: 'live'\|'vendedor'}` | troca o escopo; volta snapshot completo |
| `filtro` | `{iconeId: ''\|id}` | troca o filtro; volta snapshot completo |
| `sortear` | `{modo, semRepetir, escopo}` | volta `painel-sorteio` |
| `limpar-historico` | — | zera histórico e "quem já ganhou" |
| `resolver-avatar` | `{userId}` | busca a foto oficial; chega como delta com a foto nova |
| `painel-fechou` | — | opcional (o `onDisconnect` já cobre) |

**Não existe mensagem para CSV.** O painel tem todos os dados: gere o arquivo
localmente (`Blob` + `<a download>`), respeitando escopo e filtro. Colunas em
`docs/FEATURES.md`, seção 10. Use `;`, BOM UTF-8 (`\uFEFF`) e CRLF.

### 4.3 O caminho completo, para depurar

```
WebSocket da Jamble
   ↓
gems-core.ingerir()  → avisar('dados')
   ↓
gems-transporte      → window.postMessage({tag:'jamble-ext', type:'painel-estado'})
   ↓
bridge.js (ISOLATED) → chrome.runtime.sendMessage({type:'bj-para-painel', msg})
   ↓
background.js        → porta.postMessage(msg)
   ↓
painel.js aplicar('painel-estado', payload)
```
E na volta: `porta.postMessage({tipo})` → background →
`chrome.tabs.sendMessage(abaDeOrigem, {type:'bj-do-painel'})` → bridge →
`window.postMessage({tag:'jamble-painel'})` → `gems-transporte`.

O card "Diagnóstico do transporte" do esqueleto mostra essa fila ao vivo; é a
primeira coisa a olhar quando nada aparece. **Mantenha algo equivalente**, nem
que seja escondido atrás de um atalho.

---

## 5. O que já está feito × o que falta

### Pronto e validado
- Camada de dados completa (`gems-core.js`), com a API da seção 3.
- Transporte dos dois lados (`gems-transporte.js`, `bridge.js`, `background.js`),
  com coalescência, snapshot completo × delta, pulso, janela única, reatamento.
- O retângulo na página (`gems-bar.js`), com a geometria e o desmonte na saída
  da live.
- `manifest.json` atualizado (versão 3.2.2, novos scripts na ordem certa).
- `node --check` limpo em todos os arquivos.
- Harness local (seção 9) com os números reais na seção 10.

### Falta — o seu trabalho
- **Toda a interface do painel.** `painel.html` + `painel.js` são um esqueleto
  cru, feito só para provar o transporte: um `<pre>` de diagnóstico, listas sem
  hierarquia e nenhum dos estados vazios do `PAINEL.md`.
- Pódio, animações (giro do sorteio, chegada de gema, contagem dos números),
  fichas de filtro, tela "Lives do vendedor", faixa de desconexão.
- Geração do CSV no painel.
- Responsividade da janela quando o usuário a redimensiona (hoje o grid do
  esqueleto é fixo em 2 colunas).

Reaproveitamento: o `gems.js` antigo foi apagado, mas o histórico tinha CSS bom
para pódio, feed estilo console e animações. Está tudo descrito em
`docs/FEATURES.md`; se precisar do CSS original, ele está no commit anterior da
pasta de deploy (`C:\Users\leozin\Documents\BetterJamble`), que ainda tem a
versão 3.2.1.

---

## 6. Linguagem visual

### Paleta: preto, branco e cinzas. **Nada de roxo.**
Isso foi pedido explicitamente. O `painel.html` já declara os tokens:

```css
--bj-fundo:#0a0a0a;  --bj-fundo2:#111;   --bj-fundo3:#161616;
--bj-borda:#272727;  --bj-borda2:#343434;
--bj-texto:#f2f2f2;  --bj-texto2:#a0a0a0; --bj-texto3:#6e6e6e;
--bj-claro:#f2f2f2;  --bj-sobreClaro:#0d0d0d;
```
Hierarquia por **peso, tamanho e contraste**, não por cor. Para destacar o
primeiro lugar: branco mais forte, borda clara, fundo um degrau acima — não uma
cor.

Única exceção tolerada: o badge verde do total vendido, que vive em `live.js`,
na página da Jamble, e não no painel. Não traga verde para o painel.

### ⚠️ Texto branco em botão claro — já reclamaram
O CSS antigo tinha `background: #e9e9f0; color: #fff` em dois lugares (o botão
"↓ novas" e o toast). Branco sobre branco. **Toda superfície clara usa
`--bj-sobreClaro` (#0d0d0d) como cor de texto.** Antes de entregar, procure por
`color:#fff` no mesmo bloco de um `background` claro.

### Emojis são permitidos
E são usados de propósito: 💎 gemas, 👑🥈🥉 pódio, 🏆 vencedor, 🎲 sorteio,
📅 lives, ⚠ avisos. Eles carregam a única "cor" da interface. Não troque por SVG
monocromático.

### Tipografia
`system-ui, -apple-system, "Segoe UI", sans-serif` para interface;
`ui-monospace, SFMono-Regular, Consolas, monospace` para o feed e qualquer
coluna de número. Números sempre com `font-variant-numeric: tabular-nums`.

### Movimento
Vale animar: chegada de gema, giro do sorteio, contagem dos números, entrada do
pódio. Tudo dentro de
`@media (prefers-reduced-motion: reduce) { animation: none !important }`.

### Idioma
Tudo em **pt-BR**: textos de tela, comentários do código, nomes de função.
Números com `toLocaleString('pt-BR')`; dinheiro com
`{style:'currency', currency:'BRL'}`; horas com `hour12: false`.

---

## 7. O botão na página — especificação

Implementado em `gems-bar.js`. Mexa aqui só se precisar.

```
 (💎)  (BJ)  [ Adicione um comentário...            ➤ ]
 15:19
```

- **Só o ícone**, sem fundo, com a altura e o topo do círculo do diamante
  (`button[aria-label="Recompensa por assistir"]`, o mesmo que o `resgate.js`
  usa). O círculo é o maior elemento quadrado do botão: o timer pendurado
  embaixo deixa o resto mais alto que largo. Ícone `icons/128.png` reduzido
  para 96 px e embutido em base64 (sem `web_accessible_resources`).
- **Posição:** logo à direita do diamante; o bloco do campo de comentário ganha
  `margin-left` para o botão caber, e a margem original é devolvida ao sair.
- **Dica (title)** sempre da **live aberta e sem filtro**: sai de
  `livesDoVendedor().find(l => l.atual)`, justamente para **não** seguir o escopo
  nem o filtro de gema que o usuário escolheu dentro do painel. Sem gema:
  *"nenhuma gema ainda nesta live"*.
- **Fallback:** sem diamante, ganha a classe `bj-solta` e vai para o canto
  inferior direito (44 px). Ele nunca simplesmente some.
- **Extensão recarregada:** ganha um ↻ e o clique recarrega a página.
- **Montar/desmontar:** some **na hora** em que o usuário sai da live
  (`pushState`/`replaceState`/`popstate`), e a margem do campo é devolvida. Um
  `setInterval` de 1500 ms é a rede de segurança.

---

## 8. Armadilhas conhecidas

1. **Foto de perfil de 1,5 MB.** O CDN
   `https://jamble.b-cdn.net/profiles/user_id=<uid>/profile_images/<id>.png`
   serve a imagem em tamanho cheio e **não aceita parâmetro de resize**. Já
   houve bug de imagem gigante por causa disso. **Sempre** limite por CSS
   (`width`/`height` fixos + `object-fit: cover`) e use `loading="lazy"`.
2. **Foto que não existe.** A URL montada pelo evento às vezes dá 404. Trate o
   `onerror`: troque pelas iniciais e mande `resolver-avatar`. Nunca deixe o
   ícone de imagem quebrada.
3. **A barra/painel são filhos do `<body>` e `position:fixed`.** O React da
   Jamble desmonta a página da live mas não encosta neles. Se você criar
   qualquer outro elemento fixo na página, ele **tem que** sumir junto na
   navegação — este foi um bug real (card pendurado por cima da home).
4. **Não existe histórico de gemas na Jamble.** Nenhum endpoint. Se o usuário
   pedir "as gemas da live passada", a resposta é que não dá. O estado vazio tem
   que dizer isso (seção 7.2 do `PAINEL.md`).
5. **`seq` não é persistido.** Ele é reatribuído a cada carga da página. Nunca
   guarde `seq` fora da sessão nem use como chave estável — para isso existe
   `Envio.id`.
6. **Três arquivos embrulham `window.fetch`** (`content.js`, `live.js`,
   `gems-core.js`), em cadeia. Se adicionar outro hook, **sempre** guarde o
   `fetch` anterior e chame-o; nunca chame `window.fetch` de dentro do seu
   próprio wrapper (laço infinito).
7. **`gems-core.js` embrulha `window.WebSocket` no carregamento.** Ele precisa
   rodar antes de a Jamble abrir o socket — por isso `run_at: document_start`.
   Não mude isso, e não mude a ordem dos scripts no manifest
   (`gems-core` → `gems-transporte` → `gems-bar`).
8. **Compradores é volátil e só da live aberta.** `window.__jambleCompradores`
   morre na recarga, e não existe versão "todas as lives". A interface não pode
   sugerir que existe.
9. **A extensão não grava mais histórico de vendas de vendedores.** Essa feature
   foi removida de propósito. `popup.js` ainda apaga a chave `sales` do storage.
   **Não ressuscite.**
10. **Preço de gema muda com o tempo.** O filtro recalcula
    `envios × preço atual`. Números filtrados de lives antigas podem não bater
    com o total não filtrado. É aceitável; só não prometa exatidão histórica.
11. **O `MutationObserver` de `live.js`** observa `document.documentElement`
    inteiro. É barato hoje, mas se você adicionar observers parecidos, some o
    custo antes.
12. **Nada de inline `<script>` no `painel.html`.** A CSP de extensão proíbe.
    Use `<script src="painel.js">`. `<style>` inline é permitido.
13. **CSS da barra não pode vazar.** Todas as classes dela começam com `bj-` e
    vivem num `<style id="bj-barra-style">`. Nunca estilize seletores genéricos
    (`button`, `div`) dentro da página da Jamble.
14. **Rolagem presa no fim.** Reimplemente a lógica do feed: só prenda se o
    usuário já estava a menos de ~50 px do fim, e ignore eventos de rolagem
    gerados por você mesmo (marque o instante e descarte por ~300 ms). Sem isso,
    o feed "briga" com quem está lendo.
15. **Live com gemas de outra live.** `feedDesde()` filtra por escopo, mas o
    `seq` é global. Se você implementar algum cache próprio por `seq`, lembre
    que os números pulam quando outra aba/live recebe gema.

---

## 9. Como rodar o harness

Não dá para testar na jamble.com real a partir daqui (precisa da sessão logada do
usuário). O harness serve uma página falsa que imita o DOM relevante da live e os
endpoints `/api/live/*`, e carrega os arquivos da extensão por `<script src>`.

**Onde está:**
```
C:\Users\leozin\AppData\Local\Temp\claude\C--Users-leozin-AppData-Roaming-Claude-scratch-workspaces-3a5b7040-f582-4d12-a314-2c3f1c5bd6e2-6c969ede-dc6a-40ec-b498-a6351402774c-scratch-2026-09-15-d37f49\0512bcf1-5de8-4cfa-8318-f171d362e92f\scratchpad\harness\
  server.py    servidor + endpoints falsos
  live.html    a página falsa da live + o papel de bridge.js/background.js
```

**Rodar:**
```bash
cd <pasta do harness>
python -I server.py 8777
# abra http://127.0.0.1:8777/live/@lojinha/show-aaa1
```
`server.py` roda em **primeiro plano** e nunca termina sozinho (é um
`serve_forever`). Rode-o num terminal só dele: se ele for lançado como tarefa de
segundo plano gerenciada pelo agente, o processo morre junto com o shell no fim
do turno e o próximo acesso dá "conexão recusada" — foi exatamente o que
aconteceu aqui, e **não é defeito do harness**. Para rodar destacado de verdade:

```bash
(python -I server.py 8777 > harness-server.log 2>&1 &)
curl -s -o /dev/null -w "%{http_code}
" http://127.0.0.1:8777/api/live/emojis   # 200
```

Se o painel do navegador recusar a navegação para `127.0.0.1` ("denied or
failed"), use `preview_start` com a URL em vez de `navigate`: é o jeito de
registrar a origem local no painel.

O servidor lê os arquivos da extensão de
`C:\Users\leozin\AppData\Roaming\Claude\scratch-workspaces\...\BetterJamble`
(constante `EXT` no topo do `server.py`, sobrescrevível pela variável de
ambiente `BJ_EXT_DIR`). Não precisa reiniciar o servidor depois de editar um
`.js` ou o `painel.html`: basta recarregar a página.

**O que o harness imita:**
- o grid do site: `.grid` (CSS grid com `grid-template-columns: 420px 1fr` e
  `grid-template-rows: 700px`) contendo `.coluna` (flex column de 700 px) com as
  abas `Disponíveis (4)` / `Vendidos (3)` — é exatamente o que
  `cardDosAnuncios()` e `areaDaColuna()` procuram;
- fotos de produto com `src` contendo `/products/user_id=seller-123/`, que é como
  a extensão descobre o `sellerId`;
- `GET /api/live/emojis` (4 gemas: Coração 1, Carpa 50, Coroa 500, Foguete 2000),
  `/api/live/products?section=sold` (4 vendas, uma cancelada),
  `/api/live/feed`, `/api/profile/full`;
- um **WebSocket falso** instalado antes dos scripts da extensão, para que
  `gems-core` o embrulhe como embrulharia o de verdade;
- o papel de `bridge.js` + `background.js`: o painel abre num `<iframe>` e as
  mensagens são roteadas nos dois sentidos. `painel.js` detecta a ausência de
  `chrome.*` e usa `window.postMessage` automaticamente (função `ligar()`).

**Utilitários no console da página (objeto `BJH`):**
```js
BJH.gema('ana', 'coroa', 2)   // dispara 2 eventos LIKE de @ana com Coroa
BJH.chuva(20)                 // 20 envios variados, de 6 pessoas
BJH.navegar('show-bbb2')      // troca de live por pushState, sem recarregar
BJH.abrirPainel()             // abre o iframe do painel
BJH.fecharPainel()
BJH.painelDados()             // o último estado que o painel montou
BJH.registro()                // fila de mensagens que passaram pelo transporte
localStorage.clear()          // zera tudo e recarregue para começar limpo
```

**O que o harness NÃO cobre** (tem que ser testado no Chrome de verdade, com
`chrome://extensions` → Modo do desenvolvedor → Carregar sem compactação):
a janela popup real, a unicidade da janela, o `chrome.storage`, o service worker
sendo desligado, e o comportamento com a aba recarregando.

---

## 10. Checklist de aceitação

### Camada de dados e transporte (já verificado no harness — os números são reais)

- [x] Barra montada na coluna dos anúncios: **420 × 46 px** em `top: 670`, com a
      coluna de 700 px encolhida para **640 px**.
- [x] A barra **não** segue o escopo nem o filtro do painel: com `escopo=vendedor`
      e `filtro=coroa` no painel (ranking de 1 pessoa), a barra seguiu em
      `3.005 gemas · 3 pessoas · 8 envios`.
- [x] 8 envios de 3 pessoas → ranking `caio=2000g`, `ana=1000g`, `bia=5g`;
      totais `3.005 gemas / 3 pessoas / 8 envios`.
- [x] Catálogo com preço e contagem: `pixel_heart:1:5`, `carpa_zika:50:0`,
      `coroa:500:2`, `foguete:2000:1`.
- [x] Compradores vindos de `live.js`: `ana R$ 165,50 (2)`, `bia R$ 89,90 (1)`;
      a venda cancelada de R$ 300 **fora** da soma. Badge: `Vendidos (3) R$ 255,40`.
- [x] Abrir painel → `painel-abrir` → `painel-pronto` → `painel-estado`
      com `completo=true`, e os deltas seguintes com `completo=false`.
- [x] 60 envios em 6 rajadas (~400 ms) → **apenas 2** mensagens de estado;
      painel com `feed=60`, `ranking=6`, `seq=60`. Coalescência funcionando.
- [x] Filtro `coroa` → ranking só com `ana=1000`, feed com 2 itens,
      `nomeDoFiltro = "Coroa"`.
- [x] Escopo `vendedor` com 2 lives → `lives=2`, `3.655 gemas`, `5 pessoas`,
      feed de 12 (soma das duas); escopo `live` → `3.155 gemas`, `4 pessoas`.
- [x] Sorteio por quantidade com filtro: `4 participantes · 3.155 chances`,
      vencedor devolvido com histórico.
- [x] Troca de live com o painel aberto → snapshot `completo`, ranking e feed
      **zerados** para a live nova; `livesDoVendedor` lista as duas.
- [x] Sair da live por `pushState` → barra removida **no mesmo tick**, altura
      original do card devolvida (`style.height` volta a `""`); voltar para a
      live remonta na mesma geometria.
- [x] Dedupe por `id` de evento sobrevive à recarga (eventos repetidos depois do
      `localStorage` carregado são descartados).
- [x] Botão "Exportar compras" **não** aparece em páginas de live.
- [x] `node --check` limpo em: `content.js`, `live.js`, `gems-core.js`,
      `gems-transporte.js`, `gems-bar.js`, `bridge.js`, `background.js`,
      `painel.js`, `popup.js`, `compras.js`; `manifest.json` é JSON válido.

### Interface do painel (a verificar quando você terminar)

- [ ] Abrir o painel duas vezes **não** cria duas janelas: a segunda vez foca a
      que existe e ela recarrega o estado.
- [ ] Recarregar a aba da Jamble com o painel aberto: o painel volta a receber
      dados **sem** nenhum clique.
- [ ] Fechar a aba da Jamble: o painel mostra "sem sinal" em até ~12 s, mantém a
      última foto na tela e esmaece os números.
- [ ] Fechar o painel: a aba para de enviar (o `setInterval` do pulso silencia).
- [ ] Trocar de live com o painel aberto: ranking, feed e compradores trocam
      juntos, sem resto da live anterior.
- [ ] Abrir o painel numa live sem nenhuma gema mostra o estado vazio da seção
      7.2 do `PAINEL.md` — **sem** pódio vazio e **com** a explicação do
      histórico.
- [ ] Filtrar por uma gema que ninguém mandou mostra a frase com o nome da gema
      e o botão de limpar.
- [ ] O escopo é compreensível sem explicação: diz "as N lives de @fulano que
      você acompanhou", com o período.
- [ ] Compradores continua rotulado "desta live" quando o escopo é o vendedor, e
      explica por quê.
- [ ] A tela "Lives do vendedor" lista as lives com números e marca a atual.
- [ ] No sorteio dá para ver quem está na urna e com que % antes de clicar.
- [ ] O filtro de gema ativo aparece por extenso na tela de sorteio.
- [ ] Nenhuma superfície clara com texto branco (procure `color:#fff`).
- [ ] Nenhum roxo no painel nem na barra (procure `purple`, `violet` e
      gradientes herdados do CSS antigo). **Exceção:** `compras.html` tem a
      etiqueta `.p-roxo` para o status "em entrega" — é a página de compras
      antiga, está fora deste trabalho, **não mexa nela**.
- [ ] Fotos de perfil com tamanho fixo por CSS; nenhuma imagem maior que 64 px
      na tela.
- [ ] Feed preso no fim, com `↓ n novas` quando o usuário sobe.
- [ ] CSV do feed e do ranking saem corretos no Excel em pt-BR (`;`, BOM, CRLF).
- [ ] `prefers-reduced-motion` desliga todas as animações.
- [ ] A janela funciona redimensionada (mínimo útil ~900 px de largura).
- [ ] `node --check` continua limpo e a extensão carrega por "Carregar sem
      compactação" sem erro no `chrome://extensions`.
- [ ] Nada quebrou: badge de total vendido, exportação de compras,
      `compras.html` e o menu do ícone continuam funcionando.
