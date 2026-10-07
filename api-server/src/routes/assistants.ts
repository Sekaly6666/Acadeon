import { and, eq, isNull } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  AnalyzeSubjectBody,
  AnalyzeSubjectParams,
  AnalyzeSubjectResponse,
  EvaluateJuryAnswerBody,
  EvaluateJuryAnswerParams,
  EvaluateJuryAnswerResponse,
  ExplainConceptBody,
  ExplainConceptParams,
  ExplainConceptResponse,
  GenerateQuizBody,
  GenerateQuizParams,
  GenerateQuizResponse,
  GenerateOutlineBody,
  GenerateOutlineParams,
  GenerateOutlineResponse,
  GenerateProblemBody,
  GenerateProblemParams,
  GenerateProblemResponse,
  GetProjectParams,
  ReviewWritingBody,
  ReviewWritingParams,
  ReviewWritingResponse,
  StartJurySimulationBody,
  StartJurySimulationParams,
  StartJurySimulationResponse,
} from "@workspace/api-zod";
import {
  db,
  juryAnswersTable,
  jurySessionsTable,
  projectStepsTable,
} from "@workspace/db";
import { AiServiceError, checkAiRateLimit, generateStructured } from "../lib/ai-service";
import {
  findOwnedProject,
  getProjectDetail,
  getUserId,
  saveStepContent,
} from "../lib/academic-helpers";

const router: IRouter = Router();
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object.");
  }
  return value as Record<string, unknown>;
}

function parseFirstJuryQuestion(value: unknown): { question: string } {
  const question = objectValue(value).question;
  if (typeof question !== "string" || question.trim().length < 10) {
    throw new Error("Jury question is missing or too short.");
  }
  return { question };
}

function parseJuryEvaluation(value: unknown) {
  const result = objectValue(value);
  const strengths = result.strengths;
  const improvements = result.improvements;
  if (
    typeof result.score !== "number" ||
    !Number.isInteger(result.score) ||
    result.score < 0 ||
    result.score > 100 ||
    !Array.isArray(strengths) ||
    strengths.length === 0 ||
    !strengths.every((item): item is string => typeof item === "string") ||
    !Array.isArray(improvements) ||
    improvements.length === 0 ||
    !improvements.every((item): item is string => typeof item === "string") ||
    typeof result.advice !== "string" ||
    result.advice.length < 10 ||
    (result.nextQuestion !== null &&
      (typeof result.nextQuestion !== "string" ||
        result.nextQuestion.length < 10))
  ) {
    throw new Error("Jury evaluation did not match the required structure.");
  }
  return {
    score: result.score,
    strengths,
    improvements,
    advice: result.advice,
    nextQuestion: result.nextQuestion,
  };
}

function sendAiError(req: Request, res: Response, error: unknown): void {
  if (error instanceof AiServiceError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  req.log.error({ err: error }, "Academic assistant request failed");
  res.status(500).json({ error: "Une erreur est survenue. Réessaie." });
}

async function hasProject(projectId: string, userId: string): Promise<boolean> {
  return Boolean(await findOwnedProject(projectId, userId));
}

async function saveUnderstanding(
  projectId: string,
  update: Record<string, unknown>,
): Promise<void> {
  const [step] = await db
    .select({ content: projectStepsTable.content })
    .from(projectStepsTable)
    .where(
      and(
        eq(projectStepsTable.projectId, projectId),
        eq(projectStepsTable.key, "understanding"),
      ),
    )
    .limit(1);
  let previous: Record<string, unknown> = {};
  if (step?.content) {
    try {
      const value: unknown = JSON.parse(step.content);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        previous = value as Record<string, unknown>;
      }
    } catch {
      previous = {};
    }
  }
  await saveStepContent(
    projectId,
    "understanding",
    JSON.stringify({ ...previous, ...update }),
  );
}

