-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('EMERGENCY', 'PERSONAL', 'FAMILY', 'OTHER');

-- CreateTable
CREATE TABLE "resident_leaves" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL DEFAULT 'OTHER',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resident_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_entries" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resident_leaves_residentId_startDate_endDate_idx" ON "resident_leaves"("residentId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "resident_leaves_leaveType_idx" ON "resident_leaves"("leaveType");

-- CreateIndex
CREATE UNIQUE INDEX "faq_entries_keyword_key" ON "faq_entries"("keyword");

-- CreateIndex
CREATE INDEX "faq_entries_isActive_priority_idx" ON "faq_entries"("isActive", "priority");
