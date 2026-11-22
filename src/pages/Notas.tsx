import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { GraduationCap, Search, Loader2, Save, Trash2, ClipboardCheck, User } from "lucide-react";

type Modulo = { cod: string; nome: string };
type Matricula = { cod_mat: string; curso: string; modulos: Modulo[] };
type Criterios = Record<string, string>;
type Lancada = { cod: string; cod_mat: string; curso: string; criterio: string; criterio_nome: string; valor: number; modulos: string; data: string };
type AlunoBusca = { cod_alu: string; nome: string; ativo: boolean; cursos: string[] };
type Aluno = { cod_alu: string; nome: string };

const hojeISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const nota1 = (n: number) => n.toFixed(1).replace(".", ",");

export default function Notas() {
  const { perfil, unidades } = useAuth();
  const [unidade, setUnidade] = useState(perfil?.papel === "master" ? "rio_verde" : (perfil?.unit_id || "rio_verde"));
  const [busca, setBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [candidatos, setCandidatos] = useState<AlunoBusca[] | null>(null);
  const [aluno, setAluno] = useState<Aluno | null>(null);

  const [criterios, setCriterios] = useState<Criterios>({});
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [notas, setNotas] = useState<Lancada[]>([]);
  const [carregando, setCarregando] = useState(false);

  // formulário de lançamento
  const [codMat, setCodMat] = useState("");
  const [criterio, setCriterio] = useState("");
  const [modsSel, setModsSel] = useState<string[]>([]);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [salvando, setSalvando] = useState(false);

  const matricula = matriculas.find((m) => m.cod_mat === codMat) || null;

  const limparForm = () => { setCriterio(""); setModsSel([]); setValor(""); setData(hojeISO()); };

  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const termo = busca.trim();
    if (!termo) return;
    setBuscando(true);
    setCandidatos(null);
    try {
      const soDigitos = termo.replace(/\D/g, "");
      const corpo: any = { acao: "nota_buscar", unidade };
      if (soDigitos.length === 11) corpo.cpf = soDigitos; else corpo.cod_alu = soDigitos || termo;
      const r = await api<{ alunos: AlunoBusca[] }>("crm", corpo);
      if (!r.alunos.length) { toast.error("Nenhum aluno encontrado."); setCandidatos([]); return; }
      if (r.alunos.length === 1) await abrirAluno(r.alunos[0]);
      else setCandidatos(r.alunos);
    } catch (e: any) { toast.error(e.message); }
    finally { setBuscando(false); }
  };

  const abrirAluno = async (a: AlunoBusca | Aluno) => {
    setAluno({ cod_alu: a.cod_alu, nome: a.nome });
    setCandidatos(null);
    setCarregando(true);
    limparForm(); setCodMat("");
    try {
      const r = await api<{ criterios: Criterios; matriculas: Matricula[]; notas: Lancada[] }>("crm", { acao: "nota_opcoes", unidade, cod_alu: a.cod_alu });
      setCriterios(r.criterios || {});
      setMatriculas(r.matriculas || []);
      setNotas(r.notas || []);
      if ((r.matriculas || []).length === 1) setCodMat(r.matriculas[0].cod_mat);
    } catch (e: any) { toast.error(e.message); }
    finally { setCarregando(false); }
  };

  const toggleMod = (cod: string) =>
    setModsSel((s) => (s.includes(cod) ? s.filter((x) => x !== cod) : [...s, cod]));

  const podeLancar = !!aluno && !!codMat && !!criterio && modsSel.length > 0 && valor.trim() !== "" && !salvando;

  const lancar = async () => {
    if (!aluno) return;
    const num = Number(valor.replace(",", "."));
    if (!isFinite(num) || num < 0 || num > 10) { toast.error("A nota deve ficar entre 0 e 10."); return; }
    setSalvando(true);
    try {
      const r = await api<{ notas: Lancada[] }>("crm", {
        acao: "nota_lancar", unidade, cod_alu: aluno.cod_alu,
        cod_mat: codMat, criterio, modulos: modsSel, valor: valor.replace(",", "."), data,
      });
      setNotas(r.notas || []);
      toast.success(`Nota ${nota1(num)} lançada no MULT.`);
      limparForm();
    } catch (e: any) { toast.error(e.message || "Não foi possível lançar."); }
    finally { setSalvando(false); }
  };

  const remover = async (cod: string) => {
    if (!aluno) return;
    try {
      const r = await api<{ notas: Lancada[] }>("crm", { acao: "nota_remover", unidade, cod_alu: aluno.cod_alu, cod });
      setNotas(r.notas || []);
      toast.success("Lançamento removido.");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 p-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md"><GraduationCap className="h-6 w-6" /></span>
            <div>
              <h1 className="font-display text-xl font-bold">Notas</h1>
              <p className="text-sm text-muted-foreground">Lançamento pedagógico que alimenta o boletim do aluno no MULT.</p>
            </div>
          </div>
          {unidades.length > 1 && (
            <select className="h-10 w-48 rounded-md border bg-background px-2 text-sm" value={unidade}
              onChange={(e) => { setUnidade(e.target.value); setAluno(null); setCandidatos(null); setBusca(""); }}
              disabled={perfil?.papel !== "master"}>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </header>

        {/* Busca do aluno */}
        <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <form onSubmit={buscar} className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs">Código do aluno ou CPF do responsável</Label>
              <Input className="mt-1 h-10" placeholder="Ex.: 13882 ou 111.444.777-35" value={busca}
                onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Button type="submit" disabled={buscando || !busca.trim()}>
              {buscando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />} Buscar
            </Button>
          </form>

          {candidatos && candidatos.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Selecione o aluno:</p>
              {candidatos.map((c) => (
                <button key={c.cod_alu} type="button" onClick={() => abrirAluno(c)}
                  className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted">
                  <span className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><b>{c.nome}</b> <span className="text-xs text-muted-foreground">#{c.cod_alu}</span></span>
                  <span className="text-xs text-muted-foreground">{(c.cursos || []).join(", ") || (c.ativo ? "ativo" : "inativo")}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {carregando && (
          <div className="flex h-24 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando matrículas…</div>
        )}

        {aluno && !carregando && (
          <>
            {/* Formulário de lançamento */}
            <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-foreground"><User className="h-5 w-5" /></span>
                <div>
                  <p className="font-semibold leading-tight">{aluno.nome}</p>
                  <p className="text-xs text-muted-foreground">Aluno #{aluno.cod_alu}</p>
                </div>
              </div>

              {matriculas.length === 0 ? (
                <p className="rounded-lg border bg-background py-6 text-center text-sm text-muted-foreground">Sem matrícula ativa para lançar nota.</p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Curso / matrícula</Label>
                      <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm" value={codMat}
                        onChange={(e) => { setCodMat(e.target.value); setModsSel([]); }}>
                        <option value="">Selecione…</option>
                        {matriculas.map((m) => <option key={m.cod_mat} value={m.cod_mat}>{m.curso}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Critério de avaliação</Label>
                      <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm" value={criterio}
                        onChange={(e) => setCriterio(e.target.value)} disabled={!codMat}>
                        <option value="">Selecione…</option>
                        {Object.entries(criterios).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>

                  {matricula && (
                    <div>
                      <Label className="text-xs">Módulo(s)</Label>
                      {matricula.modulos.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">Nenhum módulo no cronograma deste curso.</p>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {matricula.modulos.map((m) => {
                            const on = modsSel.includes(m.cod);
                            return (
                              <button key={m.cod} type="button" onClick={() => toggleMod(m.cod)}
                                className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                                  on ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:bg-muted")}>
                                {m.nome}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Nota (0 a 10)</Label>
                      <Input className="mt-1 h-10" inputMode="decimal" placeholder="Ex.: 8,5" value={valor}
                        onChange={(e) => setValor(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Data do lançamento</Label>
                      <Input type="date" className="mt-1 h-10" value={data} onChange={(e) => setData(e.target.value)} />
                    </div>
                  </div>

                  <Button onClick={lancar} disabled={!podeLancar}>
                    {salvando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Lançar nota
                  </Button>
                </>
              )}
            </section>

            {/* Notas lançadas */}
            <section className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
              <p className="flex items-center gap-2 font-semibold"><ClipboardCheck className="h-4 w-4 text-muted-foreground" /> Notas lançadas</p>
              {notas.length ? (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Curso</th>
                        <th className="px-3 py-2 text-left">Critério</th>
                        <th className="px-3 py-2 text-left">Módulo(s)</th>
                        <th className="px-3 py-2 text-right">Nota</th>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {notas.map((n) => (
                        <tr key={n.cod} className="border-t">
                          <td className="px-3 py-1.5">{n.curso}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{n.criterio_nome}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{n.modulos || "—"}</td>
                          <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{nota1(n.valor)}</td>
                          <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{n.data}</td>
                          <td className="px-3 py-1.5 text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="text-muted-foreground transition-colors hover:text-destructive" title="Remover lançamento"><Trash2 className="h-4 w-4" /></button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover esta nota?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Vai apagar o lançamento de <b>{n.criterio_nome}</b> ({nota1(n.valor)}) em {n.curso}. Isso remove a nota do boletim do aluno no MULT. Confirmar?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => remover(n.cod)}>Remover</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-lg border bg-background py-6 text-center text-sm text-muted-foreground">Nenhuma nota lançada para este aluno.</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
