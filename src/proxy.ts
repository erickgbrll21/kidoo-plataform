import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/database/proxy";

/**
 * Proxy (antigo middleware): renova a sessão e faz redirecionamentos de conveniência.
 * NÃO é a barreira de segurança — a autorização real está no DAL (src/lib/auth/dal.ts)
 * e no RLS do banco. Aqui só evitamos renderizar telas protegidas para anônimos.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/inbox",
  "/canais",
  "/contatos",
  "/crm",
  "/agentes-ia",
  "/automacoes",
  "/relatorios",
  "/equipe",
  "/configuracoes",
  "/onboarding",
  "/convite",
  "/suspenso",
  "/admin",
];
const ANONYMOUS_ONLY = ["/login", "/cadastro", "/recuperar-senha"];

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await updateSession(request);
  const isProtected = PROTECTED_PREFIXES.some((p) => matches(pathname, p));

  if (!session.configured) {
    // Sem Supabase configurado: leva à tela de login, que exibe as instruções de configuração.
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return session.response;
  }

  if (isProtected && !session.user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return session.withSessionCookies(NextResponse.redirect(url));
  }

  if (session.user && ANONYMOUS_ONLY.some((p) => matches(pathname, p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return session.withSessionCookies(NextResponse.redirect(url));
  }

  return session.response;
}

export const config = {
  matcher: [
    // Exclui API (têm autenticação própria), assets do Next e arquivos estáticos
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
