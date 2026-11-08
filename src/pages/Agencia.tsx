import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Building2, Plus, Search, Pencil, Loader2, RefreshCw } from "lucide-react";
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
  empresa?: { nome: string } | null;
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
const Badge = ({ m, s }: { m: Record<string, { rot: string; cor: string }>; s: string }) => (
  <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", m[s]?.cor || "bg-muted")}>{m[s]?.rot || s}</span>
);
const campo = (v: string | null | undefined) => (v && v.trim() ? v : "—");

export default function Agencia() {
  const { perfil, unidades } = useAuth();
  const ehMaster = perfil?.papel === "master";
  const [unidade, setUnidade] = useState(perfil?.unit_id || "rio_verde");
  const [aba, setAba] = useState<"empresas" | "vagas">("empresas");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [formEmp, setFormEmp] = useState<Partial<Empresa> | null>(null);
  const [formVaga, setFormVaga] = useState<Partial<Vaga> | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api<{ empresas: Empresa[]; vagas: Vaga[] }>("crm", { acao: "agencia_inicial", unidade });
      setEmpresas(r.empresas || []);
      setVagas(r.vagas || []);
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
    if (!t) return vagas;
    return vagas.filter((v) => [v.cargo, v.empresa?.nome, v.status].some((x) => String(x || "").toLowerCase().includes(t)));
  }, [vagas, busca]);
  const nomeEmpresa = (id: string | null | undefined) => empresas.find((e) => e.id === id)?.nome || "—";

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

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold"><Briefcase className="h-5 w-5 text-violet-600" /> Agência de Emprego</h1>
            <p className="text-sm text-muted-foreground">Empresas parceiras e vagas da unidade. Encaminhar alunos entra na próxima fase.</p>
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
          {([["empresas", `Empresas (${empresas.length})`], ["vagas", `Vagas (${vagas.length})`]] as const).map(([v, r]) => (
            <button key={v} onClick={() => setAba(v)} className={cn("flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", aba === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{r}</button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder={aba === "empresas" ? "Buscar empresa, CNPJ, contato…" : "Buscar cargo, empresa…"} value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {aba === "empresas"
            ? <Button onClick={() => setFormEmp({ status: "ativa" })}><Plus className="mr-1 h-4 w-4" /> Nova empresa</Button>
            : <Button onClick={() => setFormVaga({ status: "aberta", qtd: 1 })}><Plus className="mr-1 h-4 w-4" /> Nova vaga</Button>}
        </div>

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
        ) : (
          <div className="space-y-2">
            {vagasFiltradas.map((v) => (
              <div key={v.id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><p className="truncate font-medium">{v.cargo}</p><Badge m={ST_VAGA} s={v.status} /></div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {v.empresa?.nome || nomeEmpresa(v.empresa_id)}{v.qtd ? ` · ${v.qtd} vaga(s)` : ""}{v.remuneracao ? ` · ${v.remuneracao}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFormVaga(v)}><Pencil className="h-4 w-4" /></Button>
              </div>
            ))}
            {!vagasFiltradas.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma vaga.</p>}
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
    </div>
  );
}
