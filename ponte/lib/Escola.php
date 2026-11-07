<?php
declare(strict_types=1);

namespace Ponte;

/** Consultas somente leitura ao banco de uma unidade. */
final class Escola
{
    private const CAMPOS_TELEFONE = ['WHATS', 'CEL_ALU', 'FON_ALU', 'TEL_RESP', 'FON_PAI_ALU'];

    public function __construct(private Db $db)
    {
    }

    /**
     * Alunos cujo cadastro tem o telefone (aluno ou responsável), agrupados por
     * responsável financeiro, incluindo os dependentes do mesmo CPF de responsável.
     */
    public function buscarPorTelefone(string $telefone): array
    {
        $chave = Texto::chaveTelefone($telefone);
        if ($chave === '') {
            throw new ErroPonte('telefone_invalido', 'Telefone inválido.');
        }
        // Pré-filtro pelos 4 últimos dígitos (formatos variam: "(64) 99999-1234")
        $fim = '%' . substr($chave, -4);
        $conds = implode(' OR ', array_map(fn($c) => "`$c` LIKE ?", self::CAMPOS_TELEFONE));
        $linhas = $this->db->todos(
            "SELECT COD_ALU FROM s_cad_aluno WHERE $conds",
            array_fill(0, count(self::CAMPOS_TELEFONE), $fim)
        );
        $cods = array_column($linhas, 'COD_ALU');
        $alunos = $this->carregarAlunos($cods);
        $encontrados = [];
        foreach ($alunos as $a) {
            $origem = [];
            foreach (self::CAMPOS_TELEFONE as $c) {
                if (Texto::chaveTelefone($a['_raw'][$c] ?? '') === $chave) {
                    $origem[] = $c;
                }
            }
            if ($origem) {
                $a['telefone_encontrado_em'] = $origem;
                $encontrados[] = $a;
            }
        }
        return $this->agruparPorResponsavel($encontrados);
    }

    public function buscarPorCpf(string $cpf): array
    {
        $d = Texto::digitos($cpf);
        if (strlen($d) !== 11) {
            throw new ErroPonte('cpf_invalido', 'CPF inválido.');
        }
        $limpo = fn($c) => "REPLACE(REPLACE(REPLACE(`$c`,'.',''),'-',''),' ','')";
        $linhas = $this->db->todos(
            'SELECT COD_ALU FROM s_cad_aluno WHERE ' . $limpo('CPF_RES') . ' = ? OR ' . $limpo('CPF_ALU') . ' = ?',
            [$d, $d]
        );
        $alunos = $this->carregarAlunos(array_column($linhas, 'COD_ALU'));
        return $this->agruparPorResponsavel($alunos);
    }

    /** Dados completos de um aluno (sem campos sensíveis desnecessários). */
    public function aluno(string $codAlu): array
    {
        $a = $this->carregarAlunos([$codAlu]);
        if (!$a) {
            throw new ErroPonte('aluno_nao_encontrado', 'Aluno não encontrado.');
        }
        return $this->limpar($a[0]);
    }

