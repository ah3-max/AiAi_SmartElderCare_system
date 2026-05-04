# Line API 串接進度備忘

> 最後更新:2026-04-21
> 用途:短期記憶,下次進 Line 開發時讀這份直接接續

---

## 現況總覽

正處於**階段一(後端 Webhook 串接)** 的開頭,LIFF 與 TWCA 都還沒開始。

```
階段一 ← 現在在這
  ✅ API 程式碼就緒(apps/api,webhook 路徑 /api/webhook/line)
  ✅ API 本機跑在 localhost:3200(非 CLAUDE.md 寫的 3000,注意)
  ✅ Cloudflare Tunnel 已連通(暫時網址,見下)
  ⬜ Channel secret reissue(已外流需重發)
  ⬜ Channel access token 取得
  ⬜ .env 填入兩個值
  ⬜ Line 後台填 Webhook URL + Verify
  ⬜ 加機器人好友、發訊息、取得本人 LineUserID

階段二(LIFF)
  ⬜ 部署 apps/liff/dist 到外網
  ⬜ 在 Line Developers Console 建立 4 個 LIFF App
  ⬜ 拿到 4 組 LIFF_ID 寫進 .env

階段三
  ⬜ Rich Menu 圖文選單
  ⬜ TWCA KYC / 數位簽章整合
```

---

## 關鍵資訊

### 1. Cloudflare Tunnel(免費臨時網址)

- 程序:`cloudflared tunnel --url http://localhost:3200`
- PID:3053514(啟動至 2026-04-21 已跑 9 天)
- cwd:`/home/openclaw-0/program/AiAi_SmartElderCare_system/apps/api`
- metrics 端點:`http://127.0.0.1:20241/metrics`
- **對外網址(動態,重啟會變)**:
  ```
  https://vienna-kansas-films-technology.trycloudflare.com
  ```
- 確認是否還活著:
  ```bash
  curl -s http://127.0.0.1:20241/metrics | grep userHostname
  ```
- 若機器重開或 cloudflared 被殺,網址會變,要重新:
  1. `cloudflared tunnel --url http://localhost:3200` 再跑一次
  2. 從 metrics 撈新網址
  3. 更新 Line 後台 Webhook URL

### 2. Line 後台要填的 Webhook URL

```
https://vienna-kansas-films-technology.trycloudflare.com/api/webhook/line
```

路徑來源:`apps/api/src/line-bot/line-bot.controller.ts:31,43` + `main.ts:36` 的 `setGlobalPrefix('api')`。
**不是** `/api/line-bot/webhook`(我第一次講錯的版本)。

### 3. Line Developers Console 提供的 Channel 資訊

- Channel ID:`2009858074`
- Channel secret:**原本是 `c3553a1fce4f43fbd27f1d0283cecb1d`,已外流在對話中,必須 reissue 後才可用**
- Channel access token:尚未產生,需到 Messaging API 分頁按 Issue

### 4. .env 要填的變數(在 `.env.example` 查到)

```env
LINE_CHANNEL_SECRET=<reissue 後的新值>
LINE_CHANNEL_ACCESS_TOKEN=<Messaging API 分頁 Issue 產生>
LINE_NOTIFY_TOKEN=<晚點再申請>
LIFF_BASE_URL=<階段二再填>
```

---

## LIFF 現況

頁面**程式碼都寫好了**,只差部署+註冊:

- `apps/liff/src/pages/AdmissionForm.tsx` — 入住預約
- `apps/liff/src/pages/AppointmentResponse.tsx` — 就診回覆
- `apps/liff/src/pages/VisitReservation.tsx` — 探訪預約
- `apps/liff/src/pages/ContractSign.tsx` — 合約簽署

已有 `dist/` 目錄(build 過),但還沒放到外網。

---

## 名詞釐清(使用者曾混淆)

- **Line App** = 手機上的 Line(使用者下載的那個)
- **Line Official Account** = 機構的官方帳號(使用者加好友那個)
- **LIFF App** = 在 Line 內嵌瀏覽器開啟的網頁,就是 `apps/liff` 的成果,要註冊到 Line 平台拿 LIFF_ID

---

## HTTPS 方案選擇

已確認目前用方案 1 即可,**不需要先買網域**:

| 方案 | 成本 | 穩定性 | 狀態 |
|------|------|--------|------|
| Cloudflare Quick Tunnel(現在這個) | 免費 | 網址會變 | ✅ 使用中 |
| Cloudflare Named Tunnel | 免費(需網域) | 固定網址 | 待機構提供 `aiai.org.tw` |
| 正式網域 + Let's Encrypt | 買網域 | 固定 | 上線前再弄 |

---

## 下次接續的第一步

使用者需先做這 3 件事:

1. Line Developers Console → Basic settings → **reissue Channel secret**
2. Messaging API 分頁 → **Issue Channel access token**
3. 把兩個新值貼出來 or 寫進專案根目錄 `.env`

然後 Claude 會:
1. 確認 Cloudflare Tunnel 還活著(`curl metrics`)
2. 若網址變了就告知新網址
3. 協助填 Webhook URL 按 Verify
4. 第一則訊息實測
