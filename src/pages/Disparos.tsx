import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Save, Loader2, Lightbulb } from "lucide-react";

type Config = { teto_novas_dia: number; janela_ini: number; janela_fim: number };
type Panorama = { teto: number; janela_ini: number; janela_fim: number; media15: number; sugestao_teto: number; novas_hoje: number; abertas_hoje: number; roladas_futuro: number };

export default function Disparos() {
  const { perfil, unidades } = useAuth();
  const [unidade, setUnidade] = useState(perfil?.papel === "master" ? "rio_verde" : (perfil?.unit_id || "rio_verde"));
  const [config, setConfig] = useState<Config | null>(null);
  const [pano, setPano] = useState<Panorama | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const podeEditar = perfil?.papel === "master" || perfil?.papel === "admin";

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api<{ config: Config; panorama: Panorama }>("faltantes", { acao: "disparos_obter", unit_id: unidade });
      setConfig(r.config); setPano(r.panorama);
    } catch (e: any) { toast.error(e.message); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidade]);

  const salvar = async () => {
    if (!config) return;
    setSalvando(true);
    try {
      const r = await api<{ config: Config }>("faltantes", { acao: "disparos_salvar", unit_id: unidade, config });
      setConfig(r.config); toast.success("Teto de disparos salvo."); carregar();
    } catch (e: any) { toast.error(e.message); }
    finally { setSalvando(false); }
  };

  if (carregando || !config || !pano) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 p-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md"><ShieldCheck className="h-6 w-6" /></span>
            <div>
              <h1 className="font-display text-xl font-bold">Central de Disparos</h1>
              <p className="text-sm text-muted-foreground">Protege o chip de bloqueio: limita conversas novas por dia e espalha os envios.</p>
            </div>
          </div>
          {unidades.length > 1 && (
            <select className="h-10 w-48 rounded-md border bg-background px-2 text-sm" value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={perfil?.papel !== "master"}>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </header>

        {/* Panorama de hoje */}
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Conversas novas hoje</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{pano.novas_hoje}<span className="text-base font-normal text-muted-foreground"> / {pano.teto}</span></p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (pano.novas_hoje / Math.max(1, pano.teto)) * 100)}%` }} />
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Respostas hoje (conversa aberta)</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-700">{pano.abertas_hoje}</p>
            <p className="mt-1 text-xs text-muted-foreground">baixo risco — não contam no teto</p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Roladas pros próximos dias</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{pano.roladas_futuro}</p>
            <p className="mt-1 text-xs text-muted-foreground">excederam o teto e saem depois</p>
          </div>
        </section>

        {/* Baseline / sugestão */}
        <section className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-medium text-amber-900">Base dos últimos 15 dias</p>
            <p className="text-amber-800">Esta unidade iniciou, em média, <b>{pano.media15} conversas novas por dia</b>. Sugestão de teto (com folga): <b>{pano.sugestao_teto}</b>.
              {podeEditar && pano.sugestao_teto !== config.teto_novas_dia && (
                <button className="ml-1 font-semibold text-amber-900 underline" onClick={() => setConfig({ ...config, teto_novas_dia: pano.sugestao_teto })}>usar {pano.sugestao_teto}</button>
              )}
            </p>
          </div>
        </section>

        {/* Config */}
        <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <Label className="text-xs">Teto de conversas novas por dia</Label>
            <Input type="number" min={1} max={500} className="mt-1 h-10 w-40" value={config.teto_novas_dia} disabled={!podeEditar}
              onChange={(e) => setConfig({ ...config, teto_novas_dia: Number(e.target.value) })} />
            <p className="mt-1 text-xs text-muted-foreground">Quantas conversas <b>novas</b> (com quem não te respondeu nas últimas 24h) o chip pode abrir por dia. O que passar rola pros próximos dias. Comece no sugerido e suba aos poucos.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Janela de envio — início</Label>
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm" value={config.janela_ini} disabled={!podeEditar} onChange={(e) => setConfig({ ...config, janela_ini: Number(e.target.value) })}>
                {Array.from({ length: 10 }, (_, i) => i + 5).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Janela de envio — fim</Label>
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm" value={config.janela_fim} disabled={!podeEditar} onChange={(e) => setConfig({ ...config, janela_fim: Number(e.target.value) })}>
                {Array.from({ length: 8 }, (_, i) => i + 16).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
              </select>
            </div>
          </div>
          {podeEditar && (
            <Button onClick={salvar} disabled={salvando}>{salvando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Salvar</Button>
          )}
        </section>

        <p className="text-center text-xs text-muted-foreground">As réguas respeitam este teto automaticamente. Respostas a quem já está conversando não entram no limite.</p>
      </div>
    </div>
  );
}
