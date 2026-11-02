<?php
declare(strict_types=1);

namespace Ponte;

/** Carnê de pagamento em PDF, com o mesmo cálculo e código de barras do print_boleto.php. */
final class Carne
{
    /**
     * Código do carnê como o sistema gera: dígitos aleatórios + início dos códigos
     * das parcelas, completando 10 dígitos (e um zero à esquerda se ficar ímpar).
     */
    public static function codigoBarras(array $codPars): string
    {
        $codigo = implode('', array_map('strval', $codPars));
        $num = '1234567891';
        if (strlen($codigo) < strlen($num)) {
            $tamanho = strlen($num) - strlen($codigo);
        } else {
            $codigo = substr($codigo, 0, 5);
            $tamanho = 5;
        }
        $ret = '';
        for ($i = 0; $i < $tamanho; $i++) {
            $ret .= $num[random_int(0, strlen($num) - 1)];
        }
        $ret .= $codigo;
        if (strlen($ret) % 2 !== 0) {
            $ret = '0' . $ret;
        }
        return $ret;
    }

    /** Padrão Interleaved 2 of 5 igual ao do sistema (2 = fina, 4 = grossa). */
    public static function padraoBarras(string $codigo): string
    {
        $barra = ['22442', '42224', '24224', '44222', '22424', '42422', '24422', '22244', '42242', '24242'];
        $c2 = '';
        foreach (str_split($codigo) as $d) {
            $c2 .= $barra[(int)$d];
        }
        $c3 = '';
        for ($i = 0; $i < strlen($c2); $i += 10) {
            for ($k = 0; $k < 5; $k++) {
                $c3 .= $c2[$i + $k] . $c2[$i + 5 + $k];
            }
        }
        return '2222' . $c3 . '422';
    }

    private static function desenharBarras(Pdf $pdf, float $x, float $y, float $h, string $codigo, float $modulo = 0.18): float
    {
        $p = self::padraoBarras($codigo);
        $cx = $x;
        for ($i = 0; $i < strlen($p); $i += 2) {
            $preta = ((int)$p[$i]) * $modulo;
            $pdf->barra($cx, $y, $preta, $h);
            $cx += $preta + (isset($p[$i + 1]) ? ((int)$p[$i + 1]) * $modulo : 0);
        }
        return $cx - $x;
    }

    private const TIPOS = [
        'PPAR' => '1ª Parcela', 'MATR' => 'Matrícula', 'PARC' => 'Parcela', 'RESC' => 'Rescisão',
        'TERM' => 'Termo de acordo', 'MATE' => 'Material', 'EJA' => 'EJA', 'EAD' => 'EAD',
        'UNI' => 'Uniforme', 'ETR' => 'Entrada',
    ];

    /**
     * @param array<int,array<string,mixed>> $documentos saída de Calculo::documentos (com 'codigo_barras')
     * @param array<string,mixed> $aluno saída de Escola::aluno
     * @param array<string,string> $unidade nome, razao_social, cnpj, pix_chave, pix_texto
     */
    public static function pdf(array $documentos, array $aluno, array $unidade): string
    {
        $pdf = new Pdf();
        $pdf->novaPagina();
        $y = 12.0;
        $porPagina = 0;
        $cursos = [];
        foreach ($aluno['matriculas'] as $m) {
            $cursos[$m['matricula']] = $m['curso'];
        }

        foreach ($documentos as $doc) {
            if ($porPagina === 3) {
                $pdf->novaPagina();
                $y = 12.0;
                $porPagina = 0;
            }
            self::bloco($pdf, 10, $y, $doc, $aluno, $unidade, $cursos);
            $y += 92;
            $porPagina++;
        }
        return $pdf->gerar('Carnê de pagamento - ' . $aluno['nome']);
    }

