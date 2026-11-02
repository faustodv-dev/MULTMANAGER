# Implantação — passo a passo

Ordem sugerida (cada passo pode ser testado antes do próximo). Segredos **nunca** vão para
o GitHub nem para o chat: só nos painéis (cPanel, Render, Vercel).

## 1. Supabase (já criado)
Projeto **MULT CRM Pedagogico** (São Paulo), tabelas e regras aplicadas.
- Pegue a **service role key** em *Project Settings → API Keys* (vai na Vercel e no Render).
- *Authentication → URL Configuration*: coloque a URL da Vercel em **Site URL** depois do passo 4.

## 2. Ponte no cPanel
Siga `ponte/README.md`. Resumo:
1. Crie em `dados_usuarios` (banco `neto_rioverde`) o usuário **AGENTE IA** e anote o `ID`.
2. Subdomínio `ponte.multprofissoes.com.br` → pasta própria, **PHP 8.1** no MultiPHP.
3. Copie a pasta `ponte/` do repositório para lá.
4. `config.php` a partir de `config.example.php`: banco, `usuario_id` do agente, segredo
   (`php -r "echo bin2hex(random_bytes(32));"`), `baixa_automatica => false`.

## 3. Gateway no Render
Novo Web Service deste repositório, **Root Directory `gateway`**, variáveis em `gateway/README.md`.
`WEBHOOK_URL` = `https://<seu-app>.vercel.app/api/whatsapp-webhook`.

## 4. Vercel
Novo projeto importando `faustodv-dev/multmanager` (framework Vite, raiz do repositório).
**Não use o projeto `multmanager` existente — ele é o CRM comercial.**
Variáveis (Production): ver `.env.example`.

| Variável | De onde vem |
|---|---|
| `VITE_SUPABASE_URL` | `https://jrdrglfzvloxqbuuxhaq.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys (publishable) |
| `SUPABASE_URL` | igual ao de cima |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys (secret/service role) |
| `PONTE_URL` / `PONTE_SEGREDO` | passo 2 |
| `GATEWAY_URL` / `GATEWAY_KEY` | passo 3 (`GATEWAY_KEY` = `API_KEY` do Render) |
| `WEBHOOK_SHARED_SECRET` | o mesmo do Render |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | as mesmas do comercial (ou novas) |

## 5. Primeiro acesso
1. Abra o app, **Criar conta** com `faustodv@gmail.com` (já nasce como master).
2. *Unidades → Diagnóstico das integrações*: ponte `banco: true` e gateway `http: 200`.
3. *Usuários*: crie o admin de Rio Verde e os colaboradores com as telas de cada um.

## 6. WhatsApp
Abra `https://<gateway>.onrender.com/?key=<ADMIN_KEY>` e leia o QR com o número do financeiro.

## 7. Asaas
No Supabase, tabela `unit_secrets`: insira `unit_id = rio_verde` e `asaas_api_key`
(Asaas → Integração → Chave de API). Sem ela o sistema funciona, mas nada é conferido no extrato.

## 8. Testes em modo sombra (recomendado: 1 semana)
- Envie mensagens e comprovantes de teste; acompanhe em *Atendimento* e *Comprovantes*.
- Comprovantes ficam "Pronto p/ baixa": a secretaria baixa no sistema e marca como resolvido.
- Para ligar a baixa automática: `baixa_automatica => true` no `config.php` da ponte **e** a chave
  *Baixa automática* em *Unidades*. Ela só baixa Pix localizado no Asaas pelo código E2E.
