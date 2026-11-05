# KIDOO HUB — Arquitetura

> Documento vivo. Status: **Fases 1–3 concluídas** — Chatwoot com `api-access-token`, agentes, cron e dead-letter.
> Itens marcados com **[VERIFICAR]** dependem de confirmação na versão instalada do Chatwoot / na conta Meta e
> **não** devem ser tratados como fato até serem testados contra os serviços reais.

## 1. Auditoria do projeto existente

| Item | Resultado |
| --- | --- |
| Estado inicial | Pasta **vazia** (sem código, sem git, sem Docker, sem Supabase CLI). Projeto greenfield. |
| Runtime | Node 24, npm 11 |
| Base criada | `create-next-app` — Next.js **16.4.5**, React **19.3**, TypeScript 5, Tailwind CSS **4**, ESLint 9 |
| Funcionalidades preexistentes | Nenhuma a preservar. |
| Serviços externos | Nenhum configurado (sem projeto Supabase, sem Chatwoot, sem app Meta). |

### Particularidades do Next.js 16 (lidas em `node_modules/next/dist/docs`)

- `middleware.ts` foi renomeado para **`proxy.ts`** (função `proxy`). Usado só para renovar sessão e redirecionar;
  **nunca** como única barreira de autorização.
- O scaffold liga `cacheComponents` e `partialPrefetching`. Com Cache Components, ler `cookies()` fora de
  `<Suspense>` é erro de build. Decisão: **manter ligado** e usar `loading.tsx` / `<Suspense>` ao redor de toda
  leitura de sessão. Isso evita retrabalho futuro (Inbox em tempo real, shells estáticos instantâneos).
- Rotas dinâmicas usam `params` assíncrono e os helpers globais `PageProps<'/rota'>` / `LayoutProps<'/rota'>`.
- Tailwind v4 é configurado via CSS (`@theme`), sem `tailwind.config.js`.

### Dependências adicionadas (todas na versão estável atual resolvida pelo npm)

| Pacote | Motivo |
| --- | --- |
| `@supabase/supabase-js`, `@supabase/ssr` | Cliente Postgres/Auth; sessão via cookies no servidor |
| `zod` | Validação de todo payload de entrada |
| `lucide-react` | Ícones |
| `clsx`, `tailwind-merge`, `class-variance-authority` | Base do design system (variantes de componentes) |
| `server-only` | Impede import acidental de código sensível no bundle do cliente |
| `vitest`, `@electric-sql/pglite` (dev) | Testes unitários e **testes reais de RLS** contra um Postgres in-process |

Deliberadamente **não** instalados agora: React Flow (Fase 8), SDKs de IA (Fase 7), Stripe/Mercado Pago (Fase 9).

## 2. Camadas

```
┌──────────────────────────── CAMADA 1 — App KIDOO (Next.js) ───────────────────────────┐
│ UI (RSC + client islands) · Server Actions · Route Handlers · proxy.ts                 │
├──────────────────────────── CAMADA 2 — Backend/Banco KIDOO ────────────────────────────┤
│ services/<domínio> → lib/database (Supabase) · RLS · funções SQL SECURITY DEFINER      │
├──────────────────────────── CAMADA 3 — Chatwoot (infra de atendimento) ────────────────┤
│ lib/integrations/chatwoot (único ponto que fala HTTP com o Chatwoot)                   │
├──────────────────────────── CAMADA 4 — Provedores externos ────────────────────────────┤
│ Meta Cloud API · Claude · OpenAI · Gemini · e-mail · gateway de pagamento              │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

Regras de dependência (uma direção só):

`app/` e `components/` → `services/` → `lib/` (database, integrations, security). `lib/` nunca importa de `services/`
nem de `components/`. Componentes de UI não conhecem Supabase nem Chatwoot.

### Estrutura de pastas (implementada na Fase 2)

```
src/
  app/
    (auth)/            login, cadastro, recuperação/redefinição de senha
    (dashboard)/       app do cliente (sidebar + header), um segmento por módulo
    admin/             painel interno KIDOO (guardado por platform_admins)
    auth/              route handlers de confirmação de e-mail / logout
    invite/[token]/    aceite de convite
    api/health/        healthcheck sem dados sensíveis
  components/
    ui/                design system (Button, Input, Card, Badge, ...)
    layout/            Sidebar, Header, PageHeader, EmptyState, ...
    team/ settings/ auth/   componentes por domínio
  lib/
    auth/              DAL: getUser, requireTenantContext, requirePermission, requirePlatformAdmin
    database/          clientes Supabase (server, service-role, proxy) + tipos
    security/          rate limit, cripto de segredos, auditoria, sanitização de redirect
    validations/       schemas Zod
    env.ts             validação lazy de variáveis de ambiente
    integrations/      (Fase 3+) chatwoot/, whatsapp/, ai/
  services/
    organizations/ team/ plans/    regras de negócio da Fase 2
  hooks/ types/
