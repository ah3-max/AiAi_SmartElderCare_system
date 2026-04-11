import type {
  AdmissionStatus,
  AppointmentStatus,
  ResponseSelection,
  ContractStatus,
  RoomType,
  Gender,
  AdlLevel,
  MedicalTag,
  UserRole,
} from './constants';

// ===== 入住預約登記 =====

export interface Applicant {
  id: string;
  applicantName: string;
  contactPhone: string;
  lineUserId: string;
  relation: string;
  status: AdmissionStatus;
  preferredRoom: RoomType;
  expectedDate: string | null;
  privacyConsent: boolean;
  contactNotes: string | null;
  referralSource: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeniorAssessment {
  id: string;
  applicantId: string;
  seniorName: string;
  birthYear: number;
  gender: Gender;
  adlScore: number | null;
  adlLevel: AdlLevel;
  medicalTags: MedicalTag[];
  createdAt: string;
}

// ===== 長者就診通知 =====

export interface Resident {
  id: string;
  name: string;
  floorId: string;
  building: string;
  floor: number;
}

export interface FamilyMember {
  id: string;
  residentId: string;
  lineUserId: string;
  relation: string;
  isPrimaryContact: boolean;
}

export interface Appointment {
  id: string;
  residentId: string;
  apptDate: string;
  apptTime: string;
  hospital: string;
  department: string;
  status: AppointmentStatus;
  createdAt: string;
}

export interface AppointmentResponse {
  id: string;
  appointmentId: string;
  familyMemberId: string;
  responseSelection: ResponseSelection;
  needsTransport: boolean;
  vehicleType: string | null;
  responseTime: string;
}

// ===== 家屬探訪預約 =====

export interface Zone {
  id: string;
  building: string;
  floor: number;
  label: string;
  maxVisitorsPerSlot: number;
}

export interface TimeSlot {
  id: string;
  zoneId: string;
  startTime: string;
  endTime: string;
}

export interface Reservation {
  id: string;
  zoneId: string;
  timeSlotId: string;
  visitDate: string;
  visitorName: string;
  lineUserId: string;
  guestCount: number;
  residentId: string;
  checkedIn: boolean;
  cancelledAt: string | null;
  createdAt: string;
}

// ===== 線上合約簽署 =====

export interface ContractTemplate {
  id: string;
  title: string;
  contentHtml: string;
  version: string;
  createdAt: string;
}

export interface ContractTransaction {
  id: string;
  contractTemplateId: string;
  residentId: string;
  familyMemberId: string;
  token: string;
  signerName: string;
  signerIp: string | null;
  signedAt: string | null;
  status: ContractStatus;
  signatureData: string | null;
  pdfPath: string | null;
  kycVerified: boolean;
  kycAttempts: number;
  expiresAt: string;
  createdAt: string;
}

// ===== 後台管理員 =====

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  building: string | null;
  floor: number | null;
  isActive: boolean;
  createdAt: string;
}

// ===== API 回應 =====

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
