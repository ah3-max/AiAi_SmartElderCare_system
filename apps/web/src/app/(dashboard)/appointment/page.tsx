'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography, Tag, Spin, Card, Badge, message, Button, Modal, Select, Space,
  Form, Input, DatePicker, TimePicker, Alert,
} from 'antd';
import { MedicineBoxOutlined, CarOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/lib/api';
import { APPOINTMENT_STATUS } from '@careflow/shared';

const { Title, Text } = Typography;

interface AppointmentRow {
  id: string;
  resident?: { id: string; name: string; building: string; floor: number };
  apptDate: string;
  apptTime: string;
  hospital: string;
  department: string;
  status: string;
  response?: {
    responseSelection: string;
    needsTransport: boolean;
    vehicleType?: string | null;
    vehicleArrangedAt?: string | null;
  } | null;
}

interface ResidentOption {
  id: string;
  name: string;
  building: string;
  floor: number;
  roomNo: string;
}

const COLUMNS = [
  { key: 'pending', title: '待處理', statuses: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.NOTIFIED], color: '#faad14' },
  { key: 'arranged', title: '已安排', statuses: [APPOINTMENT_STATUS.CONFIRMED], color: '#52c41a' },
  { key: 'closed', title: '已結案', statuses: [APPOINTMENT_STATUS.CANCELLED], color: '#8c8c8c' },
];

// 車種費用標準（示意值，正式上線由機構提供）
const VEHICLE_OPTIONS = [
  { label: '一般計程車', value: '一般計程車', fee: '起跳 NT$85，每公里 NT$25' },
  { label: '無障礙計程車', value: '無障礙計程車', fee: '起跳 NT$100，每公里 NT$30' },
  { label: '復康巴士', value: '復康巴士', fee: '依里程 NT$20/公里，需預約' },
  { label: '機構車輛', value: '機構車輛', fee: '免費（機構內部安排）' },
];

