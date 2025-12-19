-- AlterTable
ALTER TABLE "UserWallet" ADD COLUMN     "orderlyKeyIv" TEXT,
ADD COLUMN     "orderlyKeyPublic" TEXT,
ADD COLUMN     "orderlyKeySecret" TEXT,
ADD COLUMN     "orderlyKeyTag" TEXT;
