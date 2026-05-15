UPDATE "passkeys"
SET "nickname" = 'Passkey'
WHERE "nickname" IS NULL OR length(btrim("nickname")) = 0;

ALTER TABLE "passkeys" ALTER COLUMN "nickname" SET NOT NULL;

ALTER TABLE "passkeys"
ADD CONSTRAINT "passkeys_nickname_not_blank"
CHECK (length(btrim("nickname")) > 0);
