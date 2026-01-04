import { useState, useMemo } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { MetricCard } from '@/components/MetricCard';
import { KanbanBoard } from '@/components/KanbanBoard';
import { TaskDrawer } from '@/components/TaskDrawer';
import { initialTasks, assignees } from '@/data/tasks';
import { Task } from '@/types/task';
import { CalendarCheck, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';

const Index = () => {
  const [tasks] = useState<Task[]>(initialTasks);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [selectedFrequency, setSelectedFrequency] = useState('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAssignee = selectedAssignee === 'all' || task.assignee.id === selectedAssignee;
      const matchesFrequency = selectedFrequency === 'all' || task.frequency === selectedFrequency;
      return matchesSearch && matchesAssignee && matchesFrequency;
    });
  }, [tasks, searchQuery, selectedAssignee, selectedFrequency]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayTasks = tasks.filter(t => 
      t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString()
    ).length;

    const overdueTasks = tasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < today && t.status !== 'done'
    ).length;

    const completedThisWeek = tasks.filter(t => t.status === 'done').length;

    const totalTasks = tasks.length;
    const productivity = totalTasks > 0 
      ? Math.round((completedThisWeek / totalTasks) * 100) 
      : 0;

    return { todayTasks, overdueTasks, completedThisWeek, productivity };
  }, [tasks]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedAssignee={selectedAssignee}
          onAssigneeChange={setSelectedAssignee}
          selectedFrequency={selectedFrequency}
          onFrequencyChange={setSelectedFrequency}
          assignees={assignees}
        />

        {/* Metrics Section */}
        <div className="p-6 pb-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Tarefas Hoje"
              value={metrics.todayTasks}
              subtitle="Para entregar hoje"
              icon={CalendarCheck}
              variant="accent"
            />
            <MetricCard
              title="Atrasadas"
              value={metrics.overdueTasks}
              subtitle="Precisam de atenção"
              icon={AlertTriangle}
              variant="destructive"
              trend={metrics.overdueTasks > 0 ? 'down' : 'neutral'}
            />
            <MetricCard
              title="Concluídas na Semana"
              value={metrics.completedThisWeek}
              subtitle="Ótimo trabalho!"
              icon={CheckCircle2}
              variant="success"
              trend="up"
              trendValue="+12%"
            />
            <MetricCard
              title="Produtividade"
              value={`${metrics.productivity}%`}
              subtitle="Taxa de conclusão"
              icon={TrendingUp}
              variant="default"
            />
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1">
          <KanbanBoard 
            tasks={filteredTasks} 
            onTaskClick={handleTaskClick}
          />
        </div>

        {/* Task Details Drawer */}
        <TaskDrawer
          task={selectedTask}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      </main>
    </div>
  );
};

export default Index;
