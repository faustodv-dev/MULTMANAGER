# Gateway WhatsApp — financeiro

Cópia do `mult-whatsapp-gateway` (CRM comercial) com três mudanças:

1. **Recebe imagem e PDF** (comprovantes). O arquivo vai para o Supabase Storage
   (bucket privado `whatsapp-midia`) e o webhook recebe só o caminho (`mediaPath`).
2. **Envia documentos** (carnê em PDF): `POST /send` aceita
   `document: { base64, fileName, mimeType }`, com `message` como legenda.
3. **Auto-ping** a cada 10 min pela URL pública, para o plano Free não dormir.
4. **Sem senhas padrão**: o serviço não inicia sem as variáveis abaixo.
   O follow-up automático do comercial fica desligado (`FUP_ENABLED`).

## Render

Novo *Web Service* apontando para este repositório, **Root Directory = `gateway`**,
Build `npm install`, Start `npm start`, Node 20.

| Variável | Valor |
|---|---|
| `API_KEY` | segredo forte (mín. 24). O mesmo valor vai na Vercel como `GATEWAY_KEY` |
| `ADMIN_KEY` | segredo para a página de QR/status (mín. 16) |
| `WEBHOOK_URL` | `https://<app>.vercel.app/api/whatsapp-webhook` |
| `WEBHOOK_SHARED_SECRET` | segredo (mín. 24), igual na Vercel |
| `SUPABASE_URL` | URL do projeto Supabase novo |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service role do projeto novo |
| `MAX_MEDIA_MB` | opcional, padrão 10 |
| `KEEPALIVE` | opcional; padrão liga o auto-ping a cada 10 min (evita o sono do plano Free) |

Primeira conexão: abra `https://<gateway>.onrender.com/?key=<ADMIN_KEY>` e leia o QR
com o número da unidade. A sessão fica salva no Supabase (`whatsapp_sessions`).
