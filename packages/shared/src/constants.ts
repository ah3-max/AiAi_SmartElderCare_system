// ===== 入住預約狀態 =====
export const ADMISSION_STATUS = {
  NEW: 'new',              // 新申請
  CONTACTED: 'contacted',  // 已聯繫
  WAITLISTED: 'waitlisted', // 候補中
  ADMITTED: 'admitted',    // 安排入住
  CLOSED: 'closed',        // 結案
  INELIGIBLE: 'ineligible', // 不符合入住資格
} as const;

export type AdmissionStatus = (typeof ADMISSION_STATUS)[keyof typeof ADMISSION_STATUS];

// ===== 就診通知狀態 =====
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',      // 未通知
  NOTIFIED: 'notified',    // 已通知
  CONFIRMED: 'confirmed',  // 已確認
  CANCELLED: 'cancelled',  // 已取消
} as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];

// ===== 家屬回覆選項 =====
export const RESPONSE_SELECTION = {
  SELF_ACCOMPANY: 'self_accompany',     // 家屬親自陪同
  NEED_ASSISTANCE: 'need_assistance',   // 需機構協助
} as const;

export type ResponseSelection = (typeof RESPONSE_SELECTION)[keyof typeof RESPONSE_SELECTION];

// ===== 合約簽署狀態 =====
export const CONTRACT_STATUS = {
  PENDING: 'pending',      // 待簽署
  COMPLETED: 'completed',  // 已完成
  EXPIRED: 'expired',      // 過期
} as const;

export type ContractStatus = (typeof CONTRACT_STATUS)[keyof typeof CONTRACT_STATUS];

// ===== 房型 =====
export const ROOM_TYPE = {
  SINGLE: 'single',   // 單人房
  DOUBLE: 'double',   // 雙人房
  SHARED: 'shared',   // 多人房
} as const;

export type RoomType = (typeof ROOM_TYPE)[keyof typeof ROOM_TYPE];

// ===== 性別 =====
export const GENDER = {
  MALE: 'male',
  FEMALE: 'female',
} as const;

export type Gender = (typeof GENDER)[keyof typeof GENDER];

// ===== ADL 評估 =====
export const ADL_LEVEL = {
  INDEPENDENT: 'independent',       // 完全自理
  PARTIAL_ASSIST: 'partial_assist', // 部分協助
  FULLY_DEPENDENT: 'fully_dependent', // 完全依賴
} as const;

export type AdlLevel = (typeof ADL_LEVEL)[keyof typeof ADL_LEVEL];

// ===== 特殊照護標籤 =====
export const MEDICAL_TAGS = [
  'nasogastric_tube',   // 鼻胃管
  'urinary_catheter',   // 導尿管
  'tracheostomy',       // 氣切
  'dialysis',           // 洗腎
  'dementia_wandering', // 失智症遊走風險
] as const;

export type MedicalTag = (typeof MEDICAL_TAGS)[number];

// ===== 管理員角色 =====
export const USER_ROLE = {
  ADMIN: 'admin',         // 系統管理員
  FLOOR_ADMIN: 'floor_admin', // 樓層行政人員
  NURSE: 'nurse',         // 護理人員
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

// ===== 業務規則常數 =====
export const BUSINESS_RULES = {
  DUPLICATE_CHECK_DAYS: 30,           // 重複申請檢查天數
  MAX_VISITORS_PER_BOOKING: 2,        // 每次預約最大訪客數
  MAX_BOOKINGS_PER_DAY: 1,           // 同一家屬同日最大預約數
  NOTIFICATION_DAYS: [7, 3, 1],       // 就診通知天數（前N天）
  NOTIFICATION_HOUR: 8,              // 通知發送時間（08:00）
  RESPONSE_LOCK_HOURS: 24,           // 就診回覆鎖定時數
  KYC_MAX_ATTEMPTS: 3,               // KYC 最大嘗試次數
  NO_SHOW_THRESHOLD: 3,              // 探訪未出現次數門檻
  PHONE_REGEX: /^09\d{2}-?\d{3}-?\d{3}$/, // 台灣手機格式
} as const;
