import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useDepartments, useCreateDepartment, useDeleteDepartment } from '@/hooks/useDepartments';
import { useProfiles, useUserRoles, useUpdateUserRole, useUpdateProfile } from '@/hooks/useProfiles';
import { AppRole, roleLabels, departmentColors } from '@/types/database';
import { ArrowLeft, Plus, Trash2, Building2, Users, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const colorOptions = [
  { value: 'blue', label: 'Azul', class: 'bg-blue-500' },
  { value: 'green', label: 'Verde', class: 'bg-emerald-500' },
  { value: 'orange', label: 'Laranja', class: 'bg-orange-500' },
  { value: 'purple', label: 'Roxo', class: 'bg-purple-500' },
  { value: 'red', label: 'Vermelho', class: 'bg-red-500' },
];

export default function Settings() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: departments, isLoading: loadingDepts } = useDepartments();
  const { data: profiles, isLoading: loadingProfiles } = useProfiles();
  const { data: userRoles } = useUserRoles();
  const createDepartment = useCreateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const updateUserRole = useUpdateUserRole();
  const updateProfile = useUpdateProfile();

  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptColor, setNewDeptColor] = useState('blue');

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-destructive" />
                Acesso Restrito
              </CardTitle>
              <CardDescription>
                Você não tem permissão para acessar esta página. Apenas administradores podem gerenciar configurações.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/')}>Voltar ao Dashboard</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      toast.error('Nome do departamento é obrigatório');
      return;
    }
    
    await createDepartment.mutateAsync({
      name: newDeptName,
      color_theme: newDeptColor,
    });
    
    setNewDeptName('');
    setNewDeptColor('blue');
  };

  const handleDeleteDepartment = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este departamento?')) {
      await deleteDepartment.mutateAsync(id);
    }
  };

  const handleRoleChange = async (userId: string, role: AppRole) => {
    await updateUserRole.mutateAsync({ userId, role });
  };

  const handleDepartmentChange = async (userId: string, departmentId: string) => {
    await updateProfile.mutateAsync({
      id: userId,
      updates: { department_id: departmentId === 'none' ? null : departmentId },
    });
  };

  const getUserRole = (userId: string): AppRole => {
    const role = userRoles?.find(r => r.user_id === userId);
    return role?.role ?? 'employee';
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-card border-b sticky top-0 z-10 px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie departamentos e usuários do sistema
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6">
          <Tabs defaultValue="departments" className="space-y-6">
            <TabsList>
              <TabsTrigger value="departments" className="gap-2">
                <Building2 className="w-4 h-4" />
                Departamentos
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="w-4 h-4" />
                Usuários
              </TabsTrigger>
            </TabsList>

            <TabsContent value="departments" className="space-y-6">
              {/* Add Department Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Adicionar Departamento</CardTitle>
                  <CardDescription>Crie um novo departamento para organizar as tarefas</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateDepartment} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="dept-name">Nome</Label>
                      <Input
                        id="dept-name"
                        placeholder="Ex: Marketing"
                        value={newDeptName}
                        onChange={(e) => setNewDeptName(e.target.value)}
                      />
                    </div>
                    <div className="w-40 space-y-2">
                      <Label>Cor</Label>
                      <Select value={newDeptColor} onValueChange={setNewDeptColor}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {colorOptions.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              <div className="flex items-center gap-2">
                                <div className={cn("w-3 h-3 rounded-full", color.class)} />
                                {color.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" disabled={createDepartment.isPending}>
                      {createDepartment.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span className="ml-2">Adicionar</span>
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Departments List */}
              <Card>
                <CardHeader>
                  <CardTitle>Departamentos</CardTitle>
                  <CardDescription>Lista de todos os departamentos cadastrados</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingDepts ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : departments?.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhum departamento cadastrado
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {departments?.map((dept) => (
                        <div
                          key={dept.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-4 h-4 rounded-full",
                              departmentColors[dept.color_theme] || 'bg-gray-500'
                            )} />
                            <span className="font-medium">{dept.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDepartment(dept.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Usuários do Sistema</CardTitle>
                  <CardDescription>Gerencie funções e departamentos dos usuários</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingProfiles ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : profiles?.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhum usuário cadastrado
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {profiles?.map((profile) => (
                        <div
                          key={profile.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {profile.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{profile.full_name || 'Sem nome'}</p>
                              <Badge variant="outline" className="mt-1">
                                {roleLabels[getUserRole(profile.id)]}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Select
                              value={profile.department_id || 'none'}
                              onValueChange={(value) => handleDepartmentChange(profile.id, value)}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Departamento" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sem departamento</SelectItem>
                                {departments?.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.id}>
                                    {dept.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            <Select
                              value={getUserRole(profile.id)}
                              onValueChange={(value) => handleRoleChange(profile.id, value as AppRole)}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="employee">Funcionário</SelectItem>
                                <SelectItem value="manager">Gerente</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
