-- T09: the designed CV. A structured CV per language, an optional photo on
-- the profile, and the selection behind a tailored CV document.
ALTER TABLE "Profile" ADD COLUMN "photo" TEXT;
ALTER TABLE "Document" ADD COLUMN "data" JSONB;

CREATE TABLE "StructuredCv" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructuredCv_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StructuredCv_userId_language_key" ON "StructuredCv"("userId", "language");

ALTER TABLE "StructuredCv" ADD CONSTRAINT "StructuredCv_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
