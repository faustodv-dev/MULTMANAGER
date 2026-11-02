import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Download } from "lucide-react";
import { api, supabase, type Unidade } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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

  const diagnostico = async () => {
    const { data } = await supabase.auth.getSession();
    const r = await fetch(`/api/status?unidade=${unidades[0]?.id || "rio_verde"}`, { headers: { Authorization: `Bearer ${data.session?.access_token}` } });
    setStatus(await r.json());
  };

  return (
    <div className="h-full space-y-4 overflow-auto p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Unidades</h1>
        {perfil?.papel === "master" && <Button variant="outline" onClick={diagnostico}>Diagnóstico das integrações</Button>}
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
          </div>
        </div>
      ))}
    </div>
  );
}
