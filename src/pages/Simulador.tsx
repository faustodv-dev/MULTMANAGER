import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Paperclip, RotateCcw, Send, FileText } from "lucide-react";
import { api, supabase, urlArquivo, dataHora, type Mensagem } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Acao { id: number; tipo: string; acao: string; ok: boolean; duracao_ms: number | null; detalhe: any; criado_em: string }

const paraBase64 = (f: File) =>
  new Promise<string>((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] || "");
    r.onerror = erro;
    r.readAsDataURL(f);
  });

export default function Simulador() {
  const { perfil, unidades } = useAuth();
  const [unidade, setUnidade] = useState(perfil?.unit_id || unidades[0]?.id || "rio_verde");
  const [telefone, setTelefone] = useState("");
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const fim = useRef<HTMLDivElement>(null);

  const fone = () => {
    const d = telefone.replace(/\D/g, "");
    return d.startsWith("55") ? d : `55${d}`;
  };

  const carregar = async (id: string | null = conversaId) => {
    if (!id) {
      const { data } = await supabase.from("conversas").select("id").eq("unit_id", unidade).eq("telefone", fone()).eq("canal", "simulador").maybeSingle();
      id = data?.id ?? null;
      setConversaId(id);
    }
    if (!id) { setMsgs([]); setAcoes([]); return; }
    const { data: m } = await supabase.from("mensagens").select("*").eq("conversa_id", id).order("criado_em").limit(300);
    setMsgs((m as Mensagem[]) ?? []);
    const { data: a } = await supabase.from("registro_acoes").select("*").eq("conversa_id", id).order("id", { ascending: false }).limit(30);
    setAcoes((a as Acao[]) ?? []);
  };

  useEffect(() => { setConversaId(null); setMsgs([]); setAcoes([]); }, [telefone, unidade]);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const enviar = async (arquivo?: File) => {
    if (fone().length < 12) return toast.error("Informe um telefone com DDD.");
    if (!texto.trim() && !arquivo) return;
    setEnviando(true);
    const corpo: any = { unit_id: unidade, telefone: fone(), texto };
    if (arquivo) {
      if (arquivo.size > 3 * 1024 * 1024) { setEnviando(false); return toast.error("Arquivo acima de 3 MB."); }
      corpo.arquivo = { base64: await paraBase64(arquivo), nome: arquivo.name, mime: arquivo.type || "image/jpeg" };
    }
    // Mostra a mensagem enquanto a assistente pensa
    setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, conversa_id: "", direcao: "in", autor: "contato", texto: texto || null, midia_path: null, midia_tipo: arquivo?.type ?? null, midia_nome: arquivo?.name ?? null, status_envio: null, criado_em: new Date().toISOString() }]);
    setTexto("");
    try {
      const r = await api<{ status: string; conversa_id: string }>("simular", corpo);
      setConversaId(r.conversa_id);
      await carregar(r.conversa_id);
      if (!["respondido", "arquivo_processado"].includes(r.status)) toast.info(`Situação: ${r.status}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = async () => {
    if (fone().length < 12) return;
    await api("simular", { unit_id: unidade, telefone: fone(), reiniciar: true });
    setConversaId(null); setMsgs([]); setAcoes([]);
    toast.success("Conversa de teste apagada");
  };

  const abrir = async (path: string) => {
    const u = await urlArquivo(path);
    if (u) window.open(u, "_blank", "noopener");
  };

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-end gap-3 border-b p-4">
          <div className="mr-auto">
            <h1 className="flex items-center gap-2 text-xl font-bold"><FlaskConical className="h-5 w-5" />Simulador da assistente</h1>
            <p className="text-xs text-muted-foreground">Dados reais do sistema escolar. Nada é enviado pelo WhatsApp nem gravado no sistema.</p>
          </div>
          {perfil?.papel === "master" && unidades.length > 1 && (
            <div>
              <Label className="text-xs">Unidade</Label>
              <select className="h-10 rounded-md border bg-background px-2 text-sm" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label className="text-xs">Telefone do "aluno" (com DDD)</Label>
            <Input placeholder="(64) 99999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} onBlur={() => fone().length >= 12 && carregar(null)} />
          </div>
          <Button variant="outline" onClick={reiniciar} disabled={fone().length < 12}><RotateCcw className="mr-1 h-4 w-4" />Reiniciar</Button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto bg-muted/40 p-4">
          {!msgs.length && (
            <p className="mx-auto max-w-md pt-10 text-center text-sm text-muted-foreground">
              Use o telefone de um aluno ou responsável cadastrado para testar a identificação, ou um número qualquer para testar o pedido de CPF.
              Você também pode anexar uma foto ou PDF de comprovante.
            </p>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={cn("flex", m.direcao === "in" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm", m.direcao === "in" ? "bg-green-100 dark:bg-green-950" : "bg-card")}>
                {m.midia_nome && (
                  <button onClick={() => m.midia_path && abrir(m.midia_path)} className="mb-1 flex items-center gap-1 text-primary underline">
                    <FileText className="h-4 w-4" />{m.midia_nome}
                  </button>
                )}
                {m.texto}
                <div className="mt-1 text-right text-[10px] text-muted-foreground">
                  {m.direcao === "in" ? "Você (aluno)" : "Assistente"} · {dataHora(m.criado_em)}
                </div>
              </div>
            </div>
          ))}
          {enviando && <p className="text-xs text-muted-foreground">A assistente está respondendo…</p>}
          <div ref={fim} />
        </div>

        <footer className="flex gap-2 border-t p-3">
          <input ref={arquivoRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) enviar(f); }} />
          <Button variant="outline" className="self-end" onClick={() => arquivoRef.current?.click()} disabled={enviando} title="Anexar comprovante"><Paperclip className="h-4 w-4" /></Button>
          <Textarea rows={2} placeholder="Escreva como se fosse o aluno…" value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} disabled={enviando} />
          <Button className="self-end" onClick={() => enviar()} disabled={enviando || !texto.trim()}><Send className="h-4 w-4" /></Button>
        </footer>
      </section>

      <aside className="max-h-72 shrink-0 overflow-y-auto border-t p-4 lg:max-h-none lg:w-96 lg:border-l lg:border-t-0">
        <p className="mb-2 text-sm font-semibold">O que a assistente fez</p>
        {!acoes.length && <p className="text-xs text-muted-foreground">As consultas ao sistema e à IA aparecem aqui.</p>}
        <ul className="space-y-1">
          {acoes.map((a) => (
            <li key={a.id} className="rounded border bg-card px-2 py-1 text-xs">
              <span className={a.ok ? "text-green-700" : "text-destructive"}>{a.ok ? "✓" : "✗"}</span>{" "}
              <b>{a.tipo}</b> · {a.acao}{a.duracao_ms != null ? ` · ${a.duracao_ms} ms` : ""}
              {!a.ok && a.detalhe && <div className="mt-1 break-all text-[10px] text-muted-foreground">{JSON.stringify(a.detalhe).slice(0, 220)}</div>}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
