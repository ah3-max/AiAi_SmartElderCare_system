import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import PDFDocument from 'pdfkit';

export interface ContractPdfParams {
  transactionId: string;
  title: string;
  version: string;
  contentHtml: string;
  residentName: string;
  residentBuilding: string;
  residentFloor: string | number;
  signerName: string;
  signerIp: string;
  signedAt: Date;
  signatureData: string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly cjkFontPath: string;

  constructor(private readonly config: ConfigService) {
    this.cjkFontPath = config.get<string>(
      'CJK_FONT_PATH',
      '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
    );
    if (!fs.existsSync(this.cjkFontPath)) {
      this.logger.warn(
        `CJK 字型不存在：${this.cjkFontPath}，PDF 中文字元可能無法正常顯示。` +
          '請安裝 fonts-droid-fallback 或透過 CJK_FONT_PATH 指定字型路徑。',
      );
    }
  }

  async generateContractPdf(params: ContractPdfParams): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 60, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const hasCjk = fs.existsSync(this.cjkFontPath);
      const font = (bold = false) => {
        if (hasCjk) {
          doc.font(this.cjkFontPath);
        } else {
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
        }
        return doc;
      };

      // 封面：標題與版本
      font(true).fontSize(18).text(params.title, { align: 'center' });
      doc.moveDown(0.5);
      font().fontSize(10).text(`版本：${params.version}`, { align: 'center' });
      doc.moveDown(1.5);

      // 簽署資訊
      font(true).fontSize(12).text('簽署資訊');
      doc.moveDown(0.4);
      font()
        .fontSize(11)
        .text(
          `長者姓名：${params.residentName}（${params.residentBuilding} ${params.residentFloor}樓）`,
        )
        .text(`簽署人：${params.signerName}`)
        .text(`簽署 IP：${params.signerIp}`)
        .text(
          `簽署時間：${params.signedAt.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`,
        )
        .text(`合約編號：${params.transactionId}`);

      doc.moveDown(1.5);
      doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke();
      doc.moveDown(1);

      // 合約內文
      font(true).fontSize(12).text('合約內容');
      doc.moveDown(0.6);
      font().fontSize(10).text(this.stripHtml(params.contentHtml), { lineGap: 4 });

      // 簽名頁
      doc.addPage();
      font(true).fontSize(14).text('本人簽名', { align: 'center' });
      doc.moveDown(1.5);

      const sigBuffer = this.decodeSignature(params.signatureData);
      if (sigBuffer) {
        const imgX = (595 - 300) / 2;
        doc.image(sigBuffer, imgX, doc.y, { width: 300, height: 150 });
        doc.moveDown(9);
      }

      font()
        .fontSize(9)
        .text(
          `本人 ${params.signerName} 同意採用電子簽章完成本合約簽署，具有與紙本簽章相同之法律效力。`,
          { align: 'center', lineGap: 3 },
        );

      doc.end();
    });
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private decodeSignature(data: string): Buffer | null {
    try {
      const base64 = data.includes(',') ? data.split(',')[1] : data;
      return Buffer.from(base64, 'base64');
    } catch {
      return null;
    }
  }
}
