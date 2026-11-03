import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, reais, dataBr, dataHora } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BellRing, Send, Save, CalendarOff, Loader2, Clock, RefreshCw } from "lucide-react";

type Passo = { offset: number; ativo: boolean; texto: string };
type Regua = { ativa: boolean; horario: number; pula_domingo: boolean; passos: Passo[] };
type Envio = {
  offset_dias: number; vencimento: string | null; telefone: string | null;
  alunos: string | null; valor_centavos: number | null; status: string; enviado_em: string;
};

const rotulo = (o: number) => {
  const n = Math.abs(o);
  if (o < 0) return `${n} dia${n > 1 ? "s" : ""} antes de vencer`;
  if (o === 0) return "No dia do vencimento";
  return `${n} dia${n > 1 ? "s" : ""} depois de vencer`;
};
// Cores da marca: verde (preventivo) → laranja (no dia) → laranja forte/vermelho (vencido)
const tom = (o: number) =>
  o < 0
    ? { chip: "bg-emerald-100 text-emerald-700", ponto: "bg-emerald-500" }
    : o === 0
    ? { chip: "bg-orange-100 text-orange-700", ponto: "bg-orange-500" }
    : o <= 7
    ? { chip: "bg-orange-100 text-orange-700", ponto: "bg-orange-500" }
    : { chip: "bg-rose-100 text-rose-700", ponto: "bg-rose-500" };

const VARIAVEIS = ["{responsavel}", "{aluno}", "{valor}", "{vencimento}"];
const statusRotulo: Record<string, string> = {
  enviado: "Enviado", simulado: "Simulado", erro: "Erro", pulado_boleto_ativo: "Pulado (já tinha boleto)",
};

