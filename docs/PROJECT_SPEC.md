# 愛愛院智慧長照流程數位化系統 — 專案規格說明書（文字版）

**客戶**：財團法人台北市私立愛愛院
**開發商**：上丘智能有限公司
**規格書版本**：V1.0（2026-03-10）
**需求提出者**：陳柏言
**文件產出日期**：2026-05-09

---

## 一、專案目標

整合 Line 官方帳號與 Web 後台管理系統，建立智慧長照服務平台，涵蓋四大功能模組：入住預約登記、長者就診通知與回覆、家屬探訪預約、線上合約簽署。

---

## 二、技術架構

### 2.1 整體架構

系統採用前後端分離架構，分為三個應用程式：

1. **後端 API（apps/api）**：NestJS + Prisma + PostgreSQL 16
2. **Web 後台管理（apps/web）**：Next.js 14 (App Router) + Ant Design 5
3. **Line LIFF 家屬端（apps/liff）**：React 18 + Vite + Tailwind CSS

三個應用共用 `packages/shared` 中的型別定義與常數。

### 2.2 Monorepo 目錄結構

```
AiAi_SmartElderCare_system/
├── apps/
│   ├── api/                  # NestJS 後端 API
│   │   ├── prisma/
│   │   │   ├── schema.prisma # 資料庫 Schema（18 個 Model）
│   │   │   ├── seed.ts       # 種子資料
│   │   │   └── migrations/   # 資料庫遷移記錄
│   │   └── src/
│   │       ├── admission/    # 入住預約模組
│   │       ├── appointment/  # 就診通知模組（含 Cron Job）
│   │       ├── visit/        # 探訪預約模組
│   │       ├── contract/     # 合約簽署模組（含 PDF、TWCA）
│   │       ├── notification/ # Line 推播通知服務
│   │       ├── line-bot/     # Line Webhook 處理
│   │       ├── faq/          # FAQ 自動回覆管理
│   │       ├── users/        # 使用者管理
│   │       ├── resident-leave/ # 長者請假管理
│   │       ├── system-setting/ # 系統設定
│   │       └── common/       # 共用 Guard、Decorator
│   ├── web/                  # Next.js 後台管理系統
│   │   └── src/
│   │       ├── app/(dashboard)/
│   │       │   ├── admission/    # 入住預約管理頁面
│   │       │   ├── appointment/  # 就診通知管理頁面
│   │       │   ├── visit/        # 探訪預約管理頁面
│   │       │   ├── contract/     # 合約簽署管理頁面
│   │       │   ├── users/        # 使用者管理頁面
│   │       │   ├── faq/          # FAQ 管理頁面
│   │       │   └── settings/     # 系統設定頁面
│   │       ├── components/layout/ # AdminLayout、AntdProvider
│   │       └── stores/           # Zustand 狀態管理
│   └── liff/                 # React LIFF 家屬端
│       └── src/
│           ├── pages/
│           │   ├── AdmissionForm.tsx       # 入住預約表單（三步驟）
│           │   ├── AppointmentResponse.tsx # 就診回覆頁面
│           │   ├── VisitReservation.tsx    # 探訪預約頁面
│           │   └── ContractSign.tsx        # 合約簽署頁面
│           ├── components/                # LoadingSpinner、StepIndicator
│           └── lib/                       # LIFF SDK 初始化、API client
├── packages/
│   └── shared/               # 共用型別定義、常數、工具函式
│       └── src/
│           ├── constants.ts   # Enum 常數（狀態、角色、房型等）
│           └── types.ts       # TypeScript 型別定義
├── scripts/                  # 部署腳本、tunnel 設定
├── docker-compose.yml
├── nginx.conf
└── CLAUDE.md
```

### 2.3 後端技術規格

| 項目 | 規格 |
|------|------|
| 語言 | TypeScript (Node.js 20 LTS) |
| 框架 | NestJS |
| ORM | Prisma（支援 Transaction 原子性） |
| 資料庫 | PostgreSQL 16 |
| 監聽位址 | 0.0.0.0（允許區域網設備連線） |
| 認證 | JWT + RBAC（分層分棟角色權限） |
| 排程 | @nestjs/schedule（Cron Job） |
| API 風格 | RESTful |
| 驗證 | class-validator + class-transformer |
| 日誌 | Winston |

### 2.4 Web 後台技術規格

