<?php
declare(strict_types=1);

namespace Ponte;

/** Erro de regra de negócio com código estável para o agente decidir o que fazer. */
final class ErroPonte extends \RuntimeException
{
    public function __construct(public readonly string $codigo, string $mensagem, public readonly array $detalhes = [], public readonly int $http = 422)
    {
        parent::__construct($mensagem);
    }
}
