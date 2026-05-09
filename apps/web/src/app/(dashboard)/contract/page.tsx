'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Typography, Table, Card, Row, Col, Statistic, Tag, Select, Space, Spin, message,
  Button, Input, Tabs, Modal, Tooltip, Form, Popconfirm, Upload, Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FileProtectOutlined, WarningOutlined, CheckCircleOutlined,
  SendOutlined, EyeOutlined, DownloadOutlined, NotificationOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { CONTRACT_STATUS } from '@careflow/shared';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';

const { Title } = Typography;
const { Search } = Input;

interface ContractRow {
  id: string;
  residentName: string;
  signerName: string;
  templateTitle: string;
  status: string;
  expiresAt: string;
  signedAt: string | null;
  building: string;
  floor: number;
  createdAt: string;
  pdfPath: string | null;
}

interface TemplateRow {
  id: string;
  title: string;
  version: string;
  contentHtml: string;
  isActive: boolean;
  createdAt: string;
}

interface StatsData {
  pendingThisMonth: number;
  expiringSoon: number;
  completed: number;
}

function getTrafficLight(status: string, expiresAt: string): { color: string; label: string } {
  if (status === CONTRACT_STATUS.COMPLETED) {
    return { color: 'green', label: '已完成' };
  }
  if (status === CONTRACT_STATUS.REJECTED) {
    return { color: 'orange', label: '已拒絕（紙本）' };
  }
  if (status === CONTRACT_STATUS.EXPIRED || dayjs(expiresAt).isBefore(dayjs())) {
    return { color: 'red', label: '過期' };
  }
  if (dayjs(expiresAt).diff(dayjs(), 'day') <= 30) {
    return { color: 'gold', label: '即將到期' };
  }
  return { color: 'green', label: '效期內' };
}