    /** @param array<int,string|int> $cods */
    private function carregarAlunos(array $cods): array
    {
        $cods = array_values(array_unique(array_filter(array_map('strval', $cods), fn($c) => ctype_digit($c))));
        if (!$cods) {
            return [];
        }
        $in = implode(',', array_fill(0, count($cods), '?'));
        $rows = $this->db->todos(
            "SELECT COD_ALU, COD_TUR, NOM_ALU, CPF_ALU, CPF_RES, NOM_PAI_ALU, WHATS, CEL_ALU, FON_ALU,
                    TEL_RESP, FON_PAI_ALU, EMAIL_ALU, CIT_ATU_ALU, DAT_NAS_ALU
             FROM s_cad_aluno WHERE COD_ALU IN ($in) ORDER BY COD_ALU",
            $cods
        );
        $out = [];
        foreach ($rows as $r) {
            $out[] = [
                'cod_alu' => (string)$r['COD_ALU'],
                'nome' => trim(Texto::doBanco($r['NOM_ALU'])),
                'cpf_aluno' => Texto::digitos($r['CPF_ALU']),
                'cpf_responsavel' => Texto::digitos($r['CPF_RES']),
                'nome_responsavel' => trim(Texto::doBanco($r['NOM_PAI_ALU'])),
                'whatsapp' => Texto::telefoneWhatsapp($r['WHATS']) ?: Texto::telefoneWhatsapp($r['CEL_ALU']),
                'whatsapp_responsavel' => Texto::telefoneWhatsapp($r['TEL_RESP']),
                'email' => trim(Texto::doBanco($r['EMAIL_ALU'])),
                'nascimento' => Texto::dataIso($r['DAT_NAS_ALU']) ?: Texto::dataIso(str_replace('-', '/', (string)$r['DAT_NAS_ALU'])),
                'matriculas' => $this->matriculas((string)$r['COD_ALU'], $r),
                '_raw' => $r,
            ];
        }
        return $out;
    }

    /** Matrículas do aluno (modelo novo em s_cad_matricula + modelo antigo em s_cad_aluno). */
    private function matriculas(string $codAlu, array $aluno): array
    {
        $lista = [];
        if (!empty($aluno['COD_TUR'])) {
            $cur = $this->db->um('SELECT COD_CUR FROM s_cad_turma WHERE COD_TUR = ? LIMIT 1', [$aluno['COD_TUR']]);
            $lista[] = [
                'matricula' => $codAlu,
                'curso' => (string)($cur['COD_CUR'] ?? ''),
                'turma' => (string)$aluno['COD_TUR'],
                'status' => Texto::doBanco($aluno['CIT_ATU_ALU']),
                'modelo' => 'antigo',
            ];
        }
        foreach ($this->db->todos(
            'SELECT COD_MATRICULA, NOM_CUR, COD_TUR, STATUS_MAT, DAT_VENC FROM s_cad_matricula WHERE COD_ALU = ?',
            [$codAlu]
        ) as $m) {
            $lista[] = [
                'matricula' => (string)$m['COD_MATRICULA'],
                'curso' => (string)$m['NOM_CUR'],
                'turma' => (string)$m['COD_TUR'],
                'status' => Texto::doBanco($m['STATUS_MAT']),
                'dia_vencimento' => Texto::dataIso($m['DAT_VENC']),
                'modelo' => 'novo',
            ];
        }
        $nomes = $this->nomesCursos(array_column($lista, 'curso'));
        foreach ($lista as &$l) {
            $l['curso_nome'] = $nomes[$l['curso']] ?? $l['curso'];
        }
        return $lista;
    }

    private array $cacheCursos = [];

    private function nomesCursos(array $cods): array
    {
        $faltam = array_values(array_diff(array_unique(array_filter($cods)), array_keys($this->cacheCursos)));
        if ($faltam) {
            $in = implode(',', array_fill(0, count($faltam), '?'));
            foreach ($this->db->todos("SELECT COD_CUR, NOM_CUR FROM s_cad_curso WHERE COD_CUR IN ($in)", $faltam) as $c) {
                $this->cacheCursos[(string)$c['COD_CUR']] = trim(Texto::doBanco($c['NOM_CUR']));
            }
        }
        return $this->cacheCursos;
    }

