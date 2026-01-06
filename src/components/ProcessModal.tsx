import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { useCreateProcess, useUpdateProcess, Process } from '@/hooks/useProcesses';
import { useDepartments } from '@/hooks/useDepartments';
import { ChecklistItem } from '@/types/database';

interface ProcessModalProps {
  open: boolean;
  onClose: () => void;
  editProcess?: Process | null;
}

export function ProcessModal({ open, onClose, editProcess }: ProcessModalProps) {
  const { mutate: createProcess, isPending: isCreating } = useCreateProcess();
  const { mutate: updateProcess, isPending: isUpdating } = useUpdateProcess();
  const { data: departments = [] } = useDepartments();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [procedurePath, setProcedurePath] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  const isPending = isCreating || isUpdating;
  const isEditing = !!editProcess;

  // Load edit data
  useEffect(() => {
    if (editProcess) {
      setTitle(editProcess.title);
      setDescription(editProcess.description || '');
      setProcedurePath(editProcess.procedure_path || '');
      setDepartmentId(editProcess.department_id || '');
      setChecklist(editProcess.checklist || []);
    }
  }, [editProcess]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setProcedurePath('');
      setDepartmentId('');
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

    const processData = {
      title: title.trim(),
      description: description.trim() || null,
      procedure_path: procedurePath.trim() || null,
      department_id: departmentId || null,
      checklist,
    };

    if (isEditing && editProcess) {
      updateProcess({ id: editProcess.id, updates: processData }, {
        onSuccess: () => onClose(),
      });
    } else {
      createProcess(processData, {
        onSuccess: () => onClose(),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEditing ? 'Editar Processo' : 'Novo Processo'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <Label htmlFor="process-title">Título *</Label>
            <Input
              id="process-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Cobrança de Inadimplentes"
              className="mt-1.5"
              required
            />
          </div>

          {/* Department */}
          <div>
            <Label htmlFor="process-department">Departamento</Label>
            <Select value={departmentId || "none"} onValueChange={(v) => setDepartmentId(v === "none" ? "" : v)}>
              <SelectTrigger id="process-department" className="mt-1.5">
                <SelectValue placeholder="Selecione um departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="process-description">Descrição</Label>
            <Textarea
              id="process-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o processo..."
              className="mt-1.5 min-h-[80px]"
            />
          </div>

          {/* Procedure Path */}
          <div>
            <Label htmlFor="process-path">Caminho do Procedimento</Label>
            <Input
              id="process-path"
              value={procedurePath}
              onChange={(e) => setProcedurePath(e.target.value)}
              placeholder="Ex: RELATÓRIO > FINANCEIRO > PARCELAS"
              className="mt-1.5"
            />
          </div>

          {/* Checklist */}
          <div>
            <Label>Checklist Padrão</Label>
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
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Processo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
