import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { api } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const DEPS = [
  { id: "financeiro", rotulo: "Financeiro" },
  { id: "pedagogico", rotulo: "Pedagógico" },
  { id: "encaminhamento", rotulo: "Encaminhamento" },
];
const FREQ: Record<string, string> = { diaria: "Diária", semanal: "Semanal", mensal: "Mensal", dia_fixo: "Dia fixo do mês" };

interface Pop {
  id: string; departamento: string; titulo: string; procedimento: string | null;
  frequencia: string; dia_do_mes: number | null; responsavel_sugerido: string | null; ordem: number; ativo: boolean;
}

export default function Pops() {
  const { perfil, unidades } = useAuth();
  const [unidade, setUnidade] = useState(perfil?.unit_id || unidades[0]?.id || "rio_verde");
  const [dep, setDep] = useState("financeiro");
  const [pops, setPops] = useState<Pop[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [edit, setEdit] = useState<Partial<Pop> | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api<any>("crm", { acao: "pops_admin", departamento: dep, unidade });
      setPops(r.pops);
    } catch (e: any) { toast.error(e.message); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [dep, unidade]);

  const excluir = async (p: Pop) => {
    if (!confirm(`Desativar o POP "${p.titulo}"? Ele deixa de aparecer na agenda (o histórico é mantido).`)) return;
    try { await api("crm", { acao: "pop_excluir", id: p.id, departamento: dep, unidade }); carregar(); toast.success("POP desativado."); }
    catch (e: any) { toast.error(e.message); }
  };

  if (perfil?.papel !== "master" && perfil?.papel !== "admin")
    return <div className="p-8 text-muted-foreground">Tela exclusiva de administradores.</div>;

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-4xl space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" /></span>
          <div>
            <h1 className="text-lg font-bold leading-tight">POPs — procedimentos padrão</h1>
            <p className="text-xs text-muted-foreground">Base da agenda de rotina de cada departamento</p>
          </div>
        </div>
        {perfil?.papel === "master" && unidades.length > 1 && (
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <Button onClick={() => setEdit({ departamento: dep, frequencia: "mensal", ordem: pops.length + 1, ativo: true })}><Plus className="mr-1 h-4 w-4" />Novo POP</Button>
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
        {DEPS.map((d) => (
          <button key={d.id} onClick={() => setDep(d.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${dep === d.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {d.rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando…</div>
      ) : (
        <div className="space-y-2">
          {pops.map((p) => (
            <div key={p.id} className={`flex items-start gap-3 rounded-lg border bg-card p-3 ${!p.ativo && "opacity-50"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.titulo}</span>
                  <Badge variant="secondary" className="text-[10px]">{FREQ[p.frequencia]}{p.frequencia === "dia_fixo" && p.dia_do_mes ? ` (dia ${p.dia_do_mes})` : ""}</Badge>
                  {!p.ativo && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
                </div>
                {p.procedimento && <p className="mt-0.5 text-sm text-muted-foreground">{p.procedimento}</p>}
                {p.responsavel_sugerido && <p className="mt-0.5 text-xs text-muted-foreground">Sugerido: {p.responsavel_sugerido}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></Button>
                {p.ativo && <Button variant="ghost" size="icon" onClick={() => excluir(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>
            </div>
          ))}
          {!pops.length && <p className="py-12 text-center text-sm text-muted-foreground">Nenhum POP neste departamento ainda. Crie o primeiro.</p>}
        </div>
      )}

      {edit && <EditPop pop={edit} unidade={unidade} dep={dep} aoFechar={() => setEdit(null)} aoSalvar={() => { setEdit(null); carregar(); }} />}
    </div>
    </div>
  );
}

function EditPop({ pop, unidade, dep, aoFechar, aoSalvar }: any) {
  const [f, setF] = useState<any>({
    id: pop.id, departamento: pop.departamento || dep, titulo: pop.titulo || "", procedimento: pop.procedimento || "",
    frequencia: pop.frequencia || "mensal", dia_do_mes: pop.dia_do_mes || "",
    responsavel_sugerido: pop.responsavel_sugerido || "", ordem: pop.ordem || 0, ativo: pop.ativo !== false,
  });
  const [busy, setBusy] = useState(false);

  const salvar = async () => {
    if (!f.titulo.trim()) return toast.error("Informe o título.");
    setBusy(true);
    try {
      await api("crm", {
        acao: "pop_salvar", departamento: f.departamento, unidade,
        id: f.id || undefined, titulo: f.titulo, procedimento: f.procedimento, frequencia: f.frequencia,
        dia_do_mes: f.frequencia === "dia_fixo" ? Number(f.dia_do_mes) || 1 : null,
        responsavel_sugerido: f.responsavel_sugerido, ordem: Number(f.ordem) || 0, ativo: f.ativo,
      });
      toast.success("POP salvo.");
      aoSalvar();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={aoFechar}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar POP" : "Novo POP"}</DialogTitle></DialogHeader>
        <div><Label className="text-xs">Departamento</Label>
          <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={f.departamento} onChange={(e) => setF({ ...f, departamento: e.target.value })}>
            <option value="financeiro">Financeiro</option><option value="pedagogico">Pedagógico</option><option value="encaminhamento">Encaminhamento</option>
          </select></div>
        <div><Label className="text-xs">Título da atividade</Label><Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></div>
        <div><Label className="text-xs">Procedimento (passo a passo)</Label><Textarea rows={3} value={f.procedimento} onChange={(e) => setF({ ...f, procedimento: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Frequência</Label>
            <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={f.frequencia} onChange={(e) => setF({ ...f, frequencia: e.target.value })}>
              <option value="diaria">Diária</option><option value="semanal">Semanal</option><option value="mensal">Mensal</option><option value="dia_fixo">Dia fixo do mês</option>
            </select></div>
          {f.frequencia === "dia_fixo" && (
            <div><Label className="text-xs">Dia do mês</Label><Input type="number" min={1} max={28} value={f.dia_do_mes} onChange={(e) => setF({ ...f, dia_do_mes: e.target.value })} /></div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Responsável sugerido</Label><Input value={f.responsavel_sugerido} onChange={(e) => setF({ ...f, responsavel_sugerido: e.target.value })} placeholder="opcional" /></div>
          <div><Label className="text-xs">Ordem</Label><Input type="number" value={f.ordem} onChange={(e) => setF({ ...f, ordem: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={salvar} disabled={busy}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
