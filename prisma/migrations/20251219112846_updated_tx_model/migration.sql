/*
  Warnings:

  - Added the required column `direction` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('DEPOSIT', 'WITHDRAW');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "direction" "TransactionDirection" NOT NULL,
ADD COLUMN     "orderlyTxId" TEXT,
ALTER COLUMN "exchangeId" DROP NOT NULL;
