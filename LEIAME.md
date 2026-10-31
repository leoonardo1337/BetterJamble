# WiseLive

Extensão do Chrome (não oficial) para a Jamble:

## 1. Exportar compras

Na página `jamble.com/account/purchases` aparece o botão **⬇ Exportar compras** ao lado da busca.
Ele carrega todos os pedidos (clicando em "Ver mais" até o fim), busca os detalhes de cada um e
**abre a página de compras da extensão** com: loja, preço, situação, transportadora, status da entrega,
código e link de rastreio, pedido, produto, data e itens.

A página tem busca, filtros por situação/transportadora/loja, ordenação por qualquer coluna,
resumo com totais, cópia do código de rastreio com um clique, CSV e impressão/PDF.
Os dados ficam salvos no armazenamento da extensão — dá para reabrir pelo menu, sem exportar de novo.

## 2. Total vendido na live
Em `jamble.com/live/...`, ao lado da aba **Vendidos (n)** aparece um badge verde com a soma
de tudo que já foi vendido na live (ex.: `R$ 741,00`). Passando o mouse, mostra quantas vendas
e quanto já foi pago. Vendas canceladas ficam de fora da soma.

Como ele evita demora e chamadas repetidas:

- os ids de vendedor/live saem do `/api/live/feed` que o site já busca, então não há espera;
- a live de cima e a de baixo do carrossel são pré-carregadas, e trocar mostra o valor na hora;
- cada live fica em cache na sessão, então voltar é instantâneo;
- o total só é recalculado quando a contagem da aba muda (venda nova ou cancelamento);
- se o próprio site carrega a aba "Vendidos", a extensão aproveita a resposta em vez de repetir a chamada.

## 3. Gemas: painel de ranking, feed e sorteio

Nas lives aparece o **ícone da extensão** ao lado do diamante (o botão de
recompensa, à esquerda do campo de comentário), da altura do círculo dele.
Passando o mouse, mostra o resumo da live; clicando, abre o painel numa
**janela separada**, com espaço de verdade:

- **Ao vivo** — dois cards lado a lado: à esquerda um card com menu próprio
  (Ranking · Sorteio · Insights) e à direita o feed de envios estilo console
  (mais novo embaixo, rolagem presa no fim), sempre visível;
- **Resumo das Lives** — em breve: por enquanto a tela só avisa que novas
  features estão sendo preparadas.

Dentro do card da esquerda:

- **Ranking** — pódio e lista de quem mandou gema, com o escopo e o filtro;
- **Sorteio** — sorteia entre quem mandou gema, em dois modos: **por quantidade
  de gemas** (mais gemas, mais chances) ou **1 por pessoa**; com a opção de não
  repetir quem já ganhou, a urna visível antes de clicar e histórico dos últimos
  vencedores; com a presença exigida, o vencedor que não aparece pode ser marcado
  como **Já sorteado** ou **Ausente** (o motivo fica no histórico) e há um atalho
  para **Sortear novamente**;
- **Insights** — os quatro indicadores (gemas, pessoas, envios, vendido),
  leituras calculadas em cima do que já foi capturado (concentração do topo,
  média por pessoa, gema que mais rendeu, ritmo de envios, quantos compradores
  também mandaram gema) e o ranking de compradores desta live.

O **escopo** (só esta live × todas as lives do vendedor) fica em cima do ranking,
escrito por extenso. O **filtro por tipo de gema** (Coração Pixel, Carpa Zika,
Coroa…) vale para o ranking, o feed e o sorteio. O CSV exporta o feed com data,
usuário, ID do usuário, emoji, ID do emoji, gemas, live, vendedor e ID do evento.

As gemas chegam pelo WebSocket `wss://ws.jamble.com` como eventos `LIKE`, com
`like_icon_id` e o perfil de quem enviou; o preço de cada emoji vem de
`/api/live/emojis`. Como a Jamble não expõe histórico, só entra o que acontece
com a live aberta no navegador. Guarda os 300 últimos envios por live, nas 30
lives mais recentes.

## 4. Menu da extensão

Clicando no ícone abre um menu com quantas compras estão salvas, quando foram exportadas e dois
atalhos: **Minhas compras salvas** (abre a página das compras já exportadas) e
**Exportar novas compras** (abre `jamble.com/account/purchases` para rodar a exportação).

A extensão não grava histórico de vendas dos vendedores. O total vendido e o ranking de
compradores existem só enquanto a live está aberta na aba.

## Instalar
1. Extraia a pasta num lugar fixo (ela precisa continuar existindo).
2. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
3. **Carregar sem compactação** → escolha a pasta da extensão.
4. Recarregue a página da Jamble.

## Segurança
Os únicos botões do site que a extensão clica são "Ver mais" e nada mais.
Ela nunca clica em "Recebido", "Já recebi" ou em qualquer botão de oferta/compra.
