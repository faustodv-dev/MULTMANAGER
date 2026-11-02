import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, FileText, Send, UserRound, CheckCircle2, Paperclip } from "lucide-react";
import { api, supabase, urlArquivo, dataHora, telefoneBonito, type Conversa, type Mensagem } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS: Record<Conversa["status"], { rotulo: string; cor: string }> = {
  ia: { rotulo: "Assistente", cor: "bg-blue-100 text-blue-800" },
  aguardando_humano: { rotulo: "Aguardando secretaria", cor: "bg-red-100 text-red-800" },
  humano: { rotulo: "Com a secretaria", cor: "bg-amber-100 text-amber-800" },
  encerrada: { rotulo: "Encerrada", cor: "bg-gray-100 text-gray-700" },
};

type Filtro = "todas" | "aguardando_humano" | "humano" | "ia";
const ehGrupo = (c: any) => String(c?.remote_jid || "").includes("@g.us");

export default function Atendimento() {
  const { perfil } = useAuth();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [tipo, setTipo] = useState<"avulsas" | "grupos">("avulsas");
  const [busca, setBusca] = useState("");
  const [atual, setAtual] = useState<string | null>(null);

  const carregar = async () => {
    const { data } = await supabase.from("conversas").select("*").eq("canal", "whatsapp").order("ultimo_contato", { ascending: false }).limit(300);
    setConversas((data as Conversa[]) ?? []);
  };

  useEffect(() => {
    carregar();
    const canal = supabase
      .channel("atendimento-conversas")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return conversas.filter(
      (c) =>
        (tipo === "grupos" ? ehGrupo(c) : !ehGrupo(c)) &&
        (filtro === "todas" || c.status === filtro) &&
        (!t || [c.nome_contato, c.nome_responsavel, c.telefone].some((v) => String(v || "").toLowerCase().includes(t)))
    );
  }, [conversas, filtro, tipo, busca]);
  const totalGrupos = conversas.filter(ehGrupo).length;

  const conversa = conversas.find((c) => c.id === atual) ?? null;
  const aguardando = conversas.filter((c) => c.status === "aguardando_humano").length;

  return (
    <div className="flex h-full">
      <section className={cn("flex w-full flex-col border-r md:w-96", atual && "hidden md:flex")}>
        <div className="space-y-2 border-b p-3">
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            <button onClick={() => setTipo("avulsas")} className={cn("flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", tipo === "avulsas" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>Conversas</button>
            <button onClick={() => setTipo("grupos")} className={cn("flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", tipo === "grupos" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>Grupos{totalGrupos ? ` (${totalGrupos})` : ""}</button>
          </div>
          <Input placeholder="Buscar nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="flex flex-wrap gap-1">
            {([
              ["todas", "Todas"],
              ["aguardando_humano", `Aguardando (${aguardando})`],
              ["humano", "Secretaria"],
              ["ia", "Assistente"],
            ] as [Filtro, string][]).map(([v, r]) => (
              <Button key={v} size="sm" variant={filtro === v ? "default" : "outline"} onClick={() => setFiltro(v)}>{r}</Button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {lista.map((c) => (
            <button
              key={c.id}
              onClick={() => setAtual(c.id)}
              className={cn("block w-full border-b px-4 py-3 text-left hover:bg-muted", atual === c.id && "bg-muted")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{c.nome_responsavel || c.nome_contato || telefoneBonito(c.telefone)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{dataHora(c.ultimo_contato)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS[c.status].cor)}>{STATUS[c.status].rotulo}</span>
                <span className="truncate text-xs text-muted-foreground">{c.ultima_mensagem}</span>
                {c.nao_lidas > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{c.nao_lidas}</span>}
              </div>
            </button>
          ))}
          {!lista.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa.</p>}
        </div>
      </section>

      <section className={cn("flex-1", !atual && "hidden md:block")}>
        {conversa ? (
          <Chat key={conversa.id} conversa={conversa} meuId={perfil?.id ?? ""} voltar={() => setAtual(null)} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">Selecione uma conversa</div>
        )}
      </section>
    </div>
  );
}

function Chat({ conversa, meuId, voltar }: { conversa: Conversa; meuId: string; voltar: () => void }) {
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase.from("mensagens").select("*").eq("conversa_id", conversa.id).order("criado_em").limit(500);
      setMsgs((data as Mensagem[]) ?? []);
    };
    carregar();
    if (conversa.nao_lidas) supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", conversa.id).then(() => {});
    const canal = supabase
      .channel(`chat-${conversa.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens", filter: `conversa_id=eq.${conversa.id}` }, (p) =>
        setMsgs((m) => [...m, p.new as Mensagem])
      )
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [conversa.id]);

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await api("enviar-mensagem", { conversa_id: conversa.id, texto });
      setTexto("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const mudarStatus = async (status: Conversa["status"]) => {
    const patch: Partial<Conversa> = { status };
    if (status === "humano") patch.atribuido_a = meuId;
    if (status === "ia" || status === "encerrada") { patch.motivo_humano = null; patch.atribuido_a = null; }
    const { error } = await supabase.from("conversas").update(patch).eq("id", conversa.id);
    if (error) return toast.error(error.message);
    if (status !== "humano") {
      await supabase.from("pendencias").update({ resolvido_em: new Date().toISOString(), resolvido_por: meuId })
        .eq("conversa_id", conversa.id).eq("tipo", "atendimento").is("resolvido_em", null);
    }
    toast.success(status === "ia" ? "Conversa devolvida para a assistente" : status === "humano" ? "Você assumiu a conversa" : "Conversa encerrada");
  };

  const abrir = async (path: string) => {
    const u = await urlArquivo(path);
    if (u) window.open(u, "_blank", "noopener"); else toast.error("Não foi possível abrir o arquivo.");
  };

  const alunos: { nome: string; cod_alu: string }[] = conversa.contexto?.grupo?.alunos ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="sm" className="md:hidden" onClick={voltar}>←</Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{conversa.nome_responsavel || conversa.nome_contato || "Contato"}</p>
          <p className="text-xs text-muted-foreground">
            {telefoneBonito(conversa.telefone)}
            {conversa.identidade_confirmada ? " · identidade confirmada" : " · não identificado"}
            {alunos.length ? ` · alunos: ${alunos.map((a) => `${a.nome} (${a.cod_alu})`).join(", ")}` : ""}
          </p>
          {conversa.motivo_humano && conversa.status !== "ia" && (
            <p className="mt-1 text-xs text-destructive">Motivo: {conversa.motivo_humano}</p>
          )}
        </div>
        <Badge className={cn("border-0", STATUS[conversa.status].cor)}>{STATUS[conversa.status].rotulo}</Badge>
        {conversa.status !== "humano" && <Button size="sm" variant="outline" onClick={() => mudarStatus("humano")}><UserRound className="mr-1 h-4 w-4" />Assumir</Button>}
        {conversa.status !== "ia" && <Button size="sm" variant="outline" onClick={() => mudarStatus("ia")}><Bot className="mr-1 h-4 w-4" />Devolver à assistente</Button>}
        {conversa.status !== "encerrada" && <Button size="sm" variant="outline" onClick={() => mudarStatus("encerrada")}><CheckCircle2 className="mr-1 h-4 w-4" />Encerrar</Button>}
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto bg-muted/40 p-4">
        {msgs.map((m) => (
          <div key={m.id} className={cn("flex", m.direcao === "out" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm",
                m.direcao === "in" ? "bg-card" : m.autor === "ia" ? "bg-blue-50 dark:bg-blue-950" : "bg-amber-50 dark:bg-amber-950"
              )}
            >
              {m.midia_path && (
                <button onClick={() => abrir(m.midia_path!)} className="mb-1 flex items-center gap-1 text-primary underline">
                  {m.midia_tipo?.includes("pdf") ? <FileText className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
                  {m.midia_nome || "arquivo"}
                </button>
              )}
              {m.texto}
              <div className="mt-1 text-right text-[10px] text-muted-foreground">
                {m.autor === "ia" ? "Assistente · " : m.autor === "humano" ? "Secretaria · " : ""}
                {dataHora(m.criado_em)}
                {m.status_envio?.startsWith("erro") && <span className="text-destructive"> · não enviada</span>}
              </div>
            </div>
          </div>
        ))}
        <div ref={fim} />
      </div>

      <footer className="flex gap-2 border-t p-3">
        <Textarea
          rows={2}
          placeholder="Responder como secretaria (a assistente pausa nesta conversa)"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
        />
        <Button onClick={enviar} disabled={enviando || !texto.trim()} className="self-end"><Send className="h-4 w-4" /></Button>
      </footer>
    </div>
  );
}
