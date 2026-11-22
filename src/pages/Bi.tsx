import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Target, Loader2, RefreshCw, Save, Trash2 } from "lucide-react";

type Metrica = { id: string; rotulo: string; sufixo: string; melhor: "alto" | "baixo" };
type Unidade = { id: string; name: string };
type Snapshot = { unit_id: string; data: string; metricas: Record<string, number> };
type Meta = { unit_id: string; metrica: string; periodo: string; alvo: number };
type Dados = { master: boolean; metricas: Metrica[]; unidades: Unidade[]; periodo: string; snapshots: Snapshot[]; metas: Meta[] };

const TODAS = "__todas__";
const diaBr = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const mesAtual = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
// Paleta morna da marca para as linhas por unidade.
const CORES = ["hsl(27 92% 54%)", "hsl(173 58% 39%)", "hsl(262 52% 55%)", "hsl(201 70% 45%)", "hsl(345 70% 52%)"];
const fmt = (v: number | undefined, suf: string) => (v === undefined || v === null ? "—" : `${Number.isInteger(v) ? v : v.toFixed(1)}${suf}`);

export default function Bi() {
  const { perfil } = useAuth();
  const master = perfil?.papel === "master";
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [dias, setDias] = useState(60);
  const [periodo, setPeriodo] = useState(mesAtual());
  const [unidadeSel, setUnidadeSel] = useState<string>("");
  const [metricaSel, setMetricaSel] = useState("frequencia_media");
  const [editMetas, setEditMetas] = useState<Record<string, string>>({});

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api<Dados>("crm", { acao: "bi_dados", dias, periodo });
      setDados(r);
      if (!unidadeSel) setUnidadeSel(r.master ? TODAS : (r.unidades[0]?.id || ""));
    } catch (e: any) { toast.error(e.message); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [dias, periodo]);

  const atualizarAgora = async () => {
    setAtualizando(true);
    try {
      const r = await api<{ resumo: { feitos: number; erros: number } }>("crm", { acao: "bi_snapshot_agora" });
      toast.success(`Snapshot de hoje gerado para ${r.resumo.feitos} unidade(s).${r.resumo.erros ? ` ${r.resumo.erros} erro(s).` : ""}`);
      carregar();
    } catch (e: any) { toast.error(e.message); }
    finally { setAtualizando(false); }
  };

  const metrica = dados?.metricas.find((m) => m.id === metricaSel) || dados?.metricas[0];
  const verTodas = master && unidadeSel === TODAS;

  // Série temporal da métrica escolhida: uma coluna por unidade (modo Todas) ou só a unidade.
  const serie = useMemo(() => {
    if (!dados || !metrica) return [];
    const uids = verTodas ? dados.unidades.map((u) => u.id) : [unidadeSel];
    const porData = new Map<string, any>();
    for (const s of dados.snapshots) {
      if (!uids.includes(s.unit_id)) continue;
      const ponto = porData.get(s.data) || { data: diaBr(s.data) };
      ponto[s.unit_id] = s.metricas?.[metrica.id] ?? null;
      porData.set(s.data, ponto);
    }
    return [...porData.values()];
  }, [dados, metrica, unidadeSel, verTodas]);

  // Último valor de cada unidade (para KPIs, meta e comparativo).
  const ultimoPorUnidade = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const s of dados?.snapshots || []) m.set(s.unit_id, s.metricas); // ordenados asc → fica o mais recente
    return m;
  }, [dados]);

  const metaDe = (unitId: string, metId: string) => dados?.metas.find((x) => x.unit_id === unitId && x.metrica === metId)?.alvo;
  const nomeUnidade = (id: string) => dados?.unidades.find((u) => u.id === id)?.name || id;

  const salvarMeta = async (unitId: string, metId: string) => {
    const alvo = editMetas[`${unitId}|${metId}`];
    if (alvo === undefined || alvo === "") return;
    try {
      await api("crm", { acao: "bi_meta_salvar", unit_id: unitId, metrica: metId, periodo, alvo });
      toast.success("Meta salva.");
      carregar();
    } catch (e: any) { toast.error(e.message); }
  };
  const removerMeta = async (unitId: string, metId: string) => {
    try {
      await api("crm", { acao: "bi_meta_remover", unit_id: unitId, metrica: metId, periodo });
      carregar();
    } catch (e: any) { toast.error(e.message); }
  };

  if (carregando && !dados) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…</div>;
  }
  if (!dados || !metrica) return null;

  const unidadeFoco = verTodas ? null : unidadeSel;
  const semDados = dados.snapshots.length === 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-5 p-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md"><TrendingUp className="h-6 w-6" /></span>
            <div>
              <h1 className="font-display text-xl font-bold">BI de Metas</h1>
              <p className="text-sm text-muted-foreground">Indicadores da escola ao longo do tempo, com meta e comparativo.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {master && (
              <select className="h-10 rounded-md border bg-background px-2 text-sm" value={unidadeSel} onChange={(e) => setUnidadeSel(e.target.value)}>
                <option value={TODAS}>Todas (comparativo)</option>
                {dados.unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <select className="h-10 rounded-md border bg-background px-2 text-sm" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
              <option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option>
            </select>
            {master && (
              <Button variant="secondary" onClick={atualizarAgora} disabled={atualizando} title="Gerar o snapshot de hoje agora (sem esperar o cron das 6h)">
                {atualizando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Atualizar agora
              </Button>
            )}
          </div>
        </header>

        {semDados ? (
          <section className="rounded-xl border bg-card p-8 text-center shadow-sm">
            <p className="font-semibold">Ainda não há snapshots.</p>
            <p className="mt-1 text-sm text-muted-foreground">O retrato diário é gerado automaticamente às 6h. {master ? "Para ver já, clique em “Atualizar agora”." : "Volte amanhã para ver as tendências."}</p>
          </section>
        ) : (
          <>
            {/* KPIs da unidade em foco (último valor + meta) */}
            {unidadeFoco && (
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {dados.metricas.map((m) => {
                  const val = ultimoPorUnidade.get(unidadeFoco)?.[m.id];
                  const alvo = metaDe(unidadeFoco, m.id);
                  const atingiu = alvo !== undefined && val !== undefined && (m.melhor === "alto" ? val >= alvo : val <= alvo);
                  return (
                    <button key={m.id} onClick={() => setMetricaSel(m.id)}
                      className={cn("rounded-xl border bg-card p-4 text-left shadow-sm transition-colors", metricaSel === m.id ? "border-primary ring-1 ring-primary/30" : "hover:bg-muted/40")}>
                      <p className="text-xs text-muted-foreground">{m.rotulo}</p>
                      <p className="mt-1 text-3xl font-bold tabular-nums">{fmt(val, m.sufixo)}</p>
                      {alvo !== undefined ? (
                        <p className={cn("mt-1 text-xs font-medium", atingiu ? "text-emerald-700" : "text-amber-700")}>
                          {atingiu ? "✓ " : ""}meta {fmt(alvo, m.sufixo)}
                        </p>
                      ) : <p className="mt-1 text-xs text-muted-foreground">sem meta</p>}
                    </button>
                  );
                })}
              </section>
            )}

            {/* Seletor de métrica (modo Todas, onde não há KPIs clicáveis) */}
            {verTodas && (
              <div className="flex flex-wrap gap-2">
                {dados.metricas.map((m) => (
                  <button key={m.id} onClick={() => setMetricaSel(m.id)}
                    className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors", metricaSel === m.id ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:bg-muted")}>
                    {m.rotulo}
                  </button>
                ))}
              </div>
            )}

            {/* Tendência */}
            <section className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
              <p className="font-semibold">{metrica.rotulo} — tendência {verTodas ? "(todas as unidades)" : `· ${nomeUnidade(unidadeFoco!)}`}</p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={serie} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="data" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                    {!verTodas && metaDe(unidadeFoco!, metrica.id) !== undefined && (
                      <ReferenceLine y={metaDe(unidadeFoco!, metrica.id)} stroke="hsl(27 92% 54%)" strokeDasharray="5 4" label={{ value: "meta", fontSize: 10, fill: "hsl(27 92% 44%)" }} />
                    )}
                    {(verTodas ? dados.unidades.map((u) => u.id) : [unidadeFoco!]).map((uid, i) => (
                      <Line key={uid} type="monotone" dataKey={uid} name={nomeUnidade(uid)} stroke={CORES[i % CORES.length]} strokeWidth={2} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {verTodas && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {dados.unidades.map((u, i) => (
                    <span key={u.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES[i % CORES.length] }} />{u.name}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Comparativo entre unidades (master, modo Todas): último valor da métrica */}
            {verTodas && (
              <section className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
                <p className="font-semibold">Comparativo — {metrica.rotulo} (valor mais recente)</p>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dados.unidades.map((u) => ({ nome: u.name, valor: ultimoPorUnidade.get(u.id)?.[metrica.id] ?? 0 }))} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="nome" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                      <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                        {dados.unidades.map((u, i) => <Cell key={u.id} fill={CORES[i % CORES.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}
          </>
        )}

        {/* Metas do mês (master define o alvo por unidade/métrica) */}
        {master && (
          <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold"><Target className="h-4 w-4 text-muted-foreground" /> Metas do mês</p>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Período</Label>
                <Input type="month" className="h-9 w-40" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="px-2 py-1.5 text-left">Unidade</th>{dados.metricas.map((m) => <th key={m.id} className="px-2 py-1.5 text-left">{m.rotulo}</th>)}</tr>
                </thead>
                <tbody>
                  {dados.unidades.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="px-2 py-2 font-medium">{u.name}</td>
                      {dados.metricas.map((m) => {
                        const k = `${u.id}|${m.id}`;
                        const atual = metaDe(u.id, m.id);
                        return (
                          <td key={m.id} className="px-2 py-2">
                            <div className="flex items-center gap-1">
                              <Input className="h-8 w-20" inputMode="decimal" placeholder={atual !== undefined ? String(atual) : "—"}
                                value={editMetas[k] ?? ""} onChange={(e) => setEditMetas((s) => ({ ...s, [k]: e.target.value }))} />
                              <button className="text-muted-foreground hover:text-primary" title="Salvar" onClick={() => salvarMeta(u.id, m.id)}><Save className="h-4 w-4" /></button>
                              {atual !== undefined && <button className="text-muted-foreground hover:text-destructive" title="Remover meta" onClick={() => removerMeta(u.id, m.id)}><Trash2 className="h-4 w-4" /></button>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Deixe em branco e clique em salvar para não mexer; o alvo digitado vira a linha de meta nos gráficos da unidade.</p>
          </section>
        )}
      </div>
    </div>
  );
}
