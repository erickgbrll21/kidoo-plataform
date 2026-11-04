import { z } from "zod";

const uuid = z.uuid({ error: "Identificador inválido." });

export const inviteSchema = z.object({
  email: z
    .string({ error: "Informe o e-mail." })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "E-mail inválido." }).max(254)),
  roleId: uuid,
});

export const changeRoleSchema = z.object({ memberId: uuid, roleId: uuid });
export const memberIdSchema = z.object({ memberId: uuid });
export const invitationIdSchema = z.object({ invitationId: uuid });

export const teamSchema = z.object({
  name: z.string({ error: "Informe o nome." }).trim().min(2, "Mínimo de 2 caracteres.").max(60, "Máximo de 60 caracteres."),
  description: z.string().trim().max(300, "Máximo de 300 caracteres.").optional().default(""),
});
export const teamIdSchema = z.object({ teamId: uuid });
export const teamMemberSchema = z.object({ teamId: uuid, userId: uuid });

export const updateOrganizationSchema = z.object({
  name: z.string({ error: "Informe o nome." }).trim().min(2, "Mínimo de 2 caracteres.").max(80, "Máximo de 80 caracteres."),
});

export const updateProfileSchema = z.object({
  fullName: z.string({ error: "Informe seu nome." }).trim().min(2, "Informe seu nome.").max(120),
});

export const organizationIdSchema = z.object({ organizationId: uuid });
