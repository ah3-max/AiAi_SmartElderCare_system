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
  Popconfirm,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  LockOutlined,
  StopOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import api from '@/lib/api';
import type { User } from '@careflow/shared';
import { USER_ROLE } from '@careflow/shared';
import { useAuthStore } from '@/stores/auth';

const { Title } = Typography;

const ROLE_LABEL: Record<string, { text: string; color: string }> = {
  [USER_ROLE.ADMIN]: { text: '系統管理員', color: 'red' },
  [USER_ROLE.FLOOR_ADMIN]: { text: '樓層行政人員', color: 'blue' },
  [USER_ROLE.NURSE]: { text: '護理人員', color: 'green' },
};

const ROLE_OPTIONS = [
  { label: '系統管理員', value: USER_ROLE.ADMIN },
  { label: '樓層行政人員', value: USER_ROLE.FLOOR_ADMIN },
  { label: '護理人員', value: USER_ROLE.NURSE },
];

const FLOOR_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  label: `${i + 1}F`,
  value: i + 1,
}));

function extractErrorMessage(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  }
  return undefined;
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm();

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm] = Form.useForm();

  const [pwTargetId, setPwTargetId] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwForm] = Form.useForm();

  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  useEffect(() => {
    if (editingUser) {
      editForm.setFieldsValue({
        username: editingUser.username,
        name: editingUser.name,
        role: editingUser.role,
        building: editingUser.building ?? undefined,
        floor: editingUser.floor ?? undefined,
      });
    }
  }, [editingUser, editForm]);

  const handleCreate = async (values: Record<string, unknown>) => {
    setCreating(true);
    try {
      await api.post('/api/users', values);
      message.success('建立使用者成功');
      setCreateOpen(false);
      createForm.resetFields();
      fetchData();
    } catch (err) {
      message.error(extractErrorMessage(err) || '建立使用者失敗');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async ({ username: _u, ...values }: Record<string, unknown>) => {
    if (!editingUser) return;
    setEditSubmitting(true);
    try {
      await api.patch(`/api/users/${editingUser.id}`, values);
      message.success('更新成功');
      setEditingUser(null);
      fetchData();
    } catch (err) {
      message.error(extractErrorMessage(err) || '更新失敗');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    setTogglingId(user.id);
    try {
      await api.patch(`/api/users/${user.id}`, { isActive: !user.isActive });
      message.success(user.isActive ? '已停用帳號' : '已啟用帳號');
      fetchData();
    } catch {
      message.error('操作失敗');
    } finally {
      setTogglingId(null);
    }
  };

  const handleResetPassword = async (values: { newPassword: string }) => {
    if (!pwTargetId) return;
    setPwSubmitting(true);
    try {
      await api.patch(`/api/users/${pwTargetId}/reset-password`, {
        newPassword: values.newPassword,
      });
      message.success('密碼已重設');
      setPwTargetId(null);
      pwForm.resetFields();
    } catch (err) {
      message.error(extractErrorMessage(err) || '重設密碼失敗');
    } finally {
      setPwSubmitting(false);
    }
  };

  const columns: ColumnsType<User> = [
    { title: '帳號', dataIndex: 'username', key: 'username', width: 130 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 120 },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 130,
      render: (role: string) => {
        const r = ROLE_LABEL[role] ?? { text: role, color: 'default' };
        return <Tag color={r.color}>{r.text}</Tag>;
      },
    },
    {
      title: '棟別',
      dataIndex: 'building',
      key: 'building',
      width: 80,
      render: (v: string | null) => v || '-',
    },
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
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_, record) => {
        const isSelf = record.id === currentUser?.id;
        return (
          <Space size={0}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEditingUser(record)}
            >
              編輯
            </Button>
            <Tooltip title={isSelf ? '不可停用自己的帳號' : undefined}>
              <Popconfirm
                title={record.isActive ? '確定停用此帳號？' : '確定啟用此帳號？'}
                onConfirm={() => handleToggleActive(record)}
                okText="確定"
                cancelText="取消"
                disabled={isSelf}
              >
                <Button
                  type="link"
                  size="small"
                  danger={record.isActive}
                  disabled={isSelf}
                  loading={togglingId === record.id}
                  icon={record.isActive ? <StopOutlined /> : <CheckOutlined />}
                >
                  {record.isActive ? '停用' : '啟用'}
                </Button>
              </Popconfirm>
            </Tooltip>
            <Button
              type="link"
              size="small"
              icon={<LockOutlined />}
              onClick={() => {
                setPwTargetId(record.id);
                pwForm.resetFields();
              }}
            >
              重設密碼
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          使用者管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
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
          scroll={{ x: 810 }}
        />
      )}

      {/* 新增使用者 */}
      <Modal
        title="新增使用者"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item
            name="username"
            label="帳號"
            rules={[{ required: true, message: '請輸入帳號' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="密碼"
            rules={[
              { required: true, message: '請輸入密碼' },
              { min: 8, message: '密碼至少 8 個字元' },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '請輸入姓名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '請選擇角色' }]}
          >
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item name="building" label="棟別">
            <Input placeholder="例：A棟" />
          </Form.Item>
          <Form.Item name="floor" label="樓層">
            <Select allowClear placeholder="請選擇樓層" options={FLOOR_OPTIONS} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={creating}>
                建立
              </Button>
              <Button
                onClick={() => {
                  setCreateOpen(false);
                  createForm.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 編輯使用者 */}
      <Modal
        title="編輯使用者"
        open={!!editingUser}
        onCancel={() => {
          setEditingUser(null);
          editForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate} style={{ marginTop: 16 }}>
          <Form.Item name="username" label="帳號">
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '請輸入姓名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '請選擇角色' }]}
          >
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item name="building" label="棟別">
            <Input placeholder="例：A棟" />
          </Form.Item>
          <Form.Item name="floor" label="樓層">
            <Select allowClear placeholder="請選擇樓層" options={FLOOR_OPTIONS} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={editSubmitting}>
                儲存
              </Button>
              <Button
                onClick={() => {
                  setEditingUser(null);
                  editForm.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 重設密碼 */}
      <Modal
        title="重設密碼"
        open={!!pwTargetId}
        onCancel={() => {
          setPwTargetId(null);
          pwForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={pwForm}
          layout="vertical"
          onFinish={handleResetPassword}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="newPassword"
            label="新密碼"
            rules={[
              { required: true, message: '請輸入新密碼' },
              { min: 6, message: '密碼至少 6 個字元' },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="確認密碼"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '請再次輸入密碼' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('兩次輸入的密碼不一致'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={pwSubmitting}>
                確認重設
              </Button>
              <Button
                onClick={() => {
                  setPwTargetId(null);
                  pwForm.resetFields();
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
