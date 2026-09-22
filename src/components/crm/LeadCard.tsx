import { Lead, statusLabels } from '@/types/crm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Phone, Mail, Calendar, GripVertical, AlertTriangle, Clock, Ban } from 'lucide-react';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  isDragging: boolean;
}

export function LeadCard({ lead, onClick, onDragStart, isDragging }: LeadCardProps) {
  const today = startOfDay(new Date());
  const nextContactDate = lead.next_contact_date ? new Date(lead.next_contact_date) : null;
  
  const isOverdue = nextContactDate && isBefore(nextContactDate, today) && !isToday(nextContactDate);
  const isReturnToday = nextContactDate && isToday(nextContactDate);
  const isInactive = lead.status === 'inativo';

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "cursor-pointer hover:shadow-md transition-all group",
        isDragging && "opacity-50 scale-95",
        isInactive && "opacity-60 bg-gray-50 dark:bg-gray-900",
        isOverdue && !isInactive && "border-red-300 dark:border-red-700",
        isReturnToday && !isInactive && "border-cyan-300 dark:border-cyan-700 bg-cyan-50/50 dark:bg-cyan-950/30"
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0 mt-1" />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {isInactive && (
                  <Ban className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                )}
                <p className={cn(
                  "font-medium text-sm truncate",
                  isInactive && "text-muted-foreground"
                )}>{lead.name}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isOverdue && !isInactive && (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
                {isReturnToday && !isInactive && (
                  <Clock className="w-4 h-4 text-cyan-500" />
                )}
                {lead.assignee && (
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-[10px] bg-primary/10">
                      {lead.assignee.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>

            {/* Status badge for inactive leads */}
            {isInactive && (
              <Badge variant="secondary" className="mb-2 text-[10px] bg-gray-200 dark:bg-gray-700">
                {statusLabels[lead.status]}
              </Badge>
            )}

            {lead.student && (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 min-w-0">
                  <GraduationCap className="w-3 h-3 shrink-0" />
                  <span className="truncate">{lead.student.name}</span>
                </div>
                {lead.student.code && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                    {lead.student.code}
                  </Badge>
                )}
              </div>
            )}

            {lead.next_contact_date && (
              <div className={cn(
                "flex items-center gap-1 mt-2 text-[10px]",
                isOverdue && !isInactive && "text-red-600 dark:text-red-400 font-medium",
                isReturnToday && !isInactive && "text-cyan-600 dark:text-cyan-400 font-medium",
                !isOverdue && !isReturnToday && "text-amber-600 dark:text-amber-400"
              )}>
                <Calendar className="w-3 h-3" />
                <span>
                  {isOverdue && !isInactive && "⚠ Atrasado: "}
                  {isReturnToday && !isInactive && "🔔 Hoje: "}
                  {format(new Date(lead.next_contact_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}

            {lead.quote_value && (
              <div className="mt-2 text-xs font-medium text-green-600 dark:text-green-400">
                Orçamento: {lead.quote_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}