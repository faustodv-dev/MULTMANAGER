# MULT Manager — mapa de infraestrutura (LEIA ANTES DE MEXER)

> Existem **DOIS sistemas separados** que se parecem mas **não compartilham banco, Vercel nem gateway**.
> Confundir os dois já causou bug (drenador da fila deployado no gateway errado). **Confirme sempre em qual sistema você está.**

## 🟢 PEDAGÓGICO (este repositório — MULTMANAGER)
É aqui que vivem régua de cobrança, régua de faltantes, fila, ocorrências, atendimento pedagógico.

| Peça | Onde |
|---|---|
| Repo (front + API Vercel) | `faustodv-dev/MULTMANAGER` (este) |
| Vercel | projeto **`mult-financeiro`** (`mult-financeiro.vercel.app`) — Hobby, **limite de 12 Serverless Functions** |
| Supabase | **`jrdrglfzvloxqbuuxhaq`** = "MULT CRM Pedagogico" (região sa-east-1) |
| IDs de unidade | **amigáveis**: `rio_verde`, `aparecida_goiania`, `anapolis`, `agua_boa`, `bom_jesus` |
| Gateway WhatsApp | serviço **`mult-financeiro-gateway`**, projeto Render **"Gateway Pedagogico"** (`prj-dbkca68473hc738940b0`), **em OUTRA conta Render** (outro usuário, criada para não estourar banda do free). Repo do gateway NÃO está na conta GitHub `faustodv-dev`. |
| Ponte (banco escolar) | PHP no cPanel do cliente (HMAC); `PONTE_URL`/`PONTE_SEGREDO` no Vercel `mult-financeiro` |
| A FILA (`fila_mensagens`) | vive **só** em `jrdrglfzvloxqbuuxhaq`. O drenador da fila **tem que rodar no `mult-financeiro-gateway`** e ler ESTE banco. |

## 🔵 COMERCIAL / AI Studio (NÃO é este projeto)
Separado. Só serviu de **inspiração**. **Nunca** deployar mudança do pedagógico aqui.

| Peça | Onde |
|---|---|
| Repo | `faustodv-dev/AISTUDIO-MULTMANAGER` |
| Vercel | projeto **`multmanager`** (`multmanager.vercel.app`) |
| Supabase | **`mpzupaofcmuaiiitgzud`** = "Mult Manager CRM" |
| IDs de unidade | **aleatórios** (ex.: `Q60oB7mFhvUZy1zsboAV` = Rio Verde). Se você vê ids aleatórios, está no sistema COMERCIAL. |
| Gateway WhatsApp | serviço **`mult-whatsapp-gateway`**, repo `faustodv-dev/mult-whatsapp-gateway`, Render **"My Workspace"** (`tea-db7rcvrncjis73fav8ag`, conta `faustodv@gmail.com`). ⚠️ **Este é o COMERCIAL. NÃO mexer para o pedagógico.** |

## Como saber em qual você está (checagem rápida)
- IDs de unidade **amigáveis** (`rio_verde`) → pedagógico (`jrdrglfzvloxqbuuxhaq`).
- IDs **aleatórios** (`Q60oB7...`) → comercial (`mpzupaofcmuaiiitgzud`).
- O banco comercial **não tem** `fila_mensagens`/`regua`; o pedagógico tem.

## Regras de ouro
1. Não podemos estragar o que já funciona. Cada subetapa precisa de autorização antes de codar.
2. Vercel pedagógico é **Hobby**: não ultrapassar **12 funções** em `api/*.js` (dobrar lógica em endpoints existentes, não criar rota nova). Não migrar para Pro sem combinar.
3. Gateways são **free tier**: um gateway always-on por sistema (vários estouram as 750h). Keep-awake externo mantém de pé; após deploy, a instância reconecta as sessões sozinha a partir do Supabase.
4. Régua financeira segue por envio direto (Vercel→gateway HTTP) até migrarmos para a fila com o fix do log de hora real.
5. No fim de tudo: rotacionar o segredo exposto (ponte + `PONTE_SEGREDO`) e a senha do banco escolar (`neto_ponte`).
