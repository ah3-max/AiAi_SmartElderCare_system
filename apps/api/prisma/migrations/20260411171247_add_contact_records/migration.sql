-- CreateTable
CREATE TABLE "contact_records" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "contactedBy" TEXT NOT NULL,
    "contactType" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_records_applicantId_idx" ON "contact_records"("applicantId");

-- AddForeignKey
ALTER TABLE "contact_records" ADD CONSTRAINT "contact_records_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
