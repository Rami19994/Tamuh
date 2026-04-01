import { Router, type IRouter } from "express";
import healthRouter from "./health";
import casesRouter from "./cases";
import adminRouter from "./admin";
import uploadsRouter from "./uploads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(casesRouter);
router.use(adminRouter);
router.use(uploadsRouter);

export default router;