| 項目 | 規格 |
|------|------|
| 框架 | Next.js 14（App Router） |
| UI 套件 | Ant Design 5 |
| 狀態管理 | Zustand |
| HTTP 客戶端 | Axios |
| 看板元件 | @hello-pangea/dnd（拖拉看板） |
| 圖表 | Chart.js + react-chartjs-2 |
| 表格 | Ant Design Table（分頁、篩選、排序） |
| 富文本編輯器 | react-quill-new（合約範本 WYSIWYG 編輯） |

### 2.5 LIFF 家屬端技術規格

| 項目 | 規格 |
|------|------|
| 框架 | React 18.3 + React Router 7.6 |
| 建置工具 | Vite |
| LIFF SDK | @line/liff v2 |
| UI | Tailwind CSS 4.1 |
| 表單驗證 | React Hook Form + Zod |
| 日曆元件 | react-day-picker 9.7 |
| 簽名畫布 | react-signature-canvas 1.0 |

### 2.6 部署架構

| 項目 | 規格 |
|------|------|
| 容器化 | Docker + Docker Compose |
| 反向代理 | Nginx（SSL 終止、路由分發） |
| SSL | Let's Encrypt 或客戶自備憑證 |
| 環境 | 客戶自有 Linux 伺服器 |

服務組成：
- api（NestJS :3200）
- web（Next.js :3201）
- liff（Vite 靜態檔 via Nginx）
- postgres（:5432）

---

## 三、資料庫 Schema

### 3.1 資料模型總覽（18 個 Model）

**使用者管理：**
- `User`：後台管理員帳號（含角色、棟別、樓層、登入鎖定）

**入住預約：**
- `Applicant`：入住申請者資料（含狀態流程）
- `SeniorAssessment`：長者照護評估（巴氏量表、醫療標籤）
- `ContactRecord`：聯繫紀錄

**就診通知：**
- `Resident`：院內長者基本資料
- `FamilyMember`：家屬資料（含 Line 綁定與驗證狀態）
- `Appointment`：就診排程
- `AppointmentResponse`：家屬回覆紀錄
- `AppointmentNotification`：通知發送紀錄（防重複）

**探訪預約：**
- `Zone`：區域設定（棟別 + 樓層 + 人數上限）
- `TimeSlot`：開放時段
- `Reservation`：預約紀錄（含報到狀態）

**合約簽署：**
- `ContractTemplate`：合約範本（HTML 格式 + 可選 pdfFilePath 原檔路徑）
- `ContractTransaction`：簽署交易紀錄（含 Token、KYC、簽名、PDF）

**其他：**
- `ResidentLeave`：長者請假紀錄
- `FaqEntry`：LINE Bot FAQ 知識庫
- `SystemSetting`：系統設定（Key-Value）

### 3.2 Enum 定義

| Enum | 值 | 說明 |
|------|----|------|
| UserRole | ADMIN, FLOOR_ADMIN, NURSE | 管理員角色 |
| AdmissionStatus | NEW, CONTACTED, WAITLISTED, ADMITTED, CLOSED, INELIGIBLE | 入住申請狀態 |
| RoomType | SINGLE, DOUBLE, SHARED | 房型 |
| Gender | MALE, FEMALE | 性別 |
| AdlLevel | INDEPENDENT, PARTIAL_ASSIST, FULLY_DEPENDENT | ADL 評估等級 |
| AppointmentStatus | PENDING, NOTIFIED, CONFIRMED, CANCELLED | 就診通知狀態 |
| ResponseSelection | SELF_ACCOMPANY, NEED_ASSISTANCE | 家屬回覆選項 |
| ContractStatus | PENDING, COMPLETED, EXPIRED, REJECTED | 合約簽署狀態 |
| LeaveType | EMERGENCY, PERSONAL, FAMILY, OTHER | 請假類型 |

---

## 四、功能模組詳細規格

### 4.1 入住預約登記

#### 4.1.1 功能說明

家屬透過 Line 圖文選單進入 LIFF 表單，填寫入住申請資料，後台管理員進行審核與狀態管理。

#### 4.1.2 LIFF 表單（AdmissionForm.tsx）

三步驟分頁表單：

**Step 1 — 基本資料：**
- 申請人姓名（ApplicantName）
- 聯絡電話（ContactPhone，台灣手機格式 09xx-xxx-xxx）
- 與長者關係（Relation）
- 個資蒐集聲明勾選框（未勾選不可送出）

