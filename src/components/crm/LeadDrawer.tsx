import { useState, useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useLeadActivities,
  useUpdateLead,
  useUpdateLeadStage,
  useCreateLeadActivity,
  useDeleteLead,
} from '@/hooks/useLeads';
import { useAuth } from '@/contexts/AuthContext';
import {
  Lead,
  MediaSource,
  LeadStage,
  LeadStatus,
  stageLabels,
  stageColors,
  activityTypeLabels,
  statusLabels,
} from '@/types/crm';
import { Profile } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone, Mail, MessageCircle, FileText, ArrowRight, Users,
  Loader2, Send, GraduationCap, Trash2, Save, Calendar as CalendarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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

const stageOptions: LeadStage[] = [
  'assuntos_pendentes',
  'pendencia_eja',
  'pendencia_online',
  'pendencia_tecnico',
  'desistentes',
  'rescisao_cancelamento',
  'finalizado',
];

const statusOptions: LeadStatus[] = ['ativo', 'inativo', 'convertido', 'perdido'];

export function LeadDrawer({ lead, open, onClose, profiles }: LeadDrawerProps) {
  const { user, isAdmin } = useAuth();
  const { data: activities = [], isLoading: loadingActivities } = useLeadActivities(lead?.id);
  const updateLead = useUpdateLead();
  const updateStage = useUpdateLeadStage();
  const createActivity = useCreateLeadActivity();
  const deleteLead = useDeleteLead();

  const [name, setName] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [nextContactDate, setNextContactDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (lead) {
      setName(lead.name || '');
      setAssignedTo(lead.assigned_to || '');
      setNextContactDate(
        lead.next_contact_date ? lead.next_contact_date.slice(0, 16) : '',
      );
      setNotes(lead.notes || '');
    }
  }, [lead?.id]);

  const activityForm = useForm<ActivityForm>({
    resolver: zodResolver(activitySchema),
    defaultValues: { activity_type: 'note', description: '' },
  });

  if (!lead) return null;

  const canManage = isAdmin || lead.created_by === user?.id;

  const handleSave = async () => {
    await updateLead.mutateAsync({
      id: lead.id,
      updates: {
        name,
        assigned_to: assignedTo || null,
        next_contact_date: nextContactDate ? new Date(nextContactDate).toISOString() : null,
        notes: notes || null,
      },
    });
  };

  const handleStageChange = async (stage: string) => {
    if (!user) return;
    await updateStage.mutateAsync({ id: lead.id, stage: stage as LeadStage, userId: user.id });
  };

  const handleStatusChange = async (status: string) => {
    await updateLead.mutateAsync({ id: lead.id, updates: { status: status as LeadStatus } });
  };

  const onSubmitActivity = async (data: ActivityForm) => {
    if (!user) return;
    await createActivity.mutateAsync({
      lead_id: lead.id,
      user_id: user.id,
      student_id: lead.student_id,
      activity_type: data.activity_type,
      description: data.description,
    });
    activityForm.reset({ activity_type: data.activity_type, description: '' });
  };

  const handleDelete = async () => {
    await deleteLead.mutateAsync(lead.id);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader className="space-y-2">
          <SheetTitle className="flex items-center gap-2 pr-6">
            <div className={cn('w-3 h-3 rounded-full shrink-0', stageColors[lead.stage])} />
            <span className="truncate">{lead.name}</span>
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {lead.student ? (
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <GraduationCap className="w-4 h-4 text-primary" />
                <span className="font-medium">{lead.student.name}</span>
                {lead.student.code && (
                  <Badge variant="outline" className="text-[10px]">Cód. {lead.student.code}</Badge>
                )}
              </span>
            ) : (
              <span>Sem aluno vinculado</span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* ---- Cadastro do atendimento ---- */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Assunto do atendimento</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Etapa</Label>
                <Select value={lead.stage} onValueChange={handleStageChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stageLabels[stage]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Situação</Label>
                <Select value={lead.status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Select
                  value={assignedTo}
                  onValueChange={setAssignedTo}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || 'Sem nome'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Data de retorno</Label>
                <Input
                  type="datetime-local"
                  value={nextContactDate}
                  onChange={(e) => setNextContactDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[70px]"
                placeholder="Anotações gerais do atendimento..."
              />
            </div>

            <div className="flex items-center justify-between">
              <Button onClick={handleSave} disabled={updateLead.isPending}>
                {updateLead.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar
              </Button>

              {canManage && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir atendimento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. O aluno continuará cadastrado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          <Separator />

          {/* ---- Atividades ---- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Atividades</h3>
              <Badge variant="secondary" className="text-[10px]">
                {activities.length}
              </Badge>
            </div>

            <form
              onSubmit={activityForm.handleSubmit(onSubmitActivity)}
              className="space-y-2 rounded-lg border p-3"
            >
              <Select
                value={activityForm.watch('activity_type')}
                onValueChange={(v) => activityForm.setValue('activity_type', v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(activityTypeLabels)
                    .filter(([key]) => key !== 'stage_change')
                    .map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Textarea
                placeholder="Descreva a interação com o aluno..."
                className="min-h-[70px]"
                {...activityForm.register('description')}
              />
              {activityForm.formState.errors.description && (
                <p className="text-xs text-destructive">
                  {activityForm.formState.errors.description.message}
                </p>
              )}

              <Button type="submit" size="sm" disabled={createActivity.isPending}>
                {createActivity.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Registrar
              </Button>
            </form>

            <div className="space-y-3">
              {loadingActivities && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!loadingActivities && activities.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma atividade registrada ainda.
                </p>
              )}

              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {activityIcons[activity.activity_type] || <FileText className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">
                        {activityTypeLabels[activity.activity_type] || activity.activity_type}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(activity.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                      {activity.description}
                    </p>
                    {activity.user && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px] bg-primary/10">
                            {activity.user.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || '??'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] text-muted-foreground">
                          {activity.user.full_name || 'Usuário'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
