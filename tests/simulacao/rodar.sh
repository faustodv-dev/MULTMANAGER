#!/usr/bin/env bash
# Simula conversas completas: agente + comprovantes + ponte PHP real (SQLite).
# Gemini, gateway e Asaas são simulados; o Supabase é um falso em memória.
# Uso: bash tests/simulacao/rodar.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
W="$(mktemp -d)"
mkdir -p "$W/node_modules/@supabase/supabase-js" "$W/ponte"
cp -r "$RAIZ/api" "$W/"
cp -r "$RAIZ/ponte/index.php" "$RAIZ/ponte/lib" "$W/ponte/"
cp "$RAIZ/tests/simulacao/simulacao.mjs" "$W/sim.mjs"
cp "$RAIZ/tests/simulacao/supabase-falso.js" "$W/node_modules/@supabase/supabase-js/index.js"
echo '{"name":"@supabase/supabase-js","type":"module","main":"index.js"}' > "$W/node_modules/@supabase/supabase-js/package.json"
echo '{"type":"module"}' > "$W/package.json"
php -r '$p=new PDO("sqlite:'"$W"'/rv.db"); $p->exec(file_get_contents("'"$RAIZ"'/ponte/tests/schema_sqlite.sql")); $p->exec(file_get_contents("'"$RAIZ"'/ponte/tests/dados_teste.sql"));'
(cd "$W/ponte" && php -d opcache.enable_cli=0 -S 127.0.0.1:8098 >/dev/null 2>&1) &
PHP_PID=$!
trap 'kill $PHP_PID 2>/dev/null; rm -rf "$W"' EXIT
sleep 1
(cd "$W" && node sim.mjs)
