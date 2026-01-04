import { useState, useEffect } from 'react';
import { Task, ChecklistItem, TaskStatus, TaskFrequency, TaskPriority, statusLabels, frequencyLabels } from '@/types/database';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateTask } from '@/hooks/useTasks';
import { useDepartments } from '@/hooks/useDepartments';
import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/contexts/AuthContext';
import { Pencil, Save, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TaskDrawerEditProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

export function TaskDrawerEdit({ task, open, onClose }: TaskDrawerEditProps) {
  const { isManager } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  const [newChecklistItem, setNewChecklistItem] = useState('');
  
  const updateTask = useUpdateTask();
  const { data: departments } = useDepartments();
  const { data: profiles } = useProfiles();

  useEffect(() => {
    if (task) {
      setEditedTask({
        title: task.title,
        description: task.description,
        procedure_path: task.procedure_path,
        status: task.status,
        frequency: task.frequency,
        priority: task.priority,
        assignee_id: task.assignee_id,
        department_id: task.department_id,
        checklist: task.checklist || [],
      });
    }
  }, [task]);

  if (!task) return null;

  const handleSave = async () => {
    if (!editedTask.title?.trim()) {
      toast.error('O título é obrigatório');
      return;
    }
    
    await updateTask.mutateAsync({
      id: task.id,
      updates: editedTask,
    });
    
    setIsEditing(false);
  };

  const handleChecklistToggle = async (itemId: string) => {
    const updatedChecklist = (editedTask.checklist || []).map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    
    setEditedTask({ ...editedTask, checklist: updatedChecklist });
    
    // If not in edit mode, save immediately
    if (!isEditing) {
      await updateTask.mutateAsync({
        id: task.id,
        updates: { checklist: updatedChecklist },
      });
    }
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    
    const newItem: ChecklistItem = {
      id: `c${Date.now()}`,
      text: newChecklistItem,
      completed: false,
    };
    
    setEditedTask({
      ...editedTask,
      checklist: [...(editedTask.checklist || []), newItem],
    });
    setNewChecklistItem('');
  };

  const handleRemoveChecklistItem = (itemId: string) => {
    setEditedTask({
      ...editedTask,
      checklist: (editedTask.checklist || []).filter(item => item.id !== itemId),
    });
  };

  const displayTask = isEditing ? editedTask : task;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold text-foreground">
              {isEditing ? 'Editar Tarefa' : 'Detalhes da Tarefa'}
            </SheetTitle>
            {isManager && (
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={updateTask.isPending}
                    >
                      {updateTask.isPending ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-1" />
                      )}
                      Salvar
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label>Título</Label>
            {isEditing ? (
              <Input
                value={editedTask.title || ''}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
              />
            ) : (
              <p className="font-medium">{displayTask.title}</p>
            )}
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              {isEditing ? (
                <Select
                  value={editedTask.status}
                  onValueChange={(value) => setEditedTask({ ...editedTask, status: value as TaskStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{statusLabels[task.status]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              {isEditing ? (
                <Select
                  value={editedTask.priority}
                  onValueChange={(value) => setEditedTask({ ...editedTask, priority: value as TaskPriority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm capitalize">{task.priority}</p>
              )}
            </div>
          </div>

          {/* Frequency & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequência</Label>
              {isEditing ? (
                <Select
                  value={editedTask.frequency}
                  onValueChange={(value) => setEditedTask({ ...editedTask, frequency: value as TaskFrequency })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(frequencyLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{frequencyLabels[task.frequency]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Responsável</Label>
              {isEditing ? (
                <Select
                  value={editedTask.assignee_id || 'none'}
                  onValueChange={(value) => setEditedTask({ ...editedTask, assignee_id: value === 'none' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {profiles?.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name || 'Sem nome'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{task.assignee?.full_name || 'Não atribuído'}</p>
              )}
            </div>
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label>Departamento</Label>
            {isEditing ? (
              <Select
                value={editedTask.department_id || 'none'}
                onValueChange={(value) => setEditedTask({ ...editedTask, department_id: value === 'none' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm">{task.department?.name || 'Não definido'}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Procedimento</Label>
            {isEditing ? (
              <Textarea
                value={editedTask.description || ''}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                {displayTask.description || 'Sem descrição'}
              </p>
            )}
          </div>

          {/* Procedure Path */}
          <div className="space-y-2">
            <Label>Caminho no Sistema</Label>
            {isEditing ? (
              <Input
                value={editedTask.procedure_path || ''}
                onChange={(e) => setEditedTask({ ...editedTask, procedure_path: e.target.value })}
                placeholder="Ex: RELATÓRIO > SECRETARIA > ..."
              />
            ) : (
              displayTask.procedure_path && (
                <div className="bg-primary/5 border border-primary/10 p-3 rounded-lg">
                  <code className="text-sm font-mono text-primary break-all">
                    {displayTask.procedure_path}
                  </code>
                </div>
              )
            )}
          </div>

          {/* Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Checklist</Label>
              <span className="text-xs text-muted-foreground">
                {(displayTask.checklist || []).filter(c => c.completed).length} de {(displayTask.checklist || []).length} completos
              </span>
            </div>
            
            {/* Progress Bar */}
            {(displayTask.checklist || []).length > 0 && (
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ 
                    width: `${((displayTask.checklist || []).filter(c => c.completed).length / (displayTask.checklist || []).length) * 100}%` 
                  }}
                />
              </div>
            )}

            {/* Checklist Items */}
            <div className="space-y-2">
              {(displayTask.checklist || []).map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    item.completed 
                      ? "bg-success/5 border-success/20" 
                      : "bg-card hover:bg-muted/50"
                  )}
                >
                  <Checkbox 
                    checked={item.completed}
                    onCheckedChange={() => handleChecklistToggle(item.id)}
                  />
                  <span className={cn(
                    "flex-1 text-sm",
                    item.completed && "line-through text-muted-foreground"
                  )}>
                    {item.text}
                  </span>
                  {isEditing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemoveChecklistItem(item.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Checklist Item */}
            {isEditing && (
              <div className="flex gap-2">
                <Input
                  placeholder="Novo item..."
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                />
                <Button size="icon" onClick={handleAddChecklistItem}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
