<?php
declare(strict_types=1);

namespace Ponte;

/**
 * Conversões de texto, dinheiro, datas e documentos no formato do sistema escolar.
 *
 * O banco declara latin1, mas a maior parte dos textos foi gravada como bytes UTF-8
 * (às vezes convertidos duas vezes). A ponte lê os bytes crus e normaliza para UTF-8.
 */
final class Texto
{
    /** Bytes do banco -> UTF-8 legível (corrige dupla codificação). */
    public static function doBanco(?string $s): string
    {
        if ($s === null || $s === '') {
            return '';
        }
        if (!mb_check_encoding($s, 'UTF-8')) {
            // latin1 de verdade
            return mb_convert_encoding($s, 'UTF-8', 'ISO-8859-1');
        }
        // Desfaz até 3 camadas de "Ã§" (UTF-8 relido como latin1 e regravado)
        for ($i = 0; $i < 3; $i++) {
            if (!preg_match('/[\xC3\xC2][\x80-\xBF]/', $s)) {
                break;
            }
            $t = mb_convert_encoding($s, 'ISO-8859-1', 'UTF-8');
            if ($t === $s || !mb_check_encoding($t, 'UTF-8')) {
                break;
            }
            $s = $t;
        }
        return $s;
    }

    /**
     * Texto UTF-8 -> bytes para gravar. As telas do sistema enviam UTF-8 por AJAX e
     * gravam os bytes como estão; a ponte faz o mesmo para exibir igual.
     */
    public static function paraBanco(string $s): string
    {
        return $s;
    }

    public static function digitos(?string $s): string
    {
        return preg_replace('/\D+/', '', (string)$s) ?? '';
    }

    /** Chave de comparação de telefone: últimos 8 dígitos (ignora DDD e o 9 extra). */
    public static function chaveTelefone(?string $s): string
    {
        $d = self::digitos($s);
        if (strlen($d) > 11 && str_starts_with($d, '55')) {
            $d = substr($d, 2);
        }
        return strlen($d) >= 8 ? substr($d, -8) : '';
    }

    /** Telefone celular em E.164 sem "+" (55 + DDD + número), ou '' se inválido. */
    public static function telefoneWhatsapp(?string $s): string
    {
        $d = self::digitos($s);
        if (str_starts_with($d, '55') && strlen($d) >= 12) {
            $d = substr($d, 2);
        }
        if (strlen($d) === 10 || strlen($d) === 11) {
            return '55' . $d;
        }
        return '';
    }

    public static function cpfValido(?string $s): bool
    {
        return strlen(self::digitos($s)) === 11;
    }

    public static function mascararCpf(?string $s): string
    {
        $d = self::digitos($s);
        if (strlen($d) !== 11) {
            return '';
        }
        return '***.' . substr($d, 3, 3) . '.' . substr($d, 6, 3) . '-**';
    }

    /**
     * Valor do sistema ("1.234,56", "120,00", "0.01") -> centavos.
     * Retorna null para vazio.
     */
    public static function centavos(?string $v): ?int
    {
        $v = trim((string)$v);
        if ($v === '') {
            return null;
        }
        if (str_contains($v, ',')) {
            $v = str_replace(['.', ' '], '', $v);
            $v = str_replace(',', '.', $v);
        }
        if (!is_numeric($v)) {
            return null;
        }
        return (int)round(((float)$v) * 100);
    }

    /** Centavos -> "1.234,56" (formato da máscara moeda() das telas). */
    public static function moedaSistema(int $centavos): string
    {
        return number_format($centavos / 100, 2, ',', '.');
    }

    /** Centavos -> "1234.56" (formato da tabela contabil). */
    public static function moedaContabil(int $centavos): string
    {
        return number_format($centavos / 100, 2, '.', '');
    }

    /** Centavos -> "R$ 1.234,56". */
    public static function reais(int $centavos): string
    {
        return 'R$ ' . self::moedaSistema($centavos);
    }

    /**
     * Reproduz a subtração que o PHP 5.4 faz com textos "120,00" - "90,00":
     * ele lê só a parte antes da vírgula. É assim que VLR_DES é gravado hoje.
     */
    public static function subtracaoLegada(string $a, string $b): string
    {
        $na = self::numeroInicialLegado($a);
        $nb = self::numeroInicialLegado($b);
        $r = $na - $nb;
        // PHP imprime floats inteiros sem casas ("30") e os demais com ponto ("0.03")
        if (floor($r) == $r) {
            return (string)(int)$r;
        }
        return rtrim(rtrim(sprintf('%.14F', $r), '0'), '.');
    }

    private static function numeroInicialLegado(string $s): float
    {
        if (preg_match('/^\s*[-+]?(\d+(\.\d*)?|\.\d+)/', $s, $m)) {
            return (float)$m[0];
        }
        return 0.0;
    }

    /** "2026-11-05", "05/11/2026" ou "05-11-2026" -> "2026-11-05" (ou '' se inválida). */
    public static function dataIso(?string $s): string
    {
        $s = trim((string)$s);
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $s, $m)) {
            return checkdate((int)$m[2], (int)$m[3], (int)$m[1]) ? "$m[1]-$m[2]-$m[3]" : '';
        }
        if (preg_match('/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/', $s, $m)) {
            return checkdate((int)$m[2], (int)$m[1], (int)$m[3]) ? "$m[3]-$m[2]-$m[1]" : '';
        }
        return '';
    }

    public static function dataBr(string $iso): string
    {
        $iso = self::dataIso($iso);
        return $iso === '' ? '' : implode('/', array_reverse(explode('-', $iso)));
    }

    /** Dias corridos de $de até $ate (positivo se $ate é depois). */
    public static function diasEntre(string $de, string $ate): int
    {
        $a = new \DateTimeImmutable($de);
        $b = new \DateTimeImmutable($ate);
        return (int)$a->diff($b)->format('%r%a');
    }
}
