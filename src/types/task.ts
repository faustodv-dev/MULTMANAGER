export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskFrequency = 'Diário' | 'Semanal' | 'Mensal';
export type Department = 'agencia' | 'financeiro' | 'pedagogico';
export type Priority = 'low' | 'medium' | 'high';

export interface Assignee {
  id: string;
  name: string;
  avatar?: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  procedurePath?: string;
  status: TaskStatus;
  frequency: TaskFrequency;
  department: Department;
  assignee: Assignee;
  priority: Priority;
  dueDate?: string;
  checklist?: { id: string; text: string; completed: boolean }[];
}

export const statusLabels: Record<TaskStatus, string> = {
  todo: 'A Fazer',
  in_progress: 'Em Andamento',
  review: 'Revisão',
  done: 'Concluído',
};

export const departmentLabels: Record<Department, string> = {
  agencia: 'Agência de Encaminhamento',
  financeiro: 'Financeiro',
  pedagogico: 'Pedagógico',
};