    /** Agrupa por CPF do responsável e acrescenta os demais dependentes desse CPF. */
    private function agruparPorResponsavel(array $alunos): array
    {
        $grupos = [];
        $semCpf = [];
        foreach ($alunos as $a) {
            if (strlen($a['cpf_responsavel']) === 11) {
                $grupos[$a['cpf_responsavel']] = true;
            } else {
                $semCpf[] = $a;
            }
        }
        $resultado = [];
        foreach (array_keys($grupos) as $cpf) {
            $dep = $this->buscarDependentes((string)$cpf);
            $nomeResp = '';
            foreach ($dep as $d) {
                if ($d['nome_responsavel'] !== '') {
                    $nomeResp = $d['nome_responsavel'];
                    break;
                }
            }
            $resultado[] = [
                'cpf_responsavel' => (string)$cpf,
                'nome_responsavel' => $nomeResp,
                'responsavel_e_aluno' => count(array_filter($dep, fn($d) => $d['cpf_aluno'] === (string)$cpf)) > 0,
                'alunos' => array_map(fn($d) => $this->limpar($d), $dep),
            ];
        }
        foreach ($semCpf as $a) {
            $resultado[] = [
                'cpf_responsavel' => '',
                'nome_responsavel' => $a['nome_responsavel'],
                'responsavel_e_aluno' => false,
                'alunos' => [$this->limpar($a)],
            ];
        }
        return $resultado;
    }

    private function buscarDependentes(string $cpf): array
    {
        $limpo = "REPLACE(REPLACE(REPLACE(`CPF_RES`,'.',''),'-',''),' ','')";
        $linhas = $this->db->todos("SELECT COD_ALU FROM s_cad_aluno WHERE $limpo = ?", [$cpf]);
        return $this->carregarAlunos(array_column($linhas, 'COD_ALU'));
    }

    private function limpar(array $a): array
    {
        unset($a['_raw']);
        $a['ativo'] = count(array_filter($a['matriculas'], fn($m) => strcasecmp($m['status'], 'Ativo') === 0)) > 0;
        return $a;
    }

    /**
     * Parcelas em aberto dos alunos, já organizadas em documentos (carnês) com
     * o valor devido na data de referência.
     *
     * @param array<int,string> $codAlus
     */
    public function parcelasEmAberto(array $codAlus, string $dataRef): array
    {
        $codAlus = array_values(array_unique(array_filter(array_map('strval', $codAlus), 'ctype_digit')));
        if (!$codAlus) {
            return ['documentos' => [], 'total_vencido' => 0, 'total_a_vencer' => 0];
        }
        $in = implode(',', array_fill(0, count($codAlus), '?'));
        $rows = $this->db->todos(
            "SELECT COD_PAR, COD_ALU, NUM_MATRICULA, TIPO_PAR, VLR_PAR, DAT_VEN
             FROM s_cad_parcela
             WHERE COD_ALU IN ($in) AND (DAT_BAI IS NULL OR DAT_BAI = '')
             ORDER BY DAT_VEN, COD_PAR",
            $codAlus
        );
        $parcelas = [];
        foreach ($rows as $r) {
            $parcelas[] = [
                'cod_par' => (int)$r['COD_PAR'],
                'cod_alu' => (string)$r['COD_ALU'],
                'num_matricula' => (string)$r['NUM_MATRICULA'],
                'tipo_par' => (string)$r['TIPO_PAR'],
                'valor' => (int)Texto::centavos($r['VLR_PAR']),
                'vencimento' => Texto::dataIso($r['DAT_VEN']),
            ];
        }
        $docs = Calculo::documentos($parcelas, $dataRef);
        $vencido = 0;
        $aVencer = 0;
        foreach ($docs as $d) {
            if ($d['vencimento'] <= $dataRef) {
                $vencido += $d['valor_devido'];
            } else {
                $aVencer += $d['valor_devido'];
            }
        }
        return ['data_referencia' => $dataRef, 'documentos' => $docs, 'total_vencido' => $vencido, 'total_a_vencer' => $aVencer];
    }

