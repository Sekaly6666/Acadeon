import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Request, RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { db, projectStepsTable, projectsTable } from "@workspace/db";

export const stepDefinitions = [
  { key: "subject", title: "Cadrer mon sujet" },
  { key: "understanding", title: "Comprendre mon sujet" },
  { key: "problem", title: "Formuler la problématique" },
  { key: "objectives", title: "Définir mes objectifs" },
  { key: "outline", title: "Construire mon plan" },
  { key: "research", title: "Organiser mes sources" },
  { key: "writing", title: "Rédiger mon travail" },
  { key: "review", title: "Vérifier mon travail" },
  { key: "presentation", title: "Préparer ma présentation" },
  { key: "defense", title: "Préparer ma soutenance" },
  { key: "jury", title: "M’entraîner au jury" },
] as const;

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Connexion requise." });
    return;
  }
  next();
};

export function getUserId(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) {
    throw new Error("Authenticated route received no Clerk user id.");
  }
  return userId;
}

export async function findOwnedProject(projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(
      and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)),
    )
    .limit(1);
  return project;
}

export async function getProjectDetail(projectId: string, userId: string) {
  const project = await findOwnedProject(projectId, userId);
  if (!project) return undefined;
  const steps = await db
    .select()
    .from(projectStepsTable)
    .where(eq(projectStepsTable.projectId, projectId))
    .orderBy(asc(projectStepsTable.id));
  return toProjectDetail(project, steps);
}

export function toProjectDetail(
  project: typeof projectsTable.$inferSelect,
  steps: (typeof projectStepsTable.$inferSelect)[],
) {
  const orderedSteps = [...steps].sort(
    (a, b) =>
      stepDefinitions.findIndex((step) => step.key === a.key) -
      stepDefinitions.findIndex((step) => step.key === b.key),
  );
  const completeCount = orderedSteps.filter(
    (step) => step.status === "complete",
  ).length;
  const current = orderedSteps.find((step) => step.status !== "complete");
  return {
    id: project.id,
    name: project.name,
    type: project.type,
    subject: project.subject,
    progress: Math.round((completeCount / stepDefinitions.length) * 100),
    currentStep: current?.key ?? "jury",
    updatedAt: project.updatedAt,
    defenseDate: project.defenseDate,
    field: project.field,
    level: project.level,
    institution: project.institution,
    instructions: project.instructions,
    steps: orderedSteps.map(({ key, title, status, content }) => ({
      key,
      title,
      status,
      content,
    })),
  };
}

export async function getProjectCards(userId: string) {
  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId))
    .orderBy(desc(projectsTable.updatedAt));

  if (projects.length === 0) return [];
  const steps = await db
    .select()
    .from(projectStepsTable)
    .where(
      inArray(
        projectStepsTable.projectId,
        projects.map((project) => project.id),
      ),
    );
  const stepsByProject = new Map<string, typeof steps>();
  for (const step of steps) {
    const existing = stepsByProject.get(step.projectId) ?? [];
    existing.push(step);
    stepsByProject.set(step.projectId, existing);
  }
  return projects.map((project) =>
    toProjectDetail(project, stepsByProject.get(project.id) ?? []),
  );
}

export async function saveStepContent(
  projectId: string,
  key: string,
  content: string,
): Promise<void> {
  await db
    .insert(projectStepsTable)
    .values({
      projectId,
      key,
      title: stepDefinitions.find((step) => step.key === key)?.title ?? key,
      status: "in_progress",
      content,
    })
    .onConflictDoUpdate({
      target: [projectStepsTable.projectId, projectStepsTable.key],
      set: { content, status: "in_progress" },
    });
  await db
    .update(projectsTable)
    .set({ updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId));
}
