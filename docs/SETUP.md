# KIDOO HUB — Guia de configuração

Este guia leva o projeto de "clonado" a "rodando com autenticação e multi-tenancy reais".
Nada aqui exige deploy em produção: use um projeto Supabase de **desenvolvimento**.

## 1. Pré-requisitos

- Node.js 20.9+ (testado com Node 24) e npm
- Um projeto Supabase (https://supabase.com) — recomenda-se um projeto separado para desenvolvimento
- (Opcional) [Supabase CLI](https://supabase.com/docs/guides/local-development) para aplicar migrations

## 2. Variáveis de ambiente

```bash
cp .env.example .env.local
```

| Variável | Onde obter | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | mesma tela (`publishable`/`anon`) | pública, protegida por RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | mesma tela (`service_role`) | **segredo**; ignora RLS; só servidor |
| `NEXT_PUBLIC_APP_URL` | URL da aplicação | usada nos links de e-mail e convites |
| `KIDOO_ENCRYPTION_KEY` | gere localmente (comando no `.env.example`) | necessária a partir da Fase 3 (credenciais Chatwoot/Meta/IA) |

Sem as variáveis do Supabase, a aplicação exibe a tela "Configuração pendente" em vez de falhar.
`SUPABASE_SERVICE_ROLE_KEY` é usada para o rate limit (`consume_rate_limit`) e pelo painel `/admin`.
Em **produção**, a ausência dela faz o rate limit falhar *fechado* (bloqueia logins) — por segurança.

## 3. Banco de dados (migrations)

As migrations ficam em `supabase/migrations` e **devem ser aplicadas em ordem**:

1. `20261104120000_identity_and_tenancy.sql` — perfis, empresas, papéis, permissões, membros, equipes, auditoria, rate limit, RLS
2. `20261104120100_plans_and_limits.sql` — planos (Starter, Growth, Business, Enterprise), assinaturas, limites efetivos
3. `20261104120200_invitations_and_org_functions.sql` — convites, `create_organization`, `accept_invitation`

Opção A — Supabase CLI:

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

Opção B — SQL Editor do dashboard: cole e execute cada arquivo, na ordem acima.

Não há nenhuma tabela exposta sem RLS. Confira depois em **Database → Advisors** (Security).

## 4. Configuração do Supabase Auth

Em **Authentication**:

1. **URL Configuration**
   - *Site URL*: o valor de `NEXT_PUBLIC_APP_URL` (ex.: `http://localhost:3000`)
   - *Redirect URLs*: adicione `http://localhost:3000/auth/confirm` (e o domínio real quando houver)
2. **Providers → Email**: mantenha *Confirm email* **ligado** (recomendado). Defina o tamanho mínimo de senha em 10
   e, se o plano permitir, ative a proteção contra senhas vazadas (*Leaked password protection*).
3. **Email Templates** — use o fluxo por `token_hash` (funciona entre navegadores/dispositivos):
   - *Confirm signup*:
     ```html
     <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup">Confirmar e-mail</a>
     ```
   - *Reset password*:
     ```html
     <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Redefinir senha</a>
     ```
   `{{ .RedirectTo }}` já traz `/auth/confirm?next=...`, por isso o `&`.
   O fluxo PKCE por `?code=` também é aceito pela rota `/auth/confirm`.
4. **SMTP**: o e-mail padrão do Supabase é limitado a poucos envios por hora. Configure um SMTP próprio antes de convidar usuários reais.

## 5. Primeiro administrador da plataforma (KIDOO)

O painel `/admin` é restrito a quem está em `public.platform_admins`. Não existe cadastro por interface (de propósito).
Depois de criar sua conta pela aplicação, rode no SQL Editor:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'seu-email@kidoo.com.br';
```

Administradores da KIDOO **não** têm acesso automático às empresas clientes; o `/admin` lista empresas e permite
suspender/reativar (cada ação é registrada em `audit_logs` com `actor_type = 'platform_admin'`).

## 6. Rodando

```bash
npm install
npm run dev          # http://localhost:3000
```

Fluxo para validar manualmente: cadastrar-se → confirmar e-mail → cadastrar empresa (onboarding) → Dashboard →
Equipe (criar convite, abrir o link em outra sessão com o e-mail convidado) → Configurações.

## 7. Verificação (qualidade)

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # testes de RLS/multi-tenancy (PGlite, executa as migrations reais) + catálogo de permissões
npm run build       # build de produção
```

Os testes de banco rodam em memória (PGlite) e **não** precisam de Supabase. Eles reproduzem os papéis
`anon`/`authenticated`/`service_role` e o `auth.uid()` para provar o isolamento entre empresas.

## 8. O que ainda depende de configuração externa

| Item | Fase | Pendência |
|---|---|---|
| Envio automático de convites por e-mail | 2 | Provedor de e-mail (Resend, SES, SMTP). Hoje o link do convite é exibido uma única vez para copiar. |
| Chatwoot self-hosted | 3 | ✅ `CHATWOOT_*`, `KIDOO_ENCRYPTION_KEY`, `CRON_SECRET`. Header `api-access-token`. Cron Vercel Hobby: `0 6 * * *` (1×/dia) → `/api/cron/chatwoot-webhooks`. Pro libera intervalo menor. |
| Meta WhatsApp Cloud API / Embedded Signup | 4 | App Meta verificado (Business Verification), configuração de Embedded Signup e webhook. |
| Provedores de IA | 7 | Chaves Anthropic / OpenAI / Google. |
| Cobrança (Stripe / Mercado Pago) | 9 | Conta no gateway; o modelo de dados já tem `billing_provider`. |
| CSP completa (`script-src` com nonce) | hardening | Hoje só `frame-ancestors`, `base-uri` e `form-action`. |

## 9. Regras de segurança do projeto (resumo)

- O navegador **nunca** envia `organization_id` confiável: a empresa ativa é resolvida no servidor (`src/lib/auth/dal.ts`) e revalidada contra `organization_members` a cada requisição.
- Toda tabela de tenant tem RLS; funções auxiliares usam `search_path = ''`.
- Mutações sensíveis passam por funções `SECURITY DEFINER` que derivam a identidade de `auth.uid()`.
- O cliente *service role* (`src/lib/database/service.ts`) só é usado em código sem usuário ou na área `/admin`.
- Tokens de convite são guardados como SHA-256; credenciais de integração serão cifradas com AES-256-GCM (`src/lib/security/crypto.ts`).
- Nenhum token em `localStorage`; sessão em cookies `httpOnly` geridos pelo `@supabase/ssr`.
