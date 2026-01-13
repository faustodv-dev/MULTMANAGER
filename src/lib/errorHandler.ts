/**
 * Error handling utility for mapping database errors to user-friendly messages.
 * This prevents leakage of internal database schema details via error messages.
 */

export function mapDatabaseError(error: Error): string {
  const message = error.message.toLowerCase();
  
  // Duplicate key / unique constraint violations
  if (message.includes('duplicate') || message.includes('unique constraint')) {
    return 'Este item já existe no sistema.';
  }
  
  // Foreign key constraint violations
  if (message.includes('foreign key') || message.includes('violates foreign key')) {
    return 'Não é possível realizar esta ação devido a dependências.';
  }
  
  // Not-null constraint violations
  if (message.includes('not-null') || message.includes('null value')) {
    return 'Todos os campos obrigatórios devem ser preenchidos.';
  }
  
  // Permission / RLS errors
  if (message.includes('permission denied') || message.includes('rls') || message.includes('policy')) {
    return 'Você não tem permissão para realizar esta ação.';
  }
  
  // Check constraint violations
  if (message.includes('check constraint') || message.includes('violates check')) {
    return 'Os dados informados não são válidos.';
  }
  
  // Connection / network errors
  if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente.';
  }
  
  // Rate limiting
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Muitas requisições. Aguarde um momento e tente novamente.';
  }
  
  // Log the actual error for debugging (server-side only in production)
  console.error('Database error:', error);
  
  // Generic fallback message
  return 'Ocorreu um erro ao processar sua solicitação.';
}
