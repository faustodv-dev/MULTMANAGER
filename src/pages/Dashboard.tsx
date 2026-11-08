import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { GraduationCap, Receipt, Send, AlertTriangle, RefreshCw, CalendarDays, ListTodo, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/supabase";
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
  fila: { na_fila: number; enviadas_periodo: number; erros: number; cobranca: number; faltantes: number } | null;
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

function Kpi({ rotulo, valor, sub, cor }: { rotulo: string; valor: number | string; sub?: string; cor?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${cor || ""}`}>{valor}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Painel({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Painel</h1>
            <p className="text-sm text-muted-foreground">Produtividade e pendências da unidade{dados ? ` · ${diaBr(dados.periodo.de)}–${diaBr(dados.periodo.ate)}` : ""}.</p>
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
            <Button onClick={() => setVerPend(true)} className="bg-orange-600 hover:bg-orange-700">
              <ListTodo className="mr-1 h-4 w-4" /> Pendências do dia{nPend ? ` (${nPend})` : ""}
            </Button>
          </div>
        </header>

        {carregando && !dados ? (
          <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando painel…</div>
        ) : !dados || !dados.deps.length ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Nenhum módulo liberado para o seu usuário.</div>
        ) : (
          <>
            {/* Pedagógico — prioridade */}
            {temPed && (
              <Painel titulo="Pedagógico" acao={<GraduationCap className="h-4 w-4 text-emerald-600" />}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Kpi rotulo="Atendimentos abertos" valor={ped?.abertos ?? 0} sub={`${ped?.alta ?? 0} de alta prioridade`} />
                  <Kpi rotulo="Resolvidos no período" valor={ped?.resolvidos_periodo ?? 0} cor="text-emerald-600" />
                  <Kpi rotulo="Risco de evasão" valor={dados.risco?.total ?? 0} sub={`${dados.risco?.nivel2 ?? 0} em nível 2 · ${dados.risco?.novos_periodo ?? 0} novos`} cor="text-red-600" />
                  <Kpi rotulo="Aguardando aluno" valor={ped?.aguardando ?? 0} cor="text-amber-600" />
                </div>
              </Painel>
            )}

            {/* Financeiro — segundo */}
            {temFin && (
              <Painel titulo="Financeiro" acao={<Receipt className="h-4 w-4 text-sky-600" />}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Kpi rotulo="Atendimentos abertos" valor={fin?.abertos ?? 0} sub={`${fin?.alta ?? 0} de alta prioridade`} />
                  <Kpi rotulo="Resolvidos no período" valor={fin?.resolvidos_periodo ?? 0} cor="text-emerald-600" />
                  <Kpi rotulo="Cobranças enviadas" valor={dados.fila?.cobranca ?? 0} sub="no período (fila)" />
                  <Kpi rotulo="Aguardando" valor={fin?.aguardando ?? 0} cor="text-amber-600" />
                </div>
              </Painel>
            )}

            {/* Fila de mensagens */}
            {dados.fila && (
              <div className="grid grid-cols-3 gap-3">
                <Kpi rotulo="Na fila" valor={dados.fila.na_fila} />
                <Kpi rotulo="Enviadas no período" valor={dados.fila.enviadas_periodo} sub={`${dados.fila.faltantes} faltantes · ${dados.fila.cobranca} cobrança`} cor="text-emerald-600" />
                <Kpi rotulo="Erros" valor={dados.fila.erros} cor={dados.fila.erros ? "text-red-600" : ""} />
              </div>
            )}

            {/* Faltantes por dia — acompanhar a curva caindo */}
            {temPed && (
              <Painel titulo="Faltantes por dia">
                {dados.serie_faltantes.length ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dados.serie_faltantes} margin={{ left: -20, right: 8, top: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dia" tickFormatter={diaBr} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip labelFormatter={(v) => diaBr(String(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Line type="monotone" dataKey="n" name="Faltantes" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="py-10 text-center text-sm text-muted-foreground">Sem faltantes no período.</p>}
              </Painel>
            )}

            {/* Gráficos */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Painel titulo="Atendimentos resolvidos por dia">
                {dados.serie.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dados.serie} margin={{ left: -20, right: 8, top: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dia" tickFormatter={diaBr} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip labelFormatter={(v) => diaBr(String(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Line type="monotone" dataKey="n" name="Resolvidos" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="py-10 text-center text-sm text-muted-foreground">Sem resolvidos no período.</p>}
              </Painel>

              <Painel titulo="Resolvidos por colaborador">
                {dados.por_colaborador.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dados.por_colaborador} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="n" name="Resolvidos" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="py-10 text-center text-sm text-muted-foreground">Sem atribuição por colaborador no período.</p>}
              </Painel>

              {temPed && dados.termometro && (
                <Painel titulo="Termômetro dos alunos">
                  {termoData.length ? (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="55%" height={200}>
                        <PieChart>
                          <Pie data={termoData} dataKey="valor" nameKey="nome" innerRadius={48} outerRadius={78} paddingAngle={2}>
                            {termoData.map((d) => <Cell key={d.nome} fill={COR_FAIXA[d.nome]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
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
    </div>
  );
}
