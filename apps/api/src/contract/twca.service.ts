import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface KycInitResult {
  sessionId: string;
  redirectUrl: string;
}

@Injectable()
export class TwcaService {
  private readonly logger = new Logger(TwcaService.name);
  private readonly apiUrl: string;
  private readonly appId: string;
  private readonly secret: string;
  readonly isStub: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiUrl = config.get<string>('TWCA_API_URL', 'https://api.twca.com.tw');
    this.appId = config.get<string>('TWCA_APP_ID', '');
    this.secret = config.get<string>('TWCA_SECRET', '');
    this.isStub = !this.secret;
    if (this.isStub) {
      this.logger.warn('TWCA_SECRET 未設定，以 stub 模式運行（僅限開發環境）');
    }
  }

  async initiateKyc(params: {
    referenceId: string;
    signerName: string;
    callbackUrl: string;
    returnUrl: string;
  }): Promise<KycInitResult> {
    if (this.isStub) {
      const ts = Date.now().toString();
      const stubUrl =
        `${params.callbackUrl}?referenceId=${params.referenceId}` +
        `&resultCode=00&timestamp=${ts}&signature=stub`;
      this.logger.debug(`[STUB] KYC init，callback URL: ${stubUrl}`);
      return { sessionId: `stub-${params.referenceId}`, redirectUrl: stubUrl };
    }

    const body = {
      appId: this.appId,
      referenceId: params.referenceId,
      signerName: params.signerName,
      callbackUrl: params.callbackUrl,
      returnUrl: params.returnUrl,
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(`${this.apiUrl}/v1/kyc/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.secret}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`TWCA KYC 初始化失敗 (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { sessionId: string; redirectUrl: string };
    return { sessionId: data.sessionId, redirectUrl: data.redirectUrl };
  }

  // TWCA 呼叫我們的 callback 時，用 HMAC-SHA256 驗證簽章防止偽造
  verifyKycCallback(params: {
    referenceId: string;
    resultCode: string;
    timestamp: string;
    signature: string;
  }): boolean {
    if (this.isStub) {
      return params.signature === 'stub' && params.resultCode === '00';
    }

    const payload = `${params.referenceId}${params.resultCode}${params.timestamp}`;
    const expected = crypto.createHmac('sha256', this.secret).update(payload).digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(params.signature, 'hex'),
        Buffer.from(expected, 'hex'),
      );
    } catch {
      return false;
    }
  }

  async signAndTimestamp(
    pdfBuffer: Buffer,
    metadata: { signerName: string; transactionId: string; signedAt: Date },
  ): Promise<Buffer> {
    if (this.isStub) {
      this.logger.debug(`[STUB] 略過數位簽章，transactionId=${metadata.transactionId}`);
      return pdfBuffer;
    }

    const form = new FormData();
    const pdfArrayBuffer: ArrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength,
    ) as ArrayBuffer;
    form.append(
      'pdf',
      new Blob([pdfArrayBuffer], { type: 'application/pdf' }),
      `${metadata.transactionId}.pdf`,
    );
    form.append('signerName', metadata.signerName);
    form.append('referenceId', metadata.transactionId);
    form.append('signedAt', metadata.signedAt.toISOString());
    form.append('appId', this.appId);

    const res = await fetch(`${this.apiUrl}/v1/sign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secret}` },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`TWCA 數位簽章失敗 (${res.status}): ${text}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }
}
