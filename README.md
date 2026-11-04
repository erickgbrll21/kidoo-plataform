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

Fases 1–2 concluídas. Fase 3 (Chatwoot: cliente HTTP com header `api-access-token`, provisionamento de
contas, webhooks idempotentes, espelho de conversas) implementada. Próximo: Fase 4 (WhatsApp / Meta).
Detalhes em `docs/ARCHITECTURE.md` e `docs/SETUP.md`.