    /** Frequência por matrícula: totais, % e faltas seguidas mais recentes. */
    public function frequencia(string $codAlu): array
    {
        $rows = $this->db->todos(
            'SELECT COD_MATRICULA_PRES, COD_TUR, FAL_PRE, DAT_FAL FROM s_cad_pres_aluno WHERE COD_ALU = ? ORDER BY DAT_FAL',
            [$codAlu]
        );
        $por = [];
        foreach ($rows as $r) {
            $mat = (string)($r['COD_MATRICULA_PRES'] ?: $codAlu);
            $por[$mat][] = $r;
        }
        $out = [];
        foreach ($por as $mat => $aulas) {
            $pres = 0;
            $falt = 0;
            $seguidas = 0;
            foreach ($aulas as $a) {
                // FAL_PRE = 'S' presença, 'N' falta
                if (strtoupper((string)$a['FAL_PRE']) === 'S') {
                    $pres++;
                    $seguidas = 0;
                } else {
                    $falt++;
                    $seguidas++;
                }
            }
            $total = $pres + $falt;
            $ultima = end($aulas);
            $out[] = [
                'matricula' => $mat,
                'turma' => (string)$ultima['COD_TUR'],
                'aulas' => $total,
                'presencas' => $pres,
                'faltas' => $falt,
                'percentual_presenca' => $total ? round($pres * 100 / $total, 1) : null,
                'faltas_seguidas_atuais' => $seguidas,
                'ultima_aula' => Texto::dataIso($ultima['DAT_FAL']),
                'ultimas_aulas' => array_map(fn($a) => [
                    'data' => Texto::dataIso($a['DAT_FAL']),
                    'presente' => strtoupper((string)$a['FAL_PRE']) === 'S',
                ], array_slice($aulas, -8)),
            ];
        }
        return $out;
    }

    /**
     * Situação de parcelas específicas (para a reconciliação com o Asaas):
     * se foram baixadas no sistema escolar e quando.
     *
     * @param array<int,int> $codPars
     * @return array<int,array{cod_par:int,baixada:bool,data_baixa:string}>
     */
    public function parcelasStatus(array $codPars): array
    {
        $codPars = array_values(array_unique(array_map('intval', array_filter($codPars))));
        if (!$codPars) {
            return [];
        }
        $in = implode(',', array_fill(0, count($codPars), '?'));
        $rows = $this->db->todos("SELECT COD_PAR, DAT_BAI, VLR_COB FROM s_cad_parcela WHERE COD_PAR IN ($in)", $codPars);
        return array_map(fn($r) => [
            'cod_par' => (int)$r['COD_PAR'],
            'baixada' => !empty($r['DAT_BAI']),
            'data_baixa' => Texto::dataIso($r['DAT_BAI']),
            'valor_cobrado' => (int)Texto::centavos($r['VLR_COB']),
        ], $rows);
    }

    public function ocorrencias(string $codAlu, int $limite = 15): array
    {
        $limite = max(1, min(50, $limite));
        $rows = $this->db->todos(
            "SELECT COD_OCO, MATRICULA_OCO, TURMA_OCO, DAT_OCO, HOR_OCO, STATUS_ANT_OCO, STATUS_OCO, OCO_OCO, PRO_OCO
             FROM s_cad_ocorrencia WHERE COD_ALU = ? ORDER BY COD_OCO DESC LIMIT $limite",
            [$codAlu]
        );
        return array_map(fn($o) => [
            'cod_oco' => (int)$o['COD_OCO'],
            'matricula' => (string)$o['MATRICULA_OCO'],
            'data' => Texto::dataIso($o['DAT_OCO']),
            'hora' => (string)$o['HOR_OCO'],
            'acao' => Texto::doBanco($o['STATUS_OCO']),
            'status_anterior' => Texto::doBanco($o['STATUS_ANT_OCO']),
            'texto' => trim(strip_tags(str_replace(['<br>', '</br>', '<br/>'], "\n", Texto::doBanco($o['OCO_OCO'])))),
            'usuario' => Texto::doBanco($o['PRO_OCO']),
        ], $rows);
    }

