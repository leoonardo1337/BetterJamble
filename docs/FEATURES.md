# BetterJamble — inventário de features

Levantamento de tudo que a extensão faz hoje, de onde vem cada dado e onde cada
coisa mora no código. Escrito na versão **3.2.2**, logo depois da separação do
antigo `gems.js` (~49 KB, tudo junto) em módulos.

Onde os arquivos rodam:

| Arquivo | Mundo | Papel |
|---|---|---|
| `content.js` | MAIN | exportação de compras (página de pedidos) |
| `live.js` | MAIN | badge de total vendido + lista de compradores da live |
| `gems-core.js` | MAIN | **camada de dados**: captura, estado, agregação, sorteio |
| `gems-transporte.js` | MAIN | protocolo de mensagens com o painel |
| `gems-bar.js` | MAIN | o botão redondo ao lado do diamante, que abre o painel |
| `bridge.js` | ISOLATED | ponte para `chrome.*` (a página não enxerga `chrome.*`) |
| `background.js` | service worker | abre/foca a janela do painel e roteia as mensagens |
| `painel.html` / `painel.js` | página da extensão | o painel (hoje só o esqueleto) |
| `popup.html` / `popup.js` | página da extensão | menu do ícone |
| `compras.html` / `compras.js` | página da extensão | tabela das compras exportadas |

---

## 1. Ranking de gemas

**O que faz.** Lista quem mandou gema, ordenado por total de gemas e, no empate,
por número de envios. Cada pessoa tem foto, @usuário, quantidade de envios e,
no escopo "todas as lives", em quantas lives apareceu.

**De onde vêm os dados.** Hook em `window.WebSocket`
(`gems-core.js:205-218`). A Jamble abre `wss://ws.jamble.com/websocket/show/<sellerId>/<showId>`
e manda pacotes `{"data":{"events":[...]}}`. Interessam os de
`event_type: "LIKE"`, que trazem `id`, `show_id`, `seller_id`, `user_id`,
`like_icon_id`, `like_icon_url`, `created_at` e `liker_profile` (`username`,
`profile_image.id`). Cada evento vira um envio em `ingerir()`
(`gems-core.js:232-287`); a agregação por pessoa é `ranking()` (`gems-core.js:332-352`).

**Preço de cada gema.** Não vem no evento: vem do catálogo
`/api/live/emojis?seller_id=&show_id=`, que dá `id`, `name`, `gemPrice` e
`iconUrl` de cada emoji. A extensão aproveita a chamada que o próprio site faz
(hook no `fetch`, `gems-core.js:132-138`) e, se o site não pedir, pede uma vez
por live (`garantirCatalogo()`, `gems-core.js:140-151`). Se o evento chegar antes
do catálogo, o valor cai para `like_icon_battle_entry_count`.

**Fotos.** A URL é montada como
`https://jamble.b-cdn.net/profiles/user_id=<uid>/profile_images/<imgId>.png`
(`avatarDoEvento()`, `gems-core.js:220-230`). Quando essa URL não existe, quem
desenha chama `resolverAvatar(userId)` e a extensão busca a oficial em
`/api/profile/full?user_id=` — no máximo 2 em paralelo, uma vez por pessoa
(`gems-core.js:155-186`).

**Estado.** Persistido em `localStorage['jamble:gems:v1']`: por live, o agregado
de cada pessoa (`{u, n, g, icons, last, a}`) e os ids de evento já contados.
O catálogo de preços vai em `jamble:gems:catalogo:v1` e as fotos resolvidas em
`jamble:gems:avatars:v1`.

**Limites conhecidos.**
- **Não existe histórico na API da Jamble.** Só entra gema que acontece com a
  aba aberta. Perdeu a live, perdeu o dado.
- 300 lives guardadas (`MAX_SHOWS`); passou disso, as mais antigas caem fora.
- 400 ids de evento por live para o anti-duplicata (`MAX_IDS_POR_SHOW`) e 4000
  ids em memória (`MAX_SEEN`). Numa live muito longa, um evento repetido
  depois de 400 outros pode ser contado duas vezes.
- A gravação é adiada 1,5 s (debounce) — fechar a aba no meio de uma rajada
  pode perder os últimos envios.

---

## 2. Filtro por tipo de gema

**O que faz.** Restringe tudo (ranking, feed, sorteio, totais, CSV) a um tipo de
gema: "Coração Pixel", "Carpa Zika", "Coroa", etc.

