import { Profile, Department, SchoolUnit } from './database';

export type LeadStage = 'assuntos_pendentes' | 'pendencia_eja' | 'pendencia_online' | 'pendencia_tecnico' | 'desistentes' | 'rescisao_cancelamento' | 'finalizado';
export type LeadStatus = 'ativo' | 'inativo' | 'convertido' | 'perdido';

export interface MediaSource {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  whatsapp: string | null;
  cpf: string | null;
  birth_date: string | null;
  
  // Educational fields
  course_interest: string | null;
  education_level: string | null;
  has_diploma: boolean | null;
  
  // Source tracking
  media_source_id: string | null;
  campaign: string | null;
  
  // Funnel
  stage: LeadStage;
  status: LeadStatus;
  
  // Financial
  quote_value: number | null;
  discount_percent: number | null;
  final_value: number | null;
  
  // Payment tracking
  enrollment_fee_paid: boolean | null;
  enrollment_fee_value: number | null;
  enrollment_installments: number | null;
  first_installment_paid: boolean | null;
  first_installment_value: number | null;
  installment_value: number | null;
  installment_count: number | null;
  uniform_paid: boolean | null;
  uniform_value: number | null;
  uniform_installments: number | null;
  material_value: number | null;
  material_installments: number | null;
  payment_method: string | null;
  
  // Assignment
  assigned_to: string | null;
  department_id: string | null;
  unit_id: string | null;
  created_by: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  converted_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  
  // Follow-up
  next_contact_date: string | null;
  first_contact_date: string | null;
  
  notes: string | null;
  
  // Relations
  media_source?: MediaSource | null;
  assignee?: Profile | null;
  department?: Department | null;
  unit?: SchoolUnit | null;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string;
  activity_type: string;
  description: string;
  old_stage: LeadStage | null;
  new_stage: LeadStage | null;
  scheduled_at: string | null;
  created_at: string;
  user?: Profile | null;
}

export const stageLabels: Record<LeadStage, string> = {
  assuntos_pendentes: 'Assuntos Pendentes (Presenciais)',
  pendencia_eja: 'Pendência (EJA)',
  pendencia_online: 'Pendência (Online)',
  pendencia_tecnico: 'Pendência (Técnico)',
  desistentes: 'Desistentes',
  rescisao_cancelamento: 'Rescisão / Cancelamento',
  finalizado: 'Finalizado',
};

export const stageColors: Record<LeadStage, string> = {
  assuntos_pendentes: 'bg-blue-500',
  pendencia_eja: 'bg-cyan-500',
  pendencia_online: 'bg-purple-500',
  pendencia_tecnico: 'bg-orange-500',
  desistentes: 'bg-red-500',
  rescisao_cancelamento: 'bg-rose-700',
  finalizado: 'bg-green-500',
};

export const statusLabels: Record<LeadStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  convertido: 'Convertido',
  perdido: 'Perdido',
};

export const activityTypeLabels: Record<string, string> = {
  call: 'Ligação',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  meeting: 'Reunião',
  note: 'Anotação',
  stage_change: 'Mudança de Etapa',
};

export const activityTypeIcons: Record<string, string> = {
  call: 'Phone',
  email: 'Mail',
  whatsapp: 'MessageCircle',
  meeting: 'Users',
  note: 'FileText',
  stage_change: 'ArrowRight',
};