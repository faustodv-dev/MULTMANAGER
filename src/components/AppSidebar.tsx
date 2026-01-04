import { 
  LayoutDashboard, 
  CheckSquare, 
  DollarSign, 
  GraduationCap, 
  Briefcase, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: CheckSquare, label: 'Minhas Tarefas', active: false },
  { icon: DollarSign, label: 'Financeiro', active: false },
  { icon: GraduationCap, label: 'Pedagógico', active: false },
  { icon: Briefcase, label: 'Agência de Encaminhamento', active: false },
  { icon: Settings, label: 'Configurações', active: false },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside 
      className={cn(
        "h-screen bg-sidebar flex flex-col transition-all duration-300 ease-in-out sticky top-0",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shrink-0 shadow-glow">
            <span className="text-accent-foreground font-bold text-lg">M</span>
          </div>
          {!collapsed && (
            <div className="animate-slide-in overflow-hidden">
              <h1 className="text-sidebar-foreground font-bold text-lg leading-tight">MULT</h1>
              <p className="text-sidebar-foreground/60 text-xs">Profissões</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item, index) => (
          <button
            key={index}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group",
              item.active 
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg" 
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <item.icon className={cn(
              "w-5 h-5 shrink-0",
              item.active && "animate-pulse-subtle"
            )} />
            {!collapsed && (
              <span className="text-sm font-medium truncate animate-slide-in">
                {item.label}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="px-4 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 ring-2 ring-sidebar-primary/50">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-medium">
              TG
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="animate-slide-in overflow-hidden">
              <p className="text-sidebar-foreground font-medium text-sm">Tiago Garcia</p>
              <p className="text-sidebar-foreground/50 text-xs">Administrador</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
