#!/usr/bin/env bash
#
# Adversarial QA against a production build: three rounds of scripted attacks
# (authorization matrix, CSRF, fuzzing, business-logic races, account
# lifecycle, money figures, pre-registration takeover...). See qa/*.mjs.
#
# Everything runs against throwaway containers on non-default ports — the
# probes create users, orders and disputes, and enable MFA on the seeded admin.
#
#   ./scripts/qa.sh          build, start, run all rounds, tear down
#   SKIP_BUILD=1 ./scripts/qa.sh   reuse the existing .next build
set -euo pipefail
cd "$(dirname "$0")/.."

PG=agri-qa-postgres; REDIS=agri-qa-redis; MAIL=agri-qa-mailpit; PORT=3990
cleanup() {
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true
  docker rm -f "$PG" "$REDIS" "$MAIL" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

docker run -d --name "$PG" -e POSTGRES_USER=agri -e POSTGRES_PASSWORD=agri -e POSTGRES_DB=agriconnect_qa -p 55442:5432 postgres:16-alpine >/dev/null
docker run -d --name "$REDIS" -p 56389:6379 redis:7-alpine >/dev/null
docker run -d --name "$MAIL" -p 18035:8025 -p 11035:1025 axllent/mailpit >/dev/null
for _ in $(seq 1 90); do docker exec "$PG" psql -U agri -d agriconnect_qa -c 'SELECT 1' >/dev/null 2>&1 && break; sleep 1; done

PGUSER=agri PGPASSWORD=agri
export DATABASE_URL="postgres://${PGUSER}:${PGPASSWORD}@127.0.0.1:55442/agriconnect_qa?sslmode=disable"
export TEST_DATABASE_URL="$DATABASE_URL" DB_PINNED_HOST_IP=""
export REDIS_URL=redis://127.0.0.1:56389 SMTP_URL=smtp://127.0.0.1:11035 SIMULATED_PAYMENTS=true
export APP_URL="http://localhost:$PORT" MFA_ENCRYPTION_KEY="${MFA_ENCRYPTION_KEY:-qa-mfa-encryption-key-not-secret}"
export BASE="http://localhost:$PORT" MAILPIT_URL=http://127.0.0.1:18035

npm run db:migrate --silent && npm run db:seed --silent >/dev/null
[[ "${SKIP_BUILD:-}" == 1 ]] || npm run build --silent >/dev/null
npx next start -p "$PORT" > /tmp/agri-qa-server.log 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done

rm -f qa/.admin-totp
failed=0
for round in round round2 round3; do node "qa/$round.mjs" || failed=$((failed + $?)); done
errors=$(grep -c '⨯' /tmp/agri-qa-server.log || true)
echo "server errors logged: $errors"
[[ $failed -eq 0 && $errors -eq 0 ]] && echo "✔ QA: no findings" || { echo "✖ QA: $failed finding(s), $errors server error(s)"; exit 1; }
