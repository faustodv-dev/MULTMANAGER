import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { mapDatabaseError } from '@/lib/errorHandler';

export interface Student {
  id: string;
  name: string;
  code: string | null;
  unit_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useStudents() {
  return useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as Student[];
    },
  });
}

export interface CreateStudentInput {
  name: string;
  code?: string | null;
  unit_id?: string | null;
}

export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateStudentInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('students')
        .insert({
          name: input.name.trim(),
          code: input.code?.trim() || null,
          unit_id: input.unit_id || null,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Student;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Aluno cadastrado com sucesso!');
    },
    onError: (error) => {
      toast.error(mapDatabaseError(error));
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateStudentInput> }) => {
      const { data, error } = await supabase
        .from('students')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Student;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Aluno atualizado!');
    },
    onError: (error) => {
      toast.error(mapDatabaseError(error));
    },
  });
}

/** All activities of a student across every pedagogical task. */
export function useStudentActivities(studentId: string | undefined) {
  return useQuery({
    queryKey: ['student_activities', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*, user:profiles(*)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
  });
}
