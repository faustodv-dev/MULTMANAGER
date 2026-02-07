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
import { useAdminResetPassword } from '@/hooks/useAdminResetPassword';
import { Loader2, KeyRound, Eye, EyeOff, CheckCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

const resetPasswordSchema = z.object({
  new_password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(72, 'Senha deve ter no máximo 72 caracteres'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'As senhas não coincidem',
  path: ['confirm_password'],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export function ResetPasswordModal({ open, onClose, userId, userName }: ResetPasswordModalProps) {
  const resetPassword = useAdminResetPassword();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successData, setSuccessData] = useState<{ password: string } | null>(null);
  
  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      new_password: '',
      confirm_password: '',
    },
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    try {
      await resetPassword.mutateAsync({
        user_id: userId,
        new_password: data.new_password,
      });
      setSuccessData({ password: data.new_password });
      form.reset();
    } catch (error) {
      // Error handled in hook
    }
  };

  const copyPassword = async () => {
    if (successData?.password) {
      await navigator.clipboard.writeText(successData.password);
      toast.success('Senha copiada para a área de transferência!');
    }
  };

  const handleClose = () => {
    form.reset();
    setSuccessData(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            {successData ? 'Senha Redefinida' : 'Redefinir Senha'}
          </DialogTitle>
          <DialogDescription>
            {successData 
              ? `A senha do usuário ${userName} foi atualizada com sucesso.`
              : `Defina uma nova senha para o usuário ${userName}`}
          </DialogDescription>
        </DialogHeader>

        {successData ? (
          <div className="space-y-4">
            <div className="p-4 bg-accent/50 border border-border rounded-lg">
              <div className="flex items-center gap-2 text-primary mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Senha atualizada!</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Informe ao usuário a nova senha para fazer login:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-background rounded border text-sm font-mono">
                  {successData.password}
                </code>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={copyPassword}
                  title="Copiar senha"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="new_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showPassword ? 'text' : 'password'} 
                          placeholder="••••••" 
                          {...field} 
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirm_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showConfirmPassword ? 'text' : 'password'} 
                          placeholder="••••••" 
                          {...field} 
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={resetPassword.isPending}>
                  {resetPassword.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Redefinir Senha
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
