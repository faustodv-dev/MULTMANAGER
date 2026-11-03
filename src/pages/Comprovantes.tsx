import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { api, supabase, urlArquivo, reais, dataBr, dataHora, telefoneBonito, type Comprovante } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const STATUS: Record<string, { rotulo: string; cor: string }> = {
  recebido: { rotulo: "Recebido", cor: "bg-gray-100 text-gray-800" },
  analisando: { rotulo: "Analisando", cor: "bg-gray-100 text-gray-800" },
  nao_e_comprovante: { rotulo: "Não é comprovante", cor: "bg-gray-100 text-gray-600" },
  aguardando_aluno: { rotulo: "Aguardando identificação", cor: "bg-amber-100 text-amber-800" },
  divergente: { rotulo: "Divergente", cor: "bg-red-100 text-red-800" },
  duplicado: { rotulo: "Duplicado", cor: "bg-purple-100 text-purple-800" },
  sombra_ok: { rotulo: "Pronto p/ baixa", cor: "bg-blue-100 text-blue-800" },
  baixado: { rotulo: "Baixado", cor: "bg-green-100 text-green-800" },
  aguardando_humano: { rotulo: "Conferir", cor: "bg-red-100 text-red-800" },
  resolvido_manual: { rotulo: "Resolvido", cor: "bg-green-100 text-green-800" },
  rejeitado: { rotulo: "Rejeitado", cor: "bg-gray-200 text-gray-700" },
};

const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const diasAtras = (n: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() - n * 86400000));

export default function Comprovantes() {
  const [de, setDe] = useState(diasAtras(7));
  const [ate, setAte] = useState(hoje());
  const [status, setStatus] = useState("pendentes");
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<Comprovante[]>([]);
  const [carregando, setCarregando] = useState(false);
  const { perfil, unidades } = useAuth();
  const [unidade, setUnidade] = useState(perfil?.papel === "master" ? "rio_verde" : (perfil?.unit_id || "rio_verde"));

  const carregar = async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("comprovantes")
      .select("*")
      .eq("simulacao", false)
      .eq("unit_id", unidade)
      .gte("recebido_em", `${de}T00:00:00-03:00`)
      .lte("recebido_em", `${ate}T23:59:59-03:00`)
      .order("recebido_em", { ascending: false })
      .limit(1000);
    setCarregando(false);
    if (error) return toast.error(error.message);
    setItens((data as Comprovante[]) ?? []);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [de, ate, unidade]);
  useEffect(() => {
    const canal = supabase
      .channel("comprovantes")
      .on("postgres_changes", { event: "*", schema: "public", table: "comprovantes" }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [de, ate, unidade]);

  const pendentes = ["aguardando_humano", "divergente", "sombra_ok", "aguardando_aluno"];
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return itens.filter(
      (c) =>
        (status === "todos" || (status === "pendentes" ? pendentes.includes(c.status) : c.status === status)) &&
        (!t || [c.arquivo_nome, c.remetente_nome, c.telefone].some((v) => String(v || "").toLowerCase().includes(t)))
    );
  }, [itens, status, busca]);

  const total = lista.reduce((s, c) => s + (c.valor_centavos || 0), 0);

  const abrir = async (c: Comprovante) => {
    if (!c.arquivo_path) return;
    const u = await urlArquivo(c.arquivo_path);
    if (u) window.open(u, "_blank", "noopener"); else toast.error("Não foi possível abrir o arquivo.");
  };

  const acao = async (c: Comprovante, a: "resolver" | "rejeitar" | "baixar") => {
    let observacao = "";
    if (a !== "baixar") {
      const r = window.prompt(a === "resolver" ? "Observação (ex.: baixado no sistema por Fulana):" : "Motivo da rejeição:");
      if (r === null) return;
      observacao = r;
    } else if (!window.confirm(`Confirmar a baixa de ${reais(c.valor_centavos)} nas parcelas ${c.cod_pars.join("/")}?`)) {
      return;
    }
    try {
      await api("comprovante-acao", { comprovante_id: c.id, acao: a, observacao });
      toast.success(a === "baixar" ? "Baixa realizada no sistema escolar" : "Comprovante atualizado");
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-end gap-3 border-b p-4">
        <div>
          <h1 className="text-xl font-bold">Comprovantes recebidos</h1>
          <p className="text-xs text-muted-foreground">{lista.length} comprovante(s) · {reais(total)}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          {perfil?.papel === "master" && unidades.length > 1 && (
            <div>
              <Label className="text-xs">Unidade</Label>
              <select className="h-10 rounded-md border bg-background px-2 text-sm" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <div><Label className="text-xs">De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Situação</Label>
            <select className="h-10 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pendentes">Pendentes</option>
              <option value="todos">Todos</option>
              {Object.entries(STATUS).map(([v, s]) => <option key={v} value={v}>{s.rotulo}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">Arquivo ou remetente</Label><Input placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recebido</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead>Enviado por</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Pago em</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Detalhes</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="whitespace-nowrap text-xs">{dataHora(c.recebido_em)}</TableCell>
                <TableCell>
                  <button onClick={() => abrir(c)} className="flex items-center gap-1 text-left text-sm text-primary underline">
                    {c.mime?.includes("pdf") ? <FileText className="h-4 w-4 shrink-0" /> : <ImageIcon className="h-4 w-4 shrink-0" />}
                    <span className="max-w-[180px] truncate">{c.arquivo_nome || "arquivo"}</span>
                  </button>
                </TableCell>
                <TableCell className="text-sm">
                  <div>{c.remetente_nome || "—"}</div>
                  <div className="text-xs text-muted-foreground">{telefoneBonito(c.telefone)}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium">{reais(c.valor_centavos)}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{dataBr(c.data_pagamento)}</TableCell>
                <TableCell>
                  <span className={cn("whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium", STATUS[c.status]?.cor)}>{STATUS[c.status]?.rotulo || c.status}</span>
                  {c.extrato_conferido && <div className="mt-1 flex items-center gap-1 text-[10px] text-green-700"><ShieldCheck className="h-3 w-3" />Pix no extrato</div>}
                </TableCell>
                <TableCell className="max-w-[320px] text-xs text-muted-foreground">
                  {c.observacao}
                  {!!c.cod_pars?.length && <div>Parcelas: {c.cod_pars.join("/")}</div>}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {pendentes.includes(c.status) && (
                    <div className="flex gap-1">
                      {c.status === "sombra_ok" && (
                        <Button size="sm" onClick={() => acao(c, "baixar")} title="Baixar no sistema escolar">Baixar</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => acao(c, "resolver")} title="Marcar como resolvido"><CheckCircle2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => acao(c, "rejeitar")} title="Rejeitar"><XCircle className="h-4 w-4" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!lista.length && <p className="p-8 text-center text-sm text-muted-foreground">{carregando ? "Carregando…" : "Nenhum comprovante no período."}</p>}
      </div>
    </div>
  );
}
