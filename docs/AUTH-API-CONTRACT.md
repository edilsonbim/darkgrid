# Contrato da API de autenticação do DarkGrid

Este documento define o contrato mínimo consumido pelo cliente Electron. A API de produção deve ser publicada somente em HTTPS e não deve receber senha, cookie ou token do jogo.

## Regras gerais

- Base URL configurada em `DARKGRID_AUTH_URL`.
- JSON UTF-8 em todas as requisições e respostas.
- Erros usam `{ "code": "stable_error_code" }` e status HTTP apropriado.
- Login e refresh devem ter rate limit por IP, conta e dispositivo.
- Senhas devem ser armazenadas com Argon2id; nunca em texto puro.
- Access token deve ser curto, e refresh token deve ser rotativo, revogável e armazenado somente no cliente protegido por `safeStorage`.
- A chave privada Ed25519 fica exclusivamente na API; o executável contém apenas a chave pública.
- O `deviceId` identifica a instalação, mas não é segredo nem substitui autenticação.

## `POST /v1/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "senha-do-usuario",
  "deviceId": "uuid-da-instalacao"
}
```

Resposta `200`:

```json
{
  "accessToken": "opaque-short-lived-token",
  "refreshToken": "opaque-rotating-token",
  "expiresAt": 1735689600
}
```

O servidor deve validar a conta, o dispositivo e o limite de dispositivos antes de emitir a sessão.

## `POST /v1/auth/refresh`

Request:

```json
{ "refreshToken": "opaque-rotating-token" }
```

Resposta `200`: o mesmo formato de login, com um novo access token e um novo refresh token. O token anterior deve ser invalidado imediatamente. Reuso de refresh token deve revogar a família da sessão.

## `POST /v1/auth/logout`

Requer `Authorization: Bearer <accessToken>`. Deve invalidar o access token e a sessão/refresh token associado. A resposta pode ser `{ "ok": true }` mesmo quando a sessão já estiver encerrada.

## `GET /v1/licenses/current`

Requer `Authorization: Bearer <accessToken>`. Resposta `200`:

```json
{
  "licenseId": "lic_123",
  "userId": "usr_123",
  "deviceId": "uuid-da-instalacao",
  "plan": "pro",
  "expiresAt": 1735689600,
  "graceUntil": 1735852800,
  "signature": "base64-ed25519-signature"
}
```

O payload assinado é o JSON determinístico do objeto sem `signature`. `deviceId` precisa corresponder à instalação autenticada. `graceUntil` não pode exceder `expiresAt + 48 horas`; o cliente rejeita essa violação.

Status esperados:

- `401 auth_required`: access token ausente, expirado ou revogado.
- `403 license_inactive`: assinatura cancelada ou inativa.
- `404 license_not_found`: não existe licença para a conta/dispositivo.

## Eventos de assinatura e pagamento

O backend deve consumir o webhook idempotente do provedor de pagamento e atualizar o estado da assinatura antes de emitir uma nova licença. O cliente não deve confiar em preço, plano ou status fornecido localmente.

Estados mínimos do servidor:

- usuário ativo/inativo;
- dispositivo ativo/revogado;
- assinatura ativa, suspensa, cancelada ou expirada;
- família de refresh token revogada;
- auditoria de login, refresh, revogação e emissão de licença.

## Critérios de aceitação do backend

- Nenhuma senha ou credencial do jogo chega à API.
- Licença adulterada, de outro dispositivo ou fora da validade é recusada pelo cliente.
- Revogação online impede restauração de contas no cliente.
- Falha de transporte permite somente o cache assinado dentro da janela de 48 horas.
- Logs não registram senha, refresh token, access token ou chave privada.
- Testes cobrem login, refresh rotativo, reuso de refresh, logout, revogação, device binding, assinatura inválida e webhook duplicado.
