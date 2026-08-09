#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=""
KEEP_RUNNING="false"
SERVE="false"
E2E="false"
STRESS_SCALE="${NOVAE_STRESS_SCALE:-4}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --keep-running)
      KEEP_RUNNING="true"
      shift
      ;;
    --serve)
      SERVE="true"
      shift
      ;;
    --e2e)
      E2E="true"
      SERVE="true"
      shift
      ;;
    --stress-scale)
      STRESS_SCALE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

if ! [[ "$STRESS_SCALE" =~ ^[0-9]+$ ]] || (( STRESS_SCALE < 2 || STRESS_SCALE > 20 )); then
  echo "--stress-scale must be an integer between 2 and 20." >&2
  exit 2
fi

if [[ -n "$ENV_FILE" && ! -f "$ENV_FILE" ]]; then
  echo "The supplied --env-file is not readable." >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "$SERVE" == "true" ]]; then
  PROGRESS_TOTAL=12
  [[ "$E2E" == "true" ]] && PROGRESS_TOTAL=13
else
  PROGRESS_TOTAL=9
fi
PROGRESS_CURRENT=0
PROGRESS_LABEL=""

render_progress() {
  local state="${1:-…}"
  local width=20
  local filled=$((PROGRESS_CURRENT * width / PROGRESS_TOTAL))
  local empty=$((width - filled))
  local bar
  printf -v bar '%*s' "$filled" ''
  bar="${bar// /█}"
  local remainder
  printf -v remainder '%*s' "$empty" ''
  remainder="${remainder// /░}"
  if [[ -t 2 ]]; then
    printf '\r\033[2K[%s%s] %d/%d %s %s' \
      "$bar" "$remainder" "$PROGRESS_CURRENT" "$PROGRESS_TOTAL" "$state" "$PROGRESS_LABEL" >&2
  elif [[ "$state" == "…" ]]; then
    printf '[%d/%d] %s\n' "$PROGRESS_CURRENT" "$PROGRESS_TOTAL" "$PROGRESS_LABEL" >&2
  fi
}

progress_begin() {
  PROGRESS_CURRENT=$((PROGRESS_CURRENT + 1))
  PROGRESS_LABEL="$1"
  render_progress "…"
}

progress_finish() {
  if [[ -t 2 ]]; then
    render_progress "✓"
    printf '\n' >&2
  fi
}

emit_warnings() {
  local log_file="$1"
  local warnings
  warnings="$(grep -Ei '\b(warning|warn|error|deprecated|ignored build scripts)\b' "$log_file" | head -n 40 || true)"
  if [[ -n "$warnings" ]]; then
    [[ -t 2 ]] && printf '\n' >&2
    printf 'Warnings from %s:\n%s\n' "$PROGRESS_LABEL" "$warnings" >&2
  fi
}

fail_with_log() {
  local message="$1"
  local log_file="$2"
  [[ -t 2 ]] && printf '\r\033[2K' >&2
  printf 'Error: %s\n' "$message" >&2
  if [[ -s "$log_file" ]]; then
    tail -n 160 "$log_file" >&2
  fi
  exit 1
}

run_quiet() {
  local label="$1"
  local log_file="$2"
  shift 2
  progress_begin "$label"
  if ! "$@" >"$log_file" 2>&1; then
    fail_with_log "$label failed" "$log_file"
  fi
  emit_warnings "$log_file"
  progress_finish
}

for command_name in docker supabase curl script; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing local integration dependency: $command_name" >&2
    exit 2
  fi
done

DENO_COMMAND="${NOVAE_DENO_BIN:-}"
if [[ -z "$DENO_COMMAND" ]]; then
  DENO_FALLBACK=""
  while IFS= read -r deno_candidate; do
    if [[ "$deno_candidate" == "$ROOT/node_modules/.bin/"* ]]; then
      DENO_FALLBACK="${DENO_FALLBACK:-$deno_candidate}"
      continue
    fi
    DENO_COMMAND="$deno_candidate"
    break
  done < <(type -aP deno || true)
  DENO_COMMAND="${DENO_COMMAND:-${DENO_FALLBACK:-deno}}"
fi
if ! command -v "$DENO_COMMAND" >/dev/null 2>&1; then
  echo "Missing local integration dependency: $DENO_COMMAND" >&2
  exit 2
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running or the current WSL user cannot access it." >&2
  exit 2
