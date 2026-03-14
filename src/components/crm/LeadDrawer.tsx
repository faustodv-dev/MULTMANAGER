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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useLeadActivities, useUpdateLead, useUpdateLeadStage, 
  useCreateLeadActivity, useDeleteLead 
} from '@/hooks/useLeads';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Lead, MediaSource, LeadStage, LeadStatus, stageLabels, stageColors,
  activityTypeLabels, statusLabels
} from '@/types/crm';
import { Profile } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, Mail, Calendar, MessageCircle, FileText, 
  ArrowRight, Users, Loader2, Send, User, Building,
  DollarSign, GraduationCap, Clock, Pencil, Save, X,
  CreditCard, Banknote, Receipt, Shirt, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

const leadEditSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  cpf: z.string().optional(),
  birth_date: z.string().optional(),
  course_interest: z.string().optional(),
  education_level: z.string().optional(),
  has_diploma: z.boolean().optional(),
  media_source_id: z.string().optional(),
  campaign: z.string().optional(),
  quote_value: z.number().optional().nullable(),
  discount_percent: z.number().optional().nullable(),
  final_value: z.number().optional().nullable(),
  enrollment_fee_paid: z.boolean().optional(),
  enrollment_fee_value: z.number().optional().nullable(),
  first_installment_paid: z.boolean().optional(),
  first_installment_value: z.number().optional().nullable(),
  uniform_paid: z.boolean().optional(),
  uniform_value: z.number().optional().nullable(),
  payment_method: z.string().optional().nullable(),
  assigned_to: z.string().optional(),
  department_id: z.string().optional(),
  next_contact_date: z.string().optional(),
  notes: z.string().optional(),
});

type ActivityForm = z.infer<typeof activitySchema>;
type LeadEditForm = z.infer<typeof leadEditSchema>;

const activityIcons: Record<string, React.ReactNode> = {
  call: <Phone className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  whatsapp: <MessageCircle className="w-4 h-4" />,
  meeting: <Users className="w-4 h-4" />,
  note: <FileText className="w-4 h-4" />,
  stage_change: <ArrowRight className="w-4 h-4" />,
};

const educationLevels = [
  'Ensino Fundamental',
  'Ensino Médio',
  'Ensino Superior Incompleto',
  'Ensino Superior Completo',
  'Pós-Graduação',
  'Mestrado',
  'Doutorado',
];

const paymentMethods = [
  { value: 'a_vista', label: 'À Vista' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'carne_boleto', label: 'Carnê / Boleto' },
];

