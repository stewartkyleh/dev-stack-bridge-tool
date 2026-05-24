ALTER TABLE "transitions" ADD CONSTRAINT "ownership_xor"
CHECK (
  ("userId" IS NOT NULL AND "anonymousSessionId" IS NULL) OR
  ("userId" IS NULL AND "anonymousSessionId" IS NOT NULL)
);