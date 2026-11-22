import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, dataHora } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GraduationCap, Save, Loader2, RefreshCw, Clock, Play, Users, Eye, Trophy } from "lucide-react";

type Etapa = { id: string; ativo: boolean; limiar: number; texto: string };
type Regua = { ativa: boolean; horario: number; statuses: string[]; etapas: Etapa[] };
type Fila = { categoria: string | null; telefone: string | null; alunos: string | null; status: string; agendado_para: string | null; enviado_em: string | null; enfileirado_em: string; erro: string | null };
type Previa = { total: number; por_etapa: Record<string, number>; amostra: { aluno: string; curso: string; presenca: number; etapa: string }[] };

const STATUS = ["Ativo", "Trancado", "Formado", "Rescindido", "Desistente"];
const rotuloEtapa: Record<string, string> = {
  felicitacao: "Bateu o limiar (certificado garantido)",
  reta_final: "Reta final",
  indicacao: "Indicação (bônus por amigo)",
  conclusao: "Concluiu (renovação + Agência)",
};
const tomEtapa: Record<string, string> = {
  felicitacao: "bg-emerald-100 text-emerald-700",
  reta_final: "bg-sky-100 text-sky-700",
  indicacao: "bg-violet-100 text-violet-700",
  conclusao: "bg-amber-100 text-amber-700",
};
const statusRotulo: Record<string, string> = { pendente: "Na fila", enviando: "Enviando", enviado: "Enviado", erro: "Erro", cancelado: "Cancelado" };

function StatusPicker({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const toggle = (s: string) => (value.includes(s) ? onChange(value.filter((x) => x !== s)) : onChange([...value, s]));
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS.map((s) => {
        const on = value.includes(s);
        return (
          <button key={s} type="button" disabled={disabled} onClick={() => toggle(s)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              on ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "bg-background text-muted-foreground hover:bg-muted",
              disabled && "cursor-not-allowed opacity-60")}>
            {s}
          </button>
        );
      })}
    </div>
  );
}

