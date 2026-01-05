import { TaskFrequency, TaskPriority, ChecklistItem } from '@/types/database';

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  procedure_path: string;
  frequency: TaskFrequency;
  priority: TaskPriority;
  checklist: ChecklistItem[];
}

export interface DepartmentTemplates {
  departmentName: string;
  departmentColor: string;
  templates: TaskTemplate[];
}

// Templates organized by department name (case-insensitive matching)
export const taskTemplatesByDepartment: Record<string, TaskTemplate[]> = {
  'financeiro': [
    {
      id: 'fin-1',
      title: 'Ligar para Alunos Inadimplentes (+5 dias)',
      description: 'Contatar alunos com parcelas vencidas há mais de 5 dias.',
      procedure_path: 'RELATÓRIO > FINANCEIRO > PARCELAS VENCIDAS',
      frequency: 'daily',
      priority: 'high',
      checklist: [
        { id: '1', text: 'Filtrar alunos +5 dias', completed: false },
        { id: '2', text: 'Ligar e negociar', completed: false },
        { id: '3', text: 'Agendar nova data', completed: false },
      ],
    },
    {
      id: 'fin-2',
      title: 'Enviar WhatsApp Vencendo Hoje',
      description: 'Lembrete preventivo para evitar inadimplência.',
      procedure_path: 'RELATÓRIO > FINANCEIRO > PARCELA VENCIDA > HOJE',
      frequency: 'daily',
      priority: 'high',
      checklist: [
        { id: '1', text: 'Gerar relatório do dia', completed: false },
        { id: '2', text: 'Disparar mensagem padrão', completed: false },
        { id: '3', text: 'Baixar pagamentos', completed: false },
      ],
    },
    {
      id: 'fin-3',
      title: 'Negativação SPC (Mensal)',
      description: 'Processo de envio de nomes ao SPC.',
      procedure_path: 'DRIVE > PASTA NEGATIVAÇÃO',
      frequency: 'monthly',
      priority: 'high',
      checklist: [
        { id: '1', text: 'Separar contratos desistentes', completed: false },
        { id: '2', text: 'Cópia lista chamada assinada', completed: false },
        { id: '3', text: 'Enviar aviso final WhatsApp', completed: false },
      ],
    },
  ],
  'agência de encaminhamento': [
    {
      id: 'age-1',
      title: 'Atualizar Vagas de Emprego',
      description: 'Contatar parceiros e renovar mural.',
      procedure_path: 'Planilha de Parceiros > Telefone',
      frequency: 'weekly',
      priority: 'medium',
      checklist: [
        { id: '1', text: 'Ligar empresas parceiras', completed: false },
        { id: '2', text: 'Cadastrar novas vagas', completed: false },
        { id: '3', text: 'Postar no Instagram', completed: false },
      ],
    },
    {
      id: 'age-2',
      title: 'Atualizar Mural de Encaminhados',
      description: 'Atualizar fotos no mural da recepção.',
      procedure_path: 'AGÊNCIA > RELATÓRIO MÊS ANTERIOR',
      frequency: 'monthly',
      priority: 'low',
      checklist: [
        { id: '1', text: 'Imprimir lista encaminhados', completed: false },
        { id: '2', text: 'Atualizar mural físico', completed: false },
      ],
    },
  ],
  'agência': [
    {
      id: 'age-1',
      title: 'Atualizar Vagas de Emprego',
      description: 'Contatar parceiros e renovar mural.',
      procedure_path: 'Planilha de Parceiros > Telefone',
      frequency: 'weekly',
      priority: 'medium',
      checklist: [
        { id: '1', text: 'Ligar empresas parceiras', completed: false },
        { id: '2', text: 'Cadastrar novas vagas', completed: false },
        { id: '3', text: 'Postar no Instagram', completed: false },
      ],
    },
    {
      id: 'age-2',
      title: 'Atualizar Mural de Encaminhados',
      description: 'Atualizar fotos no mural da recepção.',
      procedure_path: 'AGÊNCIA > RELATÓRIO MÊS ANTERIOR',
      frequency: 'monthly',
      priority: 'low',
      checklist: [
        { id: '1', text: 'Imprimir lista encaminhados', completed: false },
        { id: '2', text: 'Atualizar mural físico', completed: false },
      ],
    },
  ],
  'pedagógico': [
    {
      id: 'ped-1',
      title: 'Impressão de Certificados',
      description: 'Verificar formados e imprimir documentos.',
      procedure_path: 'SECRETARIA > ALUNOS > STATUS FORMADO',
      frequency: 'monthly',
      priority: 'medium',
      checklist: [
        { id: '1', text: 'Filtrar formados mês anterior', completed: false },
        { id: '2', text: 'Imprimir Frente/Verso', completed: false },
        { id: '3', text: 'Colocar para assinatura', completed: false },
      ],
    },
    {
      id: 'ped-2',
      title: 'Mensagem Alunos Faltantes',
      description: 'Reengajar alunos que faltaram na aula de hoje.',
      procedure_path: 'RELATÓRIO > FALTANTES DO DIA',
      frequency: 'daily',
      priority: 'medium',
      checklist: [
        { id: '1', text: 'Identificar faltantes', completed: false },
        { id: '2', text: 'Enviar mensagem de reposição', completed: false },
      ],
    },
  ],
};

export function getTemplatesForDepartment(departmentName: string): TaskTemplate[] {
  const normalizedName = departmentName.toLowerCase().trim();
  return taskTemplatesByDepartment[normalizedName] || [];
}
