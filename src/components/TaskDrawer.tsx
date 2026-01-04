import { Task, statusLabels, departmentLabels } from '@/types/task';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Flag, User, Building2, RefreshCw, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskDrawerProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

const priorityLabels = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

const priorityColors = {
  low: 'text-muted-foreground',
  medium: 'text-warning',
  high: 'text-destructive',
};

const departmentBadgeVariant = {
  agencia: 'agencia',
  financeiro: 'financeiro',
  pedagogico: 'pedagogico',
} as const;

export function TaskDrawer({ task, open, onClose }: TaskDrawerProps) {
  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-6 border-b">
          <div className="flex items-start gap-3">
            <Badge variant={departmentBadgeVariant[task.department]}>
              {departmentLabels[task.department]}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {statusLabels[task.status]}
            </Badge>
          </div>
          <SheetTitle className="text-xl font-bold text-foreground mt-3 text-left">
            {task.title}
          </SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Task Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Assignee */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>Responsável</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="w-7 h-7">
                  <AvatarFallback className={cn(task.assignee.color, "text-xs font-medium text-white")}>
                    {task.assignee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{task.assignee.name}</span>
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Data de Entrega</span>
              </div>
              <p className="text-sm font-medium">
                {task.dueDate 
                  ? new Date(task.dueDate).toLocaleDateString('pt-BR', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    })
                  : 'Não definida'
                }
              </p>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Flag className="w-4 h-4" />
                <span>Prioridade</span>
              </div>
              <p className={cn("text-sm font-medium", priorityColors[task.priority])}>
                {priorityLabels[task.priority]}
              </p>
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4" />
                <span>Frequência</span>
              </div>
              <Badge variant="frequency">{task.frequency}</Badge>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Procedimento
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed bg-muted/50 p-4 rounded-lg">
                {task.description}
              </p>
            </div>
          )}

          {/* Procedure Path */}
          {task.procedurePath && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Caminho no Sistema
              </h4>
              <div className="bg-primary/5 border border-primary/10 p-4 rounded-lg">
                <code className="text-sm font-mono text-primary break-all">
                  {task.procedurePath}
                </code>
              </div>
            </div>
          )}

          {/* Checklist */}
          {task.checklist && task.checklist.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-foreground">Checklist</h4>
                <span className="text-xs text-muted-foreground">
                  {task.checklist.filter(c => c.completed).length} de {task.checklist.length} completos
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ 
                    width: `${(task.checklist.filter(c => c.completed).length / task.checklist.length) * 100}%` 
                  }}
                />
              </div>

              {/* Checklist Items */}
              <div className="space-y-2">
                {task.checklist.map((item) => (
                  <label
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                      item.completed 
                        ? "bg-success/5 border-success/20" 
                        : "bg-card hover:bg-muted/50"
                    )}
                  >
                    <Checkbox checked={item.completed} />
                    <span className={cn(
                      "text-sm",
                      item.completed && "line-through text-muted-foreground"
                    )}>
                      {item.text}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
