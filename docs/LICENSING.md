# Licenciamento V1

## Fluxo mínimo

```text
login → validar assinatura → ativar dispositivo → emitir licença assinada → criar sessões do jogo
```

## Requisitos do servidor

- API HTTPS em Node.js/TypeScript (o cliente rejeita endpoints HTTP públicos).
- PostgreSQL para usuários, planos, assinaturas e dispositivos.
- Argon2id para senhas.
- Access token curto e refresh token rotativo.
- Licença assinada com Ed25519.
- Chave privada somente no servidor.
- Webhook idempotente do provedor de pagamento.
- Revogação de dispositivo e licença.
- Licença vinculada ao identificador de instalação protegido pelo `safeStorage`.
- Auditoria de login, renovação, revogação e falhas.

O cliente já possui um `AuthService` isolado para login, refresh rotativo, consulta de licença e logout. O armazenamento de tokens é injetável para que a implementação de produção use `safeStorage`, sem colocar refresh token em `localStorage`.

No login, o cliente envia apenas um identificador de instalação não secreto (`deviceId`). A API deve decidir se o dispositivo está ativado e emitir a licença assinada para esse identificador. O executável valida a assinatura e rejeita uma licença emitida para outro dispositivo.

## Comportamento offline

O cliente pode permanecer em `offline_grace` por no máximo 48 horas após a última licença válida. Nesse modo, contas já configuradas podem continuar, mas novas ativações e novos dispositivos ficam bloqueados. Ao fim do período, o app exige autenticação online sem apagar os dados locais.

Na inicialização, o cliente tenta revalidar a licença com a API. Somente falhas de transporte permitem usar o cache assinado; respostas explícitas de revogação, expiração ou dispositivo inválido limpam a licença local.

## Nunca fazer

- Colocar chave privada no executável.
- Confiar somente em uma flag local `licensed=true`.
- Guardar refresh token em `localStorage`.
- Enviar senha, cookie ou token do jogo para a API DarkGrid.

O repositório inclui `tools/dev-auth-server.js` apenas para testes locais do contrato HTTP. Ele usa memória e uma chave Ed25519 gerada a cada execução; não é um backend de produção, não persiste usuários e não deve ser exposto publicamente.
