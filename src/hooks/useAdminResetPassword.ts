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
        throw new Error('Não autenticado');
      }
      
      const response = await supabase.functions.invoke('admin-reset-password', {
        body: input,
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Erro ao redefinir senha');
      }
      
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      
      return response.data;
    },
    onSuccess: () => {
      toast.success('Senha redefinida com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao redefinir senha: ' + error.message);
    },
  });
}
