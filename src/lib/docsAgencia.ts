// Documentos da Agência de Encaminhamento (MULT Profissões).
// Geração 100% no navegador: pré-preenche a ficha do candidato e abre para impressão / Salvar em PDF.
// Textos oficiais conforme os modelos da MULT (Unidade Rio Verde-GO).

export type DocExtras = {
  destinatario?: string; // Sr(a). do RH
  empresa?: string;
  cargo?: string;
  cidade?: string;
  motivo?: string;
  vez?: string;   // nº da desistência
  sites?: string; // um por linha
};

export const DOCS: { id: string; rot: string; precisa?: string }[] = [
  { id: "solicitacao", rot: "Solicitação de Encaminhamento" },
  { id: "normas", rot: "Declaração de Conhecimento das Normas" },
  { id: "apresentacao", rot: "Carta de Apresentação", precisa: "empresa, cargo" },
  { id: "confirmacao", rot: "Carta de Confirmação de Encaminhamento", precisa: "empresa, cidade" },
  { id: "parabenizacao", rot: "Carta de Parabenização" },
  { id: "virtual", rot: "Confirmação de Encaminhamento Virtual", precisa: "sites" },
  { id: "desistencia_seletivo", rot: "Desistência de Encaminhamento (processo seletivo)", precisa: "empresa, cargo" },
  { id: "relatorio_desistencia", rot: "Relatório de Desistência", precisa: "empresa, cargo, motivo" },
  { id: "desistencia_programa", rot: "Carta de Desistência do Programa" },
];

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
// valor preenchido, ou linha em branco pra escrever à mão
function g(v: unknown, largura = "220px"): string {
  const t = v == null ? "" : String(v).trim();
  return t ? `<b>${esc(t)}</b>` : `<span class="br" style="min-width:${largura}"></span>`;
}
function dataExtenso(): string {
  const h = new Date();
  return `Rio Verde, ${h.getDate()} de ${MESES[h.getMonth()]} de ${h.getFullYear()}.`;
}
const CONDUCAO_ROT: Record<string, string> = { nao: "Não tem", carro: "Carro", moto: "Moto", ambos: "Carro e moto" };
const TURNO_ROT: Record<string, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite", comercial: "Comercial" };

function assinatura(rotulo = "Assinatura do Aluno"): string {
  return `<div class="ass"><div class="linha"></div>${esc(rotulo)}<br><span class="sub">MULT Profissões — Unidade Rio Verde-GO</span></div>`;
}

type Uni = Record<string, any>;
const origem = () => { try { return window.location.origin; } catch { return ""; } };

function cabecalho(): string {
  return `<div class="cabecalho"><img src="${origem()}/mult-logo.png" alt="MULT Profissões"></div>`;
}
function rodape(u?: Uni): string {
  if (!u) return "";
  const endParts = [u.endereco, u.numero ? `nº ${u.numero}` : "", u.bairro].filter(Boolean).join(", ");
  const temAlgo = endParts || u.instagram || u.telefone_fixo || u.site || u.email;
  if (!temAlgo) return "";
  const nome = u.razao_social || `MULT Profissões${u.name ? ` — ${u.name}` : ""}`;
  const l2 = [endParts, u.instagram ? `Instagram: ${u.instagram}` : "", u.telefone_fixo].filter(Boolean).join(" · ");
  const l3 = [u.site, u.email].filter(Boolean).join(" · ");
  const linhas = [`<b>${esc(nome)}</b>`, l2 ? esc(l2) : "", l3 ? esc(l3) : ""].filter(Boolean);
  return `<div class="rodape">${linhas.map((x) => `<div>${x}</div>`).join("")}</div>`;
}

