<?php
declare(strict_types=1);

namespace Ponte;

/**
 * Gerador de PDF mínimo (sem dependências): texto Helvetica, linhas, retângulos.
 * Coordenadas em milímetros a partir do canto superior esquerdo de uma página A4.
 */
final class Pdf
{
    private const PT = 2.834645669; // pontos por mm
    private float $largura = 210.0;
    private float $altura = 297.0;
    /** @var array<int,string> */
    private array $paginas = [];
    private int $atual = -1;

    public function novaPagina(): void
    {
        $this->paginas[] = '';
        $this->atual = count($this->paginas) - 1;
    }

    private function op(string $s): void
    {
        if ($this->atual < 0) {
            $this->novaPagina();
        }
        $this->paginas[$this->atual] .= $s . "\n";
    }

    private function x(float $mm): string
    {
        return sprintf('%.2F', $mm * self::PT);
    }

    private function y(float $mm): string
    {
        return sprintf('%.2F', ($this->altura - $mm) * self::PT);
    }

    public function retangulo(float $x, float $y, float $w, float $h, bool $preencher = false, float $cinza = 0.88): void
    {
        $r = sprintf('%s %s %.2F %.2F re', $this->x($x), $this->y($y + $h), $w * self::PT, $h * self::PT);
        if ($preencher) {
            $this->op(sprintf('q %.2F g %s f Q', $cinza, $r));
        }
        $this->op('0.3 w 0 G ' . $r . ' S');
    }

    public function barra(float $x, float $y, float $w, float $h): void
    {
        $this->op(sprintf('0 g %s %s %.3F %.2F re f', $this->x($x), $this->y($y + $h), $w * self::PT, $h * self::PT));
    }

    public function linhaTracejada(float $x1, float $y, float $x2): void
    {
        $this->op(sprintf('q [3 2] 0 d 0.4 w %s %s m %s %s l S Q', $this->x($x1), $this->y($y), $this->x($x2), $this->y($y)));
    }

    /**
     * Texto em uma linha. $alinhar: L, C ou R dentro de [$x, $x+$w].
     */
    public function texto(float $x, float $y, string $txt, float $tamanho = 8, bool $negrito = false, string $alinhar = 'L', float $w = 0): void
    {
        $fonte = $negrito ? 'F2' : 'F1';
        $bytes = self::winAnsi($txt);
        if ($alinhar !== 'L' && $w > 0) {
            $larg = self::larguraTexto($bytes, $tamanho, $negrito) / self::PT;
            $x = $alinhar === 'C' ? $x + ($w - $larg) / 2 : $x + $w - $larg;
        }
        $esc = strtr($bytes, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']);
        $this->op(sprintf('BT /%s %.1F Tf %s %s Td (%s) Tj ET', $fonte, $tamanho, $this->x($x), $this->y($y), $esc));
    }

    /** Texto que quebra em várias linhas dentro da largura. Retorna a altura usada (mm). */
    public function paragrafo(float $x, float $y, float $w, string $txt, float $tamanho = 8, bool $negrito = false, float $entrelinha = 1.25): float
    {
        $palavras = preg_split('/\s+/', trim($txt)) ?: [];
        $linha = '';
        $dy = 0.0;
        $alturaLinha = $tamanho * $entrelinha / self::PT;
        foreach ($palavras as $p) {
            $teste = $linha === '' ? $p : "$linha $p";
            if ($linha !== '' && self::larguraTexto(self::winAnsi($teste), $tamanho, $negrito) / self::PT > $w) {
                $this->texto($x, $y + $dy, $linha, $tamanho, $negrito);
                $dy += $alturaLinha;
                $linha = $p;
            } else {
                $linha = $teste;
            }
        }
        if ($linha !== '') {
            $this->texto($x, $y + $dy, $linha, $tamanho, $negrito);
            $dy += $alturaLinha;
        }
        return $dy;
    }

    public static function winAnsi(string $utf8): string
    {
        $s = @mb_convert_encoding($utf8, 'Windows-1252', 'UTF-8');
        return is_string($s) ? $s : preg_replace('/[^\x20-\x7E]/', '?', $utf8);
    }

    /** Largura aproximada em pontos (métricas médias da Helvetica). */
    public static function larguraTexto(string $bytes, float $tamanho, bool $negrito = false): float
    {
        $total = 0;
        $len = strlen($bytes);
        for ($i = 0; $i < $len; $i++) {
            $c = $bytes[$i];
            if (str_contains('il.,:;|!\'', $c)) {
                $total += 278;
            } elseif (str_contains('fjrtI()[]/- ', $c)) {
                $total += 333;
            } elseif (str_contains('mwMW', $c)) {
                $total += 833;
            } elseif (ctype_upper($c)) {
                $total += 690;
            } elseif (ctype_digit($c)) {
                $total += 556;
            } else {
                $total += 540;
            }
        }
        return $total * $tamanho / 1000 * ($negrito ? 1.06 : 1.0);
    }

    public function gerar(string $titulo = 'Documento'): string
    {
        if (!$this->paginas) {
            $this->novaPagina();
        }
        $objs = [];
        $objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $kids = [];
        $n = count($this->paginas);
        $f1 = 3 + 2 * $n;
        $f2 = $f1 + 1;
        $info = $f2 + 1;
        foreach ($this->paginas as $i => $conteudo) {
            $pg = 3 + 2 * $i;
            $ct = $pg + 1;
            $kids[] = "$pg 0 R";
            $objs[$pg] = sprintf(
                '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2F %.2F] /Resources << /Font << /F1 %d 0 R /F2 %d 0 R >> >> /Contents %d 0 R >>',
                $this->largura * self::PT,
                $this->altura * self::PT,
                $f1,
                $f2,
                $ct
            );
            $objs[$ct] = '<< /Length ' . strlen($conteudo) . " >>\nstream\n" . $conteudo . "\nendstream";
        }
        $objs[2] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . "] /Count $n >>";
        $objs[$f1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objs[$f2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        $tit = strtr(self::winAnsi($titulo), ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']);
        $objs[$info] = "<< /Title ($tit) /Producer (MULT Ponte) >>";
        ksort($objs);

        $out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];
        foreach ($objs as $num => $corpo) {
            $offsets[$num] = strlen($out);
            $out .= "$num 0 obj\n$corpo\nendobj\n";
        }
        $xref = strlen($out);
        $total = max(array_keys($objs)) + 1;
        $out .= "xref\n0 $total\n0000000000 65535 f \n";
        for ($i = 1; $i < $total; $i++) {
            $out .= sprintf("%010d 00000 n \n", $offsets[$i] ?? 0);
        }
        $out .= "trailer\n<< /Size $total /Root 1 0 R /Info $info 0 R >>\nstartxref\n$xref\n%%EOF\n";
        return $out;
    }
}
