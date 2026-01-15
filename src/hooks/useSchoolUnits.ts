import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { mapDatabaseError } from '@/lib/errorHandler';

export interface SchoolUnit {
  id: string;
  name: string;
  city: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useSchoolUnits() {
  return useQuery({
    queryKey: ['school_units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_units')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as SchoolUnit[];
    },
  });
}

export function useCreateSchoolUnit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (unit: { name: string; city: string }) => {
      const { data, error } = await supabase
        .from('school_units')
        .insert(unit)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school_units'] });
      toast.success('Unidade escolar criada com sucesso!');
    },
    onError: (error) => {
      toast.error(mapDatabaseError(error));
    },
  });
}

export function useUpdateSchoolUnit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SchoolUnit> }) => {
      const { data, error } = await supabase
        .from('school_units')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school_units'] });
      toast.success('Unidade escolar atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error(mapDatabaseError(error));
    },
  });
}

export function useDeleteSchoolUnit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('school_units')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school_units'] });
      toast.success('Unidade escolar excluída com sucesso!');
    },
    onError: (error) => {
      toast.error(mapDatabaseError(error));
    },
  });
}
