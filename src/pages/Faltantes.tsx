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
import { UserX, Save, Loader2, RefreshCw, Clock, CalendarOff, Play, Users } from "lucide-react";

type Etapa = { id: string; ativo: boolean; texto: string };
type Regua = { ativa: boolean; horario: number; pula_domingo: boolean; pre_verificar_justificativa: boolean; statuses: string[]; etapas: Etapa[] };
type Fila = { categoria: string | null; telefone: string | null; alunos: string | null; status: string; agendado_para: string | null; enviado_em: string | null; enfileirado_em: string; erro: string | null };

const STATUS_FALLBACK = ["Ativo", "Desistente", "Rescindido", "Trancado", "Formado"];
const rotuloEtapa: Record<string, string> = {
  justificada: "Falta justificada (acolhe + reposição)",
  falta1: "1ª falta (acolhimento)",
  consec2: "2 faltas seguidas (risco)",
  consec3: "3 faltas seguidas (coordenação/48h)",
};
const tomEtapa: Record<string, string> = {
  justificada: "bg-emerald-100 text-emerald-700",
  falta1: "bg-emerald-100 text-emerald-700",
  consec2: "bg-orange-100 text-orange-700",
  consec3: "bg-rose-100 text-rose-700",
};
const statusRotulo: Record<string, string> = { pendente: "Na fila", enviando: "Enviando", enviado: "Enviado", erro: "Erro", cancelado: "Cancelado" };
const hojeISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function StatusPicker({ opcoes, value, onChange, disabled }: { opcoes: string[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const toggle = (s: string) => (value.includes(s) ? onChange(value.filter((x) => x !== s)) : onChange([...value, s]));
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map((s) => {
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

export default function Faltantes() {
  const { perfil, unidades } = useAuth();
  const [unidade, setUnidade] = useState(perfil?.papel === "master" ? "rio_verde" : (perfil?.unit_id || "rio_verde"));
  const [regua, setRegua] = useState<Regua | null>(null);
  const [statusOpcoes, setStatusOpcoes] = useState<string[]>(STATUS_FALLBACK);
  const [ultimos, setUltimos] = useState<Fila[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [dataTeste, setDataTeste] = useState(hojeISO());

  const podeEditar = perfil?.papel === "master" || perfil?.papel === "admin";

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api<{ regua: Regua; statuses_disponiveis: string[]; ultimos: Fila[] }>("faltantes", { acao: "obter", unit_id: unidade });
      setRegua(r.regua);
      setStatusOpcoes(r.statuses_disponiveis?.length ? r.statuses_disponiveis : STATUS_FALLBACK);
      setUltimos(r.ultimos || []);
    } catch (e: any) { toast.error(e.message); }
    setCarregando(false);
  };
  useEffect(() => { if (unidade) carregar(); /* eslint-disable-next-line */ }, [unidade]);

  const setEtapa = (i: number, patch: Partial<Etapa>) =>
    setRegua((r) => (r ? { ...r, etapas: r.etapas.map((e, j) => (j === i ? { ...e, ...patch } : e)) } : r));

  const salvar = async () => {
    if (!regua) return;
    setSalvando(true);
    try { await api("faltantes", { acao: "salvar", unit_id: unidade, regua }); toast.success("Régua de faltantes salva."); carregar(); }
    catch (e: any) { toast.error(e.message); }
    setSalvando(false);
  };

  const rodarAgora = async () => {
    setRodando(true);
    try {
      const r = await api<{ resumo: any }>("faltantes", { acao: "rodar_agora", unit_id: unidade, data: dataTeste });
      const x = r.resumo;
      toast.success(`${x.faltantes ?? 0} faltante(s) · ${x.enfileiradas ?? 0} enfileirada(s). O gateway envia no horário da unidade.`);
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
            <h1 className="flex items-center gap-2 text-xl font-bold"><UserX className="h-5 w-5 text-orange-500" /> Régua de faltantes</h1>
            <p className="text-sm text-muted-foreground">Contato diário com quem faltou, por etapa de risco. Acolhe, oferece reposição e previne a evasão. Nunca cobra quem justificou. Quando o aluno responde, a assistente pedagógica assume.</p>
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
                  <p className="text-sm text-muted-foreground">{regua.ativa ? `${ativos} etapa(s) ativa(s). Enfileira todo dia de manhã; o gateway envia no horário abaixo.` : "Ligue para começar os contatos automáticos com faltantes."}</p>
                </div>
                <Switch checked={regua.ativa} disabled={!podeEditar} onCheckedChange={(v) => setRegua({ ...regua, ativa: v })} />
              </div>
              <div className="mt-3 border-t pt-3">
                <Label className="text-xs text-muted-foreground">Status cobrados (quem não estiver marcado nunca recebe)</Label>
                <div className="mt-2"><StatusPicker opcoes={statusOpcoes} value={regua.statuses} onChange={(v) => setRegua({ ...regua, statuses: v.length ? v : ["Ativo"] })} disabled={!podeEditar} /></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-sm">
                <label className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Horário
                  <select className="h-9 rounded-md border bg-background px-2 text-sm" value={regua.horario} disabled={!podeEditar} onChange={(e) => setRegua({ ...regua, horario: Number(e.target.value) })}>
                    {Array.from({ length: 15 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2"><Switch checked={regua.pula_domingo} disabled={!podeEditar} onCheckedChange={(v) => setRegua({ ...regua, pula_domingo: v })} /><span className="flex items-center gap-1"><CalendarOff className="h-4 w-4" /> Pular domingo</span></label>
                <label className="flex items-center gap-2"><Switch checked={regua.pre_verificar_justificativa} disabled={!podeEditar} onCheckedChange={(v) => setRegua({ ...regua, pre_verificar_justificativa: v })} /> Não cobrar quem justificou</label>
              </div>
              {regua.ativa && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">⚠️ Com a régua ativa, as mensagens são enviadas de verdade (no horário acima). Requer o WhatsApp da unidade conectado.</p>}
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">Mensagens por etapa</p>
                <span className="text-xs text-muted-foreground">Variáveis: {"{aluno}  {responsavel}  {curso}"}</span>
              </div>
              <div className="space-y-4">
                {regua.etapas.map((e, i) => (
                  <div key={e.id} className={`rounded-lg border p-3 ${e.ativo ? "" : "opacity-60"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tomEtapa[e.id] || "bg-muted"}`}>{rotuloEtapa[e.id] || e.id}</span>
                      <Switch checked={e.ativo} disabled={!podeEditar} onCheckedChange={(v) => setEtapa(i, { ativo: v })} />
                    </div>
                    <Textarea className="mt-2 min-h-[72px] text-sm" value={e.texto} maxLength={700} disabled={!podeEditar} onChange={(ev) => setEtapa(i, { texto: ev.target.value })} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <p className="mb-2 font-semibold">Rodar agora (teste)</p>
              <p className="mb-3 text-sm text-muted-foreground">Enfileira os faltantes de uma data. As mensagens saem pelo gateway no horário da unidade (ou já, se o horário passou). Quem já tem msg na fila não duplica.</p>
              <div className="flex flex-wrap items-end gap-3">
                <div><Label className="text-xs">Data das faltas</Label><Input type="date" className="w-44" value={dataTeste} onChange={(e) => setDataTeste(e.target.value)} /></div>
                <Button variant="secondary" onClick={rodarAgora} disabled={rodando || !podeEditar}>{rodando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />} Enfileirar faltantes</Button>
              </div>
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
