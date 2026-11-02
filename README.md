# MULT Manager — CRM pedagógico e financeiro

Atendimento financeiro pelo WhatsApp integrado ao sistema escolar da MULT Profissões.

```
WhatsApp ──► gateway/ (Render, Baileys) ──► api/whatsapp-webhook (Vercel, agente IA)
                                                  │
                     Supabase (conversas, comprovantes, usuários) ◄──┤
                                                  │
                     ponte/ (PHP no cPanel) ──► MySQL do sistema escolar (neto_*)
                     Asaas (extrato Pix) ◄────────┘
```

| Pasta | O que é |
|---|---|
| `ponte/` | PHP que lê e grava no sistema escolar do mesmo jeito que as telas (ver `ponte/README.md`) |
| `gateway/` | servidor WhatsApp (cópia do gateway do comercial + imagens/PDF) |
| `api/` | funções da Vercel: agente, comprovantes, APIs das telas |
| `src/` | telas: Atendimento, Comprovantes, Usuários, Unidades |
| `supabase/migrations/` | banco (projeto `MULT CRM Pedagogico`) |

## Regras principais
- **Identificação**: pelo telefone + confirmação do nome, ou pelo CPF. Um responsável (CPF) pode ter vários alunos.
- **Valores**: R$ 30 de pontualidade por parcela até o vencimento; depois, valor do carnê + 0,33% ao dia.
- **Comprovantes**: leitura por IA → duplicidade → recebedor (CNPJ da unidade) → parcelas exatas →
  Pix no extrato Asaas → baixa automática (se ligada) ou modo sombra (ocorrência + pendência para a secretaria).
- **Humano**: desconto, acordo, cancelamento, reclamação ou qualquer dúvida fora do financeiro vão para a secretaria.
- **Acesso**: master geral, admin por unidade e colaboradores com telas liberadas no cadastro.

## Variáveis
Veja `.env.example` (Vercel) e `gateway/README.md` (Render).
