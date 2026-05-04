'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Spin,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import api from '@/lib/api';
import type { User } from '@careflow/shared';
import { USER_ROLE } from '@careflow/shared';

const { Title } = Typography;

const ROLE_LABEL: Record<string, { text: string; color: string }> = {
  [USER_ROLE.ADMIN]: { text: '系統管理員', color: 'red' },
  [USER_ROLE.FLOOR_ADMIN]: { text: '樓層行政人員', color: 'blue' },
  [USER_ROLE.NURSE]: { text: '護理人員', color: 'green' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/api/users');
      setUsers(res.data.data ?? res.data);
    } catch {
      message.error('載入使用者資料失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (values: Record<string, unknown>) => {
    setCreating(true);
    try {
      await api.post('/api/users', values);
      message.success('建立使用者成功');
      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(errorMsg || '建立使用者失敗');
    } finally {
      setCreating(false);
    }
  };

  const columns: ColumnsType<User> = [
    { title: '帳號', dataIndex: 'username', key: 'username', width: 140 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 120 },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 130,
      render: (role: string) => {
        const r = ROLE_LABEL[role] || { text: role, color: 'default' };
        return <Tag color={r.color}>{r.text}</Tag>;
      },
    },
    { title: '棟別', dataIndex: 'building', key: 'building', width: 80, render: (v) => v || '-' },
    {
      title: '樓層',
      dataIndex: 'floor',
      key: 'floor',
      width: 70,
      render: (v: number | null) => (v != null ? `${v}F` : '-'),
    },
    {
      title: '狀態',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (active: boolean) =>
        active ? <Tag color="success">啟用</Tag> : <Tag color="default">停用</Tag>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          使用者管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新增使用者
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Table<User>
          rowKey="id"
          columns={columns}
          dataSource={users}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          scroll={{ x: 650 }}
        />
      )}

      <Modal
        title="新增使用者"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="username" label="帳號" rules={[{ required: true, message: '請輸入帳號' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密碼" rules={[{ required: true, message: '請輸入密碼' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '請輸入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '請選擇角色' }]}>
            <Select
              options={[
                { label: '系統管理員', value: USER_ROLE.ADMIN },
                { label: '樓層行政人員', value: USER_ROLE.FLOOR_ADMIN },
                { label: '護理人員', value: USER_ROLE.NURSE },
              ]}
            />
          </Form.Item>
          <Form.Item name="building" label="棟別">
            <Input placeholder="例：A棟" />
          </Form.Item>
          <Form.Item name="floor" label="樓層">
            <Select
              allowClear
              placeholder="請選擇樓層"
              options={Array.from({ length: 10 }, (_, i) => ({
                label: `${i + 1}F`,
                value: i + 1,
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={creating}>
                建立
              </Button>
              <Button
                onClick={() => {
                  setModalOpen(false);
                  form.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
