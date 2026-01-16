import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Lead } from '@/types/crm';
import { Profile } from '@/types/database';
import { Trophy, Medal, Award, TrendingUp, Target, Flame } from 'lucide-react';
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
  pipelineValue: number;
  conversionRate: number;
  score: number;
}

export function SalesRanking({ leads, profiles, currentUserId }: SalesRankingProps) {
  const ranking = useMemo(() => {
    const stats: SellerStats[] = profiles
      .filter(p => p.full_name) // Only profiles with names
      .map(profile => {
        const userLeads = leads.filter(l => l.assigned_to === profile.id);
        const conversions = userLeads.filter(l => l.status === 'convertido').length;
        const activeLeads = userLeads.filter(l => l.status === 'ativo').length;
        const closedLeads = userLeads.filter(l => l.status === 'convertido' || l.status === 'perdido').length;
        const conversionRate = closedLeads > 0 ? Math.round((conversions / closedLeads) * 100) : 0;
        const pipelineValue = userLeads
          .filter(l => l.stage === 'negociacao' && l.status === 'ativo')
          .reduce((sum, l) => sum + (l.quote_value || 0), 0);
        
        // Score calculation: conversions * 100 + activeLeads * 10 + conversionRate * 2
        const score = conversions * 100 + activeLeads * 10 + conversionRate * 2;
        
        return {
          profile,
          conversions,
          activeLeads,
          pipelineValue,
          conversionRate,
          score,
        };
      })
      .filter(s => s.conversions > 0 || s.activeLeads > 0) // Only show sellers with activity
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10
    
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

  const maxScore = ranking[0]?.score || 1;

  if (ranking.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Ranking de Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            Nenhum vendedor com atividade ainda
          </p>
        </CardContent>
      </Card>
    );
  }

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
        <div className="divide-y">
          {ranking.map((seller, index) => {
            const isCurrentUser = seller.profile.id === currentUserId;
            const progressPercent = (seller.score / maxScore) * 100;
            
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
                  {/* Rank Icon */}
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    getRankBadge(index)
                  )}>
                    {getRankIcon(index)}
                  </div>
                  
                  {/* Avatar */}
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={cn(
                      "text-sm font-semibold",
                      index === 0 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" : "bg-primary/10"
                    )}>
                      {seller.profile.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Info */}
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
                    
                    {/* Progress Bar */}
                    <div className="mt-1">
                      <Progress 
                        value={progressPercent} 
                        className="h-2" 
                      />
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm">
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
                    
                    <div className="text-center hidden sm:block">
                      <span className="font-bold text-muted-foreground">{seller.activeLeads}</span>
                      <span className="text-xs text-muted-foreground block">Ativos</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
