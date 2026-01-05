import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FileText, Plus, GripVertical } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDepartments } from '@/hooks/useDepartments';
import { useProcesses, Process } from '@/hooks/useProcesses';
import { departmentColors } from '@/types/database';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
interface AppSidebarProps {
  onProcessDrag?: (processId: string) => void;
  onCreateProcess?: () => void;
}
export function AppSidebar({
  onProcessDrag,
  onCreateProcess
}: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const {
    profile,
    isAdmin
  } = useAuth();
  const {
    data: departments = []
  } = useDepartments();
  const {
    data: processes = []
  } = useProcesses();
  const menuItems = [{
    icon: LayoutDashboard,
    label: 'Dashboard',
    path: '/',
    active: location.pathname === '/'
  }, ...(isAdmin ? [{
    icon: Settings,
    label: 'Configurações',
    path: '/settings',
    active: location.pathname === '/settings'
  }] : [])];

  // Group processes by department
  const processesByDept = departments.reduce((acc, dept) => {
    acc[dept.id] = processes.filter(p => p.department_id === dept.id);
    return acc;
  }, {} as Record<string, Process[]>);

  // Processes without department
  const unassignedProcesses = processes.filter(p => !p.department_id);
  const toggleDept = (deptId: string) => {
    setExpandedDepts(prev => ({
      ...prev,
      [deptId]: !prev[deptId]
    }));
  };
  const handleDragStart = (e: React.DragEvent, process: Process) => {
    e.dataTransfer.setData('processId', process.id);
    e.dataTransfer.effectAllowed = 'copy';
  };
  return <aside className={cn("h-screen bg-sidebar flex flex-col transition-all duration-300 ease-in-out sticky top-0", collapsed ? "w-20" : "w-72")}>
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border bg-[#1e5223]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shrink-0 shadow-glow">
            <span className="text-accent-foreground font-bold text-lg">M</span>
          </div>
          {!collapsed && <div className="animate-slide-in overflow-hidden">
              <h1 className="text-sidebar-foreground font-bold text-lg leading-tight">MULT</h1>
              <p className="text-sidebar-foreground/60 text-xs">Profissões</p>
            </div>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto bg-[#1e5222]">
        {menuItems.map((item, index) => <button key={index} onClick={() => navigate(item.path)} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group", item.active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground")}>
            <item.icon className={cn("w-5 h-5 shrink-0", item.active && "animate-pulse-subtle")} />
            {!collapsed && <span className="text-sm font-medium truncate animate-slide-in">
                {item.label}
              </span>}
          </button>)}

        {/* Departments & Processes Section */}
        {!collapsed && <div className="pt-4 mt-4 border-t border-sidebar-border">
            <div className="flex items-center justify-between px-4 mb-2">
              <p className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                Processos
              </p>
              {isAdmin && onCreateProcess && <Button variant="ghost" size="icon" className="h-6 w-6 text-sidebar-foreground/50 hover:text-sidebar-foreground" onClick={onCreateProcess}>
                  <Plus className="w-4 h-4" />
                </Button>}
            </div>
            
            {departments.map(dept => {
          const deptProcesses = processesByDept[dept.id] || [];
          const isExpanded = expandedDepts[dept.id] ?? false;
          return <Collapsible key={dept.id} open={isExpanded} onOpenChange={() => toggleDept(dept.id)}>
                  <CollapsibleTrigger className="w-full flex items-center gap-3 px-4 py-2 text-sidebar-foreground/70 hover:bg-sidebar-accent rounded-lg transition-colors">
                    <div className={cn("w-3 h-3 rounded-sm", departmentColors[dept.color_theme] || 'bg-gray-500')} />
                    <span className="flex-1 text-left text-sm font-medium truncate">{dept.name}</span>
                    <span className="text-xs text-sidebar-foreground/40">{deptProcesses.length}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-sidebar-foreground/40" /> : <ChevronDown className="w-4 h-4 text-sidebar-foreground/40" />}
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="pl-6">
                    {deptProcesses.length === 0 ? <p className="px-4 py-2 text-xs text-sidebar-foreground/40 italic">
                        Nenhum processo
                      </p> : deptProcesses.map(process => <div key={process.id} draggable onDragStart={e => handleDragStart(e, process)} className="flex items-center gap-2 px-3 py-2 text-sidebar-foreground/60 hover:bg-sidebar-accent/50 rounded-md cursor-grab active:cursor-grabbing transition-colors group">
                          <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-50 shrink-0" />
                          <FileText className="w-4 h-4 shrink-0" />
                          <span className="text-sm truncate flex-1">{process.title}</span>
                        </div>)}
                  </CollapsibleContent>
                </Collapsible>;
        })}

            {/* Unassigned processes */}
            {unassignedProcesses.length > 0 && <div className="mt-2">
                <p className="px-4 py-1 text-xs text-sidebar-foreground/40">Sem departamento</p>
                {unassignedProcesses.map(process => <div key={process.id} draggable onDragStart={e => handleDragStart(e, process)} className="flex items-center gap-2 px-4 py-2 text-sidebar-foreground/60 hover:bg-sidebar-accent/50 rounded-md cursor-grab active:cursor-grabbing transition-colors group">
                    <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-50 shrink-0" />
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="text-sm truncate flex-1">{process.title}</span>
                  </div>)}
              </div>}
          </div>}
      </nav>

      {/* Collapse Toggle */}
      <div className="px-4 pb-2 bg-[#1e5223]">
        <Button variant="ghost" size="sm" onClick={() => setCollapsed(!collapsed)} className="w-full justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-sidebar-border bg-[#1e5223]">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 ring-2 ring-sidebar-primary/50">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-medium">
              {profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && <div className="animate-slide-in overflow-hidden">
              <p className="text-sidebar-foreground font-medium text-sm truncate">
                {profile?.full_name || 'Usuário'}
              </p>
              <p className="text-sidebar-foreground/50 text-xs">
                {profile?.department?.name || 'Sem departamento'}
              </p>
            </div>}
        </div>
      </div>
    </aside>;
}