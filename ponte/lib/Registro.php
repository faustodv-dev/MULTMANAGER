<?php
declare(strict_types=1);

namespace Ponte;

/**
 * Registro de toda escrita feita pela ponte (tabela própria `ponte_log`), que também
 * garante idempotência: a mesma chave nunca executa duas vezes.
 */
final class Registro
{
    public function __construct(private Db $db)
    {
        $this->criarTabela();
    }

    private function criarTabela(): void
    {
        if ($this->db->driver() === 'mysql') {
            $this->db->pdo->exec(
                'CREATE TABLE IF NOT EXISTS `ponte_log` (
                    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    `criado_em` DATETIME NOT NULL,
                    `acao` VARCHAR(40) NOT NULL,
                    `chave` VARCHAR(120) NULL,
                    `status` VARCHAR(20) NOT NULL,
                    `requisicao` MEDIUMTEXT NULL,
                    `resultado` MEDIUMTEXT NULL,
                    UNIQUE KEY `uk_chave` (`chave`),
                    KEY `idx_criado` (`criado_em`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
            );
        } else {
            $this->db->pdo->exec(
                'CREATE TABLE IF NOT EXISTS ponte_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, criado_em TEXT NOT NULL, acao TEXT NOT NULL,
                    chave TEXT NULL UNIQUE, status TEXT NOT NULL, requisicao TEXT NULL, resultado TEXT NULL)'
            );
        }
    }

    /** Resultado já gravado para a chave (execução anterior concluída), ou null. */
    public function anterior(string $chave): ?array
    {
        $r = $this->db->um("SELECT status, resultado FROM ponte_log WHERE chave = ? AND status = 'ok'", [$chave]);
        if (!$r) {
            return null;
        }
        $res = json_decode((string)$r['resultado'], true) ?: [];
        $res['repetida'] = true;
        return $res;
    }

    public function gravar(string $acao, ?string $chave, string $status, array $req, array $res): void
    {
        $agora = (new \DateTimeImmutable('now', new \DateTimeZone('America/Sao_Paulo')))->format('Y-m-d H:i:s');
        $json = fn($v) => json_encode($v, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($chave !== null && $status !== 'ok') {
            // Falhas não ocupam a chave: a mesma operação pode ser tentada de novo
            $chave = null;
        }
        if ($chave !== null) {
            $this->db->executar('DELETE FROM ponte_log WHERE chave = ? AND status <> ?', [$chave, 'ok']);
        }
        $this->db->executar(
            'INSERT INTO ponte_log (criado_em, acao, chave, status, requisicao, resultado) VALUES (?, ?, ?, ?, ?, ?)',
            [$agora, $acao, $chave, $status, $json($req), $json($res)]
        );
    }
}
