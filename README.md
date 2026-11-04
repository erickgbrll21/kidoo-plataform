# KIDOO HUB

**BUILD. AUTOMATE. GROW.**

SaaS multi-tenant de atendimento omnichannel, CRM e agentes de IA. A KIDOO HUB é o produto; o Chatwoot é a
infraestrutura de atendimento (consumida só por API); Supabase/PostgreSQL é o banco; Next.js é a aplicação.

- Arquitetura e roteiro: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Configuração e execução: [`docs/SETUP.md`](docs/SETUP.md)

## Comandos

```bash
npm run dev        # desenvolvimento
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm test           # RLS/multi-tenancy (PGlite) + permissões
npm run build      # produção
```

## Estado atual

Fases 1 (auditoria e arquitetura) e 2 (fundação: design system, autenticação, empresas, equipe, permissões,
multi-tenancy com RLS, painel administrativo básico) concluídas. As demais fases estão descritas em
`docs/ARCHITECTURE.md`.
