import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeaderNew } from '@/components/DashboardHeaderNew';
import { MetricCard } from '@/components/MetricCard';
import { KanbanBoardNew } from '@/components/KanbanBoardNew';
import { TaskDrawerEdit } from '@/components/TaskDrawerEdit';
import { CreateTaskModal } from '@/components/CreateTaskModal';
import { ProcessModal } from '@/components/ProcessModal';
import { Task } from '@/types/database';
import { Process } from '@/hooks/useProcesses';
import { useTasks } from '@/hooks/useTasks';
import { useProfiles } from '@/hooks/useProfiles';
import { useDepartments } from '@/hooks/useDepartments';
import { useSchoolUnits } from '@/hooks/useSchoolUnits';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarCheck, AlertTriangle, CheckCircle2, TrendingUp, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, profile: authProfile, isAdmin, loading: authLoading } = useAuth();
  const { data: tasks = [], isLoading: loadingTasks } = useTasks();
  const { data: profiles = [] } = useProfiles();
  const { data: departments = [] } = useDepartments();
  const { data: schoolUnits = [] } = useSchoolUnits();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [selectedFrequency, setSelectedFrequency] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState<string>(() => {
    // Non-admins default to their own unit
    if (authProfile?.unit_id) return authProfile.unit_id;
    return 'all';
  });
  const [selectedDateRange, setSelectedDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [draggedProcessId, setDraggedProcessId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Filter tasks based on user role and selected filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Unit filter: non-admins only see their unit's tasks
      const userUnitId = authProfile?.unit_id;
      const matchesUnit = selectedUnit === 'all' 
        ? (isAdmin || task.unit_id === userUnitId || !task.unit_id)
        : task.unit_id === selectedUnit;
      
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower));
      const matchesAssignee = selectedAssignee === 'all' || task.assignee_id === selectedAssignee;
      const matchesFrequency = selectedFrequency === 'all' || task.frequency === selectedFrequency;
      const matchesDepartment = selectedDepartment === 'all' || task.department_id === selectedDepartment;
      const matchesStatus = selectedStatus === 'all' || task.status === selectedStatus;
      
      // Date range filter
      let matchesDateRange = true;
      if (selectedDateRange.from) {
        const taskCreatedAt = new Date(task.created_at);
        const fromDate = new Date(selectedDateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        
        if (selectedDateRange.to) {
          const toDate = new Date(selectedDateRange.to);
          toDate.setHours(23, 59, 59, 999);
          matchesDateRange = taskCreatedAt >= fromDate && taskCreatedAt <= toDate;
        } else {
          matchesDateRange = taskCreatedAt >= fromDate;
        }
      }
      
      return matchesUnit && matchesSearch && matchesAssignee && matchesFrequency && matchesDepartment && matchesStatus && matchesDateRange;
    });
  }, [tasks, searchQuery, selectedAssignee, selectedFrequency, selectedDepartment, selectedStatus, selectedUnit, selectedDateRange, isAdmin, authProfile?.unit_id]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTasks = tasks.filter(t => 
      t.due_date && new Date(t.due_date).toDateString() === today.toDateString()
    ).length;

    const overdueTasks = tasks.filter(t => 
      t.due_date && new Date(t.due_date) < today && t.status !== 'done'
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

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const processId = e.dataTransfer.getData('processId');
    if (processId) {
      setDraggedProcessId(processId);
      setCreateModalOpen(true);
    }
  };

  const handleCreateModalClose = () => {
    setCreateModalOpen(false);
    setDraggedProcessId(null);
  };

  const handleEditProcess = (process: Process) => {
    setEditingProcess(process);
    setProcessModalOpen(true);
  };

  const handleProcessModalClose = () => {
    setProcessModalOpen(false);
    setEditingProcess(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar 
        onCreateProcess={() => setProcessModalOpen(true)}
        onEditProcess={handleEditProcess}
      />
      
      <main 
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-colors",
          isDragOver && "bg-accent/20"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drop zone indicator */}
        {isDragOver && (
          <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
            <div className="bg-primary/90 text-primary-foreground px-6 py-4 rounded-xl shadow-2xl animate-pulse">
              <p className="font-semibold">Solte para criar uma nova tarefa</p>
            </div>
          </div>
        )}

        <DashboardHeaderNew
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedAssignee={selectedAssignee}
          onAssigneeChange={setSelectedAssignee}
          selectedFrequency={selectedFrequency}
          onFrequencyChange={setSelectedFrequency}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={setSelectedDepartment}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          selectedUnit={selectedUnit}
          onUnitChange={setSelectedUnit}
          selectedDateRange={selectedDateRange}
          onDateRangeChange={setSelectedDateRange}
          profiles={profiles}
          departments={departments}
          schoolUnits={schoolUnits}
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
              title="Concluídas"
              value={metrics.completedThisWeek}
              subtitle="Total concluídas"
              icon={CheckCircle2}
              variant="success"
              trend="up"
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
          {loadingTasks ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <KanbanBoardNew 
              tasks={filteredTasks} 
              onTaskClick={handleTaskClick}
            />
          )}
        </div>

        {/* Floating Action Button */}
        <Button
          onClick={() => setCreateModalOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          size="icon"
        >
          <Plus className="w-6 h-6" />
        </Button>

        {/* Task Details Drawer */}
        <TaskDrawerEdit
          task={selectedTask}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />

        {/* Create Task Modal */}
        <CreateTaskModal
          open={createModalOpen}
          onClose={handleCreateModalClose}
          initialProcessId={draggedProcessId}
        />

        {/* Process Modal (Admin only) */}
        <ProcessModal
          open={processModalOpen}
          onClose={handleProcessModalClose}
          editProcess={editingProcess}
        />
      </main>
    </div>
  );
};

export default Dashboard;
