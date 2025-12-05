const { z } = require('zod');

// Esquema para Criar/Editar Tarefa
const taskSchema = z.object({
    nome: z.string({ required_error: "Nome é obrigatório" }).min(3, "Nome deve ter pelo menos 3 letras"),
    pontos: z.number({ required_error: "Pontos são obrigatórios" }).positive("Pontos devem ser positivos"),
    frequencia: z.enum(['livre', 'diaria', 'semanal']).optional(),
    targetChildId: z.number().nullable().optional(),
    deadline: z.string().datetime().nullable().optional() // Valida se é uma data ISO válida
});

module.exports = taskSchema;