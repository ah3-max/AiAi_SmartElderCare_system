'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography, Card, Row, Col, Tag, Spin, message, Table, Tabs, Tooltip,
  Modal, Form, Input, InputNumber, Button,
} from 'antd';
import {
  PhoneOutlined, CalendarOutlined, HomeOutlined, WarningFilled, CheckCircleOutlined,
} from '@ant-design/icons';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import api from '@/lib/api';
import { ADMISSION_STATUS, maskPhone } from '@careflow/shared';
import dayjs from 'dayjs';

ChartJS.register(ArcElement, ChartTooltip, Legend);

const { Title } = Typography;

const COLUMNS = [
  { key: ADMISSION_STATUS.NEW, title: '新申請', color: '#1677ff' },
  { key: ADMISSION_STATUS.CONTACTED, title: '已聯繫', color: '#faad14' },
  { key: ADMISSION_STATUS.WAITLISTED, title: '候補中', color: '#722ed1' },
  { key: ADMISSION_STATUS.ADMITTED, title: '安排入住', color: '#52c41a' },
];

const ROOM_LABEL: Record<string, string> = {
  SINGLE: '單人房',
  DOUBLE: '雙人房',
  SHARED: '多人房',
  single: '單人房',
  double: '雙人房',
  shared: '多人房',
};

const TAG_LABEL: Record<string, string> = {
  nasogastric_tube: '鼻胃管',
  urinary_catheter: '導尿管',
  tracheostomy: '氣切',
  dialysis: '洗腎',
  dementia_wandering: '失智遊走',
};

interface ApplicantRow {
  id: string;
  applicantName: string;
  contactPhone: string;
  status: string;
  preferredRoom: string;
  expectedDate: string | null;
  referralSource: string | null;
  updatedAt: string;
  seniorAssessment?: {
    seniorName: string;
    medicalTags: string[];
  } | null;
}

interface AdmitModal {
  open: boolean;
  applicantId: string;
  seniorName: string;
}