**Step 2 — 照護評估：**
- 長者姓名（SeniorName）
- 出生年（BirthYear）
- 性別（Gender）
- 巴氏量表分數（ADLScore，0-100 滑桿）
- ADL 等級（AdlLevel）
- 特殊照護標籤（MedicalTags）：鼻胃管、導尿管、氣切、洗腎、失智症遊走風險

**Step 3 — 需求確認：**
- 偏好房型（PreferredRoom：單人/雙人/多人）
- 預計入住日期（ExpectedDate）
- 來源管道（ReferralSource）

#### 4.1.3 狀態流程

```
新申請(NEW) → 已聯繫(CONTACTED) → 候補中(WAITLISTED) → 安排入住(ADMITTED)
                                                      → 結案(CLOSED)
                                                      → 不符合入住資格(INELIGIBLE)
```

#### 4.1.4 業務規則

- 同一 LineUserID 在 30 天內已有「待評估」或「候補中」申請 → 拒絕重複建檔
- 表單必須包含個資蒐集聲明勾選框，未勾選不可送出
- MedicalTags 勾選時，後台自動標紅字警示
- 狀態為「新申請」時，必須先填「聯繫紀錄」或「預約入住日期」才能變更至「候補中」或「結案」

#### 4.1.5 後台 Dashboard

- 看板視圖（依 Status 呈現卡片，支援拖拉）
- 不符合入住資格名單
- 來源分析圓餅圖

---

### 4.2 長者就診通知與回覆

#### 4.2.1 功能說明

系統透過 Cron Job 排程掃描即將到來的就診，自動推播 Line Flex Message 通知家屬，家屬透過 LIFF 頁面回覆是否陪同就醫。

#### 4.2.2 通知機制

**Cron Job 排程：**
- 執行時間：每日 08:00（Asia/Taipei 時區）
- Cron 表達式：`0 8 * * *`
- 通知時間點：就診前 7 天、就診前 3 天、就診前 1 天（限已選「家屬親自陪同」者）

**Line Flex Message 內容：**
- 藍色標題列：「長者就診提醒」
- 資訊欄位：長者姓名、就診日期、就診時間、醫院名稱、就診科別
- 底部按鈕：「點此確認安排」（URI Action，開啟 LIFF 回覆頁面）

**排除條件：**
- 已取消的就診排程
- 長者請假紀錄中原因為「急診」的記錄

#### 4.2.3 家屬回覆流程

1. 家屬收到 Flex Message → 點擊「點此確認安排」按鈕
2. 開啟 LIFF 頁面（AppointmentResponse.tsx）
3. 頁面顯示就診詳細資訊
4. 家屬選擇：「家屬親自陪同」或「需機構協助」
5. 系統記錄回覆、更新狀態為 CONFIRMED
6. 發送確認訊息給家屬
7. 若選擇「需機構協助」，同步通知行政人員安排派車

#### 4.2.4 業務規則

- 距就診時間少於 24 小時 → 鎖定回覆功能（前後端雙重檢查），提示直接致電護理站
- 僅綁定且驗證過的 LineUserID（isVerified = true）可開啟回覆頁面
- 通知紀錄有唯一約束（appointmentId + daysBefore），防止重複發送

#### 4.2.5 後台 Dashboard

- 看板視圖：待處理 / 已安排 / 已結案
- 緊急情況（派車資訊輸入時間距門診時間 < 1 天）標示紅色警示

#### 4.2.6 資料模型

```
Appointment
├── residentId      → Resident
├── apptDate        日期
├── apptTime        時間
├── hospital        醫院
├── department      科別
├── status          PENDING → NOTIFIED → CONFIRMED → CANCELLED
├── responses[]     → AppointmentResponse
└── notifications[] → AppointmentNotification（防重複）

AppointmentResponse
├── appointmentId   → Appointment
├── familyMemberId  → FamilyMember
├── responseSelection  SELF_ACCOMPANY | NEED_ASSISTANCE
├── needsTransport  是否需要派車
├── vehicleType     車輛類型
├── vehicleArrangedAt 派車安排時間
└── responseTime    回覆時間
```

---

### 4.3 家屬探訪預約

#### 4.3.1 功能說明

家屬透過 LIFF 頁面預約探訪長者，系統依分層分棟邏輯管理名額，確保不超賣。

#### 4.3.2 LIFF 表單（VisitReservation.tsx）

- 選擇長者（下拉選單，顯示長者姓名與所在位置）
- 選擇日期（日曆元件）
- 選擇時段（依長者所在區域動態載入可用時段）
- 填寫訪客姓名與人數（1-2 人）
- 確認預約 / 取消預約

