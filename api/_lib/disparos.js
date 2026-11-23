import { supabase, digitos, hojeSP, registrar } from './base.js';

/**
 * Agendador central anti-bloqueio. Antes de qualquer régua enfileirar, classifica cada
 * destinatário e agenda o `agendado_para` de forma segura:
 *  - ABERTA  = teve mensagem RECEBIDA nas últimas 24h → é resposta (janela do WhatsApp),
 *              baixo risco: vai logo, com pequeno espaçamento.
 *  - NOVA    = sem recebida recente → conversa nova (o que o WhatsApp pune): respeita o
 *              TETO DIÁRIO por unidade (editável pelo admin), distribui ao longo dos dias
 *              e espalha dentro da janela diurna. O que passa do teto rola pro dia seguinte,
 *              por prioridade.
 * O jitter fino de envio (delay humano entre mensagens) fica no gateway — pendência.
 */

const TETO_PADRAO = 40;
const rand = (min, max) => min + Math.random() * (max - min);

export async function configDisparos(unitId) {
  const { data } = await supabase.from('units').select('disparos').eq('id', unitId).maybeSingle();
  const d = (data && data.disparos) || {};
  return {
    teto_novas_dia: Number.isInteger(d.teto_novas_dia) && d.teto_novas_dia > 0 ? d.teto_novas_dia : TETO_PADRAO,
    janela_ini: Number.isInteger(d.janela_ini) ? Math.min(22, Math.max(5, d.janela_ini)) : 8,
    janela_fim: Number.isInteger(d.janela_fim) ? Math.min(23, Math.max(6, d.janela_fim)) : 20,
  };
}

function proximosDias(n) {
  const base = new Date(`${hojeSP()}T12:00:00-03:00`);
  const dias = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    dias.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return dias;
}

// Telefones (em dígitos) com mensagem RECEBIDA nas últimas 24h = conversa aberta.
async function telefonesAbertos(unitId, telefones) {
  const alvo = new Set(telefones.map((t) => digitos(t)));
  if (!alvo.size) return new Set();
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: msgs } = await supabase.from('mensagens')
    .select('conversa_id').eq('unit_id', unitId).eq('direcao', 'in').gt('criado_em', desde).limit(8000);
  const convIds = [...new Set((msgs || []).map((m) => m.conversa_id).filter(Boolean))];
  const abertos = new Set();
  for (let i = 0; i < convIds.length; i += 300) {
    const { data: cs } = await supabase.from('conversas').select('telefone').in('id', convIds.slice(i, i + 300));
    (cs || []).forEach((c) => { const d = digitos(c.telefone || ''); if (alvo.has(d)) abertos.add(d); });
  }
  return abertos;
}

// Novas já agendadas/enviadas por dia (p/ respeitar o teto entre rodadas e réguas).
async function novasPorDia(unitId, desdeDia) {
  const { data } = await supabase.from('fila_mensagens')
    .select('agendado_para').eq('unit_id', unitId).neq('status', 'cancelado')
    .contains('metadata', { conversa: 'nova' }).gte('agendado_para', `${desdeDia}T00:00:00-03:00`).limit(10000);
  const map = {};
  (data || []).forEach((r) => { const dia = String(r.agendado_para || '').slice(0, 10); if (dia) map[dia] = (map[dia] || 0) + 1; });
  return map;
}

// Horário dentro da janela diurna do dia, pela posição, com jitter de minutos.
function slotNoDia(dia, idxNoDia, cfg) {
  const janela = Math.max(1, cfg.janela_fim - cfg.janela_ini);
  const frac = (idxNoDia - 0.5) / Math.max(1, cfg.teto_novas_dia);
  const h = cfg.janela_ini + Math.min(0.999, frac) * janela;
  const base = new Date(`${dia}T00:00:00-03:00`).getTime();
  let t = base + h * 3600 * 1000 + rand(-4, 4) * 60000;
  return new Date(Math.max(t, Date.now() + 30000)).toISOString();
}

/**
 * Recebe os itens de uma régua e devolve com `agendado_para` + metadata.conversa
 * já calculados (aberta/nova, teto, janela). Pode devolver MENOS itens do que entrou
 * se estourar a capacidade de ~14 dias (raro) — isso é proteção, não bug.
 */
