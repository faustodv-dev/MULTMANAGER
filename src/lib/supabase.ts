import { createClient } from "@supabase/supabase-js";

// Chaves públicas (a segurança está nas regras RLS do banco)
const URL = import.meta.env.VITE_SUPABASE_URL || "https://jrdrglfzvloxqbuuxhaq.supabase.co";
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_XFaHZ2htSVpWOHT1IOvPjQ_4E9xl7y5";

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Papel = "master" | "admin" | "colaborador";
export type Modulo = "atendimento" | "comprovantes" | "financeiro" | "configuracoes";

export interface Perfil {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
  unit_id: string | null;
  departamento: string | null;
  modulos: Modulo[];
  ativo: boolean;
}

export interface Unidade {
  id: string;
  name: string;
  whatsapp_status: string | null;
  whatsapp_number: string | null;
  agente_ativo: boolean;
  baixa_automatica: boolean;
  pix_chave: string | null;
  recebedor_documento: string | null;
  recebedor_nome: string | null;
  atendimento_humano: string | null;
}

export interface Conversa {
  id: string;
  unit_id: string;
  telefone: string;
  nome_contato: string | null;
  status: "ia" | "aguardando_humano" | "humano" | "encerrada";
  motivo_humano: string | null;
  atribuido_a: string | null;
  nome_responsavel: string | null;
  cod_alus: string[];
  identidade_confirmada: boolean;
  contexto: any;
  nao_lidas: number;
  ultima_mensagem: string | null;
  ultimo_contato: string;
}

export interface Mensagem {
  id: string;
  conversa_id: string;
  direcao: "in" | "out";
  autor: "contato" | "ia" | "humano" | "sistema";
  texto: string | null;
  midia_path: string | null;
  midia_tipo: string | null;
  midia_nome: string | null;
  status_envio: string | null;
  criado_em: string;
}

export interface Comprovante {
  id: string;
  unit_id: string;
  conversa_id: string | null;
  telefone: string;
  remetente_nome: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  mime: string | null;
  recebido_em: string;
  status: string;
  extraido: any;
  valor_centavos: number | null;
  data_pagamento: string | null;
  end_to_end_id: string | null;
  recebedor_ok: boolean | null;
  extrato_conferido: boolean | null;
  cod_alus: string[];
  cod_pars: number[];
  observacao: string | null;
  resolvido_em: string | null;
}

/** URL temporária para abrir um arquivo do WhatsApp. */
export async function urlArquivo(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("whatsapp-midia").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/** Chama as APIs do servidor (Vercel) com o token do usuário. */
export async function api<T = any>(caminho: string, corpo: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(`/api/${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.mensagem || j.erro || `Erro ${r.status}`);
  return j as T;
}

export const reais = (c: number | null | undefined) =>
  c == null ? "—" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const telefoneBonito = (t: string) => {
  const d = t.replace(/\D/g, "").replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : t;
};
