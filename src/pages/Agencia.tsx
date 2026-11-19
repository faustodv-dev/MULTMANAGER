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
};
type MatchItem = { candidato: Candidato; score: number; ok: string[]; alertas: string[]; idade: number | null };

// Dicionário compartilhado: a VAGA e o CANDIDATO preenchem os mesmos critérios.
// É isso que permite o match por coincidência na Etapa 2 (roda só no Supabase, sem tocar a escola).
const AREAS = ["Administrativo", "Vendas / Comércio", "Atendimento / Telemarketing", "Saúde", "Beleza / Estética", "Indústria / Produção", "Logística / Estoque", "Informática / TI", "Educação", "Alimentação / Gastronomia", "Construção", "Serviços Gerais", "Outros"];
const TURNOS: { id: string; rot: string }[] = [{ id: "manha", rot: "Manhã" }, { id: "tarde", rot: "Tarde" }, { id: "noite", rot: "Noite" }, { id: "comercial", rot: "Comercial" }];
const ESCOLARIDADE = ["Fundamental", "Médio incompleto", "Médio completo", "Técnico", "Superior incompleto", "Superior completo"];
const CNH_OPCOES = ["Não tem", "A", "B", "AB", "C", "D", "E"];
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
            <Button onClick={() => setFormCand({ status: "ativo", turnos: [] })}><Plus className="mr-1 h-4 w-4" /> Novo candidato</Button>
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
                  <Button variant="ghost" size="sm" onClick={() => setFormCand(c)}><Pencil className="h-4 w-4" /></Button>
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

      {/* Form Candidato (perfil profissional) */}
      <Dialog open={!!formCand} onOpenChange={(o) => !o && setFormCand(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{formCand?.id ? "Editar candidato" : "Novo candidato"}</DialogTitle></DialogHeader>
          {formCand && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label className="text-xs">Nome *</Label><Input value={formCand.nome || ""} onChange={(e) => setFormCand({ ...formCand, nome: e.target.value })} /></div>
              <div><Label className="text-xs">Código do aluno (MULT)</Label><Input value={formCand.cod_alu || ""} onChange={(e) => setFormCand({ ...formCand, cod_alu: e.target.value })} placeholder="ex.: 13847" /></div>
              <div><Label className="text-xs">Telefone</Label><Input value={formCand.telefone || ""} onChange={(e) => setFormCand({ ...formCand, telefone: e.target.value })} /></div>
              <div><Label className="text-xs">Nascimento</Label><Input type="date" value={formCand.nascimento || ""} onChange={(e) => setFormCand({ ...formCand, nascimento: e.target.value })} /></div>
              <div><Label className="text-xs">Sexo</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={formCand.sexo || ""} onChange={(e) => setFormCand({ ...formCand, sexo: e.target.value || null })}>
                  <option value="">—</option><option value="M">Masculino</option><option value="F">Feminino</option>
                </select>
              </div>
              <div><Label className="text-xs">Área desejada</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={formCand.area || ""} onChange={(e) => setFormCand({ ...formCand, area: e.target.value || null })}>
                  <option value="">—</option>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Escolaridade</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={formCand.escolaridade || ""} onChange={(e) => setFormCand({ ...formCand, escolaridade: e.target.value || null })}>
                  <option value="">—</option>{ESCOLARIDADE.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">CNH</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={formCand.cnh || ""} onChange={(e) => setFormCand({ ...formCand, cnh: e.target.value || null })}>
                  <option value="">—</option>{CNH_OPCOES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div className="col-span-2"><Label className="text-xs">Disponibilidade de turno</Label><TurnoPicker val={formCand.turnos || []} onChange={(v) => setFormCand({ ...formCand, turnos: v })} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formCand.experiencia} onChange={(e) => setFormCand({ ...formCand, experiencia: e.target.checked })} /> Tem experiência anterior</label>
              {formCand.experiencia && <div className="col-span-2"><Label className="text-xs">Em quê (área/cargo da experiência)</Label><Input value={formCand.experiencia_area || ""} onChange={(e) => setFormCand({ ...formCand, experiencia_area: e.target.value })} /></div>}
              <div><Label className="text-xs">Curso(s) MULT</Label><Input value={formCand.cursos_mult || ""} onChange={(e) => setFormCand({ ...formCand, cursos_mult: e.target.value })} placeholder="ex.: Informática, AAS" /></div>
              <div><Label className="text-xs">Pretensão salarial</Label><Input value={formCand.pretensao || ""} onChange={(e) => setFormCand({ ...formCand, pretensao: e.target.value })} /></div>
              <div><Label className="text-xs">Bairro</Label><Input value={formCand.bairro || ""} onChange={(e) => setFormCand({ ...formCand, bairro: e.target.value })} /></div>
              <div><Label className="text-xs">Status</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={formCand.status || "ativo"} onChange={(e) => setFormCand({ ...formCand, status: e.target.value })}>
                  <option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="encaminhado">Encaminhado</option>
                </select>
              </div>
              <div className="col-span-2"><Label className="text-xs">Observações</Label><Textarea className="min-h-[60px]" value={formCand.observacoes || ""} onChange={(e) => setFormCand({ ...formCand, observacoes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormCand(null)}>Cancelar</Button>
            <Button onClick={salvarCandidato} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">{salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Salvar</Button>
          </DialogFooter>
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
