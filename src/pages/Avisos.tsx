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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BellPlus, Save, Loader2, Users, Lock, Send, History, Megaphone, Clock } from "lucide-react";

type Aviso = { ativa: boolean; horario: number; pula_domingo: boolean; alvo: string; texto: string };
type Amostra = { aluno: string; curso: string; turma: string; dia_semana: string; horario: string; para_aluno: boolean };
type Previa = { data: string; alvo: string; total_com_aula: number; total_alvo: number; amostra: Amostra[] };
type Fila = { categoria: string | null; telefone: string | null; alunos: string | null; status: string; agendado_para: string | null; enviado_em: string | null; enfileirado_em: string; erro: string | null };

const STATUS_ROTULO: Record<string, string> = { pendente: "Na fila", enviando: "Enviando", enviado: "Enviado", erro: "Erro", cancelado: "Cancelado" };
const STATUS_TOM: Record<string, string> = { enviado: "text-emerald-700", erro: "text-rose-700", enviando: "text-sky-700", pendente: "text-muted-foreground", cancelado: "text-muted-foreground" };
const quando = (f: Fila) => (f.enviado_em || f.agendado_para || f.enfileirado_em || "").replace("T", " ").slice(0, 16);
// Parseia a lista colada (uma linha por pessoa: "Nome, telefone" ou "Nome telefone").
const parseLista = (txt: string): { nome: string; telefone: string }[] =>
  txt.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const partes = l.split(/[,;\t]+/);
    let nome = "", tel = "";
    if (partes.length >= 2) { tel = partes[partes.length - 1].trim(); nome = partes.slice(0, -1).join(" ").trim(); }
    else { const m = l.match(/(\d[\d\s()+-]{8,})\s*$/); tel = m ? m[1].trim() : ""; nome = m ? l.slice(0, l.length - m[1].length).trim() : l; }
    return { nome, telefone: tel };
  }).filter((x) => x.telefone.replace(/\D/g, "").length >= 10);

const ALVOS: { id: string; rotulo: string; desc: string; master?: boolean }[] = [
  { id: "risco1", rotulo: "Risco 1", desc: "card de evasão nível 1" },
  { id: "risco2", rotulo: "Risco 2", desc: "card de evasão nível 2" },
  { id: "risco12", rotulo: "Risco 1 e 2", desc: "qualquer card de evasão" },
  { id: "todos", rotulo: "Todos com aula", desc: "só o master pode ligar", master: true },
];
const amanhaISO = () => {
  const d = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()) + "T12:00:00-03:00");
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
};
const diaBr = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");