**De onde vêm os dados.** Do mesmo catálogo `/api/live/emojis`. A função
`catalogo()` (`gems-core.js:391-411`) devolve o catálogo da live na ordem
original da API, **já com quantos envios daquele tipo existem no escopo atual** —
é isso que permite mostrar no filtro quais tipos realmente apareceram. Tipos que
apareceram mas não estão no catálogo carregado entram no fim da lista, com nome
e preço deduzidos do próprio feed (`nomeDaGema`/`preco`, `gems-core.js:301-330`).

**Como é aplicado.** `ranking()` conta só `u.icons[filtro]` e recalcula o valor
como `envios × preço do tipo`; `feed()` e `feedDesde()` filtram por `e.ic`.

**Estado.** Volátil: o filtro é uma variável de sessão, não é gravado. Sai do ar
ao recarregar a página.

**Limite conhecido.** O recálculo `envios × preço` usa o preço **atual** do
catálogo. Se a Jamble mudar o preço de um emoji entre duas lives, o histórico
filtrado reflete o preço novo, não o da época.

---

## 3. Feed de envios (estilo console)

**O que faz.** Uma linha por gema enviada: hora, foto, @usuário, ícone, nome do
emoji e quanto valeu. Mais novo embaixo, rolagem presa no fim; se o usuário sobe
para ler, a rolagem para e aparece um atalho para voltar ao fim.

**De onde vêm os dados.** Os mesmos eventos `LIKE`. Cada envio é guardado em
`db.shows[showId].feed` e devolvido normalizado por `feed()`
(`gems-core.js:364-376`), do mais antigo para o mais novo (é a ordem em que o
console desenha). `feedDesde(seq)` (`gems-core.js:378-389`) devolve só o que é
novo, para o painel acrescentar no fim sem receber tudo de novo.

**Estado.** Persistido, mas só das **30 lives mais recentes**
(`MAX_SHOWS_COM_FEED`): nas demais o feed é apagado na gravação e sobra só o
agregado. Por live, **300 envios** (`MAX_FEED_POR_SHOW`). A consulta devolve no
máximo 250 por padrão.

**Limites conhecidos.**
- O `seq` (número de ordem dos envios) é de memória, não é persistido; ao
  recarregar a página ele é reatribuído a todos os envios guardados, em ordem de
  tempo (`gems-core.js:56-61`). Por isso o painel sempre recebe um pacote
  completo depois de uma recarga.
- Ordenação por `created_at` do evento. Se o relógio do servidor vier fora de
  ordem numa rajada, o desempate é pelo `seq`.

---

## 4. Ranking de compradores da live atual

**O que faz.** Quem mais gastou nesta live, com número de compras e valor total.

**De onde vêm os dados.** `/api/live/products?seller_id=&show_id=&section=sold`,
paginado pelo parâmetro `after` (até 40 páginas, `live.js:104-117`). `live.js`
aproveita a resposta quando o próprio site carrega a aba "Vendidos"
(`live.js:60-64`); senão busca sozinho. A agregação por comprador é
`compradoresDaLive()` (`live.js:121-139`), que usa `sold.buyerId`,
`sold.buyerUsername`, `sold.buyerAvatarUrl` e `sold.totalSoldPrice` (com
`soldPrice` como reserva) e **ignora vendas canceladas**.

**Como chega na interface.** `live.js` publica
`window.__jambleCompradores = {showId, at, lista}` e dispara o evento
`jamble:compradores`. `gems-core.js` escuta esse evento (`gems-core.js:551`) e
expõe a lista já normalizada em `compradores()` (`gems-core.js:413-421`).

**Estado.** **Totalmente volátil.** Nada vai para `localStorage` nem para
`chrome.storage`. Vale só enquanto a aba está aberta — decisão deliberada: a
extensão não guarda histórico de vendas de vendedores.

**Limites conhecidos.**
- Só a live aberta. Não existe "compradores de todas as lives".
- Precisa do `sellerId`, que sai do `/api/live/feed` ou, em último caso, do
  `src` de uma foto de produto (`img[src*="/products/user_id="]`).
- Uma re-busca completa roda a cada 3 s se a lista ainda não bater com a live
  atual (`garantirCompradores`, `live.js:258-270`).

---

## 4b. Ranking: gemas ou compradores (3.9.0)

