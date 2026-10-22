# O painel — reestruturação da informação

Como o conteúdo que vivia espremido no card da página deve se organizar dentro
de uma janela dedicada (~1120 × 780, redimensionável).

---

## 1. O que estava errado

O card tinha **3 abas** (Ranking / Sorteio / Ranking geral) e um seletor
**FILTRAR** apertado no cabeçalho. Três problemas:

1. **"Ranking geral" não era uma seção, era um escopo.** A aba "Ranking" e a aba
   "Ranking geral" mostravam a mesma coisa com um filtro diferente de lives. O
   usuário tinha que descobrir isso sozinho — e não descobriu: ele relatou não
   entender a diferença entre "Esta live" e "Vendedor".
2. **"Vendedor" não quer dizer nada.** O escopo não é "o vendedor": é
   *"as lives daquele vendedor que você acompanhou com esta extensão"*. Nenhum
   rótulo de 8 caracteres carrega isso. Precisa de número e de data.
3. **Tudo competia por 320 px de largura.** Ranking, compradores e feed se
   empurravam numa rolagem única; o filtro virou um botãozinho sem rótulo.

A janela nova resolve o problema de espaço. Os outros dois são de rotulagem e
hierarquia, e é isso que este documento define.

---

## 2. As três decisões

**Decisão 1 — escopo deixa de ser aba e passa a morar em cima do que ele muda.**
O controle de escopo fica no cabeçalho do **Ranking de gemas**, não no topo da
janela, porque é só isso que ele muda. E ele é escrito por extenso, com número:

```
Somando:  (•) Só esta live        ( ) As 7 lives de @lojinha que você acompanhou
```

Abaixo, uma linha de contexto que some a dúvida de vez:

> *7 lives de @lojinha acompanhadas com a extensão, de 2 a 21 de outubro.
> A Jamble não dá histórico: só entra o que aconteceu com a aba aberta.*

**Decisão 2 — "Ranking geral" deixa de existir como aba e vira uma tela de
prova.** No lugar dela entra **Lives do vendedor**: a lista concreta das lives
que estão sendo somadas, com números por live. O escopo deixa de ser uma
abstração porque dá para ver o que ele contém.

**Decisão 3 — o filtro de gema sai do cabeçalho e vira uma faixa de fichas.**
Ele deixa de ser um `select` sem rótulo e passa a ser uma linha horizontal de
fichas com ícone, nome, preço e quantos envios — dentro do card de ranking, que
é o que ele filtra. Fica óbvio o que existe para filtrar e o que já apareceu.

---

## 3. Mapa de navegação

```
Janela do painel
│
├── Cabeçalho (fixo, 56px) ─ marca · live atual · estado da conexão · ⬇ CSV
│
├── Navegação (fixa, 44px) ─ 3 destinos:
│   │
│   ├── 🏆 AO VIVO ................ visão principal (padrão ao abrir)
│   │    ├── Números da live (4 indicadores)
│   │    ├── Ranking de gemas  ← aqui mora o ESCOPO e o FILTRO
│   │    ├── Feed de envios    ← herda escopo e filtro
│   │    └── Compradores desta live  ← sempre "esta live", nunca herda escopo
│   │
│   ├── 🎲 SORTEIO ................ sortear entre quem mandou gema
│   │    ├── Configuração (escopo do sorteio, modo, não repetir)
│   │    ├── A urna (quem está dentro e com quantas chances) ← novidade
│   │    ├── Resultado
│   │    └── Histórico de vencedores
│   │
│   └── 📅 LIVES DO VENDEDOR ...... prova do que "todas as lives" soma
│        └── Tabela das lives acompanhadas, com os números de cada uma
│
└── Rodapé: nenhum. Nada de informação importante fora da área de rolagem.
```

**O que virou visão principal:** o ranking de gemas, com o pódio. É o que o
usuário olha o tempo todo durante a live.

**O que virou painel lateral:** o feed de envios. Ele é um fluxo, não uma
consulta: pede altura e não pede largura.

**O que pode ficar lado a lado agora:** ranking, feed e compradores, os três ao
mesmo tempo. No card antigo isso era impossível — compradores ficava escondido
embaixo da rolagem.

**O que saiu da navegação:** "Ranking geral", que virou um botão de escopo.

---

