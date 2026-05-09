'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Card,
  Input,
  Button,
  Spin,
  message,
  Space,
  Tag,
  Collapse,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import api from '@/lib/api';
import type { SystemSetting } from '@careflow/shared';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const CATEGORY_LABELS: Record<string, string> = {
  line: 'LINE 整合設定',
  url: 'URL 設定',
  general: '一般設定',
};

const CATEGORY_ORDER = ['line', 'url', 'general'];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/system-settings');
      const data: SystemSetting[] = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      setSettings(data);
      const vals: Record<string, string> = {};
      for (const s of data) {
        vals[s.key] = s.value;
      }
      setEditValues(vals);
      setDirty({});
    } catch {
      message.error('載入系統設定失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleChange = (key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => ({ ...prev, [key]: true }));
  };

  const handleSave = async (key: string) => {
    setSavingKey(key);
    try {
      await api.patch(`/api/admin/system-settings/${key}`, {
        value: editValues[key] ?? '',
      });
      message.success('設定已儲存');
      setDirty((prev) => ({ ...prev, [key]: false }));
      fetchData();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(errorMsg || '儲存失敗');
    } finally {
      setSavingKey(null);
    }
  };

  const grouped = CATEGORY_ORDER
    .map((cat) => ({
      cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      items: settings.filter((s) => s.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        系統設定
      </Title>

      <Collapse
        defaultActiveKey={grouped.map((g) => g.cat)}
        items={grouped.map((group) => ({
          key: group.cat,
          label: group.label,
          children: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {group.items.map((setting) => (
                <Card key={setting.key} size="small">
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>{setting.label}</Text>
                    <Tag style={{ marginLeft: 8 }} color="default">
                      {setting.key}
                    </Tag>
                  </div>
                  {setting.description && (
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                      {setting.description}
                    </Text>
                  )}
                  <Space.Compact style={{ width: '100%' }}>
                    {setting.isSensitive ? (
                      <Input.Password
                        value={editValues[setting.key] ?? ''}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        placeholder="輸入新值"
                        style={{ flex: 1 }}
                      />
                    ) : (
                      <Input
                        value={editValues[setting.key] ?? ''}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        placeholder="輸入值"
                        style={{ flex: 1 }}
                      />
                    )}
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={savingKey === setting.key}
                      disabled={!dirty[setting.key]}
                      onClick={() => handleSave(setting.key)}
                    >
                      儲存
                    </Button>
                  </Space.Compact>
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
                    上次更新：{dayjs(setting.updatedAt).format('YYYY-MM-DD HH:mm')}
                  </Text>
                </Card>
              ))}
            </div>
          ),
        }))}
      />
    </div>
  );
}
