import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateProjectBody,
  CreateProjectResponse,
  CreateProjectSourceBody,
  CreateProjectSourceResponse,
  DeleteProjectParams,
  DeleteProjectResponse,
  DeleteProjectSourceParams,
  DeleteProjectSourceResponse,
  GetDashboardResponse,
  GetProjectParams,
  GetProjectResponse,
  ListProjectSourcesParams,
  ListProjectSourcesResponse,
  ListProjectsResponse,
  UpdateProjectBody,
  UpdateProjectParams,
  UpdateProjectResponse,
  UpdateProjectStepBody,
  UpdateProjectStepParams,
  UpdateProjectStepResponse,
} from "@workspace/api-zod";
import {
  db,
  projectStepsTable,
  projectsTable,
  sourcesTable,
} from "@workspace/db";
import {
  findOwnedProject,
  getProjectCards,
  getProjectDetail,
  getUserId,
  stepDefinitions,
} from "../lib/academic-helpers";

const router: IRouter = Router();
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get("/dashboard", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const projects = await getProjectCards(userId);
  const owned = await db
    .select({ id: projectsTable.id, defenseDate: projectsTable.defenseDate })
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId));
  const projectIds = owned.map((project) => project.id);
  const completed = projectIds.length
    ? await db
        .select({ id: projectStepsTable.id })
        .from(projectStepsTable)
        .innerJoin(
          projectsTable,
          eq(projectStepsTable.projectId, projectsTable.id),
        )
        .where(
          and(
            eq(projectsTable.userId, userId),
            eq(projectStepsTable.status, "complete"),
          ),
        )
    : [];
  const nextDeadline =
    owned
      .map((project) => project.defenseDate)
      .filter(
        (date): date is string =>
          date !== null && date >= new Date().toISOString().slice(0, 10),
      )
      .sort()[0] ?? null;

  res.json(
    GetDashboardResponse.parse({
      totalProjects: projects.length,
      activeProjects: projects.filter((project) => project.progress < 100)
        .length,
      completedSteps: completed.length,
      nextDeadline,
      projects,
    }),
  );
});

router.get("/projects", async (req, res): Promise<void> => {
  const projects = await getProjectCards(getUserId(req));
  res.json(ListProjectsResponse.parse(projects));
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;
  const userId = getUserId(req);
  const project = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(projectsTable)
      .values({
        userId,
        name: input.name,
        type: input.type,
        subject: input.subject ?? null,
        institution: input.institution ?? null,
        field: input.field ?? null,
        level: input.level ?? null,
        defenseDate: input.defenseDate
          ? input.defenseDate.toISOString().slice(0, 10)
          : null,
        instructions: input.instructions ?? null,
        currentStep: "subject",
      })
      .returning();
    await tx.insert(projectStepsTable).values(
      stepDefinitions.map((step, index) => ({
        projectId: created.id,
        key: step.key,
        title: step.title,
        status: index === 0 ? "in_progress" : "todo",
      })),
    );
    return created;
  });
  const detail = await getProjectDetail(project.id, userId);
  res.status(201).json(CreateProjectResponse.parse(detail));
});

router.get("/projects/:projectId", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success || !UUID_PATTERN.test(params.data.projectId)) {
    res.status(400).json({ error: "Identifiant de projet invalide." });
    return;
  }
  const project = await getProjectDetail(params.data.projectId, getUserId(req));
  if (!project) {
    res.status(404).json({ error: "Projet introuvable." });
    return;
  }
  res.json(GetProjectResponse.parse(project));
});

router.patch("/projects/:projectId", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  const body = UpdateProjectBody.safeParse(req.body);
  if (
    !params.success ||
    !UUID_PATTERN.test(params.data.projectId) ||
    !body.success
  ) {
    res.status(400).json({
      error: body.success ? "Identifiant de projet invalide." : body.error.message,
    });
    return;
  }
  const userId = getUserId(req);
  if (!(await findOwnedProject(params.data.projectId, userId))) {
    res.status(404).json({ error: "Projet introuvable." });
    return;
  }
  const { defenseDate, ...values } = body.data;
  const update: Partial<typeof projectsTable.$inferInsert> = { ...values };
  if (defenseDate !== undefined) {
    update.defenseDate = defenseDate
      ? defenseDate.toISOString().slice(0, 10)
      : null;
  }
  await db
    .update(projectsTable)
    .set(update)
    .where(
      and(
        eq(projectsTable.id, params.data.projectId),
        eq(projectsTable.userId, userId),
      ),
    );
  const project = await getProjectDetail(params.data.projectId, userId);
  res.json(UpdateProjectResponse.parse(project));
});

