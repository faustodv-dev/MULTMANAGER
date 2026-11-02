<?php
declare(strict_types=1);

/**
 * Testes da ponte com SQLite (estrutura e formatos iguais aos do banco real).
 * Uso: php ponte/tests/run.php [pasta_saida]
 */

use Ponte\Calculo;
use Ponte\Carne;
use Ponte\Db;
use Ponte\ErroPonte;
use Ponte\Escola;
use Ponte\Financeiro;
use Ponte\Texto;

spl_autoload_register(function (string $c): void {
    if (str_starts_with($c, 'Ponte\\')) {
        require __DIR__ . '/../lib/' . substr($c, 6) . '.php';
    }
});
date_default_timezone_set('America/Sao_Paulo');

$falhas = 0;
$total = 0;
function confere(string $nome, mixed $obtido, mixed $esperado): void
{
    global $falhas, $total;
    $total++;
    if ($obtido === $esperado) {
        echo "  ok  $nome\n";
    } else {
        $falhas++;
        echo "FALHA $nome\n      esperado: " . var_export($esperado, true) . "\n      obtido:   " . var_export($obtido, true) . "\n";
    }
}
function lanca(string $nome, callable $f, string $codigo): void
{
    try {
        $f();
        confere($nome, 'sem erro', $codigo);
    } catch (ErroPonte $e) {
        confere($nome, $e->codigo, $codigo);
    }
}

echo "== Texto\n";
confere('mojibake duplo', Texto::doBanco("Reposi\xC3\x83\xC2\xA7\xC3\x83\xC2\xA3o"), 'Reposição');
confere('utf8 normal', Texto::doBanco('Pedagógico'), 'Pedagógico');
confere('latin1 real', Texto::doBanco("Jo\xE3o"), 'João');
confere('centavos 120,00', Texto::centavos('120,00'), 12000);
confere('centavos 1.100,00', Texto::centavos('1.100,00'), 110000);
confere('centavos 0.01', Texto::centavos('0.01'), 1);
confere('legado 120-90', Texto::subtracaoLegada('120,00', '90,00'), '30');
confere('legado 120-106,65', Texto::subtracaoLegada('120,00', '106,65'), '14');
confere('legado 1.030-1.000', Texto::subtracaoLegada('1.030,00', '1.000,00'), '0.03');
confere('legado atraso negativo', Texto::subtracaoLegada('120,00', '216,93'), '-96');
confere('moeda sistema', Texto::moedaSistema(123456), '1.234,56');
confere('telefone chave', Texto::chaveTelefone('(64) 99912-3456'), '99123456');
confere('telefone whatsapp', Texto::telefoneWhatsapp('5564999123456'), '5564999123456');
confere('data br', Texto::dataIso('05/11/2026'), '2026-11-05');

echo "== Cálculo (exemplo do carnê do print: 2 x 120,00 em 05/11)\n";
$p = fn($cod, $alu, $mat, $v, $venc, $tipo = 'PARC') => ['cod_par' => $cod, 'cod_alu' => $alu, 'num_matricula' => $mat, 'tipo_par' => $tipo, 'valor' => $v, 'vencimento' => $venc];
$edilson = [$p(326669, '13882', 'HAR', 12000, '2026-11-05'), $p(326670, '13882', 'INF', 12000, '2026-11-05')];
$d = Calculo::documentos($edilson, '2026-11-05')[0];
confere('valor documento 210', $d['valor_documento'], 21000);
confere('em dia 180', $d['valor_devido'], 18000);
confere('rateio em dia 90/90', Calculo::rateio($d), [326669 => 9000, 326670 => 9000]);
$d10 = Calculo::documentos($edilson, '2026-11-15')[0];
confere('10 dias atraso (opção C) 216,93', $d10['valor_devido'], 21693);
confere('rateio atraso soma', array_sum(Calculo::rateio($d10)), 21693);
$ex = [$p(1, '1', 'ING', 10495, '2026-11-10'), $p(2, '1', 'INF', 10495, '2026-11-10')];
confere('exemplo 104,95 x2 em dia = 149,90', Calculo::documentos($ex, '2026-11-10')[0]['valor_devido'], 14990);
$um = [$p(9, '2', 'X', 12000, '2026-10-01')];
confere('parcela única atrasada 30 dias', Calculo::documentos($um, '2026-10-31')[0]['valor_devido'], 12000 + 1188);
$resc = [$p(10, '3', 'X', 50000, '2026-11-20', 'RESC')];
confere('rescisão sem desconto', Calculo::documentos($resc, '2026-11-01')[0]['valor_devido'], 50000);
confere('placeholder 0,01 ignorado', count(Calculo::documentos([$p(11, '4', '', 1, '2026-11-01')], '2026-11-01')), 0);

