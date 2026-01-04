import { Task, TaskStatus, statusLabels } from '@/types/task';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const columnStyles = {
  todo: 'bg-kanban-todo',
  in_progress: 'bg-kanban-progress',
  review: 'bg-kanban-review',
  done: 'bg-kanban-done',
};

const headerDotStyles = {
  todo: 'bg-muted-foreground',
  in_progress: 'bg-dept-financeiro',
  review: 'bg-warning',
  done: 'bg-success',
};

export function KanbanColumn({ status, tasks, onTaskClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[300px] max-w-[320px]">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full", headerDotStyles[status])} />
          <h3 className="font-semibold text-sm text-foreground">{statusLabels[status]}</h3>
          <span className="bg-muted text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Tasks Container */}
      <div 
        className={cn(
          "flex-1 rounded-xl p-3 space-y-3 min-h-[400px]",
          columnStyles[status]
        )}
      >
        {tasks.map((task, index) => (
          <div 
            key={task.id} 
            className="animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <TaskCard task={task} onClick={() => onTaskClick(task)} />
          </div>
        ))}
        
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/50">
            <p className="text-sm">Nenhuma tarefa</p>
          </div>
        )}
      </div>
    </div>
  );
}
