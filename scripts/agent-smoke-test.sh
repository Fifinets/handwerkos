#!/usr/bin/env bash
# End-to-End Smoke Test for the HandwerkOS Agent-Engine (Phase 1).
#
# Tests two paths:
#   1. Heartbeat path (requires SERVICE_ROLE_KEY) — bypasses LLM, dispatches directly
#   2. User path (requires a user JWT) — full Anthropic intent classification + tool use
#
# After the test, the script prints SQL queries you should run to verify the result.
#
# Required env vars:
#   SUPABASE_URL            e.g. https://qgwhkjrhndeoskrxewpb.supabase.co
#   SUPABASE_SERVICE_ROLE  the service-role JWT (from Supabase dashboard)
#   SMOKE_USER_JWT          JWT of any logged-in user whose profile.company_id is set
#   SMOKE_COMPANY_ID        UUID of the test company (must match the user's profile)
#
# Usage:
#   export SUPABASE_URL=https://qgwhkjrhndeoskrxewpb.supabase.co
#   export SUPABASE_SERVICE_ROLE=eyJ...   # from dashboard > Settings > API
#   export SMOKE_USER_JWT=eyJ...          # log in to your app, copy from devtools
#   export SMOKE_COMPANY_ID=00000000-...
#   bash scripts/agent-smoke-test.sh

set -euo pipefail

REQUIRED=(SUPABASE_URL SUPABASE_SERVICE_ROLE SMOKE_USER_JWT SMOKE_COMPANY_ID)
for var in "${REQUIRED[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: env var $var is not set"
    echo "See header of this script for required vars."
    exit 1
  fi
done

ROUTER="$SUPABASE_URL/functions/v1/agent-router"

echo
echo "=== 1. Heartbeat Path (service-role) ==="
echo "POST $ROUTER  trigger=heartbeat agent=offers action=noop"
HB_BODY=$(cat <<EOF
{"trigger":"heartbeat","agent":"offers","action":"noop","companyId":"$SMOKE_COMPANY_ID","payload":{"reason":"smoke-test"}}
EOF
)
HB_RESPONSE=$(curl -sS -X POST "$ROUTER" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d "$HB_BODY")
echo "Response: $HB_RESPONSE"
HB_TASK_ID=$(echo "$HB_RESPONSE" | grep -oE '"taskId":"[^"]+"' | cut -d'"' -f4 || true)

if [[ -z "$HB_TASK_ID" ]]; then
  echo "FAIL: heartbeat path did not return a taskId"
  exit 1
fi
echo "OK: heartbeat task created: $HB_TASK_ID"

echo
echo "=== 2. User Path (Anthropic classification + tool use) ==="
echo "POST $ROUTER  message='Erstelle Angebot fuer Mueller, Zaehlertausch + 3 Steckdosen'"
USER_BODY='{"message":"Erstelle Angebot für Müller, Zählertausch + 3 Steckdosen"}'
USER_RESPONSE=$(curl -sS -X POST "$ROUTER" \
  -H "Authorization: Bearer $SMOKE_USER_JWT" \
  -H "Content-Type: application/json" \
  -d "$USER_BODY")
echo "Response: $USER_RESPONSE"
USER_TASK_ID=$(echo "$USER_RESPONSE" | grep -oE '"taskId":"[^"]+"' | cut -d'"' -f4 || true)

if [[ -z "$USER_TASK_ID" ]]; then
  echo "FAIL: user path did not return a taskId"
  exit 1
fi
echo "OK: user task created: $USER_TASK_ID"
echo "Task is dispatched async — agent-offers may take 10-30s to complete."

echo
echo "=== Verify with SQL ==="
echo "Run these queries in Supabase SQL editor or via psql:"
echo
echo "-- Heartbeat task (should exist, status='running' or 'awaiting_approval' or 'failed')"
echo "SELECT id, status, agent_type, trigger_type, jsonb_array_length(tool_calls) AS tool_count, error"
echo "FROM agent_tasks WHERE id = '$HB_TASK_ID';"
echo
echo "-- User task (after ~30s should be 'awaiting_approval')"
echo "SELECT at.id, at.status, at.agent_type, at.intent,"
echo "       jsonb_array_length(at.tool_calls) AS tool_count,"
echo "       at.output->>'agentMessage' AS message, at.error"
echo "FROM agent_tasks at WHERE at.id = '$USER_TASK_ID';"
echo
echo "-- Created offer (should be a draft with created_by_agent=true)"
echo "SELECT o.id, o.offer_number, o.status, o.customer_name, o.project_name,"
echo "       o.created_by_agent, o.snapshot_net_total,"
echo "       (SELECT count(*) FROM offer_items WHERE offer_id = o.id) AS item_count"
echo "FROM offers o WHERE o.agent_task_id = '$USER_TASK_ID';"
echo
echo "Done."