#### 4.3.3 業務規則

- 名額檢查需具備 Transaction 原子性，防止超賣
- 分層分棟邏輯：A 棟家屬只能預約 A 棟長者，不可跨棟
- 每次預約訪客人數上限 2 人
- 同一家屬 Line 帳號同一天內僅能預約 1 個時段
- 額滿時段顯示「已額滿」並禁止點擊

#### 4.3.4 後台 Dashboard

- 各層各棟當日探訪人數、報到人數
- 探訪家屬與對應長者資訊
- 支援設定分樓層可探訪數量上限
- 提供「預約三次未出現名單」

#### 4.3.5 資料模型

```
Zone
├── building     棟別（A/B/...）
├── floor        樓層
├── label        顯示名稱（如 A棟3樓）
├── maxVisitorsPerSlot  每時段人數上限
└── timeSlots[]  → TimeSlot

TimeSlot
├── zoneId       → Zone
├── startTime    開始時間（如 10:00）
└── endTime      結束時間（如 11:00）

Reservation
├── zoneId       → Zone
├── timeSlotId   → TimeSlot
├── lineUserId   預約者 Line ID
├── residentId   → Resident
├── visitDate    探訪日期
├── visitorName  訪客姓名
├── guestCount   訪客人數（上限 2）
├── checkedIn    是否報到
└── cancelledAt  取消時間
```

---

### 4.4 線上合約簽署

#### 4.4.1 功能說明

行政人員從後台發送合約簽署通知給家屬，家屬透過一次性 Token 連結進入 LIFF 頁面，完成身份驗證（TWCA KYC）後閱讀合約、手寫簽名，系統呼叫 TWCA API 進行數位簽章與時間戳記，產出防竄改 PDF。

#### 4.4.2 合約範本管理

- 儲存格式：HTML（contentHtml 欄位），可選保存原始檔案路徑（pdfFilePath）
- **輸入方式一：富文本編輯器**（react-quill-new）— 行政人員在後台直接編輯，所見即所得
- **輸入方式二：上傳 Word 檔案**（.docx）— 系統透過 mammoth 自動轉換為 HTML，原始 docx 保存備查
- 後台可新增、編輯、停用合約範本
- 範本包含：標題、版本號、HTML 內容、原始檔案路徑、啟用狀態

#### 4.4.3 合約簽署完整流程

```
1. 行政人員後台選擇合約範本 + 簽署人資訊 → 點擊「發送簽署通知」
2. 系統生成 UUID v4 Token → 建立 ContractTransaction（狀態：PENDING）
3. 透過 Line 推播通知家屬，附帶唯一 Token 連結
4. 家屬點擊連結 → 開啟 LIFF 合約頁面（ContractSign.tsx）
5. 系統檢查 Token 有效性（未過期、未簽署、未鎖定）
6. 家屬進行 TWCA KYC 身份驗證
   a. LIFF 呼叫 /api/contracts/kyc-init/:token
   b. 系統呼叫 TWCA API 取得驗證 URL
   c. 家屬被導向 TWCA 驗證頁面
   d. TWCA 完成驗證後回呼 /api/contracts/twca-callback
   e. 系統驗證 HMAC-SHA256 簽章、更新 kycVerified 狀態
7. 家屬閱讀合約全文（可捲動的 HTML 區塊）
8. 閱讀「電子簽章使用告知」（依電子簽章法第 4、5 條揭露法律效力、TWCA 憑證機構、紙本替代權利、副本留存說明）
9. 閱讀「個人資料蒐集告知」（依個資法第 8 條揭露蒐集目的、項目、期間、對象、當事人權利）
10. 勾選確認框一：「我已詳細閱讀上述合約內容」
11. 勾選確認框二：「我已閱讀並同意電子簽章使用告知及個人資料蒐集告知」
12. 在簽名畫布上手寫簽名
13. 點擊「同意採用電子簽章」
    （或點擊「拒絕，改用紙本簽署」→ 狀態標為 REJECTED，通知行政人員準備紙本流程）
14. 後端產出 PDF（PDFKit）→ 嵌入合約文字 + 簽名圖檔 + 簽署資訊
15. 呼叫 TWCA API 進行數位簽章 + TSA 時間戳記
16. 儲存最終 PDF 至檔案系統
17. 更新狀態為 COMPLETED → Token 連結失效（One-time Link）
18. 推播通知家屬簽署完成，附帶 PDF 副本下載連結
```

