// Datas fixas de referência: novembro/2026 (os dados de teste vencem em 05/11/2026).
import fs from 'fs';
const S = process.cwd();
const cfg = (auto) => fs.writeFileSync(`${S}/ponte/config.php`, `<?php return ['segredo' => str_repeat('ab', 32), 'unidades' => ['rio_verde' => [
 'banco' => ['dsn' => 'sqlite:${S}/rv.db'], 'agente' => ['usuario_id' => 175, 'login' => 'AGENTE IA'],
 'pix_chave' => '26.436.081/0001-60', 'pix_titular' => 'MULT', 'baixa_automatica' => ${auto} ]]];`);
cfg('false');
Object.assign(process.env, {
  SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k', PONTE_URL: 'http://127.0.0.1:8098/index.php', PONTE_SEGREDO: 'ab'.repeat(32),
  GATEWAY_URL: 'https://gw.test', GATEWAY_KEY: 'g', WEBHOOK_SHARED_SECRET: 'segredo-webhook', GEMINI_API_KEY: 'gem'
});
const { DB, STORAGE } = await import('@supabase/supabase-js');
DB.units.push({ id: 'rio_verde', name: 'MULT Rio Verde', agente_ativo: true, baixa_automatica: false, pix_chave: '26.436.081/0001-60', recebedor_documento: '26436081000160', recebedor_nome: 'MULT PROFISSOES FRANCHISING' });
DB.unit_secrets.push({ unit_id: 'rio_verde', asaas_api_key: 'asaas-key' });

// ---------- fetch simulado ----------
const enviados = [];
const realFetch = globalThis.fetch;
let visao = null;                 // resposta da leitura do próximo comprovante
let asaasPix = [];                // créditos Pix na conta
const fc = (name, args) => ({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name, args } }] } }] });
const tx = (t) => ({ candidates: [{ content: { role: 'model', parts: [{ text: t }] } }] });
function modelo(body) {
  const last = body.contents.at(-1);
  const fr = last.parts.find((p) => p.functionResponse);
  if (fr) {
    const { name, response } = fr.functionResponse; const r = response.resultado;
    if (name === 'confirmar_identidade') return fc('consultar_financeiro', {});
    if (name === 'buscar_por_cpf') return r.encontrado ? tx(`Obrigado, ${r.responsavel}! Achei o cadastro.`) : tx('Não encontrei esse CPF.');
    if (name === 'consultar_financeiro') return tx(`Vencidos: ${r.vencidos.map((v) => `${v.aluno} ${v.vencimento} ${v.valor_hoje}`).join('; ') || 'nenhum'}. Próximos: ${r.proximos.map((v) => `${v.aluno} ${v.vencimento} ${v.valor_ate_vencimento}`).join('; ')}`);
    if (name === 'enviar_carne') return tx(r.enviado ? 'Prontinho, enviei o carnê!' : 'Não consegui: ' + JSON.stringify(r));
    if (name === 'agendar_pagamento') return tx(r.agendado ? 'Agendado!' : 'Erro: ' + JSON.stringify(r));
    if (name === 'chamar_humano') return tx('Vou passar para a secretaria.');
    return tx('ok');
  }
  const txt = last.parts.map((p) => p.text || '').join('');
  const sys = body.systemInstruction.parts[0].text;
  if (/quanto devo/i.test(txt) && /Identidade confirmada: NÃO/.test(sys)) return tx('Olá! Falo com José, responsável por Ana, Bruno e Carla?');
  if (/^sim/i.test(txt)) return fc('confirmar_identidade', { grupo: 1 });
  if (/carn/i.test(txt)) return fc('enviar_carne', { cod_alu: '20001' });
  if (/pagar dia/i.test(txt)) return fc('agendar_pagamento', { cod_alu: '20001', vencimento: '10/09/2026', data_pagamento: '10/11/2026' });
  if (/desconto/i.test(txt)) return fc('chamar_humano', { motivo: 'Pediu desconto' });
  const cpf = txt.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  if (cpf) return fc('buscar_por_cpf', { cpf: cpf[0] });
  return tx('Como posso ajudar?');
}
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  if (url.startsWith('http://127.0.0.1:8098')) return realFetch(url, opt);
  if (url.startsWith('https://gw.test/send')) { const b = JSON.parse(opt.body); enviados.push(b); return json({ status: 'sent', msgId: 'out' + enviados.length }); }
  if (url.includes('generativelanguage')) {
    const b = JSON.parse(opt.body);
    if (b.generationConfig?.responseMimeType === 'application/json') return json(tx(JSON.stringify(visao)));
    return json(modelo(b));
  }
  if (url.includes('api.asaas.com')) {
    if (url.includes('/pix/transactions')) {
      const u = new URL(url); const e2e = u.searchParams.get('endToEndIdentifier');
      return json({ data: e2e ? asaasPix.filter((p) => p.endToEndIdentifier === e2e) : asaasPix, hasMore: false });
    }
    return json({ data: [], hasMore: false });
  }
  throw new Error('fetch inesperado ' + url);
};

