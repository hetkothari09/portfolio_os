-- CreateTable
CREATE TABLE "SalaryIncome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(12,2) NOT NULL,
    "payDay" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryIncome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryIncome_userId_isActive_idx" ON "SalaryIncome"("userId", "isActive");

-- AddForeignKey
ALTER TABLE "SalaryIncome" ADD CONSTRAINT "SalaryIncome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
