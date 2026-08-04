-- CreateTable
CREATE TABLE IF NOT EXISTS "OrganizationProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "legalName" TEXT NOT NULL DEFAULT '',
    "tradeName" TEXT,
    "vatId" TEXT,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "countryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationProfile_pkey" PRIMARY KEY ("id")
);
