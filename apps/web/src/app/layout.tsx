import type { Metadata } from 'next';
import './globals.css';
import AntdProvider from '@/components/layout/AntdProvider';

export const metadata: Metadata = {
  title: '愛愛院智慧長照系統',
  description: '愛愛院智慧長照後台管理系統',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
