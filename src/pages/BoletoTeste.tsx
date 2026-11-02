import { useState } from "react";
import { toast } from "sonner";
import { Banknote, Search, AlertTriangle, Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Aluno { cod_alu: string; nome: string; ativo?: boolean }
interface Grupo { nome_responsavel: string; cpf_responsavel: string; alunos: Aluno[] }
interface Previa {
  nome_responsavel: string; nome_aluno: string; vencimento_parcela: string;
  vencimento_boleto: string; valor: string; vencida: boolean; ja_tem_boleto: boolean;
}
interface Resultado {
  emitido?: boolean; reenvio?: boolean; valor: string; vencimento: string;
  boleto_url: string; pix_copia_cola: string; linha_digitavel: string;
}

const ERROS: Record<string, string> = {
  erro_cpf: "O cadastro não tem um CPF de responsável válido. Corrija no sistema escolar antes de emitir.",
  aluno_fora_do_grupo: "Esse aluno não pertence ao CPF informado.",
  aluno_nao_encontrado: "Esse aluno não está no cadastro desse CPF.",
  parcela_nao_encontrada: "Nenhuma parcela em aberto encontrada para esse aluno (ou vencimento informado).",
  valor_invalido: "O valor calculado ficou zerado ou inválido.",
  identidade_nao_confirmada: "Falha ao confirmar a identidade. Tente buscar o CPF de novo.",
  asaas_nao_configurado: "Esta unidade está sem chave Asaas.",
};

export default function BoletoTeste() {
  const { perfil, unidades } = useAuth();
  const [unidade, setUnidade] = useState(perfil?.unit_id || unidades[0]?.id || "rio_verde");
  const [cpf, setCpf] = useState("");
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [codAlu, setCodAlu] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState<"" | "buscar" | "preparar" | "emitir">("");

  if (perfil?.papel !== "master")
    return <div className="p-8 text-muted-foreground">Tela exclusiva do master geral.</div>;

  const reset = () => { setGrupos(null); setCodAlu(""); setPrevia(null); setResultado(null); };

  const buscar = async () => {
    const d = cpf.replace(/\D/g, "");
    if (d.length !== 11) return toast.error("CPF precisa ter 11 dígitos.");
    setCarregando("buscar"); reset();
    try {
      const r = await api<{ ok: boolean; grupos: Grupo[] }>("cobranca-teste", { acao: "buscar", unidade, cpf: d });
      setGrupos(r.grupos);
      if (!r.grupos.length) toast.info("Nenhum cadastro encontrado para esse CPF.");
      const todos = r.grupos.flatMap((g) => g.alunos);
      if (todos.length === 1) setCodAlu(todos[0].cod_alu);
    } catch (e: any) { toast.error(e.message); }
    finally { setCarregando(""); }
  };

  const preparar = async () => {
    if (!codAlu) return toast.error("Escolha o aluno.");
    setCarregando("preparar"); setPrevia(null); setResultado(null);
    try {
      const r = await api<any>("cobranca-teste", { acao: "preparar", unidade, cpf: cpf.replace(/\D/g, ""), cod_alu: codAlu, vencimento: vencimento.trim() || undefined });
      if (!r.ok) return toast.error(ERROS[r.erro] || r.mensagem || r.erro);
      setPrevia(r.previa);
    } catch (e: any) { toast.error(e.message); }
    finally { setCarregando(""); }
  };

  const emitir = async () => {
    setCarregando("emitir");
    try {
      const r = await api<any>("cobranca-teste", { acao: "emitir", unidade });
      if (!r.ok) return toast.error(ERROS[r.erro] || r.mensagem || r.erro);
      setResultado(r.resultado);
      setPrevia(null);
      toast.success(r.resultado.reenvio ? "Já existia um boleto ativo — reenviado." : "Boleto real emitido no Asaas.");
    } catch (e: any) { toast.error(e.message); }
    finally { setCarregando(""); }
  };

  const copiar = async (t: string, label: string) => {
    try { await navigator.clipboard.writeText(t); toast.success(`${label} copiado.`); }
    catch { toast.error("Não consegui copiar."); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold"><Banknote className="h-5 w-5" />Emitir boleto (teste real)</h1>
        <p className="text-sm text-muted-foreground">
          Gera um boleto <b>real</b> no Asaas, igual ao que a assistente faz pelo WhatsApp. Use para validar.
          O boleto fica marcado no sistema escolar como <b>“PAINEL ADMIN (TESTE)”</b>.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          {unidades.length > 1 && (
            <div>
              <Label className="text-xs">Unidade</Label>
              <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={unidade}
                onChange={(e) => { setUnidade(e.target.value); reset(); }}>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex-1">
            <Label className="text-xs">CPF do responsável (ou do aluno)</Label>
            <Input placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()} />
          </div>
          <Button onClick={buscar} disabled={carregando === "buscar"}>
            <Search className="mr-1 h-4 w-4" />{carregando === "buscar" ? "Buscando…" : "Buscar"}
          </Button>
        </div>
      </div>

      {grupos && grupos.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Escolha o aluno</p>
          {grupos.map((g) => (
            <div key={g.cpf_responsavel + g.nome_responsavel} className="mb-3">
              <p className="text-xs text-muted-foreground">Responsável: {g.nome_responsavel}</p>
              <div className="mt-1 space-y-1">
                {g.alunos.map((a) => (
                  <label key={a.cod_alu} className="flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-muted">
                    <input type="radio" name="aluno" value={a.cod_alu} checked={codAlu === a.cod_alu}
                      onChange={() => { setCodAlu(a.cod_alu); setPrevia(null); setResultado(null); }} />
                    <span>{a.nome} <span className="text-muted-foreground">(cód. {a.cod_alu})</span></span>
                    {a.ativo === false && <span className="text-xs text-destructive">inativo</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Vencimento da parcela (opcional)</Label>
              <Input className="w-40" placeholder="dd/mm/aaaa" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
            <Button variant="outline" onClick={preparar} disabled={!codAlu || carregando === "preparar"}>
              {carregando === "preparar" ? "Calculando…" : "Ver prévia"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Sem vencimento: pega a parcela vencida mais antiga, ou a próxima a vencer.</p>
        </div>
      )}

      {previa && (
        <div className="rounded-lg border-2 border-primary bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Confira antes de emitir</p>
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Responsável</dt><dd className="font-medium">{previa.nome_responsavel}</dd>
            <dt className="text-muted-foreground">Aluno</dt><dd className="font-medium">{previa.nome_aluno}</dd>
            <dt className="text-muted-foreground">Vencimento da parcela</dt><dd>{previa.vencimento_parcela}{previa.vencida && <span className="ml-1 text-destructive">(vencida)</span>}</dd>
            <dt className="text-muted-foreground">Vencimento do boleto</dt><dd>{previa.vencimento_boleto}</dd>
            <dt className="text-muted-foreground">Valor</dt><dd className="text-lg font-bold">{previa.valor}</dd>
          </dl>
          {previa.ja_tem_boleto && (
            <p className="mt-3 flex items-start gap-2 rounded bg-amber-100 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Já existe um boleto ativo para essa(s) parcela(s). Emitir aqui vai <b>reenviar o mesmo</b>, sem duplicar.
            </p>
          )}
          <Button className="mt-4 w-full" onClick={emitir} disabled={carregando === "emitir"}>
            {carregando === "emitir" ? "Emitindo…" : `Confirmar e emitir boleto REAL — ${previa.valor}`}
          </Button>
        </div>
      )}

      {resultado && (
        <div className="rounded-lg border-2 border-green-600 bg-card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />{resultado.reenvio ? "Boleto reenviado" : "Boleto emitido"} · {resultado.valor} · venc. {resultado.vencimento}
          </p>
          <div className="space-y-2 text-sm">
            <a href={resultado.boleto_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary underline">
              <ExternalLink className="h-4 w-4" />Abrir boleto / fatura
            </a>
            {resultado.linha_digitavel && (
              <div>
                <Label className="text-xs">Linha digitável</Label>
                <div className="flex gap-2">
                  <Input readOnly value={resultado.linha_digitavel} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copiar(resultado.linha_digitavel, "Linha digitável")}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
            {resultado.pix_copia_cola && (
              <div>
                <Label className="text-xs">Pix copia e cola</Label>
                <div className="flex gap-2">
                  <Input readOnly value={resultado.pix_copia_cola} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copiar(resultado.pix_copia_cola, "Pix")}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </div>
          <Button variant="ghost" className="mt-3" onClick={() => { setResultado(null); setCpf(""); reset(); }}>Emitir outro</Button>
        </div>
      )}
    </div>
  );
}
