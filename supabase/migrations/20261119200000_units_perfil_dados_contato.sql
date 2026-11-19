-- Perfil da unidade: dados de contato que alimentam os agentes de atendimento
-- e o rodapé dos documentos. Em branco fica em branco (todos nullable).
alter table public.units add column if not exists endereco text;
alter table public.units add column if not exists numero text;
alter table public.units add column if not exists bairro text;
alter table public.units add column if not exists cep text;
alter table public.units add column if not exists cidade text;
alter table public.units add column if not exists uf text;
alter table public.units add column if not exists instagram text;
alter table public.units add column if not exists site text;
alter table public.units add column if not exists email text;
alter table public.units add column if not exists telefone_fixo text;
alter table public.units add column if not exists horario text;
alter table public.units add column if not exists razao_social text;
alter table public.units add column if not exists cnpj text;
