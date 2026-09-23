# DarkGrid

Novo aplicativo independente para gerenciamento de múltiplas contas e farm, com interface escura, foco em desempenho e preparação para autenticação/licenciamento.

## Estado atual

A V1 já possui shell Electron, interface escura, até quatro sessões isoladas, layouts em grade/linha/coluna, modo leve que oculta os painéis sem interromper o farm, polling de estado, métricas de farm, Hunt Analyzer com preferência por dados do servidor, tierlist modular estimada, calculadora de IV, userscripts locais explícitos, equipe sanitizada por conta, inventário sanitizado por conta, histórico local de hunts encerradas, exportação CSV, alertas configuráveis de queda/sem progresso/sem Pokébolas com notificação nativa opcional, login da conta do jogo com Turnstile manual, Market/Depot, compra/venda protegida, recuperação cidade → operação → hunt e licenciamento assinado. Os contratos privados do jogo ainda precisam de validação com uma conta real antes de serem tratados como compatibilidade de produção.

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

O backend e a chave pública de produção não fazem parte deste repositório. Sem essa configuração, o aplicativo permanece explicitamente em “Servidor não configurado” e não restaura contas. Em produção, `DARKGRID_AUTH_URL` deve ser HTTPS; `http://localhost` só é aceito para desenvolvimento local. A licença também fica vinculada ao identificador protegido da instalação.

Para gerar os executáveis Windows:

```powershell
npm run dist
```

Os artefatos são gravados em `release/` como instalador NSIS e versão portátil.

Para testar o fluxo completo de login/licença localmente, existe um servidor efêmero somente de desenvolvimento:

```powershell
npm run auth:dev
```

Ele imprime a URL, a chave pública e as credenciais de demonstração. Os dados ficam apenas em memória; esse servidor não é backend de produção e não deve ser exposto na internet.

## Princípios

- O PokeGrid atual permanece intacto e serve apenas como referência funcional.
- Nenhuma senha deve sair do computador do usuário.
- Licenciamento será validado por servidor; não haverá segredo confiável embutido no executável.
- Cada conta terá uma sessão isolada.
- A interface não deve substituir DOM focado durante operações assíncronas.
- Userscripts são executados somente por ação explícita do usuário na origem oficial do jogo; o DarkGrid não baixa scripts automaticamente.
