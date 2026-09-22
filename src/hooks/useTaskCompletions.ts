import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { mapDatabaseError } from '@/lib/errorHandler';

export interface TaskCompletion {
  id: string;
  task_id: string | null;
  process_id: string | null;
  department_id: string | null;
  unit_id: string | null;
  completed_by: string | null;
  task_title: string;
  cycle_key: string | null;
  notes: string | null;
  completed_at: string;
  created_at: string;
  completer?: { id: string; full_name: string | null } | null;
  department?: { id: string; name: string; color_theme: string } | null;
  unit?: { id: string; name: string; city: string } | null;
}

export function useTaskCompletions() {
  return useQuery({
    queryKey: ['task_completions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_completions')
        .select(`
          *,
          completer:profiles(*),
          department:departments(*),
          unit:school_units(*)
        `)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as TaskCompletion[];
    },
  });
}

export interface RecordCompletionInput {
  task_id: string;
  task_title: string;
  process_id?: string | null;
  department_id?: string | null;
  unit_id?: string | null;
  cycle_key?: string | null;
  notes?: string | null;
}

export function useRecordTaskCompletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecordCompletionInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('task_completions')
        .insert({
          task_id: input.task_id,
          task_title: input.task_title,
          process_id: input.process_id || null,
          department_id: input.department_id || null,
          unit_id: input.unit_id || null,
          cycle_key: input.cycle_key || null,
          notes: input.notes || null,
          completed_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task_completions'] });
    },
    onError: (error) => {
      toast.error(mapDatabaseError(error));
    },
  });
}
