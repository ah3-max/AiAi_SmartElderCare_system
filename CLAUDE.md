# 愛愛院智慧長照流程數位化系統

**客戶**：財團法人台北市私立愛愛院
**開發商**：上丘智能有限公司
**規格書版本**：V1.0（2026-03-10）
**需求提出者**：陳柏言

---

## 專案概述

整合 Line 官方帳號（Line Official Account）與 Web 後台管理系統的智慧長照服務平台，涵蓋四大功能模組：

1. 入住預約登記
2. 長者就診通知與回覆
3. 家屬探訪預約
4. 線上合約簽署

---

## 技術整合

- **Line Messaging API**：推播通知給家屬與護理端
- **Line Notify**：推播通知給機構行政人員
- **Line LIFF**：家屬端表單（入住預約、探訪預約、就診回覆）
- **TWCA（第三方憑證機構）**：KYC 身份驗證（Mobile ID 或 OTP）、數位簽章與 TSA 時間戳記（AATL）
- **Cron Job**：每日排程掃描就診通知

---

## 功能模組規格

### 1. 入住預約登記

**資料欄位：**
- 申請人：`ApplicantName`、`ContactPhone`（台灣手機格式 09xx-xxx-xxx）、`LineUserID`、`Relation`
- 長者評估：`SeniorName`、`BirthYear`、`Gender`、`ADLScore`（巴氏量表）、`MedicalTags`（鼻胃管/導尿管/氣切/洗腎/失智症遊走風險）
- 預約：`PreferredRoom`（單人/雙人/多人）、`ExpectedDate`、`Status`

**狀態流程：** 新申請 → 已聯繫 → 候補中 → 安排入住 / 結案 / 不符合入住資格

**UI：** Line 圖文選單 → LIFF 三步驟分頁表單（Step1 基本資料、Step2 照護評估、Step3 需求確認）

**必守規則：**
- 同一 LineUserID 在 30 天內已有「待評估」或「候補中」申請 → 拒絕重複建檔
- 表單必須包含個資蒐集聲明勾選框，未勾選不可送出
- MedicalTags 勾選時，後台自動標紅字警示
- 狀態為「新申請」時，必須先填「聯繫紀錄」或「預約入住日期」才能變更至「候補中」或「結案」

**後台 Dashboard：** 看板視圖（依 Status 呈現卡片）、不符合入住資格名單、來源分析圓餅圖

---

### 2. 長者就診通知與回覆

**資料欄位：**
- `Residents`：ResidentID、Name、FloorID（樓層/棟別）
- `FamilyMembers`：LineUserID、Relation、IsPrimaryContact
- `Appointments`：ApptDate、ApptTime、Hospital、Department、Status（未通知/已通知/已確認）
- `Responses`：ResponseSelection（自行陪同/機構協助）、ResponseTime、NeedsTransport

**Cron Job 觸發時機：** 就診前 7 天、3 天上午 08:00；選擇「家屬親自陪同」時亦於前 1 天 08:00 發送提醒

**家屬回覆選項：** A. 家屬親自陪同 / B. 需機構協助

**必守規則：**
- 距就診時間少於 24 小時 → 鎖定回覆功能，提示直接致電護理站
- 僅綁定且驗證過的 LineUserID 可開啟回覆頁面
- 排除長者請假表單中請假原因註記為急診的記錄

**後台 Dashboard：** 看板視圖（待處理 / 已安排 / 已結案）；緊急情況（派車資訊輸入時間距門診時間 < 1 天）標示紅色警示

---

### 3. 家屬探訪預約

**資料欄位：**
- `Zones`：ZoneID（如 A 棟 3 樓）、MaxVisitorsPerSlot
- `TimeSlots`：每日開放時段（如 10:00-11:00、14:00-15:00）
- `Reservations`：VisitDate、TimeSlot、VisitorName、GuestCount

**必守規則：**
- 名額檢查需具備 **Transaction 原子性**，防止超賣
- 分層分棟邏輯：A 棟家屬只能預約 A 棟長者，不可跨棟
- 每次預約訪客人數上限 **2 人**
- 同一家屬 Line 帳號同一天內僅能預約 **1 個時段**
- 額滿時段顯示「已額滿」並禁止點擊