O topo da aba Ranking usa as mesmas classes dos seletores do sorteio
(`sorteio-conf`, `sel-linha sem-botao`, `op sel`): uma linha com dois grupos
separados por divisória — **Ranking** (Gemas · Compradores) e **Somando**
(Nesta live · Todas as lives — o escopo, que vale para os dois tipos). Sem a
coluna do botão, a linha só empilha abaixo de 620 px. Em cima, um título no
formato do sorteio diz o que está na tela ("Ranking de gemas · nesta live")
e leva o olho. O card Compradores tem
um seletor **Valor total / Compras totais** que define a ordem e o número
grande de cada linha. Os compradores desta live vêm do snapshot; os de todas as
lives são pedidos à aba (`participantes` com `tipo: 'compradores'`, a mesma
lista da urna). As fichas de gema só aparecem no ranking de gemas.

O **olho** ao lado de "Ranking de" deixa só o ranking na tela: esconde os
seletores e as fichas, e deixa o título com o que está valendo. No ranking de compradores ele também troca
valores e quantidades por `***`; no de gemas os números continuam. Tipo,
métrica e olho ficam salvos no navegador (`bj-rk-tipo`, `bj-rk-metrica`,
`bj-rk-oculto`).

O olho do menu do card (modo privado, que borra e troca números por `***`)
**não vale para a aba Ranking** e some enquanto ela está aberta: são dois
olhos independentes, e o Ranking só obedece ao dele.

## 5. Sorteio

**O que faz.** Sorteia entre quem mandou gema. Dois modos:

- **Por quantidade** (`modo: 'peso'`): cada gema vale uma chance —
  `bilhetes = max(1, gemas)`. Quem mandou mais, ganha mais chance.
- **Por pessoa** (`modo: 'pessoa'`): todo mundo com 1 chance.

Mais a opção **Não repetir quem já ganhou**, que tira da urna quem está em
`jaGanharam`, e um histórico dos últimos vencedores.

**Não repetir ganhadores entre gemas e compradores** (terceira opção, ao lado
de "Confirmar presença no chat"): quem ganhou no sorteio de gemas fica fora do de compradores, e
vice-versa — independente de "não repetir quem já ganhou", que vale dentro do
mesmo tipo. A comparação é pelo id e também pelo @, porque o id de quem manda
gema e o de quem compra vêm de respostas diferentes da Jamble
(`ganhouNoOutro` em `gems-core.js`, `entreTipos` no pedido `sortear`; salva em
`bj-sorteio-entre-tipos`).

**Confirmação de presença.** Com "exigir presença" ligado, o palco mostra
"Aguardando presença no chat…" embaixo do vencedor e, em cima disso, dois
badges: **Já sorteado** (amarelo — a pessoa já ganhou com outra conta) e
**Ausente** (vermelho). Marcar um deles troca o texto por **Sortear novamente**
(sorteia com as mesmas opções) e grava o motivo na entrada do histórico
(`marcarMotivo`, mensagem `motivo-sorteio`), que aparece como badge ao lado do
nome. Clicar no badge marcado desmarca. Quem está marcado **sai da urna**
(mesmo sem "não repetir"), no painel e no `participantes()` da aba. Se o
vencedor escrever no chat antes de ser marcado, a presença é confirmada e os
badges somem; depois de marcado, a mensagem aparece mas o motivo continua (a
outra conta de quem já ganhou costuma escrever). O painel guarda os motivos que
marcou (`motivosMarcados`) e os reaplica em cada histórico que chega da aba,
para um pacote antigo não apagar o badge.

O card "Todas as lives" diz desde quando há registro:
"Todas as lives do canal desde dd/mm/aaaa", com o início da live mais antiga
guardada deste canal (com compras, no sorteio de compradores).

**De onde vêm os dados.** Do próprio ranking: `participantes()`
(`gems-core.js:463-470`) e `sortear()` (`gems-core.js:472-490`). O filtro de tipo
de gema **vale para o sorteio** — sortear com "Coroa" selecionado sorteia só
entre quem mandou coroa. O escopo é um parâmetro (`escopo: 'live' | 'vendedor'`),
com `'live'` como padrão de uso.

**Estado.** Volátil: `jaGanharam` (Set) e `historico` (20 últimos) só existem na
sessão. Recarregou, zerou.

**Limites conhecidos.**
- Sorteio por quantidade com alguém que mandou um "Foguete" (2000 gemas) dá a
  essa pessoa 2000 bilhetes contra 1 de quem mandou um coração — o resultado
  fica praticamente determinado. A interface precisa mostrar as chances para o
  usuário entender isso antes de clicar.
- Não há como sortear entre compradores (só entre quem mandou gema).

---

## 6. Ranking geral (todas as lives do vendedor)

**O que faz.** Soma todas as lives **daquele vendedor** que a extensão
acompanhou, em vez de só a aberta agora.

