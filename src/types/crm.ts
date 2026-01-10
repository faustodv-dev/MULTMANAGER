import { Profile, Department } from './database';

export type LeadStage = 'novo' | 'contato_inicial' | 'qualificacao' | 'apresentacao' | 'negociacao' | 'matricula' | 'perdido';
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
  first_installment_paid: boolean | null;
  first_installment_value: number | null;
  uniform_paid: boolean | null;
  uniform_value: number | null;
  payment_method: string | null;
  
  // Assignment
  assigned_to: string | null;
  department_id: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  converted_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  
  // Follow-up
  next_contact_date: string | null;
  
  notes: string | null;
  
  // Relations
  media_source?: MediaSource | null;
  assignee?: Profile | null;
  department?: Department | null;
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
  novo: 'Novo Lead',
  contato_inicial: 'Contato Inicial',
  qualificacao: 'Qualificação',
  apresentacao: 'Apresentação',
  negociacao: 'Negociação',
  matricula: 'Matrícula',
  perdido: 'Perdido',
};

export const stageColors: Record<LeadStage, string> = {
  novo: 'bg-blue-500',
  contato_inicial: 'bg-cyan-500',
  qualificacao: 'bg-yellow-500',
  apresentacao: 'bg-orange-500',
  negociacao: 'bg-purple-500',
  matricula: 'bg-green-500',
  perdido: 'bg-red-500',
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