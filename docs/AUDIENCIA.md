# Audiência (Insights)

`audiencia.js` roda na aba da live (world MAIN) e manda ao painel, a cada 5 s,
a mensagem `painel-audiencia`. O painel desenha a seção **Audiência** dos Insights.

## De onde vem cada dado

| Dado | Fonte | Observação |
|---|---|---|
| Pessoas assistindo | WebSocket `ws.jamble.com`, `data.show.audience_count` | chega a cada poucos segundos; conta todo mundo, logado ou não |
| Mensagens | WebSocket, `data.messages[]` com `message_type: "STANDARD"` | o `snapshot` da conexão traz histórico: não conta |
| Entradas | WebSocket, `data.messages[]` com `message_type: "JOINED_SHOW"` | só de quem está logado |
| Gemas | WebSocket, `data.events[]` com `event_type: "LIKE"` | |
| Lances | WebSocket, diferença de `data.sale_entry_count` por `sale.id` | ainda não vimos um lance de verdade acontecer |
| Quem está assistindo | `GET /api/live/viewers?seller_id=…&show_id=…` | `{items:[{id,username,avatarUrl,role}], hasNextPage, nextCursor}`; só logados; `role`: `host`, `moderator` ou `null` |

## Tempo de cada espectador

Cada consulta da lista de espectadores marca quem está presente. Quem estava
presente e sumiu de uma lista **completa** (todas as páginas) saiu na última vez
em que foi visto. A precisão é de ~30 s. Sem consulta recente (painel fechado,
aba recarregada), a sessão aberta conta só até a última vez em que a pessoa foi
vista, e uma volta depois de mais de 2 min abre uma sessão nova.

## Cuidados com a Jamble

- `/api/live/viewers` exige o cabeçalho `x-firebase-appcheck`. Não geramos o
  token: guardamos os cabeçalhos da última chamada do próprio site à `/api/` e
  reaproveitamos. Um 403 descarta esses cabeçalhos até o site mandar outros.
- Só consulta com o painel aberto, numa página de live, e uma aba por vez
  (trava `jamble:audiencia:trava` no localStorage, válida por 90 s).
- Intervalo de 30 s ± 6 s. Erro (429/403/5xx/rede) respeita `Retry-After` e
  dobra a espera (até 8 min); 4 erros seguidos pausam por 10 min e o painel avisa.
- Lives grandes: a primeira página sempre; até 5 páginas a cada 4 consultas.
  O parâmetro de paginação (`after`) foi deduzido de `/api/live/products` e
  **ainda não foi visto funcionando** numa live com mais de uma página.

## O que fica guardado

`localStorage['jamble:audiencia:v1']`, as últimas 8 lives: amostras de audiência
(até 3000), interações por minuto, espectadores com as sessões de cada um.