**De onde vêm os dados.** Do mesmo `db.shows`. A separação é por
`show.seller`, que é o **slug do vendedor na URL** (`/live/@lojinha/<showId>` →
`@lojinha`), gravado quando o primeiro envio daquela live chega
(`gems-core.js:248-252`). `livesDoEscopo('vendedor')` (`gems-core.js:293-300`)
filtra por esse slug.

Para deixar explícito o que está sendo somado, `livesDoVendedor()`
(`gems-core.js:439-458`) devolve a lista das lives daquele vendedor com
`{showId, atual, inicio, fim, pessoas, envios, gemas, temFeed}`.

**Estado.** Persistido junto com o resto em `jamble:gems:v1`.

**Limites conhecidos.**
- Só lives que a extensão viu. Não é o histórico do vendedor, é o **seu**
  histórico de ter assistido aquele vendedor. Esta é exatamente a confusão que o
  usuário relatou e que a nova interface precisa resolver.
- Se o vendedor mudar de @, as lives antigas ficam separadas das novas.
- Lives fora das 30 mais recentes perdem o feed, mas continuam somando no
  ranking (o agregado por pessoa sobrevive).

---

## 7. Badge de total vendido na aba "Vendidos"

**O que faz.** Ao lado da aba **Vendidos (n)** aparece um badge com a soma do que
já foi vendido na live (ex.: `R$ 741,00`). O `title` mostra quantas vendas, quanto
já foi pago e quantas estão canceladas. Vendas canceladas ficam fora da soma.

**De onde vêm os dados.** `summarize()` sobre os mesmos itens de
`/api/live/products?section=sold` (`live.js:141-153`). O desenho é `paint()`
(`live.js:171-199`), que injeta um `<span>` dentro do próprio botão da aba.

**Como evita demora e chamada repetida** (comportamento que não pode regredir):
- os ids de vendedor/live saem do `/api/live/feed` que o site já busca;
- a live de cima e a de baixo do carrossel são pré-carregadas
  (`prefetchNeighbors`, `live.js:229-234`);
- cada live fica em cache de sessão (`sessionStorage['jamble:live-totals:v1']`,
  60 lives);
- o total só é recalculado quando o número da aba muda;
- se o site carrega a aba "Vendidos", a resposta dele é aproveitada.

**Estado.** Cache de **sessão** (`sessionStorage`), some ao fechar a aba.

**Limite conhecido.** Um `MutationObserver` em `document.documentElement` com
`subtree: true` observa a página inteira — é barato porque o handler só lê um
botão, mas é o ponto mais sensível a mudanças de layout do site.

---

## 8. Exportação de compras

**O que faz.** Em `jamble.com/account/purchases` aparece o botão
**⬇ Exportar compras**. Ele clica em "Ver mais" até o fim da lista, lê os códigos
`JMB-…` da tabela, busca os detalhes de cada pedido, grava tudo e abre a página
de compras da extensão.

**De onde vêm os dados.** `/api/account/purchases` (lista, capturada do `fetch`
do próprio site) e `/api/account/purchases/<id>` (detalhe, buscado pela extensão
com 6 trabalhadores em paralelo, `content.js:117-131`). O token sai de
`localStorage['firebase:authUser:<key>'].stsTokenManager.accessToken`
(`content.js:48-54`), com o header capturado do site como reserva.

**Normalização.** `toRow()` (`content.js:134-165`) produz: pedido, produto,
imagem, loja, data, itens, preço (e produto/frete/taxas), situação, status da
entrega, etapa, transportadora, rastreio, link de rastreio, cidade e UF.

**Estado.** Persistido em `chrome.storage.local.purchases`
(`{at, falhas, rows}`), via `window.postMessage` → `bridge.js`.

**Limites conhecidos.**
- O código do pedido precisa ser lido do elemento que contém **só** ele: lendo a
  linha inteira, o código gruda no texto seguinte (`JMB-7H9CPBY` + `27 de set`) e
  a API falha (`content.js:60-77`).
- Para após 4 rodadas sem crescer a lista, ou 15 s sem resposta.
- Pedidos sem detalhe entram com o que veio da lista e são contados em `falhas`.
- **Segurança:** o único botão do site que a extensão clica é "Ver mais".

---

## 9. Página de compras (`compras.html`)

**O que faz.** Tabela das compras exportadas, com busca, filtros por
situação/transportadora/loja, ordenação por qualquer coluna, cartões de resumo
(total, pacotes, sem rastreio, em entrega), cópia do código de rastreio com um
clique, CSV e impressão.