const { default: webhook } = await import('./api/whatsapp-webhook.js');
async function chega(payload) {
  let status, body;
  const res = { status(s) { status = s; return this; }, json(b) { body = b; return this; } };
  await webhook({ method: 'POST', headers: { 'x-webhook-secret': 'segredo-webhook' }, body: { unitId: 'rio_verde', ...payload } }, res);
  return body;
}
const ultima = (n = 1) => enviados.slice(-n).map((e) => e.message + (e.document ? ` [PDF ${e.document.fileName}]` : '')).join(' | ');
let falhas = 0;
const ok = (nome, cond, extra = '') => { if (!cond) falhas++; console.log((cond ? '  ok  ' : 'FALHA ') + nome + (cond ? '' : '  -> ' + extra)); };
let id = 0;
const msg = (phone, message) => chega({ phone, message, messageId: 'in' + ++id, senderName: 'Contato' });
const arq = (phone, nome, conteudo) => { const p = `rio_verde/2026-11/in${++id}_${nome}`; STORAGE.set(p, Buffer.from(conteudo)); return chega({ phone, messageId: 'in' + id, mediaKind: 'image', mediaPath: p, mediaMimeType: 'image/jpeg', mediaFileName: nome }); };

console.log('== Cenário A: pai com 3 filhos');
const PAI = '5564999990001';
let r = await msg(PAI, 'oi, quanto devo?');
ok('pede confirmação citando os filhos', /Ana, Bruno e Carla/.test(ultima()), ultima() + JSON.stringify(r));
await msg(PAI, 'sim sou eu');
ok('confirma e informa vencidos com juros (Ana 10/09)', /Ana Da Silva 10\/09\/2026 R\$/.test(ultima()), ultima());
ok('não lista a parcela placeholder de R$ 0,01', !/0,01/.test(ultima()), ultima());
const conv = DB.conversas.find((c) => c.telefone === PAI);
ok('conversa confirmada com 3 alunos', conv.identidade_confirmada && conv.cod_alus.length === 3);
await msg(PAI, 'manda o carnê da Ana');
ok('carnê enviado como PDF', enviados.some((e) => e.document?.fileName?.startsWith('carne_20001')), ultima(2));
await msg(PAI, 'vou pagar dia 10');
ok('agendamento registrado', /Agendado/.test(ultima()), ultima());
await msg(PAI, 'quero desconto');
ok('desconto vai para humano', DB.conversas.find((c) => c.telefone === PAI).status === 'aguardando_humano');
const antes = enviados.length;
await msg(PAI, 'alô?');
ok('com humano, a IA não responde', enviados.length === antes);

console.log('== Cenário B: comprovante do Edilson (telefone cadastrado)');
const ED = '5564988880002';
visao = { e_comprovante: true, tipo: 'pix', valor: 180, data: '2026-11-02', end_to_end_id: 'E1234567890123456789012345678901', recebedor_nome: 'MULT PROFISSOES FRANCHISING', recebedor_documento: '26.436.081/0001-60', legivel: true };
asaasPix = [{ id: 'pix_1', value: 180, endToEndIdentifier: 'E1234567890123456789012345678901', effectiveDate: '2026-11-02 10:00:00' }];
await arq(ED, 'comprovante.jpg', 'arquivo-1');
let c1 = DB.comprovantes.at(-1);
ok('modo sombra: pronto para baixa', c1.status === 'sombra_ok', c1.status + ' ' + c1.observacao);
ok('Pix conferido no extrato', c1.extrato_conferido === true);
ok('parcelas de novembro sugeridas', JSON.stringify(c1.cod_pars) === '[326669,326670]', JSON.stringify(c1.cod_pars));
ok('resposta ao aluno', /Recebi seu comprovante de R\$\s?180,00/.test(ultima()), ultima());
ok('pendência para a secretaria', DB.pendencias.some((p) => p.comprovante_id === c1.id));
await arq(ED, 'comprovante_de_novo.jpg', 'arquivo-1');
ok('mesmo arquivo = duplicado', DB.comprovantes.at(-1).status === 'duplicado');

