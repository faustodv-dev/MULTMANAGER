import { Task, TaskStatus, statusLabels } from '@/types/database';
import { TaskCardNew } from './TaskCardNew';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface KanbanBoardNewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const columns: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

const columnColors: Record<TaskStatus, string> = {
  todo: 'bg-muted',
  in_progress: 'bg-blue-500/10',
  review: 'bg-amber-500/10',
  done: 'bg-emerald-500/10',
};

const columnDotColors: Record<TaskStatus, string> = {
  todo: 'bg-muted-foreground',
  in_progress: 'bg-blue-500',
  review: 'bg-amber-500',
  done: 'bg-emerald-500',
};

export function KanbanBoardNew({ tasks, onTaskClick }: KanbanBoardNewProps) {
  const getTasksByStatus = (status: TaskStatus) => 
    tasks.filter(task => task.status === status);

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-6 p-6 min-w-max">
        {columns.map((status) => {
          const columnTasks = getTasksByStatus(status);
          return (
            <div
              key={status}
              className={cn(
                "w-80 flex-shrink-0 rounded-xl p-4",
                columnColors[status]
              )}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2.5 h-2.5 rounded-full", columnDotColors[status])} />
                  <h3 className="font-semibold text-sm text-foreground">
                    {statusLabels[status]}
                  </h3>
                </div>
                <span className="text-xs font-medium text-muted-foreground bg-background/80 px-2 py-1 rounded-full">
                  {columnTasks.length}
                </span>
              </div>

              {/* Tasks */}
              <div className="space-y-3">
                {columnTasks.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
                    Nenhuma tarefa
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <TaskCardNew
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