export default function Regua() {
  const { perfil, unidades } = useAuth();
  const [unidade, setUnidade] = useState(perfil?.unit_id || unidades[0]?.id || "");
  const [regua, setRegua] = useState<Regua | null>(null);
  const [ultimos, setUltimos] = useState<Envio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [telTeste, setTelTeste] = useState("");
  const [offsetTeste, setOffsetTeste] = useState<number>(-3);
  const [testando, setTestando] = useState(false);

  const podeEditar = perfil?.papel === "master" || perfil?.papel === "admin";

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api<{ regua: Regua; ultimos: Envio[] }>("regua", { acao: "obter", unit_id: unidade });
      setRegua(r.regua);
      setUltimos(r.ultimos || []);
      if (r.regua.passos[0]) setOffsetTeste(r.regua.passos[0].offset);
    } catch (e: any) {
      toast.error(e.message);
    }
    setCarregando(false);
  };
  useEffect(() => { if (unidade) carregar(); /* eslint-disable-next-line */ }, [unidade]);

  const setPasso = (i: number, patch: Partial<Passo>) =>
    setRegua((r) => (r ? { ...r, passos: r.passos.map((p, j) => (j === i ? { ...p, ...patch } : p)) } : r));

  const salvar = async () => {
    if (!regua) return;
    setSalvando(true);
    try {
      await api("regua", { acao: "salvar", unit_id: unidade, regua });
      toast.success("Régua salva.");
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    }
    setSalvando(false);
  };

  const testar = async () => {
    if (!telTeste.replace(/\D/g, "")) return toast.error("Informe um número com DDD.");
    setTestando(true);
    try {
      const r = await api<{ ok: boolean; status: string; erro?: string }>("regua", {
        acao: "testar", unit_id: unidade, telefone: telTeste, offset: offsetTeste,
      });
      if (r.ok) toast.success(r.status === "simulado" ? "Teste simulado (WhatsApp ainda não conectado)." : "Mensagem de teste enviada! 📲");
      else toast.error(r.erro || "Falha no envio — o WhatsApp desta unidade está conectado?");
    } catch (e: any) {
      toast.error(e.message);
    }
    setTestando(false);
  };

  const ativos = useMemo(() => regua?.passos.filter((p) => p.ativo).length ?? 0, [regua]);

  if (carregando && !regua) return <div className="p-8 text-muted-foreground">Carregando régua…</div>;

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <BellRing className="h-5 w-5 text-orange-500" /> Régua de cobrança
          </h1>
          <p className="text-sm text-muted-foreground">
            Mensagens automáticas no WhatsApp, por template, nos prazos de vencimento. Quando o aluno responde, a assistente assume a conversa.
          </p>
        </div>
        <div className="flex items-end gap-2">
          {unidades.length > 1 && (
            <div>
              <Label className="text-xs">Unidade</Label>
              <select
                className="h-10 w-48 rounded-md border bg-background px-2 text-sm"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                disabled={perfil?.papel !== "master"}
              >
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <Button variant="outline" onClick={carregar} disabled={carregando} title="Atualizar">
            <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {regua && (
        <>
          {/* Liga/desliga + opções */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{regua.ativa ? "Régua ativa" : "Régua desligada"}</p>
                <p className="text-sm text-muted-foreground">
                  {regua.ativa
                    ? `${ativos} passo(s) ativo(s). Os disparos saem automaticamente toda manhã para quem tem parcela nos prazos.`
                    : "Ligue para começar os disparos automáticos."}
                </p>
              </div>
              <Switch checked={regua.ativa} disabled={!podeEditar} onCheckedChange={(v) => setRegua({ ...regua, ativa: v })} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> Envios pela manhã (~09h)</span>
              <label className="flex items-center gap-2">
                <Switch checked={regua.pula_domingo} disabled={!podeEditar} onCheckedChange={(v) => setRegua({ ...regua, pula_domingo: v })} />
                <span className="flex items-center gap-1"><CalendarOff className="h-4 w-4" /> Não enviar aos domingos</span>
              </label>
            </div>
            {regua.ativa && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠️ Com a régua ativa, as mensagens são enviadas de verdade. Requer o WhatsApp desta unidade conectado. Quem já tem boleto ativo ou já pagou não é cobrado.
              </p>
            )}
          </div>

          {/* Passos */}
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">Mensagens por prazo</p>
              <span className="text-xs text-muted-foreground">Variáveis: {VARIAVEIS.join("  ")}</span>
            </div>
            <div className="space-y-4">
              {regua.passos.map((p, i) => {
                const t = tom(p.offset);
                return (
                  <div key={p.offset} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <span className={`h-3 w-3 rounded-full ${t.ponto} ${p.ativo ? "" : "opacity-30"}`} />
                      {i < regua.passos.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                    </div>
                    <div className={`flex-1 rounded-lg border p-3 ${p.ativo ? "" : "opacity-60"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.chip}`}>{rotulo(p.offset)}</span>
                        <Switch checked={p.ativo} disabled={!podeEditar} onCheckedChange={(v) => setPasso(i, { ativo: v })} />
                      </div>
                      <Textarea
                        className="mt-2 min-h-[72px] text-sm"
                        value={p.texto}
                        maxLength={600}
                        disabled={!podeEditar}
                        onChange={(e) => setPasso(i, { texto: e.target.value })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Teste */}
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 font-semibold">Enviar um teste</p>
            <p className="mb-3 text-sm text-muted-foreground">Manda a mensagem do prazo escolhido, com dados de exemplo, para um número seu.</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Prazo</Label>
                <select className="h-10 w-56 rounded-md border bg-background px-2 text-sm" value={offsetTeste} onChange={(e) => setOffsetTeste(Number(e.target.value))}>
                  {regua.passos.map((p) => <option key={p.offset} value={p.offset}>{rotulo(p.offset)}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Seu WhatsApp (com DDD)</Label>
                <Input className="w-44" placeholder="(64) 99999-9999" value={telTeste} onChange={(e) => setTelTeste(e.target.value)} />
              </div>
              <Button variant="secondary" onClick={testar} disabled={testando || !podeEditar}>
                {testando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Enviar teste
              </Button>
            </div>
          </div>

          {/* Últimos disparos */}
          {ultimos.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-2 font-semibold">Últimos disparos</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr><th className="py-1 pr-3">Quando</th><th className="pr-3">Prazo</th><th className="pr-3">Aluno(s)</th><th className="pr-3">Valor</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {ultimos.map((e, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-1 pr-3 whitespace-nowrap">{dataHora(e.enviado_em)}</td>
                        <td className="pr-3 whitespace-nowrap">{rotulo(e.offset_dias)}</td>
                        <td className="pr-3">{e.alunos || "—"}</td>
                        <td className="pr-3 whitespace-nowrap">{reais(e.valor_centavos)}</td>
                        <td className="whitespace-nowrap">
                          <span className={e.status === "enviado" ? "text-emerald-600" : e.status === "erro" ? "text-rose-600" : "text-muted-foreground"}>
                            {statusRotulo[e.status] || e.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {podeEditar && (
            <div className="sticky bottom-0 -mx-4 flex justify-end border-t bg-background/80 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border">
              <Button onClick={salvar} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">
                {salvando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Salvar régua
              </Button>
            </div>
          )}
        </>
      )}
    </div>
    </div>
  );
}
