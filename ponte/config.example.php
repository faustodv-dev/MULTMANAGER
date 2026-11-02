<?php
/**
 * Copie para config.php (NUNCA versionar config.php) e preencha.
 * Gere o segredo com:  php -r "echo bin2hex(random_bytes(32));"
 * O mesmo segredo vai na Vercel como PONTE_SEGREDO.
 */
return [
    'segredo' => 'COLE_AQUI_64_CARACTERES_HEX',

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
            'agente' => ['usuario_id' => 0, 'login' => 'AGENTE IA'], // troque o 0 pelo ID do passo 1,
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
