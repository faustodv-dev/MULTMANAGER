import { CFG, registrar } from './base.js';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ = 'https://api.groq.com/openai/v1/chat/completions';

// Modelo sobrecarregado (503/429) ou lento fica de lado por 2 min nesta instância
const esfriando = new Map();
const disponivel = (m) => (esfriando.get(m) || 0) < Date.now();

async function geminiChamar(modelo, corpo, chave, timeoutMs) {
  const r = await fetch(`${GEMINI}/${encodeURIComponent(modelo)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j?.error?.message || `gemini_http_${r.status}`);
    e.http = r.status;
    throw e;
  }
  return j;
}

/** Tenta os modelos Gemini em ordem; devolve a primeira resposta válida. */
async function gemini(corpo, { chave, timeoutMs = 15000, modelos = CFG.geminiModelos, unitId, conversaId, rotulo }) {
  let ultimoErro;
  const ordem = [...modelos.filter(disponivel), ...modelos.filter((m) => !disponivel(m))];
  for (const m of ordem) {
    const inicio = Date.now();
    try {
      const j = await geminiChamar(m, corpo, chave, timeoutMs);
      const cand = j?.candidates?.[0];
      if (!cand?.content?.parts?.length) throw new Error('resposta_vazia:' + (cand?.finishReason || 'sem_candidato'));
      await registrar('ia', rotulo, true, { unitId, conversaId, duracaoMs: Date.now() - inicio, detalhe: { modelo: m } });
      return cand.content;
    } catch (e) {
      ultimoErro = e;
      if (e.http === 503 || e.http === 429 || /timeout|aborted|demand/i.test(e.message)) esfriando.set(m, Date.now() + 120000);
      await registrar('ia', rotulo, false, { unitId, conversaId, duracaoMs: Date.now() - inicio, detalhe: { modelo: m, erro: e.message } });
    }
  }
  throw ultimoErro || new Error('gemini_indisponivel');
}

/** Extrai JSON de um documento/imagem (comprovante). */
export async function lerArquivoJson({ base64, mime, instrucao, chave, unitId, conversaId }) {
  const conteudo = await gemini(
    {
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: base64 } }, { text: instrucao }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' }
    },
    { chave: chave || CFG.geminiKey, timeoutMs: 30000, unitId, conversaId, rotulo: 'ler_arquivo' }
  );
  const texto = conteudo.parts.map((p) => p.text || '').join('');
  return JSON.parse(texto.replace(/^```json\s*|```$/g, '').trim());
}

/** Transcreve áudio curto. */
export async function transcrever({ base64, mime, chave, unitId, conversaId }) {
  const conteudo = await gemini(
    {
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime || 'audio/ogg', data: base64 } }, { text: 'Transcreva fielmente este áudio em português. Responda só com a transcrição.' }] }],
      generationConfig: { temperature: 0 }
    },
    { chave: chave || CFG.geminiKey, timeoutMs: 25000, unitId, conversaId, rotulo: 'transcrever' }
  );
  return conteudo.parts.map((p) => p.text || '').join('').trim();
}

/**
 * Loop do agente com ferramentas. `ferramentas` = [{ nome, descricao, parametros (JSON Schema), executar(args) }].
 * Usa Gemini; se todos os modelos falharem, usa Groq (formato OpenAI).
 * Retorna { texto, chamadas: [{nome, args, resultado}] }.
 */
export async function agente({ sistema, historico, ferramentas, chaves = {}, unitId, conversaId, maxPassos = 6, prazoMs = 40000 }) {
  const inicio = Date.now();
  const chamadas = [];
  const mapa = Object.fromEntries(ferramentas.map((f) => [f.nome, f]));
  const executar = async (nome, args) => {
    const f = mapa[nome];
    let resultado;
    try {
      resultado = f ? await f.executar(args || {}) : { erro: 'ferramenta_desconhecida' };
    } catch (e) {
      resultado = { erro: e.codigo || 'falha', mensagem: e.message };
    }
    chamadas.push({ nome, args, resultado });
    return resultado;
  };

  const chaveGemini = chaves.gemini || CFG.geminiKey;
  if (chaveGemini) {
    try {
      const contents = historico.map((h) => ({ role: h.papel === 'assistente' ? 'model' : 'user', parts: [{ text: h.texto }] }));
      const tools = [{
        functionDeclarations: ferramentas.map((f) => ({ name: f.nome, description: f.descricao, parameters: f.parametros }))
      }];
      for (let passo = 0; passo < maxPassos; passo++) {
        const restante = prazoMs - (Date.now() - inicio);
        if (restante < 4000) break;
        const conteudo = await gemini(
          { systemInstruction: { parts: [{ text: sistema }] }, contents, tools, generationConfig: { temperature: 0.4 } },
          { chave: chaveGemini, timeoutMs: Math.min(15000, restante - 1000), unitId, conversaId, rotulo: 'agente' }
        );
        contents.push(conteudo);
        const fcs = conteudo.parts.filter((p) => p.functionCall);
        if (!fcs.length) {
          const texto = conteudo.parts.map((p) => (p.thought ? '' : p.text || '')).join('').trim();
          return { texto, chamadas };
        }
        const respostas = [];
        for (const p of fcs) {
          const r = await executar(p.functionCall.name, p.functionCall.args);
          respostas.push({ functionResponse: { name: p.functionCall.name, response: { resultado: r } } });
        }
        contents.push({ role: 'user', parts: respostas });
      }
      return { texto: '', chamadas, esgotado: true };
    } catch (e) {
      if (!(chaves.groq || CFG.groqKey)) throw e;
    }
  }

  // Reserva: Groq
  const chaveGroq = chaves.groq || CFG.groqKey;
  if (!chaveGroq) throw new Error('sem_chave_ia');
  const mensagens = [{ role: 'system', content: sistema }, ...historico.map((h) => ({ role: h.papel === 'assistente' ? 'assistant' : 'user', content: h.texto }))];
  const tools = ferramentas.map((f) => ({ type: 'function', function: { name: f.nome, description: f.descricao, parameters: f.parametros } }));
  for (let passo = 0; passo < maxPassos; passo++) {
    const restante = prazoMs - (Date.now() - inicio);
    if (restante < 3000) break;
    let j;
    for (const modelo of CFG.groqModelos) {
      const t0 = Date.now();
      try {
        const r = await fetch(GROQ, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chaveGroq}` },
          body: JSON.stringify({ model: modelo, messages: mensagens, tools, temperature: 0.4 }),
          signal: AbortSignal.timeout(Math.min(20000, restante - 500))
        });
        j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message || `groq_http_${r.status}`);
        await registrar('ia', 'agente_groq', true, { unitId, conversaId, duracaoMs: Date.now() - t0, detalhe: { modelo } });
        break;
      } catch (e) {
        j = null;
        await registrar('ia', 'agente_groq', false, { unitId, conversaId, duracaoMs: Date.now() - t0, detalhe: { modelo, erro: e.message } });
      }
    }
    const msg = j?.choices?.[0]?.message;
    if (!msg) throw new Error('ia_indisponivel');
    mensagens.push(msg);
    if (!msg.tool_calls?.length) return { texto: String(msg.content || '').trim(), chamadas };
    for (const tc of msg.tool_calls) {
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
      const r = await executar(tc.function.name, args);
      mensagens.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(r) });
    }
  }
  return { texto: '', chamadas, esgotado: true };
}