## 4. Tela 1 — AO VIVO (padrão)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ 💎 BetterJamble    @lojinha · live de hoje, 20:14          ● ligado    ⬇ CSV  │
├───────────────────────────────────────────────────────────────────────────────┤
│  ▌🏆 Ao vivo ▐   🎲 Sorteio    📅 Lives do vendedor                            │
├─────────────────────────────────────────────┬─────────────────────────────────┤
│ 30.918       6          60        R$ 255,40 │ FEED DE ENVIOS      esta live   │
│ GEMAS     PESSOAS    ENVIOS         VENDIDO │ 60 envios · 30.918 💎           │
├─────────────────────────────────────────────┤ ─────────────────────────────── │
│ RANKING DE GEMAS                            │ 20:11:04 ◯ @ana  Coroa    +500  │
│                                             │ 20:11:06 ◯ @bia  Coração    +1  │
│ Somando:  (•) Só esta live                  │ 20:11:09 ◯ @edu  Foguete +2000  │
│           ( ) As 7 lives de @lojinha        │ 20:11:12 ◯ @ana  Carpa     +50  │
│               que você acompanhou           │ 20:11:15 ◯ @duda Coroa    +500  │
│                                             │ 20:11:17 ◯ @caio Coração    +1  │
│ [ Todas 60 ][💗 Coração 1·28 ][🐟 Carpa 50  │ 20:11:21 ◯ @bia  Foguete +2000  │
│   ·12 ][👑 Coroa 500·14 ][🚀 Foguete 2000·6]│ 20:11:24 ◯ @ana  Coroa    +500  │
│ ─────────────────────────────────────────── │ 20:11:26 ◯ @edu  Coração    +1  │
│              👑                             │                      ↓ 3 novas  │
│        🥈    ███    🥉                      │ ─────────────────────────────── │
│       ◯ 🥈  ◯👑🥈  ◯ 🥉                     │ COMPRADORES DESTA LIVE          │
│      @bia   @ana   @edu                     │ 3 pessoas · R$ 255,40           │
│     12.300  14.800  2.400                   │ ─────────────────────────────── │
│      ▓▓▓▓   ▓▓▓▓▓▓  ▓▓▓                     │ 1 ◯ @ana   2 compras  R$ 165,50 │
│ ─────────────────────────────────────────── │ 2 ◯ @bia   1 compra   R$  89,90 │
│  4 ◯ @duda      12 envios         1.100 💎  │                                 │
│  5 ◯ @caio       8 envios           318 💎  │ ⓘ Vendas existem só para a live │
│  6 ◯ @fran       3 envios            51 💎  │   aberta. O escopo acima não    │
│                        mostrar mais 10      │   muda esta lista.              │
└─────────────────────────────────────────────┴─────────────────────────────────┘
       ~60% da largura                                ~40% da largura
```

Regras desta tela:

- **Os 4 indicadores de cima** seguem o escopo, menos "VENDIDO", que é sempre
  desta live (rotular como `VENDIDO NESTA LIVE` quando o escopo for o vendedor).
- **O pódio** só aparece com 3 ou mais pessoas. Com 1 ou 2, mostrar a lista
  simples — um pódio com dois degraus vazios parece defeito.
- **As fichas de gema** mostram `nome · preço · envios no escopo`. Fichas com
  0 envios ficam esmaecidas mas clicáveis (a pessoa pode querer filtrar por uma
  gema que ainda não chegou — o estado vazio dela é informativo).
- **O feed** rola preso no fim. Se o usuário subir, a rolagem para e aparece
  `↓ n novas`. Ao trocar de escopo, de filtro ou de live, volta ao fim.
- **Compradores nunca herda o escopo.** Quando o escopo for "todas as lives", o
  card mantém o título "desta live" e mostra a nota explicando por quê. Isso
  evita a pergunta óbvia "por que o ranking mudou e as vendas não".

---

## 5. Tela 2 — SORTEIO

O problema do sorteio hoje é que se clica no escuro: não dá para ver quem está na
urna nem com quanta chance. Com espaço, a urna fica visível.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ 💎 BetterJamble    @lojinha · live de hoje, 20:14          ● ligado    ⬇ CSV  │
├───────────────────────────────────────────────────────────────────────────────┤
│  🏆 Ao vivo    ▌🎲 Sorteio ▐   📅 Lives do vendedor                            │
├─────────────────────────────────────────────┬─────────────────────────────────┤
│ SORTEAR ENTRE QUEM MANDOU GEMA              │ NA URNA                         │
│                                             │ 6 pessoas · 30.918 chances      │
│ Entre:   (•) quem mandou nesta live         │ ─────────────────────────────── │
│          ( ) quem mandou em qualquer uma    │ ◯ @ana    14.800     47,9%  ███ │
│              das 7 lives de @lojinha        │ ◯ @bia    12.300     39,8%  ██▌ │
│                                             │ ◯ @edu     2.400      7,8%  ▌   │
│ Chance:  (•) Por quantidade de gemas        │ ◯ @duda    1.100      3,6%  ▏   │
│              cada gema vale uma chance      │ ◯ @caio      318      1,0%  ▏   │
│          ( ) 1 por pessoa                   │ ◯ @fran       51      0,2%  ▏   │
│              todo mundo com a mesma chance  │                                 │
│                                             │ ⚠ @ana tem quase metade das     │
│ [x] não repetir quem já ganhou (2 fora)     │   chances. Para dar chance igual│
│                                             │   a todo mundo, use "1 por      │
│ Só gemas: 👑 Coroa          [ limpar ]      │   pessoa".                      │
│                                             │                                 │
│         ┌───────────────────────────┐       │                                 │
│         │      🎲  S O R T E A R    │       │                                 │
│         └───────────────────────────┘       │                                 │
│ ─────────────────────────────────────────── │                                 │
│ RESULTADO                                   │                                 │
│    ╭───╮                                    │                                 │
│    │ ◯ │  @duda                             │                                 │
│    ╰───╯  1.100 💎 · 12 envios · 3,6%       │                                 │
│ ─────────────────────────────────────────── │                                 │
│ JÁ GANHARAM NESTA SESSÃO                    │                                 │
│ 20:14  @duda   por quantidade · só Coroa    │                                 │
│ 20:09  @bia    1 por pessoa                 │                                 │
│                              limpar lista   │                                 │
└─────────────────────────────────────────────┴─────────────────────────────────┘
```

