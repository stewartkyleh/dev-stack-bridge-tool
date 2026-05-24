-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transitions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousSessionId" TEXT,
    "currentSkills" TEXT[],
    "yearsProfessional" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "stackPreference" TEXT NOT NULL,
    "targetStack" TEXT[],
    "timelineWeeks" INTEGER NOT NULL,
    "hoursPerWeek" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "timeline" JSONB NOT NULL,
    "stackRecommendation" JSONB NOT NULL,
    "skillBridge" JSONB NOT NULL,
    "newConcepts" JSONB NOT NULL,
    "projectInspirations" JSONB NOT NULL,
    "rawLlmOutput" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "transitionId" TEXT NOT NULL,
    "projectDescription" TEXT NOT NULL,
    "specificRequirements" TEXT,
    "fitEvaluation" JSONB NOT NULL,
    "stackForProject" JSONB NOT NULL,
    "definitionOfDone" JSONB NOT NULL,
    "rawLlmOutput" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "weekRange" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "learningCallouts" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "transitions_userId_createdAt_idx" ON "transitions"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "transitions_anonymousSessionId_idx" ON "transitions"("anonymousSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_transitionId_key" ON "projects"("transitionId");

-- CreateIndex
CREATE INDEX "phases_projectId_order_idx" ON "phases"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "phases_projectId_order_key" ON "phases"("projectId", "order");

-- CreateIndex
CREATE INDEX "milestones_phaseId_order_idx" ON "milestones"("phaseId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "milestones_phaseId_order_key" ON "milestones"("phaseId", "order");

-- CreateIndex
CREATE INDEX "tasks_milestoneId_order_idx" ON "tasks"("milestoneId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_milestoneId_order_key" ON "tasks"("milestoneId", "order");

-- AddForeignKey
ALTER TABLE "transitions" ADD CONSTRAINT "transitions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "transitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phases" ADD CONSTRAINT "phases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
