<?php
declare(strict_types=1);

namespace Ponte;

/**
 * Escritas no sistema escolar, reproduzindo exatamente o que as telas fazem:
 *  - baixa: baixarparcelaaj.php + function_cont.php (parcela, contabil, saldo C e G)
 *  - ocorrência Informativo e Agendamento de Pagamento: addocorrencia.php
 *  - histórico de cartas
 *  - código de barras do carnê: print_boleto.php (OP 4)
 */
final class Financeiro
{
    private Registro $registro;

    /**
     * @param array<string,mixed> $agente usuario_id (dados_usuarios.ID) e login (texto em PRO_OCO)
     */
    public function __construct(private Db $db, private Escola $escola, private array $agente, private ?\DateTimeImmutable $relogio = null)
    {
        $this->registro = new Registro($db);
    }

    private function agora(): \DateTimeImmutable
    {
        return $this->relogio ?? new \DateTimeImmutable('now', new \DateTimeZone('America/Sao_Paulo'));
    }

    /**
     * Calcula (e, se $simular for falso, executa) a baixa de documentos completos.
     *
     * @param array<int,int> $codPars parcelas a baixar (devem formar documentos completos)
     */
    public function baixar(array $codPars, int $valorPago, string $dataPagamento, string $chave, bool $simular, string $origem, string $detalhe = '', bool $confiarValor = false): array
    {
        $dataPagamento = Texto::dataIso($dataPagamento);
        if ($dataPagamento === '') {
            throw new ErroPonte('data_invalida', 'Data de pagamento inválida.');
        }
        if ($dataPagamento > $this->agora()->format('Y-m-d')) {
            throw new ErroPonte('data_futura', 'Data de pagamento no futuro.');
        }
        $codPars = array_values(array_unique(array_map('intval', $codPars)));
        if (!$codPars || $valorPago <= 0) {
            throw new ErroPonte('parametros', 'Informe as parcelas e o valor pago.');
        }
        if (!$simular) {
            if ($chave === '') {
                throw new ErroPonte('chave_obrigatoria', 'Baixa real exige chave de idempotência.');
            }
            if ($ant = $this->registro->anterior($chave)) {
                return $ant;
            }
        }

        $plano = $this->planejarBaixa($codPars, $valorPago, $dataPagamento, $confiarValor);
        $req = ['cod_pars' => $codPars, 'valor_pago' => $valorPago, 'data_pagamento' => $dataPagamento, 'origem' => $origem, 'detalhe' => $detalhe];
        if ($simular) {
            return ['simulacao' => true] + $plano;
        }

        $tabelas = [
            's_cad_parcela' => 'WRITE', 'contabil' => 'WRITE', 'f_cad_saldo' => 'WRITE',
            's_cad_ocorrencia' => 'WRITE', 'ponte_log' => 'WRITE',
            's_cad_aluno' => 'READ', 's_cad_matricula' => 'READ',
        ];
        $passos = [];
        $this->db->travar($tabelas);
        try {
            // Revalida sob trava: ninguém baixou essas parcelas desde o planejamento
            $in = implode(',', array_fill(0, count($codPars), '?'));
            $abertas = $this->db->todos(
                "SELECT COD_PAR FROM s_cad_parcela WHERE COD_PAR IN ($in) AND (DAT_BAI IS NULL OR DAT_BAI = '')",
                $codPars
            );
            if (count($abertas) !== count($codPars)) {
                throw new ErroPonte('parcela_ja_baixada', 'Alguma parcela já foi baixada por outra pessoa.', [], 409);
            }

            $usuario = (string)$this->agente['usuario_id'];
            foreach ($plano['parcelas'] as $p) {
                $vlrCob = Texto::moedaSistema($p['valor_cobrado']);
                $vlrDes = Texto::subtracaoLegada($p['vlr_par_texto'], $vlrCob);
                $n = $this->db->executar(
                    "UPDATE s_cad_parcela SET VLR_COB = ?, DAT_BAI = ?, VLR_DES = ?
                     WHERE COD_PAR = ? AND (DAT_BAI IS NULL OR DAT_BAI = '')",
                    [$vlrCob, $dataPagamento, $vlrDes, $p['cod_par']]
                );
                if ($n !== 1) {
                    throw new ErroPonte('falha_baixa', 'Falha ao baixar a parcela ' . $p['cod_par'], ['passos' => $passos], 500);
                }
                $passos[] = "parcela {$p['cod_par']} baixada";

                // function_cont.php: insert_reg()
                [$mat, $obs] = $this->descricaoContabil($p['cod_par']);
                $this->db->executar(
                    'INSERT INTO contabil (DATA_LAN, CODI_FOR, CODI_TIPO_LAN, DESC_CON, DEBI_CRED, VLR_CON, CODI_USU, COD_FIN)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [$dataPagamento, $mat, '1', $obs, 'C', Texto::moedaContabil($p['valor_cobrado']), $usuario, (string)$p['cod_par']]
                );
                $passos[] = "contabil {$p['cod_par']}";
            }

            // function_cont.php: update_saldo('+') soma o total nos saldos C e G
            foreach (['C', 'G'] as $tipo) {
                $s = $this->db->um('SELECT ID, VALOR FROM f_cad_saldo WHERE TIPO = ? LIMIT 1', [$tipo]);
                if ($s) {
                    $novo = (int)round(((float)$s['VALOR']) * 100) + $plano['valor_pago'];
                    $this->db->executar('UPDATE f_cad_saldo SET VALOR = ? WHERE ID = ?', [Texto::moedaContabil($novo), $s['ID']]);
                } else {
                    $this->db->executar('INSERT INTO f_cad_saldo (TIPO, VALOR) VALUES (?, ?)', [$tipo, Texto::moedaContabil($plano['valor_pago'])]);
                }
                $passos[] = "saldo $tipo";
            }

            // Ocorrência Informativo em cada aluno envolvido
            $ocorrencias = [];
            foreach ($plano['por_aluno'] as $codAlu => $info) {
                $texto = sprintf(
                    'PAGAMENTO RECEBIDO VIA WHATSAPP - %s em %s - parcela(s) %s. Baixa automática pelo %s.%s',
                    Texto::reais($info['valor']),
                    Texto::dataBr($dataPagamento),
                    implode('/', $info['cod_pars']),
                    $this->agente['login'],
                    $detalhe !== '' ? ' ' . $detalhe : ''
                );
                $ocorrencias[] = $this->inserirOcorrencia((string)$codAlu, $info['matricula'], 'Informativo', $texto, '');
            }
            $passos[] = 'ocorrencias';

            $resultado = ['baixado' => true] + $plano + ['ocorrencias' => $ocorrencias];
            $this->registro->gravar('baixar', $chave, 'ok', $req, $resultado);
            return $resultado;
        } catch (\Throwable $e) {
            try {
                $this->registro->gravar('baixar', $chave, count($passos) ? 'incompleta' : 'erro', $req, ['erro' => $e->getMessage(), 'passos' => $passos]);
            } catch (\Throwable) {
            }
            if (count($passos) && !($e instanceof ErroPonte && $e->codigo === 'parcela_ja_baixada')) {
                throw new ErroPonte('baixa_incompleta', 'A baixa parou no meio. Conferência manual necessária.', ['passos' => $passos, 'erro' => $e->getMessage()], 500);
            }
            throw $e;
        } finally {
            $this->db->destravar();
        }
    }