**De onde vêm os dados.** `chrome.storage.local.purchases` (`compras.js:20-27`).
Recarrega sozinha quando o storage muda (`compras.js:170`).

**Estado.** Persistido (é a própria leitura do storage). Os filtros e a ordenação
são voláteis.

---

## 10. CSV do feed e do ranking

**O que faz.** Baixa o que está na tela em CSV com `;`, BOM UTF-8 e CRLF (abre
direto no Excel em português).

- **Feed:** Data/hora, Usuário, ID do usuário, Emoji, ID do emoji, Gemas, Live,
  Vendedor, ID do evento.
- **Ranking:** Posição, Usuário, Gemas, Envios, Lives, Último envio, Ícones.

**Onde vive.** Ficava em `gems.js` (`exportFeedCsv` e `exportCsv`). Na nova
arquitetura o painel tem todos os dados em mãos e **deve gerar o CSV sozinho**:
não há mensagem para isso no protocolo. Respeita o escopo e o filtro ativos.

---

## 11. Menu da extensão (`popup.html`)

**O que faz.** Mostra quantas compras estão salvas e quando foram exportadas,
mais dois atalhos: **Minhas compras salvas** (abre `compras.html`) e
**Exportar novas compras** (abre `jamble.com/account/purchases`).

**Estado.** Lê `chrome.storage.local.purchases`. Também apaga a chave `sales`,
resquício da página de histórico de vendas **que foi removida e não deve voltar**
(`popup.js:15`).

---

## 12. O botão na página (novidade da 3.7.0)

**O que faz.** Substitui a barra de 46 px que ficava embaixo da coluna dos
anúncios. É o ícone da extensão, sem fundo, da altura do círculo do diamante
(`button[aria-label="Recompensa por assistir"]`) e logo à direita dele. O resumo (gemas / pessoas / envios **desta live**) vai
na dica do mouse; o clique abre o painel.

**Onde vive.** `gems-bar.js`. O botão é `position:fixed` no `<body>`; o bloco do
campo de comentário ganha `margin-left` para abrir espaço, e a margem original
volta quando o botão sai (`posicionar` / `devolverCampo`). O ícone é
`icons/128.png` reduzido para 96 px e embutido em base64, para não precisar de `web_accessible_resources`.

**Extensão recarregada.** Com a aba aberta, o botão ganha um ↻ e o clique
recarrega a página.

**Limite conhecido.** Se o diamante não for encontrado, o botão cai para o
canto inferior direito (classe `bj-solta`) em vez de sumir.

---

## Resumo: o que é volátil e o que é persistido

| Dado | Onde | Sobrevive a quê |
|---|---|---|
| Agregado de gemas por pessoa/live | `localStorage: jamble:gems:v1` | recarga e fechar o navegador |
| Feed de envios (30 lives, 300 cada) | idem | idem |
| Catálogo de preços das gemas | `localStorage: jamble:gems:catalogo:v1` | idem |
| Fotos de perfil resolvidas | `localStorage: jamble:gems:avatars:v1` | idem |
| Compras exportadas | `chrome.storage.local.purchases` | idem |
| Total vendido por live | `sessionStorage: jamble:live-totals:v1` | só a sessão da aba |
| Ranking de compradores | memória (`window.__jambleCompradores`) | nada: morre na recarga |
| Escopo e filtro de gema | memória | nada |
| Histórico do sorteio / quem já ganhou | memória | nada |
| `seq` dos envios | memória (reatribuído na carga) | nada |

## Insights da tela Ao vivo (3.10.0)

Os indicadores (gemas, envios, vendido, compradores, tickets) e as leituras
dos Insights são **sempre só da live aberta e sem filtro de gema**, qualquer
que seja o escopo ("Todas as lives") ou o filtro escolhido no Ranking/Sorteio.
O snapshot traz um bloco `vivo` (`totais`, `ranking`, `catalogo` e os
horários do feed, calculados com escopo `live` e filtro desligado) só para
eles. Ranking, Sorteio e o feed de envios continuam seguindo escopo e filtro.

## Opções do sorteio no layout empilhado (3.10.1)

As duas linhas de seletores do sorteio ficam num grid só (`.sel-grade`, com
cada `.sel-linha` em `display:contents`). Largo, as três opções (checkboxes)
ficam numa linha embaixo dos seletores e o botão Sortear ocupa a coluna da
direita inteira, de cima a baixo; empilhado (bloco com menos de 860 px), as
opções ficam uma embaixo da outra, logo acima do botão. Os textos dos cards e das opções começam com maiúscula, sem ponto final.
