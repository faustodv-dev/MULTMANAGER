import { useEffect, useState, type ComponentType } from "react";
import { toast } from "sonner";
import {
  Plus, Search, Clock, CheckCircle2, Circle, Loader2, CalendarDays, Flag,
  FileText, AlertTriangle, TrendingUp, Flame, History, CheckCheck, Building2,
} from "lucide-react";
import { api, reais, dataBr, dataHora } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const COLS = [
  { id: "novo", rotulo: "Novo", ponto: "bg-slate-400" },
  { id: "andamento", rotulo: "Em andamento", ponto: "bg-blue-500" },
  { id: "aguardando", rotulo: "Aguardando aluno", ponto: "bg-amber-500" },
];
const PRIOR: Record<string, { rotulo: string; barra: string }> = {
  alta: { rotulo: "Alta", barra: "bg-red-500" },
  normal: { rotulo: "Normal", barra: "bg-slate-300 dark:bg-slate-600" },
  baixa: { rotulo: "Baixa", barra: "bg-slate-200 dark:bg-slate-700" },
};
const BUCKETS = [
  { id: "diaria", rotulo: "Hoje", freqs: ["diaria"], anel: "text-sky-500" },
  { id: "semanal", rotulo: "Esta semana", freqs: ["semanal"], anel: "text-violet-500" },
  { id: "mensal", rotulo: "Este mês", freqs: ["mensal", "dia_fixo"], anel: "text-emerald-500" },
];
const hojeISO = () => new Date().toISOString().slice(0, 10);
const iniciais = (nome?: string | null) =>
  (nome || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

interface Card {
  id: string; cod_alu: string | null; nome_aluno: string | null; nome_responsavel: string | null;
  telefone: string | null; titulo: string; descricao: string | null; status: string; prioridade: string;
  responsavel_id: string | null; prazo: string | null; canal_origem: string; updated_at: string;
}
interface Colab { id: string; nome: string; email: string; papel: string }
interface Exec {
  id: string; titulo: string; procedimento: string | null; frequencia: string; status: string;
  data_prevista: string | null; hora_prevista: string | null; prazo: string | null;
  responsavel_id: string | null; observacao: string | null; evidencia_url: string | null; periodo_ref: string;
}

export default function Departamento({ departamento, titulo, Icone }: { departamento: string; titulo: string; Icone: ComponentType<any> }) {
  const DEP = departamento;
  const { perfil, unidades } = useAuth();
  const [unidade, setUnidade] = useState(perfil?.unit_id || unidades[0]?.id || "rio_verde");
  const [cards, setCards] = useState<Card[]>([]);
  const [colabs, setColabs] = useState<Colab[]>([]);
  const [execs, setExecs] = useState<Exec[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState(false);
  const [dossie, setDossie] = useState<Card | null>(null);
  const [execAtiva, setExecAtiva] = useState<Exec | null>(null);

  const nomeColab = (id: string | null) => colabs.find((c) => c.id === id)?.nome || null;
  const base = { departamento: DEP, unidade };

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api<any>("crm", { acao: "crm_inicial", ...base });
      setCards(r.cards); setColabs(r.colaboradores); setExecs(r.execucoes); setResumo(r.resumo);
    } catch (e: any) { toast.error(e.message); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidade, DEP]);

  const mover = async (card: Card, status: string) => {
    setCards((cs) => (status === "resolvido" ? cs.filter((x) => x.id !== card.id) : cs.map((x) => (x.id === card.id ? { ...x, status } : x))));
    try { await api("crm", { acao: "card_mover", card_id: card.id, status, ...base }); carregar(); }
    catch (e: any) { toast.error(e.message); carregar(); }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-muted/20">
      <header className="flex flex-wrap items-center gap-3 border-b bg-background px-5 py-3">
        <div className="mr-auto flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icone className="h-5 w-5" /></span>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight">{titulo}</h1>
            <p className="text-xs text-muted-foreground">Atendimentos e rotina da unidade</p>
          </div>
        </div>
        {perfil?.papel === "master" && unidades.length > 1 && (
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <Button onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Novo atendimento</Button>
      </header>

      {carregando ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando…</div>
      ) : (
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {resumo && (
            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Kpi icone={<FileText className="h-4 w-4" />} valor={resumo.atendimentos_abertos} rotulo="Atendimentos abertos" cor="text-orange-600" chip="bg-orange-500/10" barra="bg-orange-500" />
              <Kpi icone={<Flame className="h-4 w-4" />} valor={resumo.atendimentos_alta} rotulo="Prioridade alta" cor="text-red-600" chip="bg-red-500/10" barra="bg-red-500" alerta={resumo.atendimentos_alta > 0} />
              <Kpi icone={<CheckCheck className="h-4 w-4" />} valor={resumo.atendimentos_resolvidos_mes} rotulo="Resolvidos no mês" cor="text-green-600" chip="bg-green-500/10" barra="bg-green-500" />
              <Kpi icone={<TrendingUp className="h-4 w-4" />} valor={`${resumo.pops_pct}%`} rotulo="Rotina do mês" sub={`${resumo.pops_feitos}/${resumo.pops_total}`} cor="text-green-700" chip="bg-green-600/10" barra="bg-green-600" />
              <Kpi icone={<AlertTriangle className="h-4 w-4" />} valor={resumo.pops_atrasados} rotulo="POPs atrasados" cor="text-amber-600" chip="bg-amber-500/10" barra="bg-amber-500" alerta={resumo.pops_atrasados > 0} />
              <Kpi icone={<CalendarDays className="h-4 w-4" />} valor={`${resumo.pops_hoje_feitos}/${resumo.pops_hoje_total}`} rotulo="Rotina de hoje" cor="text-orange-600" chip="bg-orange-500/10" barra="bg-orange-400" />
            </section>
          )}

          <section>
            <SecHeader icone={<FileText className="h-4 w-4" />} titulo="Atendimentos" sub="Finalize um card para arquivá-lo no histórico do aluno" />
            <div className="grid gap-3 lg:grid-cols-3">
              {COLS.map((col) => {
                const lista = cards.filter((c) => c.status === col.id);
                return (
                  <div key={col.id} className="flex flex-col rounded-xl border bg-background">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className={cn("h-2 w-2 rounded-full", col.ponto)} />
                      <span className="text-sm font-semibold">{col.rotulo}</span>
                      <span className="ml-auto rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{lista.length}</span>
                    </div>
                    <div className="flex-1 space-y-2 px-2 pb-2">
                      {lista.map((card) => {
                        const atrasado = card.prazo && card.prazo < hojeISO();
                        return (
                          <button key={card.id} onClick={() => setDossie(card)}
                            className="group flex w-full gap-2.5 overflow-hidden rounded-lg border bg-card p-2.5 text-left shadow-sm transition-colors hover:border-primary">
                            <span className={cn("w-1 shrink-0 self-stretch rounded-full", PRIOR[card.prioridade]?.barra)} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{card.nome_aluno || card.nome_responsavel || "Avulso"}</span>
                              <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{card.titulo}</span>
                              <span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                                {nomeColab(card.responsavel_id) && (
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[8px] font-bold text-primary" title={nomeColab(card.responsavel_id)!}>{iniciais(nomeColab(card.responsavel_id))}</span>
                                )}
                                {card.prazo && <span className={cn("flex items-center gap-0.5", atrasado && "font-medium text-red-600")}><Clock className="h-3 w-3" />{dataBr(card.prazo)}</span>}
                                {card.canal_origem === "whatsapp" && <span className="ml-auto text-green-600">WhatsApp</span>}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                      {!lista.length && <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nada aqui.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <SecHeader icone={<CalendarDays className="h-4 w-4" />} titulo="Agenda da rotina" sub="POPs do período — toque para agendar ou concluir" />
            <div className="grid gap-3 lg:grid-cols-3">
              {BUCKETS.map((b) => {
                const itens = execs.filter((e) => b.freqs.includes(e.frequencia));
                const feitos = itens.filter((e) => e.status === "feito").length;
                const pct = itens.length ? Math.round((feitos / itens.length) * 100) : 0;
                return (
                  <div key={b.id} className="rounded-xl border bg-background">
                    <div className="flex items-center gap-3 border-b px-4 py-3">
                      <Anel pct={pct} cor={b.anel} />
                      <div>
                        <p className="text-sm font-semibold">{b.rotulo}</p>
                        <p className="text-xs text-muted-foreground">{feitos} de {itens.length} concluídos</p>
                      </div>
                    </div>
                    <div className="space-y-0.5 p-1.5">
                      {itens.map((e) => {
                        const atrasado = e.status !== "feito" && e.prazo && e.prazo < hojeISO();
                        return (
                          <button key={e.id} onClick={() => setExecAtiva(e)}
                            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted">
                            {e.status === "feito" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                              : e.status === "fazendo" ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                                : <Circle className={cn("mt-0.5 h-4 w-4 shrink-0", atrasado ? "text-red-500" : "text-muted-foreground/50")} />}
                            <span className="min-w-0 flex-1">
                              <span className={cn("block text-sm leading-snug", e.status === "feito" && "text-muted-foreground line-through")}>{e.titulo}</span>
                              <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                                {e.hora_prevista && <span>{e.hora_prevista.slice(0, 5)}</span>}
                                {nomeColab(e.responsavel_id) && <span>{nomeColab(e.responsavel_id)}</span>}
                                {atrasado && <span className="font-medium text-red-600">atrasado</span>}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                      {!itens.length && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nenhuma atividade neste período.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {novo && <NovoAtendimento dep={DEP} unidade={unidade} colabs={colabs} aoFechar={() => setNovo(false)} aoCriar={() => { setNovo(false); carregar(); }} />}
      {dossie && <DossieDialog dep={DEP} card={dossie} unidade={unidade} colabs={colabs} aoFechar={() => setDossie(null)} aoMudar={carregar} mover={mover} abrirOutro={(c: Card) => setDossie(c)} />}
      {execAtiva && <ExecDialog dep={DEP} exec={execAtiva} unidade={unidade} colabs={colabs} aoFechar={() => setExecAtiva(null)} aoSalvar={() => { setExecAtiva(null); carregar(); }} />}
    </div>
  );
}

function Kpi({ icone, valor, rotulo, sub, cor, chip, barra, alerta }: any) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-background p-3 pt-0", alerta && "ring-1 ring-current/20")}>
      <div className={cn("-mx-3 mb-2.5 h-1", barra)} />
      <div className={cn("mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg", chip, cor)}>{icone}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight">{valor}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
    </div>
  );
}
function SecHeader({ icone, titulo, sub }: any) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="h-4 w-1 rounded-full bg-primary" />
      <span className="text-primary">{icone}</span>
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <span className="text-xs text-muted-foreground">· {sub}</span>
    </div>
  );
}
function Anel({ pct, cor }: { pct: number; cor: string }) {
  const r = 16, c = 2 * Math.PI * r;
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg className="h-11 w-11 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          className={cn("transition-all", cor)} stroke="currentColor" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">{pct}%</span>
    </div>
  );
}

function NovoAtendimento({ dep, unidade, colabs, aoFechar, aoCriar }: any) {
  const [cpf, setCpf] = useState("");
  const [grupos, setGrupos] = useState<any[] | null>(null);
  const [sel, setSel] = useState<any>(null);
  const [avulso, setAvulso] = useState(false);
  const [form, setForm] = useState<any>({ titulo: "", descricao: "", prioridade: "normal", responsavel_id: "", prazo: "", nome_aluno: "", nome_responsavel: "", telefone: "" });
  const [busy, setBusy] = useState(false);

  const buscar = async () => {
    const d = cpf.replace(/\D/g, "");
    if (d.length < 10) return toast.error("Informe CPF (11 díg.) ou telefone com DDD.");
    setBusy(true);
    try {
      const corpo = d.length === 11 ? { cpf: d } : { telefone: d };
      const r = await api<any>("crm", { acao: "buscar_aluno", departamento: dep, unidade, ...corpo });
      setGrupos(r.grupos);
      if (!r.grupos.length) toast.info("Nada encontrado. Crie um atendimento avulso se preciso.");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const criar = async () => {
    if (!form.titulo.trim()) return toast.error("Descreva o assunto.");
    setBusy(true);
    try {
      const corpo: any = {
        acao: "card_criar", departamento: dep, unidade,
        titulo: form.titulo, descricao: form.descricao, prioridade: form.prioridade,
        responsavel_id: form.responsavel_id || null, prazo: form.prazo || null, canal_origem: "presencial",
      };
      if (sel) Object.assign(corpo, { cod_alu: sel.cod_alu, nome_aluno: sel.nome, nome_responsavel: sel.nome_responsavel, telefone: sel.telefone });
      else Object.assign(corpo, { nome_aluno: form.nome_aluno, nome_responsavel: form.nome_responsavel, telefone: form.telefone });
      await api<any>("crm", corpo);
      toast.success("Atendimento criado.");
      aoCriar();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={aoFechar}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo atendimento</DialogTitle></DialogHeader>
        {!avulso && (
          <div className="flex items-end gap-2">
            <div className="flex-1"><Label className="text-xs">CPF ou telefone</Label>
              <Input placeholder="CPF ou (64) 9..." value={cpf} onChange={(e) => setCpf(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} /></div>
            <Button variant="outline" onClick={buscar} disabled={busy}><Search className="h-4 w-4" /></Button>
          </div>
        )}
        {grupos && !avulso && (
          <div className="space-y-1.5">
            {grupos.flatMap((g) => g.alunos.map((a: any) => ({ ...a, nome_responsavel: g.nome_responsavel }))).map((a: any) => (
              <label key={a.cod_alu} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                <input type="radio" name="al" checked={sel?.cod_alu === a.cod_alu} onChange={() => setSel(a)} />
                <span>{a.nome} <span className="text-muted-foreground">(cód. {a.cod_alu})</span></span>
              </label>
            ))}
            <button className="text-xs text-primary underline" onClick={() => { setAvulso(true); setSel(null); }}>Não é aluno / criar avulso</button>
          </div>
        )}
        {avulso && (
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Nome do aluno</Label><Input value={form.nome_aluno} onChange={(e) => setForm({ ...form, nome_aluno: e.target.value })} /></div>
            <div><Label className="text-xs">Responsável</Label><Input value={form.nome_responsavel} onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            <button className="col-span-2 text-left text-xs text-primary underline" onClick={() => setAvulso(false)}>← voltar para busca</button>
          </div>
        )}
        {(sel || avulso) && (
          <div className="space-y-2 border-t pt-3">
            <div><Label className="text-xs">Assunto</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: negociar parcela vencida" /></div>
            <div><Label className="text-xs">Detalhes</Label><Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Prioridade</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
                  <option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option></select></div>
              <div><Label className="text-xs">Responsável</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={form.responsavel_id} onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}>
                  <option value="">—</option>{colabs.map((c: Colab) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
              <div><Label className="text-xs">Prazo</Label><Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></div>
            </div>
          </div>
        )}
        <DialogFooter><Button onClick={criar} disabled={busy || (!sel && !avulso)}>Criar atendimento</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DossieDialog({ dep, card, unidade, colabs, aoFechar, aoMudar, mover, abrirOutro }: any) {
  const [dados, setDados] = useState<any>(null);
  const [parcelas, setParcelas] = useState<any[] | null>(null);
  const [carregandoSis, setCarregandoSis] = useState(false);
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const base = { departamento: dep, unidade };

  const carregar = async () => { const r = await api<any>("crm", { acao: "card_dossie", card_id: card.id, ...base }); setDados(r); };
  useEffect(() => { carregar(); setParcelas(null); /* eslint-disable-next-line */ }, [card.id]);

  const verSistema = async () => {
    if (!card.cod_alu) return toast.info("Atendimento sem aluno vinculado.");
    setCarregandoSis(true);
    try { const r = await api<any>("crm", { acao: "aluno_financeiro", cod_alu: card.cod_alu, ...base }); setParcelas(r.parcelas); }
    catch (e: any) { toast.error(e.message); } finally { setCarregandoSis(false); }
  };
  const salvarCampo = async (patch: any) => {
    try { await api("crm", { acao: "card_atualizar", card_id: card.id, ...patch, ...base }); aoMudar(); }
    catch (e: any) { toast.error(e.message); }
  };
  const addNota = async (noSistema: boolean) => {
    if (!nota.trim()) return; setBusy(true);
    try { await api("crm", { acao: "card_evento", card_id: card.id, tipo: "nota", descricao: nota, no_sistema: noSistema, ...base }); setNota(""); carregar(); if (noSistema) toast.success("Registrado no CRM e no sistema escolar."); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const finalizar = async () => { await mover(card, "resolvido"); aoFechar(); };

  return (
    <Dialog open onOpenChange={aoFechar}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="pr-6">{card.nome_aluno || card.nome_responsavel || "Atendimento"}</DialogTitle></DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">{card.titulo}</p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/50 p-3 text-sm md:grid-cols-4">
          <Campo r="Responsável">{card.nome_responsavel || "—"}</Campo>
          <Campo r="Telefone">{card.telefone || "—"}</Campo>
          <Campo r="Cód. aluno">{card.cod_alu || "—"}</Campo>
          <Campo r="Origem">{card.canal_origem || "—"}</Campo>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-xs">Status</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={card.status} onChange={(e) => mover(card, e.target.value)}>
              {COLS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}</select></div>
          <div><Label className="text-xs">Responsável</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" defaultValue={card.responsavel_id || ""} onChange={(e) => salvarCampo({ responsavel_id: e.target.value || null })}>
              <option value="">—</option>{colabs.map((c: Colab) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
          <div><Label className="text-xs">Prazo</Label><Input type="date" defaultValue={card.prazo || ""} onChange={(e) => salvarCampo({ prazo: e.target.value || null })} /></div>
        </div>

        {/* Situação no sistema escolar — sob demanda */}
        {card.cod_alu && (
          <div className="rounded-lg border p-3">
            {parcelas === null ? (
              <Button variant="outline" size="sm" onClick={verSistema} disabled={carregandoSis}>
                {carregandoSis ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Building2 className="mr-1 h-4 w-4" />}Ver informações do sistema
              </Button>
            ) : (
              <>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Parcelas em aberto</p>
                {parcelas.length ? parcelas.map((f: any, i: number) => (
                  <div key={i} className="flex justify-between border-b py-1 text-sm last:border-0">
                    <span>{f.vencimento} {f.vencida && <span className="text-red-600">(vencida)</span>}</span>
                    <span className="font-medium">{f.vencida ? f.valor_hoje : f.valor_em_dia}</span>
                  </div>
                )) : <p className="text-xs text-muted-foreground">Sem parcelas em aberto.</p>}
              </>
            )}
          </div>
        )}
        {dados?.boletos?.length > 0 && (
          <Bloco titulo="Boletos Asaas">
            {dados.boletos.map((bo: any) => (
              <div key={bo.id} className="flex items-center justify-between py-0.5 text-xs">
                <span>{reais(bo.valor_centavos)} · venc. {dataBr(bo.vencimento)}</span>
                <Badge variant="secondary" className="text-[10px]">{bo.status}</Badge>
              </div>
            ))}
          </Bloco>
        )}
        {dados?.historico?.length > 0 && (
          <Bloco titulo="Histórico do aluno" icone={<History className="h-3.5 w-3.5" />}>
            {dados.historico.map((h: any) => (
              <button key={h.id} onClick={() => abrirOutro({ ...h, nome_aluno: card.nome_aluno, nome_responsavel: card.nome_responsavel, telefone: card.telefone, cod_alu: card.cod_alu, canal_origem: card.canal_origem })}
                className="flex w-full items-center justify-between py-1 text-left text-xs hover:text-primary">
                <span className="truncate">{h.titulo} <span className="text-muted-foreground">· {h.departamento}</span></span>
                <Badge variant={h.status === "resolvido" ? "secondary" : "default"} className="ml-2 shrink-0 text-[10px]">{h.status === "resolvido" ? "finalizado" : "aberto"}</Badge>
              </button>
            ))}
          </Bloco>
        )}

        {dados?.mensagens?.length > 0 && (
          <Bloco titulo="Conversa no WhatsApp">
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {dados.mensagens.map((m: any) => (
                <li key={m.id} className={cn("flex", m.direcao === "in" ? "justify-start" : "justify-end")}>
                  <span className={cn("max-w-[85%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-xs", m.direcao === "in" ? "bg-muted" : "bg-green-100 dark:bg-green-950")}>
                    {m.midia_nome && <span className="mb-0.5 block font-medium">{m.midia_nome}</span>}
                    {m.texto}
                    <span className="mt-0.5 block text-right text-[9px] text-muted-foreground">{m.direcao === "in" ? "Aluno" : m.autor === "humano" ? "Secretaria" : "IA"} · {dataHora(m.criado_em)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Bloco>
        )}

        <Bloco titulo="Linha do tempo do atendimento">
          <Textarea rows={2} placeholder="Anotar interação…" value={nota} onChange={(e) => setNota(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => addNota(true)} disabled={busy || !card.cod_alu} title={!card.cod_alu ? "Sem aluno vinculado" : ""}>Registrar no CRM e no sistema</Button>
            <Button size="sm" variant="outline" onClick={() => addNota(false)} disabled={busy}>Somente no CRM</Button>
          </div>
          <ul className="mt-3 max-h-52 space-y-1 overflow-y-auto">
            {(dados?.eventos || []).map((ev: any) => (
              <li key={ev.id} className="rounded-md border bg-card px-2.5 py-1.5 text-xs">
                <span>{ev.descricao}</span>
                <span className="block text-[10px] text-muted-foreground">{ev.autor_nome || ev.tipo} · {dataHora(ev.criado_em)}</span>
              </li>
            ))}
            {!dados?.eventos?.length && <li className="text-xs text-muted-foreground">Sem registros ainda.</li>}
          </ul>
        </Bloco>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">Finalize quando o atendimento terminar — vai para o histórico.</span>
          <Button onClick={finalizar}><CheckCheck className="mr-1 h-4 w-4" />Finalizar atendimento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Campo({ r, children }: any) { return <div><span className="text-muted-foreground">{r}: </span>{children}</div>; }
function Bloco({ titulo, icone, children }: any) {
  return (
    <div className="rounded-lg border p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">{icone}{titulo}</p>
      {children}
    </div>
  );
}

function ExecDialog({ dep, exec, unidade, colabs, aoFechar, aoSalvar }: any) {
  const [obs, setObs] = useState(exec.observacao || "");
  const [evid, setEvid] = useState(exec.evidencia_url || "");
  const [resp, setResp] = useState(exec.responsavel_id || "");
  const [data, setData] = useState(exec.data_prevista || "");
  const [hora, setHora] = useState(exec.hora_prevista ? exec.hora_prevista.slice(0, 5) : "");
  const [busy, setBusy] = useState(false);
  const base = { departamento: dep, unidade };

  const salvar = async (status: string) => {
    setBusy(true);
    try {
      await api("crm", { acao: "exec_atualizar", exec_id: exec.id, status, observacao: obs, evidencia_url: evid, responsavel_id: resp || null, data_prevista: data || null, hora_prevista: hora || null, ...base });
      aoSalvar();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={aoFechar}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2 pr-6"><FileText className="h-4 w-4 shrink-0" />{exec.titulo}</DialogTitle></DialogHeader>
        {exec.procedimento && <p className="rounded-lg bg-muted p-2.5 text-sm">{exec.procedimento}</p>}
        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Flag className="h-3 w-3" />{exec.frequencia}{exec.prazo ? ` · prazo ${dataBr(exec.prazo)}` : ""}</p>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Quando fazer</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div><Label className="text-xs">Horário</Label><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
        </div>
        <div><Label className="text-xs">Responsável</Label>
          <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={resp} onChange={(e) => setResp(e.target.value)}>
            <option value="">—</option>{colabs.map((c: Colab) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
        <div><Label className="text-xs">Observação ao concluir</Label><Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        <div><Label className="text-xs">Evidência (link do Drive, print…)</Label><Input value={evid} onChange={(e) => setEvid(e.target.value)} placeholder="https://" /></div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => salvar("a_fazer")} disabled={busy}>A fazer</Button>
          <Button variant="outline" onClick={() => salvar("fazendo")} disabled={busy}>Fazendo</Button>
          <Button onClick={() => salvar("feito")} disabled={busy}><CheckCircle2 className="mr-1 h-4 w-4" />Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
