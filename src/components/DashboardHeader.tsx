import { Search, Bell, Filter, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Assignee } from '@/types/task';

interface DashboardHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedAssignee: string;
  onAssigneeChange: (value: string) => void;
  selectedFrequency: string;
  onFrequencyChange: (value: string) => void;
  assignees: Assignee[];
}

export function DashboardHeader({
  searchQuery,
  onSearchChange,
  selectedAssignee,
  onAssigneeChange,
  selectedFrequency,
  onFrequencyChange,
  assignees,
}: DashboardHeaderProps) {
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
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                3
              </span>
            </Button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
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

          {/* Assignee Filter */}
          <Select value={selectedAssignee} onValueChange={onAssigneeChange}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {assignees.map((assignee) => (
                <SelectItem key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Frequency Filter */}
          <Select value={selectedFrequency} onValueChange={onFrequencyChange}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Frequência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="Diário">Diário</SelectItem>
              <SelectItem value="Semanal">Semanal</SelectItem>
              <SelectItem value="Mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>

          {/* Active Filters */}
          {(selectedAssignee !== 'all' || selectedFrequency !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                onAssigneeChange('all');
                onFrequencyChange('all');
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
