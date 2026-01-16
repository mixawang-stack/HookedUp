-- CreateTable
CREATE TABLE "PendingRegistration" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "country" TEXT NOT NULL,
    "agreedTermsAt" TIMESTAMP(3) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingRegistration_email_key" ON "PendingRegistration"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PendingRegistration_tokenHash_key" ON "PendingRegistration"("tokenHash");
