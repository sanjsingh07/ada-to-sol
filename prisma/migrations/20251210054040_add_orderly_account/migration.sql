/*
  Warnings:

  - A unique constraint covering the columns `[orderlyAccountId]` on the table `UserWallet` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserWallet" ADD COLUMN     "orderlyAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_orderlyAccountId_key" ON "UserWallet"("orderlyAccountId");
