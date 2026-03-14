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
        throw new Error('Não autenticado. Faça login novamente.');
      }

      // Use explicit fetch for more reliable auth context
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-create-user`,
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
        const errorData = await response.json().catch(() => ({ error: 'Erro de conexão com o servidor' }));
        throw new Error(errorData.error || `Erro ${response.status}: falha ao criar usuário`);
      }

      const data = await response.json();
      if (data?.error) {
        throw new Error(data.error);
      }
      
      return data;
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
