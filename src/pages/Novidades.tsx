import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Megaphone, Plus, Pencil, Trash2, Eye, Pin, CheckCheck } from "lucide-react";
import { api } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Nov = {
  id: string; titulo: string; corpo: string; tipo: string; fixado: boolean;
  unit_id: string | null; anexo_url: string | null; publicado: boolean; criado_em: string;
  lidos: number; total: number;
};
type Form = { id: string; titulo: string; corpo: string; tipo: string; fixado: boolean; unit_id: string; anexo_url: string; publicado: boolean };

const TIPO: Record<string, { rot: string; cls: string }> = {
  novidade: { rot: "Novidade", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  aviso: { rot: "Aviso", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  importante: { rot: "Importante", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};
const VAZIO: Form = { id: "", titulo: "", corpo: "", tipo: "novidade", fixado: false, unit_id: "", anexo_url: "", publicado: true };
const dataBr = (iso: string) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "");

export default function Novidades() {
  const { perfil, unidades } = useAuth();
  const [lista, setLista] = useState<Nov[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [leitores, setLeitores] = useState<{ titulo: string; leram: any[]; faltam: any[] } | null>(null);

  const carregar = async () => {
    try { const r = await api<{ novidades: Nov[] }>("crm", { acao: "novidades_admin" }); setLista(r.novidades || []); }
    catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { if (perfil?.papel === "master") carregar(); }, [perfil?.papel]);

  if (perfil && perfil.papel !== "master") return <Navigate to="/" replace />;

  const salvar = async () => {
    if (!form || !form.titulo.trim()) return toast.error("Informe o título.");
    setSalvando(true);
    try {
      const r = await api<any>("crm", { acao: "novidade_salvar", ...form, unit_id: form.unit_id || null });
      if (!r.ok) return toast.error(r.mensagem || r.erro);
      toast.success(form.id ? "Novidade atualizada." : "Novidade publicada.");
      setForm(null); carregar();
    } catch (e: any) { toast.error(e.message); } finally { setSalvando(false); }
  };
  const remover = async (n: Nov) => {
    if (!confirm(`Remover "${n.titulo}"?`)) return;
    try { await api("crm", { acao: "novidade_remover", id: n.id }); carregar(); }
    catch (e: any) { toast.error(e.message); }
  };
  const verLeitores = async (n: Nov) => {
    try { const r = await api<any>("crm", { acao: "novidade_leitores", id: n.id }); setLeitores(r); }
    catch (e: any) { toast.error(e.message); }
  };
  const escopo = (uid: string | null) => (uid ? (unidades.find((u) => u.id === uid)?.name || uid) : "Todas as unidades");

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-bold"><Megaphone className="h-5 w-5" /> Novidades</h1>
          <Button onClick={() => setForm({ ...VAZIO })}><Plus className="mr-1 h-4 w-4" />Nova novidade</Button>
        </div>
        <p className="text-sm text-muted-foreground">Publique avisos e novidades do sistema. Todos veem no Início e no sino 🔔. Marque como <b>Importante</b> para abrir um modal no login (fecha só com "Ciente"). Você acompanha quem já leu.</p>

        {!lista.length && <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Nenhuma novidade ainda. Publique a primeira! 🚀</div>}

        <div className="space-y-3">
          {lista.map((n) => {
            const t = TIPO[n.tipo] || TIPO.novidade;
            const pct = n.total ? Math.round((100 * n.lidos) / n.total) : 0;
            return (
              <div key={n.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${t.cls}`}>{t.rot}</span>
                      {n.fixado && <span className="flex items-center gap-1 text-xs text-amber-600"><Pin className="h-3 w-3" />fixado</span>}
                      {!n.publicado && <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">rascunho</span>}
                    </div>
                    <p className="mt-1 font-semibold">{n.titulo}</p>
                    <p className="text-xs text-muted-foreground">{escopo(n.unit_id)} · {dataBr(n.criado_em)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => verLeitores(n)}><Eye className="mr-1 h-4 w-4" />Quem leu</Button>
                    <Button size="icon" variant="ghost" onClick={() => setForm({ id: n.id, titulo: n.titulo, corpo: n.corpo, tipo: n.tipo, fixado: n.fixado, unit_id: n.unit_id || "", anexo_url: n.anexo_url || "", publicado: n.publicado })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remover(n)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{n.corpo}</p>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCheck className="h-3.5 w-3.5" />Leitura</span>
                    <span><b className="text-foreground">{n.lidos}</b> de {n.total} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => { if (!o) setForm(null); }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{form?.id ? "Editar novidade" : "Nova novidade"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div><Label className="text-xs">Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
              <div><Label className="text-xs">Texto</Label><Textarea rows={6} placeholder="Escreva a novidade para a equipe…" value={form.corpo} onChange={(e) => setForm({ ...form, corpo: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Tipo</Label>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    <option value="novidade">Novidade</option>
                    <option value="aviso">Aviso</option>
                    <option value="importante">Importante (abre modal)</option>
                  </select>
                </div>
                <div><Label className="text-xs">Quem vê</Label>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })}>
                    <option value="">Todas as unidades</option>
                    {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div><Label className="text-xs">Link do PDF/anexo (opcional)</Label><Input placeholder="https://…" value={form.anexo_url} onChange={(e) => setForm({ ...form, anexo_url: e.target.value })} /></div>
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.fixado} onCheckedChange={(v) => setForm({ ...form, fixado: v })} />Fixar no topo</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.publicado} onCheckedChange={(v) => setForm({ ...form, publicado: v })} />Publicado</label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
                <Button onClick={salvar} disabled={salvando}>{form.id ? "Salvar" : "Publicar"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!leitores} onOpenChange={(o) => { if (!o) setLeitores(null); }}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle className="truncate">Quem leu · {leitores?.titulo}</DialogTitle></DialogHeader>
          {leitores && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="mb-1 font-semibold text-emerald-600">Leram ({leitores.leram.length})</p>
                {leitores.leram.length
                  ? leitores.leram.map((p: any, i: number) => (
                    <p key={i} className="flex justify-between gap-2 border-b py-1"><span className="truncate">{p.nome}</span><span className="shrink-0 text-xs text-muted-foreground">{p.lido_em ? new Date(p.lido_em).toLocaleString("pt-BR") : ""}</span></p>
                  ))
                  : <p className="text-muted-foreground">Ninguém ainda.</p>}
              </div>
              <div>
                <p className="mb-1 font-semibold text-amber-600">Faltam ler ({leitores.faltam.length})</p>
                {leitores.faltam.length
                  ? leitores.faltam.map((p: any, i: number) => <p key={i} className="border-b py-1">{p.nome}</p>)
                  : <p className="text-muted-foreground">Todo mundo já leu! 🎉</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
