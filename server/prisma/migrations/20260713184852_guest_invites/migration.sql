-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('INVITED', 'JOINED', 'PICKING', 'READY');

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "memberId" TEXT;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "dietary" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "isKid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "status" "MemberStatus" NOT NULL DEFAULT 'INVITED';

-- CreateTable
CREATE TABLE "MemberPick" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "restaurantName" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "dishName" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "veg" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberPick_memberId_idx" ON "MemberPick"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberPick_memberId_restaurantId_dishId_key" ON "MemberPick"("memberId", "restaurantId", "dishId");

-- CreateIndex
CREATE INDEX "Invite_celebrationId_idx" ON "Invite"("celebrationId");

-- CreateIndex
CREATE INDEX "Member_celebrationId_idx" ON "Member"("celebrationId");

-- AddForeignKey
ALTER TABLE "MemberPick" ADD CONSTRAINT "MemberPick_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
