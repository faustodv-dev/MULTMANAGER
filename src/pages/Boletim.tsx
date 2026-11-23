import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileText, Save, Loader2, Send, History, Eye } from "lucide-react";

type Boletim = { ativa: boolean; horario: number; dia: number; espalhar_horas: number; statuses: string[]; cabecalho: string; rodape: string };
type Previa = { mes: string; responsaveis: number; alunos: number; amostra: string[] };
type Fila = { categoria: string | null; telefone: string | null; alunos: string | null; status: string; agendado_para: string | null; enviado_em: string | null; enfileirado_em: string; erro: string | null };

const STATUS_ROTULO: Record<string, string> = { pendente: "Na fila", enviando: "Enviando", enviado: "Enviado", erro: "Erro", cancelado: "Cancelado" };
const STATUS_TOM: Record<string, string> = { enviado: "text-emerald-700", erro: "text-rose-700", enviando: "text-sky-700", pendente: "text-muted-foreground", cancelado: "text-muted-foreground" };
const quando = (f: Fila) => (f.enviado_em || f.agendado_para || f.enfileirado_em || "").replace("T", " ").slice(0, 16);
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mesQueFechou = () => {
  const sp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  sp.setDate(1); sp.setMonth(sp.getMonth() - 1);
  return `${sp.getFullYear()}-${String(sp.getMonth() + 1).padStart(2, "0")}`;
};
const mesExtenso = (iso: string) => (iso ? `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}` : "");

