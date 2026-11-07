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
