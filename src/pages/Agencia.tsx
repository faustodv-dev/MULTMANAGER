import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Building2, Plus, Search, Pencil, Loader2, RefreshCw, UserPlus, UserCircle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Empresa = {
  id: string; nome: string; razao_social: string | null; cnpj: string | null;
  endereco: string | null; bairro: string | null; cidade: string | null; uf: string | null;
  telefone: string | null; contato_rh: string | null; telefone_rh: string | null;
  email: string | null; status: string; observacoes: string | null;
};
type Vaga = {
  id: string; empresa_id: string | null; cargo: string; descricao: string | null;
  qtd: number | null; qtd_disponivel: number | null; idade_min: number | null; idade_max: number | null;
  sexo: string | null; curso_alvo: string | null; requisitos: string | null; experiencia: boolean | null;
  horario: string | null; beneficios: string | null; remuneracao: string | null; status: string;
  area?: string | null; turnos?: string[] | null; escolaridade_min?: string | null; cnh_exigida?: string | null;
  conducao_exigida?: boolean | null; habilidades?: string[] | null;
  created_at?: string;
  empresa?: { nome: string } | null;
};
type Enc = {
  id: string; vaga_id: string | null; cod_alu: string | null; nome_aluno: string | null;
  telefone: string | null; status: string; feedback_empresa: string | null; created_at: string;
  vaga?: { cargo: string } | null; empresa?: { nome: string } | null;
};
type Candidato = {
  id: string; cod_alu: string | null; nome: string; telefone: string | null;
  nascimento: string | null; sexo: string | null; area: string | null; turnos: string[] | null;
  escolaridade: string | null; experiencia: boolean | null; experiencia_area: string | null;
  cnh: string | null; cursos_mult: string | null; pretensao: string | null; bairro: string | null;
  observacoes: string | null; status: string;
  estado_civil?: string | null; endereco?: string | null; numero?: string | null; complemento?: string | null;
  cidade?: string | null; uf?: string | null; cep?: string | null; email?: string | null; recado?: string | null;
  falar_com?: string | null; conducao?: string | null;
  pai_nome?: string | null; pai_profissao?: string | null; mae_nome?: string | null; mae_profissao?: string | null;
  conjuge_nome?: string | null; conjuge_profissao?: string | null; num_filhos?: number | null; idades_filhos?: string | null;
  estuda?: boolean | null; estuda_curso?: string | null; estuda_periodo?: string | null; estuda_serie?: string | null;
  escola?: string | null; curso_complementacao?: string | null; curso_mult_atual?: string | null; turma?: string | null; periodo_mult?: string | null;
  exp_area?: string | null; habilidades?: string[] | null; habilidades_livre?: string | null;
  exp1_empresa?: string | null; exp1_cidade?: string | null; exp1_uf?: string | null; exp1_fone?: string | null;
  exp1_entrada?: string | null; exp1_saida?: string | null; exp1_cargo?: string | null; exp1_funcoes?: string | null; exp1_motivo?: string | null; exp1_salario?: string | null;
  exp2_empresa?: string | null; exp2_cidade?: string | null; exp2_uf?: string | null; exp2_fone?: string | null;
  exp2_entrada?: string | null; exp2_saida?: string | null; exp2_cargo?: string | null; exp2_funcoes?: string | null; exp2_motivo?: string | null; exp2_salario?: string | null;
};
type MatchItem = { candidato: Candidato; score: number; ok: string[]; alertas: string[]; idade: number | null };

// Dicionário compartilhado: a VAGA e o CANDIDATO preenchem os mesmos critérios.
// É isso que permite o match por coincidência na Etapa 2 (roda só no Supabase, sem tocar a escola).
const AREAS = ["Administrativo", "Vendas / Comércio", "Atendimento / Telemarketing", "Saúde", "Beleza / Estética", "Indústria / Produção", "Logística / Estoque", "Informática / TI", "Educação", "Alimentação / Gastronomia", "Construção", "Serviços Gerais", "Outros"];
const TURNOS: { id: string; rot: string }[] = [{ id: "manha", rot: "Manhã" }, { id: "tarde", rot: "Tarde" }, { id: "noite", rot: "Noite" }, { id: "comercial", rot: "Comercial" }];
const ESCOLARIDADE = ["Fundamental", "Médio incompleto", "Médio completo", "Técnico", "Superior incompleto", "Superior completo"];
const CNH_OPCOES = ["Não tem", "A", "B", "AB", "C", "D", "E"];
const HABILIDADES = ["Atendimento ao cliente", "Vendas", "Pacote Office", "Informática básica", "Digitação", "Caixa / Financeiro", "Rotinas administrativas", "Organização", "Comunicação", "Trabalho em equipe", "Proatividade", "Liderança", "Estoque / Logística", "Atendimento telefônico", "Redes sociais", "Condução / Direção"];
const ESTADO_CIVIL = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "Amasiado(a)"];
const CONDUCAO: { id: string; rot: string }[] = [{ id: "nao", rot: "Não tem" }, { id: "carro", rot: "Carro" }, { id: "moto", rot: "Moto" }, { id: "ambos", rot: "Carro e moto" }];
const rotTurnos = (ids?: string[] | null) => (ids || []).map((i) => TURNOS.find((t) => t.id === i)?.rot || i).join(", ");
const idadeDe = (nasc?: string | null) => {
  if (!nasc) return null;
  const d = new Date(nasc + "T12:00:00"); if (isNaN(+d)) return null;
  const h = new Date(); let a = h.getFullYear() - d.getFullYear();
  if (h.getMonth() < d.getMonth() || (h.getMonth() === d.getMonth() && h.getDate() < d.getDate())) a--;
  return a;
};

