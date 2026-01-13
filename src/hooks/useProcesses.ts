import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';
import { ChecklistItem } from '@/types/database';
import { mapDatabaseError } from '@/lib/errorHandler';

export interface Process {
  id: string;
  title: string;
  description: string | null;
  procedure_path: string | null;
  department_id: string | null;
  checklist: ChecklistItem[];
  created_at: string;
  updated_at: string;
  department?: {
    id: string;
    name: string;
    color_theme: string;
  } | null;
}

export function useProcesses() {
  return useQuery({
    queryKey: ['processes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processes')
        .select(`
          *,
          department:departments(*)
        `)
        .order('title', { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map(process => ({
        ...process,
        checklist: (process.checklist as unknown as ChecklistItem[]) || [],
      })) as Process[];
    },
  });
}

interface CreateProcessInput {
  title: string;
  description?: string | null;
  procedure_path?: string | null;
  department_id?: string | null;
  checklist?: ChecklistItem[];
}

export function useCreateProcess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (process: CreateProcessInput) => {
      const { data, error } = await supabase
        .from('processes')
        .insert({
          title: process.title,
          description: process.description || null,
          procedure_path: process.procedure_path || null,
          department_id: process.department_id || null,
          checklist: (process.checklist || []) as unknown as Json,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      toast.success('Processo criado com sucesso!');
    },
    onError: (error) => {
      toast.error(mapDatabaseError(error));
    },
  });
}

export function useUpdateProcess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateProcessInput> }) => {
      const { department, checklist, ...rest } = updates as any;
      
      const supabaseUpdates = {
        ...rest,
        ...(checklist !== undefined ? { checklist: checklist as unknown as Json } : {}),
      };
      
      const { data, error } = await supabase
        .from('processes')
        .update(supabaseUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      toast.success('Processo atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error(mapDatabaseError(error));
    },
  });
}

export function useDeleteProcess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('processes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      toast.success('Processo excluído com sucesso!');
    },
    onError: (error) => {
      toast.error(mapDatabaseError(error));
    },
  });
}
