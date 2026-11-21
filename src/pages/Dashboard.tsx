import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { GraduationCap, Receipt, Send, AlertTriangle, RefreshCw, CalendarDays, ListTodo, Loader2, Briefcase, XCircle, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { api, dataHora } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Dep = "pedagogico" | "financeiro" | "encaminhamento";
type KPI = { abertos: number; alta: number; resolvidos_periodo: number; aguardando: number };
type Pendencia = { tipo: string; dep: string; titulo: string; nome: string | null; cod_alu: string | null };
type Dados = {
  periodo: { de: string; ate: string };
  deps: Dep[];
  por_dep: Record<string, KPI>;
  risco: { total: number; nivel1: number; nivel2: number; novos_periodo: number } | null;
  termometro: { quente: number; morno: number; frio: number } | null;
  agencia_kpi: { encaminhados_periodo: number; contratados_periodo: number; vagas_abertas: number } | null;
  fila: { na_fila: number; enviadas_periodo: number; erros: number; cobranca: number; faltantes: number } | null;
  erros_lista: { origem: string; categoria: string | null; telefone: string | null; alunos: string | null; erro: string | null; quando: string | null }[];
  serie: { dia: string; n: number }[];
  serie_faltantes: { dia: string; n: number }[];
  por_colaborador: { nome: string; n: number }[];
  pendencias: Pendencia[];
};

const hojeISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const primeiroDoMes = () => hojeISO().slice(0, 8) + "01";
const diaBr = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

const COR_FAIXA: Record<string, string> = { quente: "#ef4444", morno: "#f59e0b", frio: "#3b82f6" };
const DEP_ROTULO: Record<string, string> = { pedagogico: "Pedagógico", financeiro: "Financeiro", encaminhamento: "Encaminhamento" };

// Paleta de acentos (tema claro, vibrante). Cada métrica ganha uma cor própria:
// barra de gradiente no topo do tile, número colorido e leve tingido de fundo.
type Acento = "slate" | "emerald" | "sky" | "red" | "amber" | "violet";
const ACENTO: Record<Acento, { bar: string; num: string; soft: string; hex: string }> = {
  slate:   { bar: "from-slate-300 to-slate-400",     num: "text-slate-700",   soft: "from-slate-50",   hex: "#64748b" },
  emerald: { bar: "from-emerald-400 to-teal-500",    num: "text-emerald-600", soft: "from-emerald-50", hex: "#10b981" },
  sky:     { bar: "from-sky-400 to-indigo-500",      num: "text-sky-600",     soft: "from-sky-50",     hex: "#0ea5e9" },
  red:     { bar: "from-rose-400 to-red-500",        num: "text-red-600",     soft: "from-rose-50",    hex: "#ef4444" },
  amber:   { bar: "from-amber-400 to-orange-500",    num: "text-amber-600",   soft: "from-amber-50",   hex: "#f59e0b" },
  violet:  { bar: "from-violet-400 to-fuchsia-500",  num: "text-violet-600",  soft: "from-violet-50",  hex: "#8b5cf6" },
};

const TOOLTIP = { fontSize: 12, borderRadius: 12, border: "1px solid hsl(var(--border))", boxShadow: "0 8px 24px rgba(15,23,42,0.12)", background: "hsl(var(--card))" };

function Kpi({ rotulo, valor, sub, accent = "slate", icon }: { rotulo: string; valor: number | string; sub?: string; accent?: Acento; icon?: React.ReactNode }) {
  const a = ACENTO[accent];
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${a.bar}`} />
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.soft} to-transparent opacity-40`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
          {icon && <span className={a.num}>{icon}</span>}
        </div>
        <p className={`mt-1 text-3xl font-bold tabular-nums ${a.num}`}>{valor}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function Painel({ titulo, children, acao, accent }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode; accent?: Acento }) {
  const bar = accent ? ACENTO[accent].bar : "from-slate-300 to-slate-400";
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className={`inline-block h-4 w-1 rounded-full bg-gradient-to-b ${bar}`} />
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

const TIPO_DASH: Record<string, { rot: string; cls: string }> = {
  novidade: { rot: "Novidade", cls: "bg-sky-100 text-sky-700" },
  aviso: { rot: "Aviso", cls: "bg-amber-100 text-amber-700" },
  importante: { rot: "Importante", cls: "bg-red-100 text-red-700" },
};

/** Feed de novidades do sistema no topo do Início (publicadas pelo master). */
function FeedNovidades() {
  const [lista, setLista] = useState<any[]>([]);
  const [exp, setExp] = useState<string | null>(null);
  const carregar = async () => { try { const r = await api<any>("crm", { acao: "novidades_feed" }); setLista(r.novidades || []); } catch { /* ok */ } };
  useEffect(() => { carregar(); }, []);
  if (!lista.length) return null;
  const abrir = async (n: any) => {
    setExp((e) => (e === n.id ? null : n.id));
    if (!n.lido) { setLista((l) => l.map((x) => (x.id === n.id ? { ...x, lido: true } : x))); try { await api("crm", { acao: "novidade_marcar_lida", id: n.id }); } catch { /* ok */ } }
  };
  return (
    <Painel titulo="Novidades do sistema" accent="violet" acao={<Megaphone className="h-4 w-4 text-violet-600" />}>
      <div className="space-y-2">
        {lista.slice(0, 5).map((n) => {
          const t = TIPO_DASH[n.tipo] || TIPO_DASH.novidade;
          return (
            <div key={n.id} className={cn("rounded-lg border p-2.5 transition-colors", !n.lido && "border-sky-200 bg-sky-50/50")}>
              <button onClick={() => abrir(n)} className="flex w-full items-center gap-2 text-left">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.cls}`}>{t.rot}</span>
                {!n.lido && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" />}
                <span className="flex-1 truncate text-sm font-medium">{n.titulo}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{diaBr((n.criado_em || "").slice(0, 10))}</span>
              </button>
              {exp === n.id && (
                <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {n.corpo}
                  {n.anexo_url && <a href={n.anexo_url} target="_blank" rel="noreferrer" className="mt-1 block font-medium text-sky-600 hover:underline">📎 Abrir anexo</a>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Painel>
  );
}

export default function Dashboard() {
  const { perfil, unidades } = useAuth();
  const ehMaster = perfil?.papel === "master";
  const [unidade, setUnidade] = useState(perfil?.unit_id || "rio_verde");
  const [de, setDe] = useState(primeiroDoMes());
  const [ate, setAte] = useState(hojeISO());
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [verPend, setVerPend] = useState(false);
  const [verErros, setVerErros] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api<{ ok: boolean } & Dados>("crm", { acao: "dashboard", unidade, de, ate });
      setDados(r);
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar o painel.");
    }
    setCarregando(false);
  }, [unidade, de, ate]);

  useEffect(() => { carregar(); }, [carregar]);

  const ped = dados?.por_dep?.pedagogico;
  const fin = dados?.por_dep?.financeiro;
  const temPed = dados?.deps?.includes("pedagogico");
  const temFin = dados?.deps?.includes("financeiro");
  const termoData = useMemo(
    () => dados?.termometro ? (["quente", "morno", "frio"] as const).map((k) => ({ nome: k, valor: dados.termometro![k] })).filter((x) => x.valor > 0) : [],
    [dados]
  );
  const nPend = dados?.pendencias?.length || 0;
  const nErros = dados?.fila?.erros || 0;
  const temEnc = dados?.deps?.includes("encaminhamento");
  const enc = dados?.por_dep?.encaminhamento;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border bg-gradient-to-r from-sky-50 via-card to-violet-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-md">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <h1 className="bg-gradient-to-r from-sky-600 to-violet-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">Painel</h1>
              <p className="text-sm text-muted-foreground">Produtividade e pendências da unidade{dados ? ` · ${diaBr(dados.periodo.de)}–${diaBr(dados.periodo.ate)}` : ""}.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {ehMaster && unidades.length > 1 && (
              <div>
                <Label className="text-xs">Unidade</Label>
                <select className="h-10 w-44 rounded-md border bg-background px-2 text-sm" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                  {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div><Label className="text-xs">De</Label><Input type="date" className="w-40" value={de} max={ate} onChange={(e) => setDe(e.target.value)} /></div>
            <div><Label className="text-xs">Até</Label><Input type="date" className="w-40" value={ate} min={de} max={hojeISO()} onChange={(e) => setAte(e.target.value)} /></div>
            <Button variant="outline" onClick={carregar} disabled={carregando} title="Atualizar"><RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} /></Button>
            <Button variant="outline" onClick={() => setVerErros(true)} className={nErros ? "border-red-300 text-red-600 hover:text-red-700" : ""}>
              <XCircle className="mr-1 h-4 w-4" /> Erros{nErros ? ` (${nErros})` : ""}
            </Button>
            <Button onClick={() => setVerPend(true)} className="bg-orange-600 hover:bg-orange-700">
              <ListTodo className="mr-1 h-4 w-4" /> Pendências do dia{nPend ? ` (${nPend})` : ""}
            </Button>
          </div>
        </header>

        <FeedNovidades />

        {carregando && !dados ? (
          <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando painel…</div>
        ) : !dados || !dados.deps.length ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Nenhum módulo liberado para o seu usuário.</div>
        ) : (
          <>
            {/* Pedagógico — prioridade */}
            {temPed && (
              <Painel titulo="Pedagógico" accent="emerald" acao={<GraduationCap className="h-4 w-4 text-emerald-600" />}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Kpi rotulo="Atendimentos abertos" valor={ped?.abertos ?? 0} sub={`${ped?.alta ?? 0} de alta prioridade`} accent="sky" icon={<GraduationCap className="h-4 w-4" />} />
                  <Kpi rotulo="Resolvidos no período" valor={ped?.resolvidos_periodo ?? 0} accent="emerald" />
                  <Kpi rotulo="Risco de evasão" valor={dados.risco?.total ?? 0} sub={`${dados.risco?.nivel2 ?? 0} em nível 2 · ${dados.risco?.novos_periodo ?? 0} novos`} accent="red" icon={<AlertTriangle className="h-4 w-4" />} />
                  <Kpi rotulo="Aguardando aluno" valor={ped?.aguardando ?? 0} accent="amber" />
                </div>
              </Painel>
            )}

            {/* Financeiro — segundo */}
            {temFin && (
              <Painel titulo="Financeiro" accent="sky" acao={<Receipt className="h-4 w-4 text-sky-600" />}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Kpi rotulo="Atendimentos abertos" valor={fin?.abertos ?? 0} sub={`${fin?.alta ?? 0} de alta prioridade`} accent="sky" icon={<Receipt className="h-4 w-4" />} />
                  <Kpi rotulo="Resolvidos no período" valor={fin?.resolvidos_periodo ?? 0} accent="emerald" />
                  <Kpi rotulo="Cobranças enviadas" valor={dados.fila?.cobranca ?? 0} sub="no período (fila)" accent="violet" icon={<Send className="h-4 w-4" />} />
                  <Kpi rotulo="Aguardando" valor={fin?.aguardando ?? 0} accent="amber" />
                </div>
              </Painel>
            )}

            {/* Encaminhamento / Agência de Emprego — espaços reservados (em breve) */}
            {temEnc && (
              <Painel titulo="Encaminhamento / Agência de Emprego" accent="violet" acao={<Briefcase className="h-4 w-4 text-violet-600" />}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Kpi rotulo="Alunos encaminhados" valor={dados.agencia_kpi?.encaminhados_periodo ?? 0} sub={`${dados.agencia_kpi?.contratados_periodo ?? 0} contratado(s) no período`} accent="violet" icon={<Briefcase className="h-4 w-4" />} />
                  <Kpi rotulo="Vagas abertas" valor={dados.agencia_kpi?.vagas_abertas ?? 0} accent="sky" />
                  <Kpi rotulo="Atendimentos abertos" valor={enc?.abertos ?? 0} sub={`${enc?.alta ?? 0} de alta prioridade`} accent="amber" />
                  <Kpi rotulo="Resolvidos no período" valor={enc?.resolvidos_periodo ?? 0} accent="emerald" />
                </div>
              </Painel>
            )}

            {/* Fila de mensagens */}
            {dados.fila && (
              <div className="grid grid-cols-3 gap-3">
                <Kpi rotulo="Na fila" valor={dados.fila.na_fila} accent="slate" icon={<Send className="h-4 w-4" />} />
                <Kpi rotulo="Enviadas no período" valor={dados.fila.enviadas_periodo} sub={`${dados.fila.faltantes} faltantes · ${dados.fila.cobranca} cobrança`} accent="emerald" />
                <Kpi rotulo="Erros" valor={dados.fila.erros} accent={dados.fila.erros ? "red" : "slate"} icon={<XCircle className="h-4 w-4" />} />
              </div>
            )}

            {/* Faltantes por dia — acompanhar a curva caindo */}
            {temPed && (
              <Painel titulo="Faltantes por dia" accent="amber">
                {dados.serie_faltantes.length ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={dados.serie_faltantes} margin={{ left: -20, right: 8, top: 4 }}>
                      <defs>
                        <linearGradient id="gradFaltantes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="dia" tickFormatter={diaBr} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip labelFormatter={(v) => diaBr(String(v))} contentStyle={TOOLTIP} />
                      <Area type="monotone" dataKey="n" name="Faltantes" stroke="#f59e0b" strokeWidth={2.5} fill="url(#gradFaltantes)" dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <p className="py-10 text-center text-sm text-muted-foreground">Sem faltantes no período.</p>}
              </Painel>
            )}

            {/* Gráficos */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Painel titulo="Atendimentos resolvidos por dia" accent="emerald">
                {dados.serie.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={dados.serie} margin={{ left: -20, right: 8, top: 4 }}>
                      <defs>
                        <linearGradient id="gradResolvidos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="dia" tickFormatter={diaBr} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip labelFormatter={(v) => diaBr(String(v))} contentStyle={TOOLTIP} />
                      <Area type="monotone" dataKey="n" name="Resolvidos" stroke="#10b981" strokeWidth={2.5} fill="url(#gradResolvidos)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <p className="py-10 text-center text-sm text-muted-foreground">Sem resolvidos no período.</p>}
              </Painel>

              <Painel titulo="Resolvidos por colaborador" accent="sky">
                {dados.por_colaborador.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dados.por_colaborador} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <defs>
                        <linearGradient id="gradColab" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#0ea5e9" />
                          <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                      </defs>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} contentStyle={TOOLTIP} />
                      <Bar dataKey="n" name="Resolvidos" fill="url(#gradColab)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="py-10 text-center text-sm text-muted-foreground">Sem atribuição por colaborador no período.</p>}
              </Painel>

              {temPed && dados.termometro && (
                <Painel titulo="Termômetro dos alunos" accent="red">
                  {termoData.length ? (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="55%" height={200}>
                        <PieChart>
                          <Pie data={termoData} dataKey="valor" nameKey="nome" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}>
                            {termoData.map((d) => <Cell key={d.nome} fill={COR_FAIXA[d.nome]} />)}
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1 text-sm">
                        <p><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: COR_FAIXA.quente }} />🔥 Quente: <b>{dados.termometro.quente}</b></p>
                        <p><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: COR_FAIXA.morno }} />🙂 Morno: <b>{dados.termometro.morno}</b></p>
                        <p><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: COR_FAIXA.frio }} />🧊 Frio: <b>{dados.termometro.frio}</b></p>
                      </div>
                    </div>
                  ) : <p className="py-10 text-center text-sm text-muted-foreground">Sem temperaturas calculadas ainda.</p>}
                </Painel>
              )}
            </div>
          </>
        )}
      </div>

      {/* Pendências do dia */}
      <Dialog open={verPend} onOpenChange={setVerPend}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-orange-600" /> Pendências do dia</DialogTitle></DialogHeader>
          {!nPend ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nada pendente agora. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {dados!.pendencias.map((p, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg border p-2.5 text-sm">
                  {p.tipo === "risco_novo"
                    ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    : <Send className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                  <div className="min-w-0">
                    <p className="font-medium">{p.nome || p.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.tipo === "risco_novo" ? "Novo risco de evasão" : "Aguardando aluno"} · {DEP_ROTULO[p.dep] || p.dep}{p.cod_alu ? ` · cód. ${p.cod_alu}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Erros de envio */}
      <Dialog open={verErros} onOpenChange={setVerErros}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-600" /> Erros de envio</DialogTitle></DialogHeader>
          <p className="-mt-2 mb-1 text-xs text-muted-foreground">Mensagens que falharam no envio (não inclui canceladas).</p>
          {!dados?.erros_lista?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum erro de envio no período. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {dados.erros_lista.map((e, i) => (
                <li key={i} className="rounded-lg border border-red-200 p-2.5 text-sm">
                  <p className="font-medium">{e.alunos || e.telefone || "—"}</p>
                  <p className="text-xs text-red-600">{e.erro || "falha no envio"}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.origem === "regua_cobranca" ? "Cobrança" : "Faltantes"}{e.quando ? ` · ${dataHora(e.quando)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