    public function agendamentos(array $codAlus, string $aPartirDe): array
    {
        $codAlus = array_values(array_filter(array_map('strval', $codAlus), 'ctype_digit'));
        if (!$codAlus) {
            return [];
        }
        $in = implode(',', array_fill(0, count($codAlus), '?'));
        $rows = $this->db->todos(
            "SELECT ID, COD_ALU, DAT_VENC, DAT_PAG, COD_MATRICULA FROM s_cad_agend_pag
             WHERE COD_ALU IN ($in) AND DAT_PAG >= ? ORDER BY DAT_PAG",
            array_merge($codAlus, [$aPartirDe])
        );
        return array_map(fn($r) => [
            'id' => (int)$r['ID'],
            'cod_alu' => (string)$r['COD_ALU'],
            'vencimento' => (string)$r['DAT_VENC'],
            'data_pagamento' => (string)$r['DAT_PAG'],
            'matricula' => (string)$r['COD_MATRICULA'],
        ], $rows);
    }

    /** Turma/curso ativos do aluno (matrícula nova ativa; senão COD_TUR do cadastro). */
    private function turmaDoAluno(string $codAlu): string
    {
        $m = $this->db->um(
            "SELECT COD_TUR FROM s_cad_matricula WHERE COD_ALU = ? ORDER BY (STATUS_MAT = 'Ativo') DESC, COD_MATRICULA DESC LIMIT 1",
            [$codAlu]
        );
        if ($m && !empty($m['COD_TUR'])) {
            return (string)$m['COD_TUR'];
        }
        $a = $this->db->um('SELECT COD_TUR FROM s_cad_aluno WHERE COD_ALU = ? LIMIT 1', [$codAlu]);
        return (string)($a['COD_TUR'] ?? '');
    }

    /** Certificados emitidos + solicitações em andamento do aluno. */
    public function statusCertificado(string $codAlu): array
    {
        $emitidos = $this->db->todos(
            "SELECT NUM_CERT, EMISSOR, `data`, DESC_CERT FROM s_cad_certificado WHERE COD_ALU = ? ORDER BY `data` DESC",
            [$codAlu]
        );
        $solic = $this->db->todos(
            'SELECT curso, data_solicitacao, data_previsao, data_entrega, status FROM s_cad_solicita_certificado WHERE cod_alu = ? ORDER BY id DESC',
            [$codAlu]
        );
        $rot = fn($s) => match (strtoupper(trim((string)$s))) {
            'S' => 'solicitado', 'G' => 'em_processamento', 'I' => 'impresso', 'E' => 'entregue', default => (string)$s
        };
        return [
            'emitidos' => array_map(fn($c) => [
                'numero' => Texto::doBanco($c['NUM_CERT'] ?? ''),
                'curso' => Texto::doBanco($c['DESC_CERT'] ?? ''),
                'emissor' => Texto::doBanco($c['EMISSOR'] ?? ''),
                'data' => Texto::dataIso($c['data'] ?? ''),
            ], $emitidos),
            'solicitacoes' => array_map(fn($x) => [
                'curso' => Texto::doBanco($x['curso'] ?? ''),
                'status' => $rot($x['status'] ?? ''),
                'solicitado_em' => Texto::dataIso($x['data_solicitacao'] ?? ''),
                'previsao' => Texto::dataIso($x['data_previsao'] ?? ''),
                'entregue_em' => Texto::dataIso($x['data_entrega'] ?? ''),
            ], $solic),
        ];
    }

    /** Turma do aluno + método do curso (rotativo/individual/sequencial) + módulos. */
    public function cronogramaTurma(string $codAlu): array
    {
        $turmaCod = $this->turmaDoAluno($codAlu);
        if ($turmaCod === '') {
            return ['encontrou' => false];
        }
        $t = $this->db->um(
            'SELECT COD_CUR, NOM_TUR, DIA_SEMANA, PERIODO, HS_INICIO, HS_FIM, SAL_TUR FROM s_cad_turma WHERE COD_TUR = ? LIMIT 1',
            [$turmaCod]
        ) ?? [];
        $curCod = (string)($t['COD_CUR'] ?? '');
        $crono = $this->db->todos('SELECT TIPO, NOME FROM s_cad_cronograma WHERE COD_CUR = ? ORDER BY COD', [$curCod]);
        $metodos = ['I' => 'individual', 'R' => 'rotativo', 'S' => 'sequencial'];
        $tipo = strtoupper(trim((string)($crono[0]['TIPO'] ?? '')));
        return [
            'encontrou' => true,
            'curso' => $this->nomesCursos([$curCod])[$curCod] ?? Texto::doBanco($t['NOM_TUR'] ?? ''),
            'turma' => Texto::doBanco($t['NOM_TUR'] ?? ''),
            'metodo' => $metodos[$tipo] ?? (string)$tipo,
            'dia_semana' => Texto::doBanco($t['DIA_SEMANA'] ?? ''),
            'periodo' => Texto::doBanco($t['PERIODO'] ?? ''),
            'horario' => trim(Texto::doBanco($t['HS_INICIO'] ?? '') . ' - ' . Texto::doBanco($t['HS_FIM'] ?? ''), ' -'),
            'sala' => Texto::doBanco($t['SAL_TUR'] ?? ''),
            'modulos' => array_values(array_filter(array_map(fn($c) => Texto::doBanco($c['NOME'] ?? ''), $crono))),
        ];
    }