export default function ContractPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [stats, setStats] = useState<StatsData>({ pendingThisMonth: 0, expiringSoon: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [filterBuilding, setFilterBuilding] = useState<string | undefined>();
  const [filterFloor, setFilterFloor] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchRemindLoading, setBatchRemindLoading] = useState(false);
  const [tplModal, setTplModal] = useState<{ visible: boolean; editing: TemplateRow | null }>({
    visible: false, editing: null,
  });
  const [tplForm] = Form.useForm();
  const [uploading, setUploading] = useState(false);

  const quillModules = useMemo(() => ({
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['clean'],
    ],
  }), []);

  const fetchData = useCallback(async () => {
    try {
      const [listRes, statsRes, tplRes] = await Promise.all([
        api.get('/api/admin/contracts', { params: { pageSize: 200 } }),
        api.get('/api/admin/contracts/stats'),
        api.get('/api/admin/contracts/templates'),
      ]);
      const payload = listRes.data.items ?? listRes.data.data ?? listRes.data;
      setContracts(Array.isArray(payload) ? payload : payload.items ?? []);
      setStats(statsRes.data?.data ?? statsRes.data ?? { pendingThisMonth: 0, expiringSoon: 0, completed: 0 });
      setTemplates(Array.isArray(tplRes.data) ? tplRes.data : tplRes.data?.items ?? []);
    } catch {
      message.error('載入合約資料失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const computedStats: StatsData = stats.pendingThisMonth || stats.expiringSoon || stats.completed
    ? stats
    : {
        pendingThisMonth: contracts.filter(
          (c) => c.status === CONTRACT_STATUS.PENDING && dayjs(c.createdAt).isSame(dayjs(), 'month'),
        ).length,
        expiringSoon: contracts.filter(
          (c) => c.status !== CONTRACT_STATUS.EXPIRED
            && dayjs(c.expiresAt).diff(dayjs(), 'day') <= 30
            && dayjs(c.expiresAt).isAfter(dayjs()),
        ).length,
        completed: contracts.filter((c) => c.status === CONTRACT_STATUS.COMPLETED).length,
      };

  const buildings = Array.from(new Set(contracts.map((c) => c.building).filter(Boolean)));
  const floors = Array.from(
    new Set(contracts.map((c) => c.floor).filter((f): f is number => f != null)),
  ).sort((a, b) => a - b);

  const filtered = contracts.filter((c) => {
    if (filterBuilding && c.building !== filterBuilding) return false;
    if (filterFloor != null && c.floor !== filterFloor) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!c.residentName?.toLowerCase().includes(q)
        && !c.signerName?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleResend = async (record: ContractRow) => {
    Modal.confirm({
      title: '重發催簽通知',
      content: `確定要重新發送催簽通知給 ${record.signerName} 嗎？`,
      okText: '確認發送',
      onOk: async () => {
        try {
          await api.post('/api/admin/contracts/batch-remind', { contractIds: [record.id] });
          message.success('已重新發送');
        } catch {
          message.error('發送失敗');
        }
      },
    });
  };

  const handleBatchRemind = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('請先勾選合約');
      return;
    }
    Modal.confirm({
      title: '批次發送催簽通知',
      content: `將發送催簽通知給 ${selectedRowKeys.length} 筆合約的家屬，是否繼續？`,
      okText: '確認發送',
      onOk: async () => {
        setBatchRemindLoading(true);
        try {
          await api.post('/api/admin/contracts/batch-remind', {
            contractIds: selectedRowKeys.map(String),
          });
          message.success('批次通知已發送');
          setSelectedRowKeys([]);
        } catch {
          message.error('批次通知發送失敗');
        } finally {
          setBatchRemindLoading(false);
        }
      },
    });
  };

  const handlePreviewPdf = (record: ContractRow) => {
    if (!record.pdfPath) {
      message.info('此合約尚未產出 PDF（TWCA 串接完成後可使用）');
      return;
    }
    window.open(record.pdfPath, '_blank');
  };

  const handleDownloadPdf = (record: ContractRow) => {
    if (!record.pdfPath) {
      message.info('此合約尚未產出 PDF（TWCA 串接完成後可使用）');
      return;
    }
    const link = document.createElement('a');
    link.href = record.pdfPath;
    link.download = `${record.residentName}_合約.pdf`;
    link.click();
  };

  const columns: ColumnsType<ContractRow> = [
    {
      title: '狀態燈號', key: 'light', width: 90, align: 'center',
      render: (_, record) => {
        const light = getTrafficLight(record.status, record.expiresAt);
        return <Tag color={light.color}>{light.label}</Tag>;
      },
    },
    { title: '住民姓名', dataIndex: 'residentName', key: 'residentName', width: 110 },
    { title: '簽署人', dataIndex: 'signerName', key: 'signerName', width: 110 },
    { title: '合約名稱', dataIndex: 'templateTitle', key: 'templateTitle' },
    { title: '棟別', dataIndex: 'building', key: 'building', width: 80 },
    { title: '樓層', dataIndex: 'floor', key: 'floor', width: 70, render: (f: number) => f != null ? `${f}F` : '-' },
    {
      title: '到期日', dataIndex: 'expiresAt', key: 'expiresAt', width: 120,
      render: (d: string) => dayjs(d).format('YYYY/MM/DD'),
    },
    {
      title: '簽署日', dataIndex: 'signedAt', key: 'signedAt', width: 120,
      render: (d: string | null) => (d ? dayjs(d).format('YYYY/MM/DD') : '-'),
    },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === CONTRACT_STATUS.COMPLETED ? (
            <>
              <Tooltip title="預覽 PDF">
                <Button size="small" type="text" icon={<EyeOutlined />}
                  onClick={() => handlePreviewPdf(record)} />
              </Tooltip>
              <Tooltip title="下載 PDF">
                <Button size="small" type="text" icon={<DownloadOutlined />}
                  onClick={() => handleDownloadPdf(record)} />
              </Tooltip>
            </>
          ) : (
            <Tooltip title="重發催簽通知">
              <Button size="small" type="text" icon={<NotificationOutlined />}
                onClick={() => handleResend(record)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const openCreateTpl = () => {
    tplForm.resetFields();
    setTplModal({ visible: true, editing: null });
  };

  const openEditTpl = (record: TemplateRow) => {
    tplForm.setFieldsValue({
      title: record.title,
      version: record.version,
      contentHtml: record.contentHtml,
    });
    setTplModal({ visible: true, editing: record });
  };

  const submitTpl = async () => {
    try {
      const values = await tplForm.validateFields();
      if (tplModal.editing) {
        await api.patch(`/api/admin/contracts/templates/${tplModal.editing.id}`, values);
        message.success('範本已更新');
      } else {
        await api.post('/api/admin/contracts/templates', values);
        message.success('範本已新增');
      }
      setTplModal({ visible: false, editing: null });
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('儲存失敗');
    }
  };

  const deleteTpl = async (id: string) => {
    try {
      await api.delete(`/api/admin/contracts/templates/${id}`);
      message.success('範本已刪除（若有合約使用則已改為停用）');
      fetchData();
    } catch {
      message.error('刪除失敗');
    }
  };

  const templateColumns: ColumnsType<TemplateRow> = [
    { title: '合約名稱', dataIndex: 'title', key: 'title' },
    { title: '版本', dataIndex: 'version', key: 'version', width: 100 },
    {
      title: '狀態', dataIndex: 'isActive', key: 'isActive', width: 90,
      render: (a: boolean) => a
        ? <Tag color="success">啟用中</Tag>
        : <Tag color="default">停用</Tag>,
    },
    {
      title: '建立日期', dataIndex: 'createdAt', key: 'createdAt',
      width: 140, render: (d: string) => dayjs(d).format('YYYY/MM/DD'),
    },
    {
      title: '操作', key: 'action', width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditTpl(record)}>
            編輯
          </Button>
          <Popconfirm title="確定刪除此範本？" onConfirm={() => deleteTpl(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={4}>合約簽署管理</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="本月待簽署" value={computedStats.pendingThisMonth}
              prefix={<FileProtectOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="即將到期" value={computedStats.expiringSoon}
              prefix={<WarningOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="已完成" value={computedStats.completed}
              prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="list"
        items={[
          {
            key: 'list',
            label: '合約清單',
            children: (
              <>
                <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
                  <Space wrap>
                    <Select placeholder="篩選棟別" allowClear style={{ width: 120 }}
                      onChange={setFilterBuilding}
                      options={buildings.map((b) => ({ label: b, value: b }))} />
                    <Select placeholder="篩選樓層" allowClear style={{ width: 120 }}
                      onChange={setFilterFloor}
                      options={floors.map((f) => ({ label: `${f}F`, value: f }))} />
                    <Select placeholder="篩選狀態" allowClear style={{ width: 120 }}
                      onChange={setFilterStatus}
                      options={[
                        { label: '待簽署', value: CONTRACT_STATUS.PENDING },
                        { label: '已完成', value: CONTRACT_STATUS.COMPLETED },
                        { label: '已拒絕（紙本）', value: CONTRACT_STATUS.REJECTED },
                        { label: '過期', value: CONTRACT_STATUS.EXPIRED },
                      ]} />
                    <Search placeholder="搜尋長者/家屬姓名" allowClear style={{ width: 220 }}
                      onSearch={setSearchText} />
                  </Space>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    disabled={selectedRowKeys.length === 0}
                    loading={batchRemindLoading}
                    onClick={handleBatchRemind}
                  >
                    批次發送催簽通知（{selectedRowKeys.length}）
                  </Button>
                </Space>

                <Table<ContractRow>
                  rowKey="id"
                  rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                    getCheckboxProps: (r) => ({ disabled: r.status === CONTRACT_STATUS.COMPLETED }),
                  }}
                  columns={columns}
                  dataSource={filtered}
                  pagination={{ pageSize: 15, showSizeChanger: true }}
                  scroll={{ x: 1100 }}
                />
              </>
            ),
          },
          {
            key: 'templates',
            label: `合約範本（${templates.length}）`,
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateTpl}>
                    新增範本（編輯器）
                  </Button>
                  <Upload
                    accept=".docx"
                    showUploadList={false}
                    beforeUpload={async (file) => {
                      const title = window.prompt('請輸入合約名稱：');
                      if (!title) return false;
                      const version = window.prompt('請輸入版本號（如 V1.0）：') || 'V1.0';
                      setUploading(true);
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('title', title);
                        formData.append('version', version);
                        await api.post('/api/admin/contracts/templates/upload', formData);
                        message.success('Word 檔案已上傳並轉換為合約範本');
                        fetchData();
                      } catch {
                        message.error('上傳失敗');
                      } finally {
                        setUploading(false);
                      }
                      return false;
                    }}
                  >
                    <Button icon={<UploadOutlined />} loading={uploading}>
                      上傳 Word 檔
                    </Button>
                  </Upload>
                </Space>
                <Table<TemplateRow>
                  rowKey="id"
                  columns={templateColumns}
                  dataSource={templates}
                  pagination={false}
                  locale={{ emptyText: '尚無合約範本' }}
                />
              </>
            ),
          },
        ]}
      />

      <Modal
        title={tplModal.editing ? '編輯合約範本' : '新增合約範本'}
        open={tplModal.visible}
        onOk={submitTpl}
        onCancel={() => setTplModal({ visible: false, editing: null })}
        okText="儲存"
        width={720}
      >
        <Form form={tplForm} layout="vertical">
          <Form.Item name="title" label="合約名稱" rules={[{ required: true, message: '請填寫合約名稱' }]}>
            <Input placeholder="例如：長期照護服務同意書" />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true, message: '請填寫版本' }]}>
            <Input placeholder="例如：V1.0" />
          </Form.Item>
          <Form.Item
            name="contentHtml"
            label="合約內容"
            rules={[{ required: true, message: '請填寫合約內容' }]}
            valuePropName="value"
            getValueFromEvent={(val: string) => val}
          >
            <ReactQuill theme="snow" modules={quillModules} style={{ minHeight: 250 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
