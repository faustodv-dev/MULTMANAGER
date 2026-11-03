<?php
declare(strict_types=1);

/**
 * Ponte entre o CRM (Vercel) e o sistema escolar (MySQL de cada unidade).
 *
 * Toda chamada é POST com JSON: {"acao": "...", "unidade": "rio_verde", ...parâmetros}
 * Autenticação: cabeçalhos X-Ponte-Ts (unix) e X-Ponte-Assinatura =
 *   hex(HMAC-SHA256(segredo, ts + "." + corpo_bruto)), validade de 5 minutos.
 */

use Ponte\Db;
use Ponte\ErroPonte;
use Ponte\Escola;
use Ponte\Financeiro;

spl_autoload_register(function (string $classe): void {
    if (str_starts_with($classe, 'Ponte\\')) {
        require __DIR__ . '/lib/' . substr($classe, 6) . '.php';
    }
});
date_default_timezone_set('America/Sao_Paulo');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function responder(int $http, array $corpo): void
{
    http_response_code($http);
    echo json_encode($corpo, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

$cfgArquivo = __DIR__ . '/config.php';

// Aberto no navegador (GET): só um teste de instalação, sem dados
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    $ext = ['pdo_mysql', 'mbstring', 'json', 'openssl'];
    responder(405, [
        'ok' => false,
        'erro' => 'metodo',
        'instalacao' => [
            'php' => PHP_VERSION,
            'php_ok' => version_compare(PHP_VERSION, '8.0.0', '>='),
            'extensoes' => array_combine($ext, array_map('extension_loaded', $ext)),
            'config' => is_file($cfgArquivo),
            'https' => (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off'),
        ],
    ]);
}
if (!is_file($cfgArquivo)) {
    responder(500, ['ok' => false, 'erro' => 'config_ausente']);
}
/** @var array<string,mixed> $CONFIG */
$CONFIG = require $cfgArquivo;
$corpo = file_get_contents('php://input') ?: '';
if (strlen($corpo) > 1_000_000) {
    responder(413, ['ok' => false, 'erro' => 'corpo_grande']);
}

// --- Autenticação HMAC ---
$ts = (string)($_SERVER['HTTP_X_PONTE_TS'] ?? '');
$assinatura = strtolower((string)($_SERVER['HTTP_X_PONTE_ASSINATURA'] ?? ''));
$segredo = (string)($CONFIG['segredo'] ?? '');
if (strlen($segredo) < 32) {
    responder(500, ['ok' => false, 'erro' => 'segredo_fraco']);
}
if (!ctype_digit($ts) || abs(time() - (int)$ts) > 300) {
    responder(401, ['ok' => false, 'erro' => 'tempo_invalido']);
}
$esperada = hash_hmac('sha256', $ts . '.' . $corpo, $segredo);
if (!hash_equals($esperada, $assinatura)) {
    responder(401, ['ok' => false, 'erro' => 'assinatura_invalida']);
}

$req = json_decode($corpo, true);
if (!is_array($req)) {
    responder(400, ['ok' => false, 'erro' => 'json_invalido']);
}
$acao = (string)($req['acao'] ?? '');
$codUnidade = (string)($req['unidade'] ?? '');
$unidades = $CONFIG['unidades'] ?? [];
if (!isset($unidades[$codUnidade])) {
    responder(404, ['ok' => false, 'erro' => 'unidade_desconhecida']);
}
$U = $unidades[$codUnidade];

$s = fn(string $k, string $padrao = ''): string => trim((string)($req[$k] ?? $padrao));
$hoje = date('Y-m-d');

try {
    $db = Db::conectar($U['banco']);
    if ($db->driver() === 'mysql') {
        $db->pdo->exec("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
    }
    $escola = new Escola($db);
    $somenteLeitura = !empty($U['somente_leitura']);
    $fin = fn() => $somenteLeitura
        ? throw new ErroPonte('somente_leitura', 'Unidade configurada só para leitura.', [], 403)
        : new Financeiro($db, $escola, $U['agente']);
    $unidadeInfo = fn() => array_merge($escola->unidade(), [
        'pix_chave' => (string)($U['pix_chave'] ?? ''),
        'pix_titular' => (string)($U['pix_titular'] ?? ''),
    ]);

    $dados = match ($acao) {
        'ping' => [
            'unidade' => $codUnidade,
            'hora' => date('c'),
            'banco' => $db->um('SELECT 1 AS ok') !== null,
            'baixa_automatica' => !empty($U['baixa_automatica']),
            'somente_leitura' => $somenteLeitura,
        ],
        'unidade' => $unidadeInfo(),
        'buscar_telefone' => $escola->buscarPorTelefone($s('telefone')),
        'buscar_cpf' => $escola->buscarPorCpf($s('cpf')),
        'aluno' => $escola->aluno($s('cod_alu')),
        'parcelas' => $escola->parcelasEmAberto(
            array_map('strval', (array)($req['cod_alus'] ?? [])),
            \Ponte\Texto::dataIso($s('data_referencia')) ?: $hoje
        ),
        'frequencia' => $escola->frequencia($s('cod_alu')),
        'parcelas_status' => $escola->parcelasStatus(array_map('intval', (array)($req['cod_pars'] ?? []))),
        'ocorrencias' => $escola->ocorrencias($s('cod_alu'), (int)($req['limite'] ?? 15)),
        'agendamentos' => $escola->agendamentos((array)($req['cod_alus'] ?? []), $hoje),
        'carteira' => $escola->carteiraPorVencimento([
            'datas' => (array)($req['datas'] ?? []),
            'de' => (string)($req['de'] ?? ''),
            'ate' => (string)($req['ate'] ?? ''),
            'statuses' => (array)($req['statuses'] ?? []),
        ]),
        'cartas' => (new Financeiro($db, $escola, $U['agente']))->cartas(),
        'conciliar' => (function () use ($escola, $req, $s, $hoje) {
            $data = \Ponte\Texto::dataIso($s('data_pagamento')) ?: $hoje;
            $docs = $escola->parcelasEmAberto(array_map('strval', (array)($req['cod_alus'] ?? [])), $data)['documentos'];
            $docs = array_values(array_filter($docs, fn($d) => $d['vencimento'] <= date('Y-m-d', strtotime($data . ' +45 days'))));
            return \Ponte\Calculo::conciliar($docs, (int)($req['valor_pago'] ?? 0)) + ['data_pagamento' => $data];
        })(),
        'simular_baixa' => $fin()->baixar((array)($req['cod_pars'] ?? []), (int)($req['valor_pago'] ?? 0), $s('data_pagamento'), '', true, $s('origem', 'agente')),
        'baixar' => empty($U['baixa_automatica'])
            ? throw new ErroPonte('baixa_desligada', 'Baixa automática desligada nesta unidade (modo sombra).', [], 403)
            : $fin()->baixar((array)($req['cod_pars'] ?? []), (int)($req['valor_pago'] ?? 0), $s('data_pagamento'), $s('chave'), false, $s('origem', 'agente'), $s('detalhe'), !empty($req['confiar_valor'])),
        'registrar_ocorrencia' => $fin()->registrarOcorrencia($s('cod_alu'), $s('matricula'), $s('texto'), $s('chave')),
        'agendar_pagamento' => $fin()->agendarPagamento($s('cod_alu'), $s('matricula'), $s('vencimento'), $s('data_pagamento'), $s('chave')),
        'registrar_carta' => $fin()->registrarCarta($s('cod_alu'), (int)($req['cod_carta'] ?? 0), $s('data'), $s('chave')),
        'carne' => $fin()->carne($s('cod_alu'), array_map('intval', (array)($req['cod_pars'] ?? [])), $unidadeInfo()),
        default => throw new ErroPonte('acao_desconhecida', 'Ação desconhecida.', [], 400),
    };
    responder(200, ['ok' => true, 'dados' => $dados]);
} catch (ErroPonte $e) {
    responder($e->http, ['ok' => false, 'erro' => $e->codigo, 'mensagem' => $e->getMessage(), 'detalhes' => $e->detalhes]);
} catch (\PDOException $e) {
    error_log('[ponte] PDO: ' . $e->getMessage());
    responder(503, ['ok' => false, 'erro' => 'banco_indisponivel', 'mensagem' => 'Falha ao acessar o banco da unidade.',
        'detalhes' => ['erro' => preg_replace('/\(using password: \w+\)/', '', $e->getMessage())]]);
} catch (\Throwable $e) {
    error_log('[ponte] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    // Só chega aqui quem passou na assinatura HMAC (o CRM): pode ver o detalhe técnico
    responder(500, ['ok' => false, 'erro' => 'interno', 'mensagem' => 'Erro interno na ponte.',
        'detalhes' => ['tipo' => get_class($e), 'erro' => $e->getMessage(), 'onde' => basename($e->getFile()) . ':' . $e->getLine()]]);
}
