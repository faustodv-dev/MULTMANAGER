import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDepartments } from '@/hooks/useDepartments';
import { departmentColors } from '@/types/database';

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { profile, isAdmin } = useAuth();
  const { data: departments = [] } = useDepartments();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', active: location.pathname === '/' },
    ...(isAdmin ? [{ icon: Settings, label: 'Configurações', path: '/settings', active: location.pathname === '/settings' }] : []),
  ];

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
            onClick={() => navigate(item.path)}
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

        {/* Departments Section */}
        {!collapsed && departments.length > 0 && (
          <div className="pt-4 mt-4 border-t border-sidebar-border">
            <p className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
              Departamentos
            </p>
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="flex items-center gap-3 px-4 py-2 text-sidebar-foreground/70 text-sm"
              >
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  departmentColors[dept.color_theme] || 'bg-gray-500'
                )} />
                <span className="truncate">{dept.name}</span>
              </div>
            ))}
          </div>
        )}
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
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-medium">
              {profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="animate-slide-in overflow-hidden">
              <p className="text-sidebar-foreground font-medium text-sm truncate">
                {profile?.full_name || 'Usuário'}
              </p>
              <p className="text-sidebar-foreground/50 text-xs">
                {profile?.department?.name || 'Sem departamento'}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
