import { Task, frequencyLabels, departmentColors } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Calendar, Flag, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskCardNewProps {
  task: Task;
  onClick: () => void;
}

const priorityColors = {
  low: 'text-muted-foreground',
  medium: 'text-warning',
  high: 'text-destructive',
};

export function TaskCardNew({ task, onClick }: TaskCardNewProps) {
  const completedItems = task.checklist?.filter(c => c.completed).length || 0;
  const totalItems = task.checklist?.length || 0;

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {task.title}
        </h3>
        <Flag className={cn("w-4 h-4 flex-shrink-0", priorityColors[task.priority])} />
      </div>

      {/* Department & Frequency */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {task.department && (
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs border-0",
              departmentColors[task.department.color_theme] || 'bg-gray-500',
              "text-white"
            )}
          >
            {task.department.name}
          </Badge>
        )}
        <Badge variant="secondary" className="text-xs">
          {frequencyLabels[task.frequency]}
        </Badge>
      </div>

      {/* Checklist Progress */}
      {totalItems > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <CheckSquare className="w-3.5 h-3.5" />
          <span>{completedItems}/{totalItems}</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${(completedItems / totalItems) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        {/* Due Date */}
        {task.due_date && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {new Date(task.due_date).toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: 'short' 
              })}
            </span>
          </div>
        )}

        {/* Assignee */}
        {task.assignee && (
          <Avatar className="w-6 h-6">
            {task.assignee.avatar_url && (
              <AvatarImage src={task.assignee.avatar_url} />
            )}
            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
              {task.assignee.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </Card>
  );
}
