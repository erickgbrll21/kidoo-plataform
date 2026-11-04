import { z } from "zod";
import { slugify } from "@/lib/slug";

const email = z
  .string({ error: "Informe o e-mail." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "E-mail inválido." }).max(254));

// Limite superior: bcrypt considera apenas os 72 primeiros bytes.
export const passwordSchema = z
  .string({ error: "Informe a senha." })
  .min(10, "A senha deve ter ao menos 10 caracteres.")
  .max(72, "A senha deve ter no máximo 72 caracteres.")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Use letras e números na senha.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha.").max(72),
  next: z.string().optional(),
});

export const organizationNameSchema = z
  .string({ error: "Informe o nome da empresa." })
  .trim()
  .min(2, "O nome da empresa deve ter ao menos 2 caracteres.")
  .max(80, "O nome da empresa deve ter no máximo 80 caracteres.");

export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$/, "Identificador inválido: use 3 a 50 letras minúsculas, números e hífens.");

export const signupSchema = z.object({
  fullName: z.string({ error: "Informe seu nome." }).trim().min(2, "Informe seu nome.").max(120),
  email,
  password: passwordSchema,
  companyName: organizationNameSchema.optional().or(z.literal("").transform(() => undefined)),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem." });

export const createOrganizationSchema = z
  .object({
    name: organizationNameSchema,
    slug: z.string().trim().optional(),
  })
  .transform((v) => ({ name: v.name, slug: organizationSlugSchema.parse(v.slug || slugify(v.name)) }));
