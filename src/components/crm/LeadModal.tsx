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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateLead } from '@/hooks/useLeads';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolUnits } from '@/hooks/useSchoolUnits';
import { MediaSource, LeadStage, stageLabels } from '@/types/crm';
import { Profile, Department } from '@/types/database';
import { Loader2, ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { StudentPicker } from './StudentPicker';
import { Student } from '@/hooks/useStudents';
import { toast } from 'sonner';

const createTaskSchema = z.object({
  name: z.string().min(2, 'Descreva o atendimento com no mínimo 2 caracteres'),
  stage: z.string().min(1, 'Selecione a etapa'),
  assigned_to: z.string().optional(),
  department_id: z.string().optional(),
  unit_id: z.string().optional(),
  next_contact_date: z.string().min(1, 'Data de retorno é obrigatória'),
  notes: z.string().optional(),
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

interface LeadModalProps {
  open: boolean;
  onClose: () => void;
  mediaSources: MediaSource[];
  profiles: Profile[];
  departments: Department[];
}

const stageOptions: LeadStage[] = [
  'assuntos_pendentes',
  'pendencia_eja',
  'pendencia_online',
  'pendencia_tecnico',
  'desistentes',
  'rescisao_cancelamento',
  'finalizado',
];

export function LeadModal({ open, onClose, profiles, departments }: LeadModalProps) {
  const createLead = useCreateLead();
  const { data: schoolUnits = [] } = useSchoolUnits();
  const { profile: authProfile, isAdmin } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);

  const userUnitId = authProfile?.unit_id || '';

  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      name: '',
      stage: 'assuntos_pendentes',
      assigned_to: '',
      department_id: '',
      unit_id: userUnitId,
      next_contact_date: '',
      notes: '',
    },
  });

  const onSubmit = async (data: CreateTaskForm) => {
    if (!student) {
      toast.error('Selecione ou cadastre o aluno do atendimento.');
      return;
    }

    try {
      const effectiveUnitId = isAdmin ? data.unit_id || null : userUnitId || null;
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      await createLead.mutateAsync({
        name: data.name,
        stage: data.stage as LeadStage,
        student_id: student.id,
        assigned_to: data.assigned_to || null,
        department_id: data.department_id || null,
        unit_id: effectiveUnitId,
        next_contact_date: data.next_contact_date || null,
        notes: data.notes || null,
        created_by: currentUser?.id || null,
      });
      form.reset();
      setStudent(null);
      onClose();
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Nova Tarefa Pedagógica
          </DialogTitle>
          <DialogDescription>
            Vincule o aluno e descreva o atendimento a ser realizado.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Aluno *</Label>
              <StudentPicker
                value={student}
                onChange={setStudent}
                unitId={isAdmin ? form.watch('unit_id') || null : userUnitId || null}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assunto do atendimento *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Revisão de notas - 2ª etapa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Etapa *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stageOptions.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {stageLabels[stage]}
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
                name="next_contact_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de retorno *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
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
                    {schoolUnits.find((u) => u.id === userUnitId)?.name || 'Sua unidade'}
                  </div>
                </FormItem>
              )}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Contexto inicial do atendimento..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createLead.isPending}>
                {createLead.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar Tarefa
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
