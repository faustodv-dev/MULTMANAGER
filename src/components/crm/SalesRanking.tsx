import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lead } from '@/types/crm';
import { Profile } from '@/types/database';
import { Trophy, Medal, Award, TrendingUp, Target, Flame, Users, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SalesRankingProps {
  leads: Lead[];
  profiles: Profile[];
  currentUserId?: string;
}

interface SellerStats {
  profile: Profile;
  conversions: number;
  activeLeads: number;
  totalLeadsCreated: number;
  pipelineValue: number;
  conversionRate: number;
  score: number;
}

export function SalesRanking({ leads, profiles, currentUserId }: SalesRankingProps) {
  // Ranking by Enrollments (Matrículas)
  const enrollmentRanking = useMemo(() => {
    const stats: SellerStats[] = profiles
      .filter(p => p.full_name)
      .map(profile => {
        const userLeads = leads.filter(l => l.assigned_to === profile.id);
        const conversions = userLeads.filter(l => l.status === 'convertido').length;
        const activeLeads = userLeads.filter(l => l.status === 'ativo').length;
        const totalLeadsCreated = userLeads.length;
        const closedLeads = userLeads.filter(l => l.status === 'convertido' || l.status === 'perdido').length;
        const conversionRate = closedLeads > 0 ? Math.round((conversions / closedLeads) * 100) : 0;
        const pipelineValue = userLeads
          .filter(l => (l.stage === 'assuntos_pendentes' || l.stage === 'pendencia_eja' || l.stage === 'pendencia_online' || l.stage === 'pendencia_tecnico') && l.status === 'ativo')
          .reduce((sum, l) => sum + (l.quote_value || 0), 0);
        
        const score = conversions * 100 + conversionRate * 2;
        
        return {
          profile,
          conversions,
          activeLeads,
          totalLeadsCreated,
          pipelineValue,
          conversionRate,
          score,
        };
      })
      .filter(s => s.conversions > 0)
      .sort((a, b) => b.conversions - a.conversions || b.conversionRate - a.conversionRate)
      .slice(0, 10);
    
    return stats;
  }, [leads, profiles]);

  // Ranking by Leads Created (Leads Cadastrados)
  const leadsCreatedRanking = useMemo(() => {
    const stats: SellerStats[] = profiles
      .filter(p => p.full_name)
      .map(profile => {
        const userLeads = leads.filter(l => l.assigned_to === profile.id);
        const conversions = userLeads.filter(l => l.status === 'convertido').length;
        const activeLeads = userLeads.filter(l => l.status === 'ativo').length;
        const totalLeadsCreated = userLeads.length;
        const closedLeads = userLeads.filter(l => l.status === 'convertido' || l.status === 'perdido').length;
        const conversionRate = closedLeads > 0 ? Math.round((conversions / closedLeads) * 100) : 0;
        const pipelineValue = userLeads
          .filter(l => (l.stage === 'assuntos_pendentes' || l.stage === 'pendencia_eja' || l.stage === 'pendencia_online' || l.stage === 'pendencia_tecnico') && l.status === 'ativo')
          .reduce((sum, l) => sum + (l.quote_value || 0), 0);
        
        const score = totalLeadsCreated * 10 + activeLeads * 5;
        
        return {
          profile,
          conversions,
          activeLeads,
          totalLeadsCreated,
          pipelineValue,
          conversionRate,
          score,
        };
      })
      .filter(s => s.totalLeadsCreated > 0)
      .sort((a, b) => b.totalLeadsCreated - a.totalLeadsCreated || b.activeLeads - a.activeLeads)
      .slice(0, 10);
    
    return stats;
  }, [leads, profiles]);

  const getRankIcon = (position: number) => {
    if (position === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (position === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (position === 2) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{position + 1}</span>;
  };

  const getRankBadge = (position: number) => {
    if (position === 0) return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black';
    if (position === 1) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-black';
    if (position === 2) return 'bg-gradient-to-r from-amber-500 to-orange-600 text-white';
    return 'bg-muted text-muted-foreground';
  };

  const RankingList = ({ 
    ranking, 
    type 
  }: { 
    ranking: SellerStats[]; 
    type: 'enrollments' | 'leads' 
  }) => {
    const maxScore = ranking[0]?.score || 1;
    const maxValue = type === 'enrollments' 
      ? (ranking[0]?.conversions || 1)
      : (ranking[0]?.totalLeadsCreated || 1);

    if (ranking.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          {type === 'enrollments' 
            ? 'Nenhuma matrícula registrada ainda' 
            : 'Nenhum lead cadastrado ainda'}
        </div>
      );
    }

    return (
      <div className="divide-y">
        {ranking.map((seller, index) => {
          const isCurrentUser = seller.profile.id === currentUserId;
          const progressValue = type === 'enrollments' 
            ? seller.conversions 
            : seller.totalLeadsCreated;
          const progressPercent = (progressValue / maxValue) * 100;
          
          return (
            <div 
              key={seller.profile.id}
              className={cn(
                "p-4 transition-colors hover:bg-muted/50",
                isCurrentUser && "bg-primary/5 border-l-4 border-l-primary",
                index === 0 && "bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-950/20"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  getRankBadge(index)
                )}>
                  {getRankIcon(index)}
                </div>
                
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={cn(
                    "text-sm font-semibold",
                    index === 0 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" : "bg-primary/10"
                  )}>
                    {seller.profile.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium truncate",
                      isCurrentUser && "text-primary"
                    )}>
                      {seller.profile.full_name}
                    </span>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs">Você</Badge>
                    )}
                  </div>
                  
                  <div className="mt-1">
                    <Progress value={progressPercent} className="h-2" />
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  {type === 'enrollments' ? (
                    <>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <Target className="w-3 h-3" />
                          <span className="font-bold">{seller.conversions}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Matrículas</span>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <TrendingUp className="w-3 h-3" />
                          <span className="font-bold">{seller.conversionRate}%</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Conversão</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-primary">
                          <UserPlus className="w-3 h-3" />
                          <span className="font-bold">{seller.totalLeadsCreated}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Leads</span>
                      </div>
                      
                      <div className="text-center hidden sm:block">
                        <span className="font-bold text-muted-foreground">{seller.activeLeads}</span>
                        <span className="text-xs text-muted-foreground block">Ativos</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Ranking de Vendedores
          <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="enrollments" className="w-full">
          <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
            <TabsTrigger 
              value="enrollments" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              <Target className="w-4 h-4 mr-2" />
              Matrículas Efetuadas
            </TabsTrigger>
            <TabsTrigger 
              value="leads"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Leads Cadastrados
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="enrollments" className="mt-0">
            <RankingList ranking={enrollmentRanking} type="enrollments" />
          </TabsContent>
          
          <TabsContent value="leads" className="mt-0">
            <RankingList ranking={leadsCreatedRanking} type="leads" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
