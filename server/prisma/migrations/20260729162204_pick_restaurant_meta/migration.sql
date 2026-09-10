-- AlterTable
ALTER TABLE "MemberPick" ADD COLUMN     "restaurantArea" TEXT,
ADD COLUMN     "restaurantEtaMin" INTEGER,
ADD COLUMN     "restaurantEtaRange" TEXT,
ADD COLUMN     "restaurantRating" DOUBLE PRECISION;