const ST_EMP: Record<string, { rot: string; cor: string }> = {
  ativa: { rot: "Ativa", cor: "bg-emerald-100 text-emerald-700" },
  verificar: { rot: "Verificar", cor: "bg-amber-100 text-amber-700" },
  inativa: { rot: "Inativa", cor: "bg-muted text-muted-foreground" },
};
const ST_VAGA: Record<string, { rot: string; cor: string }> = {
  aberta: { rot: "Aberta", cor: "bg-emerald-100 text-emerald-700" },
  triagem: { rot: "Em Triagem", cor: "bg-sky-100 text-sky-700" },
  processo: { rot: "Em Processo Seletivo", cor: "bg-violet-100 text-violet-700" },
  preenchida: { rot: "Preenchida", cor: "bg-muted text-muted-foreground" },
  cancelada: { rot: "Cancelada", cor: "bg-red-100 text-red-700" },
};
const ST_ENC: Record<string, { rot: string; cor: string }> = {
  encaminhado: { rot: "Encaminhado", cor: "bg-sky-100 text-sky-700" },
  contratado: { rot: "Contratado", cor: "bg-emerald-100 text-emerald-700" },
  nao_contratado: { rot: "Não contratado", cor: "bg-red-100 text-red-700" },
  nao_compareceu: { rot: "Não compareceu", cor: "bg-amber-100 text-amber-700" },
};
const Badge = ({ m, s }: { m: Record<string, { rot: string; cor: string }>; s: string }) => (
  <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", m[s]?.cor || "bg-muted")}>{m[s]?.rot || s}</span>
);
const campo = (v: string | null | undefined) => (v && v.trim() ? v : "—");
const TurnoPicker = ({ val, onChange }: { val: string[]; onChange: (v: string[]) => void }) => (
  <div className="mt-1 flex flex-wrap gap-1.5">
    {TURNOS.map((t) => {
      const on = val.includes(t.id);
      return (
        <button type="button" key={t.id} onClick={() => onChange(on ? val.filter((x) => x !== t.id) : [...val, t.id])}
          className={cn("rounded-md border px-2.5 py-1 text-xs font-medium transition-colors", on ? "border-violet-500 bg-violet-50 text-violet-700" : "bg-background text-muted-foreground hover:bg-muted")}>
          {t.rot}
        </button>
      );
    })}
  </div>
);
const HabPicker = ({ val, onChange }: { val: string[]; onChange: (v: string[]) => void }) => (
  <div className="mt-1 flex flex-wrap gap-1.5">
    {HABILIDADES.map((h) => {
      const on = val.includes(h);
      return (
        <button type="button" key={h} onClick={() => onChange(on ? val.filter((x) => x !== h) : [...val, h])}
          className={cn("rounded-md border px-2.5 py-1 text-xs font-medium transition-colors", on ? "border-violet-500 bg-violet-50 text-violet-700" : "bg-background text-muted-foreground hover:bg-muted")}>
          {h}
        </button>
      );
    })}
  </div>
);