    /**
     * Confere as parcelas, monta os documentos completos e o rateio do valor pago.
     * Nunca aceita valor diferente do devido nem desconto acima de R$ 30 por parcela.
     */
    public function planejarBaixa(array $codPars, int $valorPago, string $dataPagamento, bool $confiarValor = false): array
    {
        $in = implode(',', array_fill(0, count($codPars), '?'));
        $rows = $this->db->todos("SELECT COD_PAR, COD_ALU, DAT_BAI, VLR_PAR FROM s_cad_parcela WHERE COD_PAR IN ($in)", $codPars);
        if (count($rows) !== count($codPars)) {
            throw new ErroPonte('parcela_inexistente', 'Parcela não encontrada.');
        }
        $vlrTexto = [];
        foreach ($rows as $r) {
            if (!empty($r['DAT_BAI'])) {
                throw new ErroPonte('parcela_ja_baixada', 'A parcela ' . $r['COD_PAR'] . ' já está baixada.', [], 409);
            }
            $vlrTexto[(int)$r['COD_PAR']] = (string)$r['VLR_PAR'];
        }
        $alunos = array_values(array_unique(array_map(fn($r) => (string)$r['COD_ALU'], $rows)));
        $abertas = $this->escola->parcelasEmAberto($alunos, $dataPagamento);

        $selecionados = [];
        $cobertas = [];
        foreach ($abertas['documentos'] as $doc) {
            $inter = array_intersect($doc['cod_pars'], $codPars);
            if (!$inter) {
                continue;
            }
            if (count($inter) !== count($doc['cod_pars'])) {
                throw new ErroPonte(
                    'documento_incompleto',
                    'O carnê de ' . Texto::dataBr($doc['vencimento']) . ' tem mais parcelas (' . implode('/', $doc['cod_pars']) . '). A baixa parcial deve ser feita pela secretaria.',
                    ['documento' => $doc]
                );
            }
            $selecionados[] = $doc;
            $cobertas = array_merge($cobertas, $doc['cod_pars']);
        }
        $fora = array_diff($codPars, $cobertas);
        if ($fora) {
            throw new ErroPonte('parcela_invalida', 'Parcela(s) sem valor válido para baixa automática: ' . implode(', ', $fora));
        }
        $devido = array_sum(array_column($selecionados, 'valor_devido'));
        if (abs($devido - $valorPago) > 1 && !$confiarValor) {
            throw new ErroPonte('valor_divergente', sprintf(
                'Valor pago %s difere do devido %s em %s.',
                Texto::reais($valorPago),
                Texto::reais($devido),
                Texto::dataBr($dataPagamento)
            ), ['valor_devido' => $devido, 'documentos' => $selecionados]);
        }
        // Pagamento já confirmado (ex.: Asaas): distribui o valor recebido entre os
        // documentos, mantendo todas as demais travas (documento completo, desconto ≤ 30).
        if ($confiarValor && $devido > 0 && $devido !== $valorPago) {
            $acum = 0;
            $ult = array_key_last($selecionados);
            foreach ($selecionados as $k => &$d) {
                $v = $k === $ult ? $valorPago - $acum : (int)round($valorPago * $d['valor_devido'] / $devido);
                $d['valor_devido'] = $v;
                $acum += $v;
            }
            unset($d);
        }

        $parcelas = [];
        $porAluno = [];
        foreach ($selecionados as $i => $doc) {
            // diferença de 1 centavo vai para o último documento
            if (!$confiarValor && $i === array_key_last($selecionados)) {
                $doc['valor_devido'] += $valorPago - $devido;
            }
            foreach (Calculo::rateio($doc) as $cod => $cobrado) {
                $p = current(array_filter($doc['parcelas'], fn($x) => $x['cod_par'] === $cod));
                $desconto = $p['valor'] - $cobrado;
                if ($desconto > Calculo::DESCONTO_POR_PARCELA) {
                    throw new ErroPonte('desconto_acima_limite', 'Desconto acima de R$ 30 exige justificativa da secretaria.');
                }
                $parcelas[] = [
                    'cod_par' => $cod,
                    'cod_alu' => $doc['cod_alu'],
                    'num_matricula' => $p['num_matricula'],
                    'vencimento' => $doc['vencimento'],
                    'valor_parcela' => $p['valor'],
                    'vlr_par_texto' => $vlrTexto[$cod],
                    'valor_cobrado' => $cobrado,
                    'desconto' => $desconto,
                ];
                $porAluno[$doc['cod_alu']]['cod_pars'][] = $cod;
                $porAluno[$doc['cod_alu']]['valor'] = ($porAluno[$doc['cod_alu']]['valor'] ?? 0) + $cobrado;
                $porAluno[$doc['cod_alu']]['matricula'] ??= $p['num_matricula'];
            }
        }
        return [
            'data_pagamento' => $dataPagamento,
            'valor_pago' => $valorPago,
            'valor_devido' => $devido,
            'documentos' => $selecionados,
            'parcelas' => $parcelas,
            'por_aluno' => $porAluno,
        ];
    }