#### 4.4.4 合約狀態與燈號

| 狀態 | 燈號 | 說明 |
|------|------|------|
| PENDING + 效期 > 30 天 | 綠色 | 效期內，待簽署 |
| PENDING + 效期 ≤ 30 天 | 黃色 | 即將到期，應催簽 |
| EXPIRED 或已過期 | 紅色 | 自然過期 |
| REJECTED | 橘色 | 家屬主動拒絕電子簽署，改用紙本 |
| COMPLETED | 綠色 | 已完成簽署 |

#### 4.4.5 自動排程

- Cron Job：每日 09:00（Asia/Taipei）
- 自動將已過期的 PENDING 合約標為 EXPIRED
- 到期前 3 天自動發送 Line 催簽通知

#### 4.4.6 簽名圖檔儲存

- 前端：react-signature-canvas 產出 PNG DataURL
- 格式：Base64 編碼的 PNG 圖片
- 儲存位置：ContractTransaction.signatureData 欄位（PostgreSQL TEXT）
- 大小限制：500KB（DTO 驗證）
- PDF 嵌入：Base64 解碼後嵌入 PDF（300x150px 置中）

#### 4.4.7 PDF 產出規格

使用 PDFKit 產出 A4 PDF：

**第一頁（合約內容）：**
- 合約標題（18pt 粗體）
- 版本號
- 簽署資訊：長者姓名（棟/樓）、簽署人、簽署人 IP、簽署時間、交易 ID
- 合約全文（HTML 轉純文字，10pt）

**第二頁（簽名頁）：**
- 「本人簽名」標題
- 嵌入簽名圖檔（300x150px 置中）
- 法律聲明：「本人[姓名]同意採用電子簽章完成本合約簽署，具有與紙本簽章相同之法律效力」

**CJK 字型：** 需安裝 `fonts-droid-fallback`（DroidSansFallbackFull.ttf）

#### 4.4.8 TWCA 串接規格

**KYC 身份驗證（initiateKyc）：**
- 端點：TWCA KYC API
- 參數：appId、referenceId（token）、signerName、callbackUrl、returnUrl
- 回傳：sessionId、redirectUrl
- 回呼驗證：HMAC-SHA256 簽章驗證

**數位簽章（signAndTimestamp）：**
- 端點：TWCA /v1/sign
- 參數：PDF 檔案、簽署人、交易 ID、時間
- 回傳：含數位憑證與 TSA 時間戳記的 PDF

**Stub 模式：**
- 當 TWCA_SECRET 未設定時自動啟用
- KYC 直接回傳成功（resultCode=00）
- 簽章回傳原始 PDF（不含真實簽章）
- 僅限開發環境使用

#### 4.4.9 KYC 安全防護

- 連續驗證失敗 3 次 → kycLockedAt 記錄鎖定時間 → 連結無法使用
- 需管理員介入解鎖
- HMAC-SHA256 驗證 TWCA 回呼，防止偽造
- 簽署前檢查 kycVerified 狀態

#### 4.4.10 法規遵循（電子簽章法 + 個資法）

- 最終 PDF 包含 TWCA 數位憑證與 AATL 國際標準時間戳記
- LIFF 頁面提供「同意採用電子簽章」與「拒絕，改用紙本簽署」選項
- 簽署完成後 Token 連結立即失效（One-time Link）
- 留存數位軌跡：簽署人 IP、時間戳記、交易 ID

**電子簽章使用告知（依電子簽章法第 4、5 條）：**
- 告知電子簽章與紙本具同等法律效力
- 揭露 TWCA 憑證機構名稱與 AATL 時間戳記規格
- 明確說明簽署人有權選擇紙本替代方案
- 說明簽署後將提供 PDF 副本留存

**個人資料蒐集告知（依個資法第 8 條）：**
- 蒐集目的：合約簽署之身份驗證與法律效力確認（代號 069）
- 蒐集項目：姓名、簽名圖檔、IP 位址、簽署時間、身份驗證結果
- 利用期間、地區、對象
- 當事人權利：查詢、閱覽、複製、更正、停止利用、刪除

**雙重勾選確認（前後端雙重驗證）：**
- 勾選框一：「我已詳細閱讀上述合約內容」
- 勾選框二：「我已閱讀並同意電子簽章使用告知及個人資料蒐集告知」
- 兩個都勾選後才顯示簽名畫布
- 後端 SubmitSignatureDto 包含 `agreedToElectronic` + `agreedToTerms` 雙重布林驗證，無法繞過前端直接呼叫 API

