<?php
declare(strict_types=1);

namespace Ponte;

/**
 * Regras de valor do carnê da MULT (sem acesso a banco; tudo em centavos).
 *
 * - Documento = parcelas em aberto do MESMO aluno com o MESMO vencimento
 *   (é como o print_boleto.php monta o carnê).
 * - Valor do documento = soma - R$ 30 x (n - 1).
 * - Até o vencimento (inclusive): mais R$ 30 de desconto de pontualidade
 *   (= R$ 30 por parcela no total). Não se aplica se todas forem de Rescisão.
 * - Depois do vencimento: valor do documento + 0,33% ao dia sobre ele (opção C).
 */
final class Calculo
{
    public const DESCONTO_POR_PARCELA = 3000;   // R$ 30,00
    public const JUROS_DIA_BP = 33;             // 0,33% = 33 / 10000
    public const VALOR_MINIMO = 100;            // parcelas abaixo de R$ 1,00 são lixo/placeholder

    /**
     * @param array<int,array{cod_par:int,cod_alu:string,num_matricula:string,tipo_par:string,valor:int,vencimento:string}> $parcelas
     * @return array<int,array<string,mixed>> documentos ordenados por vencimento
     */
    public static function documentos(array $parcelas, string $dataRef): array
    {
        $grupos = [];
        foreach ($parcelas as $p) {
            if ($p['valor'] < self::VALOR_MINIMO || $p['vencimento'] === '') {
                continue;
            }
            $grupos[$p['cod_alu'] . '|' . $p['vencimento']][] = $p;
        }
        $docs = [];
        foreach ($grupos as $g) {
            usort($g, fn($a, $b) => $a['cod_par'] <=> $b['cod_par']);
            $docs[] = self::documento($g, $dataRef);
        }
        usort($docs, fn($a, $b) => [$a['vencimento'], $a['cod_alu']] <=> [$b['vencimento'], $b['cod_alu']]);
        return $docs;
    }

    /** @param array<int,array<string,mixed>> $parcelas mesmo aluno e vencimento */
    public static function documento(array $parcelas, string $dataRef): array
    {
        $n = count($parcelas);
        $soma = array_sum(array_column($parcelas, 'valor'));
        $valorDocumento = $soma - self::DESCONTO_POR_PARCELA * ($n - 1);
        $todasRescisao = count(array_filter($parcelas, fn($p) => $p['tipo_par'] === 'RESC')) === $n;
        $vencimento = $parcelas[0]['vencimento'];
        $dias = max(0, Texto::diasEntre($vencimento, $dataRef));

        $emDia = $todasRescisao ? $valorDocumento : $valorDocumento - self::DESCONTO_POR_PARCELA;
        $juros = $dias > 0 ? self::juros($valorDocumento, $dias) : 0;
        $devido = $dias > 0 ? $valorDocumento + $juros : $emDia;

        return [
            'cod_alu' => $parcelas[0]['cod_alu'],
            'vencimento' => $vencimento,
            'parcelas' => array_map(fn($p) => [
                'cod_par' => $p['cod_par'],
                'num_matricula' => $p['num_matricula'],
                'tipo_par' => $p['tipo_par'],
                'valor' => $p['valor'],
            ], $parcelas),
            'cod_pars' => array_column($parcelas, 'cod_par'),
            'soma_parcelas' => $soma,
            'valor_documento' => $valorDocumento,
            'valor_em_dia' => $emDia,
            'dias_atraso' => $dias,
            'juros' => $juros,
            'valor_devido' => $devido,
            'vencido' => $dias > 0,
        ];
    }

    public static function juros(int $base, int $dias): int
    {
        return (int)round($base * self::JUROS_DIA_BP * $dias / 10000);
    }

    /**
     * Divide o valor pago de um documento entre as parcelas, como a secretaria faz
     * ao digitar o valor de cada linha. Retorna [cod_par => centavos cobrados].
     *
     * Em dia: cada parcela = valor - R$ 30 (Rescisão sozinha: valor cheio).
     * Vencido: a 1ª parcela fica cheia, as demais com -R$ 30 (soma = valor do
     * documento) e os juros são distribuídos na mesma proporção.
     *
     * @return array<int,int>
     */
    public static function rateio(array $documento): array
    {
        $parcelas = $documento['parcelas'];
        $total = $documento['valor_devido'];
        $bases = [];
        foreach ($parcelas as $i => $p) {
            if (!$documento['vencido'] && $documento['valor_em_dia'] !== $documento['valor_documento']) {
                $bases[$p['cod_par']] = $p['valor'] - self::DESCONTO_POR_PARCELA;
            } else {
                $bases[$p['cod_par']] = $i === 0 ? $p['valor'] : $p['valor'] - self::DESCONTO_POR_PARCELA;
            }
        }
        $somaBases = array_sum($bases);
        if ($somaBases <= 0) {
            throw new \RuntimeException('Documento com valor inválido para rateio.');
        }
        $resultado = [];
        $acumulado = 0;
        $ultimo = array_key_last($bases);
        foreach ($bases as $cod => $base) {
            if ($cod === $ultimo) {
                $resultado[$cod] = $total - $acumulado;
            } else {
                $v = (int)round($total * $base / $somaBases);
                $resultado[$cod] = $v;
                $acumulado += $v;
            }
        }
        return $resultado;
    }

    /**
     * Procura quais documentos o valor pago quita exatamente.
     * Tenta: um documento; os k mais antigos; qualquer combinação (até 14 docs).
     *
     * @param array<int,array<string,mixed>> $documentos
     * @return array{status:string,documentos?:array<int,array<string,mixed>>,opcoes?:int}
     *   status: 'exato' | 'ambiguo' | 'sem_correspondencia'
     */
    public static function conciliar(array $documentos, int $valorPago, int $tolerancia = 1): array
    {
        $bate = fn(int $v) => abs($v - $valorPago) <= $tolerancia;

        $n = count($documentos);
        if ($n === 0) {
            return ['status' => 'sem_correspondencia'];
        }
        // 1) os mais antigos em sequência (caso mais comum: paga o atrasado primeiro)
        $soma = 0;
        $prefixo = [];
        foreach ($documentos as $d) {
            $soma += $d['valor_devido'];
            $prefixo[] = $d;
            if ($bate($soma)) {
                return ['status' => 'exato', 'documentos' => $prefixo, 'criterio' => 'mais_antigos'];
            }
            if ($soma > $valorPago + $tolerancia) {
                break;
            }
        }
        // 2) qualquer combinação (limitada)
        $docs = array_slice($documentos, 0, 14);
        $m = count($docs);
        $achados = [];
        for ($mask = 1; $mask < (1 << $m); $mask++) {
            $s = 0;
            for ($i = 0; $i < $m; $i++) {
                if ($mask & (1 << $i)) {
                    $s += $docs[$i]['valor_devido'];
                }
            }
            if ($bate($s)) {
                $achados[] = $mask;
                if (count($achados) > 1) {
                    break;
                }
            }
        }
        if (count($achados) === 1) {
            $sel = [];
            for ($i = 0; $i < $m; $i++) {
                if ($achados[0] & (1 << $i)) {
                    $sel[] = $docs[$i];
                }
            }
            return ['status' => 'exato', 'documentos' => $sel, 'criterio' => 'combinacao'];
        }
        if (count($achados) > 1) {
            return ['status' => 'ambiguo', 'opcoes' => count($achados)];
        }
        return ['status' => 'sem_correspondencia'];
    }
}