export default function Boletim() {
  const { perfil, unidades } = useAuth();
  const [unidade, setUnidade] = useState(perfil?.papel === "master" ? "rio_verde" : (perfil?.unit_id || "rio_verde"));
  const [cfg, setCfg] = useState<Boletim | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mes, setMes] = useState(mesQueFechou());
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [calc, setCalc] = useState(false);
  const [enfileirando, setEnfileirando] = useState(false);
  const [ultimos, setUltimos] = useState<Fila[]>([]);

  const podeEditar = perfil?.papel === "master" || perfil?.papel === "admin";

  const carregar = async () => {
    setCarregando(true); setPrevia(null);
    try {
      const r = await api<{ regua: Boletim; ultimos: Fila[] }>("faltantes", { acao: "boletim_obter", unit_id: unidade });
      setCfg(r.regua); setUltimos(r.ultimos || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidade]);

  const salvar = async () => {
    if (!cfg) return;
    setSalvando(true);
    try {
      const r = await api<{ regua: Boletim }>("faltantes", { acao: "boletim_salvar", unit_id: unidade, regua: cfg });
      setCfg(r.regua); toast.success("Régua de boletim salva.");
    } catch (e: any) { toast.error(e.message); }
    finally { setSalvando(false); }
  };

  const verPrevia = async () => {
    setCalc(true);
    try {
      const r = await api<{ previa: Previa }>("faltantes", { acao: "boletim_previa", unit_id: unidade, mes });
      setPrevia(r.previa);
    } catch (e: any) { toast.error(e.message); }
    finally { setCalc(false); }
  };

  const enfileirarAgora = async () => {
    setEnfileirando(true);
    try {
      const r = await api<{ resumo: { enfileiradas: number; mes: string } }>("faltantes", { acao: "boletim_rodar", unit_id: unidade, mes });
      toast.success(`${r.resumo.enfileiradas} boletim(ns) enfileirado(s) para ${mesExtenso(r.resumo.mes)}.`);
      carregar();
    } catch (e: any) { toast.error(e.message); }
    finally { setEnfileirando(false); }
  };

  if (carregando || !cfg) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 p-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-md"><FileText className="h-6 w-6" /></span>
            <div>
              <h1 className="font-display text-xl font-bold">Boletim mensal</h1>
              <p className="text-sm text-muted-foreground">Todo dia 01, um resumo de frequência, notas e Diário vai ao responsável.</p>
            </div>
          </div>
          {unidades.length > 1 && (
            <select className="h-10 w-48 rounded-md border bg-background px-2 text-sm" value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={perfil?.papel !== "master"}>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </header>

        {/* Configuração */}
        <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Envio automático {cfg.ativa ? <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">ligado</span> : <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">desligado</span>}</p>
              <p className="text-xs text-muted-foreground">No dia escolhido, cobre o mês que fechou e sai pela fila (texto).</p>
            </div>
            <Switch checked={cfg.ativa} disabled={!podeEditar} onCheckedChange={(v) => setCfg({ ...cfg, ativa: v })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Dia do envio</Label>
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm" value={cfg.dia} disabled={!podeEditar} onChange={(e) => setCfg({ ...cfg, dia: Number(e.target.value) })}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>dia {String(d).padStart(2, "0")}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Horário de início</Label>
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm" value={cfg.horario} disabled={!podeEditar} onChange={(e) => setCfg({ ...cfg, horario: Number(e.target.value) })}>
                {Array.from({ length: 15 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Espalhar envio ao longo de</Label>
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm sm:w-56" value={cfg.espalhar_horas} disabled={!podeEditar} onChange={(e) => setCfg({ ...cfg, espalhar_horas: Number(e.target.value) })}>
              <option value={0}>Tudo de uma vez (não recomendado)</option>
              {[2, 4, 6, 8, 10, 12].map((h) => <option key={h} value={h}>{h} horas</option>)}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Distribui as mensagens na janela escolhida (a partir do horário de início) para <b>proteger o chip de bloqueio</b> — nada de rajada.</p>
          </div>

          <div>
            <Label className="text-xs">Saudação (cabeçalho)</Label>
            <Textarea className="mt-1 min-h-[72px] text-sm" value={cfg.cabecalho} maxLength={600} disabled={!podeEditar} onChange={(e) => setCfg({ ...cfg, cabecalho: e.target.value })} />
            <p className="mt-1 text-xs text-muted-foreground">Variáveis: <code>{"{responsavel}"}</code> <code>{"{mes}"}</code> <code>{"{aluno_poss}"}</code> · as linhas de frequência, notas e Diário são geradas automaticamente.</p>
          </div>
          <div>
            <Label className="text-xs">Fechamento (rodapé)</Label>
            <Textarea className="mt-1 min-h-[60px] text-sm" value={cfg.rodape} maxLength={600} disabled={!podeEditar} onChange={(e) => setCfg({ ...cfg, rodape: e.target.value })} />
          </div>

          {podeEditar && (
            <Button onClick={salvar} disabled={salvando}>{salvando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Salvar</Button>
          )}
        </section>

        {/* Prévia (sem envio) */}
        <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <p className="font-semibold">Prévia — como fica</p>
            <p className="text-xs text-muted-foreground">Monta os boletins do mês escolhido e mostra uma amostra. <b>Nenhuma mensagem é enviada.</b></p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">Mês de referência</Label>
              <Input type="month" className="mt-1 h-10 w-44" value={mes} onChange={(e) => { setMes(e.target.value); setPrevia(null); }} />
            </div>
            <Button variant="secondary" onClick={verPrevia} disabled={calc}>{calc ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Eye className="mr-1 h-4 w-4" />} Ver prévia</Button>
          </div>

          {previa && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Responsáveis</p>
                  <p className="text-2xl font-bold tabular-nums">{previa.responsaveis}</p>
                </div>
                <div className="rounded-lg border bg-sky-50 p-3">
                  <p className="text-xs text-sky-700">Alunos no boletim</p>
                  <p className="text-2xl font-bold tabular-nums text-sky-700">{previa.alunos}</p>
                </div>
              </div>
              {previa.amostra.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Amostra ({previa.amostra.length} de {previa.responsaveis}):</p>
                  {previa.amostra.map((m, i) => (
                    <pre key={i} className="whitespace-pre-wrap rounded-lg border bg-background p-3 text-xs font-sans leading-relaxed">{m}</pre>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border bg-background py-6 text-center text-sm text-muted-foreground">Nenhum aluno com dados em {mesExtenso(previa.mes)}.</p>
              )}

              {podeEditar && previa.responsaveis > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="bg-sky-600 hover:bg-sky-700" disabled={enfileirando}>
                      {enfileirando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Enfileirar agora (teste)
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Enviar os boletins de verdade?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Vai enfileirar o boletim de <b>{mesExtenso(previa.mes)}</b> para <b>{previa.responsaveis}</b> responsável(is) ({previa.alunos} aluno(s)). As mensagens saem pelo WhatsApp pela fila, no ritmo do gateway. Confirmar?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={enfileirarAgora}>Enfileirar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </section>

        {/* Últimos envios */}
        <section className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
          <p className="flex items-center gap-2 font-semibold"><History className="h-4 w-4 text-muted-foreground" /> Últimos envios</p>
          {ultimos.length ? (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr><th className="px-3 py-2 text-left">Para</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Quando</th></tr>
                </thead>
                <tbody>
                  {ultimos.map((u, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5">{u.telefone}</td>
                      <td className={cn("px-3 py-1.5", STATUS_TOM[u.status] || "")}>{STATUS_ROTULO[u.status] || u.status}{u.erro ? ` · ${u.erro}` : ""}</td>
                      <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{quando(u)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border bg-background py-6 text-center text-sm text-muted-foreground">Nenhum envio ainda.</p>
          )}
        </section>
      </div>
    </div>
  );
}