#### 4.4.11 簽署完成後推播

簽署完成後，系統透過 LINE 推播以下內容給家屬：
- 合約名稱與版本號
- 簽署時間
- PDF 副本下載連結（GET /contracts/pdf/:token，簽署後 30 天內有效）
- 過期提示文字
- 機構聯絡電話（02-2758-7020）

LIFF 簽署完成頁面亦提供「下載合約 PDF 副本」按鈕。

#### 4.4.12 後台合約管理 Dashboard

- 統計看板：本月待簽署 / 即將到期 / 已完成
- 合約列表：含燈號（綠/黃/紅/橘）、到期日、簽署日、狀態
- 多維度篩選：棟別 / 樓層 / 狀態（待簽署/已完成/已拒絕（紙本）/過期）/ 姓名搜尋
- 批次催簽：勾選多筆待簽署合約重發通知
- PDF 下載：已完成合約可下載含數位簽章的 PDF
- **合約範本管理：**
  - 富文本編輯器（react-quill-new WYSIWYG）新增/編輯範本
  - Word 上傳按鈕（.docx，mammoth 自動轉 HTML）
  - 範本啟用/停用/刪除

#### 4.4.13 RWD 響應式設計（平板與筆電優化）

合約簽署頁面針對平板（員工與家屬現場簽約場景）與筆電做響應式優化：

| 項目 | 手機（< 768px） | 平板（768px+） | 筆電（1024px+） |
|------|----------------|---------------|----------------|
| 容器寬度 | max-w-lg (512px) | max-w-2xl (672px) | max-w-4xl (896px) |
| 簽名畫布高度 | 200px | 300px | 350px |
| 合約內容區高度 | 320px | 500px | 600px |
| 告知區塊排版 | 單欄 | 單欄 | 雙欄並排 |
| 按鈕排版 | 堆疊 | 並排 | 並排 |
| 字體大小 | text-sm | text-base | text-base |
| 勾選框大小 | 20px | 24px | 24px |

- 簽名畫布設定 `touch-none` 防止簽名時頁面捲動
- 筆跡粗細 minWidth 1.5 / maxWidth 3，適合觸控筆與手指

#### 4.4.14 正式環境必要設定

```env
TWCA_API_URL=https://api.twca.com.tw
TWCA_APP_ID=<TWCA 應用程式 ID>
TWCA_SECRET=<TWCA 密鑰>
TWCA_KYC_CALLBACK_URL=https://<正式網域>/contracts/twca-callback
API_BASE_URL=https://<正式網域>
LIFF_BASE_URL=https://liff.line.me/<LIFF ID>
CONTRACT_PDF_DIR=uploads/contracts
CONTRACT_TEMPLATE_DIR=uploads/templates
CJK_FONT_PATH=/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf
```

---

## 五、LINE 整合

### 5.1 Line Messaging API

- 套件：@line/bot-sdk
- 用途：推播 Flex Message 給家屬（就診提醒、合約簽署通知、確認訊息）
- Webhook：NestJS Controller 接收（POST /webhook/line），含 X-Line-Signature 驗證

### 5.2 Line LIFF

- 套件：@line/liff v2
- 四個 LIFF 頁面：入住預約、就診回覆、探訪預約、合約簽署
- 依路徑選擇對應 LIFF ID 初始化

### 5.3 Line Bot 自動回覆

- Webhook 收到文字訊息後依優先順序處理：
  1. 入住進度查詢（關鍵字：進度、申請狀態、查詢）→ 回傳申請者狀態
  2. FAQ 資料庫比對（依 keyword 欄位匹配）→ 回傳預設答案
  3. 預設回覆（提示可用關鍵字：收費、探訪、入住、進度）

### 5.4 Line Notify

- 用途：推播通知給機構行政人員
- 方式：HTTP POST
- 觸發時機：家屬選擇「需機構協助」就醫、合約簽署完成/拒絕等

### 5.5 Rich Menu

- 由 Line Official Account Manager 設定
- 提供圖文選單入口：入住預約、探訪預約、就診資訊等

---

## 六、角色權限（RBAC）

### 6.1 角色定義