router.post(
  "/projects/:projectId/ai/subject",
  async (req, res): Promise<void> => {
    const params = AnalyzeSubjectParams.safeParse(req.params);
    const body = AnalyzeSubjectBody.safeParse(req.body);
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
    if (!(await hasProject(params.data.projectId, userId))) {
      res.status(404).json({ error: "Projet introuvable." });
      return;
    }
    try {
      checkAiRateLimit(userId);
      const analysis = await generateStructured(
        "Analyse le sujet en français : évalue clarté, délimitation et faisabilité (scores de 0 à 100), explique les principaux ajustements, puis propose exactement trois reformulations adaptées au niveau et au contexte. Chaque proposition doit inclure un raisonnement, des points forts et des limites. N'invente aucune donnée locale.",
        body.data,
        (value) => AnalyzeSubjectResponse.parse(value),
      );
      await saveStepContent(
        params.data.projectId,
        "subject",
        JSON.stringify({ submittedSubject: body.data.subject, analysis }),
      );
      res.json(analysis);
    } catch (error) {
      sendAiError(req, res, error);
    }
  },
);

router.post(
  "/projects/:projectId/ai/problem",
  async (req, res): Promise<void> => {
    const params = GenerateProblemParams.safeParse(req.params);
    const body = GenerateProblemBody.safeParse(req.body);
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
    if (!(await hasProject(params.data.projectId, userId))) {
      res.status(404).json({ error: "Projet introuvable." });
      return;
    }
    try {
      checkAiRateLimit(userId);
      const result = await generateStructured(
        "À partir des éléments de l'étudiant, propose une problématique, une question principale et des questions secondaires, un objectif général, des objectifs spécifiques, et seulement si elles sont pertinentes des hypothèses. Pour chaque élément, explique sa fonction en termes accessibles. Présente le tout comme un brouillon à adapter, pas comme une vérité ou un travail final.",
        body.data,
        (value) => GenerateProblemResponse.parse(value),
      );
      await saveStepContent(
        params.data.projectId,
        "problem",
        JSON.stringify(result),
      );
      await saveStepContent(
        params.data.projectId,
        "objectives",
        JSON.stringify({
          generalObjective: result.generalObjective,
          specificObjectives: result.specificObjectives,
          hypotheses: result.hypotheses,
        }),
      );
      res.json(result);
    } catch (error) {
      sendAiError(req, res, error);
    }
  },
);

router.post(
  "/projects/:projectId/ai/explain",
  async (req, res): Promise<void> => {
    const params = ExplainConceptParams.safeParse(req.params);
    const body = ExplainConceptBody.safeParse(req.body);
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
    if (!(await hasProject(params.data.projectId, userId))) {
      res.status(404).json({ error: "Projet introuvable." });
      return;
    }
    try {
      checkAiRateLimit(userId);
      const result = await generateStructured(
        "Explique le concept académique demandé à trois niveaux : une première explication sans jargon, une explication appliquée au sujet et au niveau fournis, puis une explication plus approfondie. Donne un exemple explicitement présenté comme hypothétique s'il n'est pas vérifiable. Termine par un glossaire court. N'invente pas de règle d'établissement, de chiffre, de source ni de fait local.",
        body.data,
        (value) => ExplainConceptResponse.parse(value),
      );
      await saveUnderstanding(params.data.projectId, {
        concept: body.data.concept,
        explanation: result,
      });
      res.json(result);
    } catch (error) {
      sendAiError(req, res, error);
    }
  },
);

router.post(
  "/projects/:projectId/ai/quiz",
  async (req, res): Promise<void> => {
    const params = GenerateQuizParams.safeParse(req.params);
    const body = GenerateQuizBody.safeParse(req.body);
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
    if (!(await hasProject(params.data.projectId, userId))) {
      res.status(404).json({ error: "Projet introuvable." });
      return;
    }
    try {
      checkAiRateLimit(userId);
      const result = await generateStructured(
        "Crée cinq questions à choix multiples pour vérifier la compréhension du concept demandé. Chaque question doit avoir exactement quatre réponses plausibles et une seule bonne réponse. L'index correct est basé sur zéro. Fournis une explication pédagogique de la bonne réponse. Ne teste que des notions générales sûres ou présentes dans le contexte.",
        body.data,
        (value) => GenerateQuizResponse.parse(value),
      );
      await saveUnderstanding(params.data.projectId, {
        concept: body.data.concept,
        quiz: result,
      });
      res.json(result);
    } catch (error) {
      sendAiError(req, res, error);
    }
  },
);

