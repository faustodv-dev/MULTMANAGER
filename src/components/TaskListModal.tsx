import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Task, statusLabels, priorityLabels } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, AlertTriangle, CheckCircle2, ListTodo, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

const statusColors: Record<string, string> = {
  todo: 'bg-slate-500',
  in_progress: 'bg-blue-500',
  review: 'bg-amber-500',
  done: 'bg-emerald-500',
};

const priorityColors: Record<string, string> = {
  low: 'bg-slate-400',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

export function TaskListModal({ open, onClose, title, tasks, onTaskClick }: TaskListModalProps) {
  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'done') return false;
    return new Date(task.due_date) < new Date();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            {title}
            <Badge variant="secondary">{tasks.length}</Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mb-3 opacity-50" />
              <p>Nenhuma tarefa nesta categoria</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onTaskClick?.(task)}
                  className={cn(
                    "p-4 rounded-lg border bg-card transition-colors",
                    onTaskClick && "cursor-pointer hover:bg-muted/50",
                    isOverdue(task) && "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {task.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className={cn("text-white text-xs", statusColors[task.status])}>
                          {statusLabels[task.status]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <div className={cn("w-2 h-2 rounded-full mr-1", priorityColors[task.priority])} />
                          {priorityLabels[task.priority]}
                        </Badge>
                        
                        {task.due_date && (
                          <div className={cn(
                            "flex items-center gap-1 text-xs",
                            isOverdue(task) ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"
                          )}>
                            {isOverdue(task) ? (
                              <AlertTriangle className="w-3 h-3" />
                            ) : (
                              <Calendar className="w-3 h-3" />
                            )}
                            {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {task.assignee && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {task.assignee.full_name?.charAt(0) || '?'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