| 角色 | 代碼 | 權限範圍 |
|------|------|----------|
| 系統管理員 | ADMIN | 全部功能 + 系統設定 + 使用者管理 |
| 樓層行政人員 | FLOOR_ADMIN | 所屬棟別/樓層的資料（分層分棟隔離） |
| 護理人員 | NURSE | 所屬棟別/樓層的就診與照護資料 |

### 6.2 分層分棟權限

- User 資料表包含 building（棟別）與 floor（樓層）欄位
- ADMIN 不受棟別/樓層限制，可查看所有資料
- FLOOR_ADMIN 與 NURSE 僅能存取所屬棟別的資料
- 後端以 RolesGuard 搭配 @Roles() Decorator 進行權限檢查

### 6.3 登入安全

- JWT Token 認證
- 登入錯誤鎖定：loginAttempts 欄位追蹤失敗次數，lockedUntil 記錄鎖定時間

---

## 七、安全需求

- 所有頁面（後台與家屬端）使用 SSL/HTTPS
- 嚴格執行分層分棟權限管理
- 敏感個資（身分證字號、病歷摘要）加密處理
- 符合《個人資料保護法》規範
- 電子合約簽署留存數位軌跡（IP、時間戳記）
- 後台登入帳號密碼保護 + 登入錯誤鎖定機制
- Line 帳號綁定需經過身份驗證流程（isVerified）
- Line Webhook 驗證 X-Line-Signature
- TWCA 回呼驗證 HMAC-SHA256

---

## 八、Cron Job 排程總覽

| 排程 | 執行時間 | 功能 |
|------|----------|------|
| 就診通知 | 每日 08:00 (Asia/Taipei) | 掃描 7/3/1 天內就診，推播 Flex Message |
| 合約過期檢查 | 每日 09:00 (Asia/Taipei) | 自動標記過期合約為 EXPIRED |
| 合約催簽通知 | 每日 09:00 (Asia/Taipei) | 到期前 3 天推播催簽通知 |

---

## 九、API 端點總覽

### 9.1 公開端點（無需認證）

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /webhook/line | Line Webhook 接收 |
| POST | /api/admissions | 入住預約申請（LIFF） |
| POST | /api/appointments/response | 就診回覆（LIFF） |
| POST | /api/visits | 探訪預約（LIFF） |
| GET | /api/contracts/token/:token | 取得合約資訊（LIFF） |
| POST | /api/contracts/kyc-init/:token | 啟動 KYC 驗證（LIFF） |
| POST | /api/contracts/twca-callback | TWCA KYC 回呼 |
| POST | /api/contracts/sign | 合約簽署（LIFF） |
| POST | /api/contracts/reject | 拒絕電子簽署（LIFF） |
| GET | /api/contracts/pdf/:token | 家屬下載已簽署 PDF 副本（30 天有效） |
| GET | /api/contracts/template-pdf/:templateId | 取得合約範本原始檔案 |

### 9.2 後台端點（需 JWT 認證）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET/POST/PATCH | /admin/admissions | 入住預約管理 |
| GET/POST/PATCH | /admin/appointments | 就診通知管理 |
| GET/POST/PATCH | /admin/visits | 探訪預約管理 |
| GET/POST | /admin/contracts | 合約管理 |
| POST | /admin/contracts/templates/upload | 上傳 Word 建立合約範本 |
| GET | /admin/contracts/:id/pdf | 下載合約 PDF |
| GET/POST/PATCH/DELETE | /admin/faq | FAQ 管理 |
| GET/POST/PATCH/DELETE | /admin/users | 使用者管理（限 ADMIN） |
| GET/PATCH | /admin/settings | 系統設定（限 ADMIN） |

---

## 十、環境變數設定

```env
# 資料庫
DATABASE_URL=postgresql://careflow:password@localhost:5432/careflow

# JWT
JWT_SECRET=<JWT 密鑰>

# Line Messaging API
LINE_CHANNEL_ACCESS_TOKEN=<Line Channel Access Token>
LINE_CHANNEL_SECRET=<Line Channel Secret>

# Line Notify
LINE_NOTIFY_TOKEN=<Line Notify Token>

# LIFF
LIFF_BASE_URL=https://liff.line.me/<LIFF ID>
VITE_LIFF_ID_ADMISSION=<入住預約 LIFF ID>
VITE_LIFF_ID_APPOINTMENT=<就診回覆 LIFF ID>
VITE_LIFF_ID_VISIT=<探訪預約 LIFF ID>
VITE_LIFF_ID_CONTRACT=<合約簽署 LIFF ID>

# TWCA
TWCA_API_URL=https://api.twca.com.tw
TWCA_APP_ID=<TWCA App ID>
TWCA_SECRET=<TWCA Secret>

# API
API_BASE_URL=https://<正式網域>

# PDF
CONTRACT_PDF_DIR=uploads/contracts
CONTRACT_TEMPLATE_DIR=uploads/templates
CJK_FONT_PATH=/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf
```

