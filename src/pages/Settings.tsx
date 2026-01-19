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
import { useProcesses, useDeleteProcess, Process } from '@/hooks/useProcesses';
import { useSchoolUnits, useCreateSchoolUnit, useUpdateSchoolUnit, useDeleteSchoolUnit, SchoolUnit } from '@/hooks/useSchoolUnits';
import { ProcessModal } from '@/components/ProcessModal';
import { AppRole, roleLabels, departmentColors } from '@/types/database';
import { ArrowLeft, Plus, Trash2, Building2, Users, Loader2, Shield, FileText, Pencil, UserPlus, School, MapPin } from 'lucide-react';
import { CreateUserModal } from '@/components/CreateUserModal';
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
  const { isAdmin, isUnitAdmin, profile: authProfile } = useAuth();
  const { data: departments, isLoading: loadingDepts } = useDepartments();
  const { data: profiles, isLoading: loadingProfiles } = useProfiles();
  const { data: processes, isLoading: loadingProcesses } = useProcesses();
  const { data: schoolUnits, isLoading: loadingUnits } = useSchoolUnits();
  const { data: userRoles } = useUserRoles();
  const createDepartment = useCreateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const deleteProcess = useDeleteProcess();
  const createSchoolUnit = useCreateSchoolUnit();
  const updateSchoolUnit = useUpdateSchoolUnit();
  const deleteSchoolUnit = useDeleteSchoolUnit();
  const updateUserRole = useUpdateUserRole();
  const updateProfile = useUpdateProfile();

  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptColor, setNewDeptColor] = useState('blue');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitCity, setNewUnitCity] = useState('');
  const [editingUnit, setEditingUnit] = useState<SchoolUnit | null>(null);
  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitCity, setEditUnitCity] = useState('');
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>('all');
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);

  // Unit admins can only manage users in their unit
  const canManageUsers = isAdmin || isUnitAdmin;
  const canManageUnits = isAdmin;
  const canManageDepartments = isAdmin;
  const canManageProcesses = isAdmin;

  if (!canManageUsers) {
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
                Você não tem permissão para acessar esta página.
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

  // Filter profiles for unit_admin - only show users from their unit
  const visibleProfiles = isUnitAdmin && authProfile?.unit_id
    ? profiles?.filter(p => p.unit_id === authProfile.unit_id || !p.unit_id)
    : profiles;

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

  const handleUnitChange = async (userId: string, unitId: string) => {
    await updateProfile.mutateAsync({
      id: userId,
      updates: { unit_id: unitId === 'none' ? null : unitId },
    });
  };

  const getUserRole = (userId: string): AppRole => {
    const role = userRoles?.find(r => r.user_id === userId);
    return role?.role ?? 'employee';
  };

  const handleDeleteProcess = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este processo?')) {
      await deleteProcess.mutateAsync(id);
    }
  };

  const handleEditProcess = (process: Process) => {
    setEditingProcess(process);
    setProcessModalOpen(true);
  };

  const handleProcessModalClose = () => {
    setProcessModalOpen(false);
    setEditingProcess(null);
  };

  const filteredProcesses = processes?.filter(p => 
    filterDepartmentId === 'all' || p.department_id === filterDepartmentId
  ) || [];

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
                {isUnitAdmin ? 'Gerencie usuários da sua unidade' : 'Gerencie departamentos, processos e usuários do sistema'}
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6">
          <Tabs defaultValue={isUnitAdmin ? "users" : "departments"} className="space-y-6">
            <TabsList>
              {canManageUnits && (
                <TabsTrigger value="units" className="gap-2">
                  <School className="w-4 h-4" />
                  Unidades
                </TabsTrigger>
              )}
              {canManageDepartments && (
                <TabsTrigger value="departments" className="gap-2">
                  <Building2 className="w-4 h-4" />
                  Departamentos
                </TabsTrigger>
              )}
              {canManageProcesses && (
                <TabsTrigger value="processes" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Processos
                </TabsTrigger>
              )}
              <TabsTrigger value="users" className="gap-2">
                <Users className="w-4 h-4" />
                Usuários
              </TabsTrigger>
            </TabsList>

            {/* School Units Tab */}
            <TabsContent value="units" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Adicionar Unidade Escolar</CardTitle>
                  <CardDescription>Crie novas unidades para organizar escolas</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newUnitName.trim() || !newUnitCity.trim()) {
                      toast.error('Nome e cidade são obrigatórios');
                      return;
                    }
                    await createSchoolUnit.mutateAsync({ name: newUnitName, city: newUnitCity });
                    setNewUnitName('');
                    setNewUnitCity('');
                  }} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Nome da Unidade</Label>
                      <Input placeholder="Ex: Rio Verde" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>Cidade</Label>
                      <Input placeholder="Ex: Rio Verde" value={newUnitCity} onChange={(e) => setNewUnitCity(e.target.value)} />
                    </div>
                    <Button type="submit" disabled={createSchoolUnit.isPending}>
                      {createSchoolUnit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      <span className="ml-2">Adicionar</span>
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Unidades Escolares</CardTitle>
                  <CardDescription>Lista de todas as unidades cadastradas</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingUnits ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : schoolUnits?.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhuma unidade cadastrada</p>
                  ) : (
                    <div className="space-y-3">
                      {schoolUnits?.map((unit) => (
                        <div key={unit.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                          {editingUnit?.id === unit.id ? (
                            // Edit mode
                            <div className="flex-1 flex items-center gap-3">
                              <School className="w-5 h-5 text-primary" />
                              <div className="flex-1 flex gap-3">
                                <Input
                                  value={editUnitName}
                                  onChange={(e) => setEditUnitName(e.target.value)}
                                  placeholder="Nome da unidade"
                                  className="flex-1"
                                />
                                <Input
                                  value={editUnitCity}
                                  onChange={(e) => setEditUnitCity(e.target.value)}
                                  placeholder="Cidade"
                                  className="flex-1"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    if (!editUnitName.trim() || !editUnitCity.trim()) {
                                      toast.error('Nome e cidade são obrigatórios');
                                      return;
                                    }
                                    await updateSchoolUnit.mutateAsync({
                                      id: unit.id,
                                      updates: { name: editUnitName, city: editUnitCity }
                                    });
                                    setEditingUnit(null);
                                  }}
                                  disabled={updateSchoolUnit.isPending}
                                >
                                  {updateSchoolUnit.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    'Salvar'
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingUnit(null)}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // View mode
                            <>
                              <div className="flex items-center gap-3">
                                <School className="w-5 h-5 text-primary" />
                                <div>
                                  <span className="font-medium">{unit.name}</span>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="w-3 h-3" />
                                    {unit.city}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingUnit(unit);
                                    setEditUnitName(unit.name);
                                    setEditUnitCity(unit.city);
                                  }}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm('Tem certeza que deseja excluir esta unidade?')) {
                                      deleteSchoolUnit.mutateAsync(unit.id);
                                    }
                                  }}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

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
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>
                      {isUnitAdmin ? 'Usuários da Sua Unidade' : 'Usuários do Sistema'}
                    </CardTitle>
                    <CardDescription>
                      {isUnitAdmin 
                        ? 'Gerencie os usuários vinculados à sua unidade' 
                        : 'Gerencie funções e departamentos dos usuários'}
                    </CardDescription>
                  </div>
                  <Button onClick={() => setCreateUserModalOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Criar Usuário
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingProfiles ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : visibleProfiles?.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhum usuário cadastrado
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {visibleProfiles?.map((profile) => (
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
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline">
                                  {roleLabels[getUserRole(profile.id)]}
                                </Badge>
                                {profile.unit && (
                                  <Badge variant="secondary" className="text-xs">
                                    <School className="w-3 h-3 mr-1" />
                                    {profile.unit.name}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Unit selector - only admin can change, unit_admin auto-assigns their unit */}
                            {isAdmin ? (
                              <Select
                                value={profile.unit_id || 'none'}
                                onValueChange={(value) => handleUnitChange(profile.id, value)}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue placeholder="Unidade" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sem unidade</SelectItem>
                                  {schoolUnits?.map((unit) => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                      {unit.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : isUnitAdmin && authProfile?.unit_id && !profile.unit_id ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnitChange(profile.id, authProfile.unit_id!)}
                              >
                                Vincular à minha unidade
                              </Button>
                            ) : null}

                            {/* Department - only admin can change */}
                            {isAdmin && (
                              <Select
                                value={profile.department_id || 'none'}
                                onValueChange={(value) => handleDepartmentChange(profile.id, value)}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue placeholder="Departamento" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sem depart.</SelectItem>
                                  {departments?.map((dept) => (
                                    <SelectItem key={dept.id} value={dept.id}>
                                      {dept.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            
                            {/* Role - only admin can change all roles, unit_admin can only set employee */}
                            {isAdmin ? (
                              <Select
                                value={getUserRole(profile.id)}
                                onValueChange={(value) => handleRoleChange(profile.id, value as AppRole)}
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="employee">{roleLabels.employee}</SelectItem>
                                  <SelectItem value="manager">{roleLabels.manager}</SelectItem>
                                  <SelectItem value="unit_admin">{roleLabels.unit_admin}</SelectItem>
                                  <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary">{roleLabels[getUserRole(profile.id)]}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="processes" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Processos</CardTitle>
                    <CardDescription>Lista de todos os processos cadastrados</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={filterDepartmentId} onValueChange={setFilterDepartmentId}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar por departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os departamentos</SelectItem>
                        {departments?.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => setProcessModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Processo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingProcesses ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredProcesses.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhum processo cadastrado
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {filteredProcesses.map((process) => (
                        <div
                          key={process.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{process.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {process.department && (
                                  <Badge variant="outline" className="text-xs">
                                    <div className={cn(
                                      "w-2 h-2 rounded-full mr-1.5",
                                      departmentColors[process.department.color_theme] || 'bg-gray-500'
                                    )} />
                                    {process.department.name}
                                  </Badge>
                                )}
                                {process.checklist.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {process.checklist.length} itens no checklist
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditProcess(process)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteProcess(process.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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

        {/* Process Modal */}
        <ProcessModal
          open={processModalOpen}
          onClose={handleProcessModalClose}
          editProcess={editingProcess}
        />

        <CreateUserModal
          open={createUserModalOpen}
          onClose={() => setCreateUserModalOpen(false)}
        />
      </main>
    </div>
  );
}