    /** Outras turmas do mesmo curso com vaga (para remanejamento). */
    public function vagasTurmas(string $codAlu): array
    {
        $turmaCod = $this->turmaDoAluno($codAlu);
        if ($turmaCod === '') {
            return [];
        }
        $t = $this->db->um('SELECT COD_CUR FROM s_cad_turma WHERE COD_TUR = ? LIMIT 1', [$turmaCod]);
        $curCod = (string)($t['COD_CUR'] ?? '');
        if ($curCod === '') {
            return [];
        }
        $rows = $this->db->todos(
            'SELECT COD_TUR, NOM_TUR, DIA_SEMANA, PERIODO, HS_INICIO, HS_FIM, VAG_TUR FROM s_cad_turma WHERE COD_CUR = ?',
            [$curCod]
        );
        $out = [];
        foreach ($rows as $r) {
            if ((string)$r['COD_TUR'] === $turmaCod) {
                continue;
            }
            $vagas = (int)preg_replace('/\D/', '', (string)($r['VAG_TUR'] ?? '0'));
            if ($vagas <= 0) {
                continue;
            }
            $out[] = [
                'turma' => Texto::doBanco($r['NOM_TUR'] ?? ''),
                'dia_semana' => Texto::doBanco($r['DIA_SEMANA'] ?? ''),
                'periodo' => Texto::doBanco($r['PERIODO'] ?? ''),
                'horario' => trim(Texto::doBanco($r['HS_INICIO'] ?? '') . ' - ' . Texto::doBanco($r['HS_FIM'] ?? ''), ' -'),
                'vagas' => $vagas,
            ];
        }
        return $out;
    }

    /** Histórico de entrega de material/apostila do aluno. */
    public function entregaApostila(string $codAlu): array
    {
        $rows = $this->db->todos(
            'SELECT COD_CUR, SIT_AP, QTD, DAT_ENT FROM historico_apostila WHERE COD_ALU = ? ORDER BY COD_HIST DESC',
            [$codAlu]
        );
        $cursos = $this->nomesCursos(array_column($rows, 'COD_CUR'));
        return array_map(fn($r) => [
            'curso' => $cursos[(string)($r['COD_CUR'] ?? '')] ?? (string)($r['COD_CUR'] ?? ''),
            'situacao' => Texto::doBanco($r['SIT_AP'] ?? ''),
            'quantidade' => (string)($r['QTD'] ?? ''),
            'entregue_em' => Texto::dataIso($r['DAT_ENT'] ?? ''),
        ], $rows);
    }