export default function Avisos() {
  const { perfil, unidades } = useAuth();
  const [unidade, setUnidade] = useState(perfil?.papel === "master" ? "rio_verde" : (perfil?.unit_id || "rio_verde"));
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [podeTodos, setPodeTodos] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [data, setData] = useState(amanhaISO());
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [calc, setCalc] = useState(false);
  const [enfileirando, setEnfileirando] = useState(false);
  const [ultimos, setUltimos] = useState<Fila[]>([]);
  const [bcLista, setBcLista] = useState("");
  const [bcTexto, setBcTexto] = useState("");
  const [bcEnviando, setBcEnviando] = useState(false);

  const podeEditar = perfil?.papel === "master" || perfil?.papel === "admin";

  const carregar = async () => {
    setCarregando(true);
    setPrevia(null);
    try {
      const r = await api<{ aviso: Aviso; pode_todos: boolean; ultimos: Fila[] }>("faltantes", { acao: "aviso_obter", unit_id: unidade });
      setAviso(r.aviso);
      setPodeTodos(r.pode_todos);
      setUltimos(r.ultimos || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidade]);

  const salvar = async () => {
    if (!aviso) return;
    setSalvando(true);
    try {
      const r = await api<{ aviso: Aviso }>("faltantes", { acao: "aviso_salvar", unit_id: unidade, aviso });
      setAviso(r.aviso);
      toast.success("Régua de avisos salva.");
    } catch (e: any) { toast.error(e.message); }
    finally { setSalvando(false); }
  };

  const verPrevia = async () => {
    setCalc(true);
    try {
      const r = await api<{ previa: Previa }>("faltantes", { acao: "aviso_previa", unit_id: unidade, data });
      setPrevia(r.previa);
    } catch (e: any) { toast.error(e.message); }
    finally { setCalc(false); }
  };

  const enfileirarAgora = async () => {
    setEnfileirando(true);
    try {
      const r = await api<{ resumo: { enfileiradas: number; data: string } }>("faltantes", { acao: "aviso_rodar", unit_id: unidade, data });
      toast.success(`${r.resumo.enfileiradas} lembrete(s) enfileirado(s) para ${diaBr(r.resumo.data)}.`);
      carregar();
    } catch (e: any) { toast.error(e.message); }
    finally { setEnfileirando(false); }
  };

  const enviarBroadcast = async () => {
    const lista = parseLista(bcLista);
    setBcEnviando(true);
    try {
      const r = await api<{ enfileiradas: number; descartados: number }>("faltantes", { acao: "aviso_broadcast", unit_id: unidade, texto: bcTexto, lista });
      toast.success(`${r.enfileiradas} enviado(s).${r.descartados ? ` ${r.descartados} descartado(s).` : ""}`);
      setBcLista(""); setBcTexto("");
      carregar();
    } catch (e: any) { toast.error(e.message); }
    finally { setBcEnviando(false); }
  };

  if (carregando || !aviso) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-3xl space-y-5 p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md"><BellPlus className="h-6 w-6" /></span>
          <div>
            <h1 className="text-xl font-bold">Régua de Avisos</h1>
            <p className="text-sm text-muted-foreground">Lembrete de aula na véspera — contato positivo, sem cobrança.</p>
          </div>
        </div>
        {unidades.length > 1 && (
          <select className="h-10 w-48 rounded-md border bg-background px-2 text-sm" value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={perfil?.papel !== "master"}>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </header>

      <Tabs defaultValue="auto">
        <TabsList>
          <TabsTrigger value="auto"><Clock className="mr-1 h-4 w-4" /> Automática</TabsTrigger>
          {podeEditar && <TabsTrigger value="manual"><Megaphone className="mr-1 h-4 w-4" /> Disparo manual</TabsTrigger>}
        </TabsList>

        {/* ---------- AUTOMÁTICA: lembrete de aula na véspera ---------- */}
        <TabsContent value="auto" className="space-y-5">
      {/* Configuração */}
      <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Lembrete automático {aviso.ativa ? <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">ligado</span> : <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">desligado</span>}</p>
            <p className="text-xs text-muted-foreground">Na véspera, avisa quem tem aula no dia seguinte.</p>
          </div>
          <Switch checked={aviso.ativa} disabled={!podeEditar} onCheckedChange={(v) => setAviso({ ...aviso, ativa: v })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Horário de envio (véspera)</Label>
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm" value={aviso.horario} disabled={!podeEditar} onChange={(e) => setAviso({ ...aviso, horario: Number(e.target.value) })}>
              {Array.from({ length: 15 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Switch checked={aviso.pula_domingo} disabled={!podeEditar} onCheckedChange={(v) => setAviso({ ...aviso, pula_domingo: v })} />
            <Label className="text-xs">Não disparar no domingo</Label>
          </div>
        </div>

        <div>
          <Label className="text-xs">Enviar para</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {ALVOS.map((a) => {
              const travado = a.master && !podeTodos;
              const on = aviso.alvo === a.id;
              return (
                <button key={a.id} type="button" disabled={!podeEditar || travado}
                  title={travado ? "Só o administrador master pode ligar" : a.desc}
                  onClick={() => setAviso({ ...aviso, alvo: a.id })}
                  className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    on ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "bg-background text-muted-foreground hover:bg-muted",
                    (!podeEditar || travado) && "cursor-not-allowed opacity-60")}>
                  {a.master && <Lock className="mr-1 inline h-3 w-3" />}{a.rotulo}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">"Todos" fica travado por padrão (volume alto) — só o master liga, em qualquer unidade.</p>
        </div>

        <div>
          <Label className="text-xs">Mensagem</Label>
          <Textarea className="mt-1 min-h-[96px] text-sm" value={aviso.texto} maxLength={1000} disabled={!podeEditar}
            onChange={(e) => setAviso({ ...aviso, texto: e.target.value })} />
          <p className="mt-1 text-xs text-muted-foreground">
            Variáveis: <code>{"{aluno}"}</code> <code>{"{curso}"}</code> <code>{"{dia_semana}"}</code> <code>{"{horario}"}</code> <code>{"{turma}"}</code> · usa o dia da semana (ex.: "sexta"), não "amanhã".
          </p>
        </div>

        {podeEditar && (
          <Button onClick={salvar} disabled={salvando}>{salvando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Salvar</Button>
        )}
      </section>

      {/* Prévia (sem envio) */}
      <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <p className="font-semibold">Prévia — quem receberia</p>
          <p className="text-xs text-muted-foreground">Mostra quem tem aula na data e entraria pelo alvo escolhido. <b>Nenhuma mensagem é enviada.</b></p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Data da aula</Label>
            <Input type="date" className="mt-1 h-10 w-44" value={data} onChange={(e) => { setData(e.target.value); setPrevia(null); }} />
          </div>
          <Button variant="secondary" onClick={verPrevia} disabled={calc}>{calc ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Users className="mr-1 h-4 w-4" />} Ver prévia</Button>
        </div>

        {previa && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Têm aula em {diaBr(previa.data)}</p>
                <p className="text-2xl font-bold tabular-nums">{previa.total_com_aula}</p>
              </div>
              <div className="rounded-lg border bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Receberiam (alvo: {previa.alvo})</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-700">{previa.total_alvo}</p>
              </div>
            </div>
            {previa.amostra.length > 0 ? (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Aluno</th><th className="px-3 py-2 text-left">Curso</th><th className="px-3 py-2 text-left">Turma</th><th className="px-3 py-2 text-left">Horário</th><th className="px-3 py-2 text-left">Vai p/</th></tr>
                  </thead>
                  <tbody>
                    {previa.amostra.map((a, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5">{a.aluno}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{a.curso}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{a.turma}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{a.dia_semana} {a.horario}</td>
                        <td className="px-3 py-1.5">{a.para_aluno ? <span className="text-emerald-700">aluno</span> : <span className="text-amber-700">responsável</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previa.total_alvo > previa.amostra.length && <p className="bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">… e mais {previa.total_alvo - previa.amostra.length} (amostra dos primeiros {previa.amostra.length}).</p>}
              </div>
            ) : (
              <p className="rounded-lg border bg-background py-6 text-center text-sm text-muted-foreground">Ninguém entraria com esse alvo nessa data.</p>
            )}

            {podeEditar && previa.total_alvo > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={enfileirando}>
                    {enfileirando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Enfileirar agora (teste)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Enviar o lembrete de verdade?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Vai enfileirar o lembrete para <b>{previa.total_alvo}</b> aluno(s) com aula em {diaBr(previa.data)} (alvo: {previa.alvo}). As mensagens saem pelo WhatsApp no horário configurado ({String(aviso.horario).padStart(2, "0")}:00) — se o horário já passou, saem em seguida. Confirmar?
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
        </TabsContent>

        {/* ---------- DISPARO MANUAL: lista colada (palestra / aviso geral) ---------- */}
        {podeEditar && (
        <TabsContent value="manual" className="space-y-5">
        <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <p className="flex items-center gap-2 font-semibold"><Megaphone className="h-4 w-4 text-violet-600" /> Disparo por lista (palestra / aviso geral)</p>
            <p className="text-xs text-muted-foreground">Cole <b>nome, telefone</b> (um por linha) e a mensagem. <b>Não consulta o sistema</b> — só dispara pela fila. Variável: <code>{"{nome}"}</code>. Até 300 por disparo.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Lista (nome, telefone — um por linha)</Label>
              <Textarea className="mt-1 min-h-[130px] font-mono text-xs" placeholder={"Maria Silva, (64) 99999-0000\nJoão Souza, 64988887777"} value={bcLista} onChange={(e) => setBcLista(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea className="mt-1 min-h-[130px] text-sm" maxLength={1000} placeholder={"Oi, {nome}! Convite especial: ..."} value={bcTexto} onChange={(e) => setBcTexto(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="bg-violet-600 hover:bg-violet-700" disabled={bcEnviando || !bcTexto.trim() || parseLista(bcLista).length === 0}>
                  {bcEnviando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Megaphone className="mr-1 h-4 w-4" />} Enviar para a lista
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disparar para a lista?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Vai enviar para <b>{parseLista(bcLista).length}</b> telefone(s) válido(s). As mensagens saem pelo WhatsApp em seguida. Confirmar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={enviarBroadcast}>Enviar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <span className="text-xs text-muted-foreground">{parseLista(bcLista).length} válido(s)</span>
          </div>
        </section>
        </TabsContent>
        )}
      </Tabs>

      {/* Últimos envios (persiste ao atualizar a página) — comum às duas abas */}
      <section className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
        <p className="flex items-center gap-2 font-semibold"><History className="h-4 w-4 text-muted-foreground" /> Últimos envios</p>
        {ultimos.length ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr><th className="px-3 py-2 text-left">Para</th><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Quando</th></tr>
              </thead>
              <tbody>
                {ultimos.map((u, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5">{u.alunos || u.telefone}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{u.categoria === "broadcast" ? "lista" : "lembrete"}</td>
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
