-- CreateTable
CREATE TABLE "DashboardConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "widgets" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardConfig_pkey" PRIMARY KEY ("id")
);