Regras desta tela:

- **O escopo do sorteio é independente** do escopo do ranking (a API aceita os
  dois), mas começa em "nesta live", que é o uso real. Escrever por extenso.
- **A % de chance é obrigatória.** É o que explica o modo "por quantidade" sem
  texto de ajuda.
- **O aviso de concentração** aparece quando o primeiro colocado passa de 40% das
  chances. É o jeito honesto de dizer "isto não é um sorteio justo, é um
  ranking com dado".
- **O filtro de gema é herdado** da tela "Ao vivo" e mostrado por extenso, com um
  botão de limpar. Sortear sem perceber que havia filtro é o erro mais caro da
  interface.
- **"não repetir" mostra quantos estão fora**, senão a lista encolhe sem
  explicação.
- A animação de giro continua existindo (~18 passos acelerando), mas ela é
  desenho: os dados do vencedor vêm prontos do `sortear()`.

---

## 6. Tela 3 — LIVES DO VENDEDOR

A tela que faz o escopo "todas as lives" parar de ser um mistério.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ 💎 BetterJamble    @lojinha · live de hoje, 20:14          ● ligado    ⬇ CSV  │
├───────────────────────────────────────────────────────────────────────────────┤
│  🏆 Ao vivo    🎲 Sorteio    ▌📅 Lives do vendedor ▐                           │
├───────────────────────────────────────────────────────────────────────────────┤
│ AS LIVES DE @lojinha QUE VOCÊ ACOMPANHOU                                      │
│ 7 lives · 30.918 gemas · 41 pessoas diferentes                                │
│                                                                               │
│ ⓘ A Jamble não guarda histórico de gemas. Esta lista é o que a extensão viu   │
│   com a aba aberta — não é o histórico do vendedor. Só as 30 lives mais       │
│   recentes guardam o feed detalhado; as outras mantêm só os totais.           │
│ ─────────────────────────────────────────────────────────────────────────────│
│  QUANDO              DURAÇÃO   PESSOAS   ENVIOS      GEMAS   FEED             │
│ ─────────────────────────────────────────────────────────────────────────────│
│  hoje, 20:14  AGORA    1h12        6        60      30.918    ✓               │
│  ontem, 19:02          2h04       14       182      61.240    ✓               │
│  18/10, 20:30          1h48       11       140      44.900    ✓               │
│  15/10, 21:00          0h55        4        31       6.100    ✓               │
│  12/10, 19:30          2h20       19       260      88.000    ✓               │
│  08/10, 20:00          1h30        9        77      19.300    —  só totais    │
│  02/10, 19:45          1h05        6        44      12.400    —  só totais    │
│ ─────────────────────────────────────────────────────────────────────────────│
│                                      [ somar todas no ranking → Ao vivo ]     │
└───────────────────────────────────────────────────────────────────────────────┘
```

Regras desta tela:

- A linha da live aberta vem marcada com **AGORA** e destacada.
- "FEED ✓/—" mostra, sem jargão, o limite das 30 lives.
- O botão do rodapé troca o escopo para `vendedor` e volta para "Ao vivo": é o
  caminho de ida que faltava entre a prova e o resultado.
- Com só uma live na lista (caso comum no primeiro uso), a tela mostra o estado
  vazio descrito abaixo em vez de uma tabela de uma linha.

---

## 7. Regras de estado vazio

Abrir o painel sem nenhuma gema registrada **é a situação mais comum** — é o
estado inicial de toda live. Ele precisa ser tratado como uma tela de verdade,
não como um "sem dados".

### 7.1 Sem live aberta
*Quando:* `live === null` (o usuário saiu da live com o painel aberto).

```
                              📺
                    Nenhuma live aberta

      Abra uma live em jamble.com e o painel volta a encher sozinho.
      O que já foi capturado continua guardado.