export default function AppointmentPage() {
  const [data, setData] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicleModal, setVehicleModal] = useState<{ id: string; visible: boolean }>({ id: '', visible: false });
  const [vehicleType, setVehicleType] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [residents, setResidents] = useState<ResidentOption[]>([]);
  const [createForm] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/appointments');
      const raw = res.data.items ?? res.data.data ?? res.data;
      setData(Array.isArray(raw) ? raw : []);
    } catch {
      message.error('載入就診資料失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchResidents = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/appointments/residents');
      setResidents(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchResidents();
  }, [fetchData, fetchResidents]);

  const isUrgent = (row: AppointmentRow) => {
    if (!row.apptDate || !row.apptTime) return false;
    const apptDay = dayjs(`${row.apptDate.split('T')[0]} ${row.apptTime}`);
    const vehicleTime = row.response?.vehicleArrangedAt ? dayjs(row.response.vehicleArrangedAt) : null;
    if (!vehicleTime) {
      // 若無派車資料但需機構協助且距就診不到 1 天也視為緊急
      if (row.response?.responseSelection === 'NEED_ASSISTANCE') {
        return apptDay.diff(dayjs(), 'hour') < 24;
      }
      return false;
    }
    return apptDay.diff(vehicleTime, 'hour') < 24;
  };

  const handleArrangeVehicle = async () => {
    if (!vehicleType) {
      message.warning('請先選擇車種');
      return;
    }
    try {
      await api.patch(`/api/admin/appointments/${vehicleModal.id}/vehicle`, { vehicleType });
      message.success('派車安排完成');
      setVehicleModal({ id: '', visible: false });
      setVehicleType('');
      fetchData();
    } catch {
      message.error('派車安排失敗');
    }
  };

  const handleCreate = async () => {
    try {
      const v = await createForm.validateFields();
      await api.post('/api/admin/appointments', {
        residentId: v.residentId,
        apptDate: v.apptDate.format('YYYY-MM-DD'),
        apptTime: v.apptTime.format('HH:mm'),
        hospital: v.hospital,
        department: v.department,
      });
      message.success('就診安排建立成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('建立失敗');
    }
  };

  const renderCard = (item: AppointmentRow) => {
    const urgent = isUrgent(item);
    const dateStr = item.apptDate ? dayjs(item.apptDate).format('MM/DD') : '';
    const resName = item.resident?.name ?? '未知';
    const responseLabel = item.response?.responseSelection === 'SELF_ACCOMPANY'
      ? '家屬自行陪同'
      : item.response?.responseSelection === 'NEED_ASSISTANCE'
        ? '需機構協助'
        : null;

    return (
      <Card
        key={item.id}
        size="small"
        style={{
          marginBottom: 8,
          borderLeft: urgent ? '3px solid #ff4d4f' : '3px solid #d9d9d9',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>{resName}</Text>
          {urgent && <Tag color="red">緊急</Tag>}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
          <MedicineBoxOutlined style={{ marginRight: 4 }} />
          {dateStr} {item.apptTime} · {item.hospital} {item.department}
        </div>
        {item.resident && (
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
            {item.resident.building}棟 {item.resident.floor}F
          </div>
        )}
        {responseLabel && (
          <Tag style={{ marginTop: 4 }} color={item.response?.responseSelection === 'NEED_ASSISTANCE' ? 'orange' : 'blue'}>
            {responseLabel}
          </Tag>
        )}
        {item.response?.vehicleType && (
          <Tag style={{ marginTop: 4 }} icon={<CarOutlined />} color="green">
            {item.response.vehicleType}
          </Tag>
        )}
        {item.response?.responseSelection === 'NEED_ASSISTANCE' && !item.response.vehicleType && (
          <Button
            size="small"
            type="link"
            icon={<CarOutlined />}
            style={{ marginTop: 4, padding: 0 }}
            onClick={() => setVehicleModal({ id: item.id, visible: true })}
          >
            安排派車
          </Button>
        )}
      </Card>
    );
  };

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
        <Title level={4} style={{ margin: 0 }}>就診通知管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          新增就診安排
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16, overflowX: 'auto' }}>
        {COLUMNS.map((col) => {
          const items = data.filter((d) => (col.statuses as string[]).includes(d.status));
          return (
            <div
              key={col.key}
              style={{ flex: 1, minWidth: 280, background: '#fafafa', borderRadius: 8, padding: 12 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <Badge color={col.color} />
                <Text strong style={{ marginLeft: 8 }}>{col.title}</Text>
                <Tag style={{ marginLeft: 8 }}>{items.length}</Tag>
              </div>
              <div style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                {items.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>暫無資料</Text>
                ) : (
                  items.map(renderCard)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 派車安排 Modal */}
      <Modal
        title="安排派車"
        open={vehicleModal.visible}
        onOk={handleArrangeVehicle}
        onCancel={() => { setVehicleModal({ id: '', visible: false }); setVehicleType(''); }}
        okText="確認安排"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            placeholder="選擇車種"
            style={{ width: '100%' }}
            value={vehicleType || undefined}
            onChange={setVehicleType}
            options={VEHICLE_OPTIONS.map(({ label, value }) => ({ label, value }))}
          />
          {vehicleType && (
            <Alert
              type="info"
              showIcon
              message="車種費用參考"
              description={VEHICLE_OPTIONS.find((v) => v.value === vehicleType)?.fee}
            />
          )}
          <div style={{ fontSize: 12, color: '#999' }}>
            費用僅供參考，實際費率以各車行/機構公告為準。
          </div>
        </Space>
      </Modal>

      {/* 新增就診 Modal */}
      <Modal
        title="新增就診安排"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        okText="建立"
        width={560}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="residentId" label="長者" rules={[{ required: true, message: '請選擇長者' }]}>
            <Select
              showSearch
              placeholder="選擇長者"
              optionFilterProp="label"
              options={residents.map((r) => ({
                label: `${r.name}（${r.building}棟 ${r.floor}F ${r.roomNo}）`,
                value: r.id,
              }))}
            />
          </Form.Item>
          <Space.Compact block>
            <Form.Item name="apptDate" label="就診日期" rules={[{ required: true }]} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d < dayjs().startOf('day')} />
            </Form.Item>
            <Form.Item name="apptTime" label="就診時間" rules={[{ required: true }]} style={{ flex: 1, marginLeft: 8 }}>
              <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={15} />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="hospital" label="醫院" rules={[{ required: true, message: '請填寫醫院名稱' }]}>
            <Input placeholder="例如：台北榮總" />
          </Form.Item>
          <Form.Item name="department" label="科別" rules={[{ required: true, message: '請填寫科別' }]}>
            <Input placeholder="例如：心臟內科" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