console.log('== Cenário B2: baixa automática ligada');
cfg('true'); DB.units[0].baixa_automatica = true; await new Promise((r) => setTimeout(r, 3000));
visao = { ...visao, end_to_end_id: 'E9999999999999999999999999999999' };
asaasPix.push({ id: 'pix_2', value: 180, endToEndIdentifier: 'E9999999999999999999999999999999', effectiveDate: '2026-11-02 11:00:00' });
await arq(ED, 'pix_novembro.pdf', 'arquivo-2');
let c2 = DB.comprovantes.at(-1);
ok('baixado automaticamente', c2.status === 'baixado', c2.status + ' ' + c2.observacao);
ok('mensagem de confirmação', /confirmado e registrado/.test(ultima()), ultima());
const { execSync } = await import('child_process');
const q = (sql) => execSync(`php -r '$p=new PDO("sqlite:${S}/rv.db"); foreach($p->query("${sql}") as $r) echo json_encode($r),"\\n";'`).toString();
ok('parcela baixada no sistema', /"VLR_COB":"90,00"/.test(q('SELECT VLR_COB FROM s_cad_parcela WHERE COD_PAR=326669')), q('SELECT * FROM s_cad_parcela WHERE COD_PAR=326669'));

console.log('== Cenário B2b: Pix no extrato, mas comprovante sem código E2E');
visao = { ...visao, end_to_end_id: null, valor: 180 };
asaasPix.push({ id: 'pix_3', value: 180, endToEndIdentifier: 'E5555555555555555555555555555555', effectiveDate: '2026-11-02 12:00:00' });
await arq(ED, 'print_sem_e2e.jpg', 'arquivo-5');
let c5 = DB.comprovantes.at(-1);
ok('sem E2E não baixa sozinho (fica para a secretaria)', c5.status === 'sombra_ok' && c5.extrato_conferido === true, c5.status + ' ' + c5.observacao);

console.log('== Cenário B3: Pix que não está no extrato');
visao = { ...visao, valor: 180, end_to_end_id: 'E0000000000000000000000000000000' };
await arq(ED, 'pix_falso.jpg', 'arquivo-3');
let c3 = DB.comprovantes.at(-1);
ok('não baixa sem extrato', c3.status === 'aguardando_humano' && !c3.extrato_conferido, c3.status + ' ' + c3.observacao);

console.log('== Cenário C: telefone desconhecido');
const NOVO = '5564911112222';
visao = { e_comprovante: true, tipo: 'pix', valor: 149.90 + 149.90 * 0.0033 * 53, data: '2026-11-02', end_to_end_id: null, recebedor_nome: 'MULT PROFISSOES FRANCHISING', recebedor_documento: '26436081000160', legivel: true };
await arq(NOVO, 'pix_ana.jpg', 'arquivo-4');
let c4 = DB.comprovantes.at(-1);
ok('pede CPF antes de registrar', c4.status === 'aguardando_aluno' && /CPF/.test(ultima()), c4.status + ' ' + ultima());
await msg(NOVO, 'meu cpf é 111.222.333-44');
c4 = DB.comprovantes.find((c) => c.id === c4.id);
ok('após CPF, comprovante reprocessado', c4.status !== 'aguardando_aluno', c4.status + ' ' + c4.observacao);
console.log('   ->', c4.status, '|', c4.observacao);
console.log('== Simulador: mesmo fluxo, sem WhatsApp e sem gravar no sistema');
{
  const { processarEntrada } = await import('./api/_lib/entrada.js');
  const { contexto } = await import('./api/_lib/contexto.js');
  const enviadosAntes = enviados.length;
  const ocoAntes = q('SELECT COUNT(*) AS n FROM s_cad_agend_pag');
  const sim = (message) => contexto.run({ simulacao: true }, () => processarEntrada({ unitId: 'rio_verde', phone: PAI, message, messageId: 'sim' + ++id }, { canal: 'simulador' }));
  await sim('oi, quanto devo?');
  await sim('sim sou eu');
  await sim('vou pagar dia 10');
  const cs = DB.conversas.find((c) => c.telefone === PAI && c.canal === 'simulador');
  ok('conversa do simulador separada da real', !!cs && cs.id !== DB.conversas.find((c) => c.telefone === PAI && c.canal === 'whatsapp').id);
  ok('respostas gravadas na conversa simulada', DB.mensagens.filter((m) => m.conversa_id === cs.id && m.autor === 'ia').length >= 3);
  ok('nenhuma mensagem saiu pelo WhatsApp', enviados.length === enviadosAntes);
  ok('agendamento não gravado no sistema escolar', q('SELECT COUNT(*) AS n FROM s_cad_agend_pag') === ocoAntes);
  ok('ação registrada como simulada', DB.registro_acoes.some((r) => r.acao === 'agendar_pagamento (simulado)'));
}

console.log('\nMensagens enviadas:', enviados.length, '| registro de erros:', DB.registro_acoes.filter((x) => !x.ok && x.tipo !== 'ia').map((x) => x.acao + ':' + JSON.stringify(x.detalhe)).slice(0, 5));
console.log(falhas ? `${falhas} FALHA(S)` : 'Tudo certo.');
process.exit(falhas ? 1 : 0);
