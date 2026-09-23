# Decisões técnicas do DarkGrid

## D1 — Produto independente

O PokeGrid atual permanece intacto e não é alterado pelo DarkGrid. O novo produto reutiliza somente conhecimento funcional e contratos de comportamento, com identidade, estrutura e ciclo de distribuição próprios.

## D2 — Electron na V1

Electron é mantido para reduzir risco na criação de múltiplas sessões, tray, notificações, armazenamento seguro e controle de conteúdo remoto. O projeto será preparado para migrar a superfície do jogo de `<webview>` para `WebContentsView` depois de uma prova técnica de uma conta.

## D3 — Fronteiras obrigatórias

- Renderer: somente interface e estado visual.
- Main: ciclo de vida, sessões, segurança e capacidades privilegiadas.
- Game adapter: detalhes do site do jogo, WebSocket, APIs, DOM e scripts injetados.
- Domain: regras de compra, venda, teleporte, recuperação e locks.
- Shared: contratos, estados e validações.

## D4 — Assinatura

O servidor é a autoridade da assinatura. O executável pode verificar uma licença assinada localmente durante o período offline, mas não cria usuários, aumenta plano ou libera dispositivos sem resposta válida da API.

## D5 — Credenciais

Credenciais do DarkGrid e credenciais das contas do jogo são armazenadas separadamente. Nenhuma senha do jogo deve ser enviada para o servidor de licenciamento.
