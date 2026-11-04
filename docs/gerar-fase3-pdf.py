"""Gera o PDF do passo a passo da Fase 3 — Chatwoot."""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(__file__).with_name("KIDOO-HUB-Fase-3-Chatwoot.pdf")

GREEN = colors.HexColor("#353F34")
GREEN_DARK = colors.HexColor("#2A3229")
GREEN_SOFT = colors.HexColor("#F5F7F5")
GREEN_LINE = colors.HexColor("#D4DDD3")
MUTED = colors.HexColor("#687A66")
TEXT = colors.HexColor("#1C221B")
WHITE = colors.white


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(GREEN)
    canvas.rect(0, A4[1] - 1.4 * cm, A4[0], 1.4 * cm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(2 * cm, A4[1] - 0.9 * cm, "KIDOO HUB")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(A4[0] - 2 * cm, A4[1] - 0.9 * cm, "BUILD. AUTOMATE. GROW.")
    canvas.setStrokeColor(GREEN_LINE)
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, 1.4 * cm, A4[0] - 2 * cm, 1.4 * cm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2 * cm, 0.8 * cm, "Fase 3 — Integração Chatwoot · Documento interno")
    canvas.drawRightString(A4[0] - 2 * cm, 0.8 * cm, f"Página {doc.page}")
    canvas.restoreState()