router.post(
  "/projects/:projectId/ai/outline",
  async (req, res): Promise<void> => {
    const params = GenerateOutlineParams.safeParse(req.params);
    const body = GenerateOutlineBody.safeParse(req.body);
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
    if (!(await hasProject(params.data.projectId, userId))) {
      res.status(404).json({ error: "Projet introuvable." });
      return;
    }
    try {
      checkAiRateLimit(userId);
      const result = await generateStructured(
        "Construis un plan cohérent et personnalisable, adapté au type de travail, à la discipline, au niveau, à la question de recherche et aux consignes fournies. Pour chaque partie, donne son rôle et des questions pour aider l'étudiant à la rédiger. Indique que le plan doit être vérifié au regard des consignes officielles de son établissement; ne présente pas une structure générique comme une règle universelle.",
        body.data,
        (value) => GenerateOutlineResponse.parse(value),
      );
      await saveStepContent(
        params.data.projectId,
        "outline",
        JSON.stringify(result),
      );
      res.json(result);
    } catch (error) {
      sendAiError(req, res, error);
    }
  },
);

router.post(
  "/projects/:projectId/ai/writing",
  async (req, res): Promise<void> => {
    const params = ReviewWritingParams.safeParse(req.params);
    const body = ReviewWritingBody.safeParse(req.body);
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
    if (!(await hasProject(params.data.projectId, userId))) {
      res.status(404).json({ error: "Projet introuvable." });
      return;
    }
    try {
      checkAiRateLimit(userId);
      const result = await generateStructured(
        `Travaille uniquement à partir du texte fourni par l'étudiant. Applique l'action « ${body.data.action} » à la section « ${body.data.section} ». Conserve les idées et la voix de l'étudiant. Explique les changements, identifie les affirmations qui nécessitent une source, et ajoute une note pour l'aider à comprendre. N'ajoute aucun fait ni aucune référence non présents dans le texte.`,
        {
          text: body.data.text,
          field: body.data.field,
          level: body.data.level,
        },
        (value) => ReviewWritingResponse.parse(value),
      );
      await saveStepContent(
        params.data.projectId,
        body.data.section === "Relecture académique" ? "review" : "writing",
        JSON.stringify({
          section: body.data.section,
          originalText: body.data.text,
          suggestion: result,
        }),
      );
      res.json(result);
    } catch (error) {
      sendAiError(req, res, error);
    }
  },
);

router.post(
  "/projects/:projectId/ai/jury/start",
  async (req, res): Promise<void> => {
    const params = StartJurySimulationParams.safeParse(req.params);
    const body = StartJurySimulationBody.safeParse(req.body);
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
    const project = await getProjectDetail(params.data.projectId, userId);
    if (!project) {
      res.status(404).json({ error: "Projet introuvable." });
      return;
    }
    try {
      checkAiRateLimit(userId);
      const generated = await generateStructured(
        `Rédige une seule question orale réaliste de jury, de niveau « ${body.data.difficulty} », sur le sujet et les éléments du projet. Ne présuppose aucun résultat ou fait absent des informations fournies.`,
        {
          name: project.name,
          type: project.type,
          subject: project.subject,
          steps: project.steps,
        },
        parseFirstJuryQuestion,
      );
      const [session] = await db
        .insert(jurySessionsTable)
        .values({
          userId,
          projectId: params.data.projectId,
          difficulty: body.data.difficulty,
          questionNumber: 1,
          totalQuestions: 5,
        })
        .returning();
      const result = StartJurySimulationResponse.parse({
        question: generated.question,
        questionNumber: 1,
        totalQuestions: session.totalQuestions,
        difficulty: session.difficulty,
        simulationId: session.id,
      });
      await saveStepContent(
        params.data.projectId,
        "jury",
        JSON.stringify({
          question: result,
          answer: "",
          evaluation: null,
          startedAt: session.createdAt,
        }),
      );
      res.json(result);
    } catch (error) {
      sendAiError(req, res, error);
    }
  },
);

