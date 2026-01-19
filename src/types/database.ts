export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskFrequency = 'daily' | 'weekly' | 'monthly';
export type TaskPriority = 'low' | 'medium' | 'high';
export type AppRole = 'admin' | 'unit_admin' | 'manager' | 'employee';

export interface Department {
  id: string;
  name: string;
  color_theme: string;
  created_at: string;
  updated_at: string;
}

export interface SchoolUnit {
  id: string;
  name: string;
  city: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  unit_id: string | null;
  created_at: string;
  updated_at: string;
  department?: Department | null;
  unit?: SchoolUnit | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  procedure_path: string | null;
  status: TaskStatus;
  frequency: TaskFrequency;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  department_id: string | null;
  unit_id: string | null;
  checklist: ChecklistItem[];
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
  department?: Department | null;
  unit?: SchoolUnit | null;
}

export const statusLabels: Record<TaskStatus, string> = {
  todo: 'A Fazer',
  in_progress: 'Em Andamento',
  review: 'Revisão',
  done: 'Concluído',
};

export const frequencyLabels: Record<TaskFrequency, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

export const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export const departmentColors: Record<string, string> = {
  green: 'bg-emerald-500',
  blue: 'bg-blue-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
};

export const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador Geral',
  unit_admin: 'Admin. de Unidade',
  manager: 'Gerente',
  employee: 'Funcionário',
};
