import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, ChecklistItem, TaskStatus, TaskFrequency, TaskPriority } from '@/types/database';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';
import { mapDatabaseError } from '@/lib/errorHandler';
import { taskSchema, validateInput } from '@/lib/validation';

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!tasks_assignee_id_fkey(*),
          department:departments(*),
          unit:school_units(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Parse checklist from JSONB
      return (data || []).map(task => ({
        ...task,
        checklist: (task.checklist as unknown as ChecklistItem[]) || [],
      })) as Task[];
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      // Create clean update object for Supabase
      const { assignee, department, checklist, ...rest } = updates;
      
      const supabaseUpdates = {
        ...rest,
        ...(checklist !== undefined ? { checklist: checklist as unknown as Json } : {}),
      };
      
      const { data, error } = await supabase
        .from('tasks')
        .update(supabaseUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error(mapDatabaseError(error));
    },
  });
}

interface CreateTaskInput {
  title: string;
  description?: string | null;
  procedure_path?: string | null;
  status: TaskStatus;
  frequency: TaskFrequency;
  priority: TaskPriority;
  due_date?: string | null;
  assignee_id?: string | null;
  department_id?: string | null;
  unit_id?: string | null;
  process_id?: string | null;
  checklist?: ChecklistItem[];
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (task: CreateTaskInput) => {
      // Validate input before sending to database
      const validation = validateInput(taskSchema, {
        title: task.title,
        description: task.description,
        procedure_path: task.procedure_path,
        status: task.status,
        frequency: task.frequency,
        priority: task.priority,
        assignee_id: task.assignee_id,
        department_id: task.department_id,
        process_id: task.process_id,
        due_date: task.due_date,
      });
      
      if (!validation.success && 'error' in validation) {
        throw new Error(validation.error);
      }
      
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: task.title,
          description: task.description || null,
          procedure_path: task.procedure_path || null,
          status: task.status,
          frequency: task.frequency,
          priority: task.priority,
          due_date: task.due_date || null,
          assignee_id: task.assignee_id || null,
          department_id: task.department_id || null,
          unit_id: task.unit_id || null,
          process_id: task.process_id || null,
          checklist: (task.checklist || []) as unknown as Json,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa criada com sucesso!');
    },
    onError: (error) => {
      toast.error(mapDatabaseError(error));
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa excluída com sucesso!');
    },
    onError: (error) => {
      toast.error(mapDatabaseError(error));
    },
  });
}
