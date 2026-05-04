import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://careflow:careflow_dev_pw@localhost:5432/careflow',
  },
});
