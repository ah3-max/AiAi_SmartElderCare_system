/**
 * 敏感個資顯示 masking 工具
 * - maskIdNumber: 身分證字號 A123456789 → A1234****9
 * - maskPhone: 手機號碼 0912345678 → 0912***678
 * - maskName: 中文姓名 王小明 → 王○明
 * - maskMedicalNote: 病歷摘要只露前 20 字
 */

export function maskIdNumber(idNumber: string | null | undefined): string {
  if (!idNumber) return '—';
  if (idNumber.length < 6) return '****';
  return idNumber.slice(0, 5) + '****' + idNumber.slice(-1);
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const normalized = phone.replace(/-/g, '');
  if (normalized.length < 7) return '****';
  return normalized.slice(0, 4) + '***' + normalized.slice(-3);
}

export function maskName(name: string | null | undefined): string {
  if (!name) return '—';
  if (name.length <= 2) return name[0] + '○';
  return name[0] + '○'.repeat(name.length - 2) + name.slice(-1);
}

export function maskMedicalNote(note: string | null | undefined, max = 20): string {
  if (!note) return '—';
  return note.length > max ? note.slice(0, max) + '…' : note;
}
