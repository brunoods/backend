const { z } = require('zod');

exports.registerSchema = z.object({
    nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().email("Formato de e-mail inválido"),
    senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres")
});

exports.loginSchema = z.object({
    email: z.string().email("Formato de e-mail inválido"),
    senha: z.string().min(1, "A senha é obrigatória")
});