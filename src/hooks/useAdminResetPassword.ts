import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ResetPasswordInput {
  user_id: string;
  new_password: string;
}

export function useAdminResetPassword() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Não autenticado. Faça login novamente.');
      }

      // Use explicit fetch for reliable auth context
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro de conexão' }));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      const data = await response.json();
      if (data?.error) {
        throw new Error(data.error);
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success('Senha redefinida com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao redefinir senha: ' + error.message);
    },
  });
}
