import { Task, TaskStatus, statusLabels } from '@/types/database';
import { TaskCardNew } from './TaskCardNew';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useUpdateTask } from '@/hooks/useTasks';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useState } from 'react';

interface KanbanBoardNewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const columns: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

const columnColors: Record<TaskStatus, string> = {
  todo: 'bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/50',
  in_progress: 'bg-gradient-to-b from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-950/30',
  review: 'bg-gradient-to-b from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-950/30',
  done: 'bg-gradient-to-b from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-950/30',
};

const columnDotColors: Record<TaskStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  review: 'bg-amber-500',
  done: 'bg-emerald-500',
};

const columnHeaderColors: Record<TaskStatus, string> = {
  todo: 'border-slate-300 dark:border-slate-600',
  in_progress: 'border-blue-300 dark:border-blue-700',
  review: 'border-amber-300 dark:border-amber-700',
  done: 'border-emerald-300 dark:border-emerald-700',
};

interface DraggableTaskCardProps {
  task: Task;
  onClick: () => void;
}

function DraggableTaskCard({ task, onClick }: DraggableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "touch-none cursor-grab active:cursor-grabbing transition-opacity",
        isDragging && "opacity-50"
      )}
    >
      <TaskCardNew task={task} onClick={onClick} />
    </div>
  );
}

interface DroppableColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  isOver: boolean;
}

function DroppableColumn({ status, tasks, onTaskClick, isOver }: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-80 flex-shrink-0 rounded-xl p-4 transition-all duration-200 border-2 border-transparent",
        columnColors[status],
        isOver && "border-primary/50 shadow-lg scale-[1.02]"
      )}
    >
      {/* Column Header */}
      <div className={cn(
        "flex items-center justify-between mb-4 pb-3 border-b-2",
        columnHeaderColors[status]
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-3 h-3 rounded-full shadow-sm",
            columnDotColors[status]
          )} />
          <h3 className="font-semibold text-sm text-foreground">
            {statusLabels[status]}
          </h3>
        </div>
        <span className={cn(
          "text-xs font-bold px-2.5 py-1 rounded-full",
          status === 'done' ? "bg-emerald-500 text-white" : "bg-background/80 text-muted-foreground"
        )}>
          {tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <div className="space-y-3 min-h-[100px]">
        {tasks.length === 0 ? (
          <div className={cn(
            "p-8 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg transition-colors",
            isOver ? "border-primary/50 bg-primary/5" : "border-border/50"
          )}>
            {isOver ? "Solte aqui" : "Nenhuma tarefa"}
          </div>
        ) : (
          tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function KanbanBoardNew({ tasks, onTaskClick }: KanbanBoardNewProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const updateTask = useUpdateTask();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter(task => task.status === status);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: any) => {
    const over = event.over;
    if (over && columns.includes(over.id as TaskStatus)) {
      setOverColumn(over.id as TaskStatus);
    } else {
      setOverColumn(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverColumn(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    if (!columns.includes(newStatus)) return;

    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus) {
      updateTask.mutate({
        id: taskId,
        updates: { status: newStatus },
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="relative">
        <ScrollArea className="w-full pb-4">
          <div className="flex gap-6 p-6 min-w-max">
            {columns.map((status) => {
              const columnTasks = getTasksByStatus(status);
              return (
                <DroppableColumn
                  key={status}
                  status={status}
                  tasks={columnTasks}
                  onTaskClick={onTaskClick}
                  isOver={overColumn === status}
                />
              );
            })}
          </div>
          <ScrollBar 
            orientation="horizontal" 
            className="h-3 bg-muted/50 rounded-full mx-4 mb-2"
          />
        </ScrollArea>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="rotate-3 scale-105 opacity-90">
            <TaskCardNew task={activeTask} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}