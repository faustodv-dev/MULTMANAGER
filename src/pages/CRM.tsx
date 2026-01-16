import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
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
import { useSchoolUnits } from '@/hooks/useSchoolUnits';
import { LeadStage, stageLabels, stageColors, Lead, statusLabels } from '@/types/crm';
import { LeadCard } from '@/components/crm/LeadCard';
import { LeadModal } from '@/components/crm/LeadModal';
import { LeadDrawer } from '@/components/crm/LeadDrawer';
import { SalesRanking } from '@/components/crm/SalesRanking';
import { 
  Search, Plus, Users, TrendingUp, Target, DollarSign, 
  Loader2, Filter, GripVertical, CalendarIcon, X, PhoneCall,
  AlertTriangle, Clock, Building, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const funnelStages: LeadStage[] = ['novo', 'contato_inicial', 'qualificacao', 'apresentacao', 'negociacao', 'matricula'];

export default function CRM() {
  const navigate = useNavigate();
  const { user, profile: authProfile, isAdmin, loading: authLoading } = useAuth();
  const { data: leads = [], isLoading: loadingLeads } = useLeads();
  const { data: profiles = [] } = useProfiles();
  const { data: departments = [] } = useDepartments();
  const { data: schoolUnits = [] } = useSchoolUnits();
  const { data: mediaSources = [] } = useMediaSources();
  const updateLeadStage = useUpdateLeadStage();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>(() => {
    // Non-admins default to seeing only their own leads
    if (authProfile && !authProfile.unit_id) return 'all';
    return 'all';
  });
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState<string>(() => {
    // Non-admins default to their own unit
    if (authProfile?.unit_id) return authProfile.unit_id;
    return 'all';
  });
  const [filterType, setFilterType] = useState<'created' | 'return'>('created');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<'funnel' | 'personal' | 'ranking'>('funnel');

  // Redirect to auth if not logged in
  if (!authLoading && !user) {
    navigate('/auth');
    return null;
  }

  // Filter leads based on user role and selected filters
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Unit filter: non-admins only see their unit's leads
      const userUnitId = authProfile?.unit_id;
      const matchesUnit = selectedUnit === 'all' 
        ? (isAdmin || lead.unit_id === userUnitId)
        : lead.unit_id === selectedUnit;
      
      const matchesSearch = 
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone.includes(searchQuery) ||
        (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesMedia = selectedMedia === 'all' || lead.media_source_id === selectedMedia;
      const matchesAssignee = selectedAssignee === 'all' || lead.assigned_to === selectedAssignee;
      const matchesStatus = selectedStatus === 'all' || lead.status === selectedStatus;
      
      // Filter by date range based on filterType
      const dateToFilter = filterType === 'return' 
        ? (lead.next_contact_date ? new Date(lead.next_contact_date) : null)
        : new Date(lead.created_at);
      
      let matchesDateRange = true;
      if (dateToFilter) {
        const matchesStartDate = !startDate || dateToFilter >= startOfDay(startDate);
        const matchesEndDate = !endDate || dateToFilter <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1);
        matchesDateRange = matchesStartDate && matchesEndDate;
      } else if (filterType === 'return' && (startDate || endDate)) {
        // If filtering by return date and lead has no return date, exclude it
        matchesDateRange = false;
      }
      
      return matchesUnit && matchesSearch && matchesMedia && matchesAssignee && matchesStatus && matchesDateRange;
    });
  }, [leads, searchQuery, selectedMedia, selectedAssignee, selectedStatus, selectedUnit, filterType, startDate, endDate, isAdmin, authProfile?.unit_id]);

  const hasFilters = searchQuery || selectedMedia !== 'all' || selectedAssignee !== 'all' || selectedStatus !== 'all' || (isAdmin && selectedUnit !== 'all') || startDate || endDate;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedMedia('all');
    setSelectedAssignee('all');
    setSelectedStatus('all');
    if (isAdmin) setSelectedUnit('all');
    setFilterType('created');
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

  // Calculate metrics with improved data for salespeople
  const metrics = useMemo(() => {
    const today = startOfDay(new Date());
    const leadsForMetrics = viewMode === 'personal' && user 
      ? leads.filter(l => l.assigned_to === user.id)
      : leads;
    
    // Only count active leads (not inactive, not converted, not lost)
    const activeLeads = leadsForMetrics.filter(l => l.status === 'ativo');
    
    // Leads with return scheduled for today
    const returnsToday = leadsForMetrics.filter(l => 
      l.status === 'ativo' && 
      l.next_contact_date && 
      isToday(new Date(l.next_contact_date))
    ).length;
    
    // Overdue returns - leads that have next_contact_date in the past and still active
    const overdueReturns = leadsForMetrics.filter(l => 
      l.status === 'ativo' && 
      l.next_contact_date && 
      isBefore(new Date(l.next_contact_date), today) &&
      !isToday(new Date(l.next_contact_date))
    ).length;
    
    // Converted leads (matricula)
    const convertedLeads = leadsForMetrics.filter(l => l.status === 'convertido').length;
    
    // Conversion rate (only considering leads that exited the funnel - converted or lost)
    const closedLeads = leadsForMetrics.filter(l => l.status === 'convertido' || l.status === 'perdido');
    const conversionRate = closedLeads.length > 0 
      ? Math.round((convertedLeads / closedLeads.length) * 100) 
      : 0;
    
    // Total quote value only from active leads
    const totalQuoteValue = activeLeads
      .filter(l => l.quote_value)
      .reduce((sum, l) => sum + (l.quote_value || 0), 0);
    
    // Pipeline value (leads in negotiation stage)
    const pipelineValue = leadsForMetrics
      .filter(l => l.stage === 'negociacao' && l.status === 'ativo' && l.quote_value)
      .reduce((sum, l) => sum + (l.quote_value || 0), 0);
    
    return { 
      activeLeads: activeLeads.length, 
      returnsToday,
      overdueReturns,
      convertedLeads, 
      conversionRate, 
      totalQuoteValue,
      pipelineValue
    };
  }, [leads, viewMode, user]);

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
                {viewMode === 'personal' ? 'Meus leads e performance pessoal' : 'Gerencie seus leads e acompanhe o funil de matrículas'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* View Mode Tabs */}
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'funnel' | 'personal' | 'ranking')}>
                <TabsList>
                  <TabsTrigger value="funnel" className="gap-1">
                    <Target className="w-4 h-4" />
                    Funil
                  </TabsTrigger>
                  <TabsTrigger value="personal" className="gap-1">
                    <User className="w-4 h-4" />
                    Meus Leads
                  </TabsTrigger>
                  <TabsTrigger value="ranking" className="gap-1">
                    <TrendingUp className="w-4 h-4" />
                    Ranking
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Lead
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Unit Filter (Admin only) */}
            {isAdmin && schoolUnits.length > 0 && (
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
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

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[150px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="convertido">Convertido</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filter Type */}
            <Select value={filterType} onValueChange={(v) => setFilterType(v as 'created' | 'return')}>
              <SelectTrigger className="w-[160px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Data criação</SelectItem>
                <SelectItem value="return">Data retorno</SelectItem>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Retornos Hoje - Destaque para o vendedor */}
            <Card 
              className={cn(
                "bg-gradient-to-br border cursor-pointer hover:shadow-lg transition-shadow",
                metrics.returnsToday > 0 
                  ? "from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 border-cyan-200 dark:border-cyan-800"
                  : "from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 border-gray-200 dark:border-gray-800"
              )}
              onClick={() => {
                setFilterType('return');
                setStartDate(new Date());
                setEndDate(new Date());
              }}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-cyan-600 dark:text-cyan-400">Retornos Hoje</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      metrics.returnsToday > 0 ? "text-cyan-700 dark:text-cyan-300" : "text-gray-500"
                    )}>{metrics.returnsToday}</p>
                  </div>
                  <PhoneCall className={cn(
                    "w-6 h-6",
                    metrics.returnsToday > 0 ? "text-cyan-500" : "text-gray-400"
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* Retornos Atrasados */}
            <Card 
              className={cn(
                "bg-gradient-to-br border cursor-pointer hover:shadow-lg transition-shadow",
                metrics.overdueReturns > 0 
                  ? "from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800 animate-pulse"
                  : "from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 border-gray-200 dark:border-gray-800"
              )}
              onClick={() => {
                setFilterType('return');
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                setStartDate(undefined);
                setEndDate(yesterday);
              }}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-red-600 dark:text-red-400">Atrasados</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      metrics.overdueReturns > 0 ? "text-red-700 dark:text-red-300" : "text-gray-500"
                    )}>{metrics.overdueReturns}</p>
                  </div>
                  <AlertTriangle className={cn(
                    "w-6 h-6",
                    metrics.overdueReturns > 0 ? "text-red-500" : "text-gray-400"
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* Leads Ativos */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Leads Ativos</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{metrics.activeLeads}</p>
                  </div>
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            {/* Matrículas */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-600 dark:text-green-400">Matrículas</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{metrics.convertedLeads}</p>
                  </div>
                  <Target className="w-6 h-6 text-green-500" />
                </div>
              </CardContent>
            </Card>

            {/* Taxa de Conversão */}
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-600 dark:text-purple-400">Conversão</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{metrics.conversionRate}%</p>
                  </div>
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            {/* Pipeline */}
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-amber-600 dark:text-amber-400">Pipeline</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {metrics.pipelineValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
                    </p>
                  </div>
                  <DollarSign className="w-6 h-6 text-amber-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Content based on view mode */}
        <div className="flex-1 p-6 overflow-x-auto">
          {loadingLeads ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : viewMode === 'ranking' ? (
            <div className="max-w-4xl mx-auto">
              <SalesRanking 
                leads={leads} 
                profiles={profiles} 
                currentUserId={user?.id} 
              />
            </div>
          ) : (
            <div className="flex gap-4 min-w-max pb-4">
              {funnelStages.map((stage) => {
                // Filter leads by stage, and if personal mode, only show user's leads
                const stageLeads = viewMode === 'personal' && user
                  ? leadsByStage[stage].filter(l => l.assigned_to === user.id)
                  : leadsByStage[stage];

                return (
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
                          {stageLeads.length}
                        </Badge>
                      </div>
                    </div>

                    {/* Column Content */}
                    <div className="flex-1 p-2 space-y-2 min-h-[400px] overflow-y-auto">
                      {stageLeads.map((lead) => (
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
                );
              })}
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