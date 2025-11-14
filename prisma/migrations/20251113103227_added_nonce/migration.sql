/*
  Warnings:

  - A unique constraint covering the columns `[nonce]` on the table `UserWallet` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nonce` to the `UserWallet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserWallet" ADD COLUMN     "nonce" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_nonce_key" ON "UserWallet"("nonce");