    /** function_cont.php: ger_inf() -> [matrícula, "Parcela X de Y"] */
    private function descricaoContabil(int $codPar): array
    {
        $p = $this->db->um('SELECT COD_ALU, NUM_MATRICULA FROM s_cad_parcela WHERE COD_PAR = ? LIMIT 1', [$codPar]);
        $qtd = $this->db->um('SELECT COUNT(COD_PAR) AS Q FROM s_cad_parcela WHERE COD_ALU = ? AND NUM_MATRICULA = ?', [$p['COD_ALU'], $p['NUM_MATRICULA']]);
        $pos = $this->db->um('SELECT COUNT(COD_PAR) AS Q FROM s_cad_parcela WHERE COD_ALU = ? AND NUM_MATRICULA = ? AND COD_PAR <= ?', [$p['COD_ALU'], $p['NUM_MATRICULA'], $codPar]);
        return [(string)$p['NUM_MATRICULA'], 'Parcela ' . (int)$pos['Q'] . ' de ' . (int)$qtd['Q']];
    }

    /**
     * Insere em s_cad_ocorrencia com os mesmos campos do addocorrencia.php.
     * Só tipos que NÃO mudam status de matrícula.
     */
    private function inserirOcorrencia(string $codAlu, string $matricula, string $tipo, string $texto, string $idRep): array
    {
        if (!in_array($tipo, ['Informativo', 'agend_pag'], true)) {
            throw new ErroPonte('tipo_proibido', 'O agente só registra ocorrências Informativo e Agendamento.');
        }
        [$mat, $turma, $statusAtual] = $this->contextoMatricula($codAlu, $matricula);
        $agora = $this->agora();
        $this->db->executar(
            'INSERT INTO s_cad_ocorrencia (STATUS_OCO, COD_ALU, MATRICULA_OCO, TURMA_OCO, DAT_OCO, HOR_OCO, OCO_OCO, PRO_OCO, STATUS_ANT_OCO, ID_REP)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $tipo, $codAlu, $tipo === 'agend_pag' && $mat === $codAlu ? '' : $mat, $turma,
                $agora->format('Y-m-d'), $agora->format('H:i:s'),
                Texto::paraBanco($texto), Texto::paraBanco((string)$this->agente['login']), $statusAtual, $idRep,
            ]
        );
        return ['cod_oco' => $this->db->ultimoId(), 'cod_alu' => $codAlu, 'matricula' => $mat, 'tipo' => $tipo];
    }

    /** [matrícula, turma, status atual] — usa a informada ou a ativa mais recente. */
    private function contextoMatricula(string $codAlu, string $matricula): array
    {
        if ($matricula !== '' && $matricula !== $codAlu) {
            $m = $this->db->um('SELECT COD_MATRICULA, COD_TUR, STATUS_MAT FROM s_cad_matricula WHERE COD_MATRICULA = ? AND COD_ALU = ? LIMIT 1', [$matricula, $codAlu]);
            if ($m) {
                return [(string)$m['COD_MATRICULA'], (string)$m['COD_TUR'], (string)$m['STATUS_MAT']];
            }
        }
        $a = $this->db->um('SELECT COD_TUR, CIT_ATU_ALU FROM s_cad_aluno WHERE COD_ALU = ? LIMIT 1', [$codAlu]);
        if ($a === null) {
            throw new ErroPonte('aluno_nao_encontrado', 'Aluno não encontrado.');
        }
        if ($matricula === $codAlu && !empty($a['COD_TUR'])) {
            return [$codAlu, (string)$a['COD_TUR'], (string)$a['CIT_ATU_ALU']];
        }
        $m = $this->db->um(
            "SELECT COD_MATRICULA, COD_TUR, STATUS_MAT FROM s_cad_matricula WHERE COD_ALU = ?
             ORDER BY (STATUS_MAT = 'Ativo') DESC, COD_MATRICULA DESC LIMIT 1",
            [$codAlu]
        );
        if ($m) {
            return [(string)$m['COD_MATRICULA'], (string)$m['COD_TUR'], (string)$m['STATUS_MAT']];
        }
        return [$codAlu, (string)$a['COD_TUR'], (string)$a['CIT_ATU_ALU']];
    }

    public function registrarOcorrencia(string $codAlu, string $matricula, string $texto, string $chave): array
    {
        $texto = trim($texto);
        if ($texto === '' || mb_strlen($texto) > 2000) {
            throw new ErroPonte('texto_invalido', 'Texto da ocorrência vazio ou longo demais.');
        }
        if ($chave !== '' && ($ant = $this->registro->anterior($chave))) {
            return $ant;
        }
        $res = $this->inserirOcorrencia($codAlu, $matricula, 'Informativo', $texto, '');
        $this->registro->gravar('ocorrencia', $chave ?: null, 'ok', compact('codAlu', 'matricula', 'texto'), $res);
        return $res;
    }

    /**
     * Agenda uma reposição DE VERDADE, exatamente como a tela addocorrencia.php (opção "Reposição"):
     *   1) INSERT em s_cad_reposicao (reserva a vaga do aluno na turma/data);
     *   2) UPDATE s_cad_turma VAG_RES = VAG_RES - 1 (baixa a vaga restante);
     *   3) INSERT em s_cad_ocorrencia com STATUS_OCO='Reposição', texto automático e ID_REP vinculado.
     * Guardas: turma Informática ATIVA do mesmo curso do aluno; data futura e num dia em que a
     * turma tem aula; e lotação (matriculados ativos + reposições já marcadas na data < limite).
     */
    public function agendarReposicao(string $codAlu, string $turma, string $data, string $chave): array
    {
        $codAlu = trim($codAlu);
        $turma = trim($turma);
        if ($codAlu === '' || $turma === '') {
            throw new ErroPonte('parametros', 'Informe o aluno e a turma da reposição.');
        }
        if ($chave !== '' && ($ant = $this->registro->anterior($chave))) {
            return $ant;
        }

        // Matrícula ativa do aluno (curso, turma do aluno e status anterior da ocorrência).
        $m = $this->db->um(
            "SELECT COD_MATRICULA, COD_TUR, STATUS_MAT, NOM_CUR FROM s_cad_matricula
             WHERE COD_ALU = ? ORDER BY (STATUS_MAT = 'Ativo') DESC, COD_MATRICULA DESC LIMIT 1",
            [$codAlu]
        );
        if ($m === null) {
            throw new ErroPonte('aluno_sem_matricula', 'Aluno sem matrícula.');
        }
        $matId = (string)$m['COD_MATRICULA'];
        $turmaAluno = (string)$m['COD_TUR'];
        $statusAtual = (string)$m['STATUS_MAT'];
        $nomCurAluno = Texto::doBanco($m['NOM_CUR'] ?? '');

        // Trava "uma reposição por vez": o MULT bloqueia nova reposição enquanto houver uma pendente.
        $pend = $this->escola->reposicaoPendente($codAlu, $this->agora()->format('Y-m-d'));
        if (!empty($pend['pendente'])) {
            throw new ErroPonte('reposicao_pendente', 'O aluno já tem uma reposição marcada para ' . $pend['data'] . ' (turma ' . $pend['turma'] . '). O sistema permite uma reposição por vez, até essa aula acontecer.');
        }

        // Turma de reposição (aceita COD_TUR ou NOM_TUR). Precisa estar ATIVA e ser do mesmo curso.
        $colStatus = $this->escola->colunaReal('s_cad_turma', ['STATUS_TUR', 'SIT_TUR', 'STATUS']);
        $selStatus = $colStatus !== '' ? ", $colStatus AS ST" : '';
        $t = $this->db->um("SELECT COD_TUR, NOM_TUR, COD_CUR, DIA_SEMANA, HS_INICIO, HS_FIM$selStatus FROM s_cad_turma WHERE COD_TUR = ? LIMIT 1", [$turma]);
        if ($t === null) {
            $t = $this->db->um("SELECT COD_TUR, NOM_TUR, COD_CUR, DIA_SEMANA, HS_INICIO, HS_FIM$selStatus FROM s_cad_turma WHERE NOM_TUR = ? LIMIT 1", [$turma]);
        }
        if ($t === null) {
            throw new ErroPonte('turma_nao_encontrada', 'Turma de reposição não encontrada.');
        }
        if ($colStatus !== '' && strcasecmp(trim((string)($t['ST'] ?? '')), 'Ativo') !== 0) {
            throw new ErroPonte('turma_inativa', 'A turma de reposição não está ativa.');
        }
        $codTur = (string)$t['COD_TUR'];
        $codCur = (string)$t['COD_CUR'];
        $tAluno = $this->db->um('SELECT COD_CUR FROM s_cad_turma WHERE COD_TUR = ? LIMIT 1', [$turmaAluno]);
        if ($tAluno !== null && (string)$tAluno['COD_CUR'] !== $codCur) {
            throw new ErroPonte('curso_diferente', 'A turma de reposição é de outro curso.');
        }

        // Curso precisa ser Informática (nome do curso da turma via s_cad_curso; cai no NOM_CUR da matrícula se faltar).
        $cur = $this->db->um('SELECT NOM_CUR FROM s_cad_curso WHERE COD_CUR = ? LIMIT 1', [$codCur]);
        $nomCur = Texto::doBanco($cur['NOM_CUR'] ?? '');
        if ($nomCur === '') {
            $nomCur = $nomCurAluno;
        }
        if (!preg_match('/inform/i', $nomCur)) {
            throw new ErroPonte('curso_nao_informatica', 'Reposição automática só para o curso de Informática.');
        }

        // Data: válida, futura (ou hoje) e num dia em que a turma tem aula.
        $dataIso = Texto::dataIso($data);
        if ($dataIso === '') {
            throw new ErroPonte('data_invalida', 'Informe a data da reposição (um dia em que a turma tem aula).');
        }
        if ($dataIso < $this->agora()->format('Y-m-d')) {
            throw new ErroPonte('data_passada', 'Essa data já passou. Combine uma data futura.');
        }
        $norm = function ($s) {
            $s = mb_strtolower(trim((string)$s), 'UTF-8');
            $s = strtr($s, ['á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'é' => 'e', 'ê' => 'e', 'í' => 'i', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ú' => 'u', 'ç' => 'c']);
            return preg_replace('/[^a-z]/', '', (string)$s);
        };
        $dias = [0 => 'Domingo', 1 => 'Segunda-Feira', 2 => 'Terça-Feira', 3 => 'Quarta-Feira', 4 => 'Quinta-Feira', 5 => 'Sexta-Feira', 6 => 'Sábado'];
        $diaData = $norm($dias[(int)date('w', strtotime($dataIso . ' 12:00:00'))]);
        $diaTurma = $norm(Texto::doBanco($t['DIA_SEMANA'] ?? ''));
        if ($diaTurma !== '' && $diaData !== $diaTurma) {
            throw new ErroPonte('dia_sem_aula', 'A turma ' . $codTur . ' tem aula em ' . Texto::doBanco($t['DIA_SEMANA'] ?? '') . '. Marque a reposição nesse dia.');
        }

        // Vaga: a conferência de capacidade é feita ANTES, ao oferecer (vagas_turmas respeita o
        // VAG_TUR de cada turma). Tendo vaga, o MULT aceita a reposição sem trava própria — aqui
        // não repetimos um limite fixo (turmas têm capacidades diferentes).

        // Dados do aluno para gravação. O MULT grava essas telas em latin1 (utf8_decode no
        // addocorrencia.php); a conexão da ponte é latin1, então convertemos UTF-8 -> latin1
        // para a Ação/textos saírem corretos (senão vira "ReposiÃ§Ã£o").
        $latin1 = static fn (string $s): string => (string)mb_convert_encoding($s, 'ISO-8859-1', 'UTF-8');
        $al = $this->db->um('SELECT NOM_ALU FROM s_cad_aluno WHERE COD_ALU = ? LIMIT 1', [$codAlu]);
        $nomAlu = Texto::doBanco($al['NOM_ALU'] ?? '');
        $matOco = ($matId === $codAlu) ? '' : $matId;
        $dataBr = date('d/m/Y', strtotime($dataIso . ' 12:00:00'));

        // 1) Reserva em s_cad_reposicao.
        $this->db->executar(
            'INSERT INTO s_cad_reposicao (COD_ALU, NOM_ALU, COD_CUR, COD_TUR, DAT_REP, COD_MATRICULA) VALUES (?, ?, ?, ?, ?, ?)',
            [$codAlu, $latin1($nomAlu), $codCur, $codTur, $dataIso, $matOco]
        );
        $codRep = (string)$this->db->ultimoId();

        // 2) Baixa a vaga restante da turma (como a tela do MULT faz).
        $colVagRes = $this->escola->colunaReal('s_cad_turma', ['VAG_RES']);
        if ($colVagRes !== '') {
            $this->db->executar("UPDATE s_cad_turma SET $colVagRes = $colVagRes - 1 WHERE COD_TUR = ?", [$codTur]);
        }

        // 3) Ocorrência 'Reposição' com o texto automático do MULT e ID_REP vinculado.
        $ocoTexto = 'REPOSIÇÃO MARCADA: TURMA: ' . $codTur . ' DATA: ' . $dataBr . '.';
        $agora = $this->agora();
        $this->db->executar(
            'INSERT INTO s_cad_ocorrencia (STATUS_OCO, COD_ALU, MATRICULA_OCO, TURMA_OCO, DAT_OCO, HOR_OCO, OCO_OCO, PRO_OCO, STATUS_ANT_OCO, ID_REP)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $latin1('Reposição'), $codAlu, $matOco, $turmaAluno,
                $agora->format('Y-m-d'), $agora->format('H:i:s'),
                $latin1($ocoTexto), $latin1((string)($this->agente['login'] ?? '')), $statusAtual, $codRep,
            ]
        );
        $codOco = (string)$this->db->ultimoId();

        $res = [
            'cod_rep' => $codRep,
            'cod_oco' => $codOco,
            'turma' => $codTur,
            'curso' => $nomCur,
            'data' => $dataBr,
            'dia_semana' => Texto::doBanco($t['DIA_SEMANA'] ?? ''),
            'horario' => trim(Texto::doBanco($t['HS_INICIO'] ?? '') . ' - ' . Texto::doBanco($t['HS_FIM'] ?? ''), ' -'),
        ];
        $this->registro->gravar('reposicao', $chave ?: null, 'ok', compact('codAlu', 'turma', 'data'), $res);
        return $res;
    }

    /** Coloca o certificado do aluno na fila de emissão da secretaria (s_cad_solicita_certificado). */
    public function solicitarCertificado(string $codAlu, string $chave): array
    {
        if (trim($codAlu) === '') {
            throw new ErroPonte('cod_alu_invalido', 'Aluno não informado.');
        }
        if ($chave !== '' && ($ant = $this->registro->anterior($chave))) {
            return $ant;
        }
        $aberta = $this->db->um(
            "SELECT id FROM s_cad_solicita_certificado WHERE cod_alu = ? AND status IN ('S','G','I') ORDER BY id DESC LIMIT 1",
            [$codAlu]
        );
        if ($aberta) {
            $res = ['ok' => true, 'ja_solicitado' => true, 'id' => (int)$aberta['id']];
            $this->registro->gravar('solicita_certificado', $chave ?: null, 'ok', compact('codAlu'), $res);
            return $res;
        }
        $mat = $this->db->um(
            "SELECT COD_MATRICULA, NOM_CUR FROM s_cad_matricula WHERE COD_ALU = ? ORDER BY (STATUS_MAT = 'Ativo') DESC, COD_MATRICULA DESC LIMIT 1",
            [$codAlu]
        ) ?? [];
        $login = (string)($this->agente['login'] ?? 'AGENTE IA');
        $this->db->executar(
            "INSERT INTO s_cad_solicita_certificado (cod_alu, matricula, curso, data_solicitacao, status, `user`) VALUES (?, ?, ?, CURDATE(), 'S', ?)",
            [$codAlu, mb_substr((string)($mat['COD_MATRICULA'] ?? ''), 0, 30), mb_substr((string)($mat['NOM_CUR'] ?? ''), 0, 30), $login]
        );
        $res = ['ok' => true, 'id' => $this->db->ultimoId()];
        $this->registro->gravar('solicita_certificado', $chave ?: null, 'ok', compact('codAlu'), $res);
        return $res;
    }

    /** addocorrencia.php, ramo agend_pag: s_cad_agend_pag + ocorrência. */
    public function agendarPagamento(string $codAlu, string $matricula, string $vencimento, string $dataPagamento, string $chave): array
    {
        $venc = Texto::dataIso($vencimento);
        $pag = Texto::dataIso($dataPagamento);
        if ($venc === '' || $pag === '') {
            throw new ErroPonte('data_invalida', 'Datas inválidas.');
        }
        if ($pag < $this->agora()->format('Y-m-d')) {
            throw new ErroPonte('data_passada', 'A data prometida já passou.');
        }
        if ($chave !== '' && ($ant = $this->registro->anterior($chave))) {
            return $ant;
        }
        $aluno = $this->db->um('SELECT NOM_ALU FROM s_cad_aluno WHERE COD_ALU = ? LIMIT 1', [$codAlu]);
        if (!$aluno) {
            throw new ErroPonte('aluno_nao_encontrado', 'Aluno não encontrado.');
        }
        [$mat] = $this->contextoMatricula($codAlu, $matricula);
        $this->db->executar(
            'INSERT INTO s_cad_agend_pag (COD_ALU, NOM_ALU, DAT_VENC, DAT_PAG, COD_MATRICULA, PAGO, RESP) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$codAlu, $aluno['NOM_ALU'], $venc, $pag, $mat === $codAlu ? '' : $mat, '', 0]
        );
        $id = $this->db->ultimoId();
        $oco = $this->inserirOcorrencia($codAlu, $mat, 'agend_pag', 'AGENDAMENTO REALIZADO, DATA DE PAGAMENTO: ' . Texto::dataBr($pag) . '.', (string)$id);
        $res = ['agendamento_id' => $id, 'ocorrencia' => $oco];
        $this->registro->gravar('agendamento', $chave ?: null, 'ok', compact('codAlu', 'matricula', 'venc', 'pag'), $res);
        return $res;
    }

    /** Registra no histórico de cartas (aba "Histórico de cartas"). */
    public function registrarCarta(string $codAlu, int $codCarta, string $data, string $chave): array
    {
        if ($chave !== '' && ($ant = $this->registro->anterior($chave))) {
            return $ant;
        }
        $c = $this->db->um('SELECT COD_CAR, DESC_CAR FROM s_cad_carta WHERE COD_CAR = ? LIMIT 1', [$codCarta]);
        if (!$c) {
            throw new ErroPonte('carta_inexistente', 'Modelo de carta não encontrado.');
        }
        $data = Texto::dataIso($data) ?: $this->agora()->format('Y-m-d');
        $this->db->executar(
            'INSERT INTO historico_carta (COD_CART, COD_ALU, NOM_CART, DAT_EMIT, STATUS_CART) VALUES (?, ?, ?, ?, ?)',
            [$codCarta, $codAlu, mb_substr(Texto::doBanco($c['DESC_CAR']), 0, 100), $data, '']
        );
        $res = ['cod_hist' => $this->db->ultimoId()];
        $this->registro->gravar('carta', $chave ?: null, 'ok', compact('codAlu', 'codCarta', 'data'), $res);
        return $res;
    }

    public function cartas(): array
    {
        return array_map(fn($c) => [
            'cod' => (int)$c['COD_CAR'],
            'tipo' => (string)$c['TIPO'],
            'descricao' => Texto::doBanco($c['DESC_CAR']),
        ], $this->db->todos('SELECT COD_CAR, TIPO, DESC_CAR FROM s_cad_carta ORDER BY COD_CAR'));
    }

    /**
     * Gera o carnê (PDF) dos documentos em aberto do aluno. Se $codPars vier vazio,
     * usa todos os documentos vencidos e o próximo a vencer. Grava o código de
     * barras nas parcelas como o sistema faz a cada impressão.
     *
     * @param array<string,string> $unidade
     */
    public function carne(string $codAlu, array $codPars, array $unidade): array
    {
        $hoje = $this->agora()->format('Y-m-d');
        $aluno = $this->escola->aluno($codAlu);
        $abertas = $this->escola->parcelasEmAberto([$codAlu], $hoje);
        $docs = $abertas['documentos'];
        if ($codPars) {
            $codPars = array_map('intval', $codPars);
            $docs = array_values(array_filter($docs, fn($d) => (bool)array_intersect($d['cod_pars'], $codPars)));
        } else {
            $vencidos = array_values(array_filter($docs, fn($d) => $d['vencimento'] <= $hoje));
            $proximo = array_values(array_filter($docs, fn($d) => $d['vencimento'] > $hoje));
            $docs = array_merge($vencidos, array_slice($proximo, 0, 1));
        }
        if (!$docs) {
            throw new ErroPonte('sem_parcelas', 'Não há parcelas em aberto para gerar o carnê.');
        }
        foreach ($docs as &$d) {
            $d['codigo_barras'] = Carne::codigoBarras($d['cod_pars']);
            foreach ($d['cod_pars'] as $cp) {
                $this->db->executar('UPDATE s_cad_parcela SET COD_BARRA = ? WHERE COD_PAR = ?', [$d['codigo_barras'], $cp]);
            }
        }
        unset($d);
        $pdf = Carne::pdf($docs, $aluno, $unidade);
        return [
            'arquivo' => 'carne_' . $codAlu . '_' . str_replace('-', '', $docs[0]['vencimento']) . '.pdf',
            'pdf_base64' => base64_encode($pdf),
            'documentos' => $docs,
        ];
    }
}
