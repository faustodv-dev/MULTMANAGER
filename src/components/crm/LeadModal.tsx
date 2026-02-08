import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateLead } from '@/hooks/useLeads';
import { useSchoolUnits, SchoolUnit } from '@/hooks/useSchoolUnits';
import { MediaSource, LeadStage } from '@/types/crm';
import { Profile, Department } from '@/types/database';
import { Loader2, UserPlus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';

const createLeadSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().min(8, 'Telefone inválido'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  cpf: z.string().optional(),
  birth_date: z.string().optional(),
  course_interest: z.string().optional(),
  education_level: z.string().optional(),
  media_source_id: z.string().optional(),
  campaign: z.string().optional(),
  quote_value: z.string().optional(),
  discount_percent: z.string().optional(),
  assigned_to: z.string().optional(),
  department_id: z.string().optional(),
  unit_id: z.string().optional(),
  next_contact_date: z.string().min(1, 'Data de retorno é obrigatória'),
  notes: z.string().optional(),
});

type CreateLeadForm = z.infer<typeof createLeadSchema>;

interface LeadModalProps {
  open: boolean;
  onClose: () => void;
  mediaSources: MediaSource[];
  profiles: Profile[];
  departments: Department[];
}

const educationLevels = [
  'Ensino Fundamental Incompleto',
  'Ensino Fundamental Completo',
  'Ensino Médio Incompleto',
  'Ensino Médio Completo',
  'Superior Incompleto',
  'Superior Completo',
  'Pós-graduação',
  'Mestrado',
  'Doutorado',
];

export function LeadModal({ open, onClose, mediaSources, profiles, departments }: LeadModalProps) {
  const createLead = useCreateLead();
  const { data: schoolUnits = [] } = useSchoolUnits();
  const { profile: authProfile, isAdmin } = useAuth();
  
  // Automatically use user's unit_id - non-admins cannot change this
  const userUnitId = authProfile?.unit_id || '';
  
  const form = useForm<CreateLeadForm>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      whatsapp: '',
      cpf: '',
      birth_date: '',
      course_interest: '',
      education_level: '',
      media_source_id: '',
      campaign: '',
      quote_value: '',
      discount_percent: '',
      assigned_to: '',
      department_id: '',
      unit_id: userUnitId,
      next_contact_date: '',
      notes: '',
    },
  });

  const onSubmit = async (data: CreateLeadForm) => {
    try {
      const quoteValue = data.quote_value ? parseFloat(data.quote_value) : null;
      const discountPercent = data.discount_percent ? parseFloat(data.discount_percent) : null;
      const finalValue = quoteValue && discountPercent 
        ? quoteValue * (1 - discountPercent / 100) 
        : quoteValue;
      
      // Force unit_id from user profile for non-admins
      const effectiveUnitId = isAdmin ? (data.unit_id || null) : (userUnitId || null);
      
      await createLead.mutateAsync({
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        whatsapp: data.whatsapp || null,
        cpf: data.cpf || null,
        birth_date: data.birth_date || null,
        course_interest: data.course_interest || null,
        education_level: data.education_level || null,
        media_source_id: data.media_source_id || null,
        campaign: data.campaign || null,
        quote_value: quoteValue,
        discount_percent: discountPercent,
        final_value: finalValue,
        assigned_to: data.assigned_to || null,
        department_id: data.department_id || null,
        unit_id: effectiveUnitId,
        next_contact_date: data.next_contact_date || null,
        notes: data.notes || null,
      });
      form.reset();
      onClose();
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Cadastrar Novo Lead
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do lead que veio do WhatsApp ou recebeu orçamento.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Básico</TabsTrigger>
                <TabsTrigger value="education">Educação</TabsTrigger>
                <TabsTrigger value="source">Origem</TabsTrigger>
                <TabsTrigger value="financial">Financeiro</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="João Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone *</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="joao@exemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input placeholder="000.000.000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="birth_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Anotações sobre o lead..."
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="education" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="course_interest"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Curso de Interesse</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Técnico em Enfermagem" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="education_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nível de Escolaridade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {educationLevels.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="source" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="media_source_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mídia de Origem</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a mídia" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mediaSources.map((media) => (
                              <SelectItem key={media.id} value={media.id}>
                                {media.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="campaign"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campanha</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Black Friday 2025" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assigned_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {profiles.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.full_name || 'Sem nome'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="department_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departamento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Unit field: only shown to admins, others auto-assign */}
                  {isAdmin ? (
                    <FormField
                      control={form.control}
                      name="unit_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unidade Escolar</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {schoolUnits.map((unit) => (
                                <SelectItem key={unit.id} value={unit.id}>
                                  {unit.name} - {unit.city}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormItem>
                      <FormLabel>Unidade Escolar</FormLabel>
                      <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                        {schoolUnits.find(u => u.id === userUnitId)?.name || 'Sua unidade'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Lead será vinculado automaticamente à sua unidade
                      </p>
                    </FormItem>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="next_contact_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Próximo Contato *</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="financial" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quote_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor do Orçamento (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="1500.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="discount_percent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desconto (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="10" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createLead.isPending}>
                {createLead.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Cadastrar Lead
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}