/*
  Warnings:

  - You are about to drop the column `yearsProfessional` on the `transitions` table. All the data in the column will be lost.
  - Added the required column `yearsExperience` to the `transitions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transitions" DROP COLUMN "yearsProfessional",
ADD COLUMN     "yearsExperience" TEXT NOT NULL;
