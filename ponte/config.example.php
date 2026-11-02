<?php
/**
 * Copie para config.php (NUNCA versionar config.php) e preencha.
 * Segredo: texto aleatório com 40+ caracteres (ex.: no navegador, F12 > Console:
 *   crypto.randomUUID() + crypto.randomUUID() ). O mesmo valor vai na Vercel como PONTE_SEGREDO.
 */
return [
    'segredo' => 'COLE_AQUI_O_SEGREDO',

    'unidades' => [
        'rio_verde' => [
            'banco' => [
                'host' => 'localhost',
                'port' => 3306,
                'database' => 'neto_rioverde',
                'user' => 'neto_ponte',
                'password' => 'SENHA_DO_USUARIO_neto_ponte',
                'charset' => 'latin1',
            ],
            // Usuário criado em dados_usuarios para identificar as ações do agente
            'agente' => ['usuario_id' => 0, 'login' => 'AGENTE IA'], // troque o 0 pelo ID do usuário AGENTE IA
            // Dados impressos no carnê
            'pix_chave' => '26.436.081/0001-60',
            'pix_titular' => 'MULT PROFISSOES FRANCHISING',
            // Modo sombra: false = a ponte recusa a baixa real (só simula)
            'baixa_automatica' => false,
            // true = bloqueia qualquer escrita nesta unidade
            'somente_leitura' => false,
        ],
    ],
];
