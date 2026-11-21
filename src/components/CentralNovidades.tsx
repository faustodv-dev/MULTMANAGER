import { useEffect, useRef, useState } from "react";
import { Bell, Pin, Megaphone, AlertTriangle, Info } from "lucide-react";
import { api, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Nov = {
  id: string; titulo: string; corpo: string; tipo: string; fixado: boolean;
  unit_id: string | null; anexo_url: string | null; criado_em: string; lido: boolean;
};

const TIPO: Record<string, { rot: string; cls: string; icon: typeof Info }> = {
  novidade: { rot: "Novidade", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300", icon: Megaphone },
  aviso: { rot: "Aviso", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", icon: Info },
  importante: { rot: "Importante", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300", icon: AlertTriangle },
};
const dataCurta = (iso: string) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "");

/** Sino de novidades no topo + modal automático para avisos "importante". */
export function CentralNovidades() {
  const [lista, setLista] = useState<Nov[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [modal, setModal] = useState<Nov | null>(null);
  const [aberto, setAberto] = useState(false);
  const [exp, setExp] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const carregar = async () => {
    try {
      const r = await api<{ novidades: Nov[]; nao_lidas: number; modal: Nov | null }>("crm", { acao: "novidades_feed" });
      setLista(r.novidades || []);
      setNaoLidas(r.nao_lidas || 0);
      setModal((m) => m ?? r.modal ?? null);
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    carregar();
    const canal = supabase.channel("novidades-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "novidades" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const marcarLida = async (id: string) => {
    setLista((l) => l.map((n) => (n.id === id ? { ...n, lido: true } : n)));
    setNaoLidas((c) => Math.max(0, c - 1));
    try { await api("crm", { acao: "novidade_marcar_lida", id }); } catch { /* ok */ }
  };
  const marcarTodas = async () => {
    setLista((l) => l.map((n) => ({ ...n, lido: true })));
    setNaoLidas(0);
    try { await api("crm", { acao: "novidade_marcar_todas" }); } catch { /* ok */ }
  };
  const abrirItem = (n: Nov) => { setExp((e) => (e === n.id ? null : n.id)); if (!n.lido) marcarLida(n.id); };
  const fecharModal = async () => { if (modal) await marcarLida(modal.id); setModal(null); };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setAberto((a) => !a)} className="relative grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-muted" title="Novidades">
        <Bell className="h-5 w-5 text-muted-foreground" />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">{naoLidas}</span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-11 z-50 w-[22rem] max-w-[90vw] overflow-hidden rounded-xl border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">Novidades</p>
            {naoLidas > 0 && <button onClick={marcarTodas} className="text-xs text-sky-600 hover:underline">marcar todas como lidas</button>}
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {!lista.length && <p className="p-6 text-center text-sm text-muted-foreground">Nada por aqui ainda.</p>}
            {lista.map((n) => {
              const t = TIPO[n.tipo] || TIPO.novidade;
              const Icon = t.icon;
              return (
                <div key={n.id} className={cn("border-b px-3 py-2.5 transition-colors", !n.lido && "bg-sky-50/50 dark:bg-sky-950/20")}>
                  <button onClick={() => abrirItem(n)} className="flex w-full items-start gap-2 text-left">
                    <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md", t.cls)}><Icon className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {!n.lido && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" />}
                        {n.fixado && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
                        <span className="truncate text-sm font-medium">{n.titulo}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{t.rot} · {dataCurta(n.criado_em)}</span>
                    </span>
                  </button>
                  {exp === n.id && (
                    <div className="mt-2 whitespace-pre-wrap pl-8 text-sm text-muted-foreground">
                      {n.corpo}
                      {n.anexo_url && <a href={n.anexo_url} target="_blank" rel="noreferrer" className="mt-2 block font-medium text-sky-600 hover:underline">📎 Abrir anexo (PDF)</a>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!modal} onOpenChange={(o) => { if (!o) fecharModal(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" /> {modal?.titulo}</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm">{modal?.corpo}</p>
          {modal?.anexo_url && <a href={modal.anexo_url} target="_blank" rel="noreferrer" className="font-medium text-sky-600 hover:underline">📎 Abrir anexo (PDF)</a>}
          <div className="flex justify-end"><Button onClick={fecharModal}>Ciente</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
