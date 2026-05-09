#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

API_LOG=/tmp/api-tunnel.log
LIFF_LOG=/tmp/liff-tunnel.log

cleanup() {
  kill "$API_PID" "$LIFF_PID" 2>/dev/null
  wait "$API_PID" "$LIFF_PID" 2>/dev/null
}
trap cleanup EXIT SIGTERM SIGINT

echo -e "${YELLOW}▶ Starting Cloudflare tunnels...${NC}"

cloudflared tunnel --url "http://api:3201" > "$API_LOG" 2>&1 &
API_PID=$!

cloudflared tunnel --url "http://liff:80" > "$LIFF_LOG" 2>&1 &
LIFF_PID=$!

# ── 等待 tunnel URL 出現（progress → stderr，URL → stdout）──────────
wait_for_url() {
  local logfile=$1 label=$2 url=""
  printf "Waiting for %s tunnel URL" "$label" >&2
  for i in $(seq 1 60); do
    url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$logfile" 2>/dev/null | head -1)
    if [ -n "$url" ]; then
      printf "\n" >&2
      echo "$url"
      return 0
    fi
    printf "." >&2
    sleep 1
  done
  printf "\n" >&2
  return 1
}

API_URL=$(wait_for_url "$API_LOG" "API")
if [ $? -ne 0 ] || [ -z "$API_URL" ]; then
  echo -e "${RED}❌ API tunnel failed to start${NC}"
  cat "$API_LOG"
  echo -e "${YELLOW}⚠ Waiting 90s before exit to avoid rapid restart loop...${NC}"
  sleep 90
  exit 1
fi

LIFF_URL=$(wait_for_url "$LIFF_LOG" "LIFF")
if [ $? -ne 0 ] || [ -z "$LIFF_URL" ]; then
  echo -e "${RED}❌ LIFF tunnel failed to start${NC}"
  cat "$LIFF_LOG"
  echo -e "${YELLOW}⚠ Waiting 90s before exit to avoid rapid restart loop...${NC}"
  sleep 90
  exit 1
fi

echo ""
echo -e "${GREEN}API  URL: $API_URL${NC}"
echo -e "${GREEN}LIFF URL: $LIFF_URL${NC}"
echo ""

# ── 等待 tunnel 真正可轉發請求（非 530/空）───────────────────────────
printf "Waiting for tunnel to be ready" >&2
for i in $(seq 1 30); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$API_URL" 2>/dev/null) || HTTP_CODE="000"
  if [ -n "$HTTP_CODE" ] && [ "$HTTP_CODE" != "530" ] && [ "$HTTP_CODE" != "000" ]; then
    printf "\n" >&2
    break
  fi
  printf "." >&2
  sleep 2
done
printf "\n" >&2

# ── 更新 LINE Webhook ────────────────────────────────────────────
update_liff_url() {
  local id=$1 url=$2 token=$3 body resp
  [ -z "$id" ] && return
  body=$(printf '{"view":{"url":"%s"}}' "$url")
  resp=$(curl -s -o /tmp/liff_resp.json -w "%{http_code}" \
    -X PUT "https://api.line.me/liff/v1/apps/$id" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$body")
  [ "$resp" = "200" ] \
    && echo -e "  ${GREEN}✓${NC} $id → $url" \
    || echo -e "  ${RED}✗${NC} $id failed (HTTP $resp): $(cat /tmp/liff_resp.json)"
}

if [ -z "$LINE_CHANNEL_ACCESS_TOKEN" ]; then
  echo -e "${YELLOW}⚠ LINE_CHANNEL_ACCESS_TOKEN not set, skipping LINE updates${NC}"
else
  echo "▶ Updating LINE Webhook..."
  WEBHOOK_BODY=$(printf '{"endpoint":"%s/webhook"}' "$API_URL")
  RESP=$(curl -s -o /tmp/webhook_resp.json -w "%{http_code}" \
    -X PUT "https://api.line.me/v2/bot/channel/webhook/endpoint" \
    -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$WEBHOOK_BODY") || RESP="000"

  [ "$RESP" = "200" ] \
    && echo -e "  ${GREEN}✓${NC} Webhook → $API_URL/webhook" \
    || echo -e "  ${RED}✗${NC} Webhook update failed (HTTP $RESP): $(cat /tmp/webhook_resp.json 2>/dev/null)"
  echo ""

  if [ -z "$LIFF_CHANNEL_ID" ] || [ -z "$LIFF_CHANNEL_SECRET" ]; then
    echo -e "${YELLOW}⚠ LIFF_CHANNEL_ID/LIFF_CHANNEL_SECRET not set, skipping LIFF update${NC}"
  else
    echo "▶ Updating LIFF URLs..."
    LIFF_TOKEN=$(curl -s -X POST "https://api.line.me/oauth2/v3/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=client_credentials&client_id=$LIFF_CHANNEL_ID&client_secret=$LIFF_CHANNEL_SECRET" \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null) || LIFF_TOKEN=""

    if [ -z "$LIFF_TOKEN" ]; then
      echo -e "  ${RED}✗ Could not get LIFF channel token${NC}"
    else
      update_liff_url "$LIFF_ID_ADMISSION"   "$LIFF_URL/liff/admission"   "$LIFF_TOKEN"
      update_liff_url "$LIFF_ID_APPOINTMENT" "$LIFF_URL/liff/appointment" "$LIFF_TOKEN"
      update_liff_url "$LIFF_ID_VISIT"       "$LIFF_URL/liff/visit"       "$LIFF_TOKEN"
      update_liff_url "$LIFF_ID_CONTRACT"    "$LIFF_URL/liff/contract"    "$LIFF_TOKEN"
    fi
    echo ""
  fi
fi

echo -e "${GREEN}✅ Tunnels running. Waiting for shutdown signal...${NC}"
wait "$API_PID"
