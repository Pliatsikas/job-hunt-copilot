-- T02: sign-ups from now on must confirm their address before signing in.
-- Every account that exists at this moment was created before the rule and
-- is already in use, so it is marked verified now rather than locked out of
-- an app it has been using. No schema change: the column existed for the
-- Auth.js adapter; this only gives it a value for pre-existing rows.
UPDATE "User" SET "emailVerified" = NOW() WHERE "emailVerified" IS NULL;
