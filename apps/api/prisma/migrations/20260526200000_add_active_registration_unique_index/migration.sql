-- CreateIndex: Prevent duplicate active registrations for the same user/year.
-- Only CANCELLED registrations are excluded, allowing re-registration after cancellation.
CREATE UNIQUE INDEX "registrations_active_user_year_unique"
ON "registrations" ("userId", "year")
WHERE "status" != 'CANCELLED';