router.delete("/projects/:projectId", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success || !UUID_PATTERN.test(params.data.projectId)) {
    res.status(400).json({ error: "Identifiant de projet invalide." });
    return;
  }
  const deleted = await db
    .delete(projectsTable)
    .where(
      and(
        eq(projectsTable.id, params.data.projectId),
        eq(projectsTable.userId, getUserId(req)),
      ),
    )
    .returning({ id: projectsTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Projet introuvable." });
    return;
  }
  DeleteProjectResponse.parse(undefined);
  res.sendStatus(204);
});

router.patch(
  "/projects/:projectId/steps/:stepKey",
  async (req, res): Promise<void> => {
    const params = UpdateProjectStepParams.safeParse(req.params);
    const body = UpdateProjectStepBody.safeParse(req.body);
    if (
      !params.success ||
      !UUID_PATTERN.test(params.data.projectId) ||
      !body.success
    ) {
      res.status(400).json({
        error: body.success ? "Données d’étape invalides." : body.error.message,
      });
      return;
    }
    const userId = getUserId(req);
    if (!(await findOwnedProject(params.data.projectId, userId))) {
      res.status(404).json({ error: "Projet introuvable." });
      return;
    }
    await db
      .update(projectStepsTable)
      .set(body.data)
      .where(
        and(
          eq(projectStepsTable.projectId, params.data.projectId),
          eq(projectStepsTable.key, params.data.stepKey),
        ),
      );
    const detail = await getProjectDetail(params.data.projectId, userId);
    const nextStep = detail?.steps.find((step) => step.status !== "complete");
    await db
      .update(projectsTable)
      .set({ currentStep: nextStep?.key ?? "jury" })
      .where(eq(projectsTable.id, params.data.projectId));
    res.json(UpdateProjectStepResponse.parse(detail));
  },
);

router.get(
  "/projects/:projectId/sources",
  async (req, res): Promise<void> => {
    const params = ListProjectSourcesParams.safeParse(req.params);
    if (!params.success || !UUID_PATTERN.test(params.data.projectId)) {
      res.status(400).json({ error: "Identifiant de projet invalide." });
      return;
    }
    const projectId = params.data.projectId;
    if (!(await findOwnedProject(projectId, getUserId(req)))) {
      res.status(404).json({ error: "Projet introuvable." });
      return;
    }
    const sources = await db
      .select()
      .from(sourcesTable)
      .where(eq(sourcesTable.projectId, projectId))
      .orderBy(desc(sourcesTable.createdAt));
    res.json(ListProjectSourcesResponse.parse(sources));
  },
);

router.post(
  "/projects/:projectId/sources",
  async (req, res): Promise<void> => {
    const params = ListProjectSourcesParams.safeParse(req.params);
    const body = CreateProjectSourceBody.safeParse(req.body);
    if (
      !params.success ||
      !UUID_PATTERN.test(params.data.projectId) ||
      !body.success
    ) {
      res.status(400).json({
        error: body.success ? "Identifiant de projet invalide." : body.error.message,
      });
      return;
    }
    const projectId = params.data.projectId;
    if (!(await findOwnedProject(projectId, getUserId(req)))) {
      res.status(404).json({ error: "Projet introuvable." });
      return;
    }
    const [source] = await db
      .insert(sourcesTable)
      .values({
        projectId,
        title: body.data.title,
        author: body.data.author ?? null,
        year: body.data.year ?? null,
        url: body.data.url ?? null,
        kind: body.data.kind ?? "other",
        notes: body.data.notes ?? null,
      })
      .returning();
    res.status(201).json(CreateProjectSourceResponse.parse(source));
  },
);

router.delete(
  "/projects/:projectId/sources/:sourceId",
  async (req, res): Promise<void> => {
    const params = DeleteProjectSourceParams.safeParse(req.params);
    if (
      !params.success ||
      !UUID_PATTERN.test(params.data.projectId) ||
      !UUID_PATTERN.test(params.data.sourceId)
    ) {
      res.status(400).json({ error: "Identifiant de source invalide." });
      return;
    }
    const project = await findOwnedProject(
      params.data.projectId,
      getUserId(req),
    );
    if (!project) {
      res.status(404).json({ error: "Projet introuvable." });
      return;
    }
    const deleted = await db
      .delete(sourcesTable)
      .where(
        and(
          eq(sourcesTable.id, params.data.sourceId),
          eq(sourcesTable.projectId, params.data.projectId),
        ),
      )
      .returning({ id: sourcesTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Source introuvable." });
      return;
    }
    DeleteProjectSourceResponse.parse(undefined);
    res.sendStatus(204);
  },
);

export default router;
