import { Task, departmentLabels } from '@/types/task';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, Flag, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

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

export function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group bg-card rounded-xl border p-4 cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:border-accent/30 hover:-translate-y-0.5",
        "active:scale-[0.98]"
      )}
    >
      {/* Drag Handle */}
      <div className="flex items-start gap-2">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab pt-1">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2">
              {task.title}
            </h3>
            <Flag className={cn("w-4 h-4 shrink-0", priorityColors[task.priority])} />
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={departmentBadgeVariant[task.department]} className="text-[10px]">
              {task.department === 'agencia' ? 'Agência' : 
               task.department === 'financeiro' ? 'Financeiro' : 'Pedagógico'}
            </Badge>
            <Badge variant="frequency" className="text-[10px]">
              {task.frequency}
            </Badge>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              {task.dueDate && (
                <span>{new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
              )}
            </div>
            
            <Avatar className="w-6 h-6 ring-2 ring-background">
              <AvatarFallback className={cn(task.assignee.color, "text-[10px] font-medium text-white")}>
                {task.assignee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Checklist Progress */}
          {task.checklist && task.checklist.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ 
                      width: `${(task.checklist.filter(c => c.completed).length / task.checklist.length) * 100}%` 
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {task.checklist.filter(c => c.completed).length}/{task.checklist.length}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
