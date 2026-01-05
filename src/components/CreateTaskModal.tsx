import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { useCreateTask } from '@/hooks/useTasks';
import { useDepartments } from '@/hooks/useDepartments';
import { useProfiles } from '@/hooks/useProfiles';
import { useProcesses } from '@/hooks/useProcesses';
import { useCreateNotification } from '@/hooks/useNotifications';
import { 
  TaskStatus, 
  TaskFrequency, 
  TaskPriority, 
  ChecklistItem,
  frequencyLabels 
} from '@/types/database';
import { cn } from '@/lib/utils';

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  initialProcessId?: string | null;
}

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

const priorityColors: Record<TaskPriority, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

export function CreateTaskModal({ open, onClose, initialProcessId }: CreateTaskModalProps) {
  const { mutate: createTask, isPending } = useCreateTask();
  const { data: departments = [] } = useDepartments();
  const { data: profiles = [] } = useProfiles();
  const { data: processes = [] } = useProcesses();
  const { mutate: createNotification } = useCreateNotification();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [procedurePath, setProcedurePath] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [frequency, setFrequency] = useState<TaskFrequency>('daily');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [processId, setProcessId] = useState<string>('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  // Filter processes by selected department
  const filteredProcesses = departmentId 
    ? processes.filter(p => p.department_id === departmentId)
    : processes;

  // Load process when selected
  const handleProcessChange = (selectedProcessId: string) => {
    setProcessId(selectedProcessId);
    
    if (selectedProcessId) {
      const selectedProcess = processes.find(p => p.id === selectedProcessId);
      if (selectedProcess) {
        setTitle(selectedProcess.title);
        setDescription(selectedProcess.description || '');
        setProcedurePath(selectedProcess.procedure_path || '');
        if (selectedProcess.department_id) {
          setDepartmentId(selectedProcess.department_id);
        }
        setChecklist(selectedProcess.checklist.map((item, index) => ({
          id: `new-${Date.now()}-${index}`,
          text: item.text,
          completed: false,
        })));
      }
    }
  };

  // Load initial process if provided (from drag-and-drop)
  useEffect(() => {
    if (open && initialProcessId) {
      handleProcessChange(initialProcessId);
    }
  }, [open, initialProcessId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setProcedurePath('');
      setStatus('todo');
      setFrequency('daily');
      setPriority('medium');
      setDepartmentId('');
      setAssigneeId('');
      setProcessId('');
      setChecklist([]);
      setNewChecklistItem('');
    }
  }, [open]);

  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setChecklist(prev => [
        ...prev,
        { id: `new-${Date.now()}`, text: newChecklistItem.trim(), completed: false }
      ]);
      setNewChecklistItem('');
    }
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklist(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    createTask({
      title: title.trim(),
      description: description.trim() || null,
      procedure_path: procedurePath.trim() || null,
      status,
      frequency,
      priority,
      department_id: departmentId || null,
      assignee_id: assigneeId || null,
      process_id: processId || null,
      checklist,
    }, {
      onSuccess: (data) => {
        // Create notification for the assignee
        if (assigneeId && data?.id) {
          createNotification({
            user_id: assigneeId,
            task_id: data.id,
            title: 'Nova tarefa atribuída',
            message: `Você foi atribuído à tarefa: ${title.trim()}`,
          });
        }
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Nova Tarefa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Department & Process Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="department">Departamento</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="department" className="mt-1.5">
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Process Selection */}
            <div>
              <Label htmlFor="process">Processo *</Label>
              <Select value={processId} onValueChange={handleProcessChange}>
                <SelectTrigger id="process" className="mt-1.5">
                  <SelectValue placeholder="Selecione um processo" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProcesses.length === 0 ? (
                    <SelectItem value="" disabled>
                      {departmentId ? 'Nenhum processo neste departamento' : 'Selecione um departamento primeiro'}
                    </SelectItem>
                  ) : (
                    filteredProcesses.map((proc) => (
                      <SelectItem key={proc.id} value={proc.id}>
                        {proc.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título da tarefa"
              className="mt-1.5"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a tarefa..."
              className="mt-1.5 min-h-[80px]"
            />
          </div>

          {/* Procedure Path */}
          <div>
            <Label htmlFor="procedurePath">Caminho do Procedimento</Label>
            <Input
              id="procedurePath"
              value={procedurePath}
              onChange={(e) => setProcedurePath(e.target.value)}
              placeholder="Ex: RELATÓRIO > FINANCEIRO > PARCELAS"
              className="mt-1.5"
            />
          </div>

          {/* Priority, Frequency, Assignee Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="priority">Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger id="priority" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", priorityColors[value as TaskPriority])} />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="frequency">Frequência</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as TaskFrequency)}>
                <SelectTrigger id="frequency" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="assignee">Responsável</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger id="assignee" className="mt-1.5">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name || 'Sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Checklist */}
          <div>
            <Label>Checklist</Label>
            <div className="mt-2 space-y-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                  <span className="flex-1 text-sm">{item.text}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveChecklistItem(item.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              <div className="flex gap-2">
                <Input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Adicionar item..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddChecklistItem}
                  disabled={!newChecklistItem.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!title.trim() || isPending}>
              {isPending ? 'Criando...' : 'Criar Tarefa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
