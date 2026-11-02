<?php
declare(strict_types=1);

namespace Ponte;

use PDO;

/** Conexão PDO com o banco de uma unidade. Consultas sempre parametrizadas. */
final class Db
{
    public function __construct(public PDO $pdo)
    {
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $this->pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
    }

    /** @param array<string,mixed> $cfg host, port, database, user, password, charset */
    public static function conectar(array $cfg): self
    {
        if (!empty($cfg['dsn'])) {
            // usado só nos testes (SQLite)
            return new self(new PDO($cfg['dsn']));
        }
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $cfg['host'] ?? 'localhost',
            (int)($cfg['port'] ?? 3306),
            $cfg['database'],
            $cfg['charset'] ?? 'latin1'
        );
        $pdo = new PDO($dsn, $cfg['user'], $cfg['password'], [PDO::ATTR_TIMEOUT => 10]);
        $pdo->exec("SET time_zone = '-03:00'");
        return new self($pdo);
    }

    public function driver(): string
    {
        return (string)$this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    }

    /** @return array<int,array<string,mixed>> */
    public function todos(string $sql, array $params = []): array
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($params);
        return $st->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function um(string $sql, array $params = []): ?array
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($params);
        $r = $st->fetch();
        return $r === false ? null : $r;
    }

    public function executar(string $sql, array $params = []): int
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($params);
        return $st->rowCount();
    }

    public function ultimoId(): int
    {
        return (int)$this->pdo->lastInsertId();
    }

    /**
     * As tabelas da baixa são MyISAM (sem transação). LOCK TABLES garante que nenhuma
     * outra conexão grave nelas no meio da baixa.
     *
     * @param array<string,string> $tabelas nome => READ|WRITE
     */
    public function travar(array $tabelas): void
    {
        if ($this->driver() !== 'mysql') {
            return;
        }
        $partes = [];
        foreach ($tabelas as $t => $modo) {
            if (!preg_match('/^\w+$/', $t)) {
                throw new \InvalidArgumentException('Tabela inválida');
            }
            $partes[] = "`$t` " . ($modo === 'READ' ? 'READ' : 'WRITE');
        }
        $this->pdo->exec('LOCK TABLES ' . implode(', ', $partes));
    }

    public function destravar(): void
    {
        if ($this->driver() !== 'mysql') {
            return;
        }
        $this->pdo->exec('UNLOCK TABLES');
    }
}