export function LeadDrawer({ lead, open, onClose, mediaSources, profiles }: LeadDrawerProps) {
  const { user, isAdmin, isUnitAdmin, profile: authProfile } = useAuth();
  const { data: activities = [], isLoading: loadingActivities } = useLeadActivities(lead?.id);
  const { data: departments = [] } = useDepartments();
  const updateLead = useUpdateLead();
  const updateLeadStage = useUpdateLeadStage();
  const createActivity = useCreateLeadActivity();
  const deleteLead = useDeleteLead();
  
  const [activityType, setActivityType] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<LeadEditForm | null>(null);

  // Permission checks
  const isCreator = lead?.created_by === user?.id;
  const isUnitAdminOfLead = isUnitAdmin && lead?.unit_id === authProfile?.unit_id;
  const canDeleteLead = isAdmin || isCreator || isUnitAdminOfLead;
  const canChangeOwnership = isAdmin || isCreator || isUnitAdminOfLead;

  // Initialize edit data when lead changes
  useEffect(() => {
    if (lead) {
      setEditData({
        name: lead.name,
        phone: lead.phone,
        email: lead.email || '',
        whatsapp: lead.whatsapp || '',
        cpf: lead.cpf || '',
        birth_date: lead.birth_date || '',
        course_interest: lead.course_interest || '',
        education_level: lead.education_level || '',
        has_diploma: lead.has_diploma || false,
        media_source_id: lead.media_source_id || '',
        campaign: lead.campaign || '',
        quote_value: lead.quote_value,
        discount_percent: lead.discount_percent,
        final_value: lead.final_value,
        enrollment_fee_paid: lead.enrollment_fee_paid || false,
        enrollment_fee_value: lead.enrollment_fee_value,
        first_installment_paid: lead.first_installment_paid || false,
        first_installment_value: lead.first_installment_value,
        uniform_paid: lead.uniform_paid || false,
        uniform_value: lead.uniform_value,
        payment_method: lead.payment_method || '',
        assigned_to: lead.assigned_to || '',
        department_id: lead.department_id || '',
        next_contact_date: lead.next_contact_date 
          ? format(new Date(lead.next_contact_date), "yyyy-MM-dd'T'HH:mm")
          : '',
        notes: lead.notes || '',
      });
      setIsEditing(false);
    }
  }, [lead]);

  const handleStageChange = async (stage: LeadStage) => {
    if (!lead || !user) return;
    
    await updateLeadStage.mutateAsync({
      id: lead.id,
      stage,
      userId: user.id,
    });
  };

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead || !user) return;
    
    try {
      await updateLead.mutateAsync({
        id: lead.id,
        updates: { status: newStatus },
      });
      
      // Create activity for status change
      await createActivity.mutateAsync({
        lead_id: lead.id,
        user_id: user.id,
        activity_type: 'note',
        description: `Status alterado para ${statusLabels[newStatus]}`,
      });
    } catch (error) {
      // Error already handled by mutation
    }
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

  const handleSaveEdit = async () => {
    if (!lead || !editData) return;

    // Validate next_contact_date is required if stage is not 'matricula'
    if (lead.stage !== 'matricula' && !editData.next_contact_date) {
      toast.error('Data de retorno é obrigatória para leads que não estão matriculados');
      return;
    }

    try {
      await updateLead.mutateAsync({
        id: lead.id,
        updates: {
          name: editData.name,
          phone: editData.phone,
          email: editData.email || null,
          whatsapp: editData.whatsapp || null,
          cpf: editData.cpf || null,
          birth_date: editData.birth_date || null,
          course_interest: editData.course_interest || null,
          education_level: editData.education_level || null,
          has_diploma: editData.has_diploma || false,
          media_source_id: editData.media_source_id || null,
          campaign: editData.campaign || null,
          quote_value: editData.quote_value,
          discount_percent: editData.discount_percent,
          final_value: editData.final_value,
          enrollment_fee_paid: editData.enrollment_fee_paid || false,
          enrollment_fee_value: editData.enrollment_fee_value,
          first_installment_paid: editData.first_installment_paid || false,
          first_installment_value: editData.first_installment_value,
          uniform_paid: editData.uniform_paid || false,
          uniform_value: editData.uniform_value,
          payment_method: editData.payment_method || null,
          assigned_to: editData.assigned_to || null,
          department_id: editData.department_id || null,
          next_contact_date: editData.next_contact_date 
            ? new Date(editData.next_contact_date).toISOString()
            : null,
          notes: editData.notes || null,
        },
      });
      toast.success('Lead atualizado com sucesso!');
      setIsEditing(false);
    } catch (error) {
      toast.error('Erro ao atualizar lead');
    }
  };

  const handleCancelEdit = () => {
    if (lead) {
      setEditData({
        name: lead.name,
        phone: lead.phone,
        email: lead.email || '',
        whatsapp: lead.whatsapp || '',
        cpf: lead.cpf || '',
        birth_date: lead.birth_date || '',
        course_interest: lead.course_interest || '',
        education_level: lead.education_level || '',
        has_diploma: lead.has_diploma || false,
        media_source_id: lead.media_source_id || '',
        campaign: lead.campaign || '',
        quote_value: lead.quote_value,
        discount_percent: lead.discount_percent,
        final_value: lead.final_value,
        enrollment_fee_paid: lead.enrollment_fee_paid || false,
        enrollment_fee_value: lead.enrollment_fee_value,
        first_installment_paid: lead.first_installment_paid || false,
        first_installment_value: lead.first_installment_value,
        uniform_paid: lead.uniform_paid || false,
        uniform_value: lead.uniform_value,
        payment_method: lead.payment_method || '',
        assigned_to: lead.assigned_to || '',
        department_id: lead.department_id || '',
        next_contact_date: lead.next_contact_date 
          ? format(new Date(lead.next_contact_date), "yyyy-MM-dd'T'HH:mm")
          : '',
        notes: lead.notes || '',
      });
    }
    setIsEditing(false);
  };

  // Calculate final value when quote_value or discount changes
  const calculateFinalValue = (quoteValue: number | null | undefined, discountPercent: number | null | undefined) => {
    if (!quoteValue) return null;
    if (!discountPercent) return quoteValue;
    return quoteValue * (1 - discountPercent / 100);
  };

  const updateEditField = (field: keyof LeadEditForm, value: any) => {
    if (!editData) return;
    
    const newData = { ...editData, [field]: value };
    
    // Auto-calculate final value
    if (field === 'quote_value' || field === 'discount_percent') {
      newData.final_value = calculateFinalValue(
        field === 'quote_value' ? value : editData.quote_value,
        field === 'discount_percent' ? value : editData.discount_percent
      );
    }
    
    setEditData(newData);
  };

  if (!lead || !editData) return null;

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
            <div className="flex-1">
              <SheetTitle className="text-left">{lead.name}</SheetTitle>
              <SheetDescription className="text-left flex items-center gap-2 flex-wrap">
                <Badge className={cn("text-white", stageColors[lead.stage])}>
                  {stageLabels[lead.stage]}
                </Badge>
                <Badge 
                  variant={lead.status === 'ativo' ? 'default' : 'secondary'}
                  className={cn(
                    lead.status === 'inativo' && 'bg-gray-500 text-white',
                    lead.status === 'convertido' && 'bg-green-500 text-white',
                    lead.status === 'perdido' && 'bg-red-500 text-white'
                  )}
                >
                  {statusLabels[lead.status]}
                </Badge>
                {lead.media_source && (
                  <Badge variant="outline">{lead.media_source.name}</Badge>
                )}
              </SheetDescription>
            </div>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4 mr-1" />
                Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancelEdit}
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSaveEdit}
                  disabled={updateLead.isPending}
                >
                  {updateLead.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="stage">Etapa</TabsTrigger>
            <TabsTrigger value="activities">Atividades</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="pt-4">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-6 pr-4">
                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Contato</h4>
                  
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="edit-name">Nome *</Label>
                          <Input
                            id="edit-name"
                            value={editData.name}
                            onChange={(e) => updateEditField('name', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-phone">Telefone *</Label>
                          <Input
                            id="edit-phone"
                            value={editData.phone}
                            onChange={(e) => updateEditField('phone', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="edit-whatsapp">WhatsApp</Label>
                          <Input
                            id="edit-whatsapp"
                            value={editData.whatsapp}
                            onChange={(e) => updateEditField('whatsapp', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-email">Email</Label>
                          <Input
                            id="edit-email"
                            type="email"
                            value={editData.email}
                            onChange={(e) => updateEditField('email', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="edit-cpf">CPF</Label>
                          <Input
                            id="edit-cpf"
                            value={editData.cpf}
                            onChange={(e) => updateEditField('cpf', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-birth">Data de Nascimento</Label>
                          <Input
                            id="edit-birth"
                            type="date"
                            value={editData.birth_date}
                            onChange={(e) => updateEditField('birth_date', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
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

                      {lead.cpf && (
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>CPF: {lead.cpf}</span>
                        </div>
                      )}

                      {lead.birth_date && (
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>{format(new Date(lead.birth_date), "dd/MM/yyyy")}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Education Info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Educação</h4>
                  
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="edit-course">Curso de Interesse</Label>
                        <Input
                          id="edit-course"
                          value={editData.course_interest}
                          onChange={(e) => updateEditField('course_interest', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-education">Nível de Escolaridade</Label>
                        <Select 
                          value={editData.education_level || ''} 
                          onValueChange={(v) => updateEditField('education_level', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {educationLevels.map((level) => (
                              <SelectItem key={level} value={level}>{level}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          id="edit-diploma"
                          checked={editData.has_diploma || false}
                          onCheckedChange={(checked) => updateEditField('has_diploma', checked)}
                        />
                        <Label htmlFor="edit-diploma">Possui diploma</Label>
                      </div>
                    </div>
                  ) : (
                    <>
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

                      {lead.has_diploma !== null && (
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <GraduationCap className="w-4 h-4 text-muted-foreground" />
                          <span>{lead.has_diploma ? 'Possui diploma' : 'Não possui diploma'}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Source Info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Origem</h4>
                  
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="edit-source">Mídia de Origem</Label>
                        <Select 
                          value={editData.media_source_id || ''} 
                          onValueChange={(v) => updateEditField('media_source_id', v === 'none' ? '' : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {mediaSources.map((source) => (
                              <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="edit-campaign">Campanha</Label>
                        <Input
                          id="edit-campaign"
                          value={editData.campaign}
                          onChange={(e) => updateEditField('campaign', e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      {lead.media_source && (
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Building className="w-4 h-4 text-muted-foreground" />
                          <span>{lead.media_source.name}</span>
                        </div>
                      )}
                      {lead.campaign && (
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span>Campanha: {lead.campaign}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Financial Info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Financeiro</h4>
                  
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="edit-quote">Valor do Orçamento (R$)</Label>
                          <Input
                            id="edit-quote"
                            type="number"
                            step="0.01"
                            value={editData.quote_value ?? ''}
                            onChange={(e) => updateEditField('quote_value', e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-discount">Desconto (%)</Label>
                          <Input
                            id="edit-discount"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={editData.discount_percent ?? ''}
                            onChange={(e) => updateEditField('discount_percent', e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </div>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                        <p className="text-xs text-green-600 dark:text-green-400">Valor Final (calculado)</p>
                        <p className="font-medium text-green-700 dark:text-green-300">
                          {editData.final_value 
                            ? editData.final_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : 'R$ 0,00'
                          }
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Orçamento</p>
                        <p className="font-medium">
                          {lead.quote_value 
                            ? lead.quote_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : 'Não informado'
                          }
                        </p>
                      </div>
                      
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Desconto</p>
                        <p className="font-medium">{lead.discount_percent ? `${lead.discount_percent}%` : '-'}</p>
                      </div>
                      
                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg col-span-2">
                        <p className="text-xs text-green-600 dark:text-green-400">Valor Final</p>
                        <p className="font-medium text-green-700 dark:text-green-300">
                          {lead.final_value 
                            ? lead.final_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : 'Não calculado'
                          }
                        </p>
                </div>

                {/* Payment Tracking (only show if stage is matricula) */}
                {(lead.stage === 'matricula' || isEditing) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Pagamentos</h4>
                    
                    {isEditing ? (
                      <div className="space-y-4">
                        {/* Payment Method */}
                        <div>
                          <Label htmlFor="edit-payment-method">Forma de Pagamento</Label>
                          <Select 
                            value={editData.payment_method || ''} 
                            onValueChange={(v) => updateEditField('payment_method', v === 'none' ? '' : v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Não informado</SelectItem>
                              {paymentMethods.map((method) => (
                                <SelectItem key={method.value} value={method.value}>
                                  {method.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Enrollment Fee */}
                        <div className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GraduationCap className="w-4 h-4 text-blue-500" />
                              <span className="text-sm font-medium">Matrícula</span>
                            </div>
                            <Switch
                              checked={editData.enrollment_fee_paid || false}
                              onCheckedChange={(checked) => updateEditField('enrollment_fee_paid', checked)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-enrollment-value">Valor (R$)</Label>
                            <Input
                              id="edit-enrollment-value"
                              type="number"
                              step="0.01"
                              value={editData.enrollment_fee_value ?? ''}
                              onChange={(e) => updateEditField('enrollment_fee_value', e.target.value ? parseFloat(e.target.value) : null)}
                            />
                          </div>
                        </div>

                        {/* First Installment */}
                        <div className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Receipt className="w-4 h-4 text-purple-500" />
                              <span className="text-sm font-medium">1ª Parcela</span>
                            </div>
                            <Switch
                              checked={editData.first_installment_paid || false}
                              onCheckedChange={(checked) => updateEditField('first_installment_paid', checked)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-installment-value">Valor (R$)</Label>
                            <Input
                              id="edit-installment-value"
                              type="number"
                              step="0.01"
                              value={editData.first_installment_value ?? ''}
                              onChange={(e) => updateEditField('first_installment_value', e.target.value ? parseFloat(e.target.value) : null)}
                            />
                          </div>
                        </div>

                        {/* Uniform */}
                        <div className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Shirt className="w-4 h-4 text-orange-500" />
                              <span className="text-sm font-medium">Uniforme</span>
                            </div>
                            <Switch
                              checked={editData.uniform_paid || false}
                              onCheckedChange={(checked) => updateEditField('uniform_paid', checked)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-uniform-value">Valor (R$)</Label>
                            <Input
                              id="edit-uniform-value"
                              type="number"
                              step="0.01"
                              value={editData.uniform_value ?? ''}
                              onChange={(e) => updateEditField('uniform_value', e.target.value ? parseFloat(e.target.value) : null)}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Payment Method Display */}
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">Forma de Pagamento</p>
                          <div className="flex items-center gap-2 mt-1">
                            {lead.payment_method === 'a_vista' && <Banknote className="w-4 h-4 text-green-500" />}
                            {lead.payment_method === 'cartao_credito' && <CreditCard className="w-4 h-4 text-blue-500" />}
                            {lead.payment_method === 'carne_boleto' && <Receipt className="w-4 h-4 text-purple-500" />}
                            <span className="font-medium">
                              {paymentMethods.find(m => m.value === lead.payment_method)?.label || 'Não informado'}
                            </span>
                          </div>
                        </div>

                        {/* Payment Status Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className={cn(
                            "p-3 rounded-lg text-center",
                            lead.enrollment_fee_paid ? "bg-green-50 dark:bg-green-950" : "bg-muted/50"
                          )}>
                            <GraduationCap className={cn(
                              "w-5 h-5 mx-auto mb-1",
                              lead.enrollment_fee_paid ? "text-green-500" : "text-muted-foreground"
                            )} />
                            <p className="text-xs text-muted-foreground">Matrícula</p>
                            <p className="text-sm font-medium">
                              {lead.enrollment_fee_value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}
                            </p>
                            <Badge variant={lead.enrollment_fee_paid ? "default" : "outline"} className="mt-1 text-xs">
                              {lead.enrollment_fee_paid ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>

                          <div className={cn(
                            "p-3 rounded-lg text-center",
                            lead.first_installment_paid ? "bg-green-50 dark:bg-green-950" : "bg-muted/50"
                          )}>
                            <Receipt className={cn(
                              "w-5 h-5 mx-auto mb-1",
                              lead.first_installment_paid ? "text-green-500" : "text-muted-foreground"
                            )} />
                            <p className="text-xs text-muted-foreground">1ª Parcela</p>
                            <p className="text-sm font-medium">
                              {lead.first_installment_value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}
                            </p>
                            <Badge variant={lead.first_installment_paid ? "default" : "outline"} className="mt-1 text-xs">
                              {lead.first_installment_paid ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>

                          <div className={cn(
                            "p-3 rounded-lg text-center",
                            lead.uniform_paid ? "bg-green-50 dark:bg-green-950" : "bg-muted/50"
                          )}>
                            <Shirt className={cn(
                              "w-5 h-5 mx-auto mb-1",
                              lead.uniform_paid ? "text-green-500" : "text-muted-foreground"
                            )} />
                            <p className="text-xs text-muted-foreground">Uniforme</p>
                            <p className="text-sm font-medium">
                              {lead.uniform_value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}
                            </p>
                            <Badge variant={lead.uniform_paid ? "default" : "outline"} className="mt-1 text-xs">
                              {lead.uniform_paid ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                    </div>
                  )}
                </div>

                {/* Assignment */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Atribuição</h4>
                  
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="edit-assignee">Responsável</Label>
                        <Select 
                          value={editData.assigned_to || ''} 
                          onValueChange={(v) => updateEditField('assigned_to', v === 'none' ? '' : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Não atribuído</SelectItem>
                            {profiles.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.full_name || 'Sem nome'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="edit-department">Departamento</Label>
                        <Select 
                          value={editData.department_id || ''} 
                          onValueChange={(v) => updateEditField('department_id', v === 'none' ? '' : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Não atribuído</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>

                {/* Next Contact */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Próximo Contato</h4>
                  
                  {isEditing ? (
                    <div>
                      <Label htmlFor="edit-next-contact">Data e Hora</Label>
                      <Input
                        id="edit-next-contact"
                        type="datetime-local"
                        value={editData.next_contact_date}
                        onChange={(e) => updateEditField('next_contact_date', e.target.value)}
                      />
                    </div>
                  ) : lead.next_contact_date ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">Próximo contato</span>
                      </div>
                      <p className="mt-1 text-amber-700 dark:text-amber-300">
                        {format(new Date(lead.next_contact_date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum contato agendado</p>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Observações</h4>
                  
                  {isEditing ? (
                    <Textarea
                      value={editData.notes}
                      onChange={(e) => updateEditField('notes', e.target.value)}
                      className="min-h-[100px]"
                      placeholder="Adicione observações sobre o lead..."
                    />
                  ) : lead.notes ? (
                    <p className="text-sm p-3 bg-muted/50 rounded-lg whitespace-pre-wrap">{lead.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma observação</p>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stage" className="space-y-6 pt-4">
            {/* Lead Status Control */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Status do Lead</h4>
                <Badge 
                  variant={lead.status === 'ativo' ? 'default' : 'secondary'}
                  className={cn(
                    lead.status === 'inativo' && 'bg-gray-500 text-white',
                    lead.status === 'convertido' && 'bg-green-500 text-white',
                    lead.status === 'perdido' && 'bg-red-500 text-white'
                  )}
                >
                  {statusLabels[lead.status]}
                </Badge>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Use para controlar se o lead deve ser contatado ou não.
              </p>
              
              <div className="flex gap-2">
                <Button
                  variant={lead.status === 'ativo' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => handleStatusChange('ativo')}
                  disabled={lead.status === 'ativo' || updateLead.isPending}
                >
                  ✓ Ativo
                </Button>
                <Button
                  variant={lead.status === 'inativo' ? 'default' : 'outline'}
                  size="sm"
                  className={cn("flex-1", lead.status === 'inativo' && 'bg-gray-500 hover:bg-gray-600')}
                  onClick={() => handleStatusChange('inativo')}
                  disabled={lead.status === 'inativo' || updateLead.isPending}
                >
                  ✕ Inativo
                </Button>
              </div>
              
              {lead.status === 'inativo' && (
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
                  <p className="text-gray-600 dark:text-gray-400">
                    Este lead está marcado como <strong>inativo</strong>. Ele não aparecerá nos retornos agendados e não deve ser contatado.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-3">
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
