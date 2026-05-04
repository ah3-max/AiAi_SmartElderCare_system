'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography, Table, Card, Row, Col, Statistic, Button, Tag, Spin, message,
  Tabs, Modal, InputNumber, Form, Space, DatePicker,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { TeamOutlined, CheckCircleOutlined, SettingOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/lib/api';

const { Title } = Typography;

interface ZoneSummary {
  zoneLabel: string;
  totalVisitors: number;
  checkedInCount: number;
}

interface VisitRow {
  id: string;
  visitorName: string;
  residentName: string;
  zoneLabel: string;
  visitDate: string;
  timeSlot: string;
  guestCount: number;
  checkedIn: boolean;
}

interface DashboardData {
  zones: ZoneSummary[];
  reservations: VisitRow[];
}

interface Zone {
  id: string;
  building: string;
  floor: number;
  label: string;
  maxVisitorsPerSlot: number;
}

interface NoShowRow {
  lineUserId: string;
  visitorName: string;
  noShowCount: number;
  lastVisitDate: string;
}

export default function VisitPage() {
  const [data, setData] = useState<DashboardData>({ zones: [], reservations: [] });
  const [loading, setLoading] = useState(true);
  const [noShow, setNoShow] = useState<NoShowRow[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [capacityModal, setCapacityModal] = useState<{ id: string; label: string; visible: boolean }>({
    id: '', label: '', visible: false,
  });
  const [capacityValue, setCapacityValue] = useState<number>(1);
  const [queryDate, setQueryDate] = useState(dayjs());

  const fetchData = useCallback(async (date = queryDate) => {
    try {
      const [dashRes, noShowRes, zonesRes] = await Promise.all([
        api.get('/api/admin/visits/dashboard', {
          params: { date: date.format('YYYY-MM-DD') },
        }),
        api.get('/api/admin/visits/no-show'),
        api.get('/api/admin/visits/zones'),
      ]);
      // dashboard API returns array: [{ zoneId, label, totalReservations, checkedIn, reservations }]
      const dashArr = Array.isArray(dashRes.data) ? dashRes.data : dashRes.data?.items ?? [];
      const zones: ZoneSummary[] = dashArr.map((z: any) => ({
        zoneLabel: z.label,
        totalVisitors: z.totalReservations ?? 0,
        checkedInCount: z.checkedIn ?? 0,
      }));
      const reservations: VisitRow[] = dashArr.flatMap((z: any) =>
        (z.reservations ?? []).map((r: any) => ({
          id: r.id,
          visitorName: r.visitorName,
          residentName: r.resident?.name ?? r.residentName ?? '',
          zoneLabel: z.label,
          visitDate: r.visitDate,
          timeSlot: r.timeSlot?.startTime
            ? `${r.timeSlot.startTime}-${r.timeSlot.endTime}`
            : (r.timeSlot ?? ''),
          guestCount: r.guestCount,
          checkedIn: r.checkedIn,
        })),
      );
      setData({ zones, reservations });
      setNoShow(Array.isArray(noShowRes.data) ? noShowRes.data : noShowRes.data?.items ?? []);
      setZones(Array.isArray(zonesRes.data) ? zonesRes.data : zonesRes.data?.items ?? []);
    } catch {
      message.error('載入探訪資料失敗');
    } finally {
      setLoading(false);
    }
  }, [queryDate]);

  useEffect(() => {
    fetchData(queryDate);
  }, [fetchData, queryDate]);

  const handleCheckin = async (id: string) => {
    try {
      await api.patch(`/api/admin/visits/${id}/checkin`);
      message.success('報到成功');
      setData((prev) => ({
        ...prev,
        reservations: prev.reservations.map((r) => (r.id === id ? { ...r, checkedIn: true } : r)),
      }));
    } catch {
      message.error('報到失敗');
    }
  };

  const openCapacityModal = (zone: Zone) => {
    setCapacityModal({ id: zone.id, label: zone.label, visible: true });
    setCapacityValue(zone.maxVisitorsPerSlot);
  };

  const submitCapacity = async () => {
    try {
      await api.patch(`/api/admin/visits/zones/${capacityModal.id}/capacity`, {
        maxVisitorsPerSlot: capacityValue,
      });
      message.success('容量更新成功');
      setCapacityModal({ id: '', label: '', visible: false });
      fetchData();
    } catch {
      message.error('容量更新失敗');
    }
  };

  const columns: ColumnsType<VisitRow> = [
    { title: '訪客姓名', dataIndex: 'visitorName', key: 'visitorName', width: 120 },
    { title: '探訪住民', dataIndex: 'residentName', key: 'residentName', width: 120 },
    { title: '區域', dataIndex: 'zoneLabel', key: 'zoneLabel', width: 120 },
    {
      title: '探訪日期', dataIndex: 'visitDate', key: 'visitDate', width: 120,
      render: (d: string) => dayjs(d).format('YYYY/MM/DD'),
    },
    { title: '時段', dataIndex: 'timeSlot', key: 'timeSlot', width: 120 },
    { title: '訪客人數', dataIndex: 'guestCount', key: 'guestCount', width: 90, align: 'center' },
    {
      title: '狀態', dataIndex: 'checkedIn', key: 'checkedIn', width: 100,
      render: (checked: boolean) =>
        checked
          ? <Tag color="success" icon={<CheckCircleOutlined />}>已報到</Tag>
          : <Tag color="default">未報到</Tag>,
    },
    {
      title: '操作', key: 'action', width: 100,
      render: (_, record) =>
        !record.checkedIn
          ? <Button type="primary" size="small" onClick={() => handleCheckin(record.id)}>報到</Button>
          : null,
    },
  ];

  const noShowColumns: ColumnsType<NoShowRow> = [
    { title: '訪客姓名', dataIndex: 'visitorName', key: 'visitorName' },
    { title: 'Line 帳號', dataIndex: 'lineUserId', key: 'lineUserId', ellipsis: true },
    {
      title: '未出現次數', dataIndex: 'noShowCount', key: 'noShowCount',
      render: (n: number) => <Tag color="red">{n} 次</Tag>,
    },
    {
      title: '最後預約日期', dataIndex: 'lastVisitDate', key: 'lastVisitDate',
      render: (d: string) => d ? dayjs(d).format('YYYY/MM/DD') : '—',
    },
  ];

  const zoneColumns: ColumnsType<Zone> = [
    { title: '棟別', dataIndex: 'building', key: 'building', width: 80 },
    { title: '樓層', dataIndex: 'floor', key: 'floor', width: 80, render: (f: number) => `${f}F` },
    { title: '區域名稱', dataIndex: 'label', key: 'label' },
    {
      title: '每時段上限人數', dataIndex: 'maxVisitorsPerSlot', key: 'maxVisitorsPerSlot', width: 140,
      render: (n: number) => <Tag color="blue">{n} 人</Tag>,
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_, record) => (
        <Button size="small" icon={<SettingOutlined />} onClick={() => openCapacityModal(record)}>
          調整容量
        </Button>
      ),
    },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={4}>探訪預約管理</Title>

      <Tabs
        defaultActiveKey="today"
        items={[
          {
            key: 'today',
            label: '今日探訪',
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <span>查詢日期：</span>
                  <DatePicker
                    value={queryDate}
                    onChange={(d) => d && setQueryDate(d)}
                    allowClear={false}
                  />
                </Space>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  {data.zones.map((zone) => (
                    <Col xs={12} sm={8} md={6} key={zone.zoneLabel}>
                      <Card size="small">
                        <Statistic
                          title={zone.zoneLabel}
                          value={zone.checkedInCount}
                          suffix={`/ ${zone.totalVisitors}`}
                          prefix={<TeamOutlined />}
                        />
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                          已報到 / 預約人數
                        </div>
                      </Card>
                    </Col>
                  ))}
                  {data.zones.length === 0 && (
                    <Col span={24}>
                      <Card size="small">
                        <div style={{ textAlign: 'center', color: '#999' }}>今日無探訪預約</div>
                      </Card>
                    </Col>
                  )}
                </Row>
                <Table<VisitRow>
                  rowKey="id"
                  columns={columns}
                  dataSource={data.reservations}
                  pagination={{ pageSize: 15, showSizeChanger: true }}
                  scroll={{ x: 800 }}
                />
              </>
            ),
          },
          {
            key: 'noshow',
            label: (
              <span>
                <WarningOutlined /> 三次未出現名單（{noShow.length}）
              </span>
            ),
            children: (
              <Table<NoShowRow>
                rowKey="lineUserId"
                columns={noShowColumns}
                dataSource={noShow}
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: '目前無未出現記錄' }}
              />
            ),
          },
          {
            key: 'capacity',
            label: <span><SettingOutlined /> 分樓層容量設定</span>,
            children: (
              <Table<Zone>
                rowKey="id"
                columns={zoneColumns}
                dataSource={zones}
                pagination={false}
                size="middle"
              />
            ),
          },
        ]}
      />

      <Modal
        title={`調整容量：${capacityModal.label}`}
        open={capacityModal.visible}
        onOk={submitCapacity}
        onCancel={() => setCapacityModal({ id: '', label: '', visible: false })}
        okText="儲存"
      >
        <Form layout="vertical">
          <Form.Item label="每時段最大探訪人數">
            <InputNumber
              min={1}
              max={50}
              value={capacityValue}
              onChange={(v) => setCapacityValue(v ?? 1)}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <div style={{ fontSize: 12, color: '#999' }}>
            調整後將立即生效，已有預約不受影響。
          </div>
        </Form>
      </Modal>
    </div>
  );
}