fi
if [[ "$SERVE" == "true" ]]; then
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 && command -v npx >/dev/null 2>&1; then
    TEST_NODE=(node)
    TEST_NPX=(npx --yes)
    TEST_ROOT="$ROOT"
  else
    echo "The interactive test environment requires native WSL Node.js 24 with npm and npx." >&2
    exit 2
  fi
  if [[ "$("${TEST_NODE[@]}" -p 'process.versions.node.split(`.`)[0]' | tr -d '\r')" != "24" ]]; then
    echo "The interactive test environment requires Node.js 24 LTS." >&2
    exit 2
  fi
  VITE_NPM=(npm)
  VITE_IS_WINDOWS="false"
  if [[ "$ROOT" == /mnt/* ]] && command -v cmd.exe >/dev/null 2>&1; then
    VITE_NPM=(cmd.exe /d /s /c npm)
    VITE_IS_WINDOWS="true"
  fi
fi

cd "$ROOT"
# config.toml enables Firebase third-party auth for production Realtime. Keep
# local database setup deterministic without depending on developer secrets.
export FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-integration-project}"
TEMP_ENV="$(mktemp)"
FUNCTION_ENV="$(mktemp)"
FUNCTION_LOG="$(mktemp)"
FUNCTION_PID=""
FIREBASE_LOG="$(mktemp)"
FIREBASE_PID=""
FCM_LOG="$(mktemp)"
FCM_PID=""
UPSTASH_LOG="$(mktemp)"
UPSTASH_PID=""
WORKER_LOG="$(mktemp)"
WORKER_PID=""
VITE_PID=""
VITE_WINDOWS_PID=""
COMMAND_LOG_DIR="$(mktemp -d)"

cleanup() {
  if [[ -n "$FUNCTION_PID" ]] && kill -0 "$FUNCTION_PID" >/dev/null 2>&1; then
    kill "$FUNCTION_PID" >/dev/null 2>&1 || true
    wait "$FUNCTION_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$UPSTASH_PID" ]] && kill -0 "$UPSTASH_PID" >/dev/null 2>&1; then
    kill "$UPSTASH_PID" >/dev/null 2>&1 || true
    wait "$UPSTASH_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$WORKER_PID" ]] && kill -0 "$WORKER_PID" >/dev/null 2>&1; then
    kill "$WORKER_PID" >/dev/null 2>&1 || true
    wait "$WORKER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$VITE_PID" ]] && kill -0 "$VITE_PID" >/dev/null 2>&1; then
    kill "$VITE_PID" >/dev/null 2>&1 || true
    wait "$VITE_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$VITE_WINDOWS_PID" ]]; then
    taskkill.exe /PID "$VITE_WINDOWS_PID" /T /F >/dev/null 2>&1 || true
  fi
  if [[ -n "$FIREBASE_PID" ]] && kill -0 "$FIREBASE_PID" >/dev/null 2>&1; then
    kill "$FIREBASE_PID" >/dev/null 2>&1 || true
    wait "$FIREBASE_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$FCM_PID" ]] && kill -0 "$FCM_PID" >/dev/null 2>&1; then
    kill "$FCM_PID" >/dev/null 2>&1 || true
    wait "$FCM_PID" >/dev/null 2>&1 || true
  fi
  rm -f "$TEMP_ENV" "$FUNCTION_ENV" "$FUNCTION_LOG" "$FIREBASE_LOG" "$FCM_LOG" "$UPSTASH_LOG" "$WORKER_LOG"
  rm -rf "$COMMAND_LOG_DIR"
  if [[ "$KEEP_RUNNING" != "true" ]]; then
    supabase stop >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

START_EXCLUDES="edge-runtime,imgproxy,logflare,realtime,studio,vector"
supabase stop >/dev/null 2>&1 || true
run_quiet "start local database" "$COMMAND_LOG_DIR/db-start.log" supabase db start
run_quiet "reset local database" "$COMMAND_LOG_DIR/db-reset.log" supabase db reset --local
progress_begin "start local API services"
supabase stop >"$COMMAND_LOG_DIR/api-stop.log" 2>&1 || true
if ! supabase start --exclude "$START_EXCLUDES" >"$COMMAND_LOG_DIR/api-start.log" 2>&1; then
  fail_with_log "local API services failed to start" "$COMMAND_LOG_DIR/api-start.log"
fi
emit_warnings "$COMMAND_LOG_DIR/api-start.log"
progress_finish

STATUS_ENV="$(supabase status -o env 2>"$COMMAND_LOG_DIR/status.log")"
emit_warnings "$COMMAND_LOG_DIR/status.log"
eval "$(printf '%s\n' "$STATUS_ENV" | grep -E '^(ANON_KEY|API_URL|JWT_SECRET|PUBLISHABLE_KEY|SECRET_KEY|SERVICE_ROLE_KEY)=')"
ANON_KEY="${ANON_KEY:-${PUBLISHABLE_KEY:-}}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-${SECRET_KEY:-}}"
: "${API_URL:?Local Supabase did not report API_URL}"
: "${ANON_KEY:?Local Supabase did not report an anonymous or publishable key}"
: "${SERVICE_ROLE_KEY:?Local Supabase did not report a service-role or secret key}"
: "${JWT_SECRET:?Local Supabase did not report JWT_SECRET}"

progress_begin "wait for REST schema cache"
rest_status=""
for _ in $(seq 1 60); do
  rest_status="$(curl -sS -o /dev/null -w '%{http_code}' \
    "$API_URL/rest/v1/user_profiles?select=uid&limit=1" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "authorization: Bearer $SERVICE_ROLE_KEY" \
    -H 'accept-profile: app_private' 2>/dev/null || true)"
  if [[ "$rest_status" == "200" ]]; then
    break
  fi
  sleep 1
done
if [[ "$rest_status" != "200" ]]; then
  fail_with_log "REST schema cache did not become ready (HTTP $rest_status)" "$COMMAND_LOG_DIR/api-start.log"
fi
progress_finish

run_quiet "lint rebuilt database" "$COMMAND_LOG_DIR/db-lint.log" \
  supabase db lint --local --level error --fail-on error

{
  printf 'ALLOWED_DOMAIN=integration.invalid\n'
  printf 'CLOUDFLARE_WORKER_URL=http://127.0.0.1:1\n'
  printf 'CLOUDINARY_API_KEY=integration-api-key\n'
  printf 'CLOUDINARY_API_SECRET=integration-api-secret\n'
  printf 'CLOUDINARY_CLOUD_NAME=integration-cloud\n'
  printf 'CLOUDINARY_API_BASE_URL=http://127.0.0.1:54330\n'
  printf 'CLOUDINARY_WEBHOOK_SECRET=integration-cloudinary-webhook\n'
  printf 'EDGE_ORIGIN_SECRET=integration-origin-secret\n'
  printf 'EDGE_FUNCTION_DELETE_URL=%s/functions/v1/processDeletionJobs\n' "$API_URL"
  printf 'EDGE_FUNCTION_OUTBOX_URL=%s/functions/v1/outboxWorker\n' "$API_URL"
  printf 'FIREBASE_PROJECT_ID=integration-project\n'
  printf 'FIREBASE_WEB_API_KEY=integration-web-api-key\n'
  printf 'FCM_EMULATOR_URL=http://127.0.0.1:54330\n'
  printf 'ADMIN_EMAILS=admin@integration.invalid\n'
  printf 'WEBHOOK_SECRET=integration-worker-secret\n'
  printf '\nAPP_SUPABASE_SERVICE_ROLE_KEY=%s\n' "$SERVICE_ROLE_KEY"
  printf 'SUPABASE_URL=%s\n' "$API_URL"
  printf 'SUPABASE_ANON_KEY=%s\n' "$ANON_KEY"
  printf 'SUPABASE_JWT_SECRET=%s\n' "$JWT_SECRET"
  printf 'SUPABASE_FUNCTIONS_URL=%s/functions/v1\n' "$API_URL"
  printf 'GOOGLE_SERVICE_ACCOUNT_JSON=not-json\n'
  printf 'UPSTASH_REDIS_REST_URL=http://127.0.0.1:54329\n'
  printf 'UPSTASH_REDIS_REST_TOKEN=integration-upstash-token\n'
  printf 'NOVAE_STRESS_SCALE=%s\n' "$STRESS_SCALE"
} >"$TEMP_ENV"

if [[ "$SERVE" == "true" ]]; then
  printf 'LOCAL_TEST_MODE=true\n' >>"$TEMP_ENV"
  printf 'FIREBASE_AUTH_EMULATOR_HOST=host.docker.internal:9099\n' >>"$TEMP_ENV"
  sed -i 's#CLOUDFLARE_WORKER_URL=http://127.0.0.1:1#CLOUDFLARE_WORKER_URL=http://127.0.0.1:8787#' "$TEMP_ENV"
fi
chmod 600 "$TEMP_ENV"
grep -v '^SUPABASE_' "$TEMP_ENV" >"$FUNCTION_ENV"
sed -i 's#UPSTASH_REDIS_REST_URL=http://127.0.0.1:54329#UPSTASH_REDIS_REST_URL=http://host.docker.internal:54329#' "$FUNCTION_ENV"
sed -i 's#FCM_EMULATOR_URL=http://127.0.0.1:54330#FCM_EMULATOR_URL=http://host.docker.internal:54330#' "$FUNCTION_ENV"
sed -i 's#CLOUDINARY_API_BASE_URL=http://127.0.0.1:54330#CLOUDINARY_API_BASE_URL=http://host.docker.internal:54330#' "$FUNCTION_ENV"
sed -i 's#EDGE_FUNCTION_DELETE_URL=http://127.0.0.1:54321#EDGE_FUNCTION_DELETE_URL=http://host.docker.internal:54321#' "$FUNCTION_ENV"
sed -i 's#EDGE_FUNCTION_OUTBOX_URL=http://127.0.0.1:54321#EDGE_FUNCTION_OUTBOX_URL=http://host.docker.internal:54321#' "$FUNCTION_ENV"
chmod 600 "$FUNCTION_ENV"
ORIGIN_SECRET="$(grep '^EDGE_ORIGIN_SECRET=' "$TEMP_ENV" | head -n 1 | cut -d= -f2-)"

if [[ "$SERVE" == "true" ]]; then
  progress_begin "start Firebase Auth emulator"
  "${TEST_NPX[@]}" firebase-tools@15.24.0 emulators:start --only auth --project integration-project >"$FIREBASE_LOG" 2>&1 &
  FIREBASE_PID="$!"
  firebase_status=""
  for _ in $(seq 1 60); do
    firebase_status="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9099/ || true)"
    [[ "$firebase_status" != "000" ]] && break
    if ! kill -0 "$FIREBASE_PID" >/dev/null 2>&1; then
      fail_with_log "Firebase Auth emulator stopped before becoming ready" "$FIREBASE_LOG"
    fi
    sleep 1
  done
  if [[ "$firebase_status" == "000" ]]; then
    fail_with_log "Firebase Auth emulator did not become ready" "$FIREBASE_LOG"
  fi
  emit_warnings "$FIREBASE_LOG"
  progress_finish
fi

progress_begin "start isolated Upstash test server"
"$DENO_COMMAND" run --allow-env --allow-net scripts/upstash-test-server.ts >"$UPSTASH_LOG" 2>&1 &
UPSTASH_PID="$!"
for _ in $(seq 1 30); do
  status="$(curl -sS -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:54329 \
    -d '["GET","ready"]' 2>/dev/null || true)"
  [[ "$status" == "200" ]] && break
  sleep 1
done
if [[ "${status:-}" != "200" ]]; then
  fail_with_log "isolated Upstash test server did not become ready" "$UPSTASH_LOG"
fi
emit_warnings "$UPSTASH_LOG"
progress_finish

progress_begin "start isolated external-provider receiver"
"$DENO_COMMAND" run --allow-env --allow-net scripts/external-provider-test-server.ts >"$FCM_LOG" 2>&1 &
FCM_PID="$!"
fcm_status=""
for _ in $(seq 1 30); do
  fcm_status="$(curl -sS -o /dev/null -w '%{http_code}' \
    http://127.0.0.1:54330/__requests 2>/dev/null || true)"
  [[ "$fcm_status" == "200" ]] && break
  sleep 1
done
if [[ "$fcm_status" != "200" ]]; then
  fail_with_log "isolated external-provider receiver did not become ready" "$FCM_LOG"
fi
emit_warnings "$FCM_LOG"
progress_finish

progress_begin "serve Edge Functions"
# Supabase CLI currently fails with ENODATA when Windows launches WSL without a
# terminal. `script` gives the long-lived function server its own pseudo-TTY in
# both interactive and automated runs.
printf -v FUNCTION_SERVE_COMMAND 'exec supabase functions serve --env-file %q --no-verify-jwt' "$FUNCTION_ENV"
script --quiet --return --command "$FUNCTION_SERVE_COMMAND" /dev/null >"$FUNCTION_LOG" 2>&1 &
FUNCTION_PID="$!"
for _ in $(seq 1 60); do
  status="$(curl -sS -o /dev/null -w '%{http_code}' \
    -X OPTIONS "$API_URL/functions/v1/backendAction" \
    -H "x-novae-origin-secret: $ORIGIN_SECRET" 2>/dev/null || true)"
  if [[ "$status" == "200" ]]; then
    break
  fi
  if ! kill -0 "$FUNCTION_PID" >/dev/null 2>&1; then
    fail_with_log "Edge Functions stopped before becoming ready" "$FUNCTION_LOG"
  fi
  sleep 1
done
if [[ "${status:-}" != "200" ]]; then
  fail_with_log "Edge Functions did not become ready" "$FUNCTION_LOG"
fi
if grep -Eq 'Node\.js 20 and below are deprecated|integrationReadinessProbe' "$FUNCTION_LOG"; then
  fail_with_log "Edge Functions emitted a deprecated-runtime or synthetic readiness error" "$FUNCTION_LOG"
fi
emit_warnings "$FUNCTION_LOG"
progress_finish

DENO_DEPENDENCY_AGE_ARGS=()
if "$DENO_COMMAND" test --help | grep -q -- '--minimum-dependency-age'; then
  DENO_DEPENDENCY_AGE_ARGS+=(--minimum-dependency-age=0)
fi
if [[ "$SERVE" != "true" ]]; then
  progress_begin "backend actions, permissions, RLS, and workers"
  if ! "$DENO_COMMAND" test \
    --node-modules-dir=none \
    --no-lock \
    "${DENO_DEPENDENCY_AGE_ARGS[@]}" \
    --env-file="$TEMP_ENV" \
    --allow-env \
    --allow-net \
    --allow-read \
    --fail-fast \
    tests/integration >"$COMMAND_LOG_DIR/integration-tests.log" 2>&1; then
    printf '\nEdge Function errors:\n' >&2
    tail -n 160 "$FUNCTION_LOG" >&2
    fail_with_log "integration tests failed" "$COMMAND_LOG_DIR/integration-tests.log"
  fi
  emit_warnings "$COMMAND_LOG_DIR/integration-tests.log"
  progress_finish
fi

if [[ "$SERVE" != "true" ]]; then
  printf '✓ Local integration verification passed (%d stages)\n' "$PROGRESS_TOTAL" >&2
  exit 0
fi

progress_begin "start local Cloudflare gateway"
"${TEST_NPX[@]}" wrangler@4.120.0 dev --config "$TEST_ROOT/cloudflare/wrangler.toml" --env development --local --port 8787 \
  --var "ALLOWED_ORIGINS:http://localhost:5173,http://127.0.0.1:5173" \
  --var "CLOUDINARY_API_SECRET:integration-cloudinary-secret" \
  --var "CLOUDINARY_CLOUD_NAME:integration" \
  --var "CLOUDINARY_DELIVERY_BASE_URL:http://127.0.0.1:54330" \
  --var "CLOUDINARY_WEBHOOK_SECRET:integration-cloudinary-webhook" \
  --var "EDGE_FUNCTION_NAMESPACE:local" \
  --var "EDGE_ORIGIN_SECRET:$ORIGIN_SECRET" \
  --var "FIREBASE_PROJECT_ID:integration-project" \
  --var "LOCAL_TEST_MODE:true" \
  --var "SUPABASE_FUNCTIONS_BASE_URL:$API_URL/functions/v1" >"$WORKER_LOG" 2>&1 &
WORKER_PID="$!"
worker_status=""
for _ in $(seq 1 60); do
  worker_status="$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS http://127.0.0.1:8787/v1/actions -H 'origin: http://localhost:5173' || true)"
  [[ "$worker_status" == "204" ]] && break
  if ! kill -0 "$WORKER_PID" >/dev/null 2>&1; then
    fail_with_log "Cloudflare gateway stopped before becoming ready" "$WORKER_LOG"
  fi
  sleep 1
done
if [[ "$worker_status" != "204" ]]; then
  fail_with_log "Cloudflare gateway did not become ready" "$WORKER_LOG"
fi
emit_warnings "$WORKER_LOG"
progress_finish

progress_begin "start Vite"
export VITE_ALLOWED_DOMAIN=integration.invalid
export VITE_API_BASE_URL=http://127.0.0.1:8787
export VITE_FIREBASE_API_KEY=integration-web-api-key
export VITE_FIREBASE_APP_ID=1:123456789:web:local
export VITE_FIREBASE_AUTH_DOMAIN=integration-project.firebaseapp.com
export VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
export VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
export VITE_FIREBASE_PROJECT_ID=integration-project
export VITE_FIREBASE_APP_CHECK_ENABLED=false
export VITE_SUPABASE_URL="$API_URL"
export VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
export WSLENV="${WSLENV:-}:VITE_ALLOWED_DOMAIN/w:VITE_API_BASE_URL/w:VITE_FIREBASE_API_KEY/w:VITE_FIREBASE_APP_ID/w:VITE_FIREBASE_AUTH_DOMAIN/w:VITE_FIREBASE_AUTH_EMULATOR_URL/w:VITE_FIREBASE_MESSAGING_SENDER_ID/w:VITE_FIREBASE_PROJECT_ID/w:VITE_FIREBASE_APP_CHECK_ENABLED/w:VITE_SUPABASE_URL/w:VITE_SUPABASE_PUBLISHABLE_KEY/w"
"${VITE_NPM[@]}" run dev -- --host 0.0.0.0 --port 5173 --strictPort >"$COMMAND_LOG_DIR/vite.log" 2>&1 &
VITE_PID="$!"

for _ in $(seq 1 60); do
  if [[ "$VITE_IS_WINDOWS" == "true" ]]; then
    VITE_WINDOWS_PID="$(netstat.exe -ano | tr -d '\r' | awk '$2 ~ /:5173$/ && $4 == "LISTENING" { print $5; exit }')"
    [[ "$VITE_WINDOWS_PID" =~ ^[0-9]+$ ]] && break
  else
    vite_status="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/ || true)"
    [[ "$vite_status" == "200" ]] && break
  fi
  if ! kill -0 "$VITE_PID" >/dev/null 2>&1; then
    wait "$VITE_PID" || true
    fail_with_log "Vite stopped before becoming ready" "$COMMAND_LOG_DIR/vite.log"
  fi
  sleep 1
done
if [[ "$VITE_IS_WINDOWS" == "true" ]]; then
  if ! [[ "$VITE_WINDOWS_PID" =~ ^[0-9]+$ ]]; then
    fail_with_log "could not resolve the Windows Vite process" "$COMMAND_LOG_DIR/vite.log"
  fi
elif [[ "$vite_status" != "200" ]]; then
  fail_with_log "Vite did not become ready on port 5173" "$COMMAND_LOG_DIR/vite.log"
fi
progress_finish

run_quiet "verify local authentication" "$COMMAND_LOG_DIR/auth-probe.log" \
  "${TEST_NODE[@]}" scripts/check-local-auth-emulator.mjs

{
  echo ""
  echo "[environment] Ready"
  echo "  App:           http://localhost:5173"
  echo "  Auth emulator: http://localhost:4000/auth"
  echo "  API gateway:   http://localhost:8787"
  echo "  Admin login:   use Google sign-in, enter admin@integration.invalid in the emulator"
  echo "  New users:     sign out and use Google sign-in with any *@integration.invalid address"
  echo "  Stop:          press Ctrl+C"
} >&2
if [[ "$E2E" == "true" ]]; then
  run_quiet "Playwright browser journeys" "$COMMAND_LOG_DIR/e2e.log" \
    "${VITE_NPM[@]}" run --silent test:e2e:runner
  printf '✓ End-to-end verification passed (%d stages)\n' "$PROGRESS_TOTAL" >&2
  exit 0
fi
if ! wait "$VITE_PID"; then
  fail_with_log "Vite stopped unexpectedly" "$COMMAND_LOG_DIR/vite.log"
fi
