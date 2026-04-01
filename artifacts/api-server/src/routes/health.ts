import { Router, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router = Router();

router.get("/healthz", (_req: Request, res: Response): void => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});

export default router;