---

## 十一、業務規則常數

定義於 `packages/shared/src/constants.ts`：

| 常數 | 值 | 說明 |
|------|-----|------|
| DUPLICATE_CHECK_DAYS | 30 | 重複申請檢查天數 |
| MAX_VISITORS_PER_BOOKING | 2 | 每次預約最大訪客數 |
| MAX_BOOKINGS_PER_DAY | 1 | 同一家屬同日最大預約數 |
| NOTIFICATION_DAYS | [7, 3, 1] | 就診通知天數 |
| NOTIFICATION_HOUR | 8 | 通知發送時間（08:00） |
| RESPONSE_LOCK_HOURS | 24 | 就診回覆鎖定時數 |
| KYC_MAX_ATTEMPTS | 3 | KYC 最大嘗試次數 |
| NO_SHOW_THRESHOLD | 3 | 探訪未出現次數門檻 |
| PHONE_REGEX | /^09\d{2}-?\d{3}-?\d{3}$/ | 台灣手機格式 |

---

## 十二、實作狀態總覽

### 12.1 已完成功能

| 模組 | 後端 API | 後台 UI | LIFF 前端 | 備註 |
|------|----------|---------|-----------|------|
| 入住預約登記 | 完成 | 完成（看板+圓餅圖） | 完成（三步驟表單） | |
| 就診通知推播 | 完成（含 Cron Job） | 完成（看板視圖） | 完成（回覆頁面） | Flex Message |
| 家屬探訪預約 | 完成 | 完成 | 完成 | Transaction 原子性 |
| 合約簽署 | 完成 | 完成（燈號+統計） | 完成（簽名+KYC） | TWCA Stub 模式 |
| 使用者管理 | 完成 | 完成 | — | RBAC |
| FAQ 自動回覆 | 完成 | 完成 | — | Line Bot |
| 長者請假 | 完成 | — | — | 就診排除依據 |
| 系統設定 | 完成 | 完成 | — | 限 ADMIN |

### 12.2 待處理 / 注意事項

| 項目 | 狀態 | 說明 |
|------|------|------|
| TWCA 正式憑證 | 待設定 | 目前使用 Stub 模式，正式環境需設定 TWCA_SECRET |
| HTML 清理 | 建議加強 | ContractSign.tsx 使用 dangerouslySetInnerHTML，建議加入 DOMPurify |
| CJK 字型安裝 | 待確認 | Docker 環境需安裝 fonts-droid-fallback |
| ~~電子簽章告知書~~ | 已完成 | 電子簽章使用告知 + 個資蒐集告知 + 雙重勾選 + 後端 agreedToTerms 驗證 |
| ~~簽署後 PDF 副本~~ | 已完成 | 推播含版本號/下載連結/30天期限/聯絡電話，LIFF 亦提供下載按鈕 |
| ~~合約範本上傳~~ | 已完成 | 富文本編輯器（react-quill-new）+ Word 上傳（mammoth 轉 HTML） |
| ~~合約拒絕狀態~~ | 已完成 | 新增 REJECTED 狀態，後台橘色燈號，篩選下拉新增選項 |
| ~~平板/筆電 RWD~~ | 已完成 | 簽署頁面響應式優化：容器/簽名區/告知區塊/按鈕/字體依裝置適配 |

---

## 十三、驗收標準

- 唯一驗收依據：需求規格確認書「功能描述/說明」及「處理過程」
- 交付物：
  1. 正式環境部署完成且可正常運作之軟體系統
  2. 系統後台管理與前台操作手冊（PDF 格式）
  3. 系統最高管理員（Admin）帳號與密碼
- UAT 期間：功能開發完成後，需求方享有 15 個工作天測試期
- 保固：上線日起 3 個月免費系統除錯保固（不含功能新增或現有邏輯變更）

---

## 十四、費用邊界說明（不含於開發費用）

- Line 官方帳號每月推播費用由需求方自行負擔
- TWCA KYC 身份驗證及數位簽章服務的 API 計次或年費由機構負擔
- Line Messaging API 簡訊費用由需求方負擔
