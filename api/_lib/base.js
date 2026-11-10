import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const limpar = (v) => String(v || '').replace(/[\r\n\s]+/g, '');
const url = (v) => String(v || '').trim().replace(/\/+$/, '');

export const CFG = {
  supabaseUrl: url(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
  supabaseServiceKey: limpar(process.env.SUPABASE_SERVICE_ROLE_KEY),
  supabaseAnonKey: limpar(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
  ponteUrl: url(process.env.PONTE_URL),
  ponteSegredo: limpar(process.env.PONTE_SEGREDO),
  gatewayUrl: url(process.env.GATEWAY_URL),
  gatewayKey: limpar(process.env.GATEWAY_KEY),
  webhookSecret: limpar(process.env.WEBHOOK_SHARED_SECRET),
  geminiKey: limpar(process.env.GEMINI_API_KEY),
  geminiModelos: String(process.env.GEMINI_MODELS || 'gemini-flash-latest,gemini-flash-lite-latest')
    .split(',').map((s) => s.trim()).filter(Boolean),
  groqKey: limpar(process.env.GROQ_API_KEY),
  // llama-3.3-70b-versatile foi aposentado pela Groq em 16/08/2026. Padrão agora em modelos
  // GA com function-calling; a lista é tentada em ordem (ver ia.js), então vão dois de reserva.
  groqModelos: String(process.env.GROQ_MODELS || 'openai/gpt-oss-120b,llama-3.1-8b-instant').split(',').map((s) => s.trim()).filter(Boolean),
  asaasSandbox: String(process.env.ASAAS_SANDBOX || '').toLowerCase() === 'true',
  asaasWebhookToken: limpar(process.env.ASAAS_WEBHOOK_TOKEN),
  cronSecret: limpar(process.env.CRON_SECRET),
  bucket: 'whatsapp-midia'
};

export function faltandoConfig(chaves) {
  return chaves.filter((k) => !CFG[k]);
}

export const supabase = createClient(CFG.supabaseUrl || 'https://invalido.supabase.co', CFG.supabaseServiceKey || 'sem-chave', {
  auth: { persistSession: false, autoRefreshToken: false }
});

export function igual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function registrar(tipo, acao, ok, { unitId = null, conversaId = null, duracaoMs = null, detalhe = null } = {}) {
  try {
    await supabase.from('registro_acoes').insert({
      tipo, acao, ok, unit_id: unitId, conversa_id: conversaId, duracao_ms: duracaoMs, detalhe
    });
  } catch {}
}

export const hojeSP = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export const reais = (centavos) =>
  'R$ ' + (Number(centavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

export const digitos = (s) => String(s || '').replace(/\D+/g, '');

/** Valida CPF pelos dígitos verificadores (não só o tamanho). */
export function cpfValido(cpf) {
  const d = digitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dig = (base) => {
    let soma = 0;
    for (let i = 0; i < base; i++) soma += Number(d[i]) * (base + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}

/** Autentica o usuário do CRM pelo token do Supabase enviado no cabeçalho. */
export async function usuarioDaRequisicao(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: perfil } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  if (!perfil || !perfil.ativo) return null;
  return perfil;
}

export function podeModulo(perfil, unitId, modulo) {
  if (!perfil?.ativo) return false;
  if (perfil.papel === 'master') return true;
  if (perfil.unit_id !== unitId) return false;
  return perfil.papel === 'admin' || (perfil.modulos || []).includes(modulo);
}

export async function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}
