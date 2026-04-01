import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { casesTable, uploadsTable, auditLogsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const caseNumber = (req.params.caseNumber || req.body.caseNumber || "unknown").replace(/[^A-Z0-9-]/g, "");
    const category = req.body.category || "other";
    const dir = path.join(UPLOADS_DIR, caseNumber, category);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${ts}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    cb(null, allowed.includes(file.mimetype));
  },
});

function validateToken(req: Request): { username: string; name: string; role: string } | null {
  // Accept token from Authorization header OR from query param (for browser image/iframe loads)
  const auth = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  const raw = auth?.startsWith("Bearer ") ? auth.slice(7) : queryToken;
  if (!raw) return null;
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64").toString());
    if (decoded.exp && decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  id_image: "صورة الهوية",
  grades_screenshot: "كشف العلامات",
  supporting_doc: "وثيقة داعمة",
  sent_screenshot: "لقطة شاشة الإرسال",
  follow_up_reply_screenshot: "لقطة شاشة رد البريد الإلكتروني",
  other: "أخرى",
};

// ── Student upload: POST /api/upload/:caseNumber ──
router.post("/upload/:caseNumber", upload.single("file"), async (req: Request, res: Response) => {
  const { caseNumber } = req.params;
  const { email, category = "other" } = req.body;

  if (!req.file) return res.status(400).json({ error: "No file provided" });
  if (!email) return res.status(400).json({ error: "Email required" });

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: "Case not found" });
  }

  if (caseRecord.email.toLowerCase() !== email.toLowerCase()) {
    fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: "Email does not match case" });
  }

  const relativePath = path.relative(UPLOADS_DIR, req.file.path);
  const [inserted] = await db.insert(uploadsTable).values({
    caseId: caseRecord.id,
    caseNumber,
    fileName: req.file.originalname,
    storagePath: relativePath,
    mimeType: req.file.mimetype,
    size: req.file.size,
    category,
    uploadedBy: "student",
  }).returning();

  return res.status(201).json({
    id: inserted.id,
    fileName: inserted.fileName,
    category,
    categoryLabel: CATEGORY_LABELS[category] || category,
    size: inserted.size,
    mimeType: inserted.mimeType,
    uploadedAt: inserted.uploadedAt,
  });
});

// ── Admin upload: POST /api/admin/cases/:caseNumber/upload ──
router.post("/admin/cases/:caseNumber/upload", upload.single("file"), async (req: Request, res: Response) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { caseNumber } = req.params;
  const { category = "other" } = req.body;

  if (!req.file) return res.status(400).json({ error: "No file provided" });

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: "Case not found" });
  }

  const relativePath = path.relative(UPLOADS_DIR, req.file.path);
  const [inserted] = await db.insert(uploadsTable).values({
    caseId: caseRecord.id,
    caseNumber,
    fileName: req.file.originalname,
    storagePath: relativePath,
    mimeType: req.file.mimetype,
    size: req.file.size,
    category,
    uploadedBy: user.name,
  }).returning();

  await db.insert(auditLogsTable).values({
    action: "file_uploaded",
    caseId: caseRecord.id,
    performedBy: user.username,
    details: `File uploaded: ${req.file.originalname} (${category}) by ${user.name}`,
  });

  return res.status(201).json({
    id: inserted.id,
    fileName: inserted.fileName,
    category,
    categoryLabel: CATEGORY_LABELS[category] || category,
    size: inserted.size,
    mimeType: inserted.mimeType,
    uploadedAt: inserted.uploadedAt,
  });
});

// ── Admin list attachments: GET /api/admin/cases/:caseNumber/attachments ──
router.get("/admin/cases/:caseNumber/attachments", async (req: Request, res: Response) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { caseNumber } = req.params;

  const [caseRecord] = await db
    .select({ id: casesTable.id })
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord) return res.status(404).json({ error: "Case not found" });

  const attachments = await db
    .select()
    .from(uploadsTable)
    .where(eq(uploadsTable.caseId, caseRecord.id))
    .orderBy(uploadsTable.uploadedAt);

  // Return paths WITHOUT the /api prefix — the frontend's API_BASE already supplies it.
  return res.json({
    attachments: attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      category: a.category,
      categoryLabel: CATEGORY_LABELS[a.category] || a.category,
      mimeType: a.mimeType,
      size: a.size,
      uploadedBy: a.uploadedBy,
      uploadedAt: a.uploadedAt,
      fileExists: fs.existsSync(path.join(UPLOADS_DIR, a.storagePath)),
      viewUrl: `/admin/attachments/${a.id}/view`,
      downloadUrl: `/admin/attachments/${a.id}/download`,
    })),
  });
});

// ── Serve file for admin: GET /api/admin/attachments/:id/view ──
router.get("/admin/attachments/:id/view", async (req: Request, res: Response) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id, 10);
  const [attachment] = await db
    .select()
    .from(uploadsTable)
    .where(eq(uploadsTable.id, id))
    .limit(1);

  if (!attachment) return res.status(404).json({ error: "Attachment not found" });

  const filePath = path.join(UPLOADS_DIR, attachment.storagePath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found on disk" });

  res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.fileName)}"`);
  fs.createReadStream(filePath).pipe(res);
});

// ── Download file for admin: GET /api/admin/attachments/:id/download ──
router.get("/admin/attachments/:id/download", async (req: Request, res: Response) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id, 10);
  const [attachment] = await db
    .select()
    .from(uploadsTable)
    .where(eq(uploadsTable.id, id))
    .limit(1);

  if (!attachment) return res.status(404).json({ error: "Attachment not found" });

  const filePath = path.join(UPLOADS_DIR, attachment.storagePath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found on disk" });

  res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
  fs.createReadStream(filePath).pipe(res);
});

// ── Delete attachment: DELETE /api/admin/attachments/:id ──
router.delete("/admin/attachments/:id", async (req: Request, res: Response) => {
  const user = validateToken(req);
  if (!user || !["admin", "super_admin"].includes(user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const id = parseInt(req.params.id, 10);
  const [attachment] = await db
    .select()
    .from(uploadsTable)
    .where(eq(uploadsTable.id, id))
    .limit(1);

  if (!attachment) return res.status(404).json({ error: "Attachment not found" });

  const filePath = path.join(UPLOADS_DIR, attachment.storagePath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await db.delete(uploadsTable).where(eq(uploadsTable.id, id));
  return res.json({ success: true });
});

export default router;
