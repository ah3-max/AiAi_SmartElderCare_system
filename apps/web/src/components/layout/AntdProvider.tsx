'use client';

import React from 'react';
import { ConfigProvider } from 'antd';
import zhTW from 'antd/locale/zh_TW';

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhTW}
      theme={{
        token: {
          colorPrimary: '#1677ff',
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