supabase/migrations/   SQL versionado
docs/                  ARCHITECTURE.md, SETUP.md
tests/                 unitários + RLS (pglite)
```

## 3. Modelo de dados

### 3.1 Migrado na Fase 2 (`supabase/migrations`)

| Tabela | Finalidade | Escopo |
| --- | --- | --- |
| `profiles` | 1:1 com `auth.users` (nome, avatar). **Substitui** a tabela `users` sugerida: a identidade é do Supabase Auth. | usuário |
| `organizations` | Empresa (tenant). `slug` único, `status` (`active`/`suspended`), `settings` jsonb. | tenant |
| `permissions` | Catálogo de permissões (`team.invite`, `channels.manage`, …). | global |
| `roles` | Papéis. `organization_id NULL` = papel de sistema (owner/admin/manager/agent/viewer); preenchido = papel customizado da empresa. | global/tenant |
| `role_permissions` | Papel ↔ permissão. | global/tenant |
| `organization_members` | Usuário ↔ empresa ↔ papel, com `status`. Um usuário pode pertencer a várias empresas. | tenant |
| `teams`, `team_members` | Equipes de atendimento. | tenant |
| `invitations` | Convites (somente **hash** do token é armazenado; expira; uso único). | tenant |
| `plans` | Planos (Starter/Growth/Business/Enterprise) com limites em colunas + `features` jsonb. Editáveis pelo admin KIDOO. | global |
| `subscriptions` | Plano da empresa, `status`, `limit_overrides` jsonb, campos do gateway (nulos até a Fase 9). | tenant |
| `platform_admins` | Administradores da KIDOO — **separado** de qualquer papel de empresa. | global |
| `audit_logs` | Trilha append-only (sem UPDATE/DELETE para ninguém). | tenant/global |
| `rate_limits` | Contadores de rate limit compartilhados entre instâncias (apenas service role). | global |

Funções SQL (todas `search_path` fixo): `is_org_member`, `has_org_permission`, `is_platform_admin`,
`create_organization`, `accept_invitation`, `org_effective_limits`, `consume_rate_limit`, `write_audit_log`.

### 3.2 Planejado para as próximas fases (ajustes em relação à sugestão inicial)

- `integrations` genérica é substituída por tabelas específicas + `integration_secrets` (segredos **cifrados**,
  sem política de leitura para clientes; somente service role).
- `chatwoot_accounts` (1:1 com organização): `organization_id`, `chatwoot_account_id`, `service_agent_id`,
  `secret_id`, `webhook_secret_id`, `status`. `UNIQUE(organization_id)` e `UNIQUE(chatwoot_account_id)`.
- `whatsapp_connections`: `organization_id`, `waba_id`, `phone_number_id`, `display_phone_number`, `status`,
  `connected_at`, `last_synced_at`, `ai_agent_id`, `business_hours`, `secret_id` (token Meta).
  `UNIQUE(phone_number_id)` **global** — um número não pode estar em dois tenants.
- `chatwoot_inboxes`: `connection_id`, `chatwoot_account_id`, `chatwoot_inbox_id` com FK composta
  `(organization_id, chatwoot_account_id)` → `chatwoot_accounts`, garantindo que a Inbox pertence à conta do tenant.
- `contacts`, `contact_links` (contato KIDOO ↔ contato Chatwoot), `conversations_index`, `messages_mirror`
  (espelho enxuto alimentado por webhooks para listagem, filtros, relatórios, IA e Realtime com RLS).
- `pipelines`, `pipeline_stages`, `opportunities`, `opportunity_activities` (CRM).
- `ai_agents`, `ai_agent_channels`, `ai_executions`, `knowledge_sources`.
- `automation_flows` (definição JSON versionada), `automation_executions`.
- `usage_records` (consumo por métrica/período), `webhook_events` (inbox idempotente de webhooks).

Convenção: **toda** tabela de tenant tem `organization_id NOT NULL`, índice começando por ele e RLS habilitada.

## 4. Estratégia multi-tenant

1. **Identidade vs. tenant.** `auth.users` é global. O vínculo com empresas está em `organization_members`.
2. **Empresa ativa.** Guardada em cookie `httpOnly` (`kidoo_org`), mas é só uma *preferência*: a cada requisição
   `requireTenantContext()` consulta `organization_members` (via RLS, com a sessão do usuário) e **só aceita a
   empresa se o usuário for membro ativo**. Nenhum `organization_id` vindo do navegador é confiado.
3. **RLS em duas camadas.** (a) Políticas por `is_org_member(organization_id)` / `has_org_permission(...)` em todas
   as tabelas; (b) o backend usa o cliente com a sessão do usuário para leituras/escritas de rotina. O
   *service role* só é usado em processos sem usuário (webhooks, jobs, provisionamento) e **sempre** recebe
   `organization_id` resolvido a partir do mapeamento seguro, nunca do payload.
4. **Escritas sensíveis** (criar empresa, aceitar convite) passam por funções `SECURITY DEFINER` que derivam o
   usuário de `auth.uid()` — não recebem `user_id` como parâmetro.
5. **Organização suspensa.** `organizations.status = 'suspended'` bloqueia o acesso (verificado no DAL e no RLS de
   escrita) sem apagar dados.
6. **Cache.** Chaves de cache sempre incluem o `organization_id` resolvido no servidor.
7. **Processamento assíncrono.** Todo job carrega `organization_id` e o worker reaplica a verificação de
   pertencimento ao carregar recursos.
8. **Testes.** `tests/rls.test.ts` executa as migrations reais num Postgres (PGlite), cria dois tenants e prova
   que um não lê nem escreve no outro, que `viewer` não convida, que o `audit_logs` é imutável, etc.

Papéis de sistema iniciais: `owner` (tudo + billing + excluir empresa), `admin`, `manager`, `agent`, `viewer`.

## 5. Autenticação e sessão

- Supabase Auth (e-mail/senha). Login, cadastro e logout por **Server Actions**; o navegador **não** manipula tokens.
- Cookies de sessão do `@supabase/ssr` são gravados com `httpOnly`, `secure` (em produção) e `sameSite=lax`.
  Nada vai para `localStorage`. (Quando o Realtime da Fase 5 precisar de token no cliente, será emitido por
  endpoint dedicado e de curta duração — decisão adiada, registrada aqui.)
- `proxy.ts` renova a sessão e redireciona visitantes anônimos; a **autorização real** está no DAL
  (`lib/auth`) e no RLS. O DAL usa `auth.getUser()` (validação no servidor Auth), não apenas decodificação de JWT.
- Rate limit de login/cadastro/recuperação em Postgres (`consume_rate_limit`), por IP + e-mail.
- Redirecionamentos pós-login passam por `safeRedirectPath` (apenas caminhos internos).
- Mensagens de erro de login são genéricas (sem enumeração de contas).

## 6. Integração Chatwoot (Fase 3)

Módulo único `src/lib/integrations/chatwoot/` (`client`, `accounts`, `inboxes`, `contacts`, `conversations`,
`messages`, `agents`, `teams`, `webhooks`, `types`). Nenhuma outra parte do código faz HTTP para o Chatwoot.

**Contas.** Uma conta Chatwoot por empresa KIDOO, várias Inboxes dentro dela.

- *Platform API* (token de um *PlatformApp* criado no super admin; só enxerga o que o próprio app criou):
  criar conta, criar usuário "agente de serviço" administrador da conta e vincular. Esse usuário devolve o
  `access_token` usado na *Application/Account API*. **[VERIFICAR]** campos exatos da resposta na versão instalada.
- Cada conta tem seu próprio token de serviço, **cifrado** (AES-256-GCM, chave `KIDOO_ENCRYPTION_KEY` com `key_id`
  para rotação) em `integration_secrets`. Um token comprometido afeta uma empresa, não todas.
- Membros KIDOO que atendem são espelhados como agentes Chatwoot (usuários sem login útil, senha aleatória), com
  tabela de vínculo. O cliente nunca acessa o painel do Chatwoot.

**Isolamento.** Um `inbox_id` isolado **não** prova propriedade. Toda operação resolve
`organization_id → chatwoot_account_id → inbox` pelo mapeamento e rejeita IDs que não pertençam à empresa. Webhooks
são aceitos somente se `account.id` do payload bater com um `chatwoot_accounts` e a Inbox bater com
`chatwoot_inboxes` dessa conta.

**Webhooks** (`/api/webhooks/chatwoot`):

1. Valida autenticidade (assinatura HMAC se a versão suportar **[VERIFICAR]**; senão segredo por conta em
   header/URL + comparação em tempo constante).
2. Calcula chave de idempotência (`account_id + event + id + updated_at`), grava em `webhook_events` com
   `ON CONFLICT DO NOTHING` e responde 200 rápido.
3. Processa de forma assíncrona (`after()` + rota de *sweeper* protegida por `CRON_SECRET`) com
   retentativas exponenciais, `attempts`, `last_error`, dead-letter e alerta no painel admin.
4. Eventos: `message_created`, `message_updated`, `conversation_created`, `conversation_updated`,
   `conversation_status_changed`, `conversation_resolved`/reabertura, `assignee_changed`.

**Fonte da verdade.** Chatwoot é a fonte para conversas/mensagens; a KIDOO mantém um espelho enxuto para
listagem, relatórios, Realtime e contexto de IA, com política de retenção (LGPD).

## 7. Múltiplos WhatsApps (Fase 4)

Fluxo planejado (Meta como *Tech Provider*, app da KIDOO):

1. UI "Adicionar WhatsApp" → backend verifica limite do plano (`org_effective_limits`) e cria um `state`
   anti-CSRF vinculado ao usuário/empresa.
2. **Embedded Signup** (JS SDK da Meta) devolve `code` + `waba_id` + `phone_number_id` ao navegador, que os envia ao
   backend. O navegador **nunca** recebe token de negócio.
3. Backend troca o `code` por token no servidor, **valida propriedade** (consulta a Graph API: o `phone_number_id`
   pertence ao `waba_id`; o `waba_id` está nas WABAs compartilhadas via `debug_token`), assina o app às webhooks da
   WABA e registra o número.
4. Backend cifra o token, cria a Inbox WhatsApp Cloud na conta Chatwoot da empresa e grava `whatsapp_connections`
   + `chatwoot_inboxes` numa única operação compensável (se o Chatwoot falhar, a conexão é revertida).
5. Entrega de mensagens: **[VERIFICAR]** — a Meta aceita um único callback por app, mas permite
   `override_callback_uri` por WABA. Plano: apontar a WABA para o webhook da Inbox no Chatwoot e a KIDOO consumir os
   eventos pelos webhooks do Chatwoot. Alternativa: webhook KIDOO → repasse ao Chatwoot.
6. Limite por plano reforçado também no banco (trigger em `whatsapp_connections`) — defesa em profundidade.
7. Desconexão: revoga/descarta token, desassina a WABA, desativa a Inbox (não apaga histórico), registra auditoria.

Pré-requisitos externos (não existem hoje): app Meta verificado, Business Verification, aprovação das permissões
`whatsapp_business_management` / `whatsapp_business_messaging`, configuração do Embedded Signup, domínio HTTPS.

## 8. IA, automações e planos (Fases 7–9)

- **IA**: interface `AiProvider` (`generate`, `stream`, `countTokens`) com adaptadores Claude/OpenAI/Gemini; chaves por
  plataforma (consumo medido em `usage_records`) ou BYO por empresa. A IA só responde quando: canal autoriza +
  agente ativo + dentro do horário + limite não excedido + conversa não está com humano. Transferência marca a conversa
  como humana e atribui equipe.
- **Automações**: três módulos separados — editor (React Flow) → definição JSON versionada (`automation_flows`) →
  motor de execução (idempotente, passo a passo, persistido em `automation_executions`).
- **Planos/limites**: serviço central de *entitlements* (`org_effective_limits` = plano + `limit_overrides`). Toda
  checagem passa por ele. Gateways (Stripe/Mercado Pago) entrarão atrás de uma interface `BillingProvider`;
  hoje não há cobrança.

## 9. Riscos técnicos

| # | Risco | Mitigação |
| --- | --- | --- |
| 1 | Embedded Signup/Tech Provider depende de aprovação da Meta (semanas) | Começar o processo cedo; Fase 4 só testável com app real; UI e backend prontos antes |
| 2 | Comportamento da Platform API/webhooks varia por versão do Chatwoot CE | Fixar versão do Chatwoot em produção; testes de contrato com instância real **[VERIFICAR]** |
| 3 | Vazamento entre tenants por uso indevido do service role | Service role isolado em `lib/database/service.ts` (`server-only`), sempre com `organization_id` resolvido; testes RLS; revisão obrigatória |
| 4 | Tokens (Chatwoot/Meta/IA) em banco | Cifrados, sem leitura via RLS, rotação por `key_id`; migrar para Supabase Vault/KMS se exigido |
| 5 | Processamento assíncrono sem fila dedicada | Fila em Postgres (`webhook_events`) suficiente para centenas de tenants; avaliar pgmq/Queues/Workflow ao crescer |
| 6 | Janela de 24h e templates do WhatsApp | UI da Inbox precisa tratar mensagem fora da janela (templates) — escopo da Fase 5 |
| 7 | LGPD (dados de contatos, conteúdo de mensagens) | Retenção configurável, exportação/exclusão por contato, base legal documentada, auditoria |
| 8 | Custo e abuso de IA | `usage_records` + limites por plano + rate limit por tenant |
| 9 | Cache Components exige disciplina de `Suspense` | Padrão definido (`loading.tsx` + DAL); build quebra cedo se violado |
| 10 | Capacidade do Chatwoot self-hosted (Rails/Sidekiq/Redis/Postgres) | Dimensionar por nº de inboxes/mensagens; monitorar filas; Postgres do Chatwoot separado do da KIDOO |
| 11 | Convites sem provedor de e-mail | Fase 2 gera link copiável; envio por e-mail pendente de provedor (Resend/SES) |

## 10. Plano de implementação

| Fase | Escopo | Status |
| --- | --- | --- |
| 1 | Auditoria + arquitetura | ✅ |
| 2 | Design system, layout, auth, empresas, usuários, permissões, isolamento, testes RLS | ✅ (sem Supabase real: ver `docs/SETUP.md`) |
| 3 | Cliente Chatwoot, contas, agentes, espelho, webhooks idempotentes, cron, dead-letter admin | ✅ (header `api-access-token`; WhatsApp Inbox = Fase 4) |
| 4 | Embedded Signup, conexão de números, provisionamento, limites, desconexão | ⏳ |
| 5 | Inbox 3 colunas, Realtime, atribuições, filtros | ⏳ |
| 6 | Contatos + CRM | ⏳ |
| 7 | IA | ⏳ |
| 8 | Automações | ⏳ |
| 9 | Planos, cobrança, consumo, painel admin completo | ⏳ |
