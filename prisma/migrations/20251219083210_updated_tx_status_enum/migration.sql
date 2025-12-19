/*
  Warnings:

  - The values [NEW,WAITING,CONFIRMING,EXCHANGING,SENDING,FINISHED,VERIFYING] on the enum `TransactionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TransactionStatus_new" AS ENUM ('CREATED', 'WAITING_CHAIN_DEPOSIT', 'CHAIN_CONFIRMED', 'CHANGENOW_CREATED', 'CHANGENOW_EXCHANGING', 'CHANGENOW_COMPLETED', 'ORDERLY_DEPOSIT_PENDING', 'ORDERLY_DEPOSIT_CONFIRMED', 'ORDERLY_WITHDRAW_PENDING', 'ORDERLY_WITHDRAW_CONFIRMED', 'SENDING_TO_USER', 'COMPLETED', 'FAILED', 'REFUND_PENDING', 'REFUNDED');
ALTER TABLE "public"."Transaction" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Transaction" ALTER COLUMN "status" TYPE "TransactionStatus_new" USING ("status"::text::"TransactionStatus_new");
ALTER TYPE "TransactionStatus" RENAME TO "TransactionStatus_old";
ALTER TYPE "TransactionStatus_new" RENAME TO "TransactionStatus";
DROP TYPE "public"."TransactionStatus_old";
ALTER TABLE "Transaction" ALTER COLUMN "status" SET DEFAULT 'CREATED';
COMMIT;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "status" SET DEFAULT 'CREATED';
