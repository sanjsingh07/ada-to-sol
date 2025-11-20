-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('NEW', 'WAITING', 'CONFIRMING', 'EXCHANGING', 'SENDING', 'FINISHED', 'FAILED', 'REFUNDED', 'VERIFYING');

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "userAddress" TEXT NOT NULL,
    "fromAmount" DOUBLE PRECISION NOT NULL,
    "toAmount" DOUBLE PRECISION NOT NULL,
    "flow" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payinAddress" TEXT NOT NULL,
    "payoutAddress" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "directedAmount" DOUBLE PRECISION NOT NULL,
    "fromNetwork" TEXT NOT NULL,
    "toNetwork" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'NEW',
    "TxHash" TEXT,
    "refundAddress" TEXT,
    "refundHash" TEXT,
    "refundAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_exchangeId_key" ON "Transaction"("exchangeId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "UserWallet"("walletAddress") ON DELETE RESTRICT ON UPDATE CASCADE;
