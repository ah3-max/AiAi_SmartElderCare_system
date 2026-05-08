-- AddForeignKey
ALTER TABLE "resident_leaves" ADD CONSTRAINT "resident_leaves_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