function shell(titulo: string, corpo: string, u?: Uni): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title>
<style>
  @page { size: A4; margin: 2cm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color:#111; line-height:1.55; font-size:12pt; margin:0; background:#e5e7eb; }
  .barra { position: sticky; top:0; display:flex; gap:8px; justify-content:flex-end; padding:10px 14px; background:#f3f4f6; border-bottom:1px solid #d1d5db; }
  .barra button { font-family: Arial, sans-serif; font-size:13px; padding:7px 16px; border:0; border-radius:6px; cursor:pointer; color:#fff; }
  .b-print { background:#7c3aed; } .b-close { background:#6b7280; }
  .folha { max-width: 20cm; margin: 16px auto; background:#fff; padding: 2cm; box-shadow:0 1px 6px rgba(0,0,0,.15); }
  h1 { text-align:center; font-size:14pt; margin:0 0 2px; text-transform:uppercase; }
  .cab { text-align:center; margin-bottom:22px; color:#444; font-size:10.5pt; }
  .campo { margin:7px 0; }
  .sec { margin:16px 0 6px; font-weight:bold; border-bottom:1px solid #999; padding-bottom:2px; }
  .br { display:inline-block; border-bottom:1px solid #111; vertical-align:baseline; }
  p { text-align:justify; margin:10px 0; }
  ol { padding-left:22px; } li { margin:9px 0; text-align:justify; }
  .foto { float:right; width:3cm; height:4cm; border:1px solid #111; display:flex; align-items:center; justify-content:center; font-family:Arial; font-size:10px; color:#777; margin:0 0 8px 12px; }
  .ass { margin-top:52px; text-align:center; }
  .ass .linha { border-top:1px solid #111; width:70%; margin:0 auto 4px; height:0; }
  .ass .sub { color:#555; font-size:10pt; }
  .duplaass { display:flex; gap:24px; margin-top:52px; } .duplaass > div { flex:1; text-align:center; } .duplaass .linha { border-top:1px solid #111; margin-bottom:4px; }
  .cabecalho { text-align:center; margin-bottom:20px; }
  .cabecalho img { max-width:100%; height:auto; max-height:64px; }
  .rodape { text-align:center; font-style:italic; font-size:9.5pt; color:#444; border-top:1px solid #bbb; padding-top:6px; margin-top:32px; line-height:1.35; }
  @media print { body { background:#fff; } .barra { display:none; } .folha { box-shadow:none; margin:0; max-width:none; padding:0 0 2.6cm; } .rodape { position:fixed; left:0; right:0; bottom:0; margin:0; background:#fff; } }
</style></head>
<body>
  <div class="barra"><button class="b-print" onclick="window.print()">Imprimir / Salvar PDF</button><button class="b-close" onclick="window.close()">Fechar</button></div>
  <div class="folha">${cabecalho()}${corpo}${rodape(u)}</div>
  <script>window.onload=function(){setTimeout(function(){try{window.print()}catch(e){}},700)}</script>
</body></html>`;
}

type Cand = Record<string, any>;

function docSolicitacao(c: Cand, encs: Uni[] = []): string {
  const turnos = (c.turnos || []).map((t: string) => TURNO_ROT[t] || t).join(", ");
  const habs = (c.habilidades || []).join(", ");
  return `<h1>Solicitação de Encaminhamento</h1>
  <div class="foto">Foto 3x4</div>
  <div class="campo">Curso realizado atualmente na MULT Profissões: ${g(c.curso_mult_atual || c.cursos_mult)}</div>
  <div class="campo">Período: ${g(c.periodo_mult, "120px")} &nbsp; N.º da Turma: ${g(c.turma, "120px")}</div>
  <div class="sec">I – Dados Pessoais</div>
  <div class="campo">Nome: ${g(c.nome, "340px")}</div>
  <div class="campo">Endereço: ${g(c.endereco, "300px")} nº ${g(c.numero, "70px")}</div>
  <div class="campo">Bairro: ${g(c.bairro, "180px")} Complemento: ${g(c.complemento, "150px")}</div>
  <div class="campo">Cidade: ${g(c.cidade, "160px")} Estado: ${g(c.uf, "60px")} CEP: ${g(c.cep, "110px")}</div>
  <div class="campo">Telefone: ${g(c.telefone, "140px")} Recado: ${g(c.recado, "120px")} Falar com: ${g(c.falar_com, "120px")}</div>
  <div class="campo">E-mail: ${g(c.email, "240px")} Data de Nascimento: ${g(c.nascimento ? formatarData(c.nascimento) : "", "120px")}</div>
  <div class="campo">Estado Civil: ${g(c.estado_civil, "160px")}</div>
  <div class="campo">Carteira de Habilitação: ${g(c.cnh, "120px")} &nbsp; Condução própria: ${g(CONDUCAO_ROT[c.conducao] || c.conducao, "120px")}</div>
  <div class="sec">II – Dados Familiares</div>
  <div class="campo">Nome do Pai: ${g(c.pai_nome, "240px")} Profissão: ${g(c.pai_profissao, "150px")}</div>
  <div class="campo">Nome da Mãe: ${g(c.mae_nome, "240px")} Profissão: ${g(c.mae_profissao, "150px")}</div>
  <div class="campo">Cônjuge: ${g(c.conjuge_nome, "240px")} Profissão: ${g(c.conjuge_profissao, "150px")}</div>
  <div class="campo">Número de filhos: ${g(c.num_filhos, "60px")} Idades: ${g(c.idades_filhos, "200px")}</div>
  <div class="sec">III – Situação Educacional</div>
  <div class="campo">Escolaridade: ${g(c.escolaridade, "260px")}</div>
  <div class="campo">Estuda atualmente? ${c.estuda ? "(X) Sim ( ) Não" : "( ) Sim (X) Não"} &nbsp; Curso: ${g(c.estuda_curso, "180px")}</div>
  <div class="campo">Período: ${g(c.estuda_periodo, "120px")} Série: ${g(c.estuda_serie, "120px")}</div>
  <div class="campo">Escola / Faculdade: ${g(c.escola, "300px")}</div>
  <div class="campo">Curso de Complementação: ${g(c.curso_complementacao, "260px")}</div>
  <div class="sec">IV – Experiências Profissionais</div>
  <div class="campo"><u>Último emprego (ou atual)</u></div>
  <div class="campo">Empresa: ${g(c.exp1_empresa, "280px")} Cidade/UF: ${g(c.exp1_cidade, "150px")}</div>
  <div class="campo">Entrada: ${g(c.exp1_entrada ? formatarData(c.exp1_entrada) : "", "110px")} Saída: ${g(c.exp1_saida ? formatarData(c.exp1_saida) : "", "110px")} Cargo: ${g(c.exp1_cargo, "150px")}</div>
  <div class="campo">Funções: ${g(c.exp1_funcoes, "320px")}</div>
  <div class="campo">Motivo da saída: ${g(c.exp1_motivo, "220px")} Último salário: ${g(c.exp1_salario, "120px")}</div>
  <div class="campo"><u>Penúltimo emprego</u></div>
  <div class="campo">Empresa: ${g(c.exp2_empresa, "280px")} Cidade/UF: ${g(c.exp2_cidade, "150px")}</div>
  <div class="campo">Cargo: ${g(c.exp2_cargo, "150px")} Funções: ${g(c.exp2_funcoes, "260px")}</div>
  <div class="sec">V – Outras Informações</div>
  <div class="campo">Habilidades: ${g([habs, c.habilidades_livre].filter(Boolean).join(" · "), "420px")}</div>
  <div class="campo">Disponibilidade de turno: ${g(turnos, "260px")} &nbsp; Área desejada: ${g(c.area, "200px")}</div>
  <div class="sec">Encaminhamentos</div>
  ${[0, 1, 2].map((i) => {
    const e = encs[i];
    const alvo = e ? [e.empresa_nome, e.cargo_nome].filter(Boolean).join(" — ") : "";
    const contr = !e ? "( ) sim ( ) não"
      : e.status === "contratado" ? "(X) sim ( ) não"
      : e.status === "nao_contratado" ? "( ) sim (X) não" : "( ) sim ( ) não";
    return `<div class="campo">${i + 1}) Encaminhado para ${g(alvo, "300px")} · Contr. ${contr}</div>`;
  }).join("")}
  <p style="margin-top:28px">${dataExtenso()}</p>
  ${assinatura("Assinatura do Candidato")}`;
}

function docNormas(c: Cand): string {
  return `<h1>Declaração de Conhecimento das Normas de Encaminhamento</h1>
  <p>Eu, ${g(c.nome, "320px")} aluno(a) ou ex-aluno(a) do curso ${g(c.cursos_mult || c.curso_mult_atual, "220px")} da turma ${g(c.turma, "90px")}, declaro para devidos fins de direito e a quem ver interesse, ter plena ciência das leis referentes aos serviços de Encaminhamentos exercidos pela empresa MULT Profissões da cidade de Rio Verde – GO, descritas abaixo:</p>
  <ol>
    <li>O(a) aluno(a) ou ex-aluno(a) que for encaminhado a uma empresa parceira e faltar sem uma justificativa prévia, perderá o direito de ser encaminhado novamente.</li>
    <li>O(a) aluno(a) ou ex-aluno(a) que participar de todo o processo seletivo de uma das nossas empresas parceiras, concordando com as exigências necessárias para o preenchimento da vaga e no momento da contratação desistir da vaga, também perderá o direito de ser encaminhado novamente.</li>
    <li>É direito de todo(a) aluno(a) ser encaminhado, mas a Agência de Encaminhamentos da MULT Profissões não garante a contratação dos mesmos.</li>
    <li>É direito de todo(a) aluno ser encaminhado(a) às empresas parceiras, podendo o(a) aluno(a) ao ouvir sobre as exigências da vaga, negar-se a concorrer à vaga.</li>
    <li>Não é de responsabilidade da MULT Profissões, localizada na cidade de Rio Verde - GO, os vínculos empregatícios (assinatura de carteira, contrato de experiências, termos de estágios, pagamentos de salários, etc.), entre alunos e empresas parceiras.</li>
    <li>É de fundamental importância que após a contratação, o(a) aluno(a) compareça na Agência de Encaminhamentos da MULT Profissões com uma foto 3/4, para preenchimento do(s) documento(s) que se fizer(em) necessário(s).</li>
  </ol>
  <p style="margin-top:28px">${dataExtenso()}</p>
  ${assinatura()}`;
}

function docApresentacao(c: Cand, x: DocExtras): string {
  return `<h1>Carta de Apresentação</h1>
  <p style="text-align:right">${dataExtenso()}</p>
  <div class="campo">AO(A) SR(A). ${g(x.destinatario, "300px")}</div>
  <div class="campo">EMPRESA: ${g(x.empresa, "320px")}</div>
  <div class="campo">REF.: PROFISSIONAL PARA O CARGO DE ${g(x.cargo, "260px")}</div>
  <p>NESTA</p>
  <p>Prezado(a) Sr(a).</p>
  <p>Apresentamos nosso(a) aluno(a) ${g(c.nome, "300px")} conforme vossa solicitação, para ocupar o cargo descrito acima nesta conceituada empresa.</p>
  <p>Informamos que o(a) aluno(a) passou por um processo de seleção, no qual foi identificado que tem o perfil para atender a necessidade da empresa para o cargo em questão.</p>
  <p>Portanto, ficamos a vossa inteira disposição para qualquer esclarecimento e/ou informação complementar que se faça necessária. Em caso de aprovação do aluno, solicitamos que entre em contato conosco para que possamos efetivar a baixa em nosso banco de dados.</p>
  <p>Atenciosamente,</p>
  <div class="ass" style="margin-top:36px"><div class="linha"></div>MULT Profissões<br><span class="sub">Cursos Profissionalizantes — Unidade Rio Verde-GO</span></div>`;
}

function docConfirmacao(c: Cand, x: DocExtras): string {
  return `<h1>Carta de Confirmação de Encaminhamento ao Mercado de Trabalho</h1>
  <p>Eu, ${g(c.nome, "300px")}, aluno(a) do curso ${g(c.cursos_mult || c.curso_mult_atual, "220px")} da turma ${g(c.turma, "90px")}, declaro para devidos fins de direito e a quem ver interesse que como previsto no Regulamento de Encaminhamento ao Mercado de Trabalho da MULT Profissões, ter sido devidamente encaminhado ao processo seletivo da Empresa ${g(x.empresa, "240px")}, na cidade de ${g(x.cidade, "160px")}. Fico ciente que toda a responsabilidade sobre a forma de contratação será da empresa contratante, ou seja, a MULT Profissões não se responsabilizará pelo vínculo empregatício estabelecido entre o aluno e a empresa.</p>
  <p style="margin-top:28px">${dataExtenso()}</p>
  ${assinatura()}`;
}

function docParabenizacao(c: Cand): string {
  return `<h1>Carta de Parabenização</h1>
  <p>Prezado(a), ${g(c.nome, "320px")}.</p>
  <p>Todos nós estamos muito felizes por esta conquista em sua vida, torcemos para que esta experiência ajude a torná-lo um profissional de sucesso. Saiba que estaremos sempre presentes quando se fizer necessário.</p>
  <p>Sucesso na sua nova jornada...</p>
  <div class="ass" style="margin-top:40px"><div class="linha"></div>MULT Profissões<br><span class="sub">Unidade de Rio Verde-GO</span></div>`;
}

function docVirtual(c: Cand, x: DocExtras): string {
  const sites = String(x.sites || "").split(/\n/).map((s) => s.trim()).filter(Boolean);
  const linhas = (sites.length ? sites : ["", "", "", ""]).map((s) => `<div class="campo">Site: ${g(s, "360px")}</div>`).join("");
  return `<h1>Confirmação de Encaminhamento Virtual</h1>
  <p>Eu, ${g(c.nome, "300px")} aluno(a) do curso ${g(c.cursos_mult || c.curso_mult_atual, "220px")} da turma ${g(c.turma, "90px")}, declaro para devidos fins de direito e a quem ver interesse que como previsto no Compromisso Público registrado em cartório ter encaminhado os meus dados profissionais e escolares através da MULT Profissões a sites de empresas da cidade e região a fim destas terem conhecimentos das minhas qualificações.</p>
  <p>Segue relação dos sites onde os meus dados foram encaminhados:</p>
  ${linhas}
  <p style="margin-top:28px">${dataExtenso()}</p>
  ${assinatura()}`;
}

function docDesistenciaSeletivo(c: Cand, x: DocExtras): string {
  return `<h1>Desistência de Encaminhamento para Processo Seletivo</h1>
  <p>Eu, ${g(c.nome, "300px")} declaro que fui convidado a participar do processo seletivo do cargo de ${g(x.cargo, "220px")}, da empresa ${g(x.empresa, "220px")}. Porém neste momento não tenho o interesse nesta vaga, desistindo pela ${g(x.vez, "40px")}ª vez de ser encaminhado, passando minha oportunidade para outro candidato.</p>
  <p style="margin-top:28px">${dataExtenso()}</p>
  ${assinatura()}`;
}

function docRelatorioDesistencia(c: Cand, x: DocExtras): string {
  return `<h1>Relatório de Desistência</h1>
  <p>O(a) aluno(a) ${g(c.nome, "320px")}, da turma ${g(c.turma, "90px")}, foi convidado a participar da seleção da empresa ${g(x.empresa, "240px")}, para o cargo ${g(x.cargo, "200px")}, conforme assinou a sua Confirmação de Encaminhamento. O aluno foi escolhido pela empresa para iniciar no cargo em questão. Por motivos de ${g(x.motivo, "260px")}, o mesmo negou-se a iniciar na empresa contratante desistindo da vaga. Por este motivo, a partir deste momento o aluno perde o direito a ser encaminhado novamente.</p>
  <p style="margin-top:28px">${dataExtenso()}</p>
  ${assinatura("Assessor(a) de Encaminhamento")}`;
}

function docDesistenciaPrograma(c: Cand): string {
  return `<h1>Carta de Desistência do Programa de Encaminhamento</h1>
  <p>Eu, ${g(c.nome, "320px")} aluno(a) do curso ${g(c.cursos_mult || c.curso_mult_atual, "220px")}, da turma ${g(c.turma, "90px")}, não tenho interesse em ser encaminhado ao mercado de trabalho. Portanto neste instante desconsidero o meu cadastramento no banco de dados da MULT Profissões.</p>
  <p style="margin-top:28px">${dataExtenso()}</p>
  ${assinatura()}`;
}

function formatarData(iso: string): string {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}

export function gerarDocumentoHTML(tipo: string, c: Cand, x: DocExtras = {}, u?: Uni, encs: Uni[] = []): string {
  let corpo = "";
  switch (tipo) {
    case "solicitacao": corpo = docSolicitacao(c, encs); break;
    case "normas": corpo = docNormas(c); break;
    case "apresentacao": corpo = docApresentacao(c, x); break;
    case "confirmacao": corpo = docConfirmacao(c, x); break;
    case "parabenizacao": corpo = docParabenizacao(c); break;
    case "virtual": corpo = docVirtual(c, x); break;
    case "desistencia_seletivo": corpo = docDesistenciaSeletivo(c, x); break;
    case "relatorio_desistencia": corpo = docRelatorioDesistencia(c, x); break;
    case "desistencia_programa": corpo = docDesistenciaPrograma(c); break;
    default: corpo = `<p>Documento não encontrado.</p>`;
  }
  const rot = DOCS.find((d) => d.id === tipo)?.rot || "Documento";
  return shell(`${rot} — ${c.nome || ""}`, corpo, u);
}
