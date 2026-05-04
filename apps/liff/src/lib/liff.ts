import liff from '@line/liff'

let initialized = false

export async function initLiff(): Promise<void> {
  const liffId = import.meta.env.VITE_LIFF_ID
  if (!liffId) {
    console.warn('[LIFF] VITE_LIFF_ID 未設定，跳過 LIFF 初始化')
    return
  }
  try {
    await liff.init({ liffId })
    initialized = true
  } catch (err) {
    console.error('[LIFF] 初始化失敗', err)
    throw err
  }
}

export async function getLiffProfile() {
  if (!initialized) return null
  try {
    return await liff.getProfile()
  } catch (err) {
    console.error('[LIFF] 取得使用者資料失敗', err)
    return null
  }
}

export async function getLineUserId(): Promise<string | null> {
  const profile = await getLiffProfile()
  return profile?.userId ?? null
}

export function isLoggedIn(): boolean {
  if (!initialized) return false
  return liff.isLoggedIn()
}

export function liffLogin(): void {
  if (!initialized) return
  if (!liff.isLoggedIn()) {
    liff.login()
  }
}
