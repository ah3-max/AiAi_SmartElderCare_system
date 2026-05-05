import liff from '@line/liff'

let initialized = false

const LIFF_ID_MAP: Record<string, string> = {
  '/liff/admission':   import.meta.env.VITE_LIFF_ID_ADMISSION   ?? '',
  '/liff/appointment': import.meta.env.VITE_LIFF_ID_APPOINTMENT ?? '',
  '/liff/visit':       import.meta.env.VITE_LIFF_ID_VISIT       ?? '',
  '/liff/contract':    import.meta.env.VITE_LIFF_ID_CONTRACT     ?? '',
}

function detectLiffId(): string {
  const path = window.location.pathname
  for (const [prefix, id] of Object.entries(LIFF_ID_MAP)) {
    if (path.startsWith(prefix)) return id
  }
  return ''
}

export async function initLiff(): Promise<void> {
  const liffId = detectLiffId()
  if (!liffId) {
    console.warn('[LIFF] 無法從路徑判斷 LIFF ID，跳過初始化')
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
