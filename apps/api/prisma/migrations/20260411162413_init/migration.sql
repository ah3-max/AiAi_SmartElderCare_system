-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FLOOR_ADMIN', 'NURSE');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('NEW', 'CONTACTED', 'WAITLISTED', 'ADMITTED', 'CLOSED', 'INELIGIBLE');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('SINGLE', 'DOUBLE', 'SHARED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "AdlLevel" AS ENUM ('INDEPENDENT', 'PARTIAL_ASSIST', 'FULLY_DEPENDENT');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'NOTIFIED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResponseSelection" AS ENUM ('SELF_ACCOMPANY', 'NEED_ASSISTANCE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'FLOOR_ADMIN',
    "building" TEXT,
    "floor" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicants" (
    "id" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'NEW',
    "preferredRoom" "RoomType" NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "privacyConsent" BOOLEAN NOT NULL DEFAULT false,
    "contactNotes" TEXT,
    "referralSource" TEXT,
    "residentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "senior_assessments" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "seniorName" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "gender" "Gender" NOT NULL,
    "adlScore" INTEGER,
    "adlLevel" "AdlLevel" NOT NULL,
    "medicalTags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "senior_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "residents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "roomNo" TEXT,
    "idNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "residents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "apptDate" TIMESTAMP(3) NOT NULL,
    "apptTime" TEXT NOT NULL,
    "hospital" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_responses" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "responseSelection" "ResponseSelection" NOT NULL,
    "needsTransport" BOOLEAN NOT NULL DEFAULT false,
    "vehicleType" TEXT,
    "vehicleArrangedAt" TIMESTAMP(3),
    "responseTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_notifications" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "maxVisitorsPerSlot" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_slots" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "timeSlotId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "visitorName" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "noShow" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_transactions" (
    "id" TEXT NOT NULL,
    "contractTemplateId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerIp" TEXT,
    "signedAt" TIMESTAMP(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'PENDING',
    "signatureData" TEXT,
    "pdfPath" TEXT,
    "kycVerified" BOOLEAN NOT NULL DEFAULT false,
    "kycAttempts" INTEGER NOT NULL DEFAULT 0,
    "kycLockedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "applicants_residentId_key" ON "applicants"("residentId");

-- CreateIndex
CREATE INDEX "applicants_lineUserId_idx" ON "applicants"("lineUserId");

-- CreateIndex
CREATE INDEX "applicants_status_idx" ON "applicants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "senior_assessments_applicantId_key" ON "senior_assessments"("applicantId");

-- CreateIndex
CREATE INDEX "residents_building_floor_idx" ON "residents"("building", "floor");

-- CreateIndex
CREATE INDEX "family_members_lineUserId_idx" ON "family_members"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_residentId_lineUserId_key" ON "family_members"("residentId", "lineUserId");

-- CreateIndex
CREATE INDEX "appointments_apptDate_idx" ON "appointments"("apptDate");

-- CreateIndex
CREATE INDEX "appointments_residentId_idx" ON "appointments"("residentId");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_responses_appointmentId_key" ON "appointment_responses"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_notifications_appointmentId_daysBefore_key" ON "appointment_notifications"("appointmentId", "daysBefore");

-- CreateIndex
CREATE UNIQUE INDEX "zones_building_floor_key" ON "zones"("building", "floor");

-- CreateIndex
CREATE INDEX "reservations_visitDate_zoneId_timeSlotId_idx" ON "reservations"("visitDate", "zoneId", "timeSlotId");

-- CreateIndex
CREATE INDEX "reservations_lineUserId_visitDate_idx" ON "reservations"("lineUserId", "visitDate");

-- CreateIndex
CREATE UNIQUE INDEX "contract_transactions_token_key" ON "contract_transactions"("token");

-- CreateIndex
CREATE INDEX "contract_transactions_token_idx" ON "contract_transactions"("token");

-- CreateIndex
CREATE INDEX "contract_transactions_status_idx" ON "contract_transactions"("status");

-- CreateIndex
CREATE INDEX "contract_transactions_expiresAt_idx" ON "contract_transactions"("expiresAt");

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "senior_assessments" ADD CONSTRAINT "senior_assessments_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_responses" ADD CONSTRAINT "appointment_responses_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_responses" ADD CONSTRAINT "appointment_responses_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "family_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_notifications" ADD CONSTRAINT "appointment_notifications_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_transactions" ADD CONSTRAINT "contract_transactions_contractTemplateId_fkey" FOREIGN KEY ("contractTemplateId") REFERENCES "contract_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_transactions" ADD CONSTRAINT "contract_transactions_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_transactions" ADD CONSTRAINT "contract_transactions_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "family_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
