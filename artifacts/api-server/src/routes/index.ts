import { Router, type IRouter } from "express";
import healthRouter from "./health";
import passesRouter from "./passes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(passesRouter);

export default router;