export default function Formandos() {
  const { perfil, unidades } = useAuth();
  const [unidade, setUnidade] = useState(perfil?.papel === "master" ? "rio_verde" : (perfil?.unit_id || "rio_verde"));
  const [regua, setRegua] = useState<Regua | null>(null);
  const [ultimos, setUltimos] = useState<Fila[]>([]);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [prevendo, setPrevendo] = useState(false);

  const podeEditar = perfil?.papel === "master" || perfil?.papel === "admin";

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api<{ regua: Regua; ultimos: Fila[] }>("faltantes", { acao: "formando_obter", unit_id: unidade });
      setRegua(r.regua);
      setUltimos(r.ultimos || []);
      setPrevia(null);
    } catch (e: any) { toast.error(e.message); }
    setCarregando(false);
  };
  useEffect(() => { if (unidade) carregar(); /* eslint-disable-next-line */ }, [unidade]);

  const setEtapa = (i: number, patch: Partial<Etapa>) =>
    setRegua((r) => (r ? { ...r, etapas: r.etapas.map((e, j) => (j === i ? { ...e, ...patch } : e)) } : r));

  const salvar = async () => {
    if (!regua) return;
    setSalvando(true);
    try { await api("faltantes", { acao: "formando_salvar", unit_id: unidade, regua }); toast.success("Régua de formando salva."); carregar(); }
    catch (e: any) { toast.error(e.message); }
    setSalvando(false);
  };

  const verPrevia = async () => {
    setPrevendo(true);
    try {
      const r = await api<{ previa: Previa }>("faltantes", { acao: "formando_previa", unit_id: unidade });
      setPrevia(r.previa);
    } catch (e: any) { toast.error(e.message); }
    setPrevendo(false);
  };

  const rodarAgora = async () => {
    setRodando(true);
    try {
      const r = await api<{ resumo: any }>("faltantes", { acao: "formando_rodar", unit_id: unidade });
      const x = r.resumo;
      toast.success(`${x.formandos ?? 0} formando(s) · ${x.enfileiradas ?? 0} mensagem(ns) enfileirada(s). O gateway envia no horário da unidade.`);
      carregar();
    } catch (e: any) { toast.error(e.message); }
    setRodando(false);
  };

  const ativos = useMemo(() => regua?.etapas.filter((e) => e.ativo).length ?? 0, [regua]);
  if (carregando && !regua) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold"><GraduationCap className="h-5 w-5 text-emerald-600" /> Régua de formando</h1>
            <p className="text-sm text-muted-foreground">Roda em paralelo à régua de faltantes: quando o aluno cruza a frequência de cada etapa (80% garante o certificado), entra num funil — felicitação, reta final, indicação e, aos 100%, renovação + encaminhamento pela Agência. O pedagógico alimentando o comercial.</p>
          </div>
          <div className="flex items-end gap-2">
            {unidades.length > 1 && (
              <div>
                <Label className="text-xs">Unidade</Label>
                <select className="h-10 w-48 rounded-md border bg-background px-2 text-sm" value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={perfil?.papel !== "master"}>
                  {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <Button variant="outline" onClick={carregar} disabled={carregando} title="Atualizar"><RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} /></Button>
          </div>
        </header>

        {regua && (
          <>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{regua.ativa ? "Régua ativa" : "Régua desligada"}</p>
                  <p className="text-sm text-muted-foreground">{regua.ativa ? `${ativos} etapa(s) ativa(s). Enfileira todo dia; o gateway envia no horário abaixo. Cada etapa vai uma vez por aluno.` : "Ligue para começar a parabenizar e reter os formandos automaticamente."}</p>
                </div>
                <Switch checked={regua.ativa} disabled={!podeEditar} onCheckedChange={(v) => setRegua({ ...regua, ativa: v })} />
              </div>
              <div className="mt-3 border-t pt-3">
                <Label className="text-xs text-muted-foreground">Matrículas consideradas</Label>
                <div className="mt-2"><StatusPicker value={regua.statuses} onChange={(v) => setRegua({ ...regua, statuses: v.length ? v : ["Ativo"] })} disabled={!podeEditar} /></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-sm">
                <label className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Horário
                  <select className="h-9 rounded-md border bg-background px-2 text-sm" value={regua.horario} disabled={!podeEditar} onChange={(e) => setRegua({ ...regua, horario: Number(e.target.value) })}>
                    {Array.from({ length: 15 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                  </select>
                </label>
              </div>
              {regua.ativa && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">⚠️ Com a régua ativa, as mensagens são enviadas de verdade (no horário acima). Requer o WhatsApp da unidade conectado.</p>}
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">Etapas do funil</p>
                <span className="text-xs text-muted-foreground">Variáveis: {"{aluno}  {curso}  {presenca}"}</span>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">O aluno recebe a etapa de <b>maior limiar</b> que ele alcança e ainda não recebeu. Ajuste o % que dispara cada etapa.</p>
              <div className="space-y-4">
                {regua.etapas.map((e, i) => (
                  <div key={e.id} className={`rounded-lg border p-3 ${e.ativo ? "" : "opacity-60"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tomEtapa[e.id] || "bg-muted"}`}>{rotuloEtapa[e.id] || e.id}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">dispara a partir de
                          <Input type="number" min={1} max={100} className="h-8 w-16" value={e.limiar} disabled={!podeEditar} onChange={(ev) => setEtapa(i, { limiar: Math.min(100, Math.max(1, Number(ev.target.value) || 1)) })} />%
                        </label>
                        <Switch checked={e.ativo} disabled={!podeEditar} onCheckedChange={(v) => setEtapa(i, { ativo: v })} />
                      </div>
                    </div>
                    <Textarea className="mt-2 min-h-[72px] text-sm" value={e.texto} maxLength={700} disabled={!podeEditar} onChange={(ev) => setEtapa(i, { texto: ev.target.value })} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <p className="mb-2 font-semibold">Prévia e teste</p>
              <p className="mb-3 text-sm text-muted-foreground">A <b>prévia</b> mostra quantos alunos estão em cada etapa agora (sem enviar). <b>Enfileirar</b> dispara as mensagens de verdade (o gateway envia no horário da unidade; quem já recebeu a etapa não repete).</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={verPrevia} disabled={prevendo}>{prevendo ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Eye className="mr-1 h-4 w-4" />} Ver prévia</Button>
                <Button variant="secondary" onClick={rodarAgora} disabled={rodando || !podeEditar}>{rodando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />} Enfileirar agora</Button>
              </div>
              {previa && (
                <div className="mt-4 rounded-md border bg-muted/30 p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4 text-amber-500" /> {previa.total} formando(s) agora</p>
                  <div className="flex flex-wrap gap-2">
                    {regua.etapas.filter((e) => e.ativo).map((e) => (
                      <span key={e.id} className={`rounded-full px-2.5 py-1 text-xs font-medium ${tomEtapa[e.id] || "bg-muted"}`}>
                        {rotuloEtapa[e.id]?.split(" (")[0] || e.id}: <b>{previa.por_etapa[e.id] || 0}</b>
                      </span>
                    ))}
                  </div>
                  {previa.amostra.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">Ex.: {previa.amostra.slice(0, 6).map((a) => `${a.aluno} (${Math.round(a.presenca)}%)`).join(", ")}…</p>
                  )}
                </div>
              )}
            </div>

            {ultimos.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <p className="mb-2 flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Últimos na fila</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Aluno</th><th className="pr-3">Etapa</th><th className="pr-3">Status</th><th>Enviado</th></tr></thead>
                    <tbody>
                      {ultimos.map((f, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-1 pr-3">{f.alunos || "—"}</td>
                          <td className="pr-3 whitespace-nowrap">{rotuloEtapa[f.categoria || ""]?.split(" (")[0] || f.categoria}</td>
                          <td className="pr-3 whitespace-nowrap"><span className={f.status === "enviado" ? "text-emerald-600" : f.status === "erro" ? "text-rose-600" : "text-muted-foreground"}>{statusRotulo[f.status] || f.status}</span></td>
                          <td className="whitespace-nowrap">{f.enviado_em ? dataHora(f.enviado_em) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {podeEditar && (
              <div className="sticky bottom-0 -mx-4 flex justify-end border-t bg-background/80 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border">
                <Button onClick={salvar} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">{salvando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Salvar régua</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
