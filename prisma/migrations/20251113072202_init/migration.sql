-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('NOT_VERIFIED', 'VERIFIED');

-- CreateTable
CREATE TABLE "UserWallet" (
    "id" UUID NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "newCardanoAddress" TEXT NOT NULL,
    "solanaAddress" TEXT NOT NULL,
    "newCardanoEnPriKey" TEXT NOT NULL,
    "solanaEnPriKey" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_walletAddress_key" ON "UserWallet"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_newCardanoAddress_key" ON "UserWallet"("newCardanoAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_solanaAddress_key" ON "UserWallet"("solanaAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_newCardanoEnPriKey_key" ON "UserWallet"("newCardanoEnPriKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_solanaEnPriKey_key" ON "UserWallet"("solanaEnPriKey");
