import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Download, KeyRound, Smartphone, Loader2, CheckCircle2 } from "lucide-react";
import { api, supabase, type Unidade } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Unidades() {
  const { unidades, recarregar, perfil } = useAuth();
  const [edicao, setEdicao] = useState<Record<string, Partial<Unidade>>>({});
  const [status, setStatus] = useState<any>(null);
  const [novo, setNovo] = useState({ id: "", name: "" });
  const [comercial, setComercial] = useState<any[] | null>(null);
  const [criando, setCriando] = useState(false);

  useEffect(() => { setEdicao({}); }, [unidades]);

  const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const criarUnidade = async (id: string, name: string) => {
    if (!id.trim() || !name.trim()) return toast.error("Informe código e nome.");
    setCriando(true);
    try {
      const r = await api<any>("crm", { acao: "unidade_criar", id, name });
      if (!r.ok) return toast.error(r.mensagem || r.erro);
      toast.success(`Unidade criada (${r.pops_clonados} POPs clonados). Configure as chaves nas integrações.`);
      setNovo({ id: "", name: "" });
      recarregar();
    } catch (e: any) { toast.error(e.message); } finally { setCriando(false); }
  };
  const importarComercial = async () => {
    try { const r = await api<any>("crm", { acao: "unidades_comercial" }); setComercial(r.unidades); }
    catch (e: any) { toast.error(e.message); }
  };

  const campo = (u: Unidade, k: keyof Unidade) => (edicao[u.id]?.[k] ?? u[k]) as any;
  const mudar = (u: Unidade, k: keyof Unidade, v: any) => setEdicao({ ...edicao, [u.id]: { ...edicao[u.id], [k]: v } });

  const salvar = async (u: Unidade) => {
    const { error } = await supabase.from("units").update(edicao[u.id] || {}).eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success("Unidade salva");
    recarregar();
  };

  const [diagUnidade, setDiagUnidade] = useState("");
  const diagnostico = async (uid?: string) => {
    const alvo = uid || diagUnidade || unidades[0]?.id || "rio_verde";
    const { data } = await supabase.auth.getSession();
    const r = await fetch(`/api/status?unidade=${alvo}`, { headers: { Authorization: `Bearer ${data.session?.access_token}` } });
    setStatus({ unidade_testada: alvo, ...(await r.json()) });
  };

  return (
    <div className="h-full space-y-4 overflow-auto p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Unidades</h1>
        {perfil?.papel === "master" && (
          <div className="flex items-end gap-2">
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={diagUnidade} onChange={(e) => setDiagUnidade(e.target.value)}>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <Button variant="outline" onClick={() => diagnostico()}>Diagnóstico das integrações</Button>
          </div>
        )}
      </div>
      {status && <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(status, null, 2)}</pre>}

      {perfil?.papel === "master" && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <p className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" />Nova unidade</p>
          <p className="text-xs text-muted-foreground">Ao criar, nasce um CRM próprio filtrado pelo código (unit_id) com o catálogo de POPs da Rio Verde clonado. O <b>código</b> precisa ser o mesmo da ponte do sistema escolar (ex.: <code>rio_verde</code>).</p>
          <div className="flex flex-wrap items-end gap-2">
            <div><Label className="text-xs">Código (ponte)</Label><Input className="w-40" placeholder="ex.: aparecida" value={novo.id} onChange={(e) => setNovo({ ...novo, id: slug(e.target.value) })} /></div>
            <div className="flex-1"><Label className="text-xs">Nome</Label><Input placeholder="ex.: Aparecida de Goiânia" value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} /></div>
            <Button onClick={() => criarUnidade(novo.id, novo.name)} disabled={criando}>Criar</Button>
            <Button variant="outline" onClick={importarComercial}><Download className="mr-1 h-4 w-4" />Importar do CRM comercial</Button>
          </div>
          {comercial && (
            <div className="space-y-1 border-t pt-2">
              <p className="text-xs text-muted-foreground">Unidades do CRM comercial (confira o código da ponte antes de criar):</p>
              {comercial.map((c) => {
                const ja = unidades.some((u) => u.id === c.slug);
                return (
                  <div key={c.slug} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{c.name} <span className="text-muted-foreground">({c.slug})</span></span>
                    {ja ? <span className="text-xs text-muted-foreground">já existe</span>
                      : <Button size="sm" variant="ghost" onClick={() => setNovo({ id: c.slug, name: c.name })}>Usar</Button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {unidades.map((u) => (
        <div key={u.id} className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{u.name} <span className="text-xs text-muted-foreground">({u.id})</span></p>
              <p className="text-xs text-muted-foreground">WhatsApp: {u.whatsapp_status || "—"} {u.whatsapp_number ? `· ${u.whatsapp_number}` : ""}</p>
            </div>
            <Button size="sm" onClick={() => salvar(u)} disabled={!edicao[u.id]}>Salvar</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span><span className="block text-sm font-medium">Assistente respondendo</span><span className="text-xs text-muted-foreground">Desligado: todas as conversas ficam com a secretaria.</span></span>
              <Switch checked={campo(u, "agente_ativo")} onCheckedChange={(v) => mudar(u, "agente_ativo", v)} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span><span className="block text-sm font-medium">Baixa automática</span><span className="text-xs text-muted-foreground">Desligado = modo sombra. Só baixa Pix conferido no extrato do Asaas.</span></span>
              <Switch checked={campo(u, "baixa_automatica")} onCheckedChange={(v) => mudar(u, "baixa_automatica", v)} disabled={perfil?.papel !== "master"} />
            </label>
            <div><Label>Chave Pix (aparece no carnê e nas respostas)</Label><Input value={campo(u, "pix_chave") || ""} onChange={(e) => mudar(u, "pix_chave", e.target.value)} /></div>
            <div><Label>Nome do recebedor</Label><Input value={campo(u, "recebedor_nome") || ""} onChange={(e) => mudar(u, "recebedor_nome", e.target.value)} /></div>
            <div><Label>CNPJ do recebedor (só números)</Label><Input value={campo(u, "recebedor_documento") || ""} onChange={(e) => mudar(u, "recebedor_documento", e.target.value.replace(/\D/g, ""))} /></div>
            <div><Label>Horário/contato da secretaria (a assistente informa)</Label><Textarea rows={2} value={campo(u, "atendimento_humano") || ""} onChange={(e) => mudar(u, "atendimento_humano", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Regras do agente de IA desta unidade</Label><Textarea rows={3} placeholder="Ex.: tom de voz, o que pode/não pode oferecer, informações próprias desta unidade…" value={campo(u, "instrucoes_agente") || ""} onChange={(e) => mudar(u, "instrucoes_agente", e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">Cada unidade define suas próprias regras — a assistente as segue nesta unidade.</p></div>
          </div>
          <ChavesUnidade unitId={u.id} />
        </div>
      ))}
    </div>
  );
}

/** Chaves/integrações da unidade: status das chaves e do WhatsApp, atualização e conexão (QR). */
function ChavesUnidade({ unitId }: { unitId: string }) {
  const [aberto, setAberto] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [wa, setWa] = useState<any>(null);
  const [qrAberto, setQrAberto] = useState(false);
  const [vals, setVals] = useState<any>({ asaas: "", gemini: "", groq: "" });
  const [busy, setBusy] = useState(false);
  const [diag, setDiag] = useState<any>(null);
  const [diagBusy, setDiagBusy] = useState(false);

  const testar = async () => {
    setDiagBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch(`/api/status?unidade=${unitId}`, { headers: { Authorization: `Bearer ${data.session?.access_token}` } });
      setDiag(await r.json());
    } catch (e: any) { toast.error(e.message); } finally { setDiagBusy(false); }
  };

  const carregar = async () => {
    try { const r = await api<any>("crm", { acao: "segredos_status", unidade: unitId }); setStatus(r.status); }
    catch (e: any) { toast.error(e.message); }
    try { const w = await api<any>("crm", { acao: "whatsapp_status", unidade: unitId }); setWa(w); }
    catch { setWa({ status: "indisponivel" }); }
  };
  const abrir = () => { setAberto(!aberto); if (!status) carregar(); };
  const waConectado = wa?.status === "connected";
  const salvar = async (extra: any = {}) => {
    setBusy(true);
    try {
      const r = await api<any>("crm", { acao: "segredos_salvar", unidade: unitId, ...vals, ...extra });
      if (!r.ok) return toast.error(r.mensagem || r.erro);
      toast.success("Chaves atualizadas.");
      setVals({ asaas: "", gemini: "", groq: "" }); carregar();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const Bolinha = ({ ok }: { ok: boolean }) => <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-slate-300"}`} />;

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <button onClick={abrir} className="flex w-full items-center gap-2 text-sm font-medium">
        <KeyRound className="h-4 w-4" />Chaves &amp; integrações
        {status && <span className="ml-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Bolinha ok={status.asaas} />Asaas <Bolinha ok={status.gemini} />Gemini <Bolinha ok={status.groq} />Groq
          {wa && <><Bolinha ok={waConectado} />WhatsApp</>}
        </span>}
        <span className="ml-auto text-xs text-muted-foreground">{aberto ? "ocultar" : "editar"}</span>
      </button>
      {aberto && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">As chaves ficam guardadas em segurança e nunca são exibidas. Preencha só o que quiser trocar.</p>
          <div className="grid gap-2 md:grid-cols-3">
            <div><Label className="text-xs">Chave Asaas {status?.asaas ? "✓" : ""}</Label><Input type="password" placeholder="$aact_..." value={vals.asaas} onChange={(e) => setVals({ ...vals, asaas: e.target.value })} /></div>
            <div><Label className="text-xs">Chave Gemini {status?.gemini ? "✓" : ""}</Label><Input type="password" placeholder="AIza..." value={vals.gemini} onChange={(e) => setVals({ ...vals, gemini: e.target.value })} /></div>
            <div><Label className="text-xs">Chave Groq {status?.groq ? "✓" : ""}</Label><Input type="password" placeholder="gsk_..." value={vals.groq} onChange={(e) => setVals({ ...vals, groq: e.target.value })} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => salvar()} disabled={busy || (!vals.asaas && !vals.gemini && !vals.groq)}>Salvar chaves</Button>
            {unitId !== "rio_verde" && (
              <Button size="sm" variant="outline" onClick={() => salvar({ copiar_asaas_de: "rio_verde" })} disabled={busy}>Usar Asaas da Rio Verde</Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            <span className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${waConectado ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"}`}>
              <span className={`h-2 w-2 rounded-full ${waConectado ? "bg-green-500" : "bg-red-500"}`} />
              WhatsApp {waConectado ? `conectado${wa?.phone ? ` · ${wa.phone}` : ""}` : "desconectado"}
            </span>
            <Button size="sm" variant="outline" onClick={() => setQrAberto(true)}><Smartphone className="mr-1 h-4 w-4" />Conectar WhatsApp</Button>
            <Button size="sm" variant="outline" onClick={testar} disabled={diagBusy}>{diagBusy ? "Testando…" : "Testar integrações"}</Button>
          </div>
          {diag && (
            <div className="space-y-1 rounded-md border bg-muted/40 p-2 text-xs">
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                <span>Banco escolar (ponte): <b className={diag.ponte?.banco ? "text-green-600" : "text-red-600"}>{diag.ponte?.banco ? "conectado" : (diag.ponte?.erro || "erro")}</b></span>
                <span>Gateway: <b className={diag.gateway?.http === 200 ? "text-green-600" : "text-red-600"}>{diag.gateway?.http || diag.gateway?.erro || "—"}</b></span>
                <span>Asaas: <b className={diag.config?.asaas_chave_unidade ? "text-green-600" : "text-amber-600"}>{diag.config?.asaas_chave_unidade ? "ok" : "sem chave"}</b></span>
              </div>
              {diag.ponte?.erro === "unidade_desconhecida" && <p className="text-amber-700">A ponte ainda não conhece <b>{unitId}</b> — confira o bloco no <code>config.php</code>.</p>}
            </div>
          )}
        </div>
      )}
      {qrAberto && <QrDialog unitId={unitId} aoFechar={() => { setQrAberto(false); carregar(); }} />}
    </div>
  );
}

/** Diálogo de conexão do WhatsApp: gera o QR só ao abrir e atualiza até conectar. */
function QrDialog({ unitId, aoFechar }: { unitId: string; aoFechar: () => void }) {
  const [estado, setEstado] = useState<any>({ status: "preparando" });
  const [erro, setErro] = useState("");

  const puxar = async () => {
    try { const r = await api<any>("crm", { acao: "whatsapp_qr", unidade: unitId }); setEstado(r); setErro(""); }
    catch (e: any) { setErro(e.message); }
  };
  useEffect(() => {
    puxar();
    const t = setInterval(() => { setEstado((s: any) => { if (s.status !== "connected") puxar(); return s; }); }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [unitId]);

  return (
    <Dialog open onOpenChange={aoFechar}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader><DialogTitle>Conectar WhatsApp</DialogTitle></DialogHeader>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {estado.status === "connected" ? (
          <div className="py-6">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-2 font-semibold">WhatsApp conectado!</p>
            {estado.phone && <p className="text-sm text-muted-foreground">{estado.phone}</p>}
          </div>
        ) : estado.status === "qr_ready" && estado.qr ? (
          <div className="py-2">
            <p className="mb-2 text-sm text-muted-foreground">No WhatsApp da unidade: <b>Aparelhos conectados → Conectar um aparelho</b> e aponte para o QR.</p>
            <img src={estado.qr} alt="QR" className="mx-auto h-60 w-60 rounded-lg border bg-white p-2" />
            <p className="mt-2 text-xs text-muted-foreground">Atualiza sozinho a cada 8s.</p>
          </div>
        ) : (
          <div className="py-10"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">Preparando conexão…</p></div>
        )}
      </DialogContent>
    </Dialog>
  );
}
