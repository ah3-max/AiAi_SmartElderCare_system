'use client';

import React from 'react';
import { ConfigProvider, App } from 'antd';
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
      <App>{children}</App>
    </ConfigProvider>
  );
}