    private static function bloco(Pdf $pdf, float $x, float $y, array $doc, array $aluno, array $unidade, array $cursos): void
    {
        $w = 190.0;
        $col = 150.0; // início da coluna da direita
        $pdf->linhaTracejada($x, $y - 2, $x + $w);

        $tipos = implode('/', array_map(fn($p) => self::TIPOS[$p['tipo_par']] ?? 'Parcela', $doc['parcelas']));
        $curso = implode('/', array_unique(array_filter(array_map(
            fn($p) => $cursos[$p['num_matricula']] ?? ($cursos[$aluno['cod_alu']] ?? ''),
            $doc['parcelas']
        )))) ?: 'Curso não informado';

        // Cabeçalho
        $pdf->retangulo($x, $y, 45, 9);
        $pdf->texto($x + 2, $y + 6, 'MULT Profissões', 10, true);
        $pdf->retangulo($x + 45, $y, $col - 45, 9);
        $pdf->texto($x + 45, $y + 6.3, 'CARNÊ DE PAGAMENTO', 13, true, 'C', $col - 45);
        $pdf->retangulo($x + $col, $y, $w - $col, 9, true);
        $pdf->texto($x + $col, $y + 3.5, 'Vencimento', 7, false, 'C', $w - $col);
        $pdf->texto($x + $col, $y + 7.6, Texto::dataBr($doc['vencimento']), 10, true, 'C', $w - $col);

        $linha = function (float $ly, float $lh, string $rotulo, string $valor, bool $destaque = false) use ($pdf, $x, $col): void {
            $pdf->retangulo($x, $ly, $col, $lh);
            $pdf->texto($x + 2, $ly + 4, $rotulo, 6.5);
            $pdf->texto($x + 35, $ly + 4.4, $valor, $destaque ? 9 : 8, $destaque);
        };
        $direita = function (float $ly, float $lh, string $rotulo, string $valor, bool $cinza = false) use ($pdf, $x, $col, $w): void {
            $pdf->retangulo($x + $col, $ly, $w - $col, $lh, $cinza);
            $pdf->texto($x + $col + 2, $ly + 3.6, $rotulo, 6.5);
            if ($valor !== '') {
                $pdf->texto($x + $col, $ly + $lh - 2, $valor, 10, true, 'C', $w - $col);
            }
        };

        $ly = $y + 9;
        $linha($ly, 6, 'Nº do Documento', implode('/', $doc['cod_pars']));
        $linha($ly + 6, 6, 'Pagável', 'PAGÁVEL NA UNIDADE ' . $unidade['nome'] . ' OU VIA PIX');
        $linha($ly + 12, 6, 'Cedente', $unidade['razao_social'] ?: 'MULT Profissões');
        $linha($ly + 18, 6, 'Aluno', $aluno['nome'] . '   (cód. ' . $aluno['cod_alu'] . ')', true);
        $linha($ly + 24, 6, 'Responsável', $aluno['nome_responsavel'] ?: $aluno['nome']);
        $linha($ly + 30, 6, 'Curso / Tipo', $curso . '  —  ' . $tipos);

        $direita($ly, 12, 'Valor do Documento', Texto::reais($doc['valor_documento']), true);
        if (!empty($doc['vencido'])) {
            $direita($ly + 12, 12, 'Para pagar hoje (' . date('d/m') . ')', Texto::reais($doc['valor_devido']), true);
        } else {
            $direita($ly + 12, 12, 'Até o vencimento', $doc['valor_em_dia'] !== $doc['valor_documento'] ? Texto::reais($doc['valor_em_dia']) : '—');
        }
        $direita($ly + 24, 12, 'Valor Cobrado', '');

        // Instruções
        $iy = $ly + 36;
        $pdf->retangulo($x, $iy, $w, 26);
        $pdf->texto($x + 2, $iy + 4.5, 'Instruções', 8, true);
        $instr = [];
        if (!empty($doc['vencido'])) {
            $instr[] = '• Parcela vencida há ' . $doc['dias_atraso'] . ' dia(s): valor atualizado para hoje ' . Texto::reais($doc['valor_devido']) . ' (o valor muda a cada dia).';
        } elseif ($doc['valor_em_dia'] !== $doc['valor_documento']) {
            $instr[] = '• Desconto de pontualidade de R$ 30,00 por parcela pago até a data do vencimento: total ' . Texto::reais($doc['valor_em_dia']) . '.';
        }
        $instr[] = '• Após o vencimento: valor do documento + juros de 0,33% ao dia.';
        if (!empty($unidade['pix_chave'])) {
            $instr[] = '• Pix: chave ' . $unidade['pix_chave'] . ($unidade['pix_titular'] ? ' (' . $unidade['pix_titular'] . ')' : '') . '. Envie o comprovante pelo WhatsApp da escola.';
        }
        $instr[] = '• Protestar após 5 dias do vencimento.';
        $ty = $iy + 9;
        foreach ($instr as $t) {
            $ty += $pdf->paragrafo($x + 3, $ty, $w - 6, $t, 7.5);
        }

        // Código de barras (mesmo código nos dois lados, como no carnê impresso)
        $by = $iy + 27;
        $codigo = $doc['codigo_barras'] ?? '';
        if ($codigo !== '') {
            self::desenharBarras($pdf, $x + 2, $by, 10, $codigo);
            $pdf->texto($x + 2, $by + 13.5, $codigo, 8);
            self::desenharBarras($pdf, $x + 110, $by, 10, $codigo);
            $pdf->texto($x + 110, $by + 13.5, $codigo, 8);
        }
    }
}
