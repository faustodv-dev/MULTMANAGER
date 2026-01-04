import { Task, TaskStatus } from '@/types/task';
import { KanbanColumn } from './KanbanColumn';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const columns: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

export function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
  const getTasksByStatus = (status: TaskStatus) => 
    tasks.filter(task => task.status === status);

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-6 p-6 min-w-max">
        {columns.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={getTasksByStatus(status)}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
