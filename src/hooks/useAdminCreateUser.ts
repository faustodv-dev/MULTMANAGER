import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/types/database';
import { toast } from 'sonner';

interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  department_id?: string | null;
  unit_id?: string | null;
  role?: AppRole;
}

export function useAdminCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Não autenticado');
      }
      
      const response = await supabase.functions.invoke('admin-create-user', {
        body: input,
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Erro ao criar usuário');
      }
      
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
      toast.success('Usuário criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar usuário: ' + error.message);
    },
  });
}