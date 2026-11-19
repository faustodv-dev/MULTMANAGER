-- Etapa 2.5: a ficha do candidato passa a espelhar a "Solicitação de Encaminhamento"
-- que o aluno preenche à mão hoje. Uns campos alimentam o match aprimorado
-- (condução, experiência na área, habilidades); outros são só cadastro/PDF.

-- Dados pessoais / contato
alter table public.candidatos add column if not exists estado_civil text;
alter table public.candidatos add column if not exists endereco text;
alter table public.candidatos add column if not exists numero text;
alter table public.candidatos add column if not exists complemento text;
alter table public.candidatos add column if not exists cidade text;
alter table public.candidatos add column if not exists uf text;
alter table public.candidatos add column if not exists cep text;
alter table public.candidatos add column if not exists email text;
alter table public.candidatos add column if not exists recado text;
alter table public.candidatos add column if not exists falar_com text;
alter table public.candidatos add column if not exists conducao text;      -- match: 'nao'|'carro'|'moto'|'ambos'

-- Dados familiares (só cadastro/PDF)
alter table public.candidatos add column if not exists pai_nome text;
alter table public.candidatos add column if not exists pai_profissao text;
alter table public.candidatos add column if not exists mae_nome text;
alter table public.candidatos add column if not exists mae_profissao text;
alter table public.candidatos add column if not exists conjuge_nome text;
alter table public.candidatos add column if not exists conjuge_profissao text;
alter table public.candidatos add column if not exists num_filhos integer;
alter table public.candidatos add column if not exists idades_filhos text;

-- Situação educacional
alter table public.candidatos add column if not exists estuda boolean not null default false;
alter table public.candidatos add column if not exists estuda_curso text;
alter table public.candidatos add column if not exists estuda_periodo text;
alter table public.candidatos add column if not exists estuda_serie text;
alter table public.candidatos add column if not exists escola text;
alter table public.candidatos add column if not exists curso_complementacao text;
alter table public.candidatos add column if not exists curso_mult_atual text;
alter table public.candidatos add column if not exists turma text;
alter table public.candidatos add column if not exists periodo_mult text;

-- Experiência profissional (último e penúltimo emprego) + habilidades
alter table public.candidatos add column if not exists exp_area text;           -- match: área da experiência (mesmo dicionário)
alter table public.candidatos add column if not exists habilidades text[] not null default '{}'; -- match: tags
alter table public.candidatos add column if not exists habilidades_livre text;   -- PDF: texto livre
alter table public.candidatos add column if not exists exp1_empresa text;
alter table public.candidatos add column if not exists exp1_cidade text;
alter table public.candidatos add column if not exists exp1_uf text;
alter table public.candidatos add column if not exists exp1_fone text;
alter table public.candidatos add column if not exists exp1_entrada date;
alter table public.candidatos add column if not exists exp1_saida date;
alter table public.candidatos add column if not exists exp1_cargo text;
alter table public.candidatos add column if not exists exp1_funcoes text;
alter table public.candidatos add column if not exists exp1_motivo text;
alter table public.candidatos add column if not exists exp1_salario text;
alter table public.candidatos add column if not exists exp2_empresa text;
alter table public.candidatos add column if not exists exp2_cidade text;
alter table public.candidatos add column if not exists exp2_uf text;
alter table public.candidatos add column if not exists exp2_fone text;
alter table public.candidatos add column if not exists exp2_entrada date;
alter table public.candidatos add column if not exists exp2_saida date;
alter table public.candidatos add column if not exists exp2_cargo text;
alter table public.candidatos add column if not exists exp2_funcoes text;
alter table public.candidatos add column if not exists exp2_motivo text;
alter table public.candidatos add column if not exists exp2_salario text;

-- Vaga ganha os mesmos critérios novos
alter table public.vagas add column if not exists conducao_exigida boolean not null default false;
alter table public.vagas add column if not exists habilidades text[] not null default '{}';
