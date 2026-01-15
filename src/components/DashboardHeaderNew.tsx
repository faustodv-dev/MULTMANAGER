import { Search, Calendar, LogOut, Settings, CalendarDays, Filter, Building } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Profile, Department, frequencyLabels, statusLabels, TaskStatus, SchoolUnit } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationBell } from '@/components/NotificationBell';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardHeaderNewProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedAssignee: string;
  onAssigneeChange: (value: string) => void;
  selectedFrequency: string;
  onFrequencyChange: (value: string) => void;
  selectedDepartment: string;
  onDepartmentChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  selectedUnit: string;
  onUnitChange: (value: string) => void;
  selectedDateRange: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  profiles: Profile[];
  departments: Department[];
  schoolUnits: SchoolUnit[];
}

export function DashboardHeaderNew({
  searchQuery,
  onSearchChange,
  selectedAssignee,
  onAssigneeChange,
  selectedFrequency,
  onFrequencyChange,
  selectedDepartment,
  onDepartmentChange,
  selectedStatus,
  onStatusChange,
  selectedUnit,
  onUnitChange,
  selectedDateRange,
  onDateRangeChange,
  profiles,
  departments,
  schoolUnits,
}: DashboardHeaderNewProps) {
  const navigate = useNavigate();
  const { profile, signOut, isAdmin } = useAuth();

  return (
    <header className="bg-card border-b sticky top-0 z-10">
      <div className="px-6 py-4">
        {/* Top Row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie suas tarefas e acompanhe o progresso da equipe
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Date Display */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {new Date().toLocaleDateString('pt-BR', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long' 
                })}
              </span>
            </div>

            {/* Notifications */}
            <NotificationBell />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{profile?.full_name || 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground">{profile?.department?.name || 'Sem departamento'}</p>
                </div>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Configurações
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Unit Filter (Admin only) */}
          {isAdmin && schoolUnits.length > 0 && (
            <Select value={selectedUnit} onValueChange={onUnitChange}>
              <SelectTrigger className="w-[180px] bg-background">
                <Building className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {schoolUnits.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefas..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          {/* Department Filter */}
          <Select value={selectedDepartment} onValueChange={onDepartmentChange}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Assignee Filter */}
          <Select value={selectedAssignee} onValueChange={onAssigneeChange}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {profiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name || 'Sem nome'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={selectedStatus} onValueChange={onStatusChange}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start text-left font-normal bg-background">
                <CalendarDays className="mr-2 h-4 w-4" />
                {selectedDateRange.from ? (
                  selectedDateRange.to ? (
                    <>
                      {format(selectedDateRange.from, "dd/MM", { locale: ptBR })} - {format(selectedDateRange.to, "dd/MM", { locale: ptBR })}
                    </>
                  ) : (
                    format(selectedDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                  )
                ) : (
                  <span className="text-muted-foreground">Data criação</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                initialFocus
                mode="range"
                selected={selectedDateRange}
                onSelect={(range) => onDateRangeChange({ from: range?.from, to: range?.to })}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          {/* Frequency Filter */}
          <Select value={selectedFrequency} onValueChange={onFrequencyChange}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Frequência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(frequencyLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {(selectedAssignee !== 'all' || selectedFrequency !== 'all' || selectedDepartment !== 'all' || selectedStatus !== 'all' || (isAdmin && selectedUnit !== 'all') || selectedDateRange.from) && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                onAssigneeChange('all');
                onFrequencyChange('all');
                onDepartmentChange('all');
                onStatusChange('all');
                if (isAdmin) onUnitChange('all');
                onDateRangeChange({ from: undefined, to: undefined });
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
