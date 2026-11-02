import { supabase, registrar } from './base.js';
import { obterUnidade, segredosUnidade, obterOuCriarConversa, salvarMensagem, atualizarConversa } from './conversa.js';
import { receberArquivo } from './comprovante.js';
import { atender } from './atendente.js';
import { transcrever } from './ia.js';
import { simulando } from './contexto.js';
import { moverCardConversa } from './crmcards.js';

/**
 * Processa uma mensagem recebida (do gateway ou do simulador) e responde pelo agente.
 * Arquivos (foto/PDF) vão para o fluxo de comprovantes; textos e áudios vão para o agente.
 * Retorna um código de status curto.
 */
export async function processarEntrada(p, { canal = 'whatsapp' } = {}) {
  const unitId = String(p.unitId || '').trim();
  const telefone = String(p.phone || '').replace(/\D/g, '');
  if (!unitId || telefone.length < 10) return 'ignorado';

  try {
    const unidade = await obterUnidade(unitId);
    if (!unidade) return 'unidade_desconhecida';

    let conversa = await obterOuCriarConversa(unitId, telefone, { remoteJid: p.remoteJid, nome: p.senderName, canal });

    // Mensagem digitada no celular da escola: a secretaria assumiu a conversa
    if (p.fromMe) {
      if (p.message) {
        await salvarMensagem(conversa, { direcao: 'out', autor: 'humano', texto: String(p.message), wa_message_id: p.messageId || null });
        if (conversa.status === 'ia' || conversa.status === 'aguardando_humano') {
          await atualizarConversa(conversa.id, { status: 'humano', motivo_humano: 'Secretaria respondeu pelo celular' });
        }
        // A secretaria respondeu → a bola fica com o aluno
        await moverCardConversa(conversa, 'aguardando').catch(() => null);
      }
      return 'registrado_humano';
    }

    const segredos = await segredosUnidade(unitId);

    // Áudio: transcreve para o agente entender
    let texto = String(p.message || '').trim();
    if (!texto && p.audioBase64) {
      try {
        texto = await transcrever({ base64: p.audioBase64, mime: p.audioMimeType, chave: segredos.gemini, unitId, conversaId: conversa.id });
        texto = texto ? `🎤 ${texto}` : '';
      } catch {
        texto = '';
      }
      if (!texto) texto = '[áudio que não consegui ouvir]';
    }

    const mensagem = await salvarMensagem(conversa, {
      direcao: 'in',
      autor: 'contato',
      texto: texto || null,
      midia_path: p.mediaPath || null,
      midia_tipo: p.mediaMimeType || null,
      midia_nome: p.mediaFileName || null,
      wa_message_id: p.messageId || null
    });
    if (!mensagem) return 'duplicada';
    // Se já existe card desta conversa, o contato escreveu → volta para "Em andamento"
    await moverCardConversa(conversa, 'andamento').catch(() => null);

    // Com a secretaria no comando (ou agente desligado), só registra
    if (conversa.status === 'humano' || conversa.status === 'aguardando_humano' || !unidade.agente_ativo) {
      if (p.mediaKind && p.mediaPath) {
        await supabase.from('comprovantes').insert({
          unit_id: unitId, conversa_id: conversa.id, mensagem_id: mensagem.id, telefone,
          remetente_nome: conversa.nome_contato || p.senderName || null, arquivo_path: p.mediaPath,
          arquivo_nome: p.mediaFileName, mime: p.mediaMimeType, status: 'aguardando_humano',
          observacao: 'Recebido com a conversa em atendimento humano.', simulacao: simulando()
        });
      }
      return conversa.status === 'ia' ? 'agente_desligado' : 'humano';
    }
    if (conversa.status === 'encerrada') {
      conversa = await atualizarConversa(conversa.id, { status: 'ia' });
    }

    // Arquivos (comprovantes) são processados sempre, mesmo com o agente ocupado na conversa
    if (p.mediaKind && (p.mediaPath || p.mediaTooLarge || p.mediaError)) {
      await receberArquivo({ conversa, unidade, segredos, payload: p, mensagem });
      // Se veio legenda junto, o agente também responde a ela
      if (!texto) return 'arquivo_processado';
      conversa = (await supabase.from('conversas').select('*').eq('id', conversa.id).single()).data;
      if (conversa.status !== 'ia') return 'arquivo_processado';
    }

    // Uma execução do agente por conversa; mensagens seguidas são lidas juntas
    const { data: travou } = await supabase.rpc('travar_conversa', { p_id: conversa.id, p_segundos: 55 });
    if (!travou) return 'em_andamento';

    const inicio = new Date().toISOString();
    try {
      // Espera curta para juntar mensagens enviadas em sequência (no simulador não precisa)
      if (!simulando()) await new Promise((r) => setTimeout(r, 2500));
      for (let rodada = 0; rodada < 2; rodada++) {
        conversa = (await supabase.from('conversas').select('*').eq('id', conversa.id).single()).data;
        if (conversa.status !== 'ia') break;
        await atender({ conversa, unidade, segredos });
        const { count } = await supabase.from('mensagens').select('id', { count: 'exact', head: true })
          .eq('conversa_id', conversa.id).eq('direcao', 'in').gt('criado_em', inicio).neq('id', mensagem.id);
        if (!count || rodada === 1) break;
      }
      return 'respondido';
    } finally {
      await supabase.from('conversas').update({ processando_ate: null }).eq('id', conversa.id);
    }
  } catch (e) {
    await registrar('webhook', 'erro', false, { unitId, detalhe: { erro: e.message, canal, stack: String(e.stack || '').slice(0, 800) } });
    return 'erro: ' + e.message;
  }
}
