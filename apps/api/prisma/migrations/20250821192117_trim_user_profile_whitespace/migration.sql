-- Trim whitespace from user profile fields
-- This migration addresses existing data that may have trailing/leading spaces

UPDATE "users" SET 
  "firstName" = TRIM("firstName")
WHERE "firstName" IS NOT NULL AND "firstName" != TRIM("firstName");

UPDATE "users" SET 
  "lastName" = TRIM("lastName")
WHERE "lastName" IS NOT NULL AND "lastName" != TRIM("lastName");

UPDATE "users" SET 
  "playaName" = TRIM("playaName")
WHERE "playaName" IS NOT NULL AND "playaName" != TRIM("playaName");

UPDATE "users" SET 
  "phone" = TRIM("phone")
WHERE "phone" IS NOT NULL AND "phone" != TRIM("phone");

UPDATE "users" SET 
  "city" = TRIM("city")
WHERE "city" IS NOT NULL AND "city" != TRIM("city");

UPDATE "users" SET 
  "stateProvince" = TRIM("stateProvince")
WHERE "stateProvince" IS NOT NULL AND "stateProvince" != TRIM("stateProvince");

UPDATE "users" SET 
  "country" = TRIM("country")
WHERE "country" IS NOT NULL AND "country" != TRIM("country");

UPDATE "users" SET 
  "emergencyContact" = TRIM("emergencyContact")
WHERE "emergencyContact" IS NOT NULL AND "emergencyContact" != TRIM("emergencyContact");