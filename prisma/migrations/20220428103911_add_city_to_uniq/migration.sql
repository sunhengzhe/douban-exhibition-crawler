/*
  Warnings:

  - A unique constraint covering the columns `[city,eventId,date]` on the table `Exhibition` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `Exhibition_eventId_date_key` ON `Exhibition`;

-- CreateIndex
CREATE UNIQUE INDEX `Exhibition_city_eventId_date_key` ON `Exhibition`(`city`, `eventId`, `date`);
