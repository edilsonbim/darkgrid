# DarkGrid

Novo aplicativo independente para gerenciamento de múltiplas contas e farm, com interface escura, foco em desempenho e preparação para autenticação/licenciamento.

## Estado atual

O projeto está na fundação da V1: shell Electron, interface inicial, separação `main`/`preload`/`renderer`, armazenamento criptografado de credenciais e contratos básicos para múltiplas contas. A integração real com o jogo e o servidor de assinatura ainda não está declarada como concluída.

## Executar

```powershell
npm install
npm start
```

## Princípios

- O PokeGrid atual permanece intacto e serve apenas como referência funcional.
- Nenhuma senha deve sair do computador do usuário.
- Licenciamento será validado por servidor; não haverá segredo confiável embutido no executável.
- Cada conta terá uma sessão isolada.
- A interface não deve substituir DOM focado durante operações assíncronas.
