'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography, Table, Button, Modal, Form, Input, InputNumber,
  Switch, Popconfirm, Space, Tag, message, Spin,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '@/lib/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface FaqRow {
  id: string;
  keyword: string;
  question: string;
  answer: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

interface ModalState {
  open: boolean;
  mode: 'create' | 'edit';
  record?: FaqRow;
}

export default function FaqPage() {
  const [rows, setRows] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'create' });
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/faq');
      setRows(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
    } catch {
      message.error('載入 FAQ 資料失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ priority: 0, isActive: true });
    setModal({ open: true, mode: 'create' });
  };

  const openEdit = (record: FaqRow) => {
    form.setFieldsValue(record);
    setModal({ open: true, mode: 'edit', record });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (modal.mode === 'create') {
        await api.post('/api/admin/faq', values);
        message.success('新增成功');
      } else {
        await api.patch(`/api/admin/faq/${modal.record!.id}`, values);
        message.success('更新成功');
      }
      setModal({ open: false, mode: 'create' });
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/admin/faq/${id}`);
      message.success('已刪除');
      fetchData();
    } catch {
      message.error('刪除失敗');
    }
  };

  const handleToggle = async (record: FaqRow, checked: boolean) => {
    try {
      await api.patch(`/api/admin/faq/${record.id}`, { isActive: checked });
      setRows((prev) => prev.map((r) => (r.id === record.id ? { ...r, isActive: checked } : r)));
    } catch {
      message.error('更新失敗');
    }
  };

  const columns: ColumnsType<FaqRow> = [
    {
      title: '關鍵字',
      dataIndex: 'keyword',
      key: 'keyword',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '問題說明',
      dataIndex: 'question',
      key: 'question',
      width: 180,
    },
    {
      title: '回覆內容',
      dataIndex: 'answer',
      key: 'answer',
      render: (v: string) => (
        <Text style={{ whiteSpace: 'pre-wrap' }} ellipsis={{ tooltip: v }}>
          {v}
        </Text>
      ),
    },
    {
      title: '優先度',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      sorter: (a, b) => a.priority - b.priority,
      defaultSortOrder: 'descend',
    },
    {
      title: '啟用',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 70,
      render: (v: boolean, record) => (
        <Switch
          checked={v}
          size="small"
          onChange={(checked) => handleToggle(record, checked)}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          />
          <Popconfirm
            title="確定刪除這筆問答？"
            onConfirm={() => handleDelete(record.id)}
            okText="刪除"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>LINE 自動回覆管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增問答
        </Button>
      </div>

      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        家屬在 LINE 傳送訊息時，系統會比對「關鍵字」欄位，優先度數字越高越先比對。
      </Text>

      <Table
        rowKey="id"
        dataSource={rows}
        columns={columns}
        pagination={{ pageSize: 15 }}
        size="middle"
      />

      <Modal
        title={modal.mode === 'create' ? '新增問答' : '編輯問答'}
        open={modal.open}
        onCancel={() => setModal({ open: false, mode: 'create' })}
        onOk={handleSave}
        confirmLoading={saving}
        okText="儲存"
        cancelText="取消"
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="keyword"
            label="關鍵字"
            rules={[{ required: true, message: '請填寫關鍵字' }]}
            extra="家屬輸入訊息包含此關鍵字時觸發，例如：收費、探訪、停車"
          >
            <Input placeholder="收費" />
          </Form.Item>
          <Form.Item
            name="question"
            label="問題說明"
            rules={[{ required: true, message: '請填寫問題說明' }]}
          >
            <Input placeholder="收費標準是什麼？" />
          </Form.Item>
          <Form.Item
            name="answer"
            label="回覆內容"
            rules={[{ required: true, message: '請填寫回覆內容' }]}
          >
            <TextArea
              rows={4}
              placeholder="本院收費標準如下：&#10;・單人房：每月 NT$..."
              style={{ whiteSpace: 'pre-wrap' }}
            />
          </Form.Item>
          <Form.Item name="priority" label="優先度（數字越高越先比對）">
            <InputNumber min={0} max={100} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="isActive" label="啟用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
