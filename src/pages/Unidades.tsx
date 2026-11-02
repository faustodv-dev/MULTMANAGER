import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase, type Unidade } from "@/lib/supabase";
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

  useEffect(() => { setEdicao({}); }, [unidades]);

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
