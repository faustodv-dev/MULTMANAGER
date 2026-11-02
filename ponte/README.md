# Ponte — CRM ↔ sistema escolar

Arquivos PHP que ficam no servidor cPanel, ao lado dos bancos `neto_*`. O CRM (Vercel)
chama a ponte por HTTPS; a ponte é a única peça que toca o banco do sistema escolar.

- PHP 8.0+ com PDO MySQL. O servidor usa PHP-FPM, então a versão vale por domínio/subdomínio, não por pasta:
  instale numa pasta de um subdomínio que já rode PHP 8.0+ (ex.: `cobranca.multprofissoes.com.br/ponte`).
- Um único código para todas as unidades: cada unidade é uma entrada em `config.php`.
- Só faz o que as telas fazem, com os mesmos campos e formatos.

## O que ela faz

| Ação | Tipo | O que é |
|---|---|---|
| `ping`, `unidade` | leitura | teste de conexão e dados da franquia |
| `buscar_telefone`, `buscar_cpf` | leitura | alunos agrupados por **CPF do responsável**, com todos os dependentes |
| `aluno` | leitura | cadastro e matrículas |
| `parcelas` | leitura | parcelas em aberto em **documentos** (mesmo aluno + vencimento), com valor devido na data |
| `conciliar` | leitura | quais documentos um valor pago quita exatamente |
| `frequencia`, `ocorrencias`, `agendamentos`, `cartas` | leitura | apoio ao atendimento |
| `simular_baixa` | leitura | mostra a baixa que seria feita (modo sombra) |
| `baixar` | escrita | baixa idêntica à manual: `s_cad_parcela` + `contabil` + `f_cad_saldo` (C e G) + ocorrência Informativo |
| `registrar_ocorrencia` | escrita | ocorrência **Informativo** (nunca muda status de matrícula) |
| `agendar_pagamento` | escrita | `s_cad_agend_pag` + ocorrência `agend_pag` |
| `registrar_carta` | escrita | `historico_carta` (histórico de envios do WhatsApp) |
| `carne` | escrita | PDF do carnê; grava o código de barras nas parcelas como a impressão faz |

### Regras de valor (iguais ao carnê)
- Documento = parcelas em aberto do mesmo aluno com o mesmo vencimento.
- Valor do documento = soma − R$ 30 × (n − 1).
- Até o vencimento: − R$ 30 de pontualidade (total = R$ 30 por parcela). Rescisão não tem.
- Depois do vencimento: valor do documento + 0,33% ao dia sobre ele.
- Parcelas abaixo de R$ 1,00 (placeholders "0.01") são ignoradas.

### Travas de segurança da baixa
- Só baixa **documentos completos** e com o **valor exato** devido na data do pagamento.
- Nunca grava desconto acima de R$ 30 por parcela (isso exige justificativa da secretaria).
- `LOCK TABLES` durante a baixa (as tabelas são MyISAM, sem transação) e revalidação sob trava.
- Toda escrita fica em `ponte_log` (criada automaticamente) com **chave de idempotência**:
  a mesma chave nunca baixa duas vezes.
- `baixa_automatica: false` (modo sombra) faz a ponte recusar a baixa real.

## Instalação no cPanel

1. **Usuário do agente**: em `dados_usuarios` do banco da unidade, crie um usuário
   (ex.: login `AGENTE IA`, status Inativo para não logar no sistema). Anote o `ID`.
2. **Pasta**: crie um subdomínio, por exemplo `ponte.multprofissoes.com.br`, apontando
   para uma pasta fora do sistema antigo (ex.: `/home/neto/ponte`).
3. **PHP**: o subdomínio precisa estar em PHP 8.0 ou mais novo (Gerenciador de MultiPHP).
4. **Código**: em *Git Version Control*, clone `https://github.com/faustodv-dev/multmanager`
   e copie o conteúdo da pasta `ponte/` para a pasta do subdomínio (ou use SSH:
   `cp -r ~/repositories/multmanager/ponte/* ~/ponte/`).
5. **Configuração**: copie `config.example.php` para `config.php` e preencha banco,
   `usuario_id` do agente e o segredo (`php -r "echo bin2hex(random_bytes(32));"`).
6. **SSL**: confirme o certificado do subdomínio em *SSL/TLS Status*.
7. **Teste**: a Vercel chama `ping`; a resposta deve trazer `"banco": true`.

## Testes
```
php ponte/tests/run.php
```
Usa SQLite com a mesma estrutura das tabelas e dados fictícios (inclui o exemplo do
carnê 2 × R$ 120,00 = R$ 210,00 / R$ 180,00 em dia / R$ 216,93 com 10 dias de atraso).