export default function Agencia() {
  const { perfil, unidades } = useAuth();
  const ehMaster = perfil?.papel === "master";
  const [unidade, setUnidade] = useState(perfil?.unit_id || "rio_verde");
  const [aba, setAba] = useState<"empresas" | "vagas" | "candidatos">("empresas");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [encaminhamentos, setEncaminhamentos] = useState<Enc[]>([]);
  const [fStatus, setFStatus] = useState("");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [formEmp, setFormEmp] = useState<Partial<Empresa> | null>(null);
  const [formVaga, setFormVaga] = useState<Partial<Vaga> | null>(null);
  const [formCand, setFormCand] = useState<Partial<Candidato> | null>(null);
  const [passoCand, setPassoCand] = useState(1);
  const [matchVaga, setMatchVaga] = useState<Vaga | null>(null);
  const [matchData, setMatchData] = useState<{ max: number; ranking: MatchItem[] } | null>(null);
  const [matchLoad, setMatchLoad] = useState(false);
  const [formEnc, setFormEnc] = useState<{ vaga: Vaga; cod_alu?: string; nome_aluno?: string; telefone?: string } | null>(null);
  const [verEnc, setVerEnc] = useState<Vaga | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api<{ empresas: Empresa[]; vagas: Vaga[]; encaminhamentos: Enc[]; candidatos: Candidato[] }>("crm", { acao: "agencia_inicial", unidade });
      setEmpresas(r.empresas || []);
      setVagas(r.vagas || []);
      setEncaminhamentos(r.encaminhamentos || []);
      setCandidatos(r.candidatos || []);
    } catch (e: any) { toast.error(e.message || "Falha ao carregar."); }
    setCarregando(false);
  }, [unidade]);
  useEffect(() => { carregar(); }, [carregar]);

  const empFiltradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return empresas;
    return empresas.filter((e) => [e.nome, e.razao_social, e.cnpj, e.contato_rh].some((v) => String(v || "").toLowerCase().includes(t)));
  }, [empresas, busca]);
  const vagasFiltradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return vagas.filter((v) => {
      if (fStatus && v.status !== fStatus) return false;
      const d = (v.created_at || "").slice(0, 10);
      if (fDe && d && d < fDe) return false;
      if (fAte && d && d > fAte) return false;
      if (t && ![v.cargo, v.empresa?.nome, v.status].some((x) => String(x || "").toLowerCase().includes(t))) return false;
      return true;
    });
  }, [vagas, busca, fStatus, fDe, fAte]);
  const nomeEmpresa = (id: string | null | undefined) => empresas.find((e) => e.id === id)?.nome || "—";
  const encsDaVaga = (vagaId: string) => encaminhamentos.filter((e) => e.vaga_id === vagaId);
  const candFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return candidatos;
    return candidatos.filter((c) => [c.nome, c.cod_alu, c.area, c.cursos_mult, c.telefone].some((v) => String(v || "").toLowerCase().includes(t)));
  }, [candidatos, busca]);

  const salvarEmpresa = async () => {
    if (!formEmp?.nome?.trim()) { toast.error("Informe o nome da empresa."); return; }
    setSalvando(true);
    try {
      await api("crm", { acao: "agencia_empresa_salvar", unidade, ...formEmp });
      toast.success("Empresa salva."); setFormEmp(null); carregar();
    } catch (e: any) { toast.error(e.message); }
    setSalvando(false);
  };
  const salvarVaga = async () => {
    if (!formVaga?.cargo?.trim()) { toast.error("Informe o cargo."); return; }
    setSalvando(true);
    try {
      await api("crm", { acao: "agencia_vaga_salvar", unidade, ...formVaga });
      toast.success("Vaga salva."); setFormVaga(null); carregar();
    } catch (e: any) { toast.error(e.message); }
    setSalvando(false);
  };
  const salvarCandidato = async () => {
    if (!formCand?.nome?.trim()) { toast.error("Informe o nome do candidato."); return; }
    setSalvando(true);
    try {
      await api("crm", { acao: "agencia_candidato_salvar", unidade, ...formCand });
      toast.success("Candidato salvo."); setFormCand(null); carregar();
    } catch (e: any) { toast.error(e.message); }
    setSalvando(false);
  };
  const buscarMatch = async (v: Vaga) => {
    setMatchVaga(v); setMatchData(null); setMatchLoad(true);
    try {
      const r = await api<{ max: number; ranking: MatchItem[] }>("crm", { acao: "agencia_match", unidade, vaga_id: v.id });
      setMatchData({ max: r.max, ranking: r.ranking || [] });
    } catch (e: any) { toast.error(e.message); setMatchVaga(null); }
    setMatchLoad(false);
  };
  const encaminharDaFicha = async (c: Candidato) => {
    if (!matchVaga) return;
    try {
      await api("crm", { acao: "agencia_encaminhar", unidade, vaga_id: matchVaga.id, cod_alu: c.cod_alu, nome_aluno: c.nome, telefone: c.telefone });
      toast.success(`${String(c.nome).split(" ")[0]} encaminhado(a) — ocorrência registrada.`);
      carregar();
    } catch (e: any) { toast.error(e.message); }
  };
  // Helpers da ficha em passos
  const setC = (patch: Partial<Candidato>) => setFormCand((f) => ({ ...(f || {}), ...patch }));
  const vC = (k: keyof Candidato) => { const x = formCand ? (formCand as any)[k] : null; return x == null ? "" : String(x); };
  const abrirCand = (c?: Candidato) => { setPassoCand(1); setFormCand(c ? c : { status: "ativo", turnos: [], habilidades: [] }); };
  const encaminhar = async () => {
    if (!formEnc) return;
    if (!formEnc.cod_alu?.trim() && !formEnc.nome_aluno?.trim()) { toast.error("Informe o código ou o nome do aluno."); return; }
    setSalvando(true);
    try {
      await api("crm", { acao: "agencia_encaminhar", unidade, vaga_id: formEnc.vaga.id, cod_alu: formEnc.cod_alu, nome_aluno: formEnc.nome_aluno, telefone: formEnc.telefone });
      toast.success("Aluno encaminhado — ocorrência registrada no cadastro.");
      setFormEnc(null); carregar();
    } catch (e: any) { toast.error(e.message); }
    setSalvando(false);
  };
  const mudarEnc = async (id: string, status: string) => {
    try {
      await api("crm", { acao: "agencia_enc_status", unidade, id, status });
      toast.success("Devolutiva registrada."); carregar();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold"><Briefcase className="h-5 w-5 text-violet-600" /> Agência de Emprego</h1>
            <p className="text-sm text-muted-foreground">Empresas, vagas e candidatos da unidade. O perfil do candidato usa os mesmos critérios da vaga.</p>
          </div>
          <div className="flex items-end gap-2">
            {ehMaster && unidades.length > 1 && (
              <select className="h-10 w-44 rounded-md border bg-background px-2 text-sm" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <Button variant="outline" onClick={carregar} disabled={carregando} title="Atualizar"><RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} /></Button>
          </div>
        </header>

        {/* Abas */}
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {([["empresas", `Empresas (${empresas.length})`], ["vagas", `Vagas (${vagas.length})`], ["candidatos", `Candidatos (${candidatos.length})`]] as const).map(([v, r]) => (
            <button key={v} onClick={() => setAba(v)} className={cn("flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", aba === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{r}</button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder={aba === "empresas" ? "Buscar empresa, CNPJ, contato…" : aba === "vagas" ? "Buscar cargo, empresa…" : "Buscar candidato, código, área…"} value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {aba === "empresas" ? (
            <Button onClick={() => setFormEmp({ status: "ativa" })}><Plus className="mr-1 h-4 w-4" /> Nova empresa</Button>
          ) : aba === "vagas" ? (
            <Button onClick={() => setFormVaga({ status: "aberta", qtd: 1, turnos: [] })}><Plus className="mr-1 h-4 w-4" /> Nova vaga</Button>
          ) : (
            <Button onClick={() => abrirCand()}><Plus className="mr-1 h-4 w-4" /> Novo candidato</Button>
          )}
        </div>

        {aba === "vagas" && (
          <div className="flex flex-wrap items-end gap-2">
            <div><Label className="text-xs">Status</Label>
              <select className="h-9 w-44 rounded-md border bg-background px-2 text-sm" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="">Todos os status</option>
                {Object.entries(ST_VAGA).map(([k, v]) => <option key={k} value={k}>{v.rot}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Cadastro de</Label><Input type="date" className="h-9 w-40" value={fDe} max={fAte || undefined} onChange={(e) => setFDe(e.target.value)} /></div>
            <div><Label className="text-xs">até</Label><Input type="date" className="h-9 w-40" value={fAte} min={fDe || undefined} onChange={(e) => setFAte(e.target.value)} /></div>
            {(fStatus || fDe || fAte) && <Button variant="ghost" size="sm" className="h-9" onClick={() => { setFStatus(""); setFDe(""); setFAte(""); }}>Limpar</Button>}
          </div>
        )}

        {carregando ? (
          <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : aba === "empresas" ? (
          <div className="space-y-2">
            {empFiltradas.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><Building2 className="h-4 w-4 shrink-0 text-muted-foreground" /><p className="truncate font-medium">{e.nome}</p><Badge m={ST_EMP} s={e.status} /></div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {campo(e.cnpj)} · {campo(e.contato_rh)} · {campo(e.telefone || e.telefone_rh)}{e.email ? ` · ${e.email}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFormEmp(e)}><Pencil className="h-4 w-4" /></Button>
              </div>
            ))}
            {!empFiltradas.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma empresa.</p>}
          </div>
        ) : aba === "vagas" ? (
          <div className="space-y-2">
            {vagasFiltradas.map((v) => (
              <div key={v.id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><p className="truncate font-medium">{v.cargo}</p><Badge m={ST_VAGA} s={v.status} /></div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {v.empresa?.nome || nomeEmpresa(v.empresa_id)}{v.qtd ? ` · ${v.qtd} vaga(s)` : ""}{v.remuneracao ? ` · ${v.remuneracao}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {encsDaVaga(v.id).length > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setVerEnc(v)}>{encsDaVaga(v.id).length} encam.</Button>
                  )}
                  <Button variant="outline" size="sm" className="text-violet-700" onClick={() => buscarMatch(v)}><Target className="mr-1 h-4 w-4" /> Candidatos</Button>
                  <Button variant="ghost" size="sm" onClick={() => setFormEnc({ vaga: v })} title="Encaminhar por código"><UserPlus className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setFormVaga(v)}><Pencil className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            {!vagasFiltradas.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma vaga.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {candFiltrados.map((c) => {
              const id = idadeDe(c.nascimento);
              return (
                <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="truncate font-medium">{c.nome}{c.cod_alu ? ` (${c.cod_alu})` : ""}</p>
                      {c.status !== "ativo" && <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{c.status}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {campo(c.area)}{c.turnos?.length ? ` · ${rotTurnos(c.turnos)}` : ""}{id != null ? ` · ${id} anos` : ""}{c.cursos_mult ? ` · ${c.cursos_mult}` : ""}{c.telefone ? ` · ${c.telefone}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => abrirCand(c)}><Pencil className="h-4 w-4" /></Button>
                </div>
              );
            })}
            {!candFiltrados.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum candidato. Clique em “Novo candidato” para cadastrar o perfil.</p>}
          </div>
        )}
      </div>

      {/* Form Empresa */}
      <Dialog open={!!formEmp} onOpenChange={(o) => !o && setFormEmp(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{formEmp?.id ? "Editar empresa" : "Nova empresa"}</DialogTitle></DialogHeader>
          {formEmp && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label className="text-xs">Nome *</Label><Input value={formEmp.nome || ""} onChange={(e) => setFormEmp({ ...formEmp, nome: e.target.value })} /></div>
              <div className="col-span-2"><Label className="text-xs">Razão social</Label><Input value={formEmp.razao_social || ""} onChange={(e) => setFormEmp({ ...formEmp, razao_social: e.target.value })} /></div>
              <div><Label className="text-xs">CNPJ</Label><Input value={formEmp.cnpj || ""} onChange={(e) => setFormEmp({ ...formEmp, cnpj: e.target.value })} /></div>
              <div><Label className="text-xs">Status</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={formEmp.status || "ativa"} onChange={(e) => setFormEmp({ ...formEmp, status: e.target.value })}>
                  {Object.entries(ST_EMP).map(([k, v]) => <option key={k} value={k}>{v.rot}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Contato (RH)</Label><Input value={formEmp.contato_rh || ""} onChange={(e) => setFormEmp({ ...formEmp, contato_rh: e.target.value })} /></div>
              <div><Label className="text-xs">E-mail</Label><Input value={formEmp.email || ""} onChange={(e) => setFormEmp({ ...formEmp, email: e.target.value })} /></div>
              <div><Label className="text-xs">Telefone</Label><Input value={formEmp.telefone || ""} onChange={(e) => setFormEmp({ ...formEmp, telefone: e.target.value })} /></div>
              <div><Label className="text-xs">Telefone RH</Label><Input value={formEmp.telefone_rh || ""} onChange={(e) => setFormEmp({ ...formEmp, telefone_rh: e.target.value })} /></div>
              <div className="col-span-2"><Label className="text-xs">Endereço</Label><Input value={formEmp.endereco || ""} onChange={(e) => setFormEmp({ ...formEmp, endereco: e.target.value })} /></div>
              <div><Label className="text-xs">Bairro</Label><Input value={formEmp.bairro || ""} onChange={(e) => setFormEmp({ ...formEmp, bairro: e.target.value })} /></div>
              <div><Label className="text-xs">Cidade</Label><Input value={formEmp.cidade || ""} onChange={(e) => setFormEmp({ ...formEmp, cidade: e.target.value })} /></div>
              <div className="col-span-2"><Label className="text-xs">Observações</Label><Textarea className="min-h-[60px]" value={formEmp.observacoes || ""} onChange={(e) => setFormEmp({ ...formEmp, observacoes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormEmp(null)}>Cancelar</Button>
            <Button onClick={salvarEmpresa} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">{salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Vaga */}
      <Dialog open={!!formVaga} onOpenChange={(o) => !o && setFormVaga(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{formVaga?.id ? "Editar vaga" : "Nova vaga"}</DialogTitle></DialogHeader>
          {formVaga && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label className="text-xs">Empresa</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={formVaga.empresa_id || ""} onChange={(e) => setFormVaga({ ...formVaga, empresa_id: e.target.value || null })}>
                  <option value="">— selecione —</option>
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
              <div className="col-span-2"><Label className="text-xs">Cargo *</Label><Input value={formVaga.cargo || ""} onChange={(e) => setFormVaga({ ...formVaga, cargo: e.target.value })} /></div>
              <div><Label className="text-xs">Status</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={formVaga.status || "aberta"} onChange={(e) => setFormVaga({ ...formVaga, status: e.target.value })}>
                  {Object.entries(ST_VAGA).map(([k, v]) => <option key={k} value={k}>{v.rot}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Curso alvo (MULT)</Label><Input value={formVaga.curso_alvo || ""} onChange={(e) => setFormVaga({ ...formVaga, curso_alvo: e.target.value })} /></div>
              <div><Label className="text-xs">Área</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={formVaga.area || ""} onChange={(e) => setFormVaga({ ...formVaga, area: e.target.value || null })}>
                  <option value="">—</option>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Escolaridade mínima</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={formVaga.escolaridade_min || ""} onChange={(e) => setFormVaga({ ...formVaga, escolaridade_min: e.target.value || null })}>
                  <option value="">—</option>{ESCOLARIDADE.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">CNH exigida</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={formVaga.cnh_exigida || ""} onChange={(e) => setFormVaga({ ...formVaga, cnh_exigida: e.target.value || null })}>
                  <option value="">—</option>{CNH_OPCOES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div className="col-span-2"><Label className="text-xs">Turnos aceitos</Label><TurnoPicker val={formVaga.turnos || []} onChange={(v) => setFormVaga({ ...formVaga, turnos: v })} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formVaga.conducao_exigida} onChange={(e) => setFormVaga({ ...formVaga, conducao_exigida: e.target.checked })} /> Exige condução própria (carro/moto)</label>
              <div className="col-span-2"><Label className="text-xs">Habilidades desejadas</Label><HabPicker val={formVaga.habilidades || []} onChange={(v) => setFormVaga({ ...formVaga, habilidades: v })} /></div>
              <div><Label className="text-xs">Qtd. vagas</Label><Input type="number" value={formVaga.qtd ?? ""} onChange={(e) => setFormVaga({ ...formVaga, qtd: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Sexo</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={formVaga.sexo || "A"} onChange={(e) => setFormVaga({ ...formVaga, sexo: e.target.value })}>
                  <option value="A">Ambos</option><option value="M">Masculino</option><option value="F">Feminino</option>
                </select>
              </div>
              <div><Label className="text-xs">Idade mín.</Label><Input type="number" value={formVaga.idade_min ?? ""} onChange={(e) => setFormVaga({ ...formVaga, idade_min: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Idade máx.</Label><Input type="number" value={formVaga.idade_max ?? ""} onChange={(e) => setFormVaga({ ...formVaga, idade_max: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Horário</Label><Input value={formVaga.horario || ""} onChange={(e) => setFormVaga({ ...formVaga, horario: e.target.value })} /></div>
              <div><Label className="text-xs">Remuneração</Label><Input value={formVaga.remuneracao || ""} onChange={(e) => setFormVaga({ ...formVaga, remuneracao: e.target.value })} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formVaga.experiencia} onChange={(e) => setFormVaga({ ...formVaga, experiencia: e.target.checked })} /> Exige experiência</label>
              <div className="col-span-2"><Label className="text-xs">Benefícios</Label><Input value={formVaga.beneficios || ""} onChange={(e) => setFormVaga({ ...formVaga, beneficios: e.target.value })} /></div>
              <div className="col-span-2"><Label className="text-xs">Descrição das atividades</Label><Textarea className="min-h-[60px]" value={formVaga.descricao || ""} onChange={(e) => setFormVaga({ ...formVaga, descricao: e.target.value })} /></div>
              <div className="col-span-2"><Label className="text-xs">Requisitos (escolaridade, habilidades)</Label><Textarea className="min-h-[60px]" value={formVaga.requisitos || ""} onChange={(e) => setFormVaga({ ...formVaga, requisitos: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormVaga(null)}>Cancelar</Button>
            <Button onClick={salvarVaga} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">{salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ficha do candidato = Solicitação de Encaminhamento (em 4 passos) */}
      <Dialog open={!!formCand} onOpenChange={(o) => !o && setFormCand(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{formCand?.id ? "Editar ficha do candidato" : "Nova ficha do candidato"}</DialogTitle></DialogHeader>
          {formCand && (
            <>
              <div className="mb-1 flex flex-wrap gap-1 text-[11px] font-medium">
                {["Dados pessoais", "Educação", "Experiência", "Preferências"].map((t, i) => (
                  <span key={t} className={cn("rounded-full px-2 py-0.5", passoCand === i + 1 ? "bg-violet-100 text-violet-700" : "text-muted-foreground")}>{i + 1}. {t}</span>
                ))}
              </div>

              {passoCand === 1 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label className="text-xs">Nome *</Label><Input value={vC("nome")} onChange={(e) => setC({ nome: e.target.value })} /></div>
                  <div><Label className="text-xs">Código do aluno</Label><Input value={vC("cod_alu")} onChange={(e) => setC({ cod_alu: e.target.value })} placeholder="ex.: 13847" /></div>
                  <div><Label className="text-xs">Telefone</Label><Input value={vC("telefone")} onChange={(e) => setC({ telefone: e.target.value })} /></div>
                  <div><Label className="text-xs">Recado</Label><Input value={vC("recado")} onChange={(e) => setC({ recado: e.target.value })} /></div>
                  <div><Label className="text-xs">Falar com</Label><Input value={vC("falar_com")} onChange={(e) => setC({ falar_com: e.target.value })} /></div>
                  <div className="col-span-2"><Label className="text-xs">E-mail</Label><Input value={vC("email")} onChange={(e) => setC({ email: e.target.value })} /></div>
                  <div><Label className="text-xs">Nascimento</Label><Input type="date" value={vC("nascimento")} onChange={(e) => setC({ nascimento: e.target.value })} /></div>
                  <div><Label className="text-xs">Sexo</Label>
                    <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={vC("sexo")} onChange={(e) => setC({ sexo: e.target.value || null })}>
                      <option value="">—</option><option value="M">Masculino</option><option value="F">Feminino</option>
                    </select></div>
                  <div className="col-span-2"><Label className="text-xs">Estado civil</Label>
                    <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={vC("estado_civil")} onChange={(e) => setC({ estado_civil: e.target.value || null })}>
                      <option value="">—</option>{ESTADO_CIVIL.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select></div>
                  <div className="col-span-2"><Label className="text-xs">Endereço</Label><Input value={vC("endereco")} onChange={(e) => setC({ endereco: e.target.value })} /></div>
                  <div><Label className="text-xs">Nº</Label><Input value={vC("numero")} onChange={(e) => setC({ numero: e.target.value })} /></div>
                  <div><Label className="text-xs">Complemento</Label><Input value={vC("complemento")} onChange={(e) => setC({ complemento: e.target.value })} /></div>
                  <div><Label className="text-xs">Bairro</Label><Input value={vC("bairro")} onChange={(e) => setC({ bairro: e.target.value })} /></div>
                  <div><Label className="text-xs">Cidade</Label><Input value={vC("cidade")} onChange={(e) => setC({ cidade: e.target.value })} /></div>
                  <div><Label className="text-xs">UF</Label><Input value={vC("uf")} onChange={(e) => setC({ uf: e.target.value })} /></div>
                  <div><Label className="text-xs">CEP</Label><Input value={vC("cep")} onChange={(e) => setC({ cep: e.target.value })} /></div>
                  <div><Label className="text-xs">CNH <span className="text-[10px] text-violet-600">★</span></Label>
                    <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={vC("cnh")} onChange={(e) => setC({ cnh: e.target.value || null })}>
                      <option value="">—</option>{CNH_OPCOES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select></div>
                  <div><Label className="text-xs">Condução própria <span className="text-[10px] text-violet-600">★</span></Label>
                    <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={vC("conducao")} onChange={(e) => setC({ conducao: e.target.value || null })}>
                      <option value="">—</option>{CONDUCAO.map((x) => <option key={x.id} value={x.id}>{x.rot}</option>)}
                    </select></div>
                  <p className="col-span-2 mt-1 text-xs font-semibold text-muted-foreground">Família (para os documentos)</p>
                  <div><Label className="text-xs">Nome do pai</Label><Input value={vC("pai_nome")} onChange={(e) => setC({ pai_nome: e.target.value })} /></div>
                  <div><Label className="text-xs">Profissão do pai</Label><Input value={vC("pai_profissao")} onChange={(e) => setC({ pai_profissao: e.target.value })} /></div>
                  <div><Label className="text-xs">Nome da mãe</Label><Input value={vC("mae_nome")} onChange={(e) => setC({ mae_nome: e.target.value })} /></div>
                  <div><Label className="text-xs">Profissão da mãe</Label><Input value={vC("mae_profissao")} onChange={(e) => setC({ mae_profissao: e.target.value })} /></div>
                  <div><Label className="text-xs">Cônjuge</Label><Input value={vC("conjuge_nome")} onChange={(e) => setC({ conjuge_nome: e.target.value })} /></div>
                  <div><Label className="text-xs">Profissão do cônjuge</Label><Input value={vC("conjuge_profissao")} onChange={(e) => setC({ conjuge_profissao: e.target.value })} /></div>
                  <div><Label className="text-xs">Nº de filhos</Label><Input type="number" value={formCand.num_filhos ?? ""} onChange={(e) => setC({ num_filhos: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">Idades dos filhos</Label><Input value={vC("idades_filhos")} onChange={(e) => setC({ idades_filhos: e.target.value })} /></div>
                </div>
              )}

              {passoCand === 2 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label className="text-xs">Escolaridade <span className="text-[10px] text-violet-600">★</span></Label>
                    <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={vC("escolaridade")} onChange={(e) => setC({ escolaridade: e.target.value || null })}>
                      <option value="">—</option>{ESCOLARIDADE.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select></div>
                  <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formCand.estuda} onChange={(e) => setC({ estuda: e.target.checked })} /> Estuda atualmente</label>
                  {formCand.estuda && (<>
                    <div><Label className="text-xs">Curso</Label><Input value={vC("estuda_curso")} onChange={(e) => setC({ estuda_curso: e.target.value })} /></div>
                    <div><Label className="text-xs">Período</Label><Input value={vC("estuda_periodo")} onChange={(e) => setC({ estuda_periodo: e.target.value })} /></div>
                    <div><Label className="text-xs">Série</Label><Input value={vC("estuda_serie")} onChange={(e) => setC({ estuda_serie: e.target.value })} /></div>
                    <div><Label className="text-xs">Escola / Faculdade</Label><Input value={vC("escola")} onChange={(e) => setC({ escola: e.target.value })} /></div>
                  </>)}
                  <div className="col-span-2"><Label className="text-xs">Curso de complementação</Label><Input value={vC("curso_complementacao")} onChange={(e) => setC({ curso_complementacao: e.target.value })} /></div>
                  <p className="col-span-2 mt-1 text-xs font-semibold text-muted-foreground">Na MULT Profissões</p>
                  <div className="col-span-2"><Label className="text-xs">Curso(s) MULT <span className="text-[10px] text-violet-600">★</span></Label><Input value={vC("cursos_mult")} onChange={(e) => setC({ cursos_mult: e.target.value })} placeholder="ex.: Informática, AAS" /></div>
                  <div><Label className="text-xs">Curso atual</Label><Input value={vC("curso_mult_atual")} onChange={(e) => setC({ curso_mult_atual: e.target.value })} /></div>
                  <div><Label className="text-xs">Turma</Label><Input value={vC("turma")} onChange={(e) => setC({ turma: e.target.value })} /></div>
                  <div><Label className="text-xs">Período</Label><Input value={vC("periodo_mult")} onChange={(e) => setC({ periodo_mult: e.target.value })} /></div>
                </div>
              )}

              {passoCand === 3 && (
                <div className="grid grid-cols-2 gap-3">
                  <p className="col-span-2 text-xs font-semibold text-muted-foreground">Último emprego</p>
                  <div className="col-span-2"><Label className="text-xs">Empresa</Label><Input value={vC("exp1_empresa")} onChange={(e) => setC({ exp1_empresa: e.target.value })} /></div>
                  <div><Label className="text-xs">Cargo</Label><Input value={vC("exp1_cargo")} onChange={(e) => setC({ exp1_cargo: e.target.value })} /></div>
                  <div><Label className="text-xs">Cidade / UF</Label><Input value={vC("exp1_cidade")} onChange={(e) => setC({ exp1_cidade: e.target.value })} /></div>
                  <div><Label className="text-xs">Entrada</Label><Input type="date" value={vC("exp1_entrada")} onChange={(e) => setC({ exp1_entrada: e.target.value })} /></div>
                  <div><Label className="text-xs">Saída</Label><Input type="date" value={vC("exp1_saida")} onChange={(e) => setC({ exp1_saida: e.target.value })} /></div>
                  <div className="col-span-2"><Label className="text-xs">Funções</Label><Input value={vC("exp1_funcoes")} onChange={(e) => setC({ exp1_funcoes: e.target.value })} /></div>
                  <div><Label className="text-xs">Motivo da saída</Label><Input value={vC("exp1_motivo")} onChange={(e) => setC({ exp1_motivo: e.target.value })} /></div>
                  <div><Label className="text-xs">Último salário</Label><Input value={vC("exp1_salario")} onChange={(e) => setC({ exp1_salario: e.target.value })} /></div>
                  <p className="col-span-2 mt-1 text-xs font-semibold text-muted-foreground">Penúltimo emprego</p>
                  <div className="col-span-2"><Label className="text-xs">Empresa</Label><Input value={vC("exp2_empresa")} onChange={(e) => setC({ exp2_empresa: e.target.value })} /></div>
                  <div><Label className="text-xs">Cargo</Label><Input value={vC("exp2_cargo")} onChange={(e) => setC({ exp2_cargo: e.target.value })} /></div>
                  <div><Label className="text-xs">Cidade / UF</Label><Input value={vC("exp2_cidade")} onChange={(e) => setC({ exp2_cidade: e.target.value })} /></div>
                  <div className="col-span-2"><Label className="text-xs">Funções</Label><Input value={vC("exp2_funcoes")} onChange={(e) => setC({ exp2_funcoes: e.target.value })} /></div>
                  <p className="col-span-2 mt-1 text-xs font-semibold text-violet-700">Perfil profissional (★ entra no match)</p>
                  <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formCand.experiencia} onChange={(e) => setC({ experiencia: e.target.checked })} /> Tem experiência anterior <span className="text-[10px] text-violet-600">★</span></label>
                  <div className="col-span-2"><Label className="text-xs">Área da experiência <span className="text-[10px] text-violet-600">★</span></Label>
                    <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={vC("exp_area")} onChange={(e) => setC({ exp_area: e.target.value || null })}>
                      <option value="">—</option>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select></div>
                  <div className="col-span-2"><Label className="text-xs">Habilidades <span className="text-[10px] text-violet-600">★</span></Label><HabPicker val={formCand.habilidades || []} onChange={(v) => setC({ habilidades: v })} /></div>
                  <div className="col-span-2"><Label className="text-xs">Outras habilidades (texto livre, p/ documento)</Label><Textarea className="min-h-[50px]" value={vC("habilidades_livre")} onChange={(e) => setC({ habilidades_livre: e.target.value })} /></div>
                </div>
              )}

              {passoCand === 4 && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Área desejada <span className="text-[10px] text-violet-600">★</span></Label>
                    <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={vC("area")} onChange={(e) => setC({ area: e.target.value || null })}>
                      <option value="">—</option>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select></div>
                  <div><Label className="text-xs">Pretensão salarial</Label><Input value={vC("pretensao")} onChange={(e) => setC({ pretensao: e.target.value })} /></div>
                  <div className="col-span-2"><Label className="text-xs">Disponibilidade de turno <span className="text-[10px] text-violet-600">★</span></Label><TurnoPicker val={formCand.turnos || []} onChange={(v) => setC({ turnos: v })} /></div>
                  <div><Label className="text-xs">Status</Label>
                    <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={vC("status") || "ativo"} onChange={(e) => setC({ status: e.target.value })}>
                      <option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="encaminhado">Encaminhado</option>
                    </select></div>
                  <div className="col-span-2"><Label className="text-xs">Observações</Label><Textarea className="min-h-[50px]" value={vC("observacoes")} onChange={(e) => setC({ observacoes: e.target.value })} /></div>
                  <p className="col-span-2 rounded-md bg-violet-50 p-2 text-[11px] text-violet-700">★ = campos que entram no ranking de match. Os demais vão na Solicitação e cartas (Etapa 3).</p>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                <Button variant="outline" size="sm" disabled={passoCand === 1} onClick={() => setPassoCand((p) => Math.max(1, p - 1))}>Voltar</Button>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4].map((n) => <span key={n} className={cn("h-2 w-2 rounded-full", n === passoCand ? "bg-violet-600" : "bg-muted")} />)}
                  <span className="ml-2 text-xs font-medium tabular-nums text-muted-foreground">{String(passoCand).padStart(2, "0")}/04</span>
                </div>
                {passoCand < 4 ? (
                  <Button size="sm" onClick={() => setPassoCand((p) => Math.min(4, p + 1))}>Próximo</Button>
                ) : (
                  <Button size="sm" onClick={salvarCandidato} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">{salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Salvar</Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Encaminhar aluno */}
      <Dialog open={!!formEnc} onOpenChange={(o) => !o && setFormEnc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Encaminhar aluno</DialogTitle></DialogHeader>
          {formEnc && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Vaga: <b>{formEnc.vaga.cargo}</b>{formEnc.vaga.empresa?.nome ? ` · ${formEnc.vaga.empresa.nome}` : ""}</p>
              <div><Label className="text-xs">Código do aluno</Label><Input value={formEnc.cod_alu || ""} onChange={(e) => setFormEnc({ ...formEnc, cod_alu: e.target.value })} placeholder="ex.: 13847" /></div>
              <div><Label className="text-xs">Nome do aluno</Label><Input value={formEnc.nome_aluno || ""} onChange={(e) => setFormEnc({ ...formEnc, nome_aluno: e.target.value })} /></div>
              <div><Label className="text-xs">Telefone</Label><Input value={formEnc.telefone || ""} onChange={(e) => setFormEnc({ ...formEnc, telefone: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">Com o código informado, uma ocorrência informativa é registrada no cadastro do aluno.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormEnc(null)}>Cancelar</Button>
            <Button onClick={encaminhar} disabled={salvando} className="bg-violet-600 hover:bg-violet-700">{salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Encaminhar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Encaminhamentos da vaga + devolutiva */}
      <Dialog open={!!verEnc} onOpenChange={(o) => !o && setVerEnc(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Encaminhamentos — {verEnc?.cargo}</DialogTitle></DialogHeader>
          <ul className="space-y-2">
            {verEnc && encsDaVaga(verEnc.id).map((e) => (
              <li key={e.id} className="rounded-lg border p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{e.nome_aluno || "—"}{e.cod_alu ? ` (${e.cod_alu})` : ""}</p>
                  <Badge m={ST_ENC} s={e.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" className="text-emerald-700" onClick={() => mudarEnc(e.id, "contratado")}>Contratado</Button>
                  <Button variant="outline" size="sm" className="text-red-700" onClick={() => mudarEnc(e.id, "nao_contratado")}>Não contratado</Button>
                  <Button variant="outline" size="sm" className="text-amber-700" onClick={() => mudarEnc(e.id, "nao_compareceu")}>Não compareceu</Button>
                </div>
              </li>
            ))}
            {verEnc && !encsDaVaga(verEnc.id).length && <p className="py-4 text-center text-sm text-muted-foreground">Nenhum encaminhamento nesta vaga.</p>}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Match: candidatos compatíveis com a vaga (ranking por coincidência) */}
      <Dialog open={!!matchVaga} onOpenChange={(o) => { if (!o) { setMatchVaga(null); setMatchData(null); } }}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-violet-600" /> Candidatos para {matchVaga?.cargo}</DialogTitle>
          </DialogHeader>
          {matchLoad ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculando compatibilidade…</div>
          ) : matchData && matchData.max === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Essa vaga ainda não tem critérios preenchidos (área, turnos, escolaridade, CNH…). Edite a vaga para o match funcionar.</p>
          ) : matchData && matchData.ranking.length ? (
            <>
              <p className="text-xs text-muted-foreground">Ordenado por coincidência de critérios. Verde = bateu; âmbar = não atende um requisito da vaga (não exclui — você decide).</p>
              <ul className="space-y-2">
                {matchData.ranking.map((m) => {
                  const jaEnc = matchVaga ? encsDaVaga(matchVaga.id).some((e) => (m.candidato.cod_alu && e.cod_alu === m.candidato.cod_alu) || e.nome_aluno === m.candidato.nome) : false;
                  const pct = matchData.max ? Math.round((m.score / matchData.max) * 100) : 0;
                  return (
                    <li key={m.candidato.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{m.candidato.nome}{m.candidato.cod_alu ? ` (${m.candidato.cod_alu})` : ""}{m.idade != null ? ` · ${m.idade} anos` : ""}{m.candidato.telefone ? ` · ${m.candidato.telefone}` : ""}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                            <span className="text-xs font-semibold tabular-nums">{pct}%</span>
                            <span className="text-xs text-muted-foreground">({m.score}/{matchData.max})</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {m.ok.map((t) => <span key={`ok-${t}`} className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">✓ {t}</span>)}
                            {m.alertas.map((t) => <span key={`al-${t}`} className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">! {t}</span>)}
                          </div>
                        </div>
                        {jaEnc ? (
                          <span className="shrink-0 rounded-md bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700">Encaminhado</span>
                        ) : (
                          <Button size="sm" className="shrink-0 bg-violet-600 hover:bg-violet-700" onClick={() => encaminharDaFicha(m.candidato)}><UserPlus className="mr-1 h-4 w-4" /> Encaminhar</Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum candidato cadastrado. Cadastre perfis na aba “Candidatos”.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