**後台 Dashboard：** 各層各棟當日探訪人數、報到人數、探訪家屬與對應長者資訊；支援設定分樓層可探訪數量上限；提供「預約三次未出現名單」

---

### 4. 線上合約簽署

**資料欄位：**
- `ContractTemplates`：ContentHTML、Version
- `ContractTransactions`：ContractID、SignerName、SignerIP、Timestamp、Status（待簽署/已完成/過期）
- `SignatureImages`：Base64 字串或 SVG 路徑

**流程：** 行政人員後台發送通知 → 系統生成唯一 Token 連結 → 家屬點擊連結 → TWCA KYC 身份驗證 → 閱讀合約（需勾選「我已閱讀」）→ 畫布簽名 → 系統呼叫 TWCA API 進行數位簽章與 TSA 時間戳記 → 產出防竄改 PDF

**法規遵循（電子簽章法）：**
- 最終 PDF 須包含 TWCA 數位憑證與 AATL 國際標準時間戳記
- 頁面必須提供「同意採用電子簽章」與「拒絕，改用紙本簽署」選項
- 簽署完成後，該連結立即失效（One-time Link）

**KYC 錯誤防護：** 連續驗證失敗 3 次 → 暫時鎖定連結

**後台 Dashboard：** 統計看板（本月待簽署/即將到期/已完成）、多維度篩選（樓層/棟別/狀態）、合約到期以燈號呈現（紅色=過期、黃色=30 天內到期、綠色=效期內）、批次發送催簽通知

---

## 安全需求

- 所有頁面（後台與家屬端）必須使用 **SSL/HTTPS**
- 嚴格執行**分層分棟**權限管理（A 棟管理員不可查看 B 棟長者資料）
- 系統管理員（Admin）與一般護理人員需有不同操作權限
- 敏感個資（身分證字號、病歷摘要）在呈現中需加密處理
- 符合《個人資料保護法》規範，電子合約簽署需留存數位軌跡（IP、時間戳記）
- 後台登入需帳號密碼保護，並建議啟用登入錯誤鎖定機制
- Line 帳號綁定需經過身份驗證流程

---

## 性能與環境需求

- **部署**：系統後端程式與資料庫部署於客戶機構伺服器，使用機構專屬獨立網域與 SSL 憑證
- **後台瀏覽器相容性**：Windows/macOS 最新版 Google Chrome 與 Microsoft Edge
- **裝置相容性（LIFF/合約頁面）**：RWD，支援 iOS Safari 與 Android Chrome 最新兩個大版本
- **併發乘載量**：至少支援 100 名使用者同時在線操作

---

## 費用邊界說明（不含於本系統開發費用）

- Line 官方帳號每月推播費用由需求方自行負擔
- TWCA KYC 身份驗證及數位簽章服務的 API 計次或年費由機構負擔
- Line Messaging API 簡訊費用由需求方負擔

---

## 驗收標準

- **唯一驗收依據**：本需求規格確認書「二.功能描述/說明」及「三.處理過程」
- **交付物**：
  1. 正式環境部署完成且可正常運作之軟體系統
  2. 系統後台管理與前台操作手冊（PDF 格式）
  3. 系統最高管理員（Admin）帳號與密碼
- **UAT 期間**：功能開發完成並交付測試環境後，需求方享有 **15 個工作天**測試期
- **保固**：上線日起 3 個月免費系統除錯保固（不含功能新增或現有邏輯變更）

---

## 技術架構與撰寫規格

### 整體架構

```
┌─────────────────────┐       ┌───────────────────────┐
│  Line 平台（家屬端）     │       │  Web 後台（管理員端）      │
│  React 18 + Vite     │       │  Next.js 14 (App Router)│
│  LIFF SDK v2         │       │  Ant Design 5           │
│  Tailwind CSS        │       │  Zustand                │
└──────────┬──────────┘       └───────────┬───────────┘
           │         HTTPS (REST API)      │
           └──────────────┬────────────────┘
                          ▼
                ┌──────────────────┐
                │   後端 API 伺服器    │
                │  NestJS (TypeScript)│
                │  Host: 0.0.0.0     │
                │  Prisma ORM        │
                │  Cron 排程模組       │
                └─────────┬────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │PostgreSQL │   │   TWCA   │   │  Line    │
    │  16 資料庫 │   │ KYC/簽章  │   │ Msg API  │
    └──────────┘   └──────────┘   └──────────┘
```

