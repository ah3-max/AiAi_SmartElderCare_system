import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get<string>('ENCRYPTION_KEY', 'default-encryption-key-change-this');
    this.key = scryptSync(secret, 'careflow-salt', 32);
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(encryptedText: string): string {
    const [ivHex, dataHex] = encryptedText.split(':');
    if (!ivHex || !dataHex) return encryptedText;
    const iv = Buffer.from(ivHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  /** 遮罩身分證字號：A123456789 → A1234****9 */
  maskIdNumber(idNumber: string): string {
    if (!idNumber || idNumber.length < 6) return '****';
    return idNumber.slice(0, 5) + '****' + idNumber.slice(-1);
  }

  /** 遮罩電話號碼：0912345678 → 0912***678 */
  maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return '****';
    return phone.slice(0, 4) + '***' + phone.slice(-3);
  }
}
