import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useLeadActivities, useUpdateLead, useUpdateLeadStage, 
  useCreateLeadActivity 
} from '@/hooks/useLeads';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Lead, MediaSource, LeadStage, stageLabels, stageColors,
  activityTypeLabels
} from '@/types/crm';
import { Profile } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, Mail, Calendar, MessageCircle, FileText, 
  ArrowRight, Users, Loader2, Send, User, Building,
  DollarSign, GraduationCap, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadDrawerProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  mediaSources: MediaSource[];
  profiles: Profile[];
}

const activitySchema = z.object({
  activity_type: z.string().min(1, 'Selecione o tipo'),
  description: z.string().min(1, 'Descrição é obrigatória'),
});

type ActivityForm = z.infer<typeof activitySchema>;

const activityIcons: Record<string, React.ReactNode> = {
  call: <Phone className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  whatsapp: <MessageCircle className="w-4 h-4" />,
  meeting: <Users className="w-4 h-4" />,
  note: <FileText className="w-4 h-4" />,
  stage_change: <ArrowRight className="w-4 h-4" />,
};

export function LeadDrawer({ lead, open, onClose, mediaSources, profiles }: LeadDrawerProps) {
  const { user } = useAuth();
  const { data: activities = [], isLoading: loadingActivities } = useLeadActivities(lead?.id);
  const updateLead = useUpdateLead();
  const updateLeadStage = useUpdateLeadStage();
  const createActivity = useCreateLeadActivity();
  
  const [activityType, setActivityType] = useState('');
  const [activityDescription, setActivityDescription] = useState('');

  const handleStageChange = async (stage: LeadStage) => {
    if (!lead || !user) return;
    
    await updateLeadStage.mutateAsync({
      id: lead.id,
      stage,
      userId: user.id,
    });
  };

  const handleAddActivity = async () => {
    if (!lead || !user || !activityType || !activityDescription) return;
    
    await createActivity.mutateAsync({
      lead_id: lead.id,
      user_id: user.id,
      activity_type: activityType,
      description: activityDescription,
    });
    
    setActivityType('');
    setActivityDescription('');
  };

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {lead.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-left">{lead.name}</SheetTitle>
              <SheetDescription className="text-left flex items-center gap-2">
                <Badge className={cn("text-white", stageColors[lead.stage])}>
                  {stageLabels[lead.stage]}
                </Badge>
                {lead.media_source && (
                  <Badge variant="outline">{lead.media_source.name}</Badge>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="stage">Etapa</TabsTrigger>
            <TabsTrigger value="activities">Atividades</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 pt-4">
            {/* Contact Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Contato</h4>
              
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{lead.phone}</span>
              </div>
              
              {lead.whatsapp && (
                <a 
                  href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{lead.whatsapp}</span>
                </a>
              )}
              
              {lead.email && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{lead.email}</span>
                </div>
              )}
            </div>

            {/* Education Info */}
            {(lead.course_interest || lead.education_level) && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Educação</h4>
                
                {lead.course_interest && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <span>{lead.course_interest}</span>
                  </div>
                )}
                
                {lead.education_level && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span>{lead.education_level}</span>
                  </div>
                )}
              </div>
            )}

            {/* Financial Info */}
            {lead.quote_value && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Financeiro</h4>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Orçamento</p>
                    <p className="font-medium">
                      {lead.quote_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  
                  {lead.discount_percent && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Desconto</p>
                      <p className="font-medium">{lead.discount_percent}%</p>
                    </div>
                  )}
                  
                  {lead.final_value && (
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg col-span-2">
                      <p className="text-xs text-green-600 dark:text-green-400">Valor Final</p>
                      <p className="font-medium text-green-700 dark:text-green-300">
                        {lead.final_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Assignment */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Atribuição</h4>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  <p className="font-medium">{lead.assignee?.full_name || 'Não atribuído'}</p>
                </div>
                
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Departamento</p>
                  <p className="font-medium">{lead.department?.name || 'Não atribuído'}</p>
                </div>
              </div>
            </div>

            {/* Next Contact */}
            {lead.next_contact_date && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Próximo contato</span>
                </div>
                <p className="mt-1 text-amber-700 dark:text-amber-300">
                  {format(new Date(lead.next_contact_date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}

            {/* Notes */}
            {lead.notes && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Observações</h4>
                <p className="text-sm p-3 bg-muted/50 rounded-lg whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="stage" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Mova o lead para uma nova etapa do funil:
            </p>
            
            <div className="space-y-2">
              {(Object.keys(stageLabels) as LeadStage[]).map((stage) => (
                <button
                  key={stage}
                  onClick={() => handleStageChange(stage)}
                  disabled={lead.stage === stage || updateLeadStage.isPending}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                    lead.stage === stage 
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted border-border"
                  )}
                >
                  <div className={cn("w-3 h-3 rounded-full", stageColors[stage])} />
                  <span className="font-medium">{stageLabels[stage]}</span>
                  {lead.stage === stage && (
                    <Badge variant="secondary" className="ml-auto">Atual</Badge>
                  )}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="activities" className="space-y-4 pt-4">
            {/* Add Activity */}
            <div className="space-y-3 p-3 border rounded-lg">
              <h4 className="text-sm font-medium">Registrar Atividade</h4>
              
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de atividade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="note">Anotação</SelectItem>
                </SelectContent>
              </Select>
              
              <Textarea
                placeholder="Descreva a atividade..."
                value={activityDescription}
                onChange={(e) => setActivityDescription(e.target.value)}
                className="min-h-[80px]"
              />
              
              <Button 
                onClick={handleAddActivity}
                disabled={!activityType || !activityDescription || createActivity.isPending}
                className="w-full"
              >
                {createActivity.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Registrar
              </Button>
            </div>

            {/* Activity History */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Histórico</h4>
              
              {loadingActivities ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma atividade registrada
                </p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          {activityIcons[activity.activity_type] || <FileText className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {activityTypeLabels[activity.activity_type] || activity.activity_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(activity.created_at), "dd/MM/yy HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{activity.description}</p>
                          {activity.user && (
                            <p className="text-xs text-muted-foreground mt-1">
                              por {activity.user.full_name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}