#!/bin/bash
# 啟動 Cloudflare tunnel 並自動更新 LINE Webhook / LIFF URL
# 使用方式：./scripts/update-tunnel.sh
# 執行前請確認 .env 已填入 LINE_CHANNEL_ACCESS_TOKEN 與 LIFF_ID_* 變數

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# 讀取根目錄 .env
if [ ! -f .env ]; then
  echo "❌ 找不到 .env，請先複製 .env.example 並填入設定"
  exit 1
fi
set -a; source .env; set +a

# 顏色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

API_PORT=3201
LIFF_PORT=3202

# ── 等待 tunnel URL 出現 ──────────────────────────────────────────
wait_for_url() {
  local logfile=$1
  local label=$2
  local url=""
  printf "等待 %-4s tunnel URL" "$label"
  for i in $(seq 1 30); do
    url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$logfile" 2>/dev/null | head -1)
    if [ -n "$url" ]; then
      echo ""
      echo "$url"
      return 0
    fi
    printf "."
    sleep 1
  done
  echo ""
  return 1
}

# ── 更新單一 LIFF 端點 ──────────────────────────────────────────
update_liff_url() {
  local liff_id=$1
  local full_url=$2
  local resp

  resp=$(curl -s -o /tmp/liff_resp.json -w "%{http_code}" \
    -X PUT "https://api.line.me/liff/v1/apps/$liff_id" \
    -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"view\": {\"url\": \"$full_url\"}}")

  if [ "$resp" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} $liff_id → $full_url"
  else
    echo -e "  ${RED}✗${NC} $liff_id 失敗（HTTP $resp）: $(cat /tmp/liff_resp.json)"
  fi
}

# ── 主流程 ───────────────────────────────────────────────────────
echo -e "${YELLOW}▶ Cloudflare tunnel 啟動中...${NC}"

API_LOG=$(mktemp)
LIFF_LOG=$(mktemp)
cleanup() { kill "$API_PID" "$LIFF_PID" 2>/dev/null; rm -f "$API_LOG" "$LIFF_LOG" /tmp/liff_resp.json; }
trap cleanup EXIT

cloudflared tunnel --url "http://localhost:$API_PORT" > "$API_LOG" 2>&1 &
API_PID=$!

cloudflared tunnel --url "http://localhost:$LIFF_PORT" > "$LIFF_LOG" 2>&1 &
LIFF_PID=$!

API_URL=$(wait_for_url "$API_LOG" "API") || { echo -e "${RED}❌ API tunnel 啟動失敗${NC}"; exit 1; }
LIFF_URL=$(wait_for_url "$LIFF_LOG" "LIFF") || { echo -e "${RED}❌ LIFF tunnel 啟動失敗${NC}"; exit 1; }

echo ""
echo -e "${GREEN}API  URL: $API_URL${NC}"
echo -e "${GREEN}LIFF URL: $LIFF_URL${NC}"
echo ""

# ── 更新本地 .env 檔案 ──────────────────────────────────────────
echo "▶ 更新本地 .env..."

# 根目錄 .env：VITE_API_URL（docker build 用）
sed -i "s|VITE_API_URL=.*|VITE_API_URL=$API_URL|" .env

# apps/liff/.env：VITE_API_URL（開發時 Vite 使用）
if [ -f apps/liff/.env ]; then
  sed -i "s|VITE_API_URL=.*|VITE_API_URL=$API_URL/api|" apps/liff/.env
fi

echo -e "  ${GREEN}✓${NC} .env 已更新"
echo ""

# ── 更新 LINE Webhook ───────────────────────────────────────────
if [ -z "$LINE_CHANNEL_ACCESS_TOKEN" ]; then
  echo -e "${YELLOW}⚠ LINE_CHANNEL_ACCESS_TOKEN 未設定，略過 LINE 更新${NC}"
else
  echo "▶ 更新 LINE Webhook..."
  WEBHOOK_RESP=$(curl -s -o /tmp/webhook_resp.json -w "%{http_code}" \
    -X PUT "https://api.line.me/v2/bot/channel/webhook/endpoint" \
    -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"webhookEndpointUrl\": \"$API_URL/webhook\"}")

  if [ "$WEBHOOK_RESP" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} Webhook → $API_URL/webhook"
  else
    echo -e "  ${RED}✗${NC} Webhook 更新失敗（HTTP $WEBHOOK_RESP）: $(cat /tmp/webhook_resp.json)"
  fi
  echo ""

  # ── 更新 LIFF URL（各指向對應路徑）──────────────────────────────
  echo "▶ 更新 LIFF URL..."
  [ -n "$LIFF_ID_ADMISSION" ]   && update_liff_url "$LIFF_ID_ADMISSION"   "$LIFF_URL/liff/admission"
  [ -n "$LIFF_ID_APPOINTMENT" ] && update_liff_url "$LIFF_ID_APPOINTMENT" "$LIFF_URL/liff/appointment"
  [ -n "$LIFF_ID_VISIT" ]       && update_liff_url "$LIFF_ID_VISIT"       "$LIFF_URL/liff/visit"
  [ -n "$LIFF_ID_CONTRACT" ]    && update_liff_url "$LIFF_ID_CONTRACT"    "$LIFF_URL/liff/contract"

  LIFF_SET=0
  [ -n "$LIFF_ID_ADMISSION" ]   && LIFF_SET=1
  [ -n "$LIFF_ID_APPOINTMENT" ] && LIFF_SET=1
  [ -n "$LIFF_ID_VISIT" ]       && LIFF_SET=1
  [ -n "$LIFF_ID_CONTRACT" ]    && LIFF_SET=1
  [ "$LIFF_SET" = "0" ] && echo -e "  ${YELLOW}⚠ LIFF_ID_* 未設定，略過 LIFF 更新${NC}"
  echo ""
fi

# ── 手動項目提示 ─────────────────────────────────────────────────
echo "─────────────────────────────────────────"
echo -e "${YELLOW}▶ 需手動更新（TWCA）：${NC}"
echo "  KYC redirect_uri → $LIFF_URL/contract"
echo "─────────────────────────────────────────"
echo ""
echo -e "${GREEN}✅ 完成！Tunnel 運行中，按 Ctrl+C 結束${NC}"
echo ""

# 保持 tunnel 存活
wait "$API_PID"
