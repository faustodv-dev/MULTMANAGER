import { z } from 'zod';

/**
 * Validation schemas for user inputs.
 * These ensure data integrity and prevent injection attacks.
 */

// Task validation schema
export const taskSchema = z.object({
  title: z.string()
    .min(1, 'Título é obrigatório')
    .max(200, 'Título deve ter no máximo 200 caracteres'),
  description: z.string()
    .max(2000, 'Descrição deve ter no máximo 2000 caracteres')
    .optional()
    .nullable(),
  procedure_path: z.string()
    .max(500, 'Caminho do procedimento muito longo')
    .optional()
    .nullable(),
  priority: z.enum(['low', 'medium', 'high']),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  status: z.enum(['todo', 'in_progress', 'review', 'done']),
  assignee_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  process_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

export type TaskInput = z.infer<typeof taskSchema>;

// Department validation schema
export const departmentSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  color_theme: z.enum(['blue', 'green', 'orange', 'purple', 'red']),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;

// Profile update validation schema
export const profileUpdateSchema = z.object({
  full_name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(200, 'Nome deve ter no máximo 200 caracteres')
    .optional()
    .nullable(),
  department_id: z.string().uuid().optional().nullable(),
  avatar_url: z.string().url().max(500).optional().nullable(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// Lead validation schema
export const leadSchema = z.object({
  name: z.string()
    .min(1, 'Nome é obrigatório')
    .max(200, 'Nome deve ter no máximo 200 caracteres'),
  phone: z.string()
    .min(8, 'Telefone deve ter pelo menos 8 dígitos')
    .max(20, 'Telefone deve ter no máximo 20 caracteres'),
  email: z.string()
    .email('Email inválido')
    .max(255, 'Email deve ter no máximo 255 caracteres')
    .optional()
    .nullable(),
  whatsapp: z.string().max(20).optional().nullable(),
  cpf: z.string().max(14).optional().nullable(),
  course_interest: z.string().max(200).optional().nullable(),
  education_level: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000, 'Notas devem ter no máximo 2000 caracteres').optional().nullable(),
  campaign: z.string().max(200).optional().nullable(),
});

export type LeadInput = z.infer<typeof leadSchema>;

// Process validation schema
export const processSchema = z.object({
  title: z.string()
    .min(1, 'Título é obrigatório')
    .max(200, 'Título deve ter no máximo 200 caracteres'),
  description: z.string()
    .max(2000, 'Descrição deve ter no máximo 2000 caracteres')
    .optional()
    .nullable(),
  procedure_path: z.string()
    .max(500, 'Caminho do procedimento muito longo')
    .optional()
    .nullable(),
  department_id: z.string().uuid().optional().nullable(),
});

export type ProcessInput = z.infer<typeof processSchema>;

// Lead activity validation schema
export const leadActivitySchema = z.object({
  lead_id: z.string().uuid(),
  user_id: z.string().uuid(),
  activity_type: z.string().min(1).max(100),
  description: z.string().min(1).max(1000, 'Descrição deve ter no máximo 1000 caracteres'),
  scheduled_at: z.string().optional().nullable(),
});

export type LeadActivityInput = z.infer<typeof leadActivitySchema>;

/**
 * Validate input against a schema and return result
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { 
  success: true; 
  data: T 
} | { 
  success: false; 
  error: string 
} {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  // Return first error message
  const firstError = result.error.errors[0];
  return { 
    success: false, 
    error: firstError?.message || 'Dados inválidos' 
  };
}