router.post(
  "/projects/:projectId/ai/jury/answer",
  async (req, res): Promise<void> => {
    const params = EvaluateJuryAnswerParams.safeParse(req.params);
    const body = EvaluateJuryAnswerBody.safeParse(req.body);
    if (
      !params.success ||
      !UUID_PATTERN.test(params.data.projectId) ||
      !body.success ||
      !UUID_PATTERN.test(body.data.simulationId)
    ) {
      res.status(400).json({
        error: body.success ? "Identifiant de simulation invalide." : body.error.message,
      });
      return;
    }
    const userId = getUserId(req);
    const [session] = await db
      .select()
      .from(jurySessionsTable)
      .where(
        and(
          eq(jurySessionsTable.id, body.data.simulationId),
          eq(jurySessionsTable.projectId, params.data.projectId),
          eq(jurySessionsTable.userId, userId),
        ),
      )
      .limit(1);
    if (!session || session.completedAt) {
      res.status(404).json({ error: "Simulation introuvable ou terminée." });
      return;
    }
    if (body.data.questionNumber !== session.questionNumber) {
      res.status(409).json({ error: "La question de cette simulation a changé." });
      return;
    }
    const project = await getProjectDetail(params.data.projectId, userId);
    if (!project) {
      res.status(404).json({ error: "Projet introuvable." });
      return;
    }
    try {
      checkAiRateLimit(userId);
      const judged = await generateStructured(
        `Évalue de façon encourageante mais exigeante la réponse de l'étudiant au jury. Donne une note entière sur 100, au moins un point fort, au moins un point à améliorer et un conseil concret. ${
          session.questionNumber < session.totalQuestions
            ? "Propose aussi une question de suivi pertinente dans nextQuestion."
            : "La simulation se termine maintenant; nextQuestion doit valoir null."
        } Ne juge que la réponse et les informations du projet fourni.`,
        {
          project: {
            subject: project.subject,
            type: project.type,
            steps: project.steps,
          },
          question: body.data.question,
          answer: body.data.answer,
          difficulty: session.difficulty,
          questionNumber: session.questionNumber,
        },
        parseJuryEvaluation,
      );
      const finished = session.questionNumber >= session.totalQuestions;
      const result = EvaluateJuryAnswerResponse.parse({
        ...judged,
        nextQuestion: finished ? null : judged.nextQuestion,
        finished,
      });
      await db.transaction(async (tx) => {
        const claimed = await tx
          .update(jurySessionsTable)
          .set({
            questionNumber: finished
              ? session.questionNumber
              : session.questionNumber + 1,
            scoreTotal: session.scoreTotal + judged.score,
            completedAt: finished ? new Date() : null,
          })
          .where(
            and(
              eq(jurySessionsTable.id, session.id),
              eq(jurySessionsTable.questionNumber, session.questionNumber),
              isNull(jurySessionsTable.completedAt),
            ),
          )
          .returning({ id: jurySessionsTable.id });
        if (claimed.length === 0) {
          throw new AiServiceError(
            "Cette réponse a déjà été enregistrée. Passe à la question suivante.",
            409,
          );
        }
        await tx.insert(juryAnswersTable).values({
          sessionId: session.id,
          questionNumber: session.questionNumber,
          question: body.data.question,
          answer: body.data.answer,
          score: judged.score,
          strengths: judged.strengths,
          improvements: judged.improvements,
          advice: judged.advice,
        });
      });
      await saveStepContent(
        params.data.projectId,
        "jury",
        JSON.stringify({
          question: {
            simulationId: session.id,
            question: body.data.question,
            questionNumber: session.questionNumber,
            totalQuestions: session.totalQuestions,
            difficulty: session.difficulty,
          },
          answer: body.data.answer,
          evaluation: result,
        }),
      );
      res.json(result);
    } catch (error) {
      sendAiError(req, res, error);
    }
  },
);

export default router;
