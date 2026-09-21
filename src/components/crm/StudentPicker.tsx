import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Student, useStudents, useCreateStudent } from '@/hooks/useStudents';
import { Search, UserPlus, Check, Loader2, X, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentPickerProps {
  value: Student | null;
  onChange: (student: Student | null) => void;
  unitId?: string | null;
}

export function StudentPicker({ value, onChange, unitId }: StudentPickerProps) {
  const { data: students = [], isLoading } = useStudents();
  const createStudent = useCreateStudent();

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 8);
    return students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.code || '').toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [students, query]);

  const handleCreate = async () => {
    if (newName.trim().length < 2) return;
    const student = await createStudent.mutateAsync({
      name: newName,
      code: newCode,
      unit_id: unitId || null,
    });
    onChange(student);
    setCreating(false);
    setNewName('');
    setNewCode('');
    setQuery('');
  };

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="w-4 h-4 text-primary shrink-0" />
          <span className="font-medium text-sm truncate">{value.name}</span>
          {value.code && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              Cód. {value.code}
            </Badge>
          )}
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(null)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3 space-y-3">
      {!creating ? (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno por nome ou código..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="max-h-48">
            <div className="space-y-1">
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando alunos...
                </div>
              )}
              {!isLoading && results.length === 0 && (
                <p className="text-sm text-muted-foreground px-2 py-3">
                  Nenhum aluno encontrado. Cadastre um novo abaixo.
                </p>
              )}
              {results.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => onChange(student)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm',
                    'hover:bg-accent hover:text-accent-foreground transition-colors',
                  )}
                >
                  <span className="truncate">{student.name}</span>
                  {student.code && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {student.code}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>

          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setCreating(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Cadastrar novo aluno
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do aluno *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Maria Souza" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Código</Label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Ex: 10453" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={createStudent.isPending || newName.trim().length < 2}
            >
              {createStudent.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Salvar aluno
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
