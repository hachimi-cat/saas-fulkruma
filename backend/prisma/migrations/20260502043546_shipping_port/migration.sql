-- AlterTable
ALTER TABLE "BiteshipConfig" ADD COLUMN     "biteshipOriginLocationId" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "originAddress" TEXT,
ADD COLUMN     "originAreaId" TEXT,
ADD COLUMN     "originCity" TEXT,
ADD COLUMN     "originDistrict" TEXT,
ADD COLUMN     "originLat" DOUBLE PRECISION,
ADD COLUMN     "originLng" DOUBLE PRECISION,
ADD COLUMN     "originNote" TEXT,
ADD COLUMN     "originPostal" TEXT,
ADD COLUMN     "originProvince" TEXT,
ADD COLUMN     "originVillage" TEXT;