export async function agendarComLimite(unitId, itens) {
  const lista = (itens || []).filter((i) => i && i.telefone);
  if (!lista.length) return [];
  const cfg = await configDisparos(unitId);
  const abertos = await telefonesAbertos(unitId, lista.map((i) => i.telefone));

  const abertasItens = [];
  const novasItens = [];
  for (const it of lista) (abertos.has(digitos(it.telefone)) ? abertasItens : novasItens).push(it);

  const out = [];
  const agora = Date.now();
  let acc = 0;
  for (const it of abertasItens) {
    acc += rand(18, 45) * 1000;
    out.push({ ...it, agendado_para: new Date(agora + acc).toISOString(), metadata: { ...(it.metadata || {}), conversa: 'aberta' } });
  }

  // Novas: prioridade desc (evasão/consec antes de cobrança), depois distribui por dia.
  novasItens.sort((a, b) => (b.prioridade || 5) - (a.prioridade || 5));
  const dias = proximosDias(14);
  const usadas = await novasPorDia(unitId, dias[0]);
  let di = 0;
  let descartadas = 0;
  for (const it of novasItens) {
    while (di < dias.length && (usadas[dias[di]] || 0) >= cfg.teto_novas_dia) di++;
    if (di >= dias.length) { descartadas++; continue; }
    const dia = dias[di];
    const idxNoDia = (usadas[dia] = (usadas[dia] || 0) + 1);
    out.push({ ...it, agendado_para: slotNoDia(dia, idxNoDia, cfg), metadata: { ...(it.metadata || {}), conversa: 'nova' } });
  }
  if (descartadas > 0) {
    await registrar('disparos', 'teto_estourado', false, { unitId, detalhe: { descartadas, teto: cfg.teto_novas_dia } });
  }
  return out;
}

/** Fotografia p/ a Central de Disparos: baseline (15 dias), teto e uso de hoje. */
export async function panoramaDisparos(unitId) {
  const cfg = await configDisparos(unitId);
  const hoje = hojeSP();
  const desde15 = new Date(Date.now() - 15 * 86400000).toISOString();

  // Baseline: média de telefones distintos que receberam régua por dia (15 dias).
  const { data: env } = await supabase.from('fila_mensagens')
    .select('telefone, enviado_em').eq('unit_id', unitId).eq('status', 'enviado')
    .like('origem', 'regua_%').gt('enviado_em', desde15).limit(20000);
  const porDia = {};
  (env || []).forEach((r) => { const d = String(r.enviado_em || '').slice(0, 10); if (!d) return; (porDia[d] = porDia[d] || new Set()).add(r.telefone); });
  const diasAtivos = Object.keys(porDia).length || 1;
  const somaDistintos = Object.values(porDia).reduce((s, set) => s + set.size, 0);
  const media15 = Math.round(somaDistintos / diasAtivos);

  // Hoje: novas e abertas já agendadas/enviadas.
  const { data: hojeRows } = await supabase.from('fila_mensagens')
    .select('metadata, status').eq('unit_id', unitId).neq('status', 'cancelado')
    .like('origem', 'regua_%').gte('agendado_para', `${hoje}T00:00:00-03:00`).lt('agendado_para', `${hoje}T23:59:59-03:00`).limit(10000);
  let novasHoje = 0, abertasHoje = 0;
  (hojeRows || []).forEach((r) => { const t = r.metadata?.conversa; if (t === 'nova') novasHoje++; else if (t === 'aberta') abertasHoje++; });

  // Novas roladas para os próximos dias.
  const futuras = await novasPorDia(unitId, proximosDias(2)[1]);
  const roladas = Object.values(futuras).reduce((s, n) => s + n, 0);

  return {
    teto: cfg.teto_novas_dia, janela_ini: cfg.janela_ini, janela_fim: cfg.janela_fim,
    media15, sugestao_teto: Math.max(cfg.teto_novas_dia, Math.ceil(media15 * 1.2)),
    novas_hoje: novasHoje, abertas_hoje: abertasHoje, roladas_futuro: roladas,
  };
}

export function mesclarDisparos(salva) {
  const d = (salva && typeof salva === 'object') ? salva : {};
  return {
    teto_novas_dia: Number.isInteger(d.teto_novas_dia) && d.teto_novas_dia > 0 ? Math.min(500, d.teto_novas_dia) : TETO_PADRAO,
    janela_ini: Number.isInteger(d.janela_ini) ? Math.min(22, Math.max(5, d.janela_ini)) : 8,
    janela_fim: Number.isInteger(d.janela_fim) ? Math.min(23, Math.max(6, d.janela_fim)) : 20,
  };
}