    /**
     * Carteira para a régua de cobrança: parcelas EM ABERTO filtradas por vencimento
     * (datas exatas OU intervalo de/ate, ISO AAAA-MM-DD) e, opcionalmente, pelo STATUS
     * da matrícula financeira da parcela (s_cad_matricula.STATUS_MAT). Já traz o contato.
     * Somente leitura.
     *
     * @param array{datas?:array<int,string>,de?:string,ate?:string,statuses?:array<int,string>} $opts
     * @return array<int,array<string,mixed>>
     */
    public function carteiraPorVencimento(array $opts): array
    {
        $datas = array_values(array_unique(array_filter(array_map(fn($d) => Texto::dataIso((string)$d) ?: (string)$d, (array)($opts['datas'] ?? [])))));
        $de = Texto::dataIso((string)($opts['de'] ?? ''));
        $ate = Texto::dataIso((string)($opts['ate'] ?? ''));
        $statuses = array_values(array_filter(array_map(fn($x) => trim((string)$x), (array)($opts['statuses'] ?? [])), fn($x) => $x !== ''));
        if (!$datas && !($de && $ate)) {
            return [];
        }

        $sql = "SELECT p.COD_PAR, p.COD_ALU, p.NUM_MATRICULA, p.VLR_PAR, p.DAT_VEN,
                       a.NOM_ALU, a.CPF_RES, a.NOM_PAI_ALU, a.WHATS, a.CEL_ALU, a.TEL_RESP, a.FON_ALU, a.EMAIL_ALU,
                       m.STATUS_MAT, m.NOM_CUR
                FROM s_cad_parcela p
                JOIN s_cad_aluno a ON a.COD_ALU = p.COD_ALU
                LEFT JOIN s_cad_matricula m ON m.COD_MATRICULA = p.NUM_MATRICULA
                WHERE (p.DAT_BAI IS NULL OR p.DAT_BAI = '')";
        $params = [];
        if ($statuses) {
            // STATUS_MAT costuma ter collation case-insensitive; IN cobre Ativo/ativo/ATIVO.
            $sql .= ' AND m.STATUS_MAT IN (' . implode(',', array_fill(0, count($statuses), '?')) . ')';
            $params = $statuses;
        }
        $rows = $this->db->todos($sql, $params);

        $out = [];
        foreach ($rows as $r) {
            $venc = Texto::dataIso($r['DAT_VEN']);
            if ($datas) {
                if (!in_array($venc, $datas, true)) {
                    continue;
                }
            } elseif ($venc === '' || $venc < $de || $venc > $ate) {
                continue;
            }
            $tel = Texto::telefoneWhatsapp($r['TEL_RESP'] ?? '')
                ?: Texto::telefoneWhatsapp($r['WHATS'] ?? '')
                ?: Texto::telefoneWhatsapp($r['CEL_ALU'] ?? '')
                ?: Texto::telefoneWhatsapp($r['FON_ALU'] ?? '');
            $out[] = [
                'cod_par' => (int)$r['COD_PAR'],
                'cod_alu' => (string)$r['COD_ALU'],
                'num_matricula' => (string)($r['NUM_MATRICULA'] ?? ''),
                'nome_aluno' => trim(Texto::doBanco($r['NOM_ALU'] ?? '')),
                'cpf_responsavel' => Texto::digitos($r['CPF_RES'] ?? ''),
                'nome_responsavel' => trim(Texto::doBanco($r['NOM_PAI_ALU'] ?? '')),
                'telefone' => $tel,
                'email' => trim(Texto::doBanco($r['EMAIL_ALU'] ?? '')),
                'vencimento' => $venc,
                'valor' => (int)Texto::centavos($r['VLR_PAR']),
                'status' => trim(Texto::doBanco($r['STATUS_MAT'] ?? '')),
                'curso' => trim(Texto::doBanco($r['NOM_CUR'] ?? '')),
            ];
        }
        return $out;
    }

    /** Dados da unidade (tabela franquia) para o carnê. */
    public function unidade(): array
    {
        $f = $this->db->um('SELECT Empresa, razao_social, CNPJ_EMP FROM franquia LIMIT 1') ?? [];
        return [
            'nome' => mb_strtoupper(trim(Texto::doBanco($f['Empresa'] ?? ''))),
            'razao_social' => trim(Texto::doBanco($f['razao_social'] ?? '')),
            'cnpj' => Texto::digitos($f['CNPJ_EMP'] ?? ''),
        ];
    }
}