export default function AdmissionPage() {
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [ineligible, setIneligible] = useState<ApplicantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [admitModal, setAdmitModal] = useState<AdmitModal>({ open: false, applicantId: '', seniorName: '' });
  const [admitLoading, setAdmitLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      const [listRes, ineligibleRes] = await Promise.all([
        api.get('/api/admin/admissions', { params: { pageSize: 100 } }),
        api.get('/api/admin/admissions/ineligible'),
      ]);
      const payload = listRes.data?.items ?? listRes.data?.data?.items ?? listRes.data ?? [];
      setApplicants(Array.isArray(payload) ? payload : payload.items ?? []);
      setIneligible(Array.isArray(ineligibleRes.data) ? ineligibleRes.data : ineligibleRes.data?.items ?? []);
    } catch {
      message.error('載入入住申請資料失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: applicants.filter((a) => a.status === col.key),
  }));

  const openAdmitModal = (applicant: ApplicantRow) => {
    setAdmitModal({
      open: true,
      applicantId: applicant.id,
      seniorName: applicant.seniorAssessment?.seniorName ?? applicant.applicantName,
    });
    form.resetFields();
  };

  const handleAdmitConfirm = async () => {
    try {
      const values = await form.validateFields();
      setAdmitLoading(true);
      await api.post(`/api/admin/admissions/${admitModal.applicantId}/admit`, {
        building: values.building,
        floor: values.floor,
        roomNo: values.roomNo,
        idNumber: values.idNumber || undefined,
      });
      message.success(`${admitModal.seniorName} 已安排入住，長者主檔與家屬綁定已建立`);
      setAdmitModal({ open: false, applicantId: '', seniorName: '' });
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return; // form validation error
      message.error(err?.response?.data?.message || '安排入住失敗');
    } finally {
      setAdmitLoading(false);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;

    // 拖到「安排入住」欄需額外填床位資訊，攔截開 Modal
    if (newStatus === ADMISSION_STATUS.ADMITTED) {
      const target = applicants.find((a) => a.id === draggableId);
      if (target) openAdmitModal(target);
      return;
    }

    setApplicants((prev) =>
      prev.map((a) => (a.id === draggableId ? { ...a, status: newStatus } : a)),
    );

    try {
      await api.patch(`/api/admin/admissions/${draggableId}/status`, { status: newStatus });
      message.success('狀態已更新');
    } catch (err: any) {
      message.error(err?.response?.data?.message || '更新狀態失敗');
      fetchData();
    }
  };

  const referralCounts: Record<string, number> = {};
  applicants.forEach((a) => {
    const src = a.referralSource || '未填寫';
    referralCounts[src] = (referralCounts[src] || 0) + 1;
  });

  const pieData = {
    labels: Object.keys(referralCounts),
    datasets: [
      {
        data: Object.values(referralCounts),
        backgroundColor: ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96'],
      },
    ],
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  const renderCard = (item: ApplicantRow, dragProvided: any) => {
    const tags = item.seniorAssessment?.medicalTags ?? [];
    const hasWarning = tags.length > 0;
    const canAdmit = item.status === ADMISSION_STATUS.WAITLISTED || item.status === ADMISSION_STATUS.CONTACTED;
    return (
      <Card
        ref={dragProvided.innerRef}
        {...dragProvided.draggableProps}
        {...dragProvided.dragHandleProps}
        size="small"
        style={{
          marginBottom: 8,
          cursor: 'grab',
          borderLeft: hasWarning ? '3px solid #ff4d4f' : undefined,
          ...dragProvided.draggableProps.style,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasWarning && (
            <Tooltip title={`特殊照護：${tags.map((t) => TAG_LABEL[t] || t).join('、')}`}>
              <WarningFilled style={{ color: '#ff4d4f' }} />
            </Tooltip>
          )}
          {item.applicantName}
          {item.seniorAssessment?.seniorName && (
            <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>
              ／長者：{item.seniorAssessment.seniorName}
            </span>
          )}
        </div>
        {hasWarning && (
          <div style={{ marginBottom: 4 }}>
            {tags.map((t) => (
              <Tag key={t} color="red" style={{ marginBottom: 2 }}>
                {TAG_LABEL[t] || t}
              </Tag>
            ))}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#666' }}>
          <PhoneOutlined /> {maskPhone(item.contactPhone)}
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          <HomeOutlined /> {ROOM_LABEL[item.preferredRoom] || item.preferredRoom}
        </div>
        {item.expectedDate && (
          <div style={{ fontSize: 12, color: '#666' }}>
            <CalendarOutlined /> {dayjs(item.expectedDate).format('YYYY/MM/DD')}
          </div>
        )}
        {canAdmit && (
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            style={{ marginTop: 8, width: '100%' }}
            onClick={(e) => {
              e.stopPropagation();
              openAdmitModal(item);
            }}
          >
            安排入住
          </Button>
        )}
      </Card>
    );
  };

  const ineligibleColumns = [
    {
      title: '長者姓名',
      dataIndex: ['seniorAssessment', 'seniorName'],
      key: 'seniorName',
      render: (_: any, r: ApplicantRow) => r.seniorAssessment?.seniorName ?? '-',
    },
    { title: '申請人', dataIndex: 'applicantName', key: 'applicantName' },
    { title: '聯絡電話', dataIndex: 'contactPhone', key: 'contactPhone', render: (p: string) => maskPhone(p) },
    {
      title: '特殊照護',
      key: 'tags',
      render: (_: any, r: ApplicantRow) => {
        const tags = r.seniorAssessment?.medicalTags ?? [];
        if (!tags.length) return <span style={{ color: '#999' }}>—</span>;
        return tags.map((t) => (
          <Tag key={t} color="red">
            {TAG_LABEL[t] || t}
          </Tag>
        ));
      },
    },
    {
      title: '建檔日期',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (v: string) => dayjs(v).format('YYYY/MM/DD'),
    },
  ];

  return (
    <div>
      <Title level={4}>入住預約管理</Title>

      <Tabs
        defaultActiveKey="board"
        items={[
          {
            key: 'board',
            label: '申請看板',
            children: (
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} md={16}>
                  <DragDropContext onDragEnd={onDragEnd}>
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                      {grouped.map((col) => (
                        <Droppable droppableId={col.key} key={col.key}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              style={{
                                flex: '1 1 0',
                                minWidth: 240,
                                background: snapshot.isDraggingOver ? '#e6f4ff' : '#fafafa',
                                borderRadius: 8,
                                padding: 12,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 600,
                                  marginBottom: 12,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}
                              >
                                <Tag color={col.color}>{col.title}</Tag>
                                <span style={{ fontSize: 13, color: '#999' }}>{col.items.length}</span>
                              </div>
                              {col.items.map((item, index) => (
                                <Draggable draggableId={item.id} index={index} key={item.id}>
                                  {(dragProvided) => renderCard(item, dragProvided)}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      ))}
                    </div>
                  </DragDropContext>
                </Col>

                <Col xs={24} md={8}>
                  <Card title="轉介來源分析" size="small">
                    {Object.keys(referralCounts).length > 0 ? (
                      <Pie
                        data={pieData}
                        options={{
                          responsive: true,
                          plugins: { legend: { position: 'bottom' } },
                        }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暫無資料</div>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'ineligible',
            label: `不符合入住資格名單（${ineligible.length}）`,
            children: (
              <Table
                rowKey="id"
                dataSource={ineligible}
                columns={ineligibleColumns}
                pagination={{ pageSize: 10 }}
                size="middle"
              />
            ),
          },
        ]}
      />

      {/* 安排入住 Modal */}
      <Modal
        title={`安排入住：${admitModal.seniorName}`}
        open={admitModal.open}
        onCancel={() => setAdmitModal({ open: false, applicantId: '', seniorName: '' })}
        onOk={handleAdmitConfirm}
        confirmLoading={admitLoading}
        okText="確認入住"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="building"
                label="棟別"
                rules={[{ required: true, message: '請填寫棟別' }]}
              >
                <Input placeholder="例：A棟" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="floor"
                label="樓層"
                rules={[{ required: true, message: '請填寫樓層' }]}
              >
                <InputNumber min={1} max={30} style={{ width: '100%' }} placeholder="例：3" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="roomNo"
            label="房號"
            rules={[{ required: true, message: '請填寫房號' }]}
          >
            <Input placeholder="例：301" />
          </Form.Item>
          <Form.Item
            name="idNumber"
            label="身分證字號（選填，加密儲存）"
          >
            <Input placeholder="A123456789" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
