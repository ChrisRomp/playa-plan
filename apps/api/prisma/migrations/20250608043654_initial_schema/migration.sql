-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('STRING', 'MULTILINE_STRING', 'INTEGER', 'NUMBER', 'BOOLEAN', 'DATE');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('PRE_OPENING', 'OPENING_SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'CLOSING_SUNDAY', 'POST_EVENT');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'WAITLISTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'PAYPAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EMAIL_VERIFICATION', 'EMAIL_AUTHENTICATION', 'EMAIL_CHANGE', 'PASSWORD_RESET', 'REGISTRATION_CONFIRMATION', 'REGISTRATION_ERROR', 'PAYMENT_CONFIRMATION', 'SHIFT_REMINDER', 'EMAIL_TEST');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailAuditStatus" AS ENUM ('SENT', 'FAILED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PaypalMode" AS ENUM ('SANDBOX', 'LIVE');

-- CreateEnum
CREATE TYPE "AdminAuditActionType" AS ENUM ('REGISTRATION_EDIT', 'REGISTRATION_CANCEL', 'PAYMENT_REFUND', 'WORK_SHIFT_ADD', 'WORK_SHIFT_REMOVE', 'WORK_SHIFT_MODIFY', 'CAMPING_OPTION_ADD', 'CAMPING_OPTION_REMOVE', 'CAMPING_OPTION_MODIFY');

-- CreateEnum
CREATE TYPE "AdminAuditTargetType" AS ENUM ('REGISTRATION', 'USER', 'PAYMENT', 'WORK_SHIFT', 'CAMPING_OPTION');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "playaName" TEXT,
    "profilePicture" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PARTICIPANT',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "allowDeferredDuesPayment" BOOLEAN NOT NULL DEFAULT false,
    "allowEarlyRegistration" BOOLEAN NOT NULL DEFAULT false,
    "allowNoJob" BOOLEAN NOT NULL DEFAULT false,
    "allowRegistration" BOOLEAN NOT NULL DEFAULT true,
    "city" TEXT,
    "country" TEXT,
    "emergencyContact" TEXT,
    "internalNotes" TEXT,
    "phone" TEXT,
    "stateProvince" TEXT,
    "loginCode" TEXT,
    "loginCodeExpiry" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camping_options" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "workShiftsRequired" INTEGER NOT NULL DEFAULT 0,
    "participantDues" DOUBLE PRECISION NOT NULL,
    "staffDues" DOUBLE PRECISION NOT NULL,
    "maxSignups" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camping_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camping_option_fields" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "dataType" "FieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "maxLength" INTEGER,
    "minLength" INTEGER,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "campingOptionId" TEXT NOT NULL,

    CONSTRAINT "camping_option_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camping_option_field_values" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fieldId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,

    CONSTRAINT "camping_option_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camping_option_registrations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "campingOptionId" TEXT NOT NULL,

    CONSTRAINT "camping_option_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camping_option_job_categories" (
    "id" TEXT NOT NULL,
    "campingOptionId" TEXT NOT NULL,
    "jobCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camping_option_job_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "alwaysRequired" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "staffOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "job_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "maxRegistrations" INTEGER NOT NULL,
    "alwaysRequired" BOOLEAN NOT NULL DEFAULT false,
    "staffOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_jobs" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL,
    "providerRefId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "registrationId" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "content" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_audit" (
    "id" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "ccEmails" TEXT,
    "bccEmails" TEXT,
    "subject" TEXT NOT NULL,
    "notificationType" "NotificationType" NOT NULL,
    "status" "EmailAuditStatus" NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "actionType" "AdminAuditActionType" NOT NULL,
    "targetRecordType" "AdminAuditTargetType" NOT NULL,
    "targetRecordId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "reason" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_config" (
    "id" TEXT NOT NULL,
    "campName" TEXT NOT NULL,
    "campDescription" TEXT,
    "homePageBlurb" TEXT,
    "campBannerUrl" TEXT,
    "campBannerAltText" TEXT,
    "campIconUrl" TEXT,
    "campIconAltText" TEXT,
    "registrationYear" INTEGER NOT NULL,
    "earlyRegistrationOpen" BOOLEAN NOT NULL DEFAULT false,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT false,
    "registrationTerms" TEXT,
    "allowDeferredDuesPayment" BOOLEAN NOT NULL DEFAULT false,
    "stripeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripePublicKey" TEXT,
    "stripeApiKey" TEXT,
    "paypalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paypalClientId" TEXT,
    "paypalClientSecret" TEXT,
    "paypalMode" "PaypalMode" NOT NULL DEFAULT 'SANDBOX',
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPassword" TEXT,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "senderEmail" TEXT,
    "senderName" TEXT,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "camping_option_job_categories_campingOptionId_jobCategoryId_key" ON "camping_option_job_categories"("campingOptionId", "jobCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "job_categories_name_key" ON "job_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "registration_jobs_registrationId_jobId_key" ON "registration_jobs"("registrationId", "jobId");

-- AddForeignKey
ALTER TABLE "camping_option_fields" ADD CONSTRAINT "camping_option_fields_campingOptionId_fkey" FOREIGN KEY ("campingOptionId") REFERENCES "camping_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camping_option_field_values" ADD CONSTRAINT "camping_option_field_values_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "camping_option_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camping_option_field_values" ADD CONSTRAINT "camping_option_field_values_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "camping_option_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camping_option_registrations" ADD CONSTRAINT "camping_option_registrations_campingOptionId_fkey" FOREIGN KEY ("campingOptionId") REFERENCES "camping_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camping_option_registrations" ADD CONSTRAINT "camping_option_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camping_option_job_categories" ADD CONSTRAINT "camping_option_job_categories_campingOptionId_fkey" FOREIGN KEY ("campingOptionId") REFERENCES "camping_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camping_option_job_categories" ADD CONSTRAINT "camping_option_job_categories_jobCategoryId_fkey" FOREIGN KEY ("jobCategoryId") REFERENCES "job_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "job_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_jobs" ADD CONSTRAINT "registration_jobs_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_jobs" ADD CONSTRAINT "registration_jobs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_audit" ADD CONSTRAINT "email_audit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