```
A navegação continua visível; "Lives do vendedor" fica desabilitada (sem live não
há vendedor para listar).

### 7.2 Live aberta, nenhuma gema ainda — **o caso principal**
*Quando:* escopo `live`, sem filtro, `ranking.length === 0`.

```
                              💎
                 Nenhuma gema nesta live ainda

     Deixe esta janela aberta: cada gema enviada aparece aqui na hora.

     ⓘ A Jamble não guarda histórico de gemas. A extensão só consegue
       registrar o que acontece com a aba da live aberta — o que rolou
       antes de você entrar não dá para recuperar.

     Enquanto isso:   [ ver as 6 lives anteriores de @lojinha ]
                      [ ver os compradores desta live (3) ]
```

Três regras que fazem este estado funcionar:

1. **Nunca mostrar pódio vazio nem lista fantasma.** O pódio só nasce com 3
   pessoas.
2. **Explicar o limite, não esconder.** A frase sobre o histórico aparece aqui
   porque é aqui que a pessoa se pergunta "cadê os dados".
3. **Oferecer o que existe.** Compradores e lives anteriores costumam ter dado
   mesmo quando gema não tem. Os atalhos só aparecem se houver conteúdo de
   verdade (contagem > 0).

O feed e o card de compradores continuam na tela com seus próprios estados
vazios, menores: *"Os envios aparecem aqui conforme acontecem."* e
*"Nenhuma venda registrada nesta live ainda."*

### 7.3 Filtro de gema sem resultado
*Quando:* `filtro !== ''` e `ranking.length === 0`.

```
            Ninguém mandou 👑 Coroa nesta live ainda.
                        [ ver todas as gemas ]
```
Nunca o texto genérico: o nome da gema e o escopo têm que estar na frase, e a
saída (limpar o filtro) é um clique.

### 7.4 Escopo "todas as lives" sem nada
*Quando:* escopo `vendedor` e `ranking.length === 0`.

```
          Esta é a primeira live de @lojinha que você acompanha.
          A partir de agora, cada live fica somada aqui.
```

### 7.5 Desconectado da aba
*Quando:* o pulso da aba parou (>12 s) ou a aba fechou.

Faixa fixa no alto do conteúdo, sem apagar o que já está na tela:

```
⚠ Sem sinal da aba da Jamble. O que está aqui é a última foto recebida
  (há 2 min). Volte para a aba da live — a ligação se refaz sozinha.
```
Os números ficam esmaecidos (opacidade ~0.6) para não parecerem ao vivo.

### 7.6 Catálogo de gemas ainda não carregado
*Quando:* `catalogo.length === 0`. A faixa de fichas não aparece (em vez de
aparecer com uma ficha "Todas" solitária). As gemas que chegarem antes do
catálogo entram com o nome cru do `like_icon_id` e valor deduzido — é esperado e
se corrige sozinho quando o catálogo chega.

---

## 8. Hierarquia tipográfica e de atenção

Da mais forte para a mais fraca:

1. **O número de gemas do pódio** e o **resultado do sorteio** — o que a pessoa
   procura na tela.
2. **@usuário** no ranking e no feed.
3. Os 4 indicadores do topo.
4. Rótulos de escopo e filtro — precisam ser **legíveis**, não discretos: foi a
   discrição deles que causou a confusão original.
5. Horas, contagens secundárias, notas explicativas.

Nada de informação essencial depende de `title`/tooltip. O card antigo escondia
"quantas vendas e quanto foi pago" num `title` do badge; no painel isso é texto.
