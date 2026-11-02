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

type Funcao = { id: string; rotulo: string; papel: Perfil["papel"]; modulos: Modulo[] };
const TODAS: Modulo[] = ["atendimento", "comprovantes", "financeiro", "pedagogico", "encaminhamento"];
const FUNCOES: Funcao[] = [
  { id: "admin", rotulo: "Admin da unidade", papel: "admin", modulos: [...TODAS, "configuracoes"] },
  { id: "coordenador", rotulo: "Coordenador", papel: "coordenador", modulos: TODAS },
  { id: "financeiro", rotulo: "Financeiro", papel: "colaborador", modulos: ["financeiro"] },
  { id: "pedagogico", rotulo: "Pedagógico", papel: "colaborador", modulos: ["pedagogico"] },
  { id: "encaminhamento", rotulo: "Encaminhamento", papel: "colaborador", modulos: ["encaminhamento"] },
];
const ROTULO: Record<string, string> = {
  master: "Master geral", admin: "Admin da unidade", coordenador: "Coordenador",
  financeiro: "Financeiro", pedagogico: "Pedagógico", encaminhamento: "Encaminhamento", colaborador: "Colaborador",
};
function funcaoDe(p: Perfil): string {
  if (p.papel === "master") return "master";
  if (p.papel === "admin") return "admin";
  if (p.papel === "coordenador") return "coordenador";
  const m = p.modulos || [];
  if (m.includes("financeiro")) return "financeiro";
  if (m.includes("pedagogico")) return "pedagogico";
  if (m.includes("encaminhamento")) return "encaminhamento";
  return "colaborador";
}

export default function Usuarios() {
  const { perfil: eu, unidades } = useAuth();
  const [lista, setLista] = useState<Perfil[]>([]);
  const [aberto, setAberto] = useState(false);
  const [importando, setImportando] = useState(false);
  const [novo, setNovo] = useState({ nome: "", email: "", senha: "", funcao: "financeiro", unit_id: eu?.unit_id || "" });

  const disponiveis = eu?.papel === "master" ? FUNCOES : FUNCOES.filter((f) => f.id !== "admin");

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
  const mudarFuncao = (p: Perfil, fid: string) => {
    const f = FUNCOES.find((x) => x.id === fid);
    if (f) salvar(p, { papel: f.papel, modulos: f.modulos });
  };

  const criar = async () => {
    const f = FUNCOES.find((x) => x.id === novo.funcao)!;
    try {
      await api("admin-usuarios", { acao: "criar", nome: novo.nome, email: novo.email, senha: novo.senha, papel: f.papel, modulos: f.modulos, unit_id: novo.unit_id });
      toast.success("Usuário criado");
      setAberto(false);
      setNovo({ ...novo, nome: "", email: "", senha: "" });
      carregar();
    } catch (e: any) { toast.error(e.message); }
  };

  const importar = async () => {
    if (!confirm("Importar os admins do CRM comercial (cria as unidades que faltam e os usuários admin com senha PRIMEIRONOME+123)?")) return;
    setImportando(true);
    try {
      const r = await api<any>("admin-usuarios", { acao: "importar_admins" });
      const criados = r.resultado.filter((x: any) => x.status === "criado");
      const linhas = r.resultado.map((x: any) => `${x.nome} (${x.unidade || "—"}): ${x.status}${x.senha ? ` · senha ${x.senha}` : ""}${x.erro ? ` · ${x.erro}` : ""}`).join("\n");
      toast.success(`${criados.length} admin(s) criado(s).`);
      alert("Resultado da importação:\n\n" + linhas + "\n\nPeça para cada um trocar a senha no primeiro acesso.");
      carregar();
    } catch (e: any) { toast.error(e.message); } finally { setImportando(false); }
  };

  const trocarSenha = async (p: Perfil) => {
    const senha = window.prompt(`Nova senha para ${p.nome || p.email} (mínimo 6 caracteres):`);
    if (!senha) return;
    try { await api("admin-usuarios", { acao: "senha", user_id: p.id, senha }); toast.success("Senha alterada"); }
    catch (e: any) { toast.error(e.message); }
  };

  const podeEditar = (p: Perfil) => p.id !== eu?.id && p.papel !== "master" && (eu?.papel === "master" || (eu?.papel === "admin" && p.unit_id === eu.unit_id));

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Usuários</h1>
        <div className="flex gap-2">
          {eu?.papel === "master" && <Button variant="outline" onClick={importar} disabled={importando}>Importar admins do comercial</Button>}
          <Button onClick={() => setAberto(true)}>Novo usuário</Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Função</TableHead>
            <TableHead>Ativo</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <div className="font-medium">{p.nome || "—"}</div>
                <div className="text-xs text-muted-foreground">{p.email}</div>
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
                {podeEditar(p) ? (
                  <select className="rounded border bg-background px-1 py-1 text-sm" value={funcaoDe(p)} onChange={(e) => mudarFuncao(p, e.target.value)}>
                    {disponiveis.map((f) => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
                  </select>
                ) : ROTULO[funcaoDe(p)]}
              </TableCell>
              <TableCell><Checkbox disabled={!podeEditar(p)} checked={p.ativo} onCheckedChange={(v) => salvar(p, { ativo: !!v })} /></TableCell>
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
            <div><Label>Senha inicial</Label><Input type="text" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} placeholder="mínimo 6 caracteres (ex.: NOME123)" /></div>
            {eu?.papel === "master" && (
              <div>
                <Label>Unidade</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={novo.unit_id} onChange={(e) => setNovo({ ...novo, unit_id: e.target.value })}>
                  <option value="">Selecione</option>
                  {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <Label>Função</Label>
              <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={novo.funcao} onChange={(e) => setNovo({ ...novo, funcao: e.target.value })}>
                {disponiveis.map((f) => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Financeiro/Pedagógico/Encaminhamento veem só a sua tela. Coordenador vê todas; Admin vê todas e gerencia usuários.</p>
            </div>
          </div>
          <DialogFooter><Button onClick={criar}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