### Monorepo 結構

```
careflow/
├── apps/
│   ├── api/              # NestJS 後端 API
│   ├── web/              # Next.js 後台管理系統
│   └── liff/             # React LIFF 家屬端
├── packages/
│   └── shared/           # 共用型別定義、常數、工具函式
├── prisma/
│   └── schema.prisma     # 資料庫 Schema
├── docker-compose.yml
├── nginx.conf
├── package.json          # npm workspaces root
├── tsconfig.base.json
└── CLAUDE.md
```

### 後端 API（apps/api）

| 項目 | 規格 |
|------|------|
| 語言 | TypeScript (Node.js 20 LTS) |
| 框架 | NestJS |
| ORM | Prisma |
| 資料庫 | PostgreSQL 16 |
| 監聽位址 | `0.0.0.0`（允許區域網設備連線） |
| 認證 | JWT + RBAC（分層分棟角色權限） |
| 排程 | `@nestjs/schedule`（cron） |
| API 風格 | RESTful |
| 驗證 | `class-validator` + `class-transformer` |
| 日誌 | Winston |
| 測試 | Jest |

### 資料庫

| 項目 | 規格 |
|------|------|
| 引擎 | PostgreSQL 16 |
| 加密 | 敏感欄位使用 `pgcrypto` AES-256 加密儲存 |
| ORM | Prisma（支援 Transaction 原子性） |

### Web 後台管理系統（apps/web）

| 項目 | 規格 |
|------|------|
| 框架 | Next.js 14（App Router） |
| UI 套件 | Ant Design 5 |
| 狀態管理 | Zustand |
| HTTP 客戶端 | Axios |
| 看板元件 | `@hello-pangea/dnd`（拖拉看板） |
| 圖表 | Chart.js + react-chartjs-2 |
| 表格 | Ant Design Table（分頁、篩選、排序） |
| 瀏覽器支援 | Windows/macOS Chrome + Edge 最新版 |

### Line LIFF 家屬端（apps/liff）

| 項目 | 規格 |
|------|------|
| 框架 | React 18（Vite 建置） |
| LIFF SDK | `@line/liff` v2 |
| UI | Tailwind CSS + Headless UI |
| 表單 | React Hook Form + Zod |
| 日曆元件 | `react-day-picker` |
| 簽名畫布 | `react-signature-canvas` |
| RWD | iOS Safari + Android Chrome 最新兩版 |

### Line 整合

| 項目 | 套件/服務 |
|------|----------|
| Messaging API | `@line/bot-sdk` |
| LIFF | `@line/liff` |
| Webhook | NestJS Controller 接收 |
| Flex Message | 就診提醒、申請狀態通知等結構化訊息 |
| Rich Menu | Line Official Account Manager 設定 |
| Line Notify | HTTP POST 通知行政人員 |

### 第三方整合

| 服務 | 用途 | 串接方式 |
|------|------|----------|
| TWCA | KYC 身份驗證（Mobile ID / OTP） | REST API |
| TWCA | 數位簽章 + TSA 時間戳記（AATL） | REST API |
| Line Messaging API | 推播通知 | `@line/bot-sdk` |
| Line Notify | 行政人員通知 | HTTP POST |

### 部署規劃

| 項目 | 規格 |
|------|------|
| 容器化 | Docker + Docker Compose |
| 反向代理 | Nginx（SSL 終止、靜態資源、路由分發） |
| SSL | Let's Encrypt 或客戶自備憑證 |
| 環境 | 客戶自有 Linux 伺服器 |
| 服務組成 | api（NestJS :3000）、web（Next.js :3001）、liff（靜態檔 via Nginx）、postgres（:5432） |
| 後端監聽 | `0.0.0.0:3000`（區域網可存取） |
| Nginx 路由 | `/api/*` → api:3000、`/admin/*` → web:3001、`/liff/*` → 靜態檔 |
