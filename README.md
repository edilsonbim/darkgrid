# DarkGrid

Novo aplicativo independente para gerenciamento de múltiplas contas e farm, com interface escura, foco em desempenho e preparação para autenticação/licenciamento.

## Estado atual

A V1 já possui shell Electron, interface escura, até quatro sessões isoladas, polling de estado, login da conta do jogo com Turnstile manual, Market/Depot, compra/venda protegida, recuperação cidade → operação → hunt e licenciamento assinado. Os contratos privados do jogo ainda precisam de validação com uma conta real antes de serem tratados como compatibilidade de produção.

## Executar

```powershell
npm install
npm start
```

Para habilitar o login/licenciamento do produto, configure antes de iniciar:

```powershell
$env:DARKGRID_AUTH_URL = "https://api.exemplo.com"
$env:DARKGRID_LICENSE_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----`n...`n-----END PUBLIC KEY-----"
npm start
```

O backend e a chave pública de produção não fazem parte deste repositório. Sem essa configuração, o aplicativo permanece explicitamente em “Servidor não configurado” e não restaura contas.

Para gerar os executáveis Windows:

```powershell
npm run dist
```

Os artefatos são gravados em `release/` como instalador NSIS e versão portátil.

## Princípios

- O PokeGrid atual permanece intacto e serve apenas como referência funcional.
- Nenhuma senha deve sair do computador do usuário.
- Licenciamento será validado por servidor; não haverá segredo confiável embutido no executável.
- Cada conta terá uma sessão isolada.
- A interface não deve substituir DOM focado durante operações assíncronas.
