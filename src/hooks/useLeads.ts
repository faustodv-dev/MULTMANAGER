import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadActivity, MediaSource, LeadStage, LeadStatus } from '@/types/crm';
import { toast } from 'sonner';

export function useMediaSources() {
  return useQuery({
    queryKey: ['media_sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('media_sources')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data as MediaSource[];
    },
  });
}

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          media_source:media_sources(*),
          assignee:profiles!leads_assigned_to_fkey(*),
          department:departments(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Lead[];
    },
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          media_source:media_sources(*),
          assignee:profiles!leads_assigned_to_fkey(*),
          department:departments(*)
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Lead | null;
    },
    enabled: !!id,
  });
}

export function useLeadActivities(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead_activities', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('lead_activities')
        .select(`
          *,
          user:profiles(*)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as LeadActivity[];
    },
    enabled: !!leadId,
  });
}

export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string | null;
  whatsapp?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  course_interest?: string | null;
  education_level?: string | null;
  has_diploma?: boolean | null;
  media_source_id?: string | null;
  campaign?: string | null;
  stage?: LeadStage;
  status?: LeadStatus;
  quote_value?: number | null;
  discount_percent?: number | null;
  final_value?: number | null;
  assigned_to?: string | null;
  department_id?: string | null;
  next_contact_date?: string | null;
  notes?: string | null;
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateLeadInput) => {
      const { data, error } = await supabase
        .from('leads')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead cadastrado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar lead: ' + error.message);
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Lead> }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      toast.success('Lead atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar lead: ' + error.message);
    },
  });
}

export function useUpdateLeadStage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, stage, userId }: { id: string; stage: LeadStage; userId: string }) => {
      // Get current lead to record old stage
      const { data: currentLead } = await supabase
        .from('leads')
        .select('stage')
        .eq('id', id)
        .single();
      
      const oldStage = currentLead?.stage;
      
      // Update lead stage
      const updates: Partial<Lead> = { stage };
      
      // Handle special stages
      if (stage === 'matricula') {
        updates.status = 'convertido';
        updates.converted_at = new Date().toISOString();
      } else if (stage === 'perdido') {
        updates.status = 'perdido';
        updates.lost_at = new Date().toISOString();
      }
      
      const { error: updateError } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      // Create activity for stage change
      const { error: activityError } = await supabase
        .from('lead_activities')
        .insert({
          lead_id: id,
          user_id: userId,
          activity_type: 'stage_change',
          description: `Moveu lead para ${stage}`,
          old_stage: oldStage,
          new_stage: stage,
        });
      
      if (activityError) throw activityError;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['lead_activities', id] });
      toast.success('Etapa atualizada!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar etapa: ' + error.message);
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir lead: ' + error.message);
    },
  });
}

export function useCreateLeadActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: {
      lead_id: string;
      user_id: string;
      activity_type: string;
      description: string;
      scheduled_at?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('lead_activities')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { lead_id }) => {
      queryClient.invalidateQueries({ queryKey: ['lead_activities', lead_id] });
      toast.success('Atividade registrada!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar atividade: ' + error.message);
    },
  });
}