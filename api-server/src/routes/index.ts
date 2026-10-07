import { Router, type IRouter } from "express";
import healthRouter from "./health";
import guidesRouter from "./guides";
import projectsRouter from "./projects";
import assistantsRouter from "./assistants";
import { requireAuth } from "../lib/academic-helpers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(guidesRouter);
router.use(requireAuth);
router.use(projectsRouter);
router.use(assistantsRouter);

export default router;
