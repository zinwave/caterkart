-- CreateEnum
CREATE TYPE "CelebrationStatus" AS ENUM ('PLANNING', 'PLACING', 'IN_FLIGHT', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('PERSONAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "SubOrderKind" AS ENUM ('FOOD', 'INSTAMART');

-- CreateEnum
CREATE TYPE "SubOrderStatus" AS ENUM ('DRAFT', 'QUEUED', 'PLACING', 'PLACED', 'PREPARING', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "SettlementMode" AS ENUM ('EQUAL', 'BY_ITEM');

-- CreateEnum
CREATE TYPE "CompanyPlan" AS ENUM ('PILOT', 'STANDARD', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('ADMIN', 'LEAD', 'MEMBER');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CLAIMED', 'RECONCILED', 'VOID');

-- CreateEnum
CREATE TYPE "GroupOrderStatus" AS ENUM ('COLLECTING', 'PLACED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('INVITED', 'JOINED', 'PICKING', 'SUBMITTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "displayName" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwiggyAuth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "swiggyUserHint" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwiggyAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthFlow" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT,
    "redirectAfter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Celebration" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "occasion" TEXT NOT NULL,
    "addressLabel" TEXT NOT NULL,
    "swiggyAddressId" TEXT,
    "status" "CelebrationStatus" NOT NULL DEFAULT 'PLANNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderType" "OrderType" NOT NULL DEFAULT 'PERSONAL',
    "companyId" TEXT,
    "costCenterId" TEXT,
    "perHeadCapRup" INTEGER,

    CONSTRAINT "Celebration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "celebrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubOrder" (
    "id" TEXT NOT NULL,
    "celebrationId" TEXT NOT NULL,
    "kind" "SubOrderKind" NOT NULL,
    "status" "SubOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "restaurantId" TEXT,
    "restaurantName" TEXT,
    "lines" JSONB NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "couponCode" TEXT,
    "couponValue" INTEGER,
    "capExceeded" BOOLEAN NOT NULL DEFAULT false,
    "placementOffsetMs" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3),
    "placedAt" TIMESTAMP(3),
    "swiggyOrderId" TEXT,
    "etaMinutes" INTEGER,
    "lastErrorCode" TEXT,
    "lastErrorMsg" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "status" "SubOrderStatus" NOT NULL,
    "etaMinutes" INTEGER,
    "raw" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementPlan" (
    "id" TEXT NOT NULL,
    "celebrationId" TEXT NOT NULL,
    "targetConvergenceMin" INTEGER NOT NULL,
    "preDropLeadMin" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementEntry" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "estimatedEtaMin" INTEGER NOT NULL,
    "fireAt" TIMESTAMP(3) NOT NULL,
    "fired" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlacementEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "celebrationId" TEXT NOT NULL,
    "mode" "SettlementMode" NOT NULL DEFAULT 'EQUAL',
    "total" INTEGER NOT NULL,
    "cashCollectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementShare" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "contributions" JSONB NOT NULL,
    "upiLink" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "SettlementShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "celebrationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailDomain" TEXT NOT NULL,
    "gstin" TEXT,
    "billingEmail" TEXT,
    "addressLabel" TEXT,
    "plan" "CompanyPlan" NOT NULL DEFAULT 'PILOT',
    "billingLinked" BOOLEAN NOT NULL DEFAULT false,
    "walletBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "role" "CompanyRole" NOT NULL DEFAULT 'MEMBER',
    "costCenterId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "leadMemberId" TEXT,
    "budgetPeriod" "BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
    "budgetRup" INTEGER NOT NULL DEFAULT 0,
    "perHeadCapRup" INTEGER NOT NULL DEFAULT 300,
    "vegOnly" BOOLEAN NOT NULL DEFAULT false,
    "allowAlcohol" BOOLEAN NOT NULL DEFAULT false,
    "requireApprovalAboveRup" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolidatedInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "costCenterId" TEXT,
    "celebrationId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalRup" INTEGER NOT NULL,
    "taxRup" INTEGER NOT NULL,
    "totalRup" INTEGER NOT NULL,
    "companyName" TEXT NOT NULL,
    "gstin" TEXT,
    "costCenterName" TEXT,
    "costCenterCode" TEXT,
    "placedByName" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "lineBreakdown" JSONB NOT NULL,
    "gstInvoiceUrl" TEXT,
    "issuedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsolidatedInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupOrder" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "costCenterId" TEXT,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "addressLabel" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "GroupOrderStatus" NOT NULL DEFAULT 'COLLECTING',
    "perHeadCapRup" INTEGER NOT NULL,
    "placedCelebrationId" TEXT,
    "placedInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupOrderParticipant" (
    "id" TEXT NOT NULL,
    "groupOrderId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'JOINED',
    "lines" JSONB NOT NULL DEFAULT '[]',
    "joinedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "GroupOrderParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SwiggyAuth_userId_key" ON "SwiggyAuth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthFlow_state_key" ON "OAuthFlow"("state");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementPlan_celebrationId_key" ON "PlacementPlan"("celebrationId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_celebrationId_key" ON "Settlement"("celebrationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Company_emailDomain_key" ON "Company"("emailDomain");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_userId_key" ON "CompanyMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_companyId_workEmail_key" ON "CompanyMember"("companyId", "workEmail");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_companyId_code_key" ON "CostCenter"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ConsolidatedInvoice_number_key" ON "ConsolidatedInvoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ConsolidatedInvoice_celebrationId_key" ON "ConsolidatedInvoice"("celebrationId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupOrder_token_key" ON "GroupOrder"("token");

-- CreateIndex
CREATE UNIQUE INDEX "GroupOrderParticipant_groupOrderId_memberId_key" ON "GroupOrderParticipant"("groupOrderId", "memberId");

-- AddForeignKey
ALTER TABLE "SwiggyAuth" ADD CONSTRAINT "SwiggyAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Celebration" ADD CONSTRAINT "Celebration_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Celebration" ADD CONSTRAINT "Celebration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Celebration" ADD CONSTRAINT "Celebration_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_celebrationId_fkey" FOREIGN KEY ("celebrationId") REFERENCES "Celebration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubOrder" ADD CONSTRAINT "SubOrder_celebrationId_fkey" FOREIGN KEY ("celebrationId") REFERENCES "Celebration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SubOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementPlan" ADD CONSTRAINT "PlacementPlan_celebrationId_fkey" FOREIGN KEY ("celebrationId") REFERENCES "Celebration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementEntry" ADD CONSTRAINT "PlacementEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlacementPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_celebrationId_fkey" FOREIGN KEY ("celebrationId") REFERENCES "Celebration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementShare" ADD CONSTRAINT "SettlementShare_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementShare" ADD CONSTRAINT "SettlementShare_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_celebrationId_fkey" FOREIGN KEY ("celebrationId") REFERENCES "Celebration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidatedInvoice" ADD CONSTRAINT "ConsolidatedInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidatedInvoice" ADD CONSTRAINT "ConsolidatedInvoice_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidatedInvoice" ADD CONSTRAINT "ConsolidatedInvoice_celebrationId_fkey" FOREIGN KEY ("celebrationId") REFERENCES "Celebration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOrder" ADD CONSTRAINT "GroupOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOrder" ADD CONSTRAINT "GroupOrder_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOrder" ADD CONSTRAINT "GroupOrder_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "CompanyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOrderParticipant" ADD CONSTRAINT "GroupOrderParticipant_groupOrderId_fkey" FOREIGN KEY ("groupOrderId") REFERENCES "GroupOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOrderParticipant" ADD CONSTRAINT "GroupOrderParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
