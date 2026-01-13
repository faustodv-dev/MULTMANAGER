import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useLeads, useUpdateLeadStage, useMediaSources } from '@/hooks/useLeads';
import { useProfiles } from '@/hooks/useProfiles';
import { useDepartments } from '@/hooks/useDepartments';
import { LeadStage, stageLabels, stageColors, Lead } from '@/types/crm';
import { LeadCard } from '@/components/crm/LeadCard';
import { LeadModal } from '@/components/crm/LeadModal';
import { LeadDrawer } from '@/components/crm/LeadDrawer';
import { 
  Search, Plus, Users, TrendingUp, Target, DollarSign, 
  Loader2, Filter, GripVertical, CalendarIcon, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

const funnelStages: LeadStage[] = ['novo', 'contato_inicial', 'qualificacao', 'apresentacao', 'negociacao', 'matricula'];

export default function CRM() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: leads = [], isLoading: loadingLeads } = useLeads();
  const { data: profiles = [] } = useProfiles();
  const { data: departments = [] } = useDepartments();
  const { data: mediaSources = [] } = useMediaSources();
  const updateLeadStage = useUpdateLeadStage();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState('all');
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  // Redirect to auth if not logged in
  if (!authLoading && !user) {
    navigate('/auth');
    return null;
  }

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = 
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone.includes(searchQuery) ||
        (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesMedia = selectedMedia === 'all' || lead.media_source_id === selectedMedia;
      const matchesAssignee = selectedAssignee === 'all' || lead.assigned_to === selectedAssignee;
      
      // Filter by date range (created_at)
      const leadDate = new Date(lead.created_at);
      const matchesStartDate = !startDate || leadDate >= startDate;
      const matchesEndDate = !endDate || leadDate <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1);
      
      return matchesSearch && matchesMedia && matchesAssignee && matchesStartDate && matchesEndDate;
    });
  }, [leads, searchQuery, selectedMedia, selectedAssignee, startDate, endDate]);

  const hasFilters = searchQuery || selectedMedia !== 'all' || selectedAssignee !== 'all' || startDate || endDate;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedMedia('all');
    setSelectedAssignee('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const grouped: Record<LeadStage, Lead[]> = {
      novo: [],
      contato_inicial: [],
      qualificacao: [],
      apresentacao: [],
      negociacao: [],
      matricula: [],
      perdido: [],
    };
    
    filteredLeads.forEach(lead => {
      if (grouped[lead.stage]) {
        grouped[lead.stage].push(lead);
      }
    });
    
    return grouped;
  }, [filteredLeads]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const activeLeads = leads.filter(l => l.status === 'ativo').length;
    const convertedLeads = leads.filter(l => l.status === 'convertido').length;
    const conversionRate = leads.length > 0 
      ? Math.round((convertedLeads / leads.length) * 100) 
      : 0;
    const totalQuoteValue = leads
      .filter(l => l.quote_value)
      .reduce((sum, l) => sum + (l.quote_value || 0), 0);
    
    return { activeLeads, convertedLeads, conversionRate, totalQuoteValue };
  }, [leads]);

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, stage: LeadStage) => {
    e.preventDefault();
    
    if (draggedLead && draggedLead.stage !== stage && user) {
      await updateLeadStage.mutateAsync({
        id: draggedLead.id,
        stage,
        userId: user.id,
      });
    }
    
    setDraggedLead(null);
  };

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-card border-b sticky top-0 z-10 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">CRM Educacional</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seus leads e acompanhe o funil de matrículas
              </p>
            </div>
            
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Lead
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            <Select value={selectedMedia} onValueChange={setSelectedMedia}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Mídia de origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as mídias</SelectItem>
                {mediaSources.map((media) => (
                  <SelectItem key={media.id} value={media.id}>
                    {media.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
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

            {/* Date Range Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="bg-background">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {startDate ? format(startDate, 'dd/MM/yy', { locale: ptBR }) : 'Início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="bg-background">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {endDate ? format(endDate, 'dd/MM/yy', { locale: ptBR }) : 'Fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
        </header>

        {/* Metrics */}
        <div className="p-6 pb-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">Leads Ativos</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{metrics.activeLeads}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 dark:text-green-400">Matrículas</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{metrics.convertedLeads}</p>
                  </div>
                  <Target className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 dark:text-purple-400">Taxa de Conversão</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{metrics.conversionRate}%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-600 dark:text-amber-400">Valor em Orçamentos</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                      {metrics.totalQuoteValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Kanban Funnel */}
        <div className="flex-1 p-6 overflow-x-auto">
          {loadingLeads ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex gap-4 min-w-max pb-4">
              {funnelStages.map((stage) => (
                <div
                  key={stage}
                  className="w-80 flex flex-col bg-muted/30 rounded-lg"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  {/* Column Header */}
                  <div className="p-3 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", stageColors[stage])} />
                        <span className="font-semibold text-sm">{stageLabels[stage]}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {leadsByStage[stage].length}
                      </Badge>
                    </div>
                  </div>

                  {/* Column Content */}
                  <div className="flex-1 p-2 space-y-2 min-h-[400px] overflow-y-auto">
                    {leadsByStage[stage].map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onClick={() => handleLeadClick(lead)}
                        onDragStart={(e) => handleDragStart(e, lead)}
                        isDragging={draggedLead?.id === lead.id}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Lead Modal */}
        <LeadModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          mediaSources={mediaSources}
          profiles={profiles}
          departments={departments}
        />

        {/* Lead Details Drawer */}
        <LeadDrawer
          lead={selectedLead}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          mediaSources={mediaSources}
          profiles={profiles}
        />
      </main>
    </div>
  );
}