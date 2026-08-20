#!/usr/bin/env bash
#
# Runs the same gate as .github/workflows/ci.yml, on this machine.
#
# Not a replacement for CI — it cannot prove the build works on a clean
# checkout with a clean dependency tree the way a fresh runner does. It exists
# so there is still a single command that either passes or fails before a push,
# and so that gate does not disappear when GitHub Actions is unavailable.
#
# Postgres and Redis come from ephemeral containers, as in CI, rather than the
# Neon dev database — the tests write and delete rows, and must never do that
# to a database anyone is using.
#
#   ./scripts/ci-local.sh            full run
#   ./scripts/ci-local.sh --no-db    skip container setup, use the current env
set -euo pipefail

cd "$(dirname "$0")/.."

USE_CONTAINERS=1
[[ "${1:-}" == "--no-db" ]] && USE_CONTAINERS=0

PG_NAME=agri-ci-postgres
REDIS_NAME=agri-ci-redis
PG_PORT=55432
REDIS_PORT=56379

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✖ %s failed\033[0m\n' "$1"; exit 1; }

cleanup() {
  if [[ $USE_CONTAINERS -eq 1 ]]; then
    docker rm -f "$PG_NAME" "$REDIS_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ $USE_CONTAINERS -eq 1 ]]; then
  step "Starting ephemeral Postgres and Redis"
  command -v docker >/dev/null || {
    echo "docker not found. Re-run with --no-db and set DATABASE_URL yourself."
    exit 1
  }
  cleanup
  docker run -d --name "$PG_NAME" \
    -e POSTGRES_USER=agri -e POSTGRES_PASSWORD=agri -e POSTGRES_DB=agriconnect_test \
    -p "$PG_PORT":5432 postgres:16-alpine >/dev/null
  docker run -d --name "$REDIS_NAME" -p "$REDIS_PORT":6379 redis:7-alpine >/dev/null

  # Composed from parts for the same reason CI does it: a literal credentialed
  # URL in a tracked file is exactly what the secrets scan below rejects.
  PGUSER=agri PGPASSWORD=agri
  export DATABASE_URL="postgres://${PGUSER}:${PGPASSWORD}@127.0.0.1:${PG_PORT}/agriconnect_test?sslmode=disable"
  export REDIS_URL="redis://127.0.0.1:${REDIS_PORT}"
  export TEST_REDIS_URL="$REDIS_URL"

  # .env.local is still loaded by the db: scripts, and an exported value beats
  # anything in that file. DB_PINNED_HOST_IP is the one that matters: it pins
  # connections to a Neon address, which would send these queries to the shared
  # dev database's IP on a local container port and simply hang. Blanking it is
  # what makes the run actually local.
  export DB_PINNED_HOST_IP=""

  # pg_isready reports ready partway through first-boot initialisation, before
  # the server restarts to apply it — so a migration fired on that signal can
  # hit a closing connection. Wait on a real query instead.
  printf '  waiting for postgres'
  ready=0
  for _ in $(seq 1 90); do
    if docker exec "$PG_NAME" psql -U agri -d agriconnect_test -c 'SELECT 1' \
         >/dev/null 2>&1; then
      ready=1; break
    fi
    printf '.'; sleep 1
  done
  [[ $ready -eq 1 ]] || { echo; echo "postgres never became reachable"; exit 1; }
  echo ' ready'
fi

step "Applying migrations";  npm run db:migrate --silent || fail "migrations"
step "Seeding fixtures";     npm run db:seed --silent    || fail "seed"
step "Typecheck";            npm run typecheck           || fail "typecheck"
step "Lint";                 npm run lint                || fail "lint"
step "Test";                 npm run test                || fail "tests"
step "Build";                npm run build               || fail "build"

step "Scanning tracked files for credentials"
# Mirrors the secrets job in ci.yml. Kept in sync by hand; if that job changes,
# change this too.
if git ls-files -z | xargs -0 grep -lE 'npg_[A-Za-z0-9]{16,}' 2>/dev/null | grep .; then
  echo "A Neon credential appears in a tracked file."
  fail "secret scan"
fi
if git ls-files -z \
     | xargs -0 grep -lE 'postgres(ql)?://[^:/@[:space:]$'"'"'{}]+:[^@[:space:]$'"'"'{}]+@' 2>/dev/null \
     | grep -vxF -e '.env.example' -e 'lib/describe-error.ts' -e 'tests/describe-error.test.ts' \
     | grep .; then
  echo "A postgres URL with a literal password appears in the files above."
  fail "secret scan"
fi

printf '\n\033[32m✔ all checks passed\033[0m\n'