def build():
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "TitleK",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        textColor=GREEN_DARK,
        spaceAfter=6,
        alignment=TA_LEFT,
        leading=24,
    )
    subtitle = ParagraphStyle(
        "SubK",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        textColor=MUTED,
        spaceAfter=16,
        leading=15,
    )
    h1 = ParagraphStyle(
        "H1K",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=13,
        textColor=GREEN,
        spaceBefore=16,
        spaceAfter=8,
        leading=17,
    )
    h2 = ParagraphStyle(
        "H2K",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=GREEN_DARK,
        spaceBefore=12,
        spaceAfter=6,
        leading=14,
    )
    body = ParagraphStyle(
        "BodyK",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        textColor=TEXT,
        leading=13,
        spaceAfter=6,
        alignment=TA_JUSTIFY,
    )
    bullet = ParagraphStyle(
        "BulletK",
        parent=body,
        leftIndent=0,
        spaceAfter=3,
        alignment=TA_LEFT,
    )
    small = ParagraphStyle(
        "SmallK",
        parent=body,
        fontSize=8.5,
        textColor=MUTED,
        leading=11,
    )
    cell = ParagraphStyle(
        "CellK",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        textColor=TEXT,
        leading=11,
    )
    cell_h = ParagraphStyle(
        "CellHK",
        parent=cell,
        fontName="Helvetica-Bold",
        textColor=WHITE,
    )

    story = []
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("Fase 3 — Integração Chatwoot", title))
    story.append(Paragraph("Passo a passo para estruturar e validar a infraestrutura de atendimento", subtitle))
    story.append(HRFlowable(width="100%", thickness=1, color=GREEN, spaceAfter=10))
    story.append(
        Paragraph(
            "A Fase 3 liga a KIDOO HUB ao Chatwoot como infraestrutura de atendimento. "
            "O cliente nunca acessa o painel do Chatwoot. A KIDOO consome apenas a API oficial.",
            body,
        )
    )

    # Parte A
    story.append(Paragraph("Parte A — O que a equipe KIDOO prepara", h1))
    story.append(Paragraph("Antes ou em paralelo à implementação do código:", body))
    steps_a = [
        "<b>1.</b> Subir o Chatwoot Community Edition (self-hosted) com HTTPS — ex.: https://chat.kidoohub.com.br",
        "<b>2.</b> Entrar como Super Admin do Chatwoot.",
        "<b>3.</b> Criar um Platform App (Super Admin → Platform Apps → New App) e anotar o Platform Access Token.",
        "<b>4.</b> Guardar apenas no servidor / .env.local: CHATWOOT_BASE_URL, CHATWOOT_PLATFORM_TOKEN e a versão instalada.",
        "<b>5.</b> Garantir URL da KIDOO alcançável pelo Chatwoot para webhooks (produção HTTPS; local com tunnel se necessário).",
        "<b>6.</b> Confirmar que KIDOO_ENCRYPTION_KEY já existe no .env.local (cifra dos tokens por empresa).",
    ]
    for s in steps_a:
        story.append(Paragraph(s, bullet))

    # Parte B
    story.append(Paragraph("Parte B — O que implementamos no código (ordem)", h1))

    story.append(Paragraph("1. Variáveis e configuração", h2))
    story.append(
        Paragraph(
            "Estender src/lib/env.ts e .env.example com as variáveis do Chatwoot. Documentar em docs/SETUP.md.",
            body,
        )
    )

    story.append(Paragraph("2. Banco de dados (migration)", h2))
    story.append(Paragraph("Tabelas novas com RLS e isolamento por organização:", body))
    for t in [
        "integration_secrets — tokens cifrados (AES-256-GCM)",
        "chatwoot_accounts — 1 conta Chatwoot por empresa KIDOO",
        "chatwoot_inboxes — inboxes vinculadas à conta da empresa",
        "chatwoot_agent_links — membro KIDOO ↔ agente Chatwoot",
        "webhook_events — idempotência e retentativas",
        "Espelho enxuto de contatos/conversas (se couber nesta fase)",
    ]:
        story.append(Paragraph(f"• {t}", bullet))

    story.append(Paragraph("3. Módulo único de integração", h2))
    story.append(
        Paragraph(
            "Pasta: <b>src/lib/integrations/chatwoot/</b>. Nenhuma outra parte do código faz HTTP para o Chatwoot.",
            body,
        )
    )

    module_rows = [
        [Paragraph("Arquivo", cell_h), Paragraph("Função", cell_h)],
        [Paragraph("client.ts", cell), Paragraph("HTTP base, erros, timeouts, logs", cell)],
        [Paragraph("accounts.ts", cell), Paragraph("Criar/listar contas (Platform API)", cell)],
        [Paragraph("agents.ts", cell), Paragraph("Usuário de serviço + agentes", cell)],
        [Paragraph("inboxes.ts", cell), Paragraph("Criar/listar inboxes", cell)],
        [Paragraph("contacts.ts", cell), Paragraph("Contatos", cell)],
        [Paragraph("conversations.ts", cell), Paragraph("Conversas", cell)],
        [Paragraph("messages.ts", cell), Paragraph("Enviar/listar mensagens", cell)],
        [Paragraph("teams.ts", cell), Paragraph("Equipes (espelho)", cell)],
        [Paragraph("webhooks.ts", cell), Paragraph("Registrar webhooks na conta", cell)],
        [Paragraph("types.ts", cell), Paragraph("Tipos da API", cell)],
    ]
    t = Table(module_rows, colWidths=[4.2 * cm, 12.3 * cm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("BACKGROUND", (0, 1), (-1, -1), GREEN_SOFT),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("GRID", (0, 0), (-1, -1), 0.4, GREEN_LINE),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("4. Serviços de domínio", h2))
    story.append(
        Paragraph(
            "Camada src/services/… para provisionar conta, resolver "
            "organization_id → chatwoot_account_id → inbox e nunca confiar em inbox_id isolado.",
            body,
        )
    )

    story.append(Paragraph("5. Provisionamento por empresa", h2))
    for s in [
        "Platform API cria a Account no Chatwoot.",
        "Cria usuário agente de serviço (admin da conta).",
        "Guarda o access_token cifrado em integration_secrets.",
        "Grava linha em chatwoot_accounts.",
        "Registra webhook apontando para POST /api/webhooks/chatwoot.",
    ]:
        story.append(Paragraph(f"• {s}", bullet))

    story.append(Paragraph("6. Webhooks", h2))
    story.append(
        Paragraph(
            "Rota: <b>src/app/api/webhooks/chatwoot/route.ts</b>. Fluxo: validar segredo/assinatura → "
            "checar se account.id pertence a alguma empresa → idempotência em webhook_events → "
            "responder 200 rápido → processar em background (mensagem, conversa, status, assignee) → "
            "retentativas, dead-letter e log de falha.",
            body,
        )
    )

    story.append(Paragraph("7. Espelho de agentes (equipe)", h2))
    story.append(
        Paragraph(
            "Ao convidar/ativar atendente na KIDOO, criar agente correspondente no Chatwoot, "
            "com vínculo na tabela e senha aleatória. O cliente não entra no painel do Chatwoot.",
            body,
        )
    )

    story.append(Paragraph("8. UI mínima nesta fase", h2))
    story.append(
        Paragraph(
            "Em Configurações ou Canais: status da integração (provisionada / erro / pendente) e ação "
            "de reprovisionar/testar (com permissão). A Inbox completa de 3 colunas é da Fase 5.",
            body,
        )
    )

    story.append(Paragraph("9. Testes", h2))
    for s in [
        "Unitários do client HTTP (mock).",
        "Isolamento: empresa A não lê conta/inbox da B.",
        "Idempotência do webhook.",
        "Teste manual contra a instância real com o Platform Token.",
    ]:
        story.append(Paragraph(f"• {s}", bullet))

    story.append(Paragraph("10. Documentação", h2))
    story.append(
        Paragraph(
            "Atualizar docs/SETUP.md e o status da Fase 3 em docs/ARCHITECTURE.md. "
            "WhatsApp/Meta fica para a Fase 4.",
            body,
        )
    )

    # Parte C
    story.append(Paragraph("Parte C — Critérios de aceite", h1))
    accept_rows = [
        [Paragraph("Critério", cell_h), Paragraph("OK quando…", cell_h)],
        [Paragraph("Conta", cell), Paragraph("Nova empresa KIDOO gera Account no Chatwoot", cell)],
        [Paragraph("Segredo", cell), Paragraph("Token não aparece no frontend nem em logs", cell)],
        [Paragraph("Isolamento", cell), Paragraph("Trocar IDs na API não vaza dados de outra empresa", cell)],
        [Paragraph("Webhook", cell), Paragraph("Evento chega, não duplica e atualiza o espelho", cell)],
        [Paragraph("Agente", cell), Paragraph("Membro da equipe aparece como agente na conta certa", cell)],
        [Paragraph("Falha", cell), Paragraph("Chatwoot fora do ar → erro tratado + reprocesso", cell)],
    ]
    t2 = Table(accept_rows, colWidths=[3.5 * cm, 13 * cm])
    t2.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("BACKGROUND", (0, 1), (-1, -1), WHITE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("GRID", (0, 0), (-1, -1), 0.4, GREEN_LINE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GREEN_SOFT]),
            ]
        )
    )
    story.append(t2)

    story.append(Paragraph("Fora do escopo da Fase 3", h1))
    for s in [
        "Conectar número de WhatsApp (Fase 4)",
        "Inbox com 3 colunas e tempo real (Fase 5)",
        "CRM e agentes de IA (Fases 6 e 7)",
    ]:
        story.append(Paragraph(f"• {s}", bullet))

    story.append(Paragraph("Ordem prática sugerida", h1))
    story.append(
        Paragraph(
            "<b>Agora (vocês):</b> itens 1–6 da Parte A — instância Chatwoot, Platform Token e URL HTTPS.<br/>"
            "<b>Em seguida (desenvolvimento):</b> Parte B — código, migration, webhook e provisionamento.<br/>"
            "<b>No fim (juntos):</b> teste com uma empresa real no ambiente.",
            body,
        )
    )
    story.append(Spacer(1, 0.5 * cm))
    story.append(
        Paragraph(
            "Referência técnica detalhada: docs/ARCHITECTURE.md (seção Integração Chatwoot).",
            small,
        )
    )

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2.2 * cm,
        bottomMargin=2 * cm,
        title="KIDOO HUB — Fase 3 Chatwoot",
        author="KIDOO HUB",
        subject="Passo a passo da Fase 3 — Integração Chatwoot",
    )
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUT)


if __name__ == "__main__":
    build()
