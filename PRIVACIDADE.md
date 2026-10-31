# Política de Privacidade — WiseLive

Última atualização: 31 de outubro de 2026

O WiseLive é uma extensão para navegador, independente e não oficial, que
funciona apenas no site da Jamble (`https://www.jamble.com`). Ela não tem
nenhum vínculo com a Jamble ou com a equipe dela.

## Resumo

**A maior parte do que a extensão lê fica só no seu navegador.** O que vai para
o servidor do WiseLive é o necessário para a sua conta e os resumos das suas
lives, descritos abaixo. O WiseLive não usa ferramentas de análise ou de anúncios
e não vende dados.

## Quais dados a extensão acessa

Enquanto você usa a Jamble com a extensão instalada, ela lê os dados que o
próprio site já mostra ou recebe:

- **Dados das lives:** gemas enviadas, mensagens do chat público, vendas,
  audiência, lista de espectadores, ranking de vendedores, além de nomes de
  usuário e fotos de perfil públicas de quem participa.
- **Suas compras:** quando você usa "Exportar compras" na página de pedidos,
  a extensão lê os seus pedidos (loja, produto, preço, situação e rastreio).
- **Seu login da Jamble:** a sessão que já está aberta no navegador é usada só
  para a extensão fazer chamadas à própria Jamble, do mesmo jeito que o site
  faz. A extensão não vê nem guarda a sua senha.

## Para que esses dados são usados

Apenas para mostrar as funções da extensão: o painel com ranking, sorteios,
métricas de audiência e vendas, o resgate automático da recompensa por
assistir e a tabela das suas compras exportadas.

## Onde os dados ficam

Os demais dados ficam no armazenamento local do seu navegador (`localStorage` do
site da Jamble e `chrome.storage` da extensão). Eles saem do seu computador
somente nas chamadas que a extensão faz à própria Jamble, iguais às que o
site já faz.

## O que vai para o servidor do WiseLive

O WiseLive usa o Supabase como servidor. Ficam lá, ligados à sua conta:

- **Conta:** seu e-mail e os dados de acesso (a senha é guardada pelo serviço de
  login, de forma protegida) e um identificador do dispositivo.
- **Resumos das lives:** ao fim de uma live acompanhada pelo painel, datas, totais
  de audiência, gemas e vendas, a linha do tempo por minuto, os títulos dos
  produtos com mais lances e os nomes de usuário públicos dos 10 maiores
  compradores e dos 10 que mais mandaram gemas.

Cada conta só consegue ler os próprios resumos. Mensagens do chat, endereços e
qualquer login ou token da Jamble não são enviados. Os e-mails de recuperação de
senha passam pelo serviço Resend.

## Como apagar

Desinstalar a extensão apaga os dados guardados por ela no `chrome.storage`.
Os dados guardados no site da Jamble podem ser apagados limpando os dados do
site `jamble.com` nas configurações do navegador. Dentro do painel também dá
para limpar o histórico de sorteios. Para apagar sua conta e os resumos guardados
no servidor, peça pelo contato abaixo.

## Contato

Dúvidas sobre esta política: abra uma issue em
https://github.com/leoonardo1337/BetterJamble/issues
