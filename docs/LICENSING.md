# Licenciamento V1

## Fluxo mínimo

```text
login → validar assinatura → ativar dispositivo → emitir licença assinada → criar sessões do jogo
```

## Requisitos do servidor

- API HTTPS em Node.js/TypeScript.
- PostgreSQL para usuários, planos, assinaturas e dispositivos.
- Argon2id para senhas.
- Access token curto e refresh token rotativo.
- Licença assinada com Ed25519.
- Chave privada somente no servidor.
- Webhook idempotente do provedor de pagamento.
- Revogação de dispositivo e licença.
- Auditoria de login, renovação, revogação e falhas.

O cliente já possui um `AuthService` isolado para login, refresh rotativo, consulta de licença e logout. O armazenamento de tokens é injetável para que a implementação de produção use `safeStorage`, sem colocar refresh token em `localStorage`.

## Comportamento offline

O cliente pode permanecer em `offline_grace` por no máximo 48 horas após a última licença válida. Nesse modo, contas já configuradas podem continuar, mas novas ativações e novos dispositivos ficam bloqueados. Ao fim do período, o app exige autenticação online sem apagar os dados locais.

## Nunca fazer

- Colocar chave privada no executável.
- Confiar somente em uma flag local `licensed=true`.
- Guardar refresh token em `localStorage`.
- Enviar senha, cookie ou token do jogo para a API DarkGrid.
