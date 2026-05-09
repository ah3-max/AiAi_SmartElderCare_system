import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://careflow:careflow_dev_pw@localhost:5432/careflow',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('開始建立種子資料...');

  // 1. 建立系統管理員
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      name: '系統管理員',
      role: 'ADMIN',
    },
  });
  console.log(`✅ 管理員帳號: admin / admin123 (id: ${admin.id})`);

  // 2. 建立示範樓層管理員
  const floorAdminPassword = await bcrypt.hash('floor123', 12);
  const floorAdmin = await prisma.user.upsert({
    where: { username: 'admin_a3' },
    update: {},
    create: {
      username: 'admin_a3',
      password: floorAdminPassword,
      name: 'A棟3樓行政',
      role: 'FLOOR_ADMIN',
      building: 'A',
      floor: 3,
    },
  });
  console.log(`✅ 樓層管理員: admin_a3 / floor123 (id: ${floorAdmin.id})`);

  // 3. 建立示範區域與時段
  const zoneA3 = await prisma.zone.upsert({
    where: { building_floor: { building: 'A', floor: 3 } },
    update: {},
    create: {
      building: 'A',
      floor: 3,
      label: 'A棟3樓',
      maxVisitorsPerSlot: 10,
    },
  });

  const zoneA4 = await prisma.zone.upsert({
    where: { building_floor: { building: 'A', floor: 4 } },
    update: {},
    create: {
      building: 'A',
      floor: 4,
      label: 'A棟4樓',
      maxVisitorsPerSlot: 8,
    },
  });

  const zoneB3 = await prisma.zone.upsert({
    where: { building_floor: { building: 'B', floor: 3 } },
    update: {},
    create: {
      building: 'B',
      floor: 3,
      label: 'B棟3樓',
      maxVisitorsPerSlot: 10,
    },
  });

  // 每個區域建立預設時段
  const defaultSlots = [
    { startTime: '10:00', endTime: '11:00' },
    { startTime: '14:00', endTime: '15:00' },
    { startTime: '15:00', endTime: '16:00' },
  ];

  for (const zone of [zoneA3, zoneA4, zoneB3]) {
    const existingSlots = await prisma.timeSlot.count({ where: { zoneId: zone.id } });
    if (existingSlots === 0) {
      await prisma.timeSlot.createMany({
        data: defaultSlots.map((slot) => ({
          zoneId: zone.id,
          ...slot,
        })),
      });
      console.log(`✅ ${zone.label} 已建立 ${defaultSlots.length} 個時段`);
    }
  }

  // 4. 建立示範合約範本
  const existingTemplate = await prisma.contractTemplate.findFirst({
    where: { title: '長期照護服務同意書' },
  });
  if (!existingTemplate) {
    await prisma.contractTemplate.create({
      data: {
        title: '長期照護服務同意書',
        version: 'V1.0',
        contentHtml: `
          <h2>長期照護服務同意書</h2>
          <p>甲方（機構）：財團法人台北市私立愛愛院</p>
          <p>乙方（家屬）：＿＿＿＿＿＿</p>
          <h3>第一條：服務內容</h3>
          <p>甲方同意依據長者之身心狀況，提供日常生活照護、健康管理、社交活動等服務。</p>
          <h3>第二條：費用與支付</h3>
          <p>1. 照護費用依月計算，每月初起算至月底，按月繳納。</p>
          <p>2. 火災保險費、特約門診交通費等另計。</p>
          <h3>第三條：合約期間</h3>
          <p>本合約自簽訂之日起生效，每年續約一次。任一方欲終止合約，需於一個月前書面通知。</p>
          <h3>第四條：隱私與安全</h3>
          <p>甲方承諾妥善保管乙方及長者之個人資料，符合《個人資料保護法》規範。</p>
        `,
      },
    });
    console.log('✅ 已建立示範合約範本');
  }

  // 5. 建立示範長者與家屬
  const resident1 = await prisma.resident.upsert({
    where: { id: 'seed-resident-1' },
    update: {},
    create: {
      id: 'seed-resident-1',
      name: '林○○',
      building: 'A',
      floor: 3,
      roomNo: '301',
    },
  });
  const resident2 = await prisma.resident.upsert({
    where: { id: 'seed-resident-2' },
    update: {},
    create: {
      id: 'seed-resident-2',
      name: '陳○○',
      building: 'A',
      floor: 4,
      roomNo: '402',
    },
  });

  await prisma.familyMember.upsert({
    where: { residentId_lineUserId: { residentId: resident1.id, lineUserId: 'U_DEMO_FAMILY_001' } },
    update: {},
    create: {
      residentId: resident1.id,
      lineUserId: 'U_DEMO_FAMILY_001',
      name: '林小明',
      relation: '子',
      isPrimaryContact: true,
      isVerified: true,
    },
  });
  await prisma.familyMember.upsert({
    where: { residentId_lineUserId: { residentId: resident2.id, lineUserId: 'U_DEMO_FAMILY_002' } },
    update: {},
    create: {
      residentId: resident2.id,
      lineUserId: 'U_DEMO_FAMILY_002',
      name: '陳小華',
      relation: '女',
      isPrimaryContact: true,
      isVerified: true,
    },
  });
  console.log('✅ 已建立 2 位示範長者與家屬');

  // 6. 建立示範就診記錄
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 7);
  const existingAppt = await prisma.appointment.findFirst({ where: { residentId: resident1.id } });
  if (!existingAppt) {
    await prisma.appointment.create({
      data: {
        residentId: resident1.id,
        apptDate: tomorrow,
        apptTime: '09:30',
        hospital: '台北榮民總醫院',
        department: '心臟內科',
      },
    });
    console.log('✅ 已建立示範就診記錄');
  }

  // 7. 建立示範入住申請
  const existingApp = await prisma.applicant.findFirst({ where: { lineUserId: 'U_DEMO_APPLY_001' } });
  if (!existingApp) {
    await prisma.applicant.create({
      data: {
        applicantName: '王先生',
        contactPhone: '0912-345-678',
        lineUserId: 'U_DEMO_APPLY_001',
        relation: '子',
        privacyConsent: true,
        preferredRoom: 'DOUBLE',
        referralSource: '朋友介紹',
        seniorAssessment: {
          create: {
            seniorName: '王○○',
            birthYear: 1945,
            gender: 'MALE',
            adlScore: 45,
            adlLevel: 'PARTIAL_ASSIST',
            medicalTags: ['nasogastric_tube', 'dementia_wandering'],
          },
        },
      },
    });
    console.log('✅ 已建立示範入住申請（含紅字警示）');
  }

  // 8. 建立 Line Bot FAQ 知識庫
  const faqs = [
    { keyword: '收費', question: '費用怎麼算？', answer: '本院收費標準依房型而定：\n・單人房：每月約 NT$40,000\n・雙人房：每月約 NT$30,000\n・多人房：每月約 NT$25,000\n另有餐費、醫療耗材等額外費用，歡迎致電 02-XXXX-XXXX 詢問。', priority: 10 },
    { keyword: '探訪', question: '探訪時間？', answer: '【探訪時間】\n・上午：10:00-11:00\n・下午：14:00-15:00、15:00-16:00\n每時段人數有限，請透過 Line 選單「探訪預約」提前登記。', priority: 10 },
    { keyword: '入住', question: '入住流程？', answer: '【入住流程】\n1. 線上申請（Line 選單點擊「入住預約」）\n2. 社工聯繫安排現場參觀\n3. 評估照護需求\n4. 床位確認後安排入住\n如有疑問請致電。', priority: 10 },
    { keyword: '就診', question: '就診安排？', answer: '長者就診安排會於前 7 天、前 3 天透過 Line 通知家屬。如需機構協助接送，請於通知中回覆「需機構協助」。緊急狀況請直接致電護理站。', priority: 10 },
    { keyword: '聯絡', question: '聯絡方式？', answer: '【愛愛院聯絡資訊】\n電話：02-XXXX-XXXX\n地址：台北市XXXX\n傳真：02-XXXX-XXXX\n官網：https://www.aiai.org.tw', priority: 10 },
    { keyword: '請假', question: '長者可以外出嗎？', answer: '長者外出需由家屬事先告知護理站，填寫請假單並註明原因（一般事假/急診）。急診記錄會自動排除當次就診通知。', priority: 5 },
  ];
  for (const faq of faqs) {
    await prisma.faqEntry.upsert({
      where: { keyword: faq.keyword },
      update: {},
      create: faq,
    });
  }
  console.log(`✅ 已建立 ${faqs.length} 則 FAQ`);

  // 9. 系統設定
  const settingsDefs = [
    {
      key: 'LINE_NOTIFY_TOKEN',
      category: 'line',
      label: 'LINE Notify 權杖',
      description: '用於發送管理員通知的 LINE Notify Token',
      isSensitive: true,
    },
    {
      key: 'LIFF_BASE_URL',
      category: 'url',
      label: 'LIFF 應用基底 URL',
      description: '例如 https://liff.line.me/your-liff-id',
      isSensitive: false,
    },
    {
      key: 'API_BASE_URL',
      category: 'url',
      label: '後端 API 基底 URL',
      description: '用於組合 TWCA callback URL 等外部回呼位址',
      isSensitive: false,
    },
  ];
  for (const def of settingsDefs) {
    const envValue = process.env[def.key] ?? '';
    await prisma.systemSetting.upsert({
      where: { key: def.key },
      update: {},
      create: { ...def, value: envValue },
    });
  }
  console.log(`✅ 已建立 ${settingsDefs.length} 項系統設定`);

  console.log('\n🎉 種子資料建立完成！');
}

main()
  .catch((e) => {
    console.error('種子資料建立失敗:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
