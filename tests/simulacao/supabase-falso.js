// Supabase em memória (só o que o código usa)
import crypto from 'crypto';
export const DB = { units: [], unit_secrets: [], conversas: [], mensagens: [], comprovantes: [], pendencias: [], registro_acoes: [], profiles: [] };
export const STORAGE = new Map();
const uniq = { conversas: [['unit_id','telefone']], mensagens: [['unit_id','wa_message_id']] };
const defaults = {
  conversas: () => ({ status: 'ia', cod_alus: [], identidade_confirmada: false, contexto: {}, nao_lidas: 0, ultimo_contato: new Date().toISOString(), processando_ate: null }),
  comprovantes: () => ({ status: 'recebido', cod_alus: [], cod_pars: [], recebido_em: new Date().toISOString() }),
  mensagens: () => ({ criado_em: new Date(Date.now() + DB.mensagens.length).toISOString() }),
  pendencias: () => ({ criado_em: new Date().toISOString(), resolvido_em: null }),
};
class Q {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.cnt = false; this.ord = null; this.lim = null; }
  select(_c, o) { if (this.op === 'select') this.op = 'select'; this.ret = true; if (o?.count) { this.cnt = true; this.head = o.head; } return this; }
  eq(k, v) { this.f.push((r) => r[k] === v); return this; }
  neq(k, v) { this.f.push((r) => r[k] !== v); return this; }
  gt(k, v) { this.f.push((r) => r[k] > v); return this; }
  gte(k, v) { this.f.push((r) => r[k] >= v); return this; }
  lte(k, v) { this.f.push((r) => r[k] <= v); return this; }
  is(k, v) { this.f.push((r) => (r[k] ?? null) === v); return this; }
  not(k, op, v) {
    if (op === 'in') { const l = v.replace(/[()]/g, '').split(','); this.f.push((r) => !l.includes(r[k])); }
    if (op === 'is') this.f.push((r) => (r[k] ?? null) !== null);
    return this;
  }
  order(k, o) { this.ord = [k, o?.ascending !== false]; return this; }
  limit(n) { this.lim = n; return this; }
  insert(row) { this.op = 'insert'; this.row = row; return this; }
  upsert(row) { this.op = 'upsert'; this.row = row; return this; }
  update(p) { this.op = 'update'; this.patch = p; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  single() { this.one = 'single'; return this; }
  then(res, rej) { try { res(this.run()); } catch (e) { rej(e); } }
  rows() { return DB[this.t].filter((r) => this.f.every((f) => f(r))); }
  run() {
    const T = DB[this.t];
    let out;
    if (this.op === 'insert' || this.op === 'upsert') {
      const novos = (Array.isArray(this.row) ? this.row : [this.row]).map((r) => ({ id: crypto.randomUUID(), ...(defaults[this.t]?.() || {}), ...r }));
      for (const n of novos) {
        for (const u of uniq[this.t] || []) {
          const dup = T.find((x) => u.every((k) => x[k] != null && x[k] === n[k]));
          if (dup) { if (this.op === 'upsert') { Object.assign(dup, this.row); out = [dup]; continue; } return { data: null, error: { code: '23505' } }; }
        }
        T.push(n); out = [...(out || []), n];
      }
    } else if (this.op === 'update') {
      out = this.rows(); out.forEach((r) => Object.assign(r, JSON.parse(JSON.stringify(this.patch))));
    } else {
      out = this.rows();
      if (this.ord) { const [k, a] = this.ord; out = [...out].sort((x, y) => (x[k] > y[k] ? 1 : -1) * (a ? 1 : -1)); }
      if (this.lim) out = out.slice(0, this.lim);
    }
    out = JSON.parse(JSON.stringify(out || []));
    if (this.cnt) return { count: out.length, data: this.head ? null : out, error: null };
    if (this.one) { if (this.one === 'single' && !out.length) return { data: null, error: { message: 'no rows' } }; return { data: out[0] ?? null, error: null }; }
    return { data: out, error: null };
  }
}
export function createClient() {
  return {
    from: (t) => new Q(t),
    rpc: async (n, a) => {
      const c = DB.conversas.find((x) => x.id === a.p_id);
      if (c.processando_ate && c.processando_ate > new Date().toISOString()) return { data: false };
      c.processando_ate = new Date(Date.now() + 55000).toISOString(); return { data: true };
    },
    storage: { from: () => ({
      download: async (p) => ({ data: { arrayBuffer: async () => STORAGE.get(p) } }),
      upload: async (p, b) => { STORAGE.set(p, b); return { data: {}, error: null }; },
    }) },
    auth: { getUser: async () => ({ data: null }) },
  };
}