echo "== Conciliação\n";
$docs = Calculo::documentos(array_merge($edilson, [$p(326700, '13882', 'HAR', 12000, '2026-12-05'), $p(326701, '13882', 'INF', 12000, '2026-12-05')]), '2026-11-04');
confere('180 quita novembro', Calculo::conciliar($docs, 18000)['documentos'][0]['vencimento'] ?? null, '2026-11-05');
confere('360 quita dois', count(Calculo::conciliar($docs, 36000)['documentos'] ?? []), 2);
confere('175 não bate', Calculo::conciliar($docs, 17500)['status'], 'sem_correspondencia');

echo "== Código de barras (formato do sistema)\n";
$cb = Carne::codigoBarras([326669, 326670]);
confere('10 dígitos terminando em 32666', strlen($cb) === 10 && str_ends_with($cb, '32666'), true);
confere('padrão começa 2222 e termina 422', str_starts_with(Carne::padraoBarras('9386232666'), '2222') && str_ends_with(Carne::padraoBarras('9386232666'), '422'), true);

echo "== Banco (SQLite com estrutura do neto_rioverde)\n";
$pdo = new PDO('sqlite::memory:');
$db = new Db($pdo);
$pdo->exec(file_get_contents(__DIR__ . '/schema_sqlite.sql'));
$pdo->exec(file_get_contents(__DIR__ . '/dados_teste.sql'));
$escola = new Escola($db);

$g = $escola->buscarPorTelefone('5564999990001');
confere('pai encontrado pelo telefone do responsável', count($g), 1);
confere('pai tem 3 filhos', count($g[0]['alunos'] ?? []), 3);
confere('nome do responsável', $g[0]['nome_responsavel'] ?? '', 'José da Silva');
$g2 = $escola->buscarPorTelefone('(64) 98888-0002');
confere('aluno pelo próprio whatsapp', $g2[0]['alunos'][0]['nome'] ?? '', 'EDILSON JOSE DA SILVA LIMA');
confere('responsável é o próprio aluno', $g2[0]['responsavel_e_aluno'] ?? null, true);
confere('matrículas do Edilson', count($g2[0]['alunos'][0]['matriculas'] ?? []), 2);
confere('nome do curso', $g2[0]['alunos'][0]['matriculas'][0]['curso_nome'] ?? '', 'Hardware');
confere('busca por cpf do responsável', count($escola->buscarPorCpf('111.222.333-44')[0]['alunos'] ?? []), 3);
lanca('telefone inválido', fn() => $escola->buscarPorTelefone('12'), 'telefone_invalido');

$par = $escola->parcelasEmAberto(['13882'], '2026-11-04');
confere('documentos do Edilson', count($par['documentos']), 2);
confere('primeiro documento 180', $par['documentos'][0]['valor_devido'], 18000);

$freq = $escola->frequencia('13882');
confere('frequência: matrículas', count($freq), 1);
confere('frequência: faltas seguidas', $freq[0]['faltas_seguidas_atuais'] ?? null, 2);
confere('frequência: %', $freq[0]['percentual_presenca'] ?? null, 60.0);

$fin = new Financeiro($db, $escola, ['usuario_id' => 175, 'login' => 'AGENTE IA'], new DateTimeImmutable('2026-11-04 10:00:00'));
lanca('valor divergente bloqueia', fn() => $fin->baixar([326669, 326670], 17000, '2026-11-04', 'k0', true, 'teste'), 'valor_divergente');
lanca('documento incompleto bloqueia', fn() => $fin->baixar([326669], 9000, '2026-11-04', 'k0', true, 'teste'), 'documento_incompleto');
$sim = $fin->baixar([326669, 326670], 18000, '2026-11-04', '', true, 'teste');
confere('simulação não grava', $db->um('SELECT DAT_BAI FROM s_cad_parcela WHERE COD_PAR = 326669')['DAT_BAI'], null);
confere('simulação rateio', array_column($sim['parcelas'], 'valor_cobrado'), [9000, 9000]);

