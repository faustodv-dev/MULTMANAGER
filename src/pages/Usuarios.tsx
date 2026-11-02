import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, supabase, type Modulo, type Perfil } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MODULOS: { id: Modulo; rotulo: string }[] = [
  { id: "atendimento", rotulo: "Atendimento" },
  { id: "comprovantes", rotulo: "Comprovantes" },
  { id: "financeiro", rotulo: "Financeiro" },
  { id: "configuracoes", rotulo: "Configurações" },
];

export default function Usuarios() {
  const { perfil: eu, unidades } = useAuth();
  const [lista, setLista] = useState<Perfil[]>([]);
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState({ nome: "", email: "", senha: "", papel: "colaborador", unit_id: eu?.unit_id || "", departamento: "", modulos: ["atendimento"] as Modulo[] });

  const carregar = async () => {
    const { data } = await supabase.from("profiles").select("*").order("nome");
    setLista((data as Perfil[]) ?? []);
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async (p: Perfil, patch: Partial<Perfil>) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Acesso atualizado");
    carregar();
  };

  const criar = async () => {
    try {
      await api("admin-usuarios", { acao: "criar", ...novo });
      toast.success("Usuário criado");
      setAberto(false);
      setNovo({ ...novo, nome: "", email: "", senha: "" });
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const trocarSenha = async (p: Perfil) => {
    const senha = window.prompt(`Nova senha para ${p.nome || p.email} (mínimo 8 caracteres):`);
    if (!senha) return;
    try {
      await api("admin-usuarios", { acao: "senha", user_id: p.id, senha });
      toast.success("Senha alterada");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const podeEditar = (p: Perfil) => p.id !== eu?.id && (eu?.papel === "master" || (eu?.papel === "admin" && p.unit_id === eu.unit_id && p.papel !== "master"));

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Usuários</h1>
        <Button onClick={() => setAberto(true)}>Novo usuário</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Telas liberadas</TableHead>
            <TableHead>Ativo</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <div className="font-medium">{p.nome || "—"}</div>
                <div className="text-xs text-muted-foreground">{p.email}{p.departamento ? ` · ${p.departamento}` : ""}</div>
              </TableCell>
              <TableCell className="text-sm">
                {eu?.papel === "master" && p.papel !== "master" ? (
                  <select className="rounded border bg-background px-1 py-1 text-sm" value={p.unit_id || ""} onChange={(e) => salvar(p, { unit_id: e.target.value || null })}>
                    <option value="">—</option>
                    {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                ) : unidades.find((u) => u.id === p.unit_id)?.name || "Todas"}
              </TableCell>
              <TableCell>
                {podeEditar(p) && eu?.papel === "master" ? (
                  <select className="rounded border bg-background px-1 py-1 text-sm" value={p.papel} onChange={(e) => salvar(p, { papel: e.target.value as Perfil["papel"] })}>
                    <option value="colaborador">Colaborador</option>
                    <option value="admin">Admin da unidade</option>
                  </select>
                ) : p.papel === "master" ? "Master geral" : p.papel === "admin" ? "Admin da unidade" : "Colaborador"}
              </TableCell>
              <TableCell>
                {p.papel === "colaborador" ? (
                  <div className="flex flex-wrap gap-3">
                    {MODULOS.map((m) => (
                      <label key={m.id} className="flex items-center gap-1 text-xs">
                        <Checkbox
                          disabled={!podeEditar(p)}
                          checked={p.modulos?.includes(m.id)}
                          onCheckedChange={(v) => salvar(p, { modulos: v ? [...(p.modulos || []), m.id] : (p.modulos || []).filter((x) => x !== m.id) })}
                        />
                        {m.rotulo}
                      </label>
                    ))}
                  </div>
                ) : <span className="text-xs text-muted-foreground">Todas</span>}
              </TableCell>
              <TableCell>
                <Checkbox disabled={!podeEditar(p)} checked={p.ativo} onCheckedChange={(v) => salvar(p, { ativo: !!v })} />
              </TableCell>
              <TableCell>{podeEditar(p) && <Button size="sm" variant="outline" onClick={() => trocarSenha(p)}>Senha</Button>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome</Label><Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></div>
            <div><Label>Senha inicial</Label><Input type="text" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} placeholder="mínimo 8 caracteres" /></div>
            <div><Label>Departamento</Label><Input value={novo.departamento} onChange={(e) => setNovo({ ...novo, departamento: e.target.value })} placeholder="Financeiro, Pedagógico, Agência…" /></div>
            {eu?.papel === "master" && (
              <>
                <div>
                  <Label>Unidade</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={novo.unit_id} onChange={(e) => setNovo({ ...novo, unit_id: e.target.value })}>
                    <option value="">Selecione</option>
                    {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Papel</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value })}>
                    <option value="colaborador">Colaborador</option>
                    <option value="admin">Admin da unidade</option>
                  </select>
                </div>
              </>
            )}
            {novo.papel === "colaborador" && (
              <div>
                <Label>Telas liberadas</Label>
                <div className="mt-1 flex flex-wrap gap-3">
                  {MODULOS.map((m) => (
                    <label key={m.id} className="flex items-center gap-1 text-sm">
                      <Checkbox
                        checked={novo.modulos.includes(m.id)}
                        onCheckedChange={(v) => setNovo({ ...novo, modulos: v ? [...novo.modulos, m.id] : novo.modulos.filter((x) => x !== m.id) })}
                      />
                      {m.rotulo}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={criar}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