$saldoAntes = $db->um("SELECT VALOR FROM f_cad_saldo WHERE TIPO='C'")['VALOR'];
$r = $fin->baixar([326669, 326670], 18000, '2026-11-04', 'comprovante-abc', false, 'teste', 'Pix conferido no extrato Asaas.');
$p1 = $db->um('SELECT VLR_COB, DAT_BAI, VLR_DES FROM s_cad_parcela WHERE COD_PAR = 326669');
confere('baixa: VLR_COB', $p1['VLR_COB'], '90,00');
confere('baixa: DAT_BAI', $p1['DAT_BAI'], '2026-11-04');
confere('baixa: VLR_DES como o sistema grava', $p1['VLR_DES'], '30');
$c = $db->todos('SELECT * FROM contabil WHERE COD_FIN IN (?, ?) ORDER BY COD_FIN', ['326669', '326670']);
confere('contabil: 2 lançamentos', count($c), 2);
confere('contabil: valor', $c[0]['VLR_CON'], '90.00');
confere('contabil: descrição', $c[0]['DESC_CON'], 'Parcela 1 de 2');
confere('contabil: crédito/usuário', [$c[0]['DEBI_CRED'], $c[0]['CODI_USU'], $c[0]['CODI_TIPO_LAN']], ['C', '175', '1']);
confere('saldo C somado', $db->um("SELECT VALOR FROM f_cad_saldo WHERE TIPO='C'")['VALOR'], Texto::moedaContabil((int)round((float)$saldoAntes * 100) + 18000));
$o = $db->um("SELECT * FROM s_cad_ocorrencia WHERE COD_ALU = '13882' ORDER BY COD_OCO DESC");
confere('ocorrência informativo', [$o['STATUS_OCO'], $o['PRO_OCO']], ['Informativo', 'AGENTE IA']);
confere('ocorrência texto', str_contains($o['OCO_OCO'], 'R$ 180,00') && str_contains($o['OCO_OCO'], 'Asaas'), true);
confere('ocorrência status anterior', $o['STATUS_ANT_OCO'], 'Ativo');
$rep = $fin->baixar([326669, 326670], 18000, '2026-11-04', 'comprovante-abc', false, 'teste');
confere('mesma chave não baixa duas vezes', $rep['repetida'] ?? false, true);
confere('contabil continua com 2', count($db->todos("SELECT 1 FROM contabil WHERE COD_FIN IN ('326669','326670')")), 2);
lanca('outra chave: parcela já baixada', fn() => $fin->baixar([326669, 326670], 18000, '2026-11-04', 'outra', false, 'teste'), 'parcela_ja_baixada');

$ag = $fin->agendarPagamento('13882', '', '2026-12-05', '2026-11-07', 'ag-1');
$a = $db->um('SELECT * FROM s_cad_agend_pag WHERE ID = ?', [$ag['agendamento_id']]);
confere('agendamento gravado', [(string)$a['COD_ALU'], $a['DAT_VENC'], (string)$a['RESP']], ['13882', '2026-12-05', '0']);
$oa = $db->um('SELECT * FROM s_cad_ocorrencia WHERE COD_OCO = ?', [$ag['ocorrencia']['cod_oco']]);
confere('ocorrência agend_pag ligada', [$oa['STATUS_OCO'], $oa['ID_REP']], ['agend_pag', (string)$ag['agendamento_id']]);

$ca = $fin->registrarCarta('13882', 9, '2026-11-02', 'carta-1');
confere('carta registrada', $db->um('SELECT NOM_CART FROM historico_carta WHERE COD_HIST = ?', [$ca['cod_hist']])['NOM_CART'], 'Carta 1 - 15 dias - Envio Dia 10 e 30');

$carne = $fin->carne('13882', [], ['nome' => 'MULTPROFISSOES DE RIO VERDE - POPULAR', 'razao_social' => 'MULT Profissoes', 'cnpj' => '', 'pix_chave' => '26.436.081/0001-60', 'pix_titular' => 'MULT PROFISSOES FRANCHISING']);
confere('carnê gera PDF', str_starts_with(base64_decode($carne['pdf_base64']), '%PDF-1.4'), true);
confere('carnê grava código de barras', $db->um('SELECT COD_BARRA FROM s_cad_parcela WHERE COD_PAR = 326700')['COD_BARRA'], $carne['documentos'][0]['codigo_barras']);
$saida = $argv[1] ?? sys_get_temp_dir();
file_put_contents($saida . '/carne_teste.pdf', base64_decode($carne['pdf_base64']));

$atr = $escola->parcelasEmAberto(['20001'], date('Y-m-d'));
confere('parcela antiga atrasada tem juros', ($atr['documentos'][0]['juros'] ?? 0) > 0, true);

echo "== Reconciliação (parcelas_status) e baixa confirmada pelo Asaas\n";
$st0 = $escola->parcelasStatus([400002, 400001]);
confere('parcelas_status: 400002 ainda aberta', current(array_filter($st0, fn($s) => $s['cod_par'] === 400002))['baixada'], false);
// Baixa confirmada (ex.: Asaas) com valor diferente do recomputado, mas desconto <= 30
$fin->baixar([400002], 13000, '2026-11-04', 'asaas-teste', false, 'asaas', 'Pago no Asaas.', true);
$p400 = $db->um('SELECT VLR_COB, VLR_DES, DAT_BAI FROM s_cad_parcela WHERE COD_PAR = 400002');
confere('baixa confirmada grava valor recebido', $p400['VLR_COB'], '130,00');
confere('baixa confirmada: desconto', $p400['VLR_DES'], Texto::subtracaoLegada('149,90', '130,00'));
$st1 = $escola->parcelasStatus([400002]);
confere('parcelas_status: 400002 agora baixada', $st1[0]['baixada'], true);

echo "\n$total verificações, $falhas falha(s)\n";
exit($falhas ? 1 : 0);
